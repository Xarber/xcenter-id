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
      permission.enabled ? 'This app requires this info to work.' : 'If the app needs a new address, unlink it and link it again.',
    ].filter(Boolean).join(' · ');
  }
  if (permission.scope === 'email') {
    return permission.address ?? (!permission.canEnable ? 'Unlink and link this app again to choose a verified address.' : undefined);
  }
  if (permission.scope === 'offline_access') return 'Let the app renew your session.';
}
