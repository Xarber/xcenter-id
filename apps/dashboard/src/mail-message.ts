export type MailMessage = {badges?:{verified:boolean;admin:boolean};
  from: string;
  subject: string;
  text: string;
  attachments: { index: number; name: string; size: number }[];
};

export type PrivateAddress = {address:string;client:string;active:boolean;premium:boolean};
