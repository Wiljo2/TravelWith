# Group voting on dates and destination — design note (onboarding step 7)

Status: design, 2026-10-22 · Branch: `feat/first-run-onboarding` · Parent: `first-run-onboarding.md` step 7.

## Recommendation in short

- Keep the plan's model: a vote is a "Por decidir" task (`cat: "decidir"`) with a new `trip_tasks.decides`; its options are
  `trip_task_options` rows with new `votes text[]`, `start_date`, `end_date`. One additive migration, **027**.
- Voting: `taskOption.vote { id, on }` → SQL `set_task_option_vote` (voter = `ctx.userId`, idempotent, unguarded). Closing:
  `task.closeVote` (owner only) → SQL `close_task_vote`, one transaction for header + days + task, instead of chaining
  `trip.update` and `itinerary.reset`.
- `TripInfo.startDate/endDate` become optional behind `hasDates(trip)`; `get_trip` always returns `trip`, with dates only
  when both are set. Clients one deploy behind already tolerate that (checked in §2).
- Four shippable steps: 7a groundwork (no migration) → 7b votes on any option → 7c date/destination votes → 7d undated
  trips + wizard.

## 1. Data model

**Number 027.** 001–022 and 024 are on `main`; 023 is `feature/reel-options` (`023_event_tentative.sql`, unmerged);
roadmap §6 reserves 025/026 for wave 2, which comes first. Gaps are harmless. `get_trip` is recreated by 020/023/025/026,
so 027 copies the **newest definition on `main` when written** (020 today). Add a static test in
`src/lib/tripTablesMigrations.test.ts` that every key of the previous `get_trip` is still in 027's.

```sql
alter table public.trip_tasks        add column if not exists decides    text;
alter table public.trip_task_options add column if not exists votes      text[];
alter table public.trip_task_options add column if not exists start_date date;
alter table public.trip_task_options add column if not exists end_date   date;
-- constraints in a do $$ … if not exists (pg_constraint) … $$ block, as in 020:
--   trip_tasks_decides           decides is null or decides in ('dates', 'destination')
--   trip_task_options_votes_size votes is null or cardinality(votes) <= 200                -- LIMITS.votesPerOption
--   trip_task_options_dates      (start_date is null) = (end_date is null)
--                                and (end_date is null or end_date between start_date and start_date + 59)  -- MAX_TRIP_DAYS

create or replace function public.set_task_option_vote(p_code text, p_option_id text, p_on boolean, p_user uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare v jsonb;
begin
  update public.trip_task_options o
     set votes = case when p_on then coalesce(o.votes, '{}') || p_user::text
                      else nullif(array_remove(o.votes, p_user::text), '{}') end,
         updated_by = p_user                                         -- audit attributes the vote
   where o.room_code = p_code and o.id = p_option_id
     and (p_user::text = any(coalesce(o.votes, '{}'))) is distinct from p_on   -- no-op: no write, no broadcast
  returning to_jsonb(o) into v;
  if v is null then
    select to_jsonb(o) into v from public.trip_task_options o where o.room_code = p_code and o.id = p_option_id;
    if v is null then raise exception 'option not found' using errcode = 'P0002'; end if;
  end if;
  return v;
end $$;
```

- The UPDATE locks the row, so concurrent voters serialize; READ COMMITTED re-checks the WHERE against the newer row, so no
  vote is lost.
- `close_task_vote(p_code, p_task_id, p_option_id, p_expected_version, p_days jsonb, p_replace boolean, p_user)`, modeled
  on `choose_task_option` (017):
  - lock the task; stale or missing → `{conflict, current}`;
  - `decides` set and `done` false, else `22023`; the option must belong to the task, else `P0002`;
  - dates: refuse (`22023`) when events exist and `p_replace` is false, else set `rooms.start_date/end_date` and
    `perform public.reset_itinerary(p_code, p_days, p_user)`;
  - destination: `rooms.destination = label` (≤ 80);
  - then `done = true, updated_by = p_user`; return `{task, days, trip}`.
  - Grants as 015/017: `revoke all … from public, anon, authenticated; grant execute … to service_role`.
- `get_trip`: options add `votes`, `startDate`/`endDate` (`to_char`); tasks add `decides`; the trip block is always emitted
  (`name`, `destination`, dates only when both are set; `jsonb_strip_nulls` drops the rest).
- RLS: nothing to add. These are columns on tables with the 009 restrictive policies, and clients never write.
- Broadcast: `broadcast_trip_change` (010) sends full rows, so new columns flow as is (one option UPDATE per vote). A close
  fires `broadcast_room_change` (016/018) and day INSERTs, which clients refetch through `needsRefetch`.
- Version: `bump_trip_row_version` (013) bumps the option version on every vote, which is what makes clients accept the
  broadcast (see trade-offs below).
- Audit: one `trip_changes` row per vote. `rooms` is not audited, so a close shows as "task done" plus day rows.
- Left as is: `delete_trip_row` (no new table) and `trip_payload`/`rebuild_payload`. Votes are lost on a payload rollback,
  which is acceptable for the reason 020 gives for icons.
- `constants/limits.ts`: add `votesPerOption: 200` and `voteOptions: 3` (the "2–3 options" decision, a hard cap for
  `decides` tasks only; regular tasks keep `optionsPerTask: 20`).

**Voter key.** `Idea.votes` holds `user?.id ?? "local"` (`components/ideas/IdeasTab.tsx:50`), and `useIdeas.toggleVote`
rewrites the whole idea, which `useFeatureSync` sends as a guarded `idea.update` (`server/ops/features.ts`). Two people
voting on one idea therefore 409; that is what the SQL function avoids. For options, the key is the auth user id:
server-side `ctx.userId` from `requireMember`, never the body; client-side `user.id` (`"local-user"` in the sandbox,
`data/localSandbox.ts`). Counts include only voters still in `members` (`RoomMember.userId`); with an empty roster
(local mode), every vote counts.

**Column vs. a votes table (evidence).** The column reuses everything that already carries option rows (`get_trip`,
`rowToTaskOption`, `applyToTasks`, `versionEntries`, Broadcast). A table would add a `TripTable` in three places
(`types/database.ts`, `utils/tripRows.ts`, `TRIP_TABLES` in `utils/tripChannel.ts`), an RLS block copied from 009,
triggers copied from 010, and id-only DELETE handling. Accepted costs:

- votes bump the option version, so a racing `taskOption.update` gets a 409 and its queued edits drop (`lib/opQueue.ts`
  `handle`); option text is rarely edited during a vote;
- `OpQueue.acceptRemote` skips an option's remote rows while my vote is in flight (`opQueue.ts:107`). Mitigation: put
  `taskOption.vote` in `APPLY_RESPONSE`, applied only when nothing else is queued for that option; the response holds
  every vote committed before mine. A vote landing just after mine stays hidden until the next refetch (focus or
  resubscribe).

The plan's "not through the row version" is half true: votes skip the guard but still bump the version. Fallback if
staging shows trouble: roadmap 4.4's `trip_task_option_votes` rows, aggregated by `get_trip` into the same `votes` array.

## 2. Undated trips end to end

**Pick: optional dates on `TripInfo`**, with `DatedTrip = TripInfo & {startDate: string; endDate: string}` and
`hasDates(t): t is DatedTrip` in `utils/tripDays.ts`. It widens the type without renaming or repurposing (the meaning
stays "ISO date when present"), and `tsc` lists every consumer. A separate header field would duplicate
`name`/`destination` and force every reader to merge two sources.

**Old clients are safe.**

- `RoomPayload.trip?` is already optional, and `useTripInfo.loadTripInfo` sets the trip whenever it has a name.
- `parseISODate(undefined)` returns null at runtime (`RegExp.exec` coerces to `"undefined"`), so `tripPhase`,
  `tripDayIndex`, `fmtTripDates` and `generateDays` return null or "" instead of throwing.
- Zero days render empty: `days[0]?.` in `ItineraryAgenda.tsx:40` and `BudgetView.tsx:59`.
- What degrades: the Hero shows "0 días de viaje", and `applyHeader` drops live header changes of undated trips
  (`useTripInfo.ts:32`).
- Legacy rooms with null dates start getting `trip: {name}` too. Harmless; find them on staging with
  `select code from rooms where start_date is null or end_date is null`.

| Consumer | Undated behavior / change |
| --- | --- |
| `lib/validate.ts` `validateTripInput` | Both dates or neither; one alone → null (400). New `validateTripHeader` (name + optional dates) for `validateRoomPayload`, which the local `idea-plan`/`places` routes and `data/localPayload.ts` use |
| `app/api/rooms/route.ts` POST | No dates → null columns, no `resetItinerary`; vote tasks seeded via `tasks[].decides` (`domain/seedRows.ts` `starterTaskArgs`) |
| `app/api/rooms/list/route.ts` `tripInfo()` | Return `{name, destination}` without dates (today: null) |
| `hooks/useTripInfo.ts` `applyHeader` | Pure, tested `headerToTrip(h, prev)`: `start_date: null` → no dates, instead of dropping the header |
| `App.tsx:165` `tripDayIndex`, `:210` reset | `hasDates` guard; "Restablecer itinerario" hidden when undated |
| `AppHeader.tsx:73`, `gate/TripList.tsx` | "Fechas por decidir" |
| `home/HomeView.tsx:59`, `ideas/IdeasTab.tsx:49` `tripPhase` | Guard → null phase. Inicio: `VoteCard` replaces `Hero`; "Primeros días" hidden with no days |
| `utils/tripReport.ts:64` (PDF), `utils/assistantDraft.ts:31` | `trip?.startDate` guard (label fallback exists); "aún sin fechas (las vamos a votar)" |
| `utils/tripSetup.ts` `suggestTripName`, `data/freshRoom.ts` | No month suffix; `days: []`, `seedTasks` keeps `decides` |
| `budget/BudgetView.tsx` | Per-day section and its add button hidden when `days.length === 0` |
| No change | `domain/dayRows.ts` `resetDays`, `server/ideaPlan.ts:184`, `server/geocode.ts`, `server/video/analyze.ts`, map `utils/tripGeo.ts` (no stops → world view) |

## 3. Ops (`src/server/ops/votes.ts` in `ops/index.ts`; pure checks in `src/server/domain/voteRows.ts`)

| Op | Args | minRole | Validation | Write |
| --- | --- | --- | --- | --- |
| `task.create` (ext.) | `decides?` | member | Forces `cat: "decidir"` and backlog; one open vote per kind | `tasksRepo.insert` |
| `taskOption.create/.update` (ext.) | `startDate?`, `endDate?` | member | Both or neither, valid, ≤ 60 days. The op loads the task: dates vote → dates required; destination → label ≤ `LIMITS.name`; ≤ `voteOptions`; closed vote → refused | `taskOptionsRepo` |
| `taskOption.vote` (new) | `{id, on}` | member | Option exists, task open | `setOptionVote` (`repo/taskOptions.ts`) → rpc |
| `task.closeVote` (new) | `{taskId, optionId, replaceItinerary?}` + `expectedVersion` | **owner** | Open `decides` task, its option. Dates: `generateDays` → `ResetDay[]`; events without `replaceItinerary` → `DomainError` | `closeTaskVote` (`repo/tasks.ts`) → rpc; `changed` task + days, `trip` header |

- Guards in `ops/tasks.ts`: `task.chooseOption` refuses `decides` tasks; `task.toggle`, `task.update` with `done` and
  `task.delete` of a `decides` task are owner only (403); `taskOption.delete` is refused on a closed vote; `taskPatch`
  never sets `decides`. Old clients tapping "✓ Elegir" or the checkbox on a vote get 400/403 → resync, and their
  `syncOptions` never sends votes or dates.
- SQL functions only for the read-modify-write vote and the multi-row close; adding or removing an option is one row on
  the existing repos.
- Closing a dates vote: an undated trip has no days (no op creates them), hence no events, and the reset just inserts
  `d0…dN`. A dated trip keeps day ids (relabeled), drops extra days (their expenses and tasks go back to Globales and the
  backlog through the foreign keys) and deletes events. Hence `replaceItinerary` with a UI confirm "Se borrarán N
  actividades" (the "Restablecer itinerario" contract); the SQL re-checks, so an event added mid-dialog is never wiped
  silently. Later: relabel without deleting when the day count is unchanged (backlog "Editing trip dates…").
- Update `src/server/ops/tripOps.test.ts` (op list; "only itinerary.reset is owner-only").

## 4. Client

- **Types and rows:** `TaskDecides = "dates" | "destination"`, `Task.decides?`, `TaskOption.votes?/startDate?/endDate?`
  (`types/index.ts`); `VOTE_KINDS` in `constants/votes.ts` ("¿Cuándo viajamos?" / "¿A dónde vamos?"); `rowToTaskOption` /
  `rowToTask` in `utils/tripRows.ts` (unknown `decides` → undefined); `types/database.ts` columns and functions. Pure,
  tested `utils/votes.ts`: `isVote`, `voteCount(option, memberIds?)`, `hasVoted`, `ranked` (ties = "Empate"),
  `dateOptionLabel`.
- **Hooks:** new `hooks/useVotes.ts` (GUIDELINES §3 names voting as the example of a new domain hook), composed in
  `useTripData` as `data.votes`. Vote state stays in `useTasks` (votes are option fields), which gains a state-only
  `patchOptionLocal`; `syncOptions` adds `startDate`/`endDate` (never `votes`); `applyRow` is unchanged. `useVotes`:
  - `vote(optionId, voter, on)`: optimistic, then send. `startVote(decides)`: `addTask({title, cat: "decidir", decides})`.
  - `closeVote(taskId, optionId, replace)`: optimistic `done`, then send; `trip` returns via `onTrip` → `applyHeader`,
    days via a resync. In local mode it runs in memory: `tripInfo.applyHeader(...)` + `itinerary.loadItinerary(generateDays(...))`.
- **`lib/opQueue.ts`** (+ tests): `taskOption.vote` is `MERGEABLE` and in `APPLY_RESPONSE` (only when that key is idle);
  `task.closeVote` is keyed like `task.chooseOption`, `GUARDED`, and resyncs after `ok` like `itinerary.reset`.
- **UI:**
  - `components/votes/`: `VoteCard` (Inicio); `VoteOptions` (✋ toggle, count, voter avatars from `members`);
    `ProposeOption` (dates use `DateRangeFields`, extracted from `wizard/QuestionSteps.tsx` `DatesStep`);
    `CloseVoteDialog` (owner; shadcn `Dialog`, leader preselected, replace warning).
  - Inicio (`home/HomeView.tsx`): undated → `VoteCard` replaces `Hero`; dated → above "Primeros días"; `toDecide`
    excludes `decides` tasks.
  - Pendientes: first extract `TaskRow` from `tasks/TasksView.tsx` (345 lines). Vote tasks render `VoteOptions`, with no
    checkbox or "✓ Elegir" for members. Regular options get ✋ and a "Más votada" badge in `TaskOptions`, with "✓ Elegir"
    unchanged (the "free" part). The composer offers "🗳️ Votar fechas / destino" when none of that kind is open.
  - Itinerario: new `itinerary/DatesPending.tsx` ("Primero decidamos las fechas" → "Ir a la votación", or "Votar las
    fechas", which creates one), so an undated trip always has a path to dates.
  - Wizard (`gate/CreateTripWizard.tsx`, `wizard/model.ts`, `QuestionSteps.tsx`, `ConfirmStep.tsx`): answers gain
    `voteDates` / `voteDestination`; step 1's "🤔 Aún no sé" becomes "🗳️ Aún no sabemos, lo votamos" and step 2 gains it;
    `canAdvance` / `canCreate` accept it; confirm shows "📅 Fechas por votar"; `submit` adds `{title, cat: "decidir",
    decides}` starter tasks (≤ 2 booking + 2 votes ≤ `LIMITS.starterTasks` 5).
  - `utils/activityText.ts`: `votes` ("votos"), `start_date` / `end_date` ("fechas"), "Ana votó en la opción “…”".
- **Sandbox `?local=new`:** `freshRoomPayload` handles undated trips; votes and closing run in memory with voter
  `"local-user"`. Walk: wizard "lo votamos" → Inicio → propose 2 ranges → vote → close → Itinerario has days. Two voters:
  staging only.
- **`App.tsx` (400 lines):** first move the calendar tab block (`App.tsx:239–301` plus `todayIdx`) into
  `components/itinerary/ItineraryTab.tsx`. It takes the `itinerary` / `taskState` objects, hosts `DatesPending`, and
  frees about 60 lines. Next candidate: the `SlotCreateModal` block + `slotDraft` → `components/calendar/SlotDraft.tsx`.

## 5. Agent assistant (`src/server/agent/*`)

- Nothing is required: `prompt.ts` stays byte-stable; `get_trip_overview` passes `trip` through (no dates = undecided)
  with `days: []`; an undated create fails with a `DomainError` the model reads.
- Recommended, data only, through read tools: `domain/read.ts` `tripOverview` adds `openVotes` (`taskId`, `decides`,
  options with label, dates, votes) and `decides` on `backlogTasks`; `domain/core.ts` `requireDay` says "no days yet:
  dates pending a group vote" when `days` is empty.
- No vote or close write tools in v1: the agent is owner-only, and closing needs the replace confirm.
- Unmerged `feature/agent-tools`: its `choose_task_option` gets the `decides` refusal as `is_error`, and it edits
  `read.ts`, so land the agent bits after it merges.

## 6. Rollout and risk

- **Order:**
  1. 7a merges.
  2. 027 is written in 7b, with `get_trip` checked against `main`.
  3. Scratch run on PGlite (`auth` / `realtime` stubbed, as in `relational-broadcast-progress.md`).
  4. **Owner** applies it to staging, then to production **before** the deploy that calls the new functions. No
     production migration during the trip (Nov 26 – Dec 4).
- **Owner action (staging):**
  - Confirm 020–024 (and 023/025/026 if merged) are applied, then paste 027 into the `travelwith-staging` SQL editor.
  - Verify `select public.get_trip('NVHPCI') -> 'payload' -> 'trip'` and the new columns in `information_schema.columns`.
- **Compatibility:** old code on 027 ignores the new columns and functions and tolerates the undated `trip`; a code
  rollback after undated trips exist only shows "0 días"; new code without 027 keeps `get_trip` working, but votes 500
  (`SyncNotice`), hence migration first.
- **Trip created before the change (GUIDELINES §2.7):** staging `NVHPCI` loads, edits and chooses an option as before,
  with 0 votes on its options; also open a legacy null-dates room, if any.
- **vitest:**
  - `voteRows`; `taskRows` (`decides` forced to backlog / "decidir"); `tripOps`; `validate` (no dates OK, one → null).
  - `taskOps`: the rpc gets `ctx.userId` even when `args` carries a voter; `chooseOption` refused on a vote; member
    toggle or delete → 403; `closeVote` owner-only, refuses events without replace, sends the `generateDays` days.
  - `tripRows`, `votes`, `headerToTrip`, `freshRoom` (undated), `tripSetup`, `opQueue`, `activityText`, `domain`
    (`openVotes`); static 027 tests (checks mirror `LIMITS`, grants, `get_trip` keys); `types/database.test.ts`.
- **Staging only (`docs/plans/staging-test/`, two accounts):** A and B vote on the same option at the same moment and
  both votes stay, live; B has no close button and a forced call returns 403; A closes a dates vote and both see the
  days and header live (with activities: confirm, then replaced); a destination close updates the header and the Ideas
  places; an undated trip keeps Gastos, Ideas and Pendientes working, and Itinerario shows `DatesPending`.

## 7. Slicing (each passes `npx tsc --noEmit`, `npm test`, `npx oxlint src`)

- **7a — Groundwork, no migration, no behavior change:** extract `ItineraryTab`, `TaskRow`, `DateRangeFields`; optional
  `TripInfo` dates + `hasDates` guards for every row of §2; `headerToTrip`, the list route, `validateTripHeader`. POST
  stays strict until 7d. Safe alone, since every trip is still dated.
- **7b — Votes on any "Por decidir" option:** migration 027 in full; `TaskOption.votes`; `taskOption.vote` +
  `set_task_option_vote`; opQueue changes; `useVotes.vote`; ✋ in `TaskOptions`; counts on Inicio; activity text.
  **Needs 027 on staging** beyond unit tests and the sandbox.
- **7c — Date / destination votes on a dated trip:** `decides`, option dates, extended ops and guards, `task.closeVote` +
  `close_task_vote`, `VoteCard`, `CloseVoteDialog`, Pendientes vote rows, agent read views. **Needs 027 on staging**.
- **7d — Undated trips + wizard:** POST optional dates + `decides` seeds, wizard chips, `DatesPending`, undated Inicio,
  header, list and budget; docs (GUIDELINES API table: `startDate?` / `endDate?` both or neither, `tasks[].decides?`;
  entities; `test-checklist.md` item 10 log). Walkable in `?local=new`; **027 on staging** (undated `trip`) for the real
  walk.
- A SQL fix after 027 reaches staging goes in 028; applied migrations are never edited.

## Open questions for the owner

1. Approval voting (back several date ranges, Doodle style) or one choice per person? Recommended: approval (one toggle
   per option, like ideas; fits "I can make these dates").
2. Can the owner vote for placeholder travelers ("Viajero 2"), who have no account? Recommended: not in v1.
3. Removing an option that has other people's votes: anyone after a confirm with the count (today's behavior), or owner
   only? Recommended: anyone, with the confirm.
4. Wizard step 1: replace "🤔 Aún no sé" (skip without a vote) with "Aún no sabemos, lo votamos", or keep both?
   Recommended: replace.
5. Should the wizard collect the first 1–3 date proposals, or does the creator add them on Inicio right after?
   Recommended: Inicio (keeps 4 screens and avoids seeding options).
6. Roadmap 4.4 says "choosing becomes owner-only" once options have votes. Should that apply to regular "Por decidir"
   tasks? Recommended: no; only `decides` votes are owner-closed.

## Decisions (2026-10-22, orchestrator, following the recommendations as the owner asked)

1. Approval voting: each person can back several options.
2. No voting on behalf of placeholder travelers in v1.
3. Anyone can remove an option, after a confirm that shows its vote count.
4. Wizard step 1: "Aún no sabemos, lo votamos" replaces "🤔 Aún no sé".
5. The wizard doesn't collect proposals; the creator adds them on Inicio right after.
6. Owner-only closing applies only to `decides` votes, not to regular "Por decidir" tasks.
7. `LIMITS.voteOptions` = 5 (not 3): since anyone can add options, 3 would block a fourth person's
   proposal; the UI still suggests 2–3. One constant, easy to change.

