# SimOurHome 0.65 — home care (preview, stage 1)
Owner redirected 0.65 to expanding existing gameplay content; careers, savings, hosting and packaging remain deferred. Separate worktree D:/Sim-Life-065, branch feat/home-care-065, proposed LAN port 3158 and separate preview save.

- Alina's vanity: 5 new actions (moisturizer, serum/cream, nourishing facial mask, lip balm, hand cream), group existing choices into face/hair/makeup/hands and scent; display actual task duration and care gains. Face procedures replace the existing skin effect; lips/hands are optional small independent effects.
- Bath: ordinary 55s and foam 75s remain. Alina-only lavender/rose bath bombs (95s), milk bath (110s), shaving bath (125s), SPA ritual (165s), share one body-care group. Hygiene 100, comfort +35 (ritual +45); care points +15/+15/+20/+22/+28, 18–24 game hours. Weaker bath variants remain available without overwriting stronger body effect. Existing free cosmetic supply abstraction, no new shop/inventory or costs. Effects on completion, cap 100, refresh does not farm care mood.
- Route to actual bathtub, shared resource with ordinary bath and Verdell. Existing rig and safe bath pose; colored foam, props and additional arm gestures for visual variation. No new audio or character models; no claim of perfect contacts or actual physical-device FPS. Visual checks required before approval.
- Local check/build succeeded; focused 16 tests plus the new two-player bath-specific network test passed; cancelled bath no care, concurrent use rejected, completion persisted. Cloud focused and actual WebGL capture workflow added. Main untouched.

## Stage 2 contact and playback polish
- Separate hold/dispense/application, lip contact and bath drop/rest/shave/body-care phases with IK on the shipped remake rig. Cosmetic props disappear on applying/finishing/cancel; bomb drops once, dissolves and reveals colored foam. Optional inspection camera raised and reframed after seating. No character or audio assets replaced.
- Active care phase uses the server elapsed time at replay and a bounded real-frame clock while playing; new skin treatments count for the existing skin-care wish.
- First visual run 46066249610 passed mechanically, but four vanity frames were occluded and bath frames showed only the opening phase. Visual run 46067046421 captures later phases and the revised inspection framing. Do not equate scripted success with personal screenshot review.
- Preview remains on port 3158 with its existing separate household; never reset on ordinary restart. Main stays 0.64.
