---
name: rule-tour-eye-level-wide-first-look
description: "Eliran 2026-11-17: every viewpoint of a tour is seen at eye level and opens zoomed OUT; his 'fish eye' means a look tilted down, not a wide angle"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d7be4180-9a6b-4af4-ae2c-b5816c2cda5a
  modified: 2026-11-17T10:15:09.207Z
---

Eliran, 2026-11-17, on the Kedma D/1 tour (two messages with screenshots, then: «זו הגדרה שצריכה להיות בכל ההדמיה בכל הדירה — מבט בגובה העיניים ושלא ירגיש FISH EYE»):

- A look tilted **down** from standing height at a wide angle "looks like a security camera" to him, and that is what he calls **fish eye**. It appears in any picture, old or geometry-true, as soon as the view is dragged down.
- Every room must open **zoomed out** («אני רוצה שזה יתחיל מיותר ZOOMOUT»): the view he showed as right is about 118° across on a wide desktop window — the template's own wide first look.
- Turning the look must not "smear" furniture at the screen's edge («כשאני זז ימינה שמאלה יש מריחה … הריהוט לא יתעוות במציאות»): that is the ordinary projection at a wide view. Kedma draws the wide architectural projection instead (`view.pannini` 1, `tour.js` `PAN_D`, two hooks in the viewer library): nothing stretches at the edges, verticals stay vertical at any tilt.
- So the rule for every viewpoint of every apartment tour: the look stays near eye level (Kedma: `apartment.json` `view.tiltDeg` 10, `viewer/tour.js` `tiltBounds`), the first look is wide and level, and the first look is also the widest zoom.

**Why:** I had read "fish eye" as "the angle is too wide" and narrowed the first look twice (85 → 62 → 50° tall). That was the wrong cure: it made every room open zoomed in and did nothing for the tilted look. (My interpretation, from reproducing his screenshot at his window size: the cause is the tilt, not the angle.)

**How to apply:** when he reports a visual feel ("fish eye", "security camera", "crooked"), reproduce his exact screenshot at his window size in a real browser before choosing a cure. Never narrow the first look to fix distortion. Check a new tour by trying to tilt far down and up in the browser: it must stop near eye level on desktop and phone. See [[rule-tour-movement-like-walking]], [[feedback-right-from-the-start-no-piecemeal-fixes]], [[project-kedma-d1-simulation]].
