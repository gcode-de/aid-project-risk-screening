# Delivery slices

Each slice includes implementation, relevant tests and documentation, followed by a commit
and push. No source dataset or assessment document is published.

1. **API and model contract** — input validation, explicit modes, trusted artifact adapter,
   finite output validation, useful review notes, health/options/model-info endpoints.
   Verification: pytest API behavior and Ruff. See model integration guide and ADR 0001.
2. **React interface** — accessible German form, honest demo state, results and error states.
   Verification: 7 component tests, TypeScript build, Biome, generated API types and npm audit.
3. **Integration** — real API/browser flow, model-artifact tests and screenshots.
   Verification: 27 backend tests, 7 component tests and 8 real-service browser tests on
   desktop/mobile. Automated WCAG A/AA checks pass on both initial form and result views.
   Added contrast fixes, finite money-output checks and artifact-interface validation.
4. **Country coverage and CPI** — model-owned dropdown and API enforcement, automatic
   point-in-time reference lookup, explicit missing/manual values and source disclosure.
   Verification: country/sector rejection, publication cutoff, actual model input,
   missing/zero semantics, UI reset and supported-only options. See ADR 0003.
5. **Delivery** — tested OCI image, GitHub Actions and Docker Hub publication; Podman and
   Cloudflare Tunnel operator guide. Live deployment needs the operator's registry and host.
