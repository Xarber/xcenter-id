"""Generate AltStore Classic metadata for a verified X-Center ID IPA."""

import argparse
import hashlib
import json
import plistlib
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import ZipFile


def generate(ipa, release):
    if release["state"] != "Verified" or not re.fullmatch(r"[0-9a-f]{40}", release["commit"]):
        raise ValueError("Release validation and full source commit are required.")
    if release["channel"] not in {"stable", "beta"}:
        raise ValueError("Choose a stable or beta release receipt.")
    url = urlsplit(release["downloadURL"])
    if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment or not url.path.endswith(".ipa"):
        raise ValueError("A permanent HTTPS IPA URL is required.")
    date.fromisoformat(release["date"])
    with ipa.open("rb") as file:
        if hashlib.file_digest(file, "sha256").hexdigest() != release["sha256"]:
            raise ValueError("IPA checksum does not match the release receipt.")
    with ZipFile(ipa) as archive:
        manifests = [name for name in archive.namelist() if re.fullmatch(r"Payload/[^/]+\.app/Info\.plist", name)]
        if len(manifests) != 1:
            raise ValueError("Expected one device app in the IPA.")
        with archive.open(manifests[0]) as file:
            app = plistlib.load(file)
    bundle = app["CFBundleIdentifier"]
    if bundle != "com.xarber.authnjs.dashboard" or app.get("CFBundleSupportedPlatforms") != ["iPhoneOS"]:
        raise ValueError("IPA platform or bundle identity does not match X-Center ID.")
    if app["CFBundleShortVersionString"] != release["version"] or app["CFBundleVersion"] != release["buildVersion"]:
        raise ValueError("IPA version or build does not match the receipt.")
    permissions = release["entitlements"]
    if not isinstance(permissions, list) or any(not isinstance(key, str) for key in permissions):
        raise ValueError("A validated entitlement list is required.")
    if not release["notes"].strip():
        raise ValueError("Release notes are required.")
    icon = "https://id.xcenter.it/authnjs-512.png"
    name = "X-Center ID" + (" Beta" if release["channel"] == "beta" else "")
    return {
        "name": name,
        "website": "https://id.xcenter.it",
        "iconURL": icon,
        "tintColor": "#526DFF",
        "apps": [{
            "name": "X-Center ID",
            "bundleIdentifier": bundle,
            "developerName": "Xarber",
            "iconURL": icon,
            "localizedDescription": "Manage your X-Center account, passkeys, app permissions, files and mail.",
            "category": "utilities",
            "appPermissions": {
                "entitlements": permissions,
                "privacy": {key: value for key, value in app.items() if key.endswith("UsageDescription")},
            },
            "versions": [{
                "version": app["CFBundleShortVersionString"],
                "buildVersion": app["CFBundleVersion"],
                "minOSVersion": app["MinimumOSVersion"],
                "date": release["date"],
                "downloadURL": release["downloadURL"],
                "localizedDescription": release["notes"],
                "size": ipa.stat().st_size,
            }],
        }],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ipa", type=Path)
    parser.add_argument("receipt", type=Path)
    args = parser.parse_args()
    print(json.dumps(generate(args.ipa, json.loads(args.receipt.read_text())), indent=2))
