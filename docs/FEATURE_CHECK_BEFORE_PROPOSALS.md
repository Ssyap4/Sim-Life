# Feature audit before proposals (owner rule, 27 Nov 2026)

Before suggesting a new feature, inspect the current checked-out branch, latest handoff, relevant implementation, UI/server entry points and tests, and existing release notes. Do not rely on older chat memories or the roadmap alone. Search aliases, Russian labels and actual command IDs. If a capability exists, do not pitch it as new; explicitly identify an actual missing extension only if useful. If not verified, say so. Check owner decisions and rejected/deferred ideas. Maintain this audit with future releases.

## Already implemented: examples verified on 0.62 preview 279a647

- Family savings: reserve, home improvements, both future studios, holiday; real deposits/withdrawals, category budgets. Rework deferred. src/shared/familyBudget.ts, src/billingUI.ts.
- Holidays, birthdays, anniversary, hobbies, contextual life events: src/shared/familyLife.ts. Hobbies already include reading, cooking, fishing, sports, painting, modeling; do not propose them as new.
- Shared day plans, consent, family evenings, joint activities, memories, journal filters, traditions and firsts: src/shared/weekends.ts, familyMoments.ts, familyJournal.ts, socialLife.ts.
- Personalities, interests, dreams, profile screens, full autonomy and context-dependent topics: src/shared/emotions.ts, familyAutonomy.ts, fullAutonomy.ts, src/phoneUI.ts.
- Personal cooking collections with actual quality, personal catch collections and real study completion: src/shared/personalCollections.ts, src/personalCollectionUI.ts, server/food.ts, server/locations.ts.
- Pet food preferences and personalities already exist: src/shared/petShop.ts, petPersonality.ts, petPreferences.ts.
- Computer favorites already exist: src/computerUI.ts, server/computers.ts. Generic texting activity and career inbox are implemented; they are not actual resident-to-resident messaging.
- Existing home journals are automatic activity/memory records. Search on 0.62 found no manual family message mailbox or authored family-journal note feature. No human recipe favorites/rating system found; pet food preferences and computer favorites are distinct. These are possible gaps, NOT approved tasks.

Main deployment only by explicit owner approval. Deep careers remain deferred. Update this check with future verified systems, do not treat it as an exhaustive list of every feature.

## 0.65 verified additions
- Home beauty: 16 new Alina procedures (5 vanity, 5 body bath, 6 hair), independent hair condition/style, actual props, timed effects and replay, existing wish integration. Do not propose these as new; hair reconstruction career still deferred.
- 10 drinks, 4 baked desserts, 7 snacks, 8 ingredients, grocery/recipe categories, ready drink transport to starter/purchased seating, films/YouTube with prepared portions, partner delivery during active starter desktop work. Current restrictions documented in RELEASE_065.md. No worker sipping animation/self-service or custom laptop delivery. Do not pitch existing content as new.

## 0.66 verified additions
- Personal food tastes: independent editable profiles, read-only partner tastes, recipe and ready food marks, cafe/coffee/picnic/campfire integration, shared cooldown, real consumption wishes, grocery/delivery/TV filters, ingredient suggestions, partner breakfast/serving options. Do not propose these as new. See RELEASE_066.md.
- Owner explicitly rejected laundry, including optional version. Do not reopen.
