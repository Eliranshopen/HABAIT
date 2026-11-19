# Editor speed bench — the typed change

Written 2026-11-16 14:41 UTC by `tools/edit_bench.py` from `results.json`. Seconds are wall time from the request to the picture in hand (fal.run, `sync_mode`). "held" = the page's border-ring test under 0.15 (the frame did not move). The pictures are beside this file: `<case>/<model>-run<n>.jpg`. Speed is measured here; quality is the eye's call.

## people (living) — today: `nb2-1k`, median 12.6 s

| model | runs | median s | min–max s | vs today | held | changed share | booked $/call |
|---|---|---|---|---|---|---|---|
| `klein-9b` | 2 | 3.8 | 3.8–3.8 | 3.3x | 2/2 | 0.12 | 0.035 |
| `klein-4b` | 2 | 8.3 | 4.0–12.6 | 1.5x | 2/2 | 0.13 | 0.030 |
| `flux2-turbo` | 2 | 9.6 | 8.7–10.5 | 1.3x | 1/2 | 0.18 | 0.025 |
| `kontext` | 2 | 10.0 | 8.3–11.7 | 1.3x | 2/2 | 0.09 | 0.040 |
| `grok` | 2 | 10.2 | 10.2–10.3 | 1.2x | 2/2 | 0.11 | 0.030 |
| `nb2-0.5k` | 2 | 10.4 | 9.5–11.2 | 1.2x | 2/2 | 0.18 | 0.080 |
| `nb2-1k` (today) | 2 | 12.6 | 12.6–12.6 | 1.0x | 2/2 | 0.07 | 0.080 |
| `flux2-pro` | 2 | 16.5 | 15.2–17.7 | 0.8x | 0/2 | 0.43 | 0.090 |
| `flux2-flash` | 2 | 20.3 | 20.1–20.6 | 0.6x | 0/2 | 0.19 | 0.015 |
| `seedream5-lite` | 2 | 43.6 | 40.7–46.5 | 0.3x | 2/2 | 0.19 | 0.035 |

## object (object) — today: `kontext`, median 9.0 s

| model | runs | median s | min–max s | vs today | held | changed share | booked $/call |
|---|---|---|---|---|---|---|---|
| `klein-9b` | 2 | 4.1 | 3.6–4.6 | 2.2x | 0/2 | 0.24 | 0.035 |
| `klein-4b` | 2 | 4.5 | 3.4–5.7 | 2.0x | 0/2 | 0.25 | 0.030 |
| `kontext` (today) | 2 | 9.0 | 7.0–11.0 | 1.0x | 1/2 | 0.23 | 0.040 |
| `nb2-0.5k` | 2 | 9.0 | 8.9–9.1 | 1.0x | 2/2 | 0.21 | 0.080 |
| `flux2-flash` | 2 | 11.0 | 9.2–12.8 | 0.8x | 1/2 | 0.23 | 0.015 |
| `flux2-turbo` | 2 | 12.2 | 8.4–15.9 | 0.7x | 2/2 | 0.24 | 0.025 |
| `grok` | 2 | 12.2 | 11.4–13.1 | 0.7x | 2/2 | 0.21 | 0.030 |
| `nb2-1k` | 2 | 12.7 | 12.1–13.3 | 0.7x | 2/2 | 0.21 | 0.080 |
| `flux2-pro` | 2 | 15.8 | 15.7–15.9 | 0.6x | 0/2 | 0.60 | 0.090 |
| `seedream5-lite` | 2 | 41.4 | 39.9–42.9 | 0.2x | 2/2 | 0.24 | 0.035 |

## follow (follow) — today: `nb2-1k`, median 15.6 s

| model | runs | median s | min–max s | vs today | held | changed share | booked $/call |
|---|---|---|---|---|---|---|---|
| `klein-4b` | 2 | 4.1 | 4.1–4.1 | 3.8x | 0/2 | 0.73 | 0.030 |
| `klein-9b` | 2 | 4.4 | 4.2–4.7 | 3.5x | 0/2 | 0.74 | 0.035 |
| `nb2-0.5k` | 2 | 9.9 | 9.6–10.3 | 1.6x | 1/2 | 0.35 | 0.080 |
| `grok` | 2 | 11.9 | 11.6–12.2 | 1.3x | 0/2 | 0.54 | 0.030 |
| `flux2-turbo` | 2 | 12.9 | 12.1–13.7 | 1.2x | 0/2 | 0.76 | 0.025 |
| `nb2-1k` (today) | 2 | 15.6 | 13.8–17.4 | 1.0x | 1/2 | 0.26 | 0.080 |

