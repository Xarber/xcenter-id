"""Exercise and capture the exported dashboard with a localhost-only account fixture."""
import argparse
import functools
import json
from datetime import date
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("web_export", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
repo = Path(__file__).resolve().parents[3]
version = json.loads((repo / "apps/dashboard/app.json").read_text())["expo"]["version"]
app = {"client": "garden-journal", "label": "Garden Journal", "name": "Garden Journal",
       "verified": True, "description": "Keep a record of what you grow."}
fixtures = {
    "/account/me": {"account": {"name": "Robin Green", "verified": True,
        "profile": {"username": "robingreen", "givenName": "Robin", "surname": "Green", "hasPicture": False},
        "passkeys": [{"id": "sample", "label": "Laptop", "created": 1750000000000}], "emails": []}},
    "/account/apps": {"apps": [app]},
    "/account/connected-apps": {"apps": [app]},
    "/account/data-grants": {"grants": []},
    "/account/app-data-permissions": {"apps": [], "grants": [], "incoming": [], "outgoing": []},
}


class Preview(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith("/account/"):
            self.send_response(200 if path in fixtures else 404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(json.dumps(fixtures.get(path, {})).encode())
        else:
            if path in ("/", "/dashboard", "/apps", "/permissions", "/docs", "/settings", "/changelog") or path.startswith("/changelog/"):
                self.path = "/index.html" if path != "/" else "/"
            super().do_GET()

    def log_message(self, *_):
        pass


def button(page, title):
    return page.get_by_role("button", name=title, exact=True)


def heading(page, title):
    return page.get_by_role("heading", name=title, exact=True)


server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Preview, directory=args.web_export))
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f"http://127.0.0.1:{server.server_port}"
shots = []

with sync_playwright() as browser_tools:
    browser = browser_tools.chromium.launch()
    for kind, width, height in (("desktop", 1280, 800), ("mobile", 390, 844)):
        context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
        context.route("**/*", lambda route: route.continue_() if route.request.url.startswith(origin+"/") else route.abort())
        page = context.new_page()
        page.set_default_timeout(7000)
        page.goto(origin)
        button(page, "Open web app").click()
        expect(heading(page, "Your X-Center ID")).to_be_visible()
        button(page, "Continue").click()
        expect(heading(page, "Connect your apps")).to_be_visible()
        button(page, "Back").click()
        expect(heading(page, "Your X-Center ID")).to_be_visible()
        page.reload()
        expect(heading(page, "Your X-Center ID")).to_be_visible()
        button(page, "Skip").click()
        expect(page.get_by_role("dialog")).to_have_count(0)
        page.reload()
        expect(page.get_by_role("dialog")).to_have_count(0)

        for feature, path, title in (
            ("overview", "dashboard", "Good evening, Robin"),
            ("apps", "apps", "Apps using X-Center ID"),
            ("permissions", "permissions", "Permissions"),
            ("developers", "docs", "Develop with X-Center ID"),
        ):
            page.goto(origin+"/"+path)
            if feature == "overview":
                expect(page.get_by_text("Robin Green", exact=True)).to_be_visible()
            elif feature == "developers":
                expect(page.locator("h1")).to_be_visible()
            else:
                expect(heading(page, title).first).to_be_visible()
            if feature in ("apps", "permissions"):
                expect(page.get_by_text("Garden Journal", exact=True).first).to_be_visible()
            page.evaluate("document.fonts.ready")
            name = f"{kind}-{feature}.png"
            page.screenshot(path=args.output / name, animations="disabled")
            shots.append({"file": name, "platform": "web", "deviceClass": kind,
                          "feature": feature, "width": width, "height": height,
                          "environment": "Chromium with isolated fixture"})

        page.evaluate("localStorage.setItem('authnjs.dashboard.lastRelease','0.11.0')")
        page.goto(origin+"/dashboard")
        expect(heading(page, f"What’s new in {version}")).to_be_visible()
        expect(page.get_by_role("dialog").get_by_role("listitem")).to_have_count(3)
        page.reload()
        expect(heading(page, f"What’s new in {version}")).to_be_visible()
        page.get_by_role("button", name="Full changelog", exact=True).click()
        expect(page.locator("h1")).to_contain_text(version)
        page.goto(origin+"/dashboard")
        expect(page.get_by_role("dialog")).to_have_count(0)
        page.goto(origin+"/changelog/0.10.0")
        expect(page.locator(".xc-release-rows li")).to_have_count(4)
        page.goto(origin+"/settings#release-notes=0.10.0")
        expect(heading(page, "Developer notes for 0.10.0")).to_have_count(0)
        for _ in range(3):
            button(page, version).click()
        expect(heading(page, "Developer notes for 0.10.0")).to_be_visible()
        page.goto(origin+"/changelog")
        expect(page.locator(".xc-release-entry")).to_have_count(15)
        page.evaluate("navigator.serviceWorker.ready")
        context.set_offline(True)
        page.goto(origin+"/changelog/0.10.0")
        expect(page.locator("h1")).to_contain_text("0.10.0")
        context.close()
    browser.close()

revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True).strip()
(args.output / "manifest.json").write_text(json.dumps({
    "version": version, "sourceRevision": revision, "capturedOn": date.today().isoformat(), "screenshots": shots,
}, indent=2) + "\n")
