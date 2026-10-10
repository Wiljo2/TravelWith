# Video analysis spike (phase 0)

Run on 2026-10-09 from a local machine. Seven TikToks: five shared by the owner plus two from the trip `NVHPCI` (staging copy). Script: download the video → Gemini Files API → `generateContent` with a JSON schema (summary, on-screen text, spots) → delete the file.

## Results

| Video | Length | Size | Gemini | Spots |
|---|---|---|---|---|
| Visitor Toll Pass (ZSbSxjPNT) | 91 s | 5.8 MB | 59 s | 1 |
| 5 viral Miami restaurants (ZSbbsDUhE) | 78 s | 14.6 MB | 54 s | 5 |
| Disney Springs under $10 (ZSbSHy89A) | 35 s | 6.5 MB | 18 s | 8 |
| One day in Miami (ZSbSxNFg8) | 50 s | 5.3 MB | 34 s | 6 |
| Orlando outlets haul (ZSbSHoGBo) | 141 s | 16.5 MB | 26 s | 2 |
| Wonder of the Seas (ZSb9Kyxw8) | — | — | 503 in run 2 (12 spots in run 1) | — |
| Disney Springs sweets (ZSbCBWpqo) | — | — | 503 in both runs | — |

- **TikTok download: 14/14 OK** (`playAddr` + the page's cookies), 3–4 s each, 5–17 MB. Not yet tested from Vercel IPs.
- **Upload to Gemini:** 7–9 s. **Analysis:** 18–60 s. End to end 30–70 s → fits `maxDuration = 300`.
- **Tokens:** ~90 video tokens per second (3.2k for 35 s, 12.8k for 141 s), plus ~125 prompt tokens, ~300–750 output tokens, ~400–1,000 thinking tokens. Price: check the Gemini pricing page for the chosen model.
- **Quality:** spots, prices and on-screen text are accurate. It names venues the caption never mentions (all 8 Disney Springs stands, the 5 Miami restaurants with neighborhood and price per person). Cities come back as neighborhoods (Kendall, MiMo, Lake Buena Vista): the prompt must receive the trip's place list to normalize.

## Cost per video (measured tokens × listed prices)

Gemini 3.8 Flash at its introductory rate (third-party sources, until 2026-12-31): $0.75/M input (video included), $3.75/M output (thinking included). It doubles on 2027-01-01. Confirm on Google's pricing page.

| Video | Input tok | Output + thinking | Gemini cost |
|---|---|---|---|
| Toll Pass (91 s) | 8,405 | 646 | $0.0087 |
| Miami restaurants (78 s) | 7,308 | 1,156 | $0.0098 |
| Disney Springs (35 s) | 3,309 | 1,351 | $0.0075 |
| Miami in a day (50 s) | 4,754 | 1,219 | $0.0081 |
| Outlets haul (141 s) | 12,955 | 1,362 | $0.0148 |

Average **≈ $0.01 per video** (≈ $0.02 from 2027). Output is about half the cost because of thinking; a lower thinking budget would cut it.

Other variables per video:
- Vercel Fluid: ~70 s × 2 GB of provisioned memory ≈ $0.0004, plus a few seconds of Active CPU ≈ $0.0001. Waiting on I/O doesn't bill CPU.
- Gemini Files API: storage is free (48 h) and is deleted on completion. A 503 doesn't bill tokens, but it does add wait time.
- Instagram (Apify): ≈ $0.001–0.004 per reel.
- TikTok/YouTube download: $0.

Estimate: **~$0.011 per TikTok, ~$0.014 per reel**. 500 videos/month ≈ $6.

## Findings that change the plan

1. **Model:** `gemini-2.5-flash` is no longer available to new keys (404). Use `gemini-3.8-flash` (`VIDEO_MODEL`).
2. **Availability:** `gemini-3.8-flash` returned **503 "high demand"** on 5/7 videos in run 1 and on 2/7 after two retries in run 2, with `gemini-flash-latest` as fallback. The pipeline needs:
   - retries with backoff inside the request;
   - status `failed` with a retryable reason, plus a deferred automatic retry, not just the manual button;
   - one fallback model that is actually different (to be chosen).
3. **Long videos are not slower per se:** the 141 s haul took 26 s and the 91 s one took 59 s. Latency depends on Gemini load.
4. The 404 suggests Google's "Interactions API". `generateContent` still works; review before choosing the SDK.

## Instagram (Apify `apify~instagram-scraper`, 3 public reels)

| Reel | Length | Size | Apify | Gemini | Result |
|---|---|---|---|---|---|
| DeF4DdBtrGJ | 64 s | 23.1 MB | 6.9 s | 43 s (fallback `gemini-3.5-flash`, attempt 3) | 3 Miami activities |
| DeP4LuQvEcn | 17 s | 1.8 MB | 5.6 s | 429 free tier | — |
| DeOKP95R48u | 45 s | 2.4 MB | 7.1 s | **148 s** | Not about travel (cadastral data + Claude) |

- **Apify 3/3**: video URL in 5.6–7.1 s, and the MP4 downloaded from the IG CDN. ~$0.002 per reel.
- **Free tier limit:** `gemini-3.8-flash` allows **20 requests/day** on the free tier (429 for the rest of the day). Production requires billing.
- One analysis took 148 s. With retries plus a fallback, 300 s is tight. Implemented: a 270 s budget per request (`maxDuration` 300 works on any plan); if it runs out, the idea is marked `failed` with `retryAt` and the app retries it later.
- Not every saved video is about travel: Gemini must return `relevant: boolean`. When it's false, no child ideas are created and the idea is marked as such.

## Pending

- Downloading TikTok from a Vercel preview (datacenter IP).
- Confirm prices on Google's official page once billing is on.
