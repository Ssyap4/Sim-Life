# Sim-Life 0.3 — Household Economy Plus / Long Side Gigs

**Draft extension** of the Moscow Market phase. Base branch: `feat/moscow-market`; no merge into main, no heavy 3D models. The earlier art and Living World Draft PRs remain separate.

## Storage & food

- Existing fridge has **36 simulated storage cells**, separate dry kitchen shelves have **42 cells**. These are capacities of the *existing* furniture, not future housing upgrades.
- Cold groceries occupy approximately one cell **per purchased package** (e.g. 10 eggs = 1 cell), prepared home food occupies 1 cell per serving, and takeaway uses one cell per original order package.
- Dry goods use cabinet cells rather than occupying the fridge; pet food is tracked separately.
- All checkout orders, including mixed baskets of food and ready meals, are validated **atomically against physical slots** on the server. Legacy single-item purchases and cooking also check the same capacity. A full fridge requires eating some food before buying or cooking more.
- Older, already overfull family saves stay intact, but the system prevents **increases in over-capacity storage** until space is freed. Never discard legacy progress.
- Product, recipe, takeaway and interactive home-object descriptions have been added. The inventory displays remaining spaces and recipe ingredient shortages. Missing ingredients can be added to the cart with one tap.
- Prices still use Moscow/Moscow-region oriented *game balance* values; not real-time shop quotes. Home cooking remains cheaper than delivery.

## Job board — 6 distinct side gigs

| Job | Random payout | Duration in game hours |
| --- | ---: | ---: |
| Taxi driver | 2,500–4,500 ₽ | 10–12 h |
| Courier | 2,300–4,300 ₽ | 8–10 h |
| Ozon warehouse sticker / labeling worker | 2,500–5,250 ₽ | 14–16 h |
| Wildberries warehouse order packer | 2,400–5,400 ₽ | 14–16 h |
| Assistant barista | 2,200–3,600 ₽ | 7–9 h |
| Inventory clerk | 2,600–4,100 ₽ | 9–11 h |

Each has a distinctive text description, location name, four story stages, required energy, and household-need penalties at completion. The two extra job ranges are design defaults and can be balanced later.

**Game clock semantics**: One in-game day = 48 real minutes when someone is online. One game hour = ~2 real minutes. Thus an Ozon or Wildberries shift lasts approximately 28–32 real minutes **of active simulated time**. This is not a 14-second animation. The work board shows progress and current stage, no pretend 3D taxi/warehouse. While away, the resident is hidden from the home scene and cannot carry out household actions.

The shift is saved and is not dependent on keeping a phone socket open. If one player disconnects and the other keeps playing, their shift continues. If both players go offline, the world clock (and shift) pauses. The start, end and randomized duration survive server restart. On completion, **the authoritative server** samples one integer amount inclusively from the specified pay range and records a single credit in the ledger. No salary at start. One paid shift per resident per **completion day**; cancelled shifts have no pay.

The old 38-second mini-work buttons have become **unpaid practice**. They can no longer be exploited to print 3000 ₽ every 38 seconds. These gigs are NOT the two planned deep careers (Alina hair restoration studio and Vlad game/software development studio), which stay postponed.

## Future expansion seams

- `src/shared/jobs.ts`: all job definitions, stage descriptions, rates and duration rules. Later scenes / NPC interactions can react to these IDs rather than rewriting economy.
- `server/jobs.ts`: persistent assignment and authoritative settlement. Future optional interactive tasks can change performance and ultimately wage without trusting client-supplied salary values.
- `src/shared/storageSpace.ts`: item-level location, packaging, descriptions, and capacity checks. Later fridge furniture upgrades can replace the static capacity rule.
- Existing GLB characters, Three.js geometry, graphics pipeline and simulation cadence were not expanded.

## Validated

- Production TypeScript/Vite build.
- 35 relevant existing/new economy, tasks, pet, food, save and multiplayer tests: all green.
- 6 added focused economy and WebSocket job tests: all green; shared work assignment, malicious client-specified pay/duration ignored, disconnect/reconnect and zero payout on cancellation.

Manual iPhone/Android test still required for HUD scrolling, cards, tap targets and subjective FPS. Test environment has its own copied save and access codes; no stable-family save updates.
