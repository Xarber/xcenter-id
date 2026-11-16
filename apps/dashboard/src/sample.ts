export type AccountItem = {
  id: string;
  title: string;
  detail: string;
};

export const sample = {
  credentials: [
    { id: 'platform', title: 'Platform passkey', detail: 'Passkey · Enrolled on this example account' },
    { id: 'hardware', title: 'Backup security key', detail: 'Physical FIDO2 key' },
  ],
  apps: [
    { id: 'places', title: 'Saved Places', detail: 'Source app · Publishes saved places' },
    { id: 'trips', title: 'Trip Planner', detail: 'Destination app · Reads saved places with permission' },
  ],
  sessions: [
    { id: 'phone', title: 'Phone', detail: 'Current example session' },
    { id: 'browser', title: 'Desktop browser', detail: 'Example session · Can be signed out' },
  ],
  grants: [
    { id: 'places-to-trips', title: 'Saved Places → Trip Planner', detail: 'Saved places · Read only' },
  ],
} satisfies Record<string, AccountItem[]>;
