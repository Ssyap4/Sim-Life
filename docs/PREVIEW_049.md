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
