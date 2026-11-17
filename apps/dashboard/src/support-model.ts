export type SupportRequest = {id:string;received:number;external:number;replied:number|null};
export type SupportMessage = {subject:string;sender:string;text:string;canReply:boolean;external:boolean};
export type ManagedAccount = {username:string;locked:boolean;protected:boolean;premium:boolean;capacity:number};
