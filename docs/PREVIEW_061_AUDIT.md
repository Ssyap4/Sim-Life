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
## Candidate status, 27 November 2026
Preview only, main unchanged; explicit approval is required for promotion. Main release uses a fresh household, not migration of test progress. Never delete access/trusted devices or private media.
- Home: finished side walls and door passages, kitchen and bath details, notification dock and compact toast, furniture reconciliation and stable workstation hosting.
- Pets: phased idle performances, full owner reactions, companion greetings, planted strides and toy contacts. Pet cloud workflow 45972836004 passed.
- Shops and leisure: distinct wall finishes, stocked displays, live catalog labels, cashier and fixtures, arena/fitness/SPA/barber/clinic detail. Cloud location audit 45974997458 passed; prior screenshots visually inspected.
- Remaining locations: nine more visual passes on education, four workplaces, industrial, market, park and lake. 50/50 targeted tests passed before final minor visual-only refinements. No station anchors, prices, rewards or routes changed.
- Prior audit measured home 304 calls / 181 geometries / 37 textures initially; 185/37 on both warmed returns; 187/37 after all destinations and split visits. These are resource counts, not measured physical phone FPS.
- Final cloud regression and expanded detail screenshots are required before closing the candidate. Keep build warning for the 2 MB JS bundle on the backlog, not a new blocker. Do not claim physical phone FPS.