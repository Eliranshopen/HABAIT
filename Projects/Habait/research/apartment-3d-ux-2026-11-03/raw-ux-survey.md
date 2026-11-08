# Raw UX survey: how the best products present an apartment in 3D (2026-11-03)

Desk research, web only, no login. Every claim is tagged **observed** (seen in a fetched page or search-result text) or **inferred** (my reasoning). "Unverified" = no current source found. Several vendor pages (Zillow, Inman, RoomSketcher help) returned 403 on fetch, so those rows rest on search-result summaries and are flagged.

## 0. Honest coverage note
- Strong evidence: Archilogic viewer controls, Matterport dollhouse blog, Sims wall modes, CloudPano, Kuula, Cupix, Render Vision and ArchiCGI sales tools.
- Weak or secondhand: Zillow 3D Home (search summary only), Matterport transitions and tags (forum posts), Realsee/Beike (no reachable page describes the dollhouse view, fly-in or AI redecoration UI).
- **residence.tech: not found.** Two searches (English, Hebrew) returned nothing about it. Whatever the owner knows about it is **unverified** here; a human should open it on a phone and record load time, first frame and controls.
- No independent study of cutaway/dollhouse conversion on mobile turned up; engagement numbers are vendor claims.

## 1. Pattern catalog
Confidence: H = a fetched source states it; M = search summary or secondhand; L = inferred or single weak source.

| # | Pattern | Who does it | Buyer value | Evidence | Conf |
|---|---|---|---|---|---|
| P1 | Three views of one space (2D plan, dollhouse, inside/360) with a persistent switcher | Matterport (key 2 dollhouse, key 3 floor plan); Zillow (carousel / 3D / floor plan); Archilogic (3D/2D button lower-left); Kuula ("Plan" button at any point); CloudPano | Buyer chooses the representation that answers the current question | [s1] [s3] [s6] [s14] [s9] | H (Matterport, Archilogic, Kuula); M (Zillow) |
| P2 | Tap a room on plan/dollhouse, jump to its 360 | Zillow ("tapping a room jumps to it"); CloudPano (hotspots connect dollhouse to 360 photos); Kuula (plan hotspots go to rooms); Cupix (pano position and view angle on plan) | Closes "what is this room" to "what does it feel like" in one tap | [s3] [s9] [s14] [s15] | M-H |
| P3 | Animated camera move between dollhouse and a scan point, and back | Matterport: in dollhouse, key 1 "flies you in to the last position" (forum); one VR post says default VR uses fades; one beta user says fly-in "hops" now | Spatial continuity, keeps the mental map | [s2] | M-L (anecdotal, maybe outdated) |
| P4 | Room labels (name, area) shown in the dollhouse itself | Matterport added room/area labels to Dollhouse view; Zillow estimates room sq ft; Archilogic inspector shows area per room | Orientation without opening anything; area answers the first buyer question | [s4] [s3] [s6] | H (Matterport, Archilogic) |
| P5 | Selection moves the camera to the room and highlights it | Archilogic: selecting a room "zooms to the selected room and highlights it in blue" | Selection feedback is spatial | [s6] | H |
| P6 | Tap a floor from the side to select it | Matterport (selector also kept) | Multi-storey navigation without a menu (relevant to duplexes/penthouses only) | [s4] | H |
| P7 | Default touch model: one finger rotate, two-finger pan, pinch zoom | Archilogic (stated); Matterport "improved touch controls in Dollhouse view" (unspecified) | Nothing to learn | [s6] [s4] | H |
| P8 | Three-state wall toggle: walls down / cutaway / walls up | The Sims 3/4 (cutaway keeps exterior walls, drops others); players ask for another walls-up variant; bug reports of interior walls vanishing | Player controls occlusion; sensible default | [s11] | M (fan guides, not EA docs) |
| P9 | Hide only walls facing the camera | Matterport dollhouse reportedly hides outside walls when viewed from that side (one forum reply, no mechanism) | A wall never blocks the view in | [s5] | L |
| P10 | Opacity slider on the dollhouse so plan markup shows through; mesh vs textured modes | Cupix | Dimensions and model read together | [s15] | M |
| P11 | Measurement mode, view-specific lines, metric/imperial | Matterport (lines in floor-plan view invisible in other views); implemented as raycast between mesh points (dev forum) | "Will my sofa fit"; trust | [s1] [s7] | H-M |
| P12 | Pinned info tags (text, link, media) | Matterport Mattertags (third-party description) | Facts at the object | [s2] | M-L |
| P13 | Building to floor to unit; click the facade to open a unit; availability colour-coded (available / reserved / sold) | Render Vision; ArchiCGI unit selector | Matches how towers are shopped; inventory at a glance | [s8] [s10] | H |
| P14 | Unit info card: floor, area, rooms, orientation, status | Render Vision | Facts beside the visual | [s8] | H |
| P15 | Side-by-side compare, favourites, share link, branded PDF | Render Vision | Couples decide together; share link suits WhatsApp | [s8] | H |
| P16 | Finishes and furniture configurator | ArchiCGI (built-in configurator, optional furniture configurator); Urban Splash "House" app (layouts and finishes) | Ownership feeling | [s10] [s12] | H (ArchiCGI); M (Urban Splash) |
| P17 | Time of day and weather in one click | ArchiCGI (Unreal pixel streaming) | Light is what a plan cannot convey | [s10] | H |
| P18 | Pixel streaming: server renders Unreal, phone shows video | ArchiCGI, Away Digital, Urban Splash | Photoreal on any phone with no download; cost is a GPU per session (inferred) | [s12] | H |
| P19 | Pre-rendered exterior spinner (140 stills) instead of live 3D | Render Vision | Photoreal, light, works everywhere | [s8] | H |
| P20 | Dollhouse = simple geometry textured by projecting panoramas | Matterport (developer description: no UV map, spherical projection shader) | Real look from capture; side effect is noise | [s7] | M (secondhand) |
| P21 | Browser share link, no app | Zillow unbranded link; Render Vision (no plugin) | WhatsApp-link behaviour | [s3] [s8] | M-H |
| P22 | Narrated and live-guided tours; AI design | Beike/Realsee: VR看房 (free browse), VR讲房 (narrated), VR带看 (live co-view) launched 2018; "AI讲房" in 2022 coverage | Replaces the sales agent remotely; for Habait, a Hebrew voiced tour is the analogue (inferred) | [s13] | M (UI not seen) |
| P23 | Inspector panel with details and room breakdown | Archilogic | Desktop pattern; becomes a bottom sheet on phones (inferred) | [s6] | H / L for the phone part |
| P24 | One level at a time; Flyover vs first-person Camera, synced | RoomSketcher Live 3D | Less clutter; overview plus eye-level | [s16] | M (search summary) |

## 2. Product profiles

### Matterport
- Does well: the reference three-view model (dollhouse, floor plan, inside), measurement mode, labels, tags. Observed ([s1], [s17]). Dollhouse got room labels and tap-a-floor-from-the-side ([s4]).
- Weak: the dollhouse is a rough scan mesh with panorama projection; Hacker News and forum threads complain of noise and stray ceiling fragments, and advice is to trim tightly ([s5], [s7]). Measurement lines are view-specific ([s1]). Official pages gave no transition detail.
- Lesson for Habait: Matterport looks real because it is photo-based; Habait's flat colour has the opposite fault, clean but toy-like.

### Realsee / Beike VR看房
- Observed: Beike launched free-browse VR, narrated VR and live co-viewing in 2018; touching anywhere in free mode returns dimensions, orientation and distance; 4M VR listings in a 2020 filing; a later community MR project joins drone fly-over with ground walk-through ([s13]). Realsee advertises AI 3D-from-images, AI narration and AI design tools ([s13]).
- **Unverified:** dollhouse "model view", fly-in transition, AI redecoration UI. Needs a manual look in the app.

### Zillow 3D Home
- Observed via search summary (Inman and zillow.com 403): photo carousel / 3D / floor-plan switch, tap a room to jump, estimated room sq ft, 360-capture-to-tour in ~45 min, unbranded share link, Zillow's own claim of more views and saves ([s3]). No dollhouse found.

### Cupix
- 3D dollhouse with grey mesh and textured modes; opacity adjustment so plan markup shows through; floor plan shows each pano position and view angle; users reported grey/black rendering bugs ([s15]).

### 3DVista
- **Unverified.** Nothing current found; a forum thread pairs a Sketchfab dollhouse with a 3DVista tour as a workaround.

### Kuula and CloudPano
- Kuula: Plan button opens the floor plan anywhere in a tour, hotspots to rooms; no dollhouse found ([s14]).
- CloudPano: 3D dollhouse plus 2D plans (black/white or colour), hotspots link to 360 photos, paid plan ([s9]).

### RoomSketcher / Floorplanner
- RoomSketcher Live 3D: Flyover and Camera modes synced, one level at a time, share link, browser and phone with fewer features per a review ([s16]). Authoring-side product. Floorplanner: **unverified**, not fetched.

### Archilogic
- 3D/2D switch lower-left; one finger rotate, two-finger pan, pinch zoom; room selection zooms the camera and highlights blue; inspector with area ([s6]). Embeddable SDKs ([s6b]).

### New-development sales tools
- Render Vision: building, floor, unit; facade click; colour-coded availability; 140-render exterior; compare; favourites; PDF ([s8]). Closest in shape to Habait's clickable building.
- ArchiCGI (Unreal pixel streaming): unit selector, time of day, weather, finishes configurator, CRM reservation ([s10], [s12]).
- Urban Splash House configurator and a Zaha Hadid Architects configurator for Beyabu are named in coverage ([s12]). **Unverified:** other leading names (Vyzn, Giraffe360, Fuzor searches returned nothing).

### residence.tech
- **Not found.** The claim that it uses Google model-viewer is **unverified** here.

### The Sims (precedent)
- Walls down / cutaway / walls up cycle; cutaway keeps exterior walls; complaints when cutaway hides interior walls or wall decor ([s11]). Lesson: a deterministic default plus an explicit toggle.

## 3. What makes a dollhouse feel premium (ranked)
Mostly **inferred** from the patterns above and design judgement; no controlled study backs the ranking.
1. **Photoreal-feeling surfaces, not flat colour.** Matterport reads real because it is photo-projected ([s7]); Render Vision and ArchiCGI sell renders ([s8], [s10]). Inferred option: bake lighting and AO in Blender into small textures, keeping the GLB light.
2. **Soft contact shadows and AO** at wall/floor/furniture joints. Inferred; the main gap between "CAD" and "model".
3. **Poster image first, model fades in over it.** Inferred (model-viewer docs fetch failed, so its poster/reveal support is unverified).
4. **A designed entry move**: a slow arrival to a 3/4 view, then settle. Inferred; Matterport's fly-in is the nearest observed cue ([s2]).
5. **Intelligent wall handling**: low cut with a lit top edge, or camera-facing walls fade (P8, P9).
6. **Restrained camera**: orbit limits, no under-floor views, inertia, tap-to-focus a room (Archilogic zoom-to-room, [s6]); rest inferred.
7. **Warm branded backdrop** with ground shadow instead of empty dark navy. Inferred.
8. **Quiet, upright labels** with room name plus area ([s4]), Hebrew, correct bidi numerals.
9. **Neutral-warm colour grade**, no saturated primaries. Inferred.
10. **Seamless hand-off to the 360 tour**, same path out and back (P2, P3).
11. **Fast first paint**; the 174 KB GLB is already a strength. Inferred.
12. **Visible but small disclosure badge** (Habait rule, not from sources).

## 4. Top 10 patterns to copy for a phone-first Hebrew buyer page
1. Tap a room, fly into the 360 pano at that spot, return the same way (P2, P3): the strongest hand-off and Habait already owns the 360.
2. Poster-first load with a Blender-rendered still, then the model fades in: addresses "not realistic enough" in the first second (inferred).
3. Baked lighting/AO and ground shadow in the GLB: biggest premium jump at no runtime cost (inferred).
4. Room labels with name and area inside the model, Hebrew (P4; Matterport did exactly this [s4]).
5. Selection = camera move plus highlight (P5 [s6]).
6. Camera-facing wall fade or a Sims-style three-state toggle, default cut (P8, P9).
7. Standard gestures, a visible reset, and a 2D/3D switch (P1, P7).
8. One bottom sheet per room (area, orientation, "view in 360") instead of a side inspector (P23; inferred for phones).
9. WhatsApp-friendly share link and favourites (P15 [s8]).
10. Keep the floor-finish switch; consider 2-3 baked time-of-day looks (P16, P17 [s10]; baking is inferred).

Skip: desktop side inspector; full measurement mode (view-specific lines, clutter on a phone, inferred); first-person walk in the dollhouse (the 360 does that).

## 5. What top products avoid
- Raw scan mesh noise: Matterport users trim hard to hide it ([s5]).
- Dense modal chrome over the model: Archilogic keeps a few corner controls and default gestures ([s6]). Inferred generalisation.
- Cutaway that deletes all interior walls (Sims bug reports [s11]).
- Unsupported effect claims: "66% more interested" and "60% engagement" are vendor figures; the one eye-tracking thesis (n=180, student work) found 3D floor plans had the strongest influence on purchase intention but tested static images, not interactive viewers ([s18]).

## 6. Open items for a human
- Open residence.tech on a phone and record load, first frame, controls, labels.
- Try a public Matterport model on a phone (dollhouse to inside transition, wall fade).
- Open the Beike/Realsee app for the model view and fly-in.
- Read modelviewer.dev docs directly for poster/reveal/auto-rotate-delay/interaction-prompt.

## 7. Sources
- [s1] https://www.wegetaroundnetwork.com/topic/13440/video-how-to-customize-matterport-models-labels-and-measurements
- [s2] https://www.wegetaroundnetwork.com/topic/6116/matterport-beta-showcase-30/ ; https://forum.we-get-around.com/topic/210/dollhouse-levels/
- [s3] https://www.inman.com/2021/02/17/heres-a-first-look-at-zillow-3d-home-tours-newest-features/ (403, via search summary) ; https://www.zillow.com/z/video-upload/faqs ; https://www.virtuance.com/blog/power-of-zillow-3d-home-tours-interactive-floor-plans/
- [s4] https://matterport.com/blog/dollhouse-view-just-got-upgrade
- [s5] https://forum.we-get-around.com/topic/12501/how-to-hide-a-floor-in-a-matterport-tour/ ; https://forum.we-get-around.com/topic/14902/problem-how-can-i-improve-this-matterport-dollhouse-view/
- [s6] https://help.archilogic.com/knowledge/view-your-floorplan-model-in-3d ; [s6b] https://archilogic.com/project/real-estate-listing-page
- [s7] https://discourse.threejs.org/t/matterport-features-for-threejs/36891
- [s8] https://render-vision.com/services/3d-apartment-viewer-services/
- [s9] https://www.cloudpano.com/property-managers/cloudpano-virtual-tours-and-dollhouse-floorplan-for-property-managers
- [s10] https://archicgi.com/immersive-3d-tours/
- [s11] https://primagames.com/eguides/the-sims-3-eguide/essentials/creating-a-house/build-mode ; https://forums.ea.com/discussions/the-sims-4-gameplay-en/request-to-add-another-walls-up-view/8654173 ; https://forums.ea.com/discussions/the-sims-4-gameplay-en/inner-walls-wont-cut-away-anymore/8694620
- [s12] https://archicgi.com/unreal-engine-for-real-estate/ ; https://ribaj.com/products/configurator-phone-app-personalised-home-layouts-urban-splash-town-house-uniform
- [s13] https://news.pedaily.cn/201805/431336.shtml ; https://www.36kr.com/p/3410835034902153 ; https://www.realsee.com/article/xsp662wv
- [s14] https://blog.kuula.co/floor-plan-button
- [s15] https://support.cupix.works/support/solutions/articles/70000664199-3d-dollhouse ; https://updates.cupix.works/3d-dollhouse-opacity-adjustment-4EOj5e
- [s16] https://help.roomsketcher.com/hc/en-us/articles/34882691862813 ; https://help.roomsketcher.com/hc/en-us/articles/213187689 (403, via search summary)
- [s17] https://matterport.com/matterport-academy/intro-to-showcase/intro-to-showcase
- [s18] https://essay.utwente.nl/essays/100545 ; https://help.diakrit.com/hc/en-us/articles/4409632256153-3D-Floorplan ; https://fotober.com/how-a-3-d-floor-plan-boosted-real-estate-engagement-by-60
