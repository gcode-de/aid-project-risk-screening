from urllib.request import urlopen


with urlopen("http://127.0.0.1:8000/api/health", timeout=2) as response:
    if response.status != 200:
        raise SystemExit(f"unexpected status: {response.status}")
