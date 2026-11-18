# Dashboard polish review

| Before | After | Why |
| --- | --- | --- |
| Checkbox inherited the full input width and height | Compact checkbox with a full row label | Touch target stays large and the indicator stays beside its label |
| Focus within a label drew an outline around the entire control group | Pointer focus is quiet and keyboard focus is indicated on the control | Keeps keyboard navigation visible |
| Authorized sample connections disappeared from both lists | Display the accounts' existing linked apps with a permissions destination | The person who linked the app can review and revoke it |
| Intro was one card | Four steps with matching web and native content | Explain the account, linking, consent and developer setup separately |
| Mail rows showed date and size | Subject, sender, excerpt and time | Mail can be scanned before opening |
| Mail formatting and attachment options were separate form rows | Icon toolbar next to the message | Formatting remains on the existing escaped message path |
| Sharing directions were headings in a single card | Incoming and outgoing file cards | Clarifies who can access each file |

Animation opportunity audit based on source inspection. Onboarding is rare and benefits from explanation, so web uses a 200 ms entrance with opacity and scale and native uses a 200 ms opacity transition with Reanimated. Both follow reduced motion preferences. Friend invitation dialogs reuse the web entrance and the native modal. Checkbox and navigation changes stay immediate because they are frequent. A composer entrance could add spatial continuity with a 200 ms opacity and subtle scale transition, but submission, text selection and keyboard input should stay instant. No native motion or physical device testing was performed.

Checks include 31 API tests, four dashboard tests, TypeScript and web export. Isolated Chrome used synthetic passkeys at 390 px and verified a registered OIDC link, Apps and Permissions, invite creation, onboarding navigation and horizontal fit of the manual developer guide. The inbox preview and friend-request ownership have API regression coverage. A full production and installed-device review remains open.

The follow-up applies the proposed composer entrance using the same 200 ms opacity and scale transition as the introduction. Reduced Motion opens the sheet immediately. Profile settings now have dedicated pages, app storage prompts for a passkey when a protected action is submitted, and invite links retain their destination across sign-in. Checkbox rows override the stacked form label style.
