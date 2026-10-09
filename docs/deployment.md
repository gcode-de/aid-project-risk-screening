# Delivery: GitHub Actions → Docker Hub → Podman → Cloudflare Tunnel

## 1. Verify locally

```sh
uv sync --frozen --extra ml
uv run ruff check .
uv run ruff format --check .
uv run pytest -q
cd frontend
npm ci
npm run api:types
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
cd ..
docker build -t aid-screening:local .
sh scripts/smoke-image.sh aid-screening:local
```

The smoke test starts an isolated container, checks the frontend, API, prediction and
non-root user under a read-only filesystem, and stops its own container afterward.
For Podman use `CONTAINER_ENGINE=podman sh scripts/smoke-image.sh IMAGE`.

## 2. Configure Docker Hub publication

Create a Docker Hub repository named `aid-project-risk-screening` in your namespace.
Set repository secrets `DOCKERHUB_USER` (your Docker Hub username) and `DOCKERHUB_TOKEN`.
By default the image is published in that user's namespace. Optional **repository variables**
override the username or namespace, for example when publishing to an organization:

| Variable | Value |
| --- | --- |
| `DOCKERHUB_NAMESPACE` | Docker Hub user or organization owning the image |
| `DOCKERHUB_USERNAME` | Account allowed to push to that namespace |

Add `DOCKERHUB_TOKEN` as a GitHub Actions secret (repository or `dockerhub` environment).
Use a Docker Hub access token with write permission for this repository. Never commit or
paste it into source files. The `dockerhub` environment can have required reviewers if desired.

The workflow tests each PR/push, then builds and smoke-tests the image. Publication fails with
a configuration error if credentials are missing. After configuration, main publishes `main` and an immutable
commit tag `sha-<full-commit>`. Tags such as `v0.1.0` additionally publish `0.1.0`. The publish
job adds provenance, an SBOM (software inventory), and the final image digest to the run summary.

Start it through Actions → Verify and publish → Run workflow, or push the next completed slice.
Both linux/amd64 and linux/arm64 are built; the runtime smoke test in CI runs on amd64.

## 3. Run inside the existing Proxmox Podman host

Assumption: an existing Linux VM or LXC guest runs Podman with systemd and cgroups v2.
Rootless Podman in LXC may need host-specific nesting and user namespace configuration.
Verify `podman info` first; do not switch the LXC to privileged mode just to make this work.

Copy `deploy/aid-screening.container.example` to
`~/.config/containers/systemd/aid-screening.container` **on the target host**. Replace
`YOUR_NAMESPACE` and `YOUR_VERIFIED_DIGEST` with the successful workflow's reference.

```sh
systemctl --user daemon-reload
systemctl --user start aid-screening.service
systemctl --user status aid-screening.service
curl --fail http://127.0.0.1:8000/api/health
```

Quadlet generates the service; its `[Install]` section handles activation at user-session
startup. For boot without login, the host administrator enables lingering for the service
user with `loginctl enable-linger USERNAME`. Do not enable the generated service with
`systemctl enable`.

The image runs as UID 10001 inside the rootless container. To load real models, replace
`Environment=MODEL_MODE=demo` with `Environment=MODEL_MODE=model` and add a read-only bind
mount such as `Volume=/absolute/path/to/trusted-models:/models:ro` to `[Container]`.
Grant the mapped container user read access. On SELinux hosts use an appropriate private
label (`:ro,Z`). Never put model artifacts or registry tokens into the public repository.

## 4. Route through Cloudflare Tunnel

For an existing host-level cloudflared connector on the **same Podman host**, add a published
application route for your chosen hostname with origin `http://127.0.0.1:8000` in Cloudflare
Zero Trust. TLS terminates at Cloudflare; the tunnel connects outbound from the host.
Do not open the origin port publicly. The root path serves React; `/api` goes to the same origin.

If your connector runs on another machine or in its own container, its localhost is not the
app host. In that topology configure a reachable private origin or put the connector and
app on a dedicated Podman network and use `http://aid-screening:8000`. Confirm the actual
topology before changing bind addresses or tunnel routes.

Store the tunnel token through the connector's existing secret mechanism, never GitHub
source or the frontend. A public demo is possible; use Cloudflare Access if access should
be restricted to interview participants. No Cloudflare/Proxmox mutations are performed by CI.
For an unrestricted public endpoint, configure edge rate limits before enabling a real
model: this small stateless prototype has no application-level authentication or rate limiter.
Do not submit sensitive project information to a public demonstration.

## 5. Verify, upgrade and roll back

Verify the public hostname displays the demo notice and that one form submission succeeds.
Check `/api/model-info`: liveness alone does not prove a model is loaded. Keep the previous
working digest. For an upgrade, change only the Quadlet image reference, run daemon-reload
and restart the service, then repeat the checks. Roll back by restoring the prior digest.
No database migrations or data restoration are involved.

Useful diagnostics: `journalctl --user -u aid-screening.service` and `podman ps`.
Neither UI nor API persists submitted project data. HTTP access logging is disabled in the
image; reverse-proxy/tunnel logs remain governed by the operator's own configuration.

References: [Podman Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html),
[Cloudflare application routes](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/),
[Docker GitHub Actions](https://docs.docker.com/build/ci/github-actions/).
