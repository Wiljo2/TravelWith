# Reel insights eval

Gold set for the video analysis prompt (`src/server/video/analysis.ts`). Each case is one short reel (≤ 90 s) with what a person expects the analysis to find.

- `url`: TikTok or Instagram link.
- `places`: the trip places passed to the prompt.
- `caption`: optional caption/transcript text passed as context.
- `expected.insights`: `{ kind: "todo" | "tip" | "avoid" | "fact", text, phase? }` — one per useful, specific piece of advice.
- `expected.spots`: names of the places the reel recommends.

Run (needs `GEMINI_API_KEY`, and `INSTAGRAM_PROVIDER_TOKEN` for Instagram):

```
RUN_VIDEO_EVAL=1 npx vitest run src/server/video/insights.eval.test.ts
```

It prints found / missed / invented per case and writes the raw answers to `out/` (ignored by git). Target: ≥ 80 % of expected insights found, ≤ 1 invented per reel.
