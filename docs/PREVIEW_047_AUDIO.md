# 0.47 Preview v1 — Live sound
Base: 0.46 Preview v4, commit 3457d89. Independent feat/audio-047 worktree. Not a main release.

- Local 79-clip CC0/original bank, 18.8 MB on disk, lazy decode with prewarm, PCM for mobile compatibility. No runtime third-party calls.
- Recorded fictional speech and laughter with alternating conversation windows, multiple takes, pitch variation and no copied Simlish; actual cat/dog clips, purr and Foley.
- New audio spatial profile: listener at controlled resident, camera-relative pan, real house wall rectangles/door openings and eastern wing, low-pass occlusion, device range. Master compressor when available.
- Weather and seasonal birds/crickets/rain/thunder; quieter indoor ambience, street, cafe. Four original music arrangements. TV/PC/laptop and console audio; UFC and Forza use original programme mixes with licensed crowd and engine textures, not actual game audio.
- Water/shower, frying/dishes, brushing, doors, paper, drinks, eating, vacuum and barber clippers. Steps/paws remain disabled. Seven volume channels preserved; phone Sound now has thirteen sample preview buttons.
- 13/13 focused tests including asset headers, peaks and size, wall/door paths, panning, controls, action/console routing and cancellation/isolation. Typecheck and production build successful. No heavy visual or browser tests on ALINA-PC.
- Pending: actual iPhone/Android listening, subjective timbre/voice selection, mix level tuning, dedicated espresso sound (source downloads timed out), additional specific reactions, some procedural fallback effects. Full cloud regression and visual QA for 0.46 still required before promotion. Main not touched.
