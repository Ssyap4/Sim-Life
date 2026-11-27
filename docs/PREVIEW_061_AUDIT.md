# 0.61 existing locations audit — stage 1
Preview-only branch feat/polish-061, based on approved main fde6a16. No production deployment/reset. No visual/model/audio changes.

## Verified baseline
Downloaded the actual 0.60 artifact 15179982008 (run 45959341903, mobile and regression success).
Home had 289 draw calls / 255530 triangles; market 40 / 90410; park 110 / 168110; SPA 111 / 70030. Home after two cycles was 175 geometries and 35 textures both times. FPS overlay values in report were sometimes stale from the previous scene; SwiftShader software-rendered cadence is not physical phone performance.
Reviewed six baseline images: furniture, queue, paired eating, Alina eating, continued film and house after cycles. Live notices can cover faces during close-up actions; no visual change yet.

## Fixes and checks
- Fish catch cleanup releases the unique fin buffer/material once, preserves shared body assets.
- FPS meter resets per render scope (location, car ride, fitting); report uses scoped sample or null, never previous-scene values.
- Local TypeScript and 27/27 targeted lake/performance tests passed.
- New focused cloud workflow plus expanded mobile resource audit captures all active external destinations and split-location snapshot cases. Synthetic snapshots exercise rendering, not real server multiplayer journeys.
- Pending: cloud results, screenshot review, physical phone measurements, route/contact/notification/pet/cooperative gameplay polish. Do not mark the entire 0.61 complete.