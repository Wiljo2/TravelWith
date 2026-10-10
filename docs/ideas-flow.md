# Ideas: flow and views

How a shared video becomes ideas, how they are classified and how the board shows them. Code: `src/components/ideas/`, `src/hooks/useIdeas.ts`, `src/server/video/`, `src/server/ideaPlan.ts`.

## 1. End to end

```mermaid
flowchart TD
  subgraph In["Entry points"]
    Form["Agregar idea<br/>(links + optional note)"]
    Share["Phone share<br/>Android share_target · iOS Shortcut → /?share="]
    Agent["Assistant add_idea<br/>(after the approval card)"]
    Old["Ver el video con IA<br/>(ideas saved before the feature)"]
  end

  Form --> Create
  Share --> Form
  Agent --> Create
  Create["op idea.create<br/>optimistic in the browser"] --> Row[("trip_ideas")]
  Row -- "Broadcast trip:&lt;code&gt;" --> Members["Every member's board"]

  Create --> Meta["Browser: /oembed<br/>caption · author · cover · TikTok transcript<br/>(1–3 s)"]
  Meta --> Row

  Create -- "after() — server, after the response" --> Analyze
  Old --> Analyze

  subgraph Server["Video analysis (30–120 s)"]
    Analyze["analyzeIdeaVideo"] --> Quota{"Daily limit<br/>reached?"}
    Quota -- yes --> Skipped["video.status = skipped"]
    Quota -- no --> Source{"Source"}
    Source -- "YouTube" --> NoYT["video.status = skipped · skip = platform<br/>(length unknown before watching)"]
    Source -- TikTok --> DL["Download from the page<br/>(playAddr + cookies)<br/>duration checked first"]
    Source -- Instagram --> Apify["Apify actor → CDN MP4<br/>duration checked first"]
    DL & Apify -. "longer than 90 s" .-> TooLong["video.status = skipped · skip = tooLong<br/>no Reintentar"]
    Source -- "upload" --> Bucket["Private bucket idea-videos<br/>length checked in the browser<br/>(deleted afterwards)"]
    DL & Apify & Bucket --> Files["Gemini Files API<br/>(deleted afterwards)"]
    Files --> Gemini["Gemini watches image + audio<br/>main model → retry → fallback<br/>270 s budget"]
    Gemini --> Parse["Validate: summary · on-screen text<br/>relevant · spots (name, city, type, second, price, tip)<br/>insights (todo · tip · avoid · fact, when, hours, second)"]
    Parse --> Write["apply_idea_video (one transaction)<br/>merged onto the latest idea"]
    Write --> Parent["Parent: video = done + summary + spots + insights"]
    Parent -. "Guardar como idea (a member, per spot)" .-> Children["Spot idea     Write --> Children["≥ 2 spots → one child idea per spot<br/>(parentId, own suggestion)"]lt;video    Write --> Children["≥ 2 spots → one child idea per spot<br/>(parentId, own suggestion)"]gt;-s-    Write --> Children["≥ 2 spots → one child idea per spot<br/>(parentId, own suggestion)"]lt;name    Write --> Children["≥ 2 spots → one child idea per spot<br/>(parentId, own suggestion)"]gt;<br/>(parentId, own suggestion)"]
    Gemini -. busy / error .-> Failed["video.status = failed<br/>retryAt → any member's app retries (max 3)"]
    Source -. "no video" .-> NeedsFile["video.status = needsFile<br/>→ Subir video"]
    Analyze --> Usage[("video_usage<br/>tokens · cost · time")]
  end

  Parent & Children --> Row
```

## 2. States of a video analysis

```mermaid
stateDiagram-v2
  [*] --> Analyzing: idea created (no video field yet)
  Analyzing --> Done: Gemini answered
  Analyzing --> Failed: Gemini busy or error
  Analyzing --> NeedsFile: video could not be downloaded
  Analyzing --> Skipped: daily limit · over 90 s · YouTube · too heavy
  Failed --> Pending: retryAt reached (auto) or Reintentar
  NeedsFile --> Pending: Subir video
  Skipped --> Pending: Reintentar (not when skip is set)
  Pending --> Done
  Pending --> Failed
  Pending --> NeedsFile
  Done --> [*]

  note right of Analyzing
    First run writes nothing until it ends,
    so it never races the caption fetch
  end note
  note right of Pending
    Written before a retry: if two members
    retry at once, only one analysis runs
  end note
```

## 3. How an idea gets its place and type

```mermaid
flowchart LR
  Text["Note · caption · hashtags<br/>TikTok transcript<br/>video summary + on-screen text<br/>spot (venue name, city)"] --> Rules["Keyword rules<br/>classifyIdeaFields"]
  Rules --> Sug["Suggestion<br/>¿📍 place · type? Sí / ✕"]
  Claude["Analizar con Claude<br/>whole trip + all ideas<br/>(spot ideas instead of a split video)"] --> SugC["Suggestion ✨<br/>+ moment in the plan + reason"]
  Sug --> Confirm
  SugC --> Confirm
  Hand["Chosen by hand<br/>(selects in the viewer)"] --> Confirmed
  Confirm["Sí · Aceptar sugerencias"] --> Confirmed["Confirmed place and type<br/>(rules and Claude leave it alone)"]

  subgraph Places["Trip places (from the itinerary)"]
    Zones["Zones: Orlando · Miami · Crucero…"]
    Venues["Venues: Disney Springs Mall · Windjammer…"]
  end
  Places -.-> Rules
  Places -.-> Claude
```

Spot ideas pick their place in this order: the member's note, a venue of the plan named by the spot, the spot's city when it is a trip place, then the other text.

## 4. The board

```mermaid
flowchart TD
  Board["Ideas tab"] --> Top["Agregar idea · Analizar con Claude · Aceptar sugerencias (N)"]
  Board --> Toggle{"View"}
  Toggle -- "📍 Por lugar" --> ByPlace["Rows by zone<br/>Orlando · Miami · Crucero · … · Sin lugar<br/>most voted first, then newest<br/>chips: zone · type · Sin clasificar"]
  Toggle -- "📅 Por día" --> ByDay["Itinerary days<br/>each idea under its activity, free slot or day<br/>+ Antes del viaje"]
  ByPlace --> Card
  ByDay --> Card
  Board --> Hidden["A video split by the old automatic split (-s0, -s1…)<br/>shows as its spot ideas"]
  Board --> Discarded["Descartadas (collapsed)"]

  Card["Card (9:16)<br/>cover · TT/IG/YT · title = note › caption › spot name<br/>type · venue · votes · spinner while analyzing"] -- tap --> Viewer

  subgraph Viewer["Viewer (bottom sheet on phone, dialog on desktop)"]
    direction TB
    V1["1 · Video playing in the app"]
    V2["2 · Title · author · shared by"]
    V3["3 · Video panel<br/>spot: name · city · ▶ second · tip<br/>Lo que muestra el video: summary + every spot<br/>or: reason + Reintentar / Subir video / Ver el video con IA"]
    V4["4 · Pending suggestion: Sí / ✕"]
    V5["5 · Momento en el plan (editable)"]
    V6["6 · Place and type selects"]
    V7["7 · Note · transcript · Me gusta · Abrir en … · Descartar"]
    V1 --> V2 --> V3 --> V4 --> V5 --> V6 --> V7
  end
```

Ideas never change the calendar: moving one into the itinerary is always a member's action, by hand or through the assistant.
