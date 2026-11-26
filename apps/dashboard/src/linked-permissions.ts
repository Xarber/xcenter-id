export const permissionLabels = {
  profile: 'Account ID, name, username and profile photo',
  app_data: 'Private app storage',
  email: 'Email address',
  age_range: 'Age range',
  friends: 'Friends list',
  account_manage: 'Manage account settings',
  account_overview: 'Account overview',
  offline_access: 'Stay signed in',
  files_read: 'Read account files',
  files_write: 'Read and write account files',
  shared_files_read: 'Read files shared with you',
};

export type LinkedPermission = {
  scope: keyof typeof permissionLabels;
  required: boolean;
  enabled: boolean;
  canEnable: boolean;
  address?: string;
};

export const administrativePermission = (item: LinkedPermission) =>
  item.scope === 'account_manage' || item.scope === 'account_overview';

export const riskyPermission = (scope: LinkedPermission['scope']) =>
  scope === 'account_manage' || scope === 'files_write';

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
  if (permission.scope === 'account_overview') return 'See storage usage and the number of connected apps.';
  if (permission.scope === 'account_manage') return 'Read linked app permissions, turn off optional grants, and change which parts of your profile are public.';
  if (permission.scope === 'files_write') return 'List, download, add and delete your account files and folders.';
  if (permission.scope === 'offline_access') return 'Let the app renew your session.';
}
