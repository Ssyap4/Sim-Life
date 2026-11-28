# SimOurHome 0.71 - technical polish, checkpoint 1

Owner approved a broad optimization and quality pass before the two deep careers and hosting migration. No vehicle ownership, greenhouse, seasonal clothes or other expansion in this checkpoint. Main 0.70 stays protected. Worktree D:/Sim-Life-071 from main bc8bf39; branch feat/polish-071.

- Lossless build-time gzip for fingerprinted GLB models, with correct model MIME and negotiated identity/gzip delivery. Original model bytes unchanged. No compression of private MP3/MP4. Measured actual build: Alina 4573112 -> 2186959 bytes, Vlad 4133520 -> 1866337, Simba 331484 -> 134390. Server tests verify compressed/identity bytes, lengths, HEAD, Vary and cache behavior. Savings are network payload size, not measured FPS or load time.
- Skip 13 historical snow samples in winter, where cover is forced to 1 anyway. Same forecast semantics.
- Resort journey now uses the rural roadside environment in both directions. Only update the journey camera projection when aspect changes. Trip durations and independent return tested.
- Browser QA extended for both new destinations, startup, all existing location snapshots and repeated resource lifetimes, including resort, grooming and building store. All modified browser fixtures use isolated 100000 RUB balances. Cloud workflow added; results and screenshots require inspection.
- Local production build and typecheck succeeded; 12/12 focused tests passed. Vite still warns about two large JS chunks. No real-device FPS measurement or visual approval yet. No production deployment, save reset or heavy local WebGL tests.
