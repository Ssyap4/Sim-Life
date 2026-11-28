# SimOurHome 0.69.0 — approved release, 28 November 2026

Owner explicitly approved production upon successful final checks. Functional commit 0e1ffb797ade71bf05dad19f84c741b86e801fbe, tag v0.69.0; main fast-forwarded from 05f8206. Package and lock 0.69.0. Main and tag pushed successfully.

## Implemented
- Simba: four manual toys, directional/touch drag controls, validated targets and owner-held props/tether; both clients receive the authoritative state. Verdell: four park agility obstacles, trainer cues, optional partner support, course traversal and rewards.
- Painting and its dedicated activities/collections removed; creativity skill and miniature modeling retained. Do not reintroduce painting.
- Ten romantic gifts, delivery, consent, real handoff and family history; sofa with cushions/blanket, new table/floor lamps and light modes.
- DomStroy: separate 3D store, walking/car access, 94 products (30 walls, 26 floors, 6 ceiling lights, 12 lamps, 20 sanitary fixtures). Ten home zones, material and installation quotes, wet-room options, free samples and local-only home preview before purchase; authoritative shared installation, balance and occupancy safeguards. Ordinary lamps use furniture delivery. All twenty fixture replacements preserve existing approach/contact positions and actions including hair care and dog bath.
- Wall sconces, hydromassage, premium fixture buffs, additional doors/trim/mirrors/towel rails/curtains/blinds and delayed material delivery are not implemented. Installation currently immediate.

## QA
Exact functional SHA 0e1ffb7: sanitary 46101141042 (6 jobs), pet play 46101140990 (2), renovation 46101140994 (2), cozy gifts 46101140999 (2), all success. Prior 2dbd3ff sanitary/renovation/pets succeeded; gift visual phase failed on slow rendering, fixed active wall-clock synchronization with pause handling, regressed locally 14/14 and in final cloud. Prior wcBasin visual scaling failure fixed by allowing slower task clock only on isolated loopback test server. Real mobile WebGL at 390x844 and 320x568; reviewed recent screenshots of fixtures, cat drag, dog balance, furniture/light previews and gift handoff. Some camera angles retain foreground occlusion (gift wall post, tree near dog balance); camera can be rotated. Physical-phone FPS not measured, historical Vite large-chunk warning remains. No heavy local browser suite. Final cloud gift log records both residents' gift phases on both clients.

## Deployment
D:/Sim-Life, port 3111, PID 7084 at switch. HTTP health OK, protected access, testNoCodes false. Exact 68 staged dist files verified SHA256, new index-BWGA07f0.js, main-DOUhT4ws.js, World-BvZYrPfH.js and main-BHvfAR4L.css HTTP 200. All 14 private MP3/MP4 files match previous local media and live Range 206. Only production household.json reset: 10000 RUB/day 1/minute 480/two starter furnishings/no stored furnishings; access and trusted-device hashes unchanged. Old dist and household rollback copy in D:/Sim-Life-Backups/v069-predeploy-0e1ffb7. Existing preview port 3161 remains healthy; preview saves untouched. Cloud two-client synchronization passed; no production authenticated gameplay test performed to preserve fresh save. Do not reset on ordinary restarts/docs updates.

## Next
No 0.70 task approved. Audit actual code, UI, server handlers and tests before proposing. No painting, laundry, favorite outfits or unapproved decor. Deep careers (Vlad software/game studio, Alina hair reconstruction studio), RU VPS and Android APK deferred. Optimize large JS modules, startup, memory and actual phone FPS near final release; no immediate broad refactor.
