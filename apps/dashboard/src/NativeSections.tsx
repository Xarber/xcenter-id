import { accountMessage } from './account-locale';
import { placeLabel, type Friend, type SharedFile, type FriendRecordIndex, type ShareablePlace } from './friends-model';
import { Ionicons } from '@expo/vector-icons';
import { accountShortcuts, accountStatus } from './account-overview';
import BirthdayPicker from './BirthdayPicker';
import type { MailMessage, PrivateAddress } from './mail-message';
import { pickDocumentAsync, pickProfilePhoto, shareDownload } from './native-files';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { AccountRequestError, accountHost, nativeRequest } from './native-account';
import { formatBytes, storageCategories } from './storage-summary';
import type { Account } from './web-account';
import DeveloperPortal from './DeveloperPortal';

type Device = {id:string;label:string;created:number;current:boolean};
type ConnectedApp = {client:string;label:string};
type Entry = {id:string;name:string;size:number};
type Files = {folders:Entry[];files:Entry[];breadcrumbs:Entry[];categories:Record<string,number>;used:number;limit:number};
type Mail = {id:string;received:number;size:number};
type Grant = {source:string;destination:string;expires:number};
type SampleGrant = {source:string;destination:string;sourceName:string;app:string;shared:boolean;expires:number|null};
type App = {client:string;name:string};
type Theme = {background:string;panel:string;ink:string;muted:string;accent:string;soft:string};
export type NativeSection = 'dashboard'|'profile'|'devices'|'security'|'apps'|'developer'|'permissions'|'storage'|'files'|'friends'|'mail';

type Props = {
  section:NativeSection;
  token:string;
  account:Account;
  colors:Theme;
  reload:()=>Promise<void>;
  expired:()=>void;
  passkeys:()=>void;
  navigate:(id:NativeSection)=>void;
};

const message = (error:unknown)=>error instanceof Error?error.message:'Could not complete the request.';
const date=(timestamp:number)=>new Date(timestamp).toLocaleDateString();

export default function NativeSections({ section,token,account,colors,reload,expired,passkeys,navigate }:Props) {
  const [devices,setDevices]=useState<Device[]>([]);
  const [apps,setApps]=useState<ConnectedApp[]>([]);
  const [grants,setGrants]=useState<Grant[]>([]);
  const [sampleGrants,setSampleGrants]=useState<SampleGrant[]>([]);
  const [published,setPublished]=useState<App[]>([]);
  const [source,setSource]=useState('');
  const [destination,setDestination]=useState('');
  const [messages,setMessages]=useState<Mail[]>([]);
  const [aliases,setAliases]=useState<PrivateAddress[]>([]);
  const [openMail,setOpenMail]=useState<{id:string;message:MailMessage}|null>(null);
  const [confirmMailDeletion,setConfirmMailDeletion]=useState(false);
  const [friends,setFriends]=useState<Friend[]>([]);
  const [incoming,setIncoming]=useState<SharedFile[]>([]);
  const [outgoing,setOutgoing]=useState<SharedFile[]>([]);
  const [recordIndex,setRecordIndex]=useState<FriendRecordIndex>();
  const [places,setPlaces]=useState<ShareablePlace[]>([]);
  const [publisher,setPublisher]=useState('');
  const [placeCursor,setPlaceCursor]=useState<string|null>(null);
  const [placeSelection,setPlaceSelection]=useState('');
  const [invite,setInvite]=useState('');
  const [friendCode,setFriendCode]=useState('');
  const [sharing,setSharing]=useState('');
  const [files,setFiles]=useState<Files|null>(null);
  const [folder,setFolder]=useState<string|null>(null);
  const [folderName,setFolderName]=useState('');
  const [picture,setPicture]=useState<string|null|undefined>(undefined);
  const [givenName,setGiven]=useState(account.profile?.givenName??'');
  const [surname,setSurname]=useState(account.profile?.surname??'');
  const [birthday,setBirthday]=useState(account.profile?.birthday??'');
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const [keyName,setKeyName]=useState('');
  const [email,setEmail]=useState('');
  const [recipient,setRecipient]=useState('');
  const [subject,setSubject]=useState('');
  const [mailText,setMailText]=useState('');
  const [formatted,setFormatted]=useState(false);
  const [attachment,setAttachment]=useState<{name:string;content:string}|undefined>();
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const api=(path:string,data?:object,method?:string)=>nativeRequest(path,token,data,method);
  const filesPath='files'+(folder?'?folder='+encodeURIComponent(folder):'');

  function report(error:unknown) {
    if(error instanceof AccountRequestError&&error.status===401)expired();
    else setStatus(message(error));
  }
  async function load() {
    if(section==='devices')setDevices((await api('devices')).devices);
    if(section==='apps')setApps((await api('connected-apps')).apps);
    if(section==='permissions'){
      const [active,samples,registered]=await Promise.all([api('data-grants'),api('sample-grants'),api('apps')]);
      setGrants(active.grants.filter((entry:Grant & {dataset:string})=>entry.dataset==='saved-place.v1'));
      setSampleGrants(samples.permissions);
      setPublished(registered.apps);
    }
    if(section==='files'||section==='storage')setFiles(await api(filesPath));
    if(section==='friends'||section==='files')setFriends((await api('friends')).friends);
    if(section==='friends'){
      const [shares,index]=await Promise.all([api('files/shared'),api('friends/records')]);
      setRecordIndex(index);
      setIncoming(shares.incoming);setOutgoing(shares.outgoing);
    }
    if(section==='mail'&&account.canReceiveMail){
      const [inbox,addresses]=await Promise.all([api('inbox'),api('mail/aliases')]);
      setMessages(inbox.messages);setAliases(addresses.aliases);
    }
  }
  useEffect(()=>{void load().catch(report);},[section,folder,token]);

  function run(work:()=>Promise<unknown>,success?:string) {
    if(busy)return;
    setStatus('');
    setBusy(true);
    void work().then(()=>setStatus(success??'')).catch(report).finally(()=>setBusy(false));
  }

  async function mutate(path:string,data:object,method?:string) {
    await api(path,data,method);
    await Promise.all([load(),reload()]);
  }
  function button(label:string,work:()=>void,disabled=busy) {
    return <Pressable accessibilityRole="button" disabled={disabled} onPress={work}
      style={({pressed})=>[styles.button,{backgroundColor:colors.soft,opacity:pressed||disabled?.6:1}]}>
      <Text style={{color:colors.accent,fontWeight:'700'}}>{label}</Text>
    </Pressable>;
  }
  function fileAction(label:string, icon:'download-outline'|'trash-outline'|'folder-open-outline', work:()=>void) {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={work}
      style={({pressed})=>[styles.fileAction,{backgroundColor:colors.soft,opacity:pressed||busy?0.6:1}]}>
      <Ionicons name={icon} size={21} color={colors.accent}/>
    </Pressable>;
  }
  function field(label:string,value:string,change:(text:string)=>void,options:Partial<React.ComponentProps<typeof TextInput>>={}) {
    return <View style={styles.field}><Text style={{color:colors.ink,fontWeight:'600'}}>{label}</Text>
      <TextInput value={value} onChangeText={change} accessibilityLabel={label} autoCorrect={false}
        style={[styles.input,{color:colors.ink,borderColor:colors.muted}]} {...options}/>
    </View>;
  }
  function paragraph(value:string) {return <Text style={{color:colors.muted}}>{value}</Text>;}
  function confirm(title:string,body:string,operation:()=>void) {
    Alert.alert(title,body,[{text:'Cancel',style:'cancel'},{text:'Confirm',style:'destructive',onPress:operation}]);
  }
  function row(key:string,label:string,description:string,actions?:ReactNode) {
    return <View style={[styles.row,{borderColor:colors.soft}]} key={key}><Text style={[styles.label,{color:colors.ink}]}>{label}</Text>
      {description?paragraph(description):null}{actions}</View>;
  }

  let content:ReactNode;
  switch(section) {
    case 'dashboard':
      content=<>
        <View style={[styles.overviewHero,{backgroundColor:colors.soft}]}>
          <Text accessibilityRole="header" style={[styles.overviewTitle,{color:colors.ink}]}>Hello, {account.profile?.givenName||account.name}</Text>
          {account.profile&&paragraph('@'+account.profile.username)}
          {button('View profile',()=>navigate('profile'))}
        </View>
        {accountShortcuts.map(({id,label,description})=><Pressable key={id} accessibilityRole="button" onPress={()=>navigate(id)}
          style={({pressed})=>[styles.overviewShortcut,{borderColor:colors.soft,opacity:pressed?0.7:1}]}>
          <Text style={[styles.label,{color:colors.ink}]}>{label}</Text>{paragraph(description)}
        </Pressable>)}
        {row('account-status','Account status',accountStatus(account.passkeys.length,account.emails.length))}
      </>;
      break;
    case 'profile':
      content=<>{paragraph(account.profile?'@'+account.profile.username:'Complete your profile to finish creating your account.')}
        {(picture||(picture===undefined&&account.profile?.hasPicture))&&<Image accessibilityLabel="Profile photo" style={styles.avatar}
          source={picture?{uri:'data:image/jpeg;base64,'+picture}:{
            uri:accountHost+'/account/avatar',
            headers:{Authorization:'Bearer '+token,'X-AuthNJS-Native':'account-manager'},cache:'reload',
          }}/>}
        <View style={styles.actions}>
          {button('Choose profile photo',()=>run(async()=>{const selected=await pickProfilePhoto();if(selected)setPicture(selected);}))}
          {(picture||(picture===undefined&&account.profile?.hasPicture))&&button('Remove photo',()=>setPicture(null))}
        </View>
        {field('Given name',givenName,setGiven,{maxLength:64,autoComplete:'given-name'})}
        {field('Surname',surname,setSurname,{maxLength:64,autoComplete:'family-name'})}
        {<BirthdayPicker value={birthday} onChange={setBirthday} ink={colors.ink} accent={colors.accent}/>}
        {button('Save profile',()=>run(()=>mutate('profile',{givenName,surname,birthday,picture}),'Profile saved.'))}
        {account.emails.map(item=>row(item.address,item.address,'Verified email'))}
        {field('New email address',email,setEmail,{keyboardType:'email-address',autoCapitalize:'none',autoComplete:'email'})}
        {button('Send verification email',()=>run(()=>mutate('email',{email}),'Check your email to verify this address.'))}</>;
      break;
    case 'devices':
      content=devices.map(device=>row(device.id,device.label,device.current?'This device':'Signed in '+date(device.created),
        !device.current&&button('Sign out device',()=>confirm('Sign out this device?','It will need to sign in again.',
          ()=>run(()=>mutate('devices/revoke',{id:device.id}),'Device signed out.')))));
      break;
    case 'security':
      content=<>{account.passkeys.map(key=>row(key.id,key.label,'Added '+date(key.created),<View style={styles.actions}>
        {button('Rename',()=>{setSelectedKey(key.id);setKeyName(key.label);})}
        {account.passkeys.length>1&&button('Remove',()=>confirm('Remove this passkey?','It will no longer unlock your X-Center ID.',
          ()=>run(()=>mutate('passkey/remove',{id:key.id}),'Passkey removed.')))}
      </View>))}
        {selectedKey&&<>{field('Passkey name',keyName,setKeyName,{maxLength:64})}{button('Save name',()=>run(async()=>{
          await mutate('passkey/rename',{id:selectedKey,name:keyName});setSelectedKey(null);
        },'Passkey renamed.'))}</>}
        {button('Add a passkey in secure browser',passkeys)}</>;
      break;
    case 'apps':
      content=<>{apps.length===0&&paragraph('No linked apps yet.')}
        {apps.map(app=>row(app.client,app.label,'Linked to X-Center ID',button('Unlink app',()=>confirm('Unlink '+app.label+'?',
          'This ends its active access and removes its sharing permissions.',
          ()=>run(()=>mutate('connected-apps/unlink',{client:app.client}),'App unlinked.')))))}
        {button('Manage developer apps',()=>navigate('developer'))}</>;
      break;
    case 'developer':
      content=<DeveloperPortal back={()=>navigate('apps')} token={token}/>;
      break;
    case 'permissions': {
      const appName=(id:string)=>published.find(app=>app.client===id)?.name??id;
      const grantText=(expires:number)=>expires===Number.MAX_SAFE_INTEGER?'Until revoked':'Expires '+date(expires);
      const change=(route:string,grant:Pick<Grant,'source'|'destination'>,method:string,persistent=false)=>
        run(()=>mutate(route,{...grant,persistent,expires:Date.now()+86_400_000},method),method==='DELETE'?'Access revoked.':'Access allowed.');
      content=<>{grants.map(grant=>row(grant.source+grant.destination,appName(grant.source)+' → '+appName(grant.destination),
        'Saved places · '+grantText(grant.expires),button('Revoke access',()=>change('data-grants',grant,'DELETE'))))}
        {published.length>1&&<>{paragraph('Choose the app that owns the records')}{published.map(app=><View key={app.client}>
          {button((source===app.client?'✓ ':'')+app.name,()=>{setSource(app.client);setDestination('');})}</View>)}
          {source&&<>{paragraph('Choose which app can read them')}{published.filter(app=>app.client!==source).map(app=><View key={app.client}>
            {button((destination===app.client?'✓ ':'')+app.name,()=>setDestination(app.client))}</View>)}</>}
          {destination&&<View style={styles.actions}>
            {button('Allow for one day',()=>change('data-grants',{source,destination},'PUT'))}
            {button('Allow until revoked',()=>change('data-grants',{source,destination},'PUT',true))}
          </View>}</>}
        {sampleGrants.map(grant=>row(grant.source+grant.destination,grant.app+' · '+grant.sourceName,
          (grant.shared?'Read and write':'Read only')+(grant.expires?' · '+grantText(grant.expires):''),grant.expires
            ?button('Revoke access',()=>change('sample-grants',grant,'DELETE'))
            :<View style={styles.actions}>{button('Allow for one hour',()=>change('sample-grants',grant,'PUT'))}
              {button('Allow until revoked',()=>change('sample-grants',grant,'PUT',true))}</View>))}
      </>;
      break;
    }
    case 'storage':
      content=files&&<>{paragraph(formatBytes(files.used)+' of '+formatBytes(files.limit)+' used')}
        <View style={[styles.bar,{backgroundColor:colors.soft}]} accessibilityLabel="Account storage breakdown">
          {storageCategories.map(([id,,color])=>files.categories[id]>0&&<View key={id}
            style={{backgroundColor:color,flex:Math.min(files.categories[id],files.limit)}}/>)}
          {files.limit>files.used&&<View style={{flex:files.limit-files.used}}/>}
        </View>
        {storageCategories.map(([id,label,color])=><View key={id} style={styles.legend}>
          <View style={[styles.dot,{backgroundColor:color}]}/><Text style={{color:colors.ink}}>{label}</Text>
          <Text style={{color:colors.muted}}>{formatBytes(files.categories[id]??0)}</Text>
        </View>)}
      </>;
      break;
    case 'files':
      content=<><View style={styles.actions}>{button('Your files',()=>setFolder(null))}
        {files?.breadcrumbs.map(item=><View key={item.id}>{button(item.name,()=>setFolder(item.id))}</View>)}</View>
        {files?.folders.map(item=>row(item.id,item.name,'Folder',<View style={styles.actions}>
          {fileAction('Open folder '+item.name,'folder-open-outline',()=>setFolder(item.id))}
          {fileAction('Remove folder '+item.name,'trash-outline',()=>confirm('Remove empty folder?','This action removes the folder.',
            ()=>run(()=>mutate('files/folders/'+item.id,{},'DELETE'),'Folder removed.')))}
        </View>))}
        {files?.files.map(item=>row(item.id,item.name,formatBytes(item.size),<View style={styles.actions}>
          {fileAction('Download '+item.name,'download-outline',()=>run(()=>shareDownload('files/'+item.id,item.name,token)))}
          {button('Share',()=>setSharing(value=>value===item.id?'':item.id))}
          {sharing===item.id&&(friends.length?friends.map(friend=><View key={friend.id}>{button('Share with @'+friend.username,
            ()=>run(async()=>{await api('files/shared',{file:item.id,friend:friend.id});setSharing('');},'Access granted.'))}</View>):paragraph('Invite a friend from Friends.'))}
          {fileAction('Remove '+item.name,'trash-outline',()=>confirm('Remove file?','This permanently removes the file.',
            ()=>run(()=>mutate('files/'+item.id,{},'DELETE'),'File removed.')))}
        </View>))}
        {button('Upload file',()=>run(async()=>{const file=await pickDocumentAsync();if(file)await mutate('files',{...file,folder});}))}
        {field('New folder name',folderName,setFolderName,{maxLength:160})}
        {button('Create folder',()=>run(async()=>{await mutate('files/folders',{name:folderName,folder});setFolderName('');},'Folder created.'))}
      </>;
      break;
    case 'friends':
      content=<>
        {paragraph('Create a one-time code and share it privately. It expires after 15 minutes.')}
        {button('Create invitation',()=>run(async()=>setInvite((await api('friends/invite',{})).code)))}
        {!!invite&&<Text selectable style={{color:colors.ink}}>{invite}</Text>}
        {field('Invitation from a friend',friendCode,setFriendCode,{maxLength:32,autoCapitalize:'none'})}
        {button('Accept invitation',()=>run(async()=>{await api('friends/accept',{code:friendCode.trim()});setFriendCode('');await load();},'Invitation accepted.'),busy||friendCode.trim().length!==32)}
        {friends.map(friend=>row(friend.id,'@'+friend.username,'',button('Remove friend',()=>confirm(
          'Remove friend?','Both accounts will lose access to files shared through this friendship.',
          ()=>run(()=>mutate('friends/'+friend.id,{},'DELETE'),'Friend removed.'),
        ))))}
        <Text accessibilityRole="header" style={[styles.label,{color:colors.ink}]}>Shared with you</Text>
        {incoming.map(file=>row(file.id,file.name,'From @'+file.from,fileAction('Download '+file.name,'download-outline',
          ()=>run(()=>shareDownload('files/shared/'+file.id,file.name,token)))))}
        <Text accessibilityRole="header" style={[styles.label,{color:colors.ink}]}>Files you shared</Text>
        {outgoing.map(file=>row(file.id,file.name,'With @'+file.to,button('Revoke access',
          ()=>run(()=>mutate('files/shared/'+file.id,{},'DELETE'),'Access revoked.'))))}
        {recordIndex&&(recordIndex.sources.length>0||recordIndex.incoming.length>0||recordIndex.outgoing.length>0)&&<>
          <Text accessibilityRole="header" style={[styles.label,{color:colors.ink}]}>{accountMessage('sharedAppData','Shared app data')}</Text>
          {recordIndex.sources.map(app=><View key={app.id}>{button(app.name,()=>run(async()=>{
            const page=await api('friends/records?source='+encodeURIComponent(app.id));
            setPublisher(app.id);setPlaces(page.records);setPlaceCursor(page.nextCursor);setPlaceSelection('');
          }))}</View>)}
          {places.map(place=>row(place.id,placeLabel(place.value),'',button(
            placeSelection===place.id?'Cancel selection':'Select place',()=>setPlaceSelection(previous=>previous===place.id?'':place.id),
          )))}
          {placeCursor&&button('Load more places',()=>run(async()=>{
            const page=await api('friends/records?source='+encodeURIComponent(publisher)+'&cursor='+encodeURIComponent(placeCursor));
            setPlaces(previous=>[...previous,...page.records]);setPlaceCursor(page.nextCursor);
          }))}
          {!!placeSelection&&friends.map(friend=><View key={friend.id}>{button('Share this place with @'+friend.username,()=>run(async()=>{
            await api('friends/records',{friend:friend.id,source:publisher,id:placeSelection});setPlaceSelection('');await load();
          },'Place shared.'))}</View>)}
          {recordIndex.incoming.map(item=>row(item.id,placeLabel(item.value),'From @'+item.username))}
          {recordIndex.outgoing.map(item=>row(item.id,placeLabel(item.value),'To @'+item.username,button('Revoke access',
            ()=>run(()=>mutate('friends/records/'+item.id,{},'DELETE'),'Access revoked.'))))}
        </>}
      </>;
      break;
    case 'mail':
      content=<>{paragraph(account.mailbox??'No mailbox has been reserved.')}
        {paragraph(account.canReceiveMail?(messages.length?'Your inbox':'Your inbox is empty.'):'Mailbox delivery is unavailable.')}
        {account.canReceiveMail&&!account.externalMail&&paragraph('This inbox can receive local X-Center mail. External delivery is unavailable.')}
        {openMail ? <>
          {button('Back to inbox',()=>{setOpenMail(null);setConfirmMailDeletion(false);})}
          {row(openMail.id,openMail.message.subject||'(No subject)',openMail.message.from)}
          {paragraph(openMail.message.text)}
          {openMail.message.attachments.map(file=><View key={file.index}>
            {paragraph(file.name+' · '+formatBytes(file.size))}
            {button('Download attachment',()=>run(()=>shareDownload('inbox/'+openMail.id+'/attachments/'+file.index,'attachment-'+(file.index+1),token)))}
          </View>)}
          {button('Download original email',()=>run(()=>shareDownload('inbox/'+openMail.id,'message.eml',token)))}
          {button(confirmMailDeletion?'Confirm permanent deletion':'Delete email',()=>{
            if(!confirmMailDeletion){setConfirmMailDeletion(true);return;}
            run(async()=>{
              await api('inbox/'+openMail.id,{},'DELETE');
              setMessages(items=>items.filter(item=>item.id!==openMail.id));
              setOpenMail(null);setConfirmMailDeletion(false);
            },'Email deleted.');
          })}
          {confirmMailDeletion&&button('Cancel deletion',()=>setConfirmMailDeletion(false))}
        </> : messages.map(item=>row(item.id,'Received '+date(item.received),formatBytes(item.size),
          button('Read email',()=>run(async()=>setOpenMail({id:item.id,message:await api('inbox/'+item.id+'/view')})))))}
        {!openMail&&aliases.length>0&&<Text accessibilityRole="header" style={[styles.label,{color:colors.ink}]}>Hide My Email addresses</Text>}
        {!openMail&&aliases.map(item=>row(item.address,item.address,item.active?(item.premium?'Premium address':'Private address'):'Disabled',
          item.active&&button('Disable address',()=>confirm('Disable this address?','Future messages to this address will be rejected.',
            ()=>run(async()=>{await api('mail/aliases/'+item.address,{},'DELETE');await load();},'Private address disabled.'),
          ))))}
        {account.canSendMail&&<>{!account.externalMailSubmission&&paragraph('You can send to X-Center mailboxes.')} {field('Recipient',recipient,setRecipient,{keyboardType:'email-address',autoCapitalize:'none'})}
          {field('Subject',subject,setSubject,{maxLength:120})}{field('Message',mailText,setMailText,{multiline:true})}
          {button(formatted?'Use plain text':'Format message',()=>setFormatted(value=>!value))}
          {formatted&&paragraph('Use **bold** or _italics_ in your message.')}
          {attachment ? button('Remove '+attachment.name,()=>setAttachment(undefined))
            : button('Attach a file (up to 256 KB)',()=>run(async()=>{const file=await pickDocumentAsync(256*1024);if(file)setAttachment(file);}))}
          {button('Send email',()=>run(async()=>{
            await api('mail/send',{to:recipient,subject,text:mailText,formatted,attachment});
            setRecipient('');setSubject('');setMailText('');setFormatted(false);setAttachment(undefined);
          },'Mail accepted for delivery.'))}</>}
      </>;
  }
  return <View style={[styles.card,{backgroundColor:colors.panel}]}>{content}
    {status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}</View>;
}

const styles=StyleSheet.create({
  fileAction:{width:44,height:44,borderRadius:11,alignItems:'center',justifyContent:'center'},
  overviewHero:{gap:9,borderRadius:18,padding:16},
  overviewTitle:{fontSize:25,fontWeight:'700'},
  overviewShortcut:{gap:4,borderWidth:1,borderRadius:12,padding:12,minHeight:52},
  card:{gap:14,padding:17,borderRadius:20},
  row:{gap:7,borderBottomWidth:StyleSheet.hairlineWidth,paddingBottom:12},
  avatar:{width:72,height:72,borderRadius:36},
  label:{fontSize:16,fontWeight:'700'},
  field:{gap:5},
  input:{borderWidth:1,borderRadius:10,paddingHorizontal:12,paddingVertical:10,minHeight:48,fontSize:16},
  button:{minHeight:46,padding:12,alignSelf:'flex-start',justifyContent:'center',borderRadius:11},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:6},
  bar:{flexDirection:'row',height:15,borderRadius:8,overflow:'hidden'},
  legend:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:10},
  dot:{width:10,height:10,borderRadius:6},
});
