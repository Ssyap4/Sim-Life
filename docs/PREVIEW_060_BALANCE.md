# 0.60 balance and needs precision
Owner requested moderate equalization, preserving realism and all computer duration bonuses.
- Warehouse shifts 11–13h (was 14–16), unchanged 5000–6800 RUB. Old booked 14–16h shifts remain valid and retain assigned payout.
- Home orders 4–5h (was 3–4), unchanged 2000–3500 RUB, existing speed/skill benefits, 4–5 optional miniquests. Previous shorter orders still valid.
- Petsitter 2300–3800 (was 2300–3300). All other wages and career rules unchanged.
- Need clock calculation retains six decimals rather than rounding every tick to hundredths; rates are unchanged. Tested one-hour decay across 1/2/3/5/10 minute batches. HUD still rounds for display.
- Targeted tests: 44/44 for jobs, electronics, coffee, rest, life; 52/52 after precision change for life, legacy shifts, fitness, dust, rewards, health and time-speed (some overlap). Full cloud regression required. No physical device or new visual claim.
- Preview only; no reset, no main release.