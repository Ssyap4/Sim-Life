# Sim-Life 0.3 — Moscow Market & Household Economy

**Status: Draft branch**, based on `feat/living-world`. Do not merge to `main` without review. No 3D model or art changes.

## Player experience

- The **🛒 Магазин** button and the in-world delivery object open a touch-friendly shop overlay.
- Categories cover groceries, vegetables, meat, dairy, pantry items, fruit, ready-to-eat takeaway, and food for Verdell and Simba.
- The **shared shopping basket** displays unit prices, stock quantities, running total, remaining balance, and prevents excessive client-side selection.
- Checkout is **server-authoritative and atomic**: price/quantity validation, budget check, stock caps, one charge, one save and synchronized snapshots. Rejected orders leave all stock, money and transactions untouched.
- Home cooking reuses the existing kitchen animation and recipe/task flow. The food catalogue now contains 26 grocery packs and 15 cooking recipes, with estimated ingredient cost per serving.
- Ready pizza, rolls, burgers and shawarma are substantially more expensive than equivalent home cooking; their portions are shared in the household fridge and consumed at the existing dining table using the same lightweight animation.
- **Запасы** shows pantry ingredients, prepared home food, takeaway portions, pet food, and recipes available from current ingredients.
- **Финансы** shows the 40 most recent income/expense entries with in-game day, time and actor.
- Simple non-core, once-per-game-day shifts pay **3,000 ₽** to Vlad and **3,200 ₽** to Alina; shift activity uses existing work animation. They are a temporary economic bridge, **not** implementation of their deep careers.
- Ruble prices are Moscow/Moscow-region **game-balancing references**, not live retail quotes. Product packs and ingredient units are defined in `src/shared/food.ts`.

## Compatibility and safety

- The save stays `version:2` and old saves are migrated on load: extra pantry keys, takeaway, transaction ledger and last-worked day are default-filled. Existing funds, pets, needs and progress remain unchanged.
- The initial household balance remains **2,500 ₽**. Migrated existing families keep their current balance. No cash injection to existing saves.
- Each completed shop order produces only one ledger entry. Legacy direct purchases and pet food purchases are also entered in the financial journal.
- Deliveries are currently **immediate** at checkout. Scheduled deliveries, expiry dates, store visits, housing and salaries from 15k–150k monthly are future phases; no misleading simulation of logistics or jobs is implied.
- No new shadows, GLBs, geometry, persistent browser polling or per-frame shop processing. The catalog is data-driven and HTML-only.
- No changes to the stable server, `main`, or existing save directories.

## Focused checks

1. `npm run build`: TypeScript and Vite.
2. `tsx --test server/tests/market.test.ts server/tests/market-network.test.ts server/tests/tasks.test.ts`: core shopping, persistence, cross-player sync and new work/food task integration.
3. Existing relevant food, pet, storage, network and life tests were run during integration; baseline art tests are deliberately not repeated.
4. Smoke-check an **independent** preview server using a **copied** save; actual iPhone/Android interaction remains for user review.

## Manual trial

1. Open the test server; enter as Vlad or Alina using the same access code as before.
2. Open Магазин, add milk/bread, inspect total, submit and check balance and Запасы.
3. Cook at the kitchen, eat at the table; order pizza or rolls in the shop and eat them at the table.
4. Check Финансы for purchase expenses; do a desk side shift and confirm an income entry and a second shift blocked until the next in-game day.
5. On a second phone, log in as the other player and check synchronized purchases and household funds.

**Main careers remain deliberately postponed:** Alina hair reconstruction and studio, Vlad vibe coding / game studio.
