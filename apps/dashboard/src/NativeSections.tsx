import AccountActivity from './AccountActivity';
import AdminSearch from './AdminSearch';
import ListPages from './ListPages';
import {useListPage} from './list-page';
import {useDialog} from './dialog-model';
import {useFileTransfers} from './file-transfers';
import {destinationLabels,type FolderDestination} from './file-destinations';
import AppFileContainer from './AppFileContainer';
import type { AppFileContainer as Container } from './account-file-containers';
import NativeAdminInventory from './NativeAdminInventory';
import { Surface, SurfaceTitle, SymbolTile, type DashboardTheme } from './native-surfaces';
import CopyButton from './CopyButton';
import DeviceSignIn from './DeviceSignIn';
import LinkedAppPermissions from './LinkedAppPermissions';
import TrustBadges from './TrustBadges';
import MailClients from './MailClients';
import AppIcon from './AppIcon';
import PublicProfile from './PublicProfile';
import HostedDataPermissions from './HostedDataPermissions';
import IncomingEmail from './IncomingEmail';
import NativeAdminUsers from './NativeAdminUsers';
import NativeSupport from './NativeSupport';
import type { SupportMessage, SupportRequest, UsernameRequest } from './support-model';
import { accountMessage,accountLocale } from './account-locale';
import { placeLabel, type Friend, type SharedFile, type FriendRecordIndex, type ShareablePlace } from './friends-model';
import { Ionicons } from '@expo/vector-icons';
import { accountGreeting, accountShortcuts, accountStatus } from './account-overview';
import BirthdayPicker from './BirthdayPicker';
import type { MailMessage, PrivateAddress } from './mail-message';
import { pickDocumentAsync, pickDocumentsAsync, pickProfilePhoto, shareDownload, type ProfilePhotoSource } from './native-files';
import { ActionSheetIOS, AppState, Image, KeyboardAvoidingView, Modal, Platform, Pressable, Share, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AccountRequestError, accountHost, nativeRequest, nativeReauthenticate } from './native-account';
import { formatBytes, storageCategories } from './storage-summary';
import type { Account } from './web-account';
import DeveloperPortal from './DeveloperPortal';

type Device = {id:string;label:string;created:number;current:boolean};
type ConnectedApp = {client:string;label:string;icon?:string|null;verified?:boolean;description?:string};
type Entry = {id:string;name:string;size:number};
type Files = {appContainers?:Container[];folders:Entry[];files:Entry[];breadcrumbs:Entry[];categories:Record<string,number>;used:number;limit:number};
type Mail = {id:string;received:number;size:number;subject?:string;from?:string;preview?:string};
type Grant = {source:string;destination:string;expires:number};
type SampleGrant = {source:string;destination:string;sourceName:string;app:string;shared:boolean;expires:number|null};
type App = {client:string;name:string};
type Theme = DashboardTheme;
export type NativeSection = 'mail-clients'|'dashboard'|'profile'|'devices'|'device-signin'|'security'|'apps'|'developer'|'permissions'|'storage'|'files'|'friends'|'mail'|'support'|'admin';

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
const mailEntrance=FadeIn.duration(180).reduceMotion(ReduceMotion.System);

function MailScreen({colors,close,children}:{colors:Theme;close:()=>void;children:ReactNode}) {
  return <Modal animationType="none" onRequestClose={close}>
    <SafeAreaProvider>
      <SafeAreaView style={[styles.mailScreen,{backgroundColor:colors.background}]}>
        <KeyboardAvoidingView style={styles.mailScreen} behavior={Platform.OS==='ios'?'padding':undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.mailContent}>
            <Animated.View entering={mailEntrance} accessibilityViewIsModal style={styles.card}>
              {children}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  </Modal>;
}

export default function NativeSections({ section,token,account,colors,reload,expired,passkeys,navigate }:Props) {
  const showDialog=useDialog();
  const [supportSubject,setSupportSubject]=useState('');
  const [supportText,setSupportText]=useState('');
  const [heroPhotoFailed,setHeroPhotoFailed]=useState(false);
  const [fileContainer,setFileContainer]=useState<Container>();
  const [adminDetail,setAdminDetail]=useState<'account'|'storage'|null>(null);
  const [adminAuthorized,setAdminAuthorized]=useState(false);
  const [newUsername,setNewUsername]=useState('');
  const [usernameRequest,setUsernameRequest]=useState<UsernameRequest|null>(null);
  const [usernameRequests,setUsernameRequests]=useState<UsernameRequest[]>([]);
  const [requests,setRequests]=useState<SupportRequest[]>([]);
  const [adminTarget,setAdminTarget]=useState<{username:string;app?:string}>();
  const [adminSection,setAdminSection]=useState<'usernames'|'storage'>();
  const supportPage=useListPage(requests.length);

  const [request,setRequest]=useState<{id:string;message:SupportMessage}|null>(null);
  const [devices,setDevices]=useState<Device[]>([]);
  const [permissionClient,setPermissionClient]=useState('');
  const [apps,setApps]=useState<ConnectedApp[]>([]);
  const [grants,setGrants]=useState<Grant[]>([]);
  const [sampleGrants,setSampleGrants]=useState<SampleGrant[]>([]);
  const [published,setPublished]=useState<App[]>([]);
  const [source,setSource]=useState('');
  const [destination,setDestination]=useState('');
  const [messages,setMessages]=useState<Mail[]>([]);
  const [inboxCursor,setInboxCursor]=useState<string|null>(null);
  const [selectingMail,setSelectingMail]=useState(false);
  const [selectedMail,setSelectedMail]=useState<string[]>([]);
  const [detailsPanel,setDetailsPanel]=useState('');
  const [editingProfile,setEditingProfile]=useState(!account.profile);
  const [premiumAliases,setPremiumAliases]=useState(false);const [aliasName,setAliasName]=useState('');const [creatingAlias,setCreatingAlias]=useState(false);
  const [aliases,setAliases]=useState<PrivateAddress[]>([]);
  const [openMail,setOpenMail]=useState<{id:string;message:MailMessage}|null>(null);
  const [confirmMailDeletion,setConfirmMailDeletion]=useState(false);
  const [inviteMode,setInviteMode]=useState<'create'|'accept'|null>(null);
  const [friendUsername,setFriendUsername]=useState('');
  const [friendRequests,setFriendRequests]=useState<Friend[]>([]);
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
  const visibleFolder=useRef(folder);
  visibleFolder.current=folder;
  async function refreshFiles(){
    const target=visibleFolder.current;
    const next=await api('files'+(target?'?folder='+encodeURIComponent(target):''));
    if(visibleFolder.current===target)setFiles(next);
  }
  const [folderName,setFolderName]=useState('');
  const [creatingFolder,setCreatingFolder]=useState(false);
  const [renameEntry,setRenameEntry]=useState<{id:string;name:string}|null>(null);
  const transfers=useFileTransfers();
  const [movingFile,setMovingFile]=useState<{id:string;name:string;folder:boolean}|null>(null);
  const [fileDestinations,setFileDestinations]=useState<FolderDestination[]>([]);
  const [moveTarget,setMoveTarget]=useState<string|null>(null);
  const [picture,setPicture]=useState<string|null|undefined>(undefined);
  const [givenName,setGiven]=useState(account.profile?.givenName??'');
  const [surname,setSurname]=useState(account.profile?.surname??'');
  const [birthday,setBirthday]=useState(account.profile?.birthday??'');
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const [keyName,setKeyName]=useState('');
  const [email,setEmail]=useState('');
  const [compose,setCompose]=useState(false);
  const [sender,setSender]=useState('');
  const [recipient,setRecipient]=useState('');
  const [subject,setSubject]=useState('');
  const [mailText,setMailText]=useState('');
  const [formatted,setFormatted]=useState(false);
  const [attachment,setAttachment]=useState<{name:string;content:string}|undefined>();
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const appsPage=useListPage(apps.length,section);
  const devicePage=useListPage(devices.length,section);
  const usernamePage=useListPage(usernameRequests.length);
  const api=(path:string,data?:object,method?:string,signal?:AbortSignal)=>nativeRequest(path,token,data,method,signal);
  const filesPath='files'+(folder?'?folder='+encodeURIComponent(folder):'');

  function report(error:unknown) {
    if(error instanceof AccountRequestError&&error.status===401)expired();
    else setStatus(message(error));
  }
  async function load() {
    if(section==='profile'&&account.profile)setUsernameRequest((await api('username-change')).request);
    if(section==='admin'&&account.admin){
      const {authorized}=await api('admin/access');
      setAdminAuthorized(authorized);
      if(!authorized)return;
      setRequests((await api('admin/support')).requests);
      setUsernameRequests((await api('admin/username-changes')).requests);
    }
    if(section==='devices')setDevices((await api('devices')).devices);
    if(section==='apps')setApps((await api('connected-apps')).apps);
    if(section==='permissions'){
      const [active,registered,linked]=await Promise.all([api('data-grants'),api('apps'),api('connected-apps')]);
      setApps(linked.apps);
      setGrants(active.grants.filter((entry:Grant & {dataset:string})=>entry.dataset==='saved-place.v1'));
      setSampleGrants([]);
      setPublished(registered.apps);
    }
    if(section==='files'||section==='storage')setFiles(await api(filesPath));
    if(section==='friends'||section==='files'){const people=await api('friends');setFriends(people.friends);setFriendRequests(people.requests??[]);}
    if(section==='friends'){
      const [shares,index]=await Promise.all([api('files/shared'),api('friends/records')]);
      setRecordIndex(index);
      setIncoming(shares.incoming);setOutgoing(shares.outgoing);
    }
    if(section==='mail'&&account.canReceiveMail){
      const [inbox,addresses]=await Promise.all([api('inbox'),api('mail/aliases')]);
      setMessages(inbox.messages);setInboxCursor(inbox.nextCursor??null);setAliases(addresses.aliases);setPremiumAliases(addresses.premium);
    }
  }
  useEffect(()=>{void load().catch(report);},[section,folder,token]);
  useEffect(()=>{
    if(section!=='apps'&&section!=='permissions')return;
    const subscription=AppState.addEventListener('change',state=>{
      if(state==='active')void load().catch(report);
    });
    return ()=>subscription.remove();
  },[section,token]);

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
    const adminIcons:Record<string,React.ComponentProps<typeof Ionicons>['name']>={
      'Authenticate':'finger-print','Approve change':'checkmark','Decline request':'close',
      'All requests':'arrow-back','Send mailbox reply':'send-outline','Remove request':'trash-outline','Refresh requests':'refresh',
    };
    if(section==='admin'&&adminIcons[label])return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={work}
      style={({pressed})=>[styles.adminAction,{backgroundColor:pressed?colors.soft:colors.panel,borderColor:colors.line,opacity:disabled?0.6:1}]}>
      <Ionicons name={adminIcons[label]} size={18} color={colors.accent} accessible={false}/><Text style={{fontSize:13,fontWeight:'600',color:colors.ink,flexShrink:1}}>{label}</Text>
    </Pressable>;
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
  function chooseProfilePhoto() {
    const sources: {text:string;source:ProfilePhotoSource}[] = [
      {text:'Photo Library',source:'library'},
      {text:'Take Photo',source:'camera'},
      {text:'Choose File',source:'files'},
    ];
    const pick=(source:ProfilePhotoSource)=>run(async()=>{
      const selected=await pickProfilePhoto(source);
      if(selected)setPicture(selected);
    });
    if(Platform.OS==='ios'){
      ActionSheetIOS.showActionSheetWithOptions({
        options:[...sources.map(choice=>choice.text),'Cancel'],cancelButtonIndex:sources.length,
      },index=>{if(sources[index])pick(sources[index].source);});
      return;
    }
    showDialog('Choose profile photo',undefined,[
      ...sources.map(({text,source})=>({text,onPress:()=>pick(source)})),{text:'Cancel',style:'cancel'},
    ]);
  }

  function confirm(title:string,body:string,operation:()=>void) {
    showDialog(title,body,[{text:'Cancel',style:'cancel'},{text:'Confirm',style:'destructive',onPress:operation}]);
  }
  function row(key:string,label:string,description:string,actions?:ReactNode) {
    return <View style={[styles.row,{borderColor:colors.line}]} key={key}><Text style={[styles.label,{color:colors.ink}]}>{label}</Text>
      {description?paragraph(description):null}{actions}</View>;
  }

  let content:ReactNode;
  switch(section) {
    case 'mail-clients':content=<MailClients token={token} colors={colors} username={account.profile?.username}/>;break;
    case 'dashboard': {
      const shortcutIcons = {
        profile: ['person-outline', 'blue'],
        security: ['shield-checkmark-outline', 'mint'],
        permissions: ['key-outline', 'lavender'],
        devices: ['phone-portrait-outline', 'blue'],
      } as const;
      content=<>
        <View style={styles.overviewHero}>
          <View style={styles.heroContent}>
            <Text style={styles.heroSecondary}>{accountMessage('personalAccount','Personal account')}</Text>
            <Text accessibilityRole="header" style={styles.overviewTitle}>{accountGreeting(account.profile?.givenName||account.name)}</Text>
            {account.profile&&<Text style={styles.heroSecondary}>@{account.profile.username}</Text>}
            <TrustBadges verified={account.verified} admin={account.admin} color="#f9fbff"/>
            <Pressable accessibilityRole="button" onPress={()=>navigate('profile')}
              style={({pressed})=>[styles.heroButton,{opacity:pressed?0.8:1}]}>
              <Text style={styles.heroButtonText}>{accountMessage('viewProfile','View profile')}</Text>
              <Ionicons name="arrow-forward" size={16} color="#233887" accessible={false}/>
            </Pressable>
          </View>
          {account.profile?.hasPicture&&!heroPhotoFailed?<Image style={styles.heroAvatar} accessibilityLabel="Profile photo" onError={()=>setHeroPhotoFailed(true)} source={{
            uri:accountHost+'/account/avatar',headers:{Authorization:'Bearer '+token,'X-AuthNJS-Native':'account-manager'},
          }}/>:<View style={styles.heroAvatar}><Ionicons accessible={false} name="person-outline" size={30} color="#3144a5"/></View>}
        </View>
        <View style={styles.shortcutGrid}>
          {accountShortcuts().map(({id,label,description})=>{
            const [icon,tint]=shortcutIcons[id];
            return <Pressable key={id} accessibilityRole="button" onPress={()=>navigate(id)}
              style={({pressed})=>[styles.overviewShortcut,{borderColor:colors.line,backgroundColor:pressed?colors.soft:colors.panel}]}>
              <SymbolTile colors={colors} icon={icon} tint={tint}/>
              <Text style={[styles.label,{color:colors.ink}]}>{label}</Text>
              {paragraph(description)}
            </Pressable>;
          })}
        </View>
        <Surface colors={colors}>
          <SurfaceTitle colors={colors} title={accountMessage('accountStatus','Account status')} icon="shield-checkmark-outline" tint="mint"/>
          {paragraph(accountStatus(account.passkeys.length,account.emails.filter(email=>email.verified).length))}
        </Surface>
      </>;
      break;
    }
    case 'profile':
      content=<>{paragraph(account.profile?'@'+account.profile.username:'Complete your profile to finish creating your account.')}
        <TrustBadges verified={account.verified} admin={account.admin} color={colors.ink}/>
        {editingProfile?<>{(picture||(picture===undefined&&account.profile?.hasPicture))&&<Image accessibilityLabel="Profile photo" style={styles.avatar}
          source={picture?{uri:'data:image/jpeg;base64,'+picture}:{
            uri:accountHost+'/account/avatar',
            headers:{Authorization:'Bearer '+token,'X-AuthNJS-Native':'account-manager'},cache:'reload',
          }}/>}
        <View style={styles.actions}>
          {button('Choose profile photo',chooseProfilePhoto)}
          {(picture||(picture===undefined&&account.profile?.hasPicture))&&button('Remove photo',()=>setPicture(null))}
        </View>
        {field('Given name',givenName,setGiven,{maxLength:64,autoComplete:'given-name'})}
        {field('Surname',surname,setSurname,{maxLength:64,autoComplete:'family-name'})}
        {<BirthdayPicker value={birthday} onChange={setBirthday} ink={colors.ink} accent={colors.accent}/>}
        {button('Save profile',()=>run(async()=>{await mutate('profile',{givenName,surname,birthday,picture});setEditingProfile(false);},'Profile saved.'))}
        {account.profile&&button('Cancel editing',()=>setEditingProfile(false))}</>:<>{account.profile?.hasPicture&&<Image accessibilityLabel="Profile photo" style={styles.avatar} source={{uri:accountHost+'/account/avatar',headers:{Authorization:'Bearer '+token,'X-AuthNJS-Native':'account-manager'}}}/>} {paragraph(givenName+' '+surname)}{paragraph('Age group: '+(account.profile?.ageRange??'Not set'))}{paragraph(birthday?new Date(birthday+'T12:00:00Z').toLocaleDateString(accountLocale(),{timeZone:'UTC'}):'Birthday not set')}{button('Edit profile',()=>setEditingProfile(true))}</>}
        {button('Change username',()=>setDetailsPanel(detailsPanel==='username'?'':'username'))}
        {account.profile&&detailsPanel==='username'&&<>
          <Text accessibilityRole="header" style={[styles.label,{color:colors.ink}]}>Username change</Text>
          {paragraph('Confirm your request here. An administrator must approve the change, including your mailbox address.')}
          {usernameRequest?<>
            {paragraph('@'+usernameRequest.proposed+(usernameRequest.confirmed?' · Waiting for administrator approval':' · Waiting for your confirmation'))}
            {!usernameRequest.confirmed&&button('Confirm request',()=>run(async()=>{if(!(await api('session/access')).confirmed&&!await nativeReauthenticate(token))return;await mutate('username-change',{action:'confirm',id:usernameRequest.id});}))}
            {button('Cancel request',()=>run(()=>mutate('username-change',{action:'cancel',id:usernameRequest.id})))}
          </>:<>
            {field('New username',newUsername,setNewUsername,{autoCapitalize:'none',maxLength:24})}
            {button('Request change',()=>run(()=>mutate('username-change',{action:'request',username:newUsername})),busy||!newUsername.trim())}
          </>}
        </>}
        {account.emails.map(item=>row(item.address,item.address,item.verified?'Verified email':'Unverified · Cannot be used'))}
        {button('Manage email addresses',()=>setDetailsPanel(detailsPanel==='email'?'':'email'))}
        {detailsPanel==='email'&&<IncomingEmail token={token} updated={reload} addresses={account.emails} colors={colors}/>}
        <PublicProfile token={token} colors={colors}/></>;
      break;
    case 'device-signin':content=<DeviceSignIn token={token} colors={colors} back={()=>navigate('devices')}/>;break;
    case 'devices':
      content=<>{button('Sign in on another device',()=>navigate('device-signin'))}{devices.slice(devicePage.start,devicePage.end).map(device=>row(device.id,device.label,device.current?'This device':'Signed in '+date(device.created),
        !device.current&&button('Sign out device',()=>confirm('Sign out this device?','It will need to sign in again.',
          ()=>run(()=>mutate('devices/revoke',{id:device.id}),'Device signed out.')))))}<ListPages state={devicePage} label="Devices" colors={colors}/></>;
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
        {button('Add a passkey in secure browser',passkeys)}<AccountActivity key={token} token={token} colors={colors}/></>;
      break;
    case 'apps':
      content=<>{apps.length===0&&paragraph('No linked apps yet.')}
        {apps.slice(appsPage.start,appsPage.end).map(app=><View key={app.client} style={{gap:10,borderBottomWidth:1,borderColor:colors.soft,paddingVertical:12}}><View style={{flexDirection:'row',gap:12,alignItems:'center'}}>
          <AppIcon key={app.icon} icon={app.icon} color={colors.accent}/>
          <View style={{flexShrink:1,gap:4}}><Text style={{color:colors.ink,fontWeight:'700'}}>{app.label}</Text><TrustBadges kind="app" verified={app.verified} color={colors.ink}/></View></View>
          {button('Manage permissions',()=>{setPermissionClient(app.client);navigate('permissions');})}
          {button('Unlink app',()=>confirm('Unlink '+app.label+'?','This ends the app’s access and permanently deletes the copies it saved in your X-Center ID account.',()=>run(()=>mutate('connected-apps/unlink',{client:app.client}),'App unlinked.')))}</View>)}
        {!!apps.length&&button('Sign out of connected apps',()=>confirm('Sign out of all connected apps?',
          'Your links, permissions and stored data are kept. Apps may ask you to sign in again.',
          ()=>run(async()=>{
            if(!(await api('session/access')).confirmed&&!await nativeReauthenticate(token))return;
            await api('connected-apps/sign-out',{});
            setStatus('Connected app access ended.');
          })))}
        {button('Manage developer apps',()=>navigate('developer'))}<ListPages state={appsPage} label="Authorized apps" colors={colors}/></>;
      break;
    case 'developer':
      content=<DeveloperPortal back={()=>navigate('apps')} token={token} colors={colors}/>;
      break;
    case 'permissions': {
      const selected=apps.find(app=>app.client===permissionClient);
      if(selected){
        content=<>{button('All linked apps',()=>setPermissionClient(''))}
          <View style={styles.actions}><AppIcon icon={selected.icon} color={colors.accent}/>
            <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>{selected.label}</Text></View>
          <LinkedAppPermissions key={selected.client} client={selected.client} token={token} colors={colors}/>
          <HostedDataPermissions token={token} colors={colors} client={selected.client}/>
          {grants.filter(grant=>grant.source===selected.client||grant.destination===selected.client).map(grant=>{
            const other=grant.source===selected.client?grant.destination:grant.source;
            return row(grant.source+grant.destination,apps.find(app=>app.client===other)?.label??'Another app',
              'Previously shared data',button('Revoke access',()=>run(()=>mutate('data-grants',grant,'DELETE'),'Access revoked.')));
          })}</>;
        break;
      }
      content=<>{!apps.length&&paragraph('No linked apps.')}
        {apps.map(app=><Pressable key={app.client} accessibilityRole="button" onPress={()=>setPermissionClient(app.client)}
          style={{paddingVertical:12,gap:12,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderColor:colors.line}}>
          <AppIcon icon={app.icon} color={colors.accent}/>
          <View style={{flex:1,gap:4}}><Text style={{color:colors.ink,fontWeight:'700'}}>{app.label}</Text>
            <TrustBadges kind="app" verified={app.verified} color={colors.ink}/></View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted}/>
        </Pressable>)}</>;
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
        {!!files.appContainers?.length&&<><Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>App containers in your account</Text>
          {files.appContainers.map(app=>row(app.client,app.name,formatBytes(app.bytes),<AppIcon icon={app.icon} color={colors.accent}/>))}</>}
      </>;
      break;
    case 'files': {
      if(fileContainer){content=<AppFileContainer app={fileContainer} token={token} colors={colors} back={()=>setFileContainer(undefined)}/>;break;}
      const icon=(label:string,name:React.ComponentProps<typeof Ionicons>['name'],onPress:()=>void)=>
        <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={onPress}
          style={({pressed})=>[styles.fileToolbarButton,{opacity:pressed||busy?0.55:1}]}><Ionicons accessible={false} name={name} size={20} color={colors.accent}/></Pressable>;
      const openFolder=(id:string|null)=>{setFolder(id);setCreatingFolder(false);setRenameEntry(null);};
      const fileLine=[styles.finderRow,{borderColor:colors.line}];
      function renderNameEditor(label:string,name:string,onChange:(value:string)=>void,save:()=>void,cancel:()=>void){
        return <View style={styles.finderName}>
          <TextInput autoFocus accessibilityLabel={label} value={name} onChangeText={onChange}
            onSubmitEditing={save} maxLength={160} returnKeyType="done" editable={!busy}
            style={[styles.finderInput,{color:colors.ink,borderColor:colors.line}]}/>
          {icon('Save name','checkmark-outline',save)}
          {icon('Cancel','close-outline',cancel)}
        </View>;
      }
      function saveRename(id:string,isFolder:boolean){
        const name=renameEntry?.name.trim();
        if(!name)return;
        run(async()=>{await mutate('files/'+(isFolder?'folders/':'')+id,{name},'PATCH');setRenameEntry(null);},isFolder?'Folder renamed.':'File renamed.');
      }
      function createFolder(){
        if(!folderName.trim())return;
        run(async()=>{await mutate('files/folders',{name:folderName.trim(),folder});setFolderName('');setCreatingFolder(false);},'Folder created.');
      }
      function chooseMove(item:{id:string;name:string},isFolder:boolean){
        void api('files/destinations').then(result=>{
          setFileDestinations(result.folders);setMoveTarget(folder);setMovingFile({...item,folder:isFolder});
        }).catch(report);
      }
      content=<>
        <Modal visible={!!movingFile} onRequestClose={()=>setMovingFile(null)} presentationStyle="pageSheet">
          <SafeAreaView style={{flex:1,backgroundColor:colors.panel}}>
            <ScrollView contentContainerStyle={{padding:20,gap:10}}>
              {movingFile&&<>
                <Text accessibilityRole="header" style={{fontSize:21,fontWeight:'700',color:colors.ink}}>Move {movingFile.name}</Text>
                {[{id:null,label:'Your files'},...destinationLabels(fileDestinations,movingFile.folder?movingFile.id:undefined)].map(item=>
                  <Pressable key={item.id??'root'} accessibilityRole="radio" accessibilityState={{checked:moveTarget===item.id}} onPress={()=>setMoveTarget(item.id)}
                    style={{minHeight:46,justifyContent:'center',paddingHorizontal:10,backgroundColor:moveTarget===item.id?colors.soft:colors.panel}}>
                    <Text style={{color:colors.ink}}>{item.label}</Text>
                  </Pressable>)}
                <View style={styles.actions}>{button('Cancel',()=>setMovingFile(null))}
                  {button('Move',()=>run(async()=>{
                    await mutate('files/'+(movingFile.folder?'folders/':'')+movingFile.id,{folder:moveTarget},'PATCH');
                    setMovingFile(null);
                  },'Item moved.'),busy||folder===moveTarget)}</View>
              </>}
            </ScrollView>
          </SafeAreaView>
        </Modal>
        <View style={styles.finderToolbar}><View style={[styles.actions,{flex:1}]}>
          {button('Your files',()=>openFolder(null))}
          {files?.breadcrumbs.map(item=><View key={item.id}>{button(item.name,()=>openFolder(item.id))}</View>)}
        </View>
        {icon('Upload files','cloud-upload-outline',()=>{setStatus('');void pickDocumentsAsync().then(selected=>{
          transfers.add(selected,folder,api,()=>void refreshFiles().catch(report),report);
        }).catch(report);})}
        </View>
        <View style={fileLine}><Text accessibilityRole="header" style={[styles.finderName,{color:colors.muted}]}>Name</Text>
          <Text accessibilityRole="header" style={{color:colors.muted}}>Size</Text></View>
        <View style={fileLine}>
          <Ionicons name="folder-outline" size={21} color={colors.accent} accessible={false}/>
          {creatingFolder?renderNameEditor('New folder name',folderName,setFolderName,createFolder,()=>setCreatingFolder(false)):
            <Pressable accessibilityRole="button" disabled={busy} style={[styles.finderName,{minHeight:44,justifyContent:'center'}]}
              onPress={()=>{setFolderName('');setRenameEntry(null);setCreatingFolder(true);}}>
              <Text style={{color:colors.accent,fontWeight:'700'}}>New folder</Text>
            </Pressable>}
        </View>
        {!folder&&files?.appContainers?.filter(app=>app.showInFiles).map(app=>
          <Pressable accessibilityRole={(app.canBrowse??app.canManage)?"button":undefined} disabled={!(app.canBrowse??app.canManage)} key={app.client} onPress={()=>setFileContainer(app)} style={fileLine}>
            <AppIcon icon={app.icon} color={colors.accent} compact/>
            <Text style={[styles.finderName,{color:colors.ink,fontWeight:'700'}]}>{app.name}</Text>
            {paragraph(formatBytes(app.bytes))}
            {(app.canBrowse??app.canManage)&&<Ionicons accessible={false} name="chevron-forward" size={18} color={colors.muted}/>}
          </Pressable>)}
        {files?.folders.map(item=><View style={fileLine} key={item.id}>
          <Ionicons name="folder-outline" size={21} color={colors.accent} accessible={false}/>
          {renameEntry?.id===item.id?renderNameEditor('Folder name',renameEntry.name,name=>setRenameEntry({...renameEntry,name}),()=>saveRename(item.id,true),()=>setRenameEntry(null)):
            <Pressable accessibilityRole="button" style={[styles.finderName,{minHeight:44,justifyContent:'center'}]} onPress={()=>openFolder(item.id)}>
              <Text style={{color:colors.ink,fontWeight:'700'}}>{item.name}</Text>
            </Pressable>}
          {paragraph(formatBytes(item.size??0))}
          {icon('Rename '+item.name,'pencil-outline',()=>{setCreatingFolder(false);setRenameEntry(item);})}
          {icon('Move '+item.name,'folder-open-outline',()=>chooseMove(item,true))}
          {icon('Remove folder '+item.name,'trash-outline',()=>confirm('Remove folder and contents?','This permanently removes the folder and everything inside it.',
            ()=>run(()=>mutate('files/folders/'+item.id+'?recursive=1',{},'DELETE'),'Folder removed.')))}
        </View>)}
        {transfers.rows.filter(row=>row.folder===folder).map(row=>{
          const percent=row.size?Math.floor(row.sent/row.size*100):0;
          return <View key={'upload-'+row.key} style={fileLine}>
            <Ionicons name="document-outline" size={20} color={colors.accent}/>
            <Text numberOfLines={2} style={[styles.finderName,{color:colors.ink,fontWeight:'700'}]}>{row.name}</Text>
            <View style={{minWidth:94,gap:4}} accessibilityRole="progressbar" accessibilityLabel={'Upload '+row.name} accessibilityValue={{min:0,max:100,now:percent}}>
              <View style={{height:4,borderRadius:3,backgroundColor:colors.line}}><View style={{height:4,borderRadius:3,width:`${percent}%`,backgroundColor:colors.accent}}/></View>
              <Text style={{fontSize:11,color:colors.muted}}>{percent}% ({formatBytes(row.sent)} / {formatBytes(row.size)})</Text>
            </View>
            {!row.finishing&&icon('Cancel upload of '+row.name,'close-outline',()=>transfers.cancel(row.key))}
          </View>;
        })}
        {files?.files.map(item=><View key={item.id}>
          <View style={fileLine}>
            <Ionicons name="document-outline" size={20} color={colors.accent} accessible={false}/>
            {renameEntry?.id===item.id?renderNameEditor('File name',renameEntry.name,name=>setRenameEntry({...renameEntry,name}),()=>saveRename(item.id,false),()=>setRenameEntry(null)):
              <Pressable accessibilityRole="button" style={styles.finderName} onPress={()=>run(()=>shareDownload('files/'+item.id,item.name,token))}><Text style={{color:colors.ink,fontWeight:'700'}}>{item.name}</Text>{paragraph(formatBytes(item.size))}</Pressable>}
            <View style={styles.finderActions}>
              {paragraph(formatBytes(item.size??0))}
          {icon('Rename '+item.name,'pencil-outline',()=>{setCreatingFolder(false);setRenameEntry(item);})}
              {icon('Share '+item.name,'share-social-outline',()=>setSharing(value=>value===item.id?'':item.id))}
              {icon('Move '+item.name,'folder-open-outline',()=>chooseMove(item,false))}
              {icon('Remove '+item.name,'trash-outline',()=>confirm('Remove file?','This permanently removes the file.',
                ()=>run(()=>mutate('files/'+item.id,{},'DELETE'),'File removed.')))}
            </View>
          </View>
          {sharing===item.id&&(friends.length?friends.map(friend=><View key={friend.id}>{button('Share with @'+friend.username,
            ()=>run(async()=>{await api('files/shared',{file:item.id,friend:friend.id});setSharing('');},'Access granted.'))}</View>):paragraph('Invite a friend from Friends.'))}
        </View>)}
        {transfers.rows.every(row=>row.folder!==folder)&&files&&!files.files.length&&!files.folders.length&&(folder||!files.appContainers?.some(app=>app.showInFiles))&&paragraph('This folder is empty.')}
      </>;
      break;
    }
    case 'friends':
      content=<>
        {paragraph('Create a one-time code and share it privately. It expires after 15 minutes.')}
        {button('Create invitation',()=>{setInvite('');setInviteMode('create');run(async()=>setInvite((await api('friends/invite',{})).code));})}
        {button('Enter invitation code',()=>setInviteMode('accept'))}
        {field('Friend’s username',friendUsername,setFriendUsername,{maxLength:24,autoCapitalize:'none'})}
        {button('Send request',()=>run(async()=>{await api('friends/request',{username:friendUsername});setFriendUsername('');},'Request submitted.'),busy||!friendUsername.trim())}
        {friendRequests.map(item=>row(item.id,'@'+item.username,'Friend request',<View><TrustBadges verified={item.verified} admin={item.admin} color={colors.ink}/>
          {button('Accept',()=>run(()=>mutate('friends/respond',{id:item.id,accept:true})))}
          {button('Decline',()=>run(()=>mutate('friends/respond',{id:item.id,accept:false})))}
        </View>))}
        {inviteMode&&<MailScreen colors={colors} close={()=>setInviteMode(null)}>
          {inviteMode==='create'?<>
            {paragraph('Share this invitation')}
            {!!invite&&<Text selectable style={{color:colors.ink}}>{invite}</Text>}
            {!!invite&&<View style={styles.actions}><CopyButton value={invite} label="Copy invitation code" color={colors.accent}/>
              {button('Share invitation link',()=>void Share.share({message:accountHost+'/friends#invite='+invite}))}</View>}
          </>:<>
            {field('Invitation from a friend',friendCode,setFriendCode,{maxLength:32,autoCapitalize:'none'})}
            {button('Accept invitation',()=>run(async()=>{await api('friends/accept',{code:friendCode.trim()});setFriendCode('');await load();setInviteMode(null);},'Invitation accepted.'),busy||![10,32].includes(friendCode.trim().length))}
          </>}
          {status&&paragraph(status)}
          {button('Close',()=>setInviteMode(null))}
        </MailScreen>}
        {friends.map(friend=><View key={friend.id} style={{gap:8}}>
          <View style={{flexDirection:'row',gap:10,alignItems:'center'}}>
            {friend.avatar?<Image style={{width:36,height:36,borderRadius:18}} source={{uri:accountHost+friend.avatar}}/>:<Ionicons name="person-circle-outline" size={36} color={colors.muted}/>}
            <View style={{flexShrink:1,gap:4}}>{paragraph('@'+friend.username)}<TrustBadges verified={friend.verified} admin={friend.admin} color={colors.ink}/></View>
          </View>
          {button('Remove friend',()=>confirm('Remove friend?','Both accounts will lose access to files shared through this friendship.',
            ()=>run(()=>mutate('friends/'+friend.id,{},'DELETE'),'Friend removed.')))}
        </View>)}
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
    case 'support':
      content=<NativeSupport token={token} colors={colors}/>;
      break;
    case 'admin':
      if(!account.admin){content=paragraph('Administrator access is required.');break;}
      if(!adminAuthorized){
        content=button('Authenticate',()=>run(async()=>{if(await nativeReauthenticate(token))await load();}));
        break;
      }
      content=<>
        {!adminDetail&&!request&&!adminSection&&<AdminSearch token={token} colors={colors} open={(category,item)=>{
          if(category==='support'){
            run(async()=>{setRequest({id:item.id,message:await api('admin/support/'+item.id)});setSupportText('');});
          }else if(category==='storage'||category==='usernames'){
            setAdminSection(category);
          }else if(item.username){
            setAdminTarget({username:item.username,app:category==='apps'?item.id:undefined});setAdminDetail('account');
          }
        }}/>}
        {adminSection&&button('All Administration',()=>setAdminSection(undefined))}
        {adminDetail!=='storage'&&!request&&!adminSection&&<NativeAdminUsers token={token} colors={colors} requested={adminTarget}
          onDetail={open=>{if(!open)setAdminTarget(undefined);setAdminDetail(open?'account':null);}}/>}
        {!adminDetail&&<>
        {!request&&adminSection!=='storage'&&<Surface colors={colors}>
        <SurfaceTitle colors={colors} title="Username requests" icon="id-card-outline" tint="lavender"/>
        {usernameRequests.length===0&&paragraph('No confirmed requests.')}
        {usernameRequests.slice(usernamePage.start,usernamePage.end).map(item=>row(item.id,'@'+item.previous+' → @'+item.proposed,'Confirmed by the account holder',
          <View style={styles.actions}>{(['approve','reject'] as const).map(action=><View key={action}>
            {button(action==='approve'?'Approve change':'Decline request',()=>run(async()=>{
              await api('admin/username-changes',{id:item.id,action});await load();
            },action==='approve'?'Username changed.':'Request declined.'))}
          </View>)}</View>))}
        <ListPages state={usernamePage} label="Username requests" colors={colors}/>
        </Surface>}
        {!adminSection&&<Surface colors={colors}>
        <SurfaceTitle colors={colors} title="Support inbox" icon="mail-open-outline" tint="mint"/>
        {request?<>{button('All requests',()=>{setRequest(null);setSupportText('');})}
          {row(request.id,request.message.subject||'(No subject)',request.message.sender)}
          {paragraph(request.message.text)}
          {request.message.external&&paragraph('Unverified email sender. External replies require a configured sender.')}
          {request.message.canReply&&<>
            {field('Reply',supportText,setSupportText,{multiline:true,maxLength:3000,editable:!busy})}
            {button('Send mailbox reply',()=>run(async()=>{
              await api('admin/support/'+request.id,{text:supportText});
              setRequest(null);setSupportText('');await load();
            },'Reply delivered to Mail.'),busy||!supportText.trim())}
          </>}
          {button('Remove request',()=>confirm('Remove this support request?','This removes it for every administrator.',()=>run(async()=>{
            await api('admin/support/'+request.id,{},'DELETE');setRequest(null);await load();
          },'Request removed.')))}
        </>:<>
          {button('Refresh requests',()=>run(load))}
          {!requests.length&&paragraph('No support requests.')}
          {requests.slice(supportPage.start,supportPage.end).map(item=><View key={item.id}>{button((item.external?'Incoming email':item.replied?'Answered request':'Account request')+' · '+new Date(item.received).toLocaleString(),
            ()=>run(async()=>{setRequest({id:item.id,message:await api('admin/support/'+item.id)});setSupportText('');}))}</View>)}
          <ListPages state={supportPage} label="Support requests" colors={colors}/>
        </>}
        </Surface>}
        </>}
        {adminDetail!=='account'&&!request&&adminSection!=='usernames'&&<NativeAdminInventory token={token} colors={colors} onDetail={open=>setAdminDetail(open?'storage':null)}/>}
      </>;
      break;
    case 'mail':
      content=<>{paragraph(account.mailbox??'No mailbox has been reserved.')}
        {paragraph(account.canReceiveMail?(messages.length?'Your inbox':accountMessage('inboxEmpty','Your inbox is empty.')):'Mailbox delivery is unavailable.')}
        {account.canReceiveMail&&!account.externalMail&&paragraph('This inbox can receive local X-Center mail. External delivery is unavailable.')}
        {openMail&&<MailScreen colors={colors} close={()=>{if(!busy){setOpenMail(null);setConfirmMailDeletion(false);}}}>
          {button(accountMessage('backToInbox','Back to inbox'),()=>{setOpenMail(null);setConfirmMailDeletion(false);})}
          {row(openMail.id,openMail.message.subject||accountMessage('noSubject','(No subject)'),openMail.message.from)}
          {openMail.message.badges?.verified&&paragraph('✓ Verified sender')}{openMail.message.badges?.admin&&paragraph('◆ Administrator')}
          {paragraph(openMail.message.text)}
          {openMail.message.attachments.map(file=><View key={file.index}>
            {paragraph(file.name+' · '+formatBytes(file.size))}
            {button('Download attachment',()=>run(()=>shareDownload('inbox/'+openMail.id+'/attachments/'+file.index,'attachment-'+(file.index+1),token)))}
          </View>)}
          {button(accountMessage('downloadEmail','Download original email'),()=>run(()=>shareDownload('inbox/'+openMail.id,'message.eml',token)))}
          {button(confirmMailDeletion?accountMessage('confirmEmailDeletion','Confirm permanent deletion'):accountMessage('deleteEmail','Delete email'),()=>{
            if(!confirmMailDeletion){setConfirmMailDeletion(true);return;}
            run(async()=>{
              await api('inbox/'+openMail.id,{},'DELETE');
              setMessages(items=>items.filter(item=>item.id!==openMail.id));
              setOpenMail(null);setConfirmMailDeletion(false);
            },accountMessage('emailDeleted','Email deleted.'));
          })}
          {confirmMailDeletion&&button('Cancel deletion',()=>setConfirmMailDeletion(false))}
          {status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}
        </MailScreen>}
        {!!messages.length&&button(selectingMail?'Cancel selection':'Select messages',()=>{
          setSelectingMail(!selectingMail);setSelectedMail([]);
        })}
        {selectingMail&&button('Delete selected ('+selectedMail.length+')',()=>{
          const ids=[...selectedMail];
          confirm('Permanently delete selected messages?', 'This removes '+ids.length+' selected messages from your inbox.',()=>run(async()=>{
            await api('inbox',{ids},'DELETE');
            const removed=new Set(ids);
            setMessages(items=>items.filter(item=>!removed.has(item.id)));
            setSelectedMail([]);setSelectingMail(false);
          },'Selected messages deleted.'));
        },busy||!selectedMail.length)}
        {messages.map(item=>{
          const checked=selectedMail.includes(item.id);
          return row(item.id,item.subject||'(No subject)',[item.from,item.preview,date(item.received)].filter(Boolean).join(' · '),selectingMail?
            <Pressable accessibilityRole="checkbox" accessibilityState={{checked}} disabled={busy||(!checked&&selectedMail.length>=100)}
              onPress={()=>setSelectedMail(previous=>checked?previous.filter(id=>id!==item.id):[...previous,item.id])}
              style={[styles.button,{backgroundColor:colors.soft}]}>
              <Text style={{color:colors.ink}}>{checked?'Deselect message':'Select message'}</Text>
            </Pressable>:
            button(accountMessage('readEmail','Read email'),()=>run(async()=>setOpenMail({id:item.id,message:await api('inbox/'+item.id+'/view')}))));
        })}
        {inboxCursor&&button(accountMessage('olderEmail','Load older email'),()=>run(async()=>{
          const page=await api('inbox?cursor='+encodeURIComponent(inboxCursor));
          setMessages(previous=>[...previous,...page.messages]);setInboxCursor(page.nextCursor);
        }))}
        {account.externalMailLimits&&paragraph('External mail: '+account.externalMailLimits.usedToday+' / '+(account.externalMailLimits.daily??'unlimited')+' today · '+account.externalMailLimits.usedMonth+' / '+(account.externalMailLimits.monthly??'unlimited')+' this month')}
        <View style={styles.actions}>
        {account.canReceiveMail&&button('Create private email address',()=>setCreatingAlias(!creatingAlias))}
        {button('Mail clients',()=>navigate('mail-clients'))}
        </View>
        {creatingAlias&&<>{premiumAliases&&account.admin&&field('Address name (optional)',aliasName,setAliasName,{autoCapitalize:'none',maxLength:24})}{button('Create address',()=>run(async()=>{await api('mail/aliases',{name:aliasName||undefined});setCreatingAlias(false);setAliasName('');await load();},'Private address created.'))}</>}
        {aliases.length>0&&<Text accessibilityRole="header" style={[styles.label,{color:colors.ink}]}>{accountMessage('privateAddresses','Hide My Email addresses')}</Text>}
        {aliases.map(item=>row(item.address,item.address,[item.active?'On · '+(item.premium?'Premium address':'Private address'):'Off · Not receiving mail',item.clientLabel??(item.client.startsWith('dashboard')?'Created by you':item.client)].join(' · '),
          item.active?button(accountMessage('disableAddress','Disable address'),()=>confirm('Disable this address?','Future messages to this address will be rejected.',
            ()=>run(async()=>{await api('mail/aliases/'+item.address,{},'DELETE');await load();},'Private address disabled.'),
          )):<View style={styles.actions}>
            {button('Turn on',()=>run(async()=>{await api('mail/aliases/'+item.address,{active:true},'PUT');await load();},'Private address enabled.'))}
            {button('Delete address',()=>confirm('Permanently delete '+item.address+'?','Future messages to this address will be rejected.',
              ()=>run(async()=>{await api('mail/aliases/'+item.address+'?permanent=true',{},'DELETE');await load();},'Private address deleted.')))}
          </View>))}
        {account.canSendMail&&button(accountMessage('newEmail','New email'),()=>{setStatus('');setCompose(true);})}
        {compose&&<MailScreen colors={colors} close={()=>{if(!busy)setCompose(false);}}>
          <View style={styles.composeHeader}>
            <Text accessibilityRole="header" style={[styles.overviewTitle,{color:colors.ink,flex:1}]}>{accountMessage('newEmail','New email')}</Text>
            {button(accountMessage('cancel','Cancel'),()=>{setStatus('');setCompose(false);})}
          </View>
          {!account.externalMailSubmission&&paragraph('You can send to X-Center mailboxes.')}
          {paragraph('From: '+(sender||account.mailbox))}
          {aliases.some(item=>item.active&&item.premium)&&<>{button('Use primary address',()=>setSender(''))}{aliases.filter(item=>item.active&&item.premium).map(item=><View key={item.address}>{button(item.address,()=>setSender(item.address))}</View>)}</>}
          {field(accountMessage('recipient','Recipient'),recipient,setRecipient,{keyboardType:'email-address',autoCapitalize:'none',editable:!busy})}
          {field(accountMessage('subject','Subject'),subject,setSubject,{maxLength:120,editable:!busy})}
          {field(accountMessage('message','Message'),mailText,setMailText,{multiline:true,maxLength:30_000,editable:!busy})}
          {button(formatted?'Use plain text':'Format message',()=>setFormatted(value=>!value))}
          {formatted&&paragraph('Use **bold** or _italics_ in your message.')}
          {attachment ? button('Remove '+attachment.name,()=>setAttachment(undefined))
            : button('Attach a file (up to 256 KB)',()=>run(async()=>{
              const file=await pickDocumentAsync(256*1024);
              if(file)setAttachment(file);
            }))}
          {button(accountMessage('sendEmail','Send email'),()=>run(async()=>{
            await api('mail/send',{from:sender||undefined,to:recipient,subject,text:mailText,formatted,attachment});
            setRecipient('');setSubject('');setMailText('');setFormatted(false);setAttachment(undefined);
            setCompose(false);
          },'Mail accepted for delivery.'),busy||!recipient.trim()||!subject.trim()||!mailText.trim())}
          {status&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>}
        </MailScreen>}
      </>;
  }
  const statusMessage=status&&!compose&&!openMail?<Text accessibilityRole="alert" style={{color:colors.ink}}>{status}</Text>:null;
  if(section==='dashboard'||section==='admin')return <View style={styles.sectionStack}>{content}{statusMessage}</View>;
  return <Surface colors={colors}>{content}{statusMessage}</Surface>;
}

const styles=StyleSheet.create({
  adminAvatar:{width:44,height:44,borderRadius:22},
  mailScreen:{flex:1},
  mailContent:{width:'100%',maxWidth:680,alignSelf:'center'},
  composeHeader:{flexDirection:'row',alignItems:'center',gap:12},
  adminAction:{minHeight:44,flexDirection:'row',alignItems:'center',alignSelf:'flex-start',gap:7,borderWidth:1,borderRadius:10,paddingHorizontal:11,paddingVertical:7},
  finderToolbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  finderRow:{minHeight:52,flexDirection:'row',alignItems:'center',gap:7,borderTopWidth:1,paddingVertical:3},
  finderName:{flex:1,minWidth:0},
  finderInput:{minHeight:44,borderWidth:1,borderRadius:8,paddingHorizontal:8,fontSize:16},
  finderActions:{maxWidth:88,flexDirection:'row',flexWrap:'wrap',justifyContent:'flex-end'},
  fileToolbarButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  fileAction:{width:44,height:44,borderRadius:11,alignItems:'center',justifyContent:'center'},
  card:{gap:14,padding:16,borderRadius:20},
  sectionStack:{gap:14},
  overviewHero:{flexDirection:'row',alignItems:'center',gap:14,borderRadius:19,padding:20,backgroundColor:'#263b93'},
  heroContent:{flex:1,gap:6},
  heroSecondary:{color:'#e1e8ff'},
  overviewTitle:{fontSize:26,fontWeight:'800',letterSpacing:-0.6,color:'#f9fbff'},
  heroAvatar:{width:66,height:66,borderRadius:33,borderWidth:4,borderColor:'#aab9ea',backgroundColor:'#e0e7ff',alignItems:'center',justifyContent:'center'},
  heroButton:{flexDirection:'row',alignItems:'center',alignSelf:'flex-start',gap:8,minHeight:44,paddingHorizontal:12,borderRadius:10,backgroundColor:'#ffffff',marginTop:6},
  heroButtonText:{color:'#233887',fontWeight:'700',flexShrink:1},
  shortcutGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},
  overviewShortcut:{flexBasis:'47%',flexGrow:1,gap:6,borderWidth:1,borderRadius:14,padding:11},
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
