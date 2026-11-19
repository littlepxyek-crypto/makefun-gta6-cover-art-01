#!/usr/bin/env python3
"""Produces screenshots/ for the entry: serves app/ locally, opens each scene from shots.json in
headless Chrome at its window size, and saves the capture as a JPEG inside the gate's limits
(<=256 KiB, long side <=1280, short side >=480). Run from the repository root."""
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
CHROME = Path.home() / ".cache/puppeteer/chrome/linux-157.0.8103.78/chrome-linux64/chrome"
PORT = 8123


def wait_for_server(proc):
    for _ in range(60):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/", timeout=2) as r:
                if r.status == 200:
                    return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError("static server did not come up")


def main():
    shots = json.loads((ROOT / "shots.json").read_text())
    outdir = ROOT / "screenshots"
    outdir.mkdir(exist_ok=True)
    for old in outdir.iterdir():
        old.unlink()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=ROOT / "app", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        wait_for_server(server)
        for shot in shots:
            raw = ROOT / f".shot-{shot['name']}.png"
            url = f"http://127.0.0.1:{PORT}/index.html{shot['query']}"
            subprocess.run(
                [str(CHROME), "--headless=new", "--disable-gpu", "--no-sandbox",
                 "--hide-scrollbars", f"--window-size={shot['w']},{shot['h']}",
                 "--virtual-time-budget=20000", "--timeout=45000",
                 f"--screenshot={raw}", url],
                check=True, capture_output=True, timeout=120,
            )
            img = Image.open(raw).convert("RGB")
            target = outdir / shot["name"]
            quality = 88
            while True:
                img.save(target, "JPEG", quality=quality)
                if target.stat().st_size <= 250 * 1024 or quality <= 60:
                    break
                quality -= 8
            raw.unlink()
            print(f"{shot['name']}: {img.size[0]}x{img.size[1]}, {target.stat().st_size} bytes, q={quality}")
    finally:
        server.terminate()


if __name__ == "__main__":
    main()
