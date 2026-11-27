# 0.68 — media library and manual games (first implementation checkpoint)

Owner approved both a substantial movie/series expansion and interactive two-player games. Main remains 0.67; this branch is not a release candidate.

Implemented:
- 56 named titles: 42 films and 14 series, including 2026 releases, classics, genres, descriptions, series season/episode selection and next episode.
- Personal favorites, watch-later and bounded viewing history; shared watch-together list. Catalog accessible from TV and phone. Actual completed sessions advance individual history; interrupted sessions do not count as watched. Server validates title/episode/genre and paired consent, preserving existing food/drink mechanics and shared memories.
- Manual bowling at PLAY ARENA: five frames per person, authoritative turn and roll sequence, direction/power, strike/spare scoring, deterministic arcade pin outcomes, synchronized scoreboard, cancellation and rematch invitation. Completion charges 1200 RUB once, records a bounded history and existing shared memory. Original automatic mode retained.
- Real two-client WebSocket integration test; local targeted suite 24/24 and TypeScript check passed. Cloud mobile workflow covers catalog, shared series and interactive bowling.

Not complete: no real movie playback (game viewing simulation); original genre-themed icon cards rather than actual posters; no mid-view pause/resume yet, no distinct per-title TV art, no real runtimes in catalog. Old-series metadata has not been exhaustively audited. Bowling uses a simplified 2D interactive overlay, not a fully simulated 3D pin scene; no series-to-three mode yet. Air hockey, billiards, darts and Jenga manual modes are pending. Cloud visual review required before release. Private music and UFC video remain local only.
