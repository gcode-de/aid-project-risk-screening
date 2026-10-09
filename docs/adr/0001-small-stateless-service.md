# ADR 0001: A stateless application with a replaceable model boundary

Status: accepted

## Context

The project demonstrates a React interface and a Python prediction API. Models will be
trained separately. The presentation requires reproducible behavior and explicit limits.

## Decision

Use one React/TypeScript frontend and one FastAPI application. In production FastAPI also
serves the compiled frontend from the same origin, packaged as one OCI image. Vite proxies
`/api` during development. Do not add a database, message queue or separate web proxy.

Load trusted sklearn pipelines once during API startup. Keep transformations in the saved
pipelines. Provide an explicit demo mode with fixed example estimates. Default to
unavailable until the operator chooses a mode. Keep rule-based review notes separate
from estimates: notes are not feature attributions or proof of causality.

## Consequences

One image and port simplify Podman and Cloudflare Tunnel deployment. No CORS middleware
is needed. Stateless requests do not require migrations or backups. Model files must be
supplied by the operator and match the pinned runtime. Real probability calibration,
validation and training remain outside this app slice. A risk traffic light is omitted
until its thresholds have a business owner and a validation basis.
