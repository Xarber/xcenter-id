# Navigation and preferences

The account manager groups its main screens as Account, Apps and Settings, with Admin present only for an administrator. All detailed pages remain available in the sidebar. Native uses a drawer and bottom tabs; web keeps a desktop sidebar and uses a drawer plus bottom bar at compact widths. Normal account/app navigation resets temporary Developer Options access. Native foreground refresh and ordinary web navigation pick up current administrator permissions without requiring a new login.

Settings includes persistent language, system/light/dark theme, introduction, support and developer documentation. The shared preference schema lives in `src/preferences.ts`; web uses browser storage and native uses AsyncStorage. Browser settings failure falls back to system preferences. Language selection uses the existing six-language catalog, whose remaining untranslated copy stays documented as outstanding localization rather than claiming full translation.

Profile is read-only until Edit is selected. Connected form groups use a dedicated page or disclosure. Native username, email and public-profile controls are grouped behind their own actions. App registration/settings have separate controls from the app list. Admin actions retain icons and now show visible names, with consequences explained in the user page. Search fields remain available as primary search tools.

Connected apps use their configured image or a default app icon. Historical example clients are excluded from normal app lists. The sample directory requires an account session and its entry is inside the hidden three-tap version menu. External sample origins are disabled by default; the explicit `AUTHNJS_PUBLIC_SAMPLE_APPS=true` option is for isolated development environments and must not be enabled on production. Existing sample code/data is preserved.

Developer documentation is public at `/docs` and explains actual package distribution, registration, callback ownership, token validation and hosted data. The SDK is not published to a public npm registry. See INTEGRATION.md and HOSTED_DATA.md.

Web drawer motion respects Reduced Motion; native presents a short system modal transition and retains accessible labels and selected tab state. Native device execution, screen-reader review and full dynamic-text validation require separate runtime evidence.

On native, Devices opens a separate **Device sign-in** page with an on-demand QR scanner and six visible code slots. The slots use one input per platform so a full code can be pasted or entered with a screen reader. Entering or scanning a code opens review only after an explicit action. The issuer still shows the requesting app and requires confirmation before approving the sign-in. The web device page preserves its standard form and server-side confirmation.
