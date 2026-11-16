# X-Center ID integration

Use OpenID Connect Authorization Code with PKCE S256. Register an HTTPS callback in the developer portal, then add the requested public TXT record for that host. Activation returns a unique client ID and one-time client secret. Store the secret on the application's backend. Perform code exchange server-to-server and validate the issuer, state, nonce, audience and signatures using a maintained OIDC client. Never ship confidential credentials in JavaScript, iOS or Android app bundles.

Request `openid` for a stable app-specific subject. Request `profile` for display name, given name and surname. Request `age_range` for the self-declared child, teen or adult band, and `email` to prompt the user to choose a verified address or an available Hide My Email alias. Identity is available through the UserInfo endpoint returned by discovery. An email is optional. Use the validated issuer and subject to associate an app account. Never treat the age band as proof of age.

A developer registration describes the app and verifies control of its callback domain. It does not grant its backend access to another app. Request `app_data` for data operations and use the supported records API. The account owner controls read grants in X-Center ID. Revoking a developer app disables client lookup and subsequent data access. Revoking a user grant blocks subsequent cross-app reads. A recipient may retain copies already imported.

The two sample sites use independent confidential clients and separate datasets. They demonstrate actual OIDC signin, pairwise subjects, app-local notes, owner-controlled read grants, and a shared folder scoped to the user's sample data. Use fictional values in both apps.
