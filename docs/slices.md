# Delivery slices

Each slice includes implementation, relevant tests and documentation, followed by a commit
and push. No source dataset or assessment document is published.

1. **API and model contract** — input validation, explicit modes, trusted artifact adapter,
   finite output validation, useful review notes, health/options/model-info endpoints.
   Verification: pytest API behavior and Ruff. See model integration guide and ADR 0001.
2. **React interface** — accessible German form, honest demo state, results and error states.
3. **Integration** — real API/browser flow, model-artifact tests and screenshots.
4. **Delivery** — tested OCI image, GitHub Actions and Docker Hub publication; Podman and
   Cloudflare Tunnel operator guide. Live deployment needs the operator's registry and host.
