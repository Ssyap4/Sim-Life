# 0.49 — World polish, first pass
Owner approved direction 5 (quality pass), then own yard expansion (2), then family weekends (1). No production approval. Base main 7e0e2a1, branch feat/world-polish-049.
- Ignore suspended/hidden frame durations for visual simulation and adaptive quality; keep existing 200ms cap on ordinary slow frames. Do not change server clock or tasks.
- Add adaptive-quality hysteresis, retain safe/full override and existing pixel ratios.
- Reset tap arbitration on blur/visibility change; cancel individual pointers as before.
- Private soundtrack installed locally; never commit recordings.
- 21 focused tests passed (gesture, Android graphics, performance and new polish tests), typecheck passed; 3 version/copy tests passed after bump. No full regression or physical phone FPS/visual QA in this pass yet.
- Next: inspect actual mobile renders, actor transitions/prop contact, pet locomotion and furniture. No new mechanics or production deployment without approval.
