# 0.49 — World polish, first pass
Owner approved direction 5 (quality pass), then own yard expansion (2), then family weekends (1). No production approval. Base main 7e0e2a1, branch feat/world-polish-049.
- Ignore suspended/hidden frame durations for visual simulation and adaptive quality; keep existing 200ms cap on ordinary slow frames. Do not change server clock or tasks.
- Add adaptive-quality hysteresis, retain safe/full override and existing pixel ratios.
- Reset tap arbitration on blur/visibility change; cancel individual pointers as before.
- Private soundtrack installed locally; never commit recordings.
- 21 focused tests passed (gesture, Android graphics, performance and new polish tests), typecheck passed; 3 version/copy tests passed after bump. No full regression or physical phone FPS/visual QA in this pass yet.
- Next: inspect actual mobile renders, actor transitions/prop contact, pet locomotion and furniture. No new mechanics or production deployment without approval.

## v2 — movement and prop lifecycle
- Walking animation amplitude follows actual visual displacement relative to unchanged movement budget; sports retain their existing choreography. Faster gait decay on stopping, suppress walk blend in resting and seated poses.
- Coincident focus targets preserve yaw; direct activity changes remove old venue/vanity/controller props and hide stale phone.
- 23/23 focused tests passed including walk/pose, old Blender skeleton, current SPA skin geometry, console grips and live console sessions. TypeScript check passed. Cloud mobile QA workflow for sleep and venue added; screenshots/results not yet inspected. No physical phone FPS claim.

## v3 — contact stability and portrait HUD
- Stable elbow plane for collinear reach directions, zero-length hand direction guard, eye lead during conversations, suppress chat face overlay during reclining/swimming; no new model assets or gameplay changes.
- Reviewed all 17 actual v2 cloud captures, 4 sleep + 13 venue, both jobs passed at caff5d5 (run 45672080694). Found clipped sleep panel and overlapping camera dock; corrected portrait inspection grid and camera spacing, added browser bounding-box assertions to sleep QA. v3 layout verification pending cloud rerun, not yet visually confirmed.
- 31/31 focused tests passed; typecheck and Vite build passed. Existing bundle warnings remain. Physical FPS unmeasured.

## v4 — pet locomotion
- Smooth speed-sensitive gait and continuous step phase through route replacements, stationary pauses and external park follow. Park dog yaw damped; blocked motion no longer increments travel.
- Smooth cat body yaw on perch ascent/descent, preserving authored rest yaw; partial cancelled ascent reverses its own yaw path. Fade dog stair gait near ends. No server routine, collision or save changes.
- 31/31 focused pet tests passed, then 8/8 rerun after final cancellation fix; TypeScript passed. v3 cloud sleep layout assertions passed, venue still running at time of verification. Added authored Simba cloud captures to next workflow; visual review pending.
- Owner requests no interim test links; provide a test build only after all 0.49 polish is complete.

## v5 — surface polish and render-loop efficiency
- Added deterministic fine wood pores and fabric threads to shared diffuse maps; same dimensions, meshes, material batching and texture resolutions. Slight daytime key/fill contrast adjustment at home; no extra lights or shadow passes.
- Cache fixed animation pivots per model root (including absent parts) and reuse scratch vectors for vacuum and shuttle. Replacement roots remain independent. No measured phone FPS gain claimed.
- 16/16 focused tests passed, TypeScript clean. Test proved 1200 repeated named lookups require only 2 tree searches. All furniture footprint/finish tests passed.
- v4 cloud sleep and venue passed. Reviewed 18 actual Simba frames; rotated sofa case incorrectly used a floor approach 9cm inside an obstacle. Server correctly discarded that route. Moved only the QA fixture 25cm and verified all four approach points clear, added assertion for authoritative perch in browser. Cloud pet job failed on 40 generic 404 resource errors; likely private audio absent (eight per scenario), not yet confirmed by URL. Added exact allowlist only for private audio 404s and log URLs of all other failures. Music remains private and unchanged.
- Added morning/day/night mobile captures and full regression job to cloud workflow. Latest visual and regression results pending. No new preview build served or main changed; owner wants no interim test links.

## Final candidate — clear-weather visibility
- Full cloud regression at 4977d7b: 788 tests, 787 passed, 0 failed, 1 intentional private soundtrack skip; build passed (run 45674427231). Sleep captures visually confirmed panel is in bounds; all four browser bounding-box checks passed. Venue job passed.
- Reviewed six morning/day/night captures. Clear weather incorrectly used 49–75 distance fog even for a home camera that reaches 88; daytime/night overview was nearly invisible. Changed clear home fog to 125–185 on both weather and scene entry, preserved fitness 85–115 and other ranges. Added clear preset and transition regression; 8/8 focused weather tests passed. New cloud verification required for final candidate.
- Final candidate da73fa2: cloud regression 789 total, 788 pass, 0 fail, 1 intentional private soundtrack skip, build passed (run 45675013390). Local soundtrack/stream/haptics tests 6/6 including the omitted private audio test. All eight dist MP3 SHA-256 values match the private cache. Reviewed 18 corrected pet captures and 13 venue captures from run 45674427231 (all jobs passed); the rotated sofa is now an actual safe perch. Reviewed all six corrected home-light captures from 45675013390: full home visible in morning/day/night. Final run sleep, venue, home-light and regression passed; pet rerun was still in progress at recording time.
- Preview served da73fa2 bundle index-DQZw4oRP.js on 3194, PID 8116, separate data, no codes. Main 3111 PID 7916 unchanged, main 7e0e2a1. Physical iPhone/Android FPS not measured (cloud is software-rendered). No merge/deploy to main until owner approval.
