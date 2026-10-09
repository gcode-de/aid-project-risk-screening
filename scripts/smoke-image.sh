#!/bin/sh
set -eu

engine=${CONTAINER_ENGINE:-docker}
case "$engine" in docker|podman) ;; *) exit 2 ;; esac
image=${1:?Usage: sh scripts/smoke-image.sh IMAGE}
container=$($engine run --detach --rm --read-only --cap-drop=ALL \
  --security-opt=no-new-privileges --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --publish 127.0.0.1::8000 --env MODEL_MODE=demo "$image")
trap '$engine stop "$container" >/dev/null' EXIT

for attempt in $(seq 1 30); do
  if $engine exec "$container" python -c \
    "from urllib.request import urlopen; urlopen('http://127.0.0.1:8000/api/health', timeout=1)" 2>/dev/null; then
    break
  fi
  sleep 1
done

$engine exec "$container" python -c '
import json, os
from urllib.request import Request, urlopen
base = "http://127.0.0.1:8000"
assert os.getuid() != 0, "Container must run as non-root"
assert "<html" in urlopen(base).read().decode()
info = json.load(urlopen(base + "/api/model-info"))
assert info["mode"] == "demo" and info["ready"]
project = dict(country="Kenya", sector_code=12230, initial_budget_usd=500000,
               cpi_score=None, approval_month=12, approval_year=2024)
request = Request(base + "/api/predict", json.dumps(project).encode(),
                  headers={"Content-Type": "application/json"})
result = json.load(urlopen(request))
assert result["mode"] == "demo"
assert result["expected_cost_change_usd"] == 90000
assert "missing-cpi" in [note["code"] for note in result["notes"]]
print("Container smoke test passed: frontend, API, prediction, non-root, read-only.")
'
