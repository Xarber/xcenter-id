export type SupportRequest = {id:string;received:number;external:number;replied:number|null};
export type SupportMessage = {subject:string;sender:string;text:string;canReply:boolean;external:boolean};
export type ManagedAccount = {username:string;hasPicture?:boolean;locked:boolean;protected:boolean;premium:boolean;capacity:number};
export type UsernameRequest = {id:string;previous?:string;proposed:string;confirmed?:number;expires:number};
