# ADR 0002: Verified images and explicit deployment

Status: accepted

## Decision

Use GitHub Actions to run backend, UI, API-contract and browser/accessibility tests.
Build and smoke-test a read-only, non-root OCI image before publishing. Pin third-party
Actions to commit SHAs and dependencies to lockfiles. Publish amd64/arm64 images to Docker
Hub only for main or version tags after verification; pull requests never receive registry
credentials. Publication activates when the Docker Hub repository variables are configured.

Run a digest-pinned image with rootless Podman Quadlet under systemd. Expose only a loopback
port to a Cloudflare Tunnel connector on the same host. Keep deployment explicit: CI does
not receive Proxmox or SSH administrator credentials and does not automatically replace the
live demonstration after every code push.

## Consequences

The release summary identifies the exact image for deployment and rollback. The app needs
no database and stores no inputs. The operator supplies registry configuration, the target
host and tunnel route. An existing Podman LXC must support rootless containers and cgroups;
the deployment guide does not weaken Proxmox isolation or change host settings automatically.

The reference topology uses a host-level cloudflared connector. If cloudflared is itself
containerized, localhost points inside that container; use a dedicated shared Podman network
and service name instead. No public inbound origin port is required.
