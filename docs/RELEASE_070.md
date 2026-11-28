# SimOurHome 0.70.0 — approved release, 28 November 2026

Owner explicitly approved production after successful final checks. Functional commit fc5718509b42b6fb141d16fb0b57d4248357bc2c, tag v0.70.0. Main fast-forwarded from 8508447 and main/tag pushed atomically. Package and lock 0.70.0.

## Implemented
- Azure Shore (Лазурный берег): premium separate 3D resort, two-person consent and car travel, one shared rental charge, 1/2 days (18900/34900 RUB), optional both pets without surcharge. Individual checkout; pets return with last guest. Cottage bedroom, media, kitchen, shower, toilet, sink, terrace, grill, reception, bar, pool, jacuzzi and irregular swimmable azure lake. Three animated water surfaces, wake rings/jets, warm night lights, outdoor weather, decorated shore and camera/frustum fixes.
- Included scheduled breakfast/lunch/dinner served by staff after six game minutes, per-guest portions. Six purchasable grill kits yield two servings each, separate stock and exclusive grill. Twelve drinks, free water, three alcoholic drinks per guest/day, no intoxication simulation. Local resort wishes, bathroom actions, sleep, temporary existing short barefoot SPA outfit for wet tasks. No dedicated new swimsuit assets.
- Included film/series selection and all six Nintendo Switch 2 titles, simulated screen scenes, shared exclusive TV, consent and synchronized games; independent of home subscriptions and purchases. Not actual streaming or commercial games.
- Pet beds, bowls, litter box, timed basic care and limited roaming; no home food consumption during stay. Separate Пушистый люкс grooming salon, six dog and three cat services, staged tools/coat/paw contact and payment on completion, persistent grooming effect; cat never bathed. Grooming changes status and needs, not permanent model geometry. No full resort-specific pet AI or pet swimming.
- Detailed eight-checkpoint implementation history and visual review in PREVIEW_070_AZURE_RESORT.md.

## QA
Exact functional SHA fc57185, GitHub Actions run 46148977009: all eight jobs successful (98 focused tests, complete two-client resort, dog and cat grooming, water/bathroom/outfit for Vlad at 390x844 and Alina at 320x568, night and pet contact scenarios). Prior iterative cloud runs caught and fixed camera fog/frustum, landscaping and lantern intersections, service/meal duplication, grooming pose/tool contact and timing, fixture geometry, pet care and outfit restoration. Fresh screenshots of water, toilet/shower and pet bowl/bed reviewed. Real physical phone FPS not measured; existing large-chunk warning remains. No heavy local browser suite.

## Deployment
D:/Sim-Life, port 3111, PID 7188 at switch; protected access, testNoCodes false. Exact 68 staged and live dist files SHA256 verified; index.html, index-B3Sjk3RU.js, main-epkaWO1r.js, World-DMewrA_7.js and main-BHvfAR4L.css HTTP 200. All 14 private MP3/MP4 files match previous local media and live Range 206. Only active production household.json reset: 10000 RUB/day 1/minute 480/both home/two starter furnishings. Access and trusted-device hashes unchanged. Old dist and household/backup copies at D:/Sim-Life-Backups/v070-predeploy-fc57185. Preview 3163 remains healthy with its independent save. Cloud two-client synchronization passed; no production authenticated gameplay test to preserve fresh save. Do not reset on ordinary restarts/docs updates.

## Next
No 0.71 task approved. Audit current code, UI, server and tests before suggesting additions. No painting, laundry, favorite outfits or unapproved decor. Deep careers (Vlad software/game studio, Alina hair reconstruction studio), RU VPS and Android APK deferred. Near final release optimize loading/memory, and measure physical-phone FPS.
