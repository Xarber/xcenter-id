export function mailClientSettings(username?:string) {
  return [
    ['Server','mail.xcenter.it'],
    ['Username',username ? username+'@mail.xcenter.it' : 'Your primary X-Center ID mailbox address'],
    ['Password','The password generated for this mail client'],
    ['Connection security','SSL/TLS for incoming and outgoing'],
    ['Incoming (IMAP)','993'],
    ['Outgoing (SMTP)','465 · Authentication required'],
  ];
}
