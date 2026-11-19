# Reference teardown — the film `/project-film` was learned from

Source: `screenshots/WhatsApp Video 2026-11-10 at 12.52.58.mp4` (handed over by Eliran, 2026-11-10).
A project film for «שמעון התרסי 1-7», north Tel Aviv, developer card «רם · מוגרבי · ארדיטי — בונים מאז 1919».
Method: `ffprobe`, one frame per second on contact sheets, dense frames around five transitions, scene-cut
detection at thresholds 0.25 and 0.10, a spectrogram of the audio. Everything below is read from those
files; what could not be measured is marked **inferred**.

⚠ Analysis only. Nothing of this film is reused (Eliran, 2026-11-09: inspiration, never a copy).

## 1. Evidence on disk (`frames/`)

| File | What |
|---|---|
| `sheet_01.jpg` … `sheet_05.jpg` | one frame per second, 16 per sheet, time-stamped. The stamp runs ≈ 0.5 s early (the frame labelled 9 s is the picture at ≈ 9.5 s) |
| `d_open.jpg` | 0–4 s at 4 frames/s: the transformation shot |
| `d_cut9.jpg` | 8.6–10.6 s at 8 frames/s: map → building, a hard cut |
| `d_whip43.jpg` | 41–45 s at 4 frames/s: the curtain/column wipe, living room → terrace |
| `d_whip54.jpg` | 52.5–55.7 s at 5 frames/s: the plant/pillar wipe, penthouse → balcony |
| `d_logo.jpg` | 67.9–69.9 s at 8 frames/s: the last shot → logo card, a hard cut |
| `spec.png` | spectrogram of the whole audio track |

## 2. Container

| Field | Value |
|---|---|
| Duration | 70.875 s (1701 frames) |
| Picture | H.264, 480 × 480, 24 fps, ≈ 925 kb/s — a WhatsApp transcode |
| Sound | AAC stereo 44.1 kHz, ≈ 63 kb/s; mean −16.2 dB, peak −0.5 dB; no silence anywhere |
| Master ratio | **inferred 16:9, centre-cropped to 1:1**: three captions run off both edges, and a clipped fragment of text sits at the left edge of the first two shots |

## 3. Shot list (cut times from scene detection, ± 1 frame)

| # | In | Len | Picture | Camera | Caption on screen |
|---|---|---|---|---|---|
| 1 | 0.00 | 4.25 | Real drone view over the neighbourhood, river and skyline behind. 0.5–1.25 s the two old blocks collapse into the trees; 1.25–2.5 s an empty green plot; 2.5–4.0 s the project grows out of the ground, storey by storey | slow forward drift | בין הים לירקון → בלב הצפון הישן של תל אביב |
| 2 | 4.25 | 5.04 | Tilted, slightly stylised 3D aerial map. Black pill with the address over a white outline of the plot; four white pills, each a place name + «N דקות הליכה» | slow push toward the plot | מתחילה חווית מגורים אחרת → טבע, תנועה ושקט → במרחק צעדים מהבית |
| 3 | 9.29 | 2.13 | Render from the air: the roof with a pool, park, river and sea behind | lateral drift | (במרחק צעדים מהבית continues) |
| 4 | 11.42 | 2.54 | Park path under palms, people on the grass, low sun, long shadows | low dolly back | פארק הירקון, מסלולי ריצה ורכיבה, |
| 5 | 13.96 | 3.37 | Street-corner façade render, cars and pedestrians moving | crane up, push | כל אלה הופכים לחלק משגרת החיים |
| 6 | 17.33 | 0.71 | Closer on the same corner | — | (none) |
| 7 | 18.04 | 3.29 | Port boardwalk: café tables, runners, marina, skyline | camera backs away from the runners | ומצד שני הים, → נמל תל אביב, בתי הקפה, התרבות, |
| 8 | 21.33 | 1.84 | Tree-lined boulevard at dusk, people walking toward camera, a dog | backs away | (continues) |
| 9 | 23.17 | 2.58 | Gallery interior, visitors walking | backs away | והקצב האורבני של העיר |
| 10 | 25.75 | 3.00 | Façade at dusk, windows lit, front-on | slow rise | שמעון התרסי 1-7 |
| 11 | 28.75 | 0.96 | Dusk, corner of the building, low angle | orbit | שני בניינים חדשים מעל חניון תת קרקעי |
| 12 | 29.71 | 4.29 | Daylight, long façade, street life | lateral track | (continues) → בתכנון של בר אוריין אדריכלים |
| 13 | 34.00 | 2.79 | Low angle up the balconies, greenery, sky | crane up and tilt | (none — the one silent shot) |
| 14 | 36.79 | 1.63 | Entrance and lobby, two women walking out | push in | לובי מעוצב, חומרי גמר עשירים, |
| 15 | 38.42 | 1.08 | Same, a jump closer | push in | (continues) |
| 16 | 39.50 | 6.63 | Garden-apartment living room → the camera slides right, a curtain then a column fills the frame (≈ 43.3 s) → it clears onto the terrace with a dining table | lateral slide through an occluder | ואדריכלות עכשווית, → a long line that runs off both edges («…כבדת את המרקם השקט והיוקרתי של הצפון…») |
| 17 | 46.13 | 1.75 | Living room, curved sofas, city skyline in the window | slow push | הדירות, |
| 18 | 47.88 | 1.75 | Penthouse living room, sea and river in the windows | slow push | והפנטהאוזים, |
| 19 | 49.63 | 1.66 | Aerial insert: rooftop pools | orbit | (none) |
| 20 | 51.29 | 8.67 | Penthouse living room again → slide left, a climbing plant then a white pillar fill the frame (≈ 54.6 s) → balcony under a pergola, the living room seen through the glass | lateral slide through an occluder, then drift | מרפסות שהופכות את השמיים לחלק מהסלון (runs off both edges) → יש דברים שאי אפשר לתאר, → רק לחיות, |
| 21 | 59.96 | 4.42 | Aerial over the finished project, pools on the roofs, river and sea | pull back and rise | בין הים לירקון, → שמעון התרסי 1-7 |
| 22 | 64.38 | 4.37 | The street-corner façade of shot 5 | slow push | פרויקט חדש מבית רם מוגרבי ארדיטי |
| 23 | 68.75 | 2.13 | Black; white logo mark + name + «בונים מאז 1919», centred | still | — |

22 picture shots + the card. Average 3.2 s. Longest 8.67 s (shot 20, carried by its wipe); shortest 0.71 s.

## 4. What the editing does

- **Cuts.** Every cut is a hard cut, including into the logo card. No dissolve, no flash, no zoom-whip.
- **The two wipes** (shots 16 and 20) are not editor transitions. A foreground object — curtain + column,
  plant + pillar — crosses the lens and hides the join between two spaces. Each takes ≈ 1.2 s and sits
  where the narration moves from "inside" to "outside".
- **The morph** (shot 1) is one continuous take in three phases: remove (0.75 s) → empty plot (1.25 s) →
  grow (1.5 s). The surroundings never change; only the plot does.
- **Motion.** Every shot moves, slowly and in one direction. In the lifestyle shots the camera retreats
  from people walking toward it. Renders are animated: cars drive, pedestrians walk, leaves move.
- **Intercutting.** The building appears inside the lifestyle section (shots 3, 5, 6) before its formal
  reveal at shot 10, and an aerial (19) interrupts the interiors. The viewer never spends more than ≈ 9 s
  away from the building.
- **Light.** Warm daylight throughout; one dusk pair (10, 11) exactly where the address first appears.
- **Repetition.** Shot 22 returns to shot 5's angle; the first caption returns at 60 s; the address is
  shown at 26 s and 62 s.

## 5. Captions

- White, regular-weight sans, soft dark shadow, no box; one centred line; baseline ≈ 92 % of the height.
- A phrase at a time, 24 phrases, ≈ 80 words in 68.75 s. Median phrase on screen ≈ 2.5 s.
- Phrases change on a cut or in the middle of a shot; they pop, they do not fade or animate.
- Trailing commas are kept, so one sentence runs across several shots.
- The text arc: place (2 phrases) → promise (3) → nature (2) → city (3) → address (1) → facts (2) →
  lobby and architecture (3) → apartments (3) → the emotional line (2) → place, address, developer (3).
- Defect: three long lines exceed the 1:1 frame.

## 6. Sound

- A continuous music bed with sustained tonal notes for the whole length; loud master (peak −0.5 dB).
- **Narration: inferred.** The captions read as spoken sentences and the spectrogram shows dense broadband
  detail on top of the music, but no speech-to-text tool was installed, so the words were not verified and
  no claim is made about the voice.
- No cut-synced whoosh or impact is visible in the spectrogram.

## 7. How it was most likely made — inferred from the frames, not known

| Shot type | Likely source |
|---|---|
| 1 transformation | a real drone frame; an edited copy with the project composited on the plot; an image-to-video model run between a first and a last frame, in two or three legs |
| 2 map | a 3D city/aerial map, tilted and graded, with pills and the outline added in the edit |
| 3, 5, 6, 10–13, 19, 21, 22 building | the architect's still renders animated by image-to-video (the moving cars and people drift slightly, as generated motion does) |
| 4, 7, 8, 9 lifestyle | generated images animated by image-to-video; none is recognisably filmed footage |
| 14–18, 20 interiors | interior renders animated; the two wipes are first-frame/last-frame generations with an occluder between two renders |
| 23 card | a still |

## 8. What Habait would do differently (root `CLAUDE.md` §6, D-VID-3)

- The film carries no «הדמיה» badge on any generated or render-based shot. A Habait film does.
- It names real places over generated footage. A Habait film does not, without Eliran's ruling.
- It erases existing buildings from real footage. For Habait that is Eliran's call each time.
- Three captions overflow the frame. A Habait film is checked at every delivered ratio.
