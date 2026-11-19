import {accountMessage} from './account-mail.mjs';
import nodemailer from 'nodemailer';
export function createSupportMailer(config,limits){
 if(!config)return null;
 const transport=nodemailer.createTransport({host:config.host,port:config.port??465,secure:(config.port??465)===465,requireTLS:true,
  auth:{user:config.user,pass:config.password},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:12000,disableFileAccess:true,disableUrlAccess:true});
 return async(owner,to,subject,text)=>{
  if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(to)||/[\r\n\0]/.test(subject)||subject.length>120||text.length>3000)throw new Error('Invalid support reply');
  if(limits&&!limits.reserve(owner))throw new Error('External mail allowance reached');
  await transport.sendMail({from:'X-Center Support <support@id.xcenter.it>',to,subject,...accountMessage({title:'Reply from X-Center Support',paragraphs:[text]}),headers:{'Auto-Submitted':'auto-replied'}});
 };
}
