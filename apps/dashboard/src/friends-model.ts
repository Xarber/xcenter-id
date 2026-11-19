export type Friend = {id:string;avatar?:string|null; username:string; verified?:boolean; admin?:boolean};
export type SharedFile = {id:string;name:string;size:number;from?:string;to?:string};

export type SavedPlace = {label:string;latitude:number;longitude:number};
export type ShareablePlace = {id:string;value:SavedPlace};
export type FriendRecordIndex = {
  sources:{id:string;name:string}[];
  incoming:{id:string;username:string;value:SavedPlace}[];
  outgoing:{id:string;username:string;value:SavedPlace}[];
};
export const placeLabel = ({label,latitude,longitude}:SavedPlace) =>
  label+' · '+latitude.toLocaleString()+'°, '+longitude.toLocaleString()+'°';
