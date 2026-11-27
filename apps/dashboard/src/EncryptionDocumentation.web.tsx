import {ArrowLeft, Database, KeyRound, LockKeyhole, ShieldCheck} from 'lucide-react';

export default function EncryptionDocumentation(){
  return <main className="xc-main xc-docs" style={{maxWidth:900}}>
    <a className="xc-text-link" href="/docs"><ArrowLeft size={16}/> Developer documentation</a>
    <h1>Encryption and Advanced Data Protection</h1>
    <p>Standard storage uses server-managed encryption. Advanced Data Protection (ADP) is a separate, opt-in design with a client-encrypted pilot. ADP is currently unavailable to production accounts.</p>
    <section className="xc-card xc-pad xc-stack" id="standard-encryption">
      <div className="xc-row-head"><LockKeyhole size={20}/><h2>Standard encryption</h2></div>
      <p>Production APIs use HTTPS. The service encrypts hosted record payloads, uploaded file content and file-transfer chunks at rest with AES-256-GCM. It checks app and account permissions before returning decrypted content. The encrypted storage also covers profile and mailbox payloads.</p>
      <p>Identifiers, quotas, timestamps, routing data and permission indexes can remain visible to the service. Public fields and records are readable through the public API only when explicitly published. External mail follows standard email transport and delivery rules.</p>
    </section>
    <section className="xc-card xc-pad xc-stack" id="trusted-devices">
      <div className="xc-row-head"><KeyRound size={20}/><h2>Trusted devices and recovery</h2></div>
      <p>ADP separates signing in from unlocking protected data. In the pilot, a client creates the vault key and stores an encrypted recovery envelope. A trusted device can approve a new device or grant a temporary browser access to one named collection. The issuer receives ciphertext and tightly scoped approval proofs.</p>
      <p>The planned recovery flow requires an enrolled device or the recovery key. X-Center ID sign-in and email recovery alone cannot unlock protected content. Device revocation is implemented in the pilot. Key rotation, native key custody, recovery verification and production migration are still in development.</p>
    </section>
    <section className="xc-card xc-pad xc-stack" id="app-compatibility">
      <div className="xc-row-head"><ShieldCheck size={20}/><h2>App compatibility</h2></div>
      <p>Developer Apps → Manage app storage → Edit database settings exposes <strong>This app supports protected storage</strong> for active secure registrations. The declaration defaults off. It records compatibility and does not enable ADP, move data or give an app encryption keys.</p>
      <p>Existing SDK sign-in, records and files continue to use standard storage. A future protected integration needs user consent and a supported protected-data interface. An app receives only the selected data it is allowed to use. The current public SDK does not provide production ADP reads or writes.</p>
    </section>
    <section className="xc-card xc-pad xc-stack" id="snapshots">
      <div className="xc-row-head"><Database size={20}/><h2>Backups and hashes</h2></div>
      <p>Existing app snapshots use standard encryption. The backup ID identifies one snapshot. Its SHA-256 fingerprints the captured manifest, including the policy and stored record/file versions. It is separate from the SHA-256 of an individual file’s bytes.</p>
      <a href="/docs/sdk/list-app-backups">Backup API and response fields</a>
    </section>
    <a href="https://github.com/Xarber/xcenter-id/blob/testing/docs/ADVANCED_DATA_PROTECTION.md">ADP design and pilot status</a>
  </main>;
}
