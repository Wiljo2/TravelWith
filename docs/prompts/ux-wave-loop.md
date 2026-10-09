# TravelWith: UX wave 1 (loop prompt)

> Usage (Claude Code on Opus, repo root, on branch `feature/ux-wave`):
> `/loop Follow docs/prompts/ux-wave-loop.md and run the next iteration`
> Each run completes ONE step from `docs/plans/ux-wave.md`, commits it, updates the progress file, and stops. The loop ends per section 7.

---

## 0. Goal

Implement `docs/plans/ux-wave.md`: landing page for anonymous visitors, human-in-the-loop approval for every assistant write/delete, dynamic emoji icons for events and tasks, and Google-Calendar-style save feedback. The plan is the source of truth. If a step shows the plan is wrong or incomplete, update the plan in the same commit and say why in the log.

## 1. Roles: Opus orchestrates, Sonnet implements

- **This session (Opus) is the orchestrator.** It plans the step, writes briefs, reviews, runs checks, commits. It does not hand off review or commit decisions.
- **Implementation goes to subagents** via the `Agent` tool with `subagent_type: "general-purpose"` and `model: "sonnet"`. Read-only code searches may use `Explore` with `model: "sonnet"`.
- **Brief for each subagent** (it starts with no context): step id and goal; exact files to create/change and existing functions to reuse (with paths); acceptance criteria and tests to add; the hard rules from section 2 that apply; "do not commit, do not run git write commands, do not touch files outside the list"; report back a list of changed files and anything uncertain.
- **Parallelism:** launch several subagents in one message only when their file sets are disjoint (e.g. server half and client half of a step). Otherwise sequential.
- **Review:** Opus reads the full diff (`git diff`) against the brief and section 2. Problems go back to the same subagent with `SendMessage` (max 2 rounds); after that Opus fixes them itself.
- Small mechanical steps (docs, a one-file change) may be done by Opus directly.

## 2. Ground rules

- **Read first, every iteration:** `CLAUDE.md`, `GUIDELINES.md`, `docs/plans/ux-wave.md`, `docs/plans/ux-wave-progress.md`.
- **Branch:** only `feature/ux-wave`. If different, stop and say so. Never push, open PRs or merge.
- **No remote writes:** never apply migrations, run SQL, set env vars, or call Supabase/Vercel APIs that change state. Those are `HUMAN` steps, prepared and documented, not executed.
- **Never print secrets** from `.env.local` or anywhere else.
- **Repo rules:** new persisted fields nullable / optional with read-time defaults (GUIDELINES §2 checklist); SQL migrations only as new files with the next number; English code and docs, Spanish UI copy; `@/` imports; theme tokens and shadcn primitives; no file over ~400 lines; server writes only through the op registry; no unnecessary comments.
- **Agent prompt** (`src/server/agent/prompt.ts`) stays byte-stable; it changes only in step H.3, as static text.
- **Checks before every commit:** `npx tsc --noEmit`, `npm test`, `npm run lint` (0 errors), and `npx next build` for steps touching app code. New SQL must parse: `libpg-query` from a scratch directory (never added to `package.json`).
- **Tests:** every step adding logic adds Vitest tests (`src/test/supabaseMock.ts`, `src/test/routeHelpers.ts` for routes).
- **Verification steps (`*.V`):** run `npm run dev` in the background, drive the UI with the Playwright MCP (desktop and 375px wide), use `?local=1` where a real backend is not needed, save screenshots to the scratchpad and record results in the log. Stop the dev server at the end.
- **Commit** once per step: `<type>(<area>): <summary> (step X.Y)` plus the attribution trailer from the session instructions. Never commit `audit/`, `.mcp.json` or unrelated files.
- **If blocked:** record the blocker (what is needed, from whom) and continue with the next independent step; otherwise stop the loop.

## 3. Progress file

`docs/plans/ux-wave-progress.md`. Mark `[x]` only when the commit exists and checks passed; `[H]` prepared and waiting for a human; `[B]` blocked (reason in the log). Update the header (iteration, last commit, next step, human actions pending) and add one log row per iteration, in the same commit as the step.

## 4. Iteration procedure

1. Read the files in section 2 and confirm the branch and a clean tree (only the known untracked files).
2. Pick the first `[ ]` step whose dependencies are `[x]` (or `[H]` if the step can proceed without the human result). Order: L → H → I → S → F; dependencies: L.1→L.2→L.3→L.V, H.1→H.2→H.3→H.4→H.V, I.1→I.2→I.3→I.4→I.V, S.1→S.2→S.3→S.V, F.1 last.
3. Read the code the step touches, then brief and launch the Sonnet subagent(s) (section 1).
4. Review the diff; iterate until it matches the plan.
5. Run the checks; fix until green. If still red after reasonable effort, revert the step, mark `[B]` with the error, and stop.
6. Commit with the progress update. Do not start the next step.

## 5. Quality bar

- Old trips keep working (no `icon`, legacy categories, missing optional fields).
- No assistant write ever runs without an explicit approval decision from the client (H.2 tests prove it).
- The resume token is bound to room code and user, expires, and is rejected if tampered.
- Errors to clients go through `errorResponse`; no database or provider messages leak.
- Mobile layout (375px) checked for every UI step.

## 6. Stop conditions for a single run

Stop after committing one step, or earlier if the branch is wrong, the tree has unexpected changes, checks cannot be made green, or the next step depends only on `HUMAN`/blocked steps.

## 7. Loop exit

End the loop (and say so) when every step is `[x]` or `[H]`, or when no step can proceed without a human.

## 8. Per-iteration final message

At most 6 lines, in Spanish: iteration number and step done (commit sha), what changed in one line, checks and results, anything a human must do, next step.
