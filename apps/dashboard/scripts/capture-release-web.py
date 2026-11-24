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
history_count = len(json.loads((repo / "apps/dashboard/src/release-history.json").read_text()))
app = {"client": "garden-journal", "label": "Garden Journal", "name": "Garden Journal",
       "verified": True, "description": "Keep a record of what you grow."}
fixtures = {
    "/account/me": {"account": {"name": "Robin Green", "verified": True,
        "profile": {"username": "robingreen", "givenName": "Robin", "surname": "Green", "hasPicture": False},
        "passkeys": [{"id": "sample", "label": "Laptop", "created": 1750000000000}], "emails": []}},
    "/account/apps": {"apps": [app]},
    "/account/switcher": {"accounts": [
        {"slot": 0, "current": True, "username": "robingreen", "givenName": "Robin", "surname": "Green", "hasPicture": False},
        {"slot": 1, "current": False, "username": "rowanavery", "givenName": "Rowan", "surname": "Avery-Montgomery-Wellington",
         "hasPicture": False},
    ]},
    "/account/connected-apps": {"apps": [app]},
    "/account/data-grants": {"grants": []},
    "/account/app-data-permissions": {"permissions": [
        {"source": "greenhouse", "destination": app["client"], "collection": collection, "label": label,
         "sourceName": "Greenhouse", "destinationName": app["name"], "enabled": enabled}
        for collection, label, enabled in (("plants", "Read plants", True), ("notes", "Read notes", False))
    ]},
}

registration = {
    "id": "18b0cb52-e0c5-4a97-9ac6-ecb51cb85669", "name": "Garden Journal", "status": "active",
    "client": app["client"], "description": "Keep a record of what you grow.", "verified": True,
    "callback": "https://garden.example.test/callback", "callbacks": ["https://garden.example.test/callback"],
    "icon": None, "requirements": {"email": False, "age_range": False},
}
configuration_path = "/account/developer/apps/" + registration["id"] + "/configuration"
app_storage_path = "/account/app-storage/" + registration["id"]
configuration = {
    "version": 1,
    "profile": {key: registration[key] for key in ("name", "description", "callbacks", "icon")} | {"repository": ""},
    "requirements": registration["requirements"],
    "access": {"private": False, "allowRequests": False, "readerTrust": "secure"},
    "storage": {"shared": [], "requests": [], "showInFiles": False},
}
folder_path = "/account/files/folders/08518242-bc8a-4842-a888-dea54dd47db4"
fixtures.update({
    "/account/developer/apps": {"apps": [registration]},
    "/account/developer/apps/" + registration["id"] + "/access": {"members": [], "private": False, "requests": False, "readerTrust": "secure"},
    configuration_path: {"configuration": configuration, "revision": "fixture-revision"},
    app_storage_path: {
        "name": app["name"], "verified": True, "used": 0, "records": 0, "capacity": 10 * 1024 ** 2, "shared": [], "requests": [],
        "sources": [{"name": "Greenhouse", "client": "greenhouse", "collections": ["plants", "notes"]}],
    },
    "/account/session/access": {"confirmed": True},
    "/account/username-change": {"request": None},
    "/account/files": {"files": [], "folders": [{"name": "Archive", "id": folder_path.rsplit("/", 1)[-1]}],
                       "breadcrumbs": [], "categories": {}, "used": 0, "total": 0, "limit": 10 * 1024 ** 2},
})


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
            if path in ("/", "/dashboard", "/apps", "/permissions", "/docs", "/settings", "/changelog") or path.startswith(("/changelog/", "/permissions/")) or path in ("/signin", "/signup", "/developer", "/files", "/profile/username") or path.startswith("/developer/storage/"):
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
        signed_in = False
        mutations = []
        def route_fixture(route):
            path = urlsplit(route.request.url).path
            if route.request.url.startswith(origin+"/") and route.request.method in ("POST", "PUT", "DELETE"):
                mutations.append((path, route.request.post_data_json if route.request.post_data else None))
                if path == "/account/login/username":
                    route.fulfill(json={"method": "passkey"})
                elif path == "/account/signup/options":
                    route.fulfill(status=422, json={"error": "Fixture stopped before passkey creation."})
                elif path == configuration_path:
                    route.fulfill(json={"configuration": mutations[-1][1]["configuration"], "revision": "saved"})
                else:
                    route.fulfill(json={"ok": True})
                return
            if not route.request.url.startswith(origin+"/"):
                route.abort()
            elif route.request.url == origin+"/account/me" and not signed_in:
                route.fulfill(json={"account": None})
            elif route.request.url == origin+"/account/switcher" and not signed_in:
                route.fulfill(json={"accounts": []})
            else:
                route.continue_()
        context.route("**/*", route_fixture)
        page = context.new_page()
        page.set_default_timeout(7000)
        page.goto(origin)
        expect(heading(page, "Sign in to X-Center ID")).to_be_visible()
        expect(page.get_by_role("dialog")).to_have_count(0)
        expect(button(page, "Pause animation")).to_have_count(0)
        constell = page.locator(".xc-auth-desktop-art")
        if kind == "desktop":
            expect(constell).to_be_visible()
            distances = page.locator(".xc-constellation").evaluate("""(orbit) => {
                const bounds = orbit.getBoundingClientRect();
                return Array.from(orbit.querySelectorAll(".xc-service"), tile => {
                    const icon = tile.getBoundingClientRect();
                    return Math.hypot(icon.x + icon.width / 2 - bounds.x - bounds.width / 2,
                        icon.y + icon.height / 2 - bounds.y - bounds.height / 2) / bounds.width;
                });
            }""")
            assert len(distances) == 6 and all(abs(distance - .305) < .003 for distance in distances)
        else:
            expect(constell).to_be_hidden()
        assert page.locator(".xc-auth-night").evaluate("(e)=>getComputedStyle(e,'::after').animationName") == 'none'
        page.emulate_media(reduced_motion="no-preference")
        assert page.locator(".xc-auth-night").evaluate("(e)=>getComputedStyle(e,'::after').animationName") == 'xc-star-shimmer'
        assert page.locator(".xc-auth-night").evaluate("(e)=>getComputedStyle(e,'::before').position") == 'fixed'
        page.emulate_media(reduced_motion="reduce")
        username = "3.a_b-c"
        page.get_by_label("X-Center username").fill(username)
        button(page,"Continue").click()
        expect(button(page,"Use passkey")).to_be_visible()
        assert mutations[-1][1]["username"] == username
        page.goto(origin+"/signup")
        page.get_by_label("X-Center username").fill(username)
        assert page.get_by_label("X-Center username").evaluate("(field) => field.checkValidity()")
        signed_in = True
        page.goto(origin)
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
            ("overview", "dashboard", "Hello, Robin"),
            ("apps", "apps", "Apps using X-Center ID"),
            ("permissions", "permissions", "Permissions"),
            ("developers", "docs", "Develop with X-Center ID"),
        ):
            page.goto(origin+"/"+path)
            if feature == "overview":
                expect(heading(page, title)).to_be_visible()
            elif feature == "developers":
                expect(page.locator("h1")).to_be_visible()
            else:
                expect(heading(page, title).first).to_be_visible()
            if feature in ("apps", "permissions"):
                expect(page.get_by_text("Garden Journal", exact=True).first).to_be_visible()
            if feature == "permissions":
                link = page.locator(".xc-permission-link").bounding_box()
                chevron = page.locator(".xc-permission-chevron").bounding_box()
                assert 15 <= link["x"] + link["width"] - chevron["x"] - chevron["width"] <= 19
            page.evaluate("document.fonts.ready")
            name = f"{kind}-{feature}.png"
            page.screenshot(path=args.output / name, animations="disabled")
            shots.append({"file": name, "platform": "web", "deviceClass": kind,
                          "feature": feature, "width": width, "height": height,
                          "environment": "Chromium with isolated fixture"})

        page.goto(origin+"/dashboard")
        if kind == "mobile":
            button(page, "Open page sidebar").click()
        button(page, "@robingreen").click()
        switcher=page.locator(".xc-sidebar-account>.xc-switcher-list")
        expect(switcher).to_be_visible()
        sidebar=page.locator(".xc-side").bounding_box()
        popup=switcher.bounding_box()
        assert popup["x"] >= sidebar["x"] and popup["x"] + popup["width"] <= sidebar["x"] + sidebar["width"] + 1
        page.get_by_role("link",name="Add another account").click()
        expect(heading(page,"Sign in to X-Center ID")).to_be_visible()
        page.goto(origin+"/permissions/"+app["client"])
        expect(heading(page,"Greenhouse")).to_have_count(1)
        expect(page.get_by_role("switch",name="Read plants · Greenhouse")).to_have_attribute("aria-checked","true")
        expect(page.get_by_role("switch",name="Read notes · Greenhouse")).to_have_attribute("aria-checked","false")
        for label in ("Read plants", "Read notes"):
            expect(page.get_by_role("switch", name=f"{label} · Greenhouse").locator("span")).to_be_visible()
        expect(page.get_by_text("No outgoing data access.")).to_be_visible()
        page.goto(origin+"/profile/username")
        page.get_by_label("New username").fill(username)
        button(page,"Request change").click()
        page.wait_for_function("() => !document.querySelector('.xc-inline-form button')?.disabled")
        assert mutations[-1] == ("/account/username-change", {"action": "request", "username": username})

        page.goto(origin+"/files")
        remove = button(page,"Remove folder Archive")
        remove.click()
        dialog = page.get_by_role("dialog")
        expect(dialog).to_contain_text("Archive")
        expect(dialog.get_by_role("button",name="Cancel")).to_be_focused()
        page.keyboard.press("Escape")
        expect(dialog).to_have_count(0)
        expect(remove).to_be_focused()
        assert not any(path == folder_path for path, _ in mutations)
        remove.click()
        dialog.get_by_role("button",name="Confirm").click()
        expect(page.get_by_text("Folder and contents removed.")).to_be_visible()
        assert mutations[-1][0] == folder_path

        page.goto(origin+"/developer/storage/"+registration["id"])
        button(page,"Edit database settings").click()
        button(page,"Add permission").click()
        page.get_by_label("Source app").select_option("greenhouse")
        page.get_by_label("Collection",exact=True).select_option("plants")
        page.get_by_label("Permission name").fill("read_plants")
        page.get_by_label("Title",exact=True).fill("Read plants")
        page.get_by_label("Description").fill("Show your plants in the journal")
        page.get_by_label("Icon",exact=True).select_option("folder")
        button(page,"Save sharing settings").click()
        expect(page.get_by_text("Saved.",exact=True)).to_be_visible()
        assert mutations[-1][0] == app_storage_path
        assert mutations[-1][1]["requests"] == [{
            "source":"greenhouse", "collection":"plants", "label":"Read plants",
            "name":"read_plants", "description":"Show your plants in the journal", "icon":"folder",
        }]
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")

        page.goto(origin+"/developer?app="+registration["id"])
        button(page,"App configuration").click()
        editor = page.get_by_label("Configuration JSON")
        expect(editor).to_be_visible()
        expect(button(page,"Copy app configuration")).to_be_visible()
        editor.fill("{")
        button(page,"Format JSON").click()
        expect(page.get_by_text("Enter a valid JSON object.")).to_be_visible()
        updated = json.loads(json.dumps(configuration))
        updated["profile"]["callbacks"].append("https://garden.example.test/second")
        editor.fill(json.dumps(updated))
        button(page,"Format JSON").click()
        button(page,"Apply configuration").click()
        dialog = page.get_by_role("dialog",name="Apply this configuration?")
        dialog.get_by_role("button",name="Apply configuration").click()
        expect(page.get_by_text("Configuration saved.")).to_be_visible()
        assert mutations[-1] == (configuration_path, {"configuration":updated,"revision":"fixture-revision","confirmUnsecure":False})
        name = f"{kind}-app-configuration.png"
        page.screenshot(path=args.output / name, animations="disabled")
        shots.append({"file": name, "platform": "web", "deviceClass": kind, "feature": "app-configuration",
                      "width": width, "height": height, "environment": "Chromium with isolated fixture"})
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
        expect(button(page, "Developer notes")).to_have_count(0)
        page.goto(origin+"/settings")
        expect(page.get_by_role("switch", name="Developer Mode")).to_have_count(0)
        for _ in range(3):
            button(page, version).click()
        page.get_by_role("switch", name="Developer Mode").check()
        button(page, "Open Developer Options").click()
        expect(heading(page, "Developer Options")).to_be_visible()
        button(page, "Back to Settings").click()
        expect(page.get_by_role("switch", name="Developer Mode")).to_have_count(0)
        page.get_by_role("link", name="View changelog").click()
        expect(page.locator(".xc-release-entry")).to_have_count(history_count)
        page.locator(".xc-release-entry").filter(has_text="0.10.0").get_by_role("link", name="Full changelog").click()
        button(page, "Developer notes").click()
        expect(heading(page, "Developer notes for 0.10.0")).to_be_visible()
        expect(page.get_by_role("button",name="Copy source revision")).to_be_visible()
        page.get_by_role("link", name="Back", exact=True).click()
        expect(heading(page, "Version history")).to_be_visible()
        brand=page.locator(".xc-changelog .xc-brand").bounding_box()
        back=page.get_by_role("link", name="Back", exact=True).bounding_box()
        assert back["y"] >= brand["y"] + brand["height"] + 10
        page.get_by_role("link", name="Back", exact=True).click()
        expect(heading(page, "Settings")).to_be_visible()
        page.get_by_role("link", name="View changelog").click()
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
