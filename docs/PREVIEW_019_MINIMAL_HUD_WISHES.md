# Sim-Life 0.19 — Minimal Mobile HUD & actionable wishes

Branch: feat/minimal-mobile-hud-019, based on feat/autonomy-neighborhood-019.
STATUS: draft preview ONLY. Main production game v0.18 on port 3111 and family's real saved data are unchanged.

## HUD
- Only two compact buttons remain in the bottom world HUD: Phone and Skills. Furniture still opens from the phone/PC applications, so there is no loss of functionality.
- Pets are accessible by a 44x44 paw icon in the upper strip alongside Needs. Small warning counter and full accessible title reveal hunger trouble without expanding the control.
- Clock, map, inspection, portraits, shared balance and active task queue remain operational. The narrow mobile map is icon-only to avoid clipped text.
- Persistent bottom stock readout is hidden on portrait phones (the refrigerator and device inventory still show stock).
- Shortened the welcome toast so it does not dominate the scene.

## Three actionable wishes
- The old large thought panel no longer auto-opens on login. A small contextual thought pill hints at the highest wish. User must tap to open three personal wishes.
- Each selected wish shows its significance, reason, need percentage and an actual action button.
- Hunger: eat an available meal, open fridge for refrigerated portions, cook an unlocked recipe when pantry permits, or explain why ingredients are missing. No fictitious supplies.
- Sleep: real bed; hygiene: shower; bladder: toilet; social: call/chat on existing real furniture; fun: desk games, music or tea, all verified to actually restore fun; comfort: sofa or cleaning. Additional optional pet care or tidying goals fill empty slots.
- Commands are sent through the existing authoritative network/server and can enter the action queue. Other player's character cannot be controlled. No money, points or experience are invented.
- The voice-line library and phone history are preserved. Lessons are still present behind a collapsed Why button, with local user preferences and pinning support.

## Checks
- npm run build and TypeScript succeeded.
- Relevant thought tests and new wish tests passed, including real server action success for fun. Previous action queue and autonomy regression suites passed.
- Personally viewed Chrome mobile emulation screenshots at 320x568, 360x780, 390x844 and 430x932: two bottom buttons, pet 44px square, thought panel only on tap, three wish chips, no horizontal overflow.
- Real action from wishes was observed starting as a genuine task. This Chrome emulation does not measure physical phone FPS.
- Earlier second test run failed to authenticate due reuse of a browser profile; the final run with fresh browser profile passed all four sizes.

## Isolated test preview
Code folder: D:\Sim-Life-019-Queue
Isolated saves: D:\Sim-Life-019-HudQA-Data
Port: 3132
PC: http://127.0.0.1:3132/
Phone same home Wi-Fi: http://192.168.0.124:3132/
Preview uses testNoCodes=1 and must not be exposed to the public Internet. Production codes remain protected.

Do not merge into main without user's explicit confirmation.
