# Sim-Life 0.19: Autonomous daily life and rear neighborhood

Draft feature branch: feat/autonomy-neighborhood-019
Built on feat/culinary-progression-019 and the previous action-queue/shadowless commit 517e1e7.
Do not merge into main/v0.18.0 or touch the production save without owner's approval.

## Resident autonomy

- Reaped completed manual world walks after route distance/speed plus a 700-ms animation grace period. Previously walkingHome entries could remain indefinitely and prevent needs/full mode from running.
- Shortened visible warmup for enabled modes, care and leisure cooldowns. Full mode alternates genuine household chores (tidy, wash, plan, hygiene) with leisure/TV/PC/pet time, subject to existing route/access/resource checks.
- Needs mode continues actual needs recovery, plus light ambient visits to pets when nothing urgent needs handling; no invented groceries/purchases.
- Live regression added: a manual walk then turning on needs mode eventually starts a real task.

## Neighbors

- All four unchanged, distinct neighbor cottage designs now occupy a widely spaced line BEHIND the family house, instead of two on the west and one on the east.
- Shared public walking lane is now behind the house at z=-15.35 with at least 7.5 units of rear expansion reserve. Cottage centers around x -20/-7.1/6.7/20.2, z -25.1/-25.8.
- 14 existing uniquely styled light NPCs keep articulated faces/hair/animation; approximately 27 deterministic daily outings across seven shared profile groups, weighted toward watering, mail, tea, stretching and everyday work on their own plots. Short public errands, strolls and two social chats are rarer; nighttime is quiet.
- Hinged doors animate as residents leave and return. Routes and houses are spatially separated and do not intrude into the family house. No server persistence or NPC task load: scenery motion is client-side and synchronized with game clock.
- Added mobile-friendly viewport toggle in Carte -> "Осмотреть соседей" to focus a currently visible neighbor, plus "Камера к нашему дому" to return. Defaults continue to show the original home; no forced zoom-out of family house.

## Checks

- Production Vite build and TypeScript: success.
- Neighbor and autonomy regression suites: 37/37, plus added focused walk/autonomy test passed.
- Action queue tests: earlier 5/5, mixing cooking, queue manipulation and sleep, inherited from the previous commit.
- Live Chrome mobile emulation screens 320x568, 390x844 and 430x932: no document horizontal overflow or JS exceptions; manually reviewed default view and a focused NPC close-up. This is Chrome mobile emulation, not physical-phone FPS measurement.
- No intended change to gameplay economy, 19-recipe cooking progression, shared family saves or v0.18 main.

## Isolated preview

Code/worktree: D:\Sim-Life-019-Queue
Data: D:\Sim-Life-019-Queue-DataV2
Port: 3131
PC: http://127.0.0.1:3131/
Phone LAN: http://192.168.0.124:3131/
Preview test mode uses SIM_LIFE_TEST_NO_CODES=1 and MUST NOT be put on the public Internet.
