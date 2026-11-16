# X-Center AuthNJS preview

The private web preview is available to the tailnet at [AuthNJS preview](https://xcenter-main-server-acer.tail91c405.ts.net:8443/). The deployed revision is available at [revision.txt](https://xcenter-main-server-acer.tail91c405.ts.net:8443/revision.txt).

- Ubuntu appliance `xcenter-appliance`, shared ext4 application mount under `/srv/xcenter/apps`.
- Static exports are stored in `/srv/xcenter/apps/authnjs-preview/releases/<revision>`. An atomic `current` symlink selects the active directory. Only the static export is served.
- The `authnjs-preview.service` unit uses an unprivileged dynamic account, binds to loopback port 18788, and depends on the storage target. Tailscale Serve provides HTTPS on tailnet port 8443.
- Roll back by atomically pointing `current` at the previous release. Disable only this preview with `tailscale serve --https=8443 off` and `systemctl disable --now authnjs-preview.service`.
- Loopback and tailnet HTTPS returned the expected revision. Initial HTTPS requests timed out while the certificate was being issued. The certificate subsequently became available.
- The preview contains synthetic dashboard data. A live identity provider, BFF, database deployment and production secrets are separate pending work. No other services were restarted. Appliance reboot and alternate-host validation were not performed.
