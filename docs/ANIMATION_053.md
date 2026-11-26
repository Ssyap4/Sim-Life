# 0.53 animation polish — pass 1
Worktree feat/living-everyday-053, not production. Start with coffee and desktop contact rather than a full Actor rewrite.

- Cup handle is attached to the palm anchor, upright in world space with its handle facing the resident's right. IK is no longer overwritten by idle arm swing or generic reach during coffee delivery. Delivery moves the cup progressively toward the tabletop. Existing shared tea uses the same grip.
- Coffee route and preparation catch up on slow but uninterrupted frames; path movement subdivides into at most 0.20 s steering steps. Hidden, paused and interrupted frames retain their previous behavior. No server timings/effects or inventory changes.
- Desktop mouse moved to the resident's actual right side. Default and catalog workstation input anchors match the visible hardware and desk scale. Smooth blends between typing and mouse gestures; hand direction faces the keyboard. Existing laptop and remote rigs remain supported.
- Local check passed, 25/25 selected tests passed (including 3 new animation tests and keyboard checks on four GLB assets). These are not visual QA or physical device FPS measurements.
- Prior mobile run 45723978812 failed to reach the offering phase; artifact 15073028040 reviewed (brew, carry, failure). Frames were wide and not suitable for judging the grip. Updated mobile scenario starts in close-up and reports handle/drop error; new results pending.
- No drinking animation at the workstation, finger articulation, other object groups or seating polish claimed yet. Those remain future parts of this approved animation pass.
- Production 0.52 was stopped; restarted existing npm run start on port 3111 without release/reset. Health reported testNoCodes:false.
