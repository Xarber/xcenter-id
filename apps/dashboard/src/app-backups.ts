export const backupFileModes = {
  none:'No files',
  all:'All app files',
  browseable:'Browseable files',
  editable:'Browseable and editable files',
} as const;
export type BackupFileMode = keyof typeof backupFileModes;
export type BackupSelection = {records:string[]|null;files:BackupFileMode};
export const backupSelectors=(text:string)=>text.split(/[,\n]/).map(value=>value.trim()).filter(Boolean);

export type BackupPolicy = {version:number;restore:boolean;selection:BackupSelection};
export type Backup = {id:string;version:number;created:number;bytes:number;records:number;files:number;appCreated:boolean;requested:number|null;selection:BackupSelection};
export type Backups = {policy:BackupPolicy|null;allowApp:boolean;snapshots:Backup[]};

export function canRestore(policy:BackupPolicy|null,backup:Backup) {
  return !!policy?.restore&&policy.version===backup.version&&
    JSON.stringify(policy.selection)===JSON.stringify(backup.selection);
}
