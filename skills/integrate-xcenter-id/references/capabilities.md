# Choose the X-Center ID capabilities your app needs

Start with the [sign-in contract](integration.md). Request only the scopes needed for the feature. These capabilities work over HTTPS from any stack. The [public developer guide](https://id.xcenter.it/docs#manual) explains provider discovery and callback exchange.

| Goal | Use |
| --- | --- |
| Sign in to your product | Request `openid`. Validate the token and keep a product session keyed by issuer and pairwise subject. |
| Show a user's name, email, or age band | Request `profile`, `email`, or `age_range` as needed. Read authorized claims through discovered UserInfo. Email is optional and can be a Hide My Email address. Age band is self-declared. |
| Store product-wide records | Use the app's backend key in its dedicated app-owned namespace. |
| Store data belonging to one signed-in user | Use that app's user access token with `app_data`. |
| Let users browse and share personal files | Direct them to Files or Friends in the X-Center dashboard. A third-party app token cannot access the account's file cabinet. |
| Read data offered by a different app | Configure exact source collections, obtain consent, then read the authorized source collection. |
| Present an opted-in public profile or record | Use the documented public profile or public record endpoint. |

## Dedicated app storage

Activate the registration and obtain app verification from an administrator. Open **Developer → your app → Manage app storage**. For backend-owned content such as app configuration or a catalog, generate a backend key after the passkey prompt. Save it once to the backend's secret store. Only the backend uses this key. Rotating or revoking it ends access for the old key. It cannot impersonate a user.

Create a private record with a stable ID. The example uses shell environment variables populated locally by the integrator. Keep them out of logs.

```sh
curl --fail-with-body -X PUT \
  "https://id.xcenter.it/v1/apps/${CLIENT_ID}/data/config/defaults" \
  -H "Authorization: Bearer ${APP_STORAGE_KEY}" \
  -H 'Content-Type: application/json' -H 'If-Match: "0"' \
  --data '{"data":{"theme":"system"},"public":false}'
```

Use `GET` on the same URL to read it. List a collection with `GET /v1/apps/CLIENT_ID/data/config`. Pass the returned `nextCursor` as `cursor` when present. For replacement or deletion send the current quoted revision in `If-Match`. If a write conflicts, reload the record and resolve the conflict before retrying. Payloads are bounded JSON with a 60 KB limit. App quotas are shared by all that app's records and do not reserve disk space.

## User storage inside an app

Request `openid app_data` via consent and use the returned **access token** for the same record API. For example, send `PUT /v1/apps/CLIENT_ID/data/preferences/layout` with the user's bearer token, `If-Match: "0"`, and `{"data":{"density":"compact"},"public":false}`. The service determines the owner and app from the token. Do not send an owner ID or fall back to the backend key when the user declines access. The same collection and record ID can independently exist in each user's namespace and in the app-owned namespace.

To share a record with a recipient in the same app, add `"readers":["recipientusername"]` to the owner’s record write. The recipient must already have linked the app. They receive read access and may see an opaque record ID. Send a new revision with a reduced reader list to revoke access. For anonymous reading, explicitly write `"public":true`; browse through `GET /public/apps/CLIENT_ID/data/COLLECTION`. Only use that flag for data intended for public disclosure.

## Cross-app sharing and incremental consent

1. The source publisher enables a collection, such as `places`, in its database settings.
2. The destination publisher declares a request with `source` set to the source client ID, `collection` set to `places`, and a clear `label` describing the reason.
3. The destination initiates sign-in with `app_data`. Use `prompt=consent` when requesting additional permissions from an already-linked account. The user chooses each permission on the issuer screen.
4. After consent, call `GET /v1/apps/SOURCE_CLIENT_ID/data/places` using the **destination's user access token**. This returns only the authorized user's own authored records in the offered collection. The destination cannot edit that source, see incoming private shares, or use app-owned backend records through this grant.
5. Handle access denial and revocation in the app. After unlink, a revoked grant, app restriction, or removal of a collection's sharing offer, stop using the affected data and follow the product's retention policy.

UserInfo, hosted storage and public routes are the supported third-party interfaces. `/account/*` endpoints are for the X-Center dashboard, including personal files, Friends invitations, email/alias management, developer settings and database administration. Use those screens for user-owned account actions. Do not embed dashboard credentials, forward dashboard cookies or call its management routes from another app.

Public profiles are separate from OIDC claims. `GET /public/profiles/USERNAME` returns only fields the user opted into and the avatar URL when published. Use OIDC claims for the signed-in account and never infer private fields from public availability. See [hosted data](https://id.xcenter.it/docs#hosted-data) for interface limits.
