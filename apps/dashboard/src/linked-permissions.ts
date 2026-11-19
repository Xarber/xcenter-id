export const permissionLabels = {
  profile: 'Account ID, name, username and profile photo',
  app_data: 'Private app storage',
  email: 'Email address',
  age_range: 'Age range',
  friends: 'Friends list',
  offline_access: 'Stay signed in',
};

export type LinkedPermission = {
  scope: keyof typeof permissionLabels;
  required: boolean;
  enabled: boolean;
  canEnable: boolean;
  address?: string;
};

export const linkedPermissionPath = (client: string) =>
  'connected-apps/' + encodeURIComponent(client) + '/permissions';

export function permissionDescription(permission: LinkedPermission) {
  if (permission.required) {
    return [
      permission.address,
      permission.enabled ? 'This app requires this info to work.' : 'Sign in to the app again to grant required access.',
    ].filter(Boolean).join(' · ');
  }
  if (permission.scope === 'email') {
    return permission.address ?? (!permission.canEnable ? 'Choose an address when you next authorize this app.' : undefined);
  }
  if (permission.scope === 'offline_access') return 'Let the app renew your session.';
}
