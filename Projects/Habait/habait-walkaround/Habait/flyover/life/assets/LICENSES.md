# רישיונות נכסים: שכבות החיים (כרטיס 16, C2)

כלל: CC0 בלבד, בלי Mixamo. **אין בשכבות החיים אף נכס שהורד מבחוץ.** WebFetch לא היה זמין לסוכן, לכן כל הנכסים נוצרים פרוצדורלית בזמן ריצה בתוך `life.py` (numpy + bmesh). הם עבודה מקורית של Habait, מוקדשת CC0 1.0. העותקים ב-`_local/sprites/` הם רק לבדיקה בעין.

| נכס | מקור | רישיון |
|---|---|---|
| `LIFE_people_atlas` (מחזור הליכה של 8 פריימים × 6 וריאנטים של ביגוד, 48×96 לפריים) | מצויר ב-numpy ב-`life.py` (`person_atlas`): קפסולות ועיגולים | CC0 1.0, עבודה מקורית |
| `LIFE_bird_atlas` (שחף: מבט עליון + מבט צד, 4 פריימים של משק כנפיים, 64×64) | מצויר ב-numpy ב-`life.py` (`bird_atlas`) | CC0 1.0, עבודה מקורית |
| מכוניות `LIFE_car_sedan` / `_suv` / `_small` (קופסאות low-poly, פנסים, צבעים מ-`cars_palette`) | bmesh ב-`life.py` (`layer_cars`) | CC0 1.0, עבודה מקורית |
| עצים `LIFE_tree_*` (גזע + 3 איקוספרות, רוח = Displace עם טקסטורת Clouds של Blender) | bmesh + טקסטורה מובנית של Blender | CC0 1.0, עבודה מקורית; הטקסטורה הפרוצדורלית מובנית ב-Blender ואינה נכס |
| צל מגע `LIFE_contact_shadow` (gradient כדורי) | shader nodes ב-`life.py` | CC0 1.0, עבודה מקורית |
| גלי ים `LIFE_sea_waves` (Noise 4D + bump; רק כשיש מישור ים, או `--sea-mode osm-coast`) | shader nodes ב-`life.py` | CC0 1.0, עבודה מקורית |
| כבישים וקו חוף (`life.json` → `roads.lines`, `coast.line_world`) | OpenStreetMap דרך `site.json` של הסטודיו (`--make-roads`, קריאה בלבד) | ODbL 1.0 © OpenStreetMap contributors (נתונים, לא נכס גרפי; ייחוס נדרש בכל פרסום) |

אם בעתיד ייכנס נכס חיצוני (Kenney, Poly Haven HDRI): שורה כאן לפני השימוש, עם כתובת, תאריך הורדה ו-sha256.
