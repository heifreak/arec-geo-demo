# AREC GEO 3D

- Preserve Cesium navigation, flyToBoundingSphere, Home and all 18 official plazas. Never add DEL.
- Work on reviewable branches and pull requests. Do not merge main or publish without explicit approval.
- Preserve V14 symbols, thresholds and classification rules. Request the reference before implementing them; never infer them.
- Never commit corporate confidential information, especially V15–V18. Every other dataset also requires explicit public-release review.
- Do not assume access to Google Drive, the 1,255-file ZIP, or index_v15_metropolitano.html.
- Keep data processing separate from this static viewer. Use relative URLs compatible with GitHub Pages.
- Load authorized GeoJSON on demand by plaza; do not preload the full collection.
- Do not invent V01–V23 meanings, sublayers, analytical rules or results. Clearly distinguish implemented capabilities from pending integrations.
- Run `npm test` and syntax checks before committing. Record unrun browser checks and blockers honestly.
- Use the existing isolated checkout; do not create worktrees unless requested.
- See docs/architecture.md and docs/acceptance.md for scope and completion criteria.
