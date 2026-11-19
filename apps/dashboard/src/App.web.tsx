import TrustBadges from './TrustBadges.web';
import {introduction} from './introduction';
import MailClients from './MailClients.web';
import ApplicationStorage from './ApplicationStorage.web';
import DeveloperDocumentation from './DeveloperDocumentation.web';
import PreferenceControls from './PreferenceControls.web';
import {parsePreferences,preferencesKey,type Preferences} from './preferences';
import {setAccountLanguage} from './account-locale';
import Reauthenticate from './Reauthenticate.web';
import { SupportPage } from './Support.web';
import FriendsPage from './FriendsPage.web';
import { accountMessage } from './account-locale';
import { accountGreeting, accountShortcuts, accountStatus } from './account-overview';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import {
  Menu, ArrowDownRight, ArrowLeft, ArrowRight, ChevronRight, CircleHelp, Code2, Fingerprint, FolderOpen,
  Grid2X2, HardDrive, IdCard, KeyRound, Laptop, LockKeyhole, LogOut, Mail, MapPin, Settings, ShieldCheck, UserRound, X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import DeveloperPortal from './DeveloperPortal';
import { AdminPage, ConnectedApps, DevicesPage, FilesPage, MailPage } from './AccountSections.web';
import PermissionsPage from './PermissionsPage.web';
import ProfilePage from './ProfilePage.web';
import { api, type Account } from './web-account';
import { sample } from './sample';
import './account-web.css';

const sections = [
  ['dashboard','Overview',Grid2X2],['profile','Profile',UserRound],['devices','Devices',Laptop],
  ['security','Sign-in & security',KeyRound],['apps','Apps',LayersIcon],['permissions','Permissions',ShieldCheck],
  ['storage','Data usage',HardDrive],['files','Files',FolderOpen],['friends','Friends',UserRound],['mail','Mail',Mail],['settings','Settings',Settings],
] as const;
function LayersIcon(props:{size?:number}){return <Grid2X2 {...props}/>;}
const titles:Record<string,[string,string]> = {
  'mail-clients':['Mail clients','Manage access for your email applications.'],
  support:['Support','Send feedback or get help with your X-Center ID.'],
  profile:['Your profile','Manage the personal details associated with your X-Center ID.'],
  devices:['Your devices','Review where you are signed in.'],
  security:['Sign-in & security','Manage the passkeys that protect your account.'],
  apps:['Apps','Find the apps and integrations available with X-Center ID.'],
  permissions:['Permissions','Choose what your apps can access.'],
  storage:['Data usage','Review storage used by your account files.'],
  friends:['Friends','Manage invitations and shared files.'],
  files:['File browser','Upload, download and manage files stored in your account.'],
  mail:['Mail','Manage your X-Center mailbox.'],
  settings:['Settings','Manage your X-Center ID experience.'],
  developer:['Developer apps','Register and verify apps that use X-Center ID.'],
  admin:['Administration','Manage X-Center ID account entitlements.'],
};
const introKey='authnjs.dashboard.onboarding.v1';

function Logo({href='/dashboard'}:{href?:string}){
  return <a href={href} className="xc-brand"><img src="/authnjs-icon.svg" alt=""/><span>X-Center <b>ID</b></span></a>;
}

function Intro({close}:{close:()=>void}){
  const [step,setStep]=useState(0);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{dialog.current?.showModal();},[]);
  const page=introduction[step];
  const Icon=[UserRound,Grid2X2,ShieldCheck,Code2][step];
  return <dialog className="xc-intro" ref={dialog} aria-labelledby="intro-title" onCancel={event=>{event.preventDefault();close();}}>
    <button type="button" className="xc-close" aria-label="Close introduction" onClick={close}><X size={20}/></button>
    <div className="xc-stack" aria-live="polite"><span className="xc-symbol xc-sky"><Icon size={24}/></span>
      <small>{step+1} of {introduction.length}</small><h2 id="intro-title">{page.title}</h2><p>{page.description}</p></div>
    <div className="xc-actions">{step>0&&<button className="xc-button xc-secondary" onClick={()=>setStep(step-1)}>Back</button>}
      <button className="xc-button xc-primary" onClick={()=>step===introduction.length-1?close():setStep(step+1)}>{step===introduction.length-1?'Open dashboard':'Next'} <ArrowRight size={16}/></button></div>
  </dialog>;
}

function SignIn({signup,busy,notice,authenticate,beginUsername,submitCode,create,continuation}:{
  signup:boolean;busy:boolean;notice:string;authenticate:(username?:string)=>void;
  beginUsername:(username:string)=>Promise<{method:string;ticket?:string}|undefined>;
  submitCode:(ticket:string,code:string)=>void;create:(username:string)=>void;continuation:string|null;
}){
  const [username,setUsername]=useState('');
  const [ticket,setTicket]=useState('');
  const [code,setCode]=useState('');
  const [offerPasskey,setOfferPasskey]=useState(false);
  const [motionPaused,setMotionPaused]=useState(false);
  const suffix=continuation?'?continue='+encodeURIComponent(continuation):'';
  return <div className="xc-auth">
    <header><Logo href="/"/><a href="/docs" className="xc-text-link">Developer documentation <ArrowDownRight size={15}/></a></header>
    <div className="xc-auth-grid">
      <div className="xc-auth-visual">
        <div className="xc-constellation" aria-hidden="true" data-paused={motionPaused}>
          <div className="xc-orbit xc-orbit-inner"/><div className="xc-orbit xc-orbit-outer"/>
          <div className="xc-auth-mark"><img src="/authnjs-icon.svg" alt=""/></div>
          <div className="xc-orbit-track">
            <div className="xc-service xc-service-mail"><Mail/></div>
            <div className="xc-service xc-service-files"><FolderOpen/></div>
            <div className="xc-service xc-service-places"><MapPin/></div>
            <div className="xc-service xc-service-apps"><Grid2X2/></div>
            <div className="xc-service xc-service-device"><Laptop/></div>
            <div className="xc-service xc-service-lock"><LockKeyhole/></div>
          </div>
        </div>
        <button className="xc-orbit-control" type="button" onClick={()=>setMotionPaused(value=>!value)}>{motionPaused?'Resume animation':'Pause animation'}</button>
        <div className="xc-auth-caption"><p>One account for X-Center</p><span>Profile, devices, and apps in one place.</span></div>
      </div>
      <div className="xc-card xc-auth-card">
        <span className="xc-symbol xc-lavender">{signup?<IdCard size={24}/>:<Fingerprint size={24}/>}</span>
        <h1>{signup?'Create your X-Center ID':'Sign in to X-Center ID'}</h1>
        <p>{signup?'Choose your username, then save a passkey for it.':'Use your username or sign in directly with a passkey.'}</p>
        {signup ? <form onSubmit={event=>{event.preventDefault();create(username);}}>
          <label>X-Center username<input name="username" autoComplete="username" spellCheck={false}
            pattern="[A-Za-z][A-Za-z0-9]{2,23}" maxLength={24} required value={username} onChange={event=>setUsername(event.target.value)}/></label>
          <button type="submit" className="xc-button xc-primary xc-full" disabled={busy||!username.trim()}>
            <Fingerprint size={19}/>{busy?'Waiting for your passkey…':'Choose username and create passkey'}<ArrowRight size={17}/>
          </button>
        </form> : <>
          {ticket?<form onSubmit={event=>{event.preventDefault();submitCode(ticket,code);}}>
            <label>Email sign-in code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
              value={code} onChange={event=>setCode(event.target.value)} required/></label>
            <p>Check your verified email for a six-digit code.</p>
            <button className="xc-button xc-primary xc-full" disabled={busy||code.length!==6}>Verify code <ArrowRight size={17}/></button>
            <button type="button" className="xc-button xc-secondary" onClick={()=>{setTicket('');setCode('');}}>Use a different username</button>
          </form>:<form onSubmit={event=>{
            event.preventDefault();
            if(offerPasskey){authenticate(username);return;}
            void beginUsername(username).then(result=>{
              if(result?.ticket)setTicket(result.ticket);
              else if(result?.method==='passkey')setOfferPasskey(true);
            });
          }}>
            <label>X-Center username<input autoComplete="username webauthn" name="username" spellCheck={false}
              value={username} onChange={event=>{setUsername(event.target.value);setOfferPasskey(false);}} placeholder="Your username" required/></label>
            {offerPasskey&&<p>Use a passkey to sign in to this account.</p>}
            <button className="xc-button xc-primary xc-full" disabled={busy || !username.trim()}>{offerPasskey?'Use passkey':'Continue'} <ArrowRight size={17}/></button>
          </form>}
          <div className="xc-divider"><span>or</span></div>
          <button type="button" className="xc-button xc-secondary xc-full" disabled={busy} onClick={()=>authenticate()}>
            <Fingerprint size={19}/>{busy?'Waiting for your passkey…':'Sign in with a passkey'}
          </button>
        </>}
        {notice && <p className="xc-notice" role="alert">{notice}</p>}
        <div className="xc-auth-footer">{signup?'Already have an account?':'New to X-Center?'}{' '}
          <a href={(signup?'/signin':'/signup')+suffix}>{signup?'Sign in':'Create an account'}</a></div>
      </div>
    </div>
  </div>;
}

type NamedPasskey = {id:string;label:string};

function Security({account,update,addPasskey}:{account:Account;update:()=>Promise<void>;addPasskey:()=>Promise<NamedPasskey>}){
  const [editing,setEditing]=useState<NamedPasskey|null>(null);
  const [status,setStatus]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  async function act(task:()=>Promise<void>){
    setBusy(true);
    setStatus('');
    try { await task(); }
    catch(error) { setStatus(error instanceof Error?error.message:'Action failed.'); }
    finally { setBusy(false); }
  }
  return <section className="xc-card xc-pad">
    <div className="xc-row-head"><span className="xc-symbol xc-mint"><Fingerprint size={22}/></span><div>
      <h2>Passkeys</h2><p>Use a device passkey or physical security key to sign in.</p></div></div>
    {account.passkeys.map(key=><div className="xc-list-row" key={key.id}>
      <div className="xc-row-head"><KeyRound size={19}/><strong>{key.label}</strong></div>
      <div className="xc-actions">
        <button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>{setEditing(key);setConfirm('');}}>Rename</button>
        {account.passkeys.length>1&&<button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>{
          if(confirm!==key.id){setConfirm(key.id);return;}
          void act(async()=>{await api('passkey/remove',{id:key.id});await update();setConfirm('');setEditing(null);setStatus('Passkey removed.');});
        }}>{confirm===key.id?'Confirm removal':'Remove'}</button>}
      </div>
    </div>)}
    {editing?<form className="xc-inline-form" onSubmit={event=>{
      event.preventDefault();
      void act(async()=>{await api('passkey/rename',{id:editing.id,name:editing.label});await update();setEditing(null);setStatus('Passkey name saved.');});
    }}>
      <label>Passkey name<input required value={editing.label} onChange={event=>setEditing({...editing,label:event.target.value})} maxLength={64}/></label>
      <button className="xc-button xc-primary" disabled={busy}>Save name</button>
      <button type="button" className="xc-button xc-secondary" disabled={busy} onClick={()=>setEditing(null)}>Done</button>
    </form>:<button type="button" className="xc-button xc-primary" disabled={busy} onClick={()=>void act(async()=>{
      setConfirm('');
      setEditing(await addPasskey());
      setStatus('Passkey added. Review its suggested name.');
    })}><KeyRound size={16}/> Add passkey</button>}
    {status&&<p role="status">{status}</p>}
  </section>;
}

export default function WebApp(){
  const [sidebar,setSidebar]=useState(false);
  const sidebarRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!sidebar)return;
    const previous=document.activeElement as HTMLElement|null;
    const links=()=>Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a,button')??[]);
    links()[0]?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setSidebar(false);}
      if(event.key==='Tab'){
        const choices=links(),first=choices[0],last=choices.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',key);
    return ()=>{document.removeEventListener('keydown',key);previous?.focus();};
  },[sidebar]);
  const [preferences,setPreferences]=useState(()=>{try{return parsePreferences(localStorage.getItem(preferencesKey));}catch{return parsePreferences(null);}});
  setAccountLanguage(preferences.language);
  useEffect(()=>{document.documentElement.dataset.theme=preferences.theme;document.documentElement.lang=preferences.language==='system'?navigator.language:preferences.language;},[preferences]);
  function changePreferences(value:Preferences){setAccountLanguage(value.language);setPreferences(value);try{localStorage.setItem(preferencesKey,JSON.stringify(value));}catch{}}
  const [account,setAccount]=useState<Account|null|undefined>(undefined);
  const [locked,setLocked]=useState(false);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [intro,setIntro]=useState(false);
  const [sampleMode,setSampleMode]=useState(false);
  const [dev,setDev]=useState(false);
  const taps=useRef(0);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const didShow=useRef(false);
  const path=window.location.pathname.replace(/^\//,'')||'dashboard';
  const permissionRoute=/^permissions\/([A-Za-z0-9_-]{1,100})$/.exec(path);
  const profileSection=/^profile\/(visibility|username|developer)$/.exec(path)?.[1];
  const invite=new URLSearchParams(window.location.hash.slice(1)).get('invite');
  const friendReturn=path==='friends'&&invite&&/^(?:[A-Za-z2-9]{10}|[A-Za-z0-9_-]{32})$/.test(invite)?'/friends#invite='+invite:'';
  const mailRoute=/^mail\/[0-9a-f-]{36}$/.test(path);
  const next=path==='native-session'||path==='reauth'?window.location.pathname+window.location.search:
    new URLSearchParams(window.location.search).get('continue')??(friendReturn||(permissionRoute||mailRoute||profileSection?'/'+path:''));
  const nativeReturn=/^\/native-session\?challenge=[A-Za-z0-9_-]{43}&state=[A-Za-z0-9_-]{43}$/;
  const continuation=/^\/friends#invite=(?:[A-Za-z2-9]{10}|[A-Za-z0-9_-]{32})$/.test(next)||/^\/profile\/(?:visibility|username|developer)$/.test(next)||/^\/reauth\?request=[A-Za-z0-9_-]{43}$/.test(next)||/^\/interaction\/[A-Za-z0-9_-]{10,160}$/.test(next)||nativeReturn.test(next)||/^\/permissions\/[A-Za-z0-9_-]{1,100}$/.test(next)||/^\/mail\/[0-9a-f-]{36}$/.test(next)?next:null;
  const emailToken=new URLSearchParams(window.location.hash.slice(1)).get('verify-email');
  const authDestination=emailToken?'/profile'+window.location.hash:continuation??'/dashboard';
  async function load(){const result=await api('me');setAccount(result.account);setLocked(!!result.locked);}
  useEffect(()=>{
    void load().catch(()=>{setNotice('The account service is temporarily unavailable.');setAccount(null);});
    return ()=>{if(timer.current)clearTimeout(timer.current);};
  },[]);
  useEffect(()=>{
    if(!account?.profile||path!=='dashboard'||didShow.current||continuation)return;
    didShow.current=true;
    try{
      if(!localStorage.getItem(introKey)){localStorage.setItem(introKey,'complete');setIntro(true);}
    }catch{ /* Without storage, the introduction remains available in Settings. */ }
  },[account?.profile,path,continuation]);

  useEffect(()=>{
    if(account?.profile&&continuation&&['signin','signup','dashboard'].includes(path)) window.location.replace(authDestination);
  },[account?.profile,continuation,path,authDestination]);

  async function passkey(mode:'signup'|'login'|'add',value?:string){
    const optionsJSON=await api(mode+'/options',mode==='add'?{name:value}:{username:value});
    const response=mode==='login'?await startAuthentication({optionsJSON}):await startRegistration({optionsJSON});
    const result=await api(mode+'/finish',{response});
    await load();
    return result.passkey as NamedPasskey;
  }
  function login(mode:'signup'|'login',value?:string){
    setNotice('');setBusy(true);
    void passkey(mode,value).then(()=>{
      const target=mode==='signup'?'/profile':(emailToken?'/profile':'/dashboard');
      window.location.assign(target+(continuation?'?continue='+encodeURIComponent(continuation):'')+window.location.hash);
    }).catch(error=>setNotice(error?.name==='NotAllowedError'?'The passkey request was canceled. Try again when ready.':error?.message??'Sign-in could not be completed.'))
      .finally(()=>setBusy(false));
  }
  async function beginUsername(username:string){
    setBusy(true);setNotice('');
    try {return await api('login/username',{username});}
    catch(error){setNotice(error instanceof Error?error.message:'Could not find this account.');}
    finally{setBusy(false);}
  }
  function submitCode(ticket:string,code:string){
    setBusy(true);setNotice('');
    void api('login/code',{ticket,code}).then(()=>window.location.replace(authDestination))
      .catch(error=>setNotice(error.message)).finally(()=>setBusy(false));
  }
  if(path==='docs')return <DeveloperDocumentation/>;
  if(account===undefined)return <div className="xc-loading"><Logo href="/"/><p role="status">Opening your account…</p></div>;
  if(locked)return <main className="xc-setup"><Logo href="/"/><h1>Account locked</h1><SupportPage/>
    {nativeReturn.test(path==='native-session'?window.location.pathname+window.location.search:continuation??'')&&
      <button className="xc-button xc-secondary" disabled={busy} onClick={()=>{
        const target=path==='native-session'?window.location.pathname+window.location.search:continuation!;
        const params=new URL(target,window.location.origin).searchParams;setBusy(true);
        void api('native/authorize',{challenge:params.get('challenge'),state:params.get('state')})
          .then(result=>window.location.assign(result.location)).catch(error=>setNotice(error.message)).finally(()=>setBusy(false));
      }}>Return to the app</button>}
    <button className="xc-button xc-secondary" onClick={()=>window.location.reload()}>Check again</button>
    <button className="xc-button xc-secondary" onClick={()=>void api('logout',{}).then(()=>window.location.assign('/signin')).catch(error=>setNotice(error.message))}>Sign out</button>
    {notice&&<p role="alert">{notice}</p>}</main>;
  if(!account)return <SignIn signup={path==='signup'} continuation={continuation} busy={busy} notice={notice} authenticate={username=>login('login',username)} beginUsername={beginUsername} submitCode={submitCode} create={username=>login('signup',username)}/>;

  if(path==='native-session'&&account.profile){
    const params=new URLSearchParams(window.location.search);
    const challenge=params.get('challenge');
    const state=params.get('state');
    const valid=!!challenge&&!!state&&nativeReturn.test('/native-session?challenge='+challenge+'&state='+state);
    return <div className="xc-setup"><Logo href="/"/><section className="xc-card xc-pad xc-stack">
      <h1>Sign in to X-Center ID on your device</h1>
      <p>Continue as {account.profile.givenName} {account.profile.surname}.</p><TrustBadges verified={account.verified} admin={account.admin}/>
      {valid?<button className="xc-button xc-primary" disabled={busy} onClick={()=>{
        setBusy(true);
        void api('native/authorize',{challenge,state}).then(({location})=>window.location.assign(location))
          .catch(error=>setNotice(error.message)).finally(()=>setBusy(false));
      }}>Return to the app <ArrowRight size={17}/></button>:<p>Start sign-in from the X-Center ID app.</p>}
      {notice&&<p role="alert">{notice}</p>}
    </section></div>;
  }
  if(path==='reauth')return <main className="xc-setup"><Logo href="/"/><Reauthenticate
    request={new URLSearchParams(window.location.search).get('request')??undefined}
    complete={()=>{const target=new URLSearchParams(window.location.search).get('continue');
      window.location.assign(target&&/^\/native-session\?challenge=[A-Za-z0-9_-]{43}&state=[A-Za-z0-9_-]{43}$/.test(target)?target:'/admin');}}/></main>;
  const profile=account.profile;
  if(!profile) return <div className="xc-setup"><Logo href="/"/><div className="xc-page-title">
    <span className="xc-pill"><Fingerprint size={15}/> Passkey saved</span><h1>Set up your profile</h1>
    <p>Add your personal details to finish setup.</p></div>
    <ProfilePage account={account} update={load} complete={()=>{
      window.location.assign(continuation??'/dashboard');
    }}/></div>;

  const name=profile.givenName+' '+profile.surname;
  const picture=profile.hasPicture?'/account/avatar':null;
  const permissionClient=permissionRoute?.[1];
  const storageRoute=/^developer\/storage\/([0-9a-f-]{36})$/.exec(path)?.[1];
  const page=profileSection?'profile':storageRoute?'developer':path==='signin'||path==='signup'?'dashboard':permissionClient?'permissions':mailRoute?'mail':path.startsWith('admin/users/')?'admin':path;
  const [title,summary]=titles[page]??[accountMessage('overviewTitle','Account overview'),accountMessage('overviewSummary','Manage the details, devices, and apps connected to your X-Center ID.')];
  const shortcutIcons = {
    profile:[UserRound,'xc-sky'],security:[Fingerprint,'xc-mint'],
    permissions:[ShieldCheck,'xc-lavender'],devices:[Laptop,'xc-sky'],
  } as const;

  let content:ReactNode;
  if(storageRoute)content=<ApplicationStorage id={storageRoute} admin={account.admin}/>;
  else if(page==='profile')content=<>
    {emailToken&&<section className="xc-card xc-pad"><h2>Verify your email</h2>
      <button type="button" className="xc-button xc-primary" onClick={()=>void api('email/confirm',{token:emailToken}).then(async()=>{
        window.history.replaceState(null,'','/profile');await load();setNotice('Email verified.');
      }).catch(error=>setNotice(error.message))}>Confirm this email address</button></section>}
    <ProfilePage account={account} update={load} section={profileSection}/>
  </>;
  else if(page==='permissions')content=<PermissionsPage client={permissionClient}/>;
  else if(page==='devices')content=<DevicesPage/>;
  else if(page==='friends')content=<FriendsPage/>;
  else if(page==='files'||page==='storage')content=<FilesPage key={page} summary={page==='storage'}/>;
  else if(page==='mail-clients')content=<MailClients/>;
  else if(page==='mail')content=<MailPage account={account}/>;
  else if(page==='security')content=<Security account={account} update={load} addPasskey={()=>passkey('add')}/>;
  else if(page==='support')content=<SupportPage/>;
  else if(page==='admin')content=account.admin?<AdminPage/>:<section className="xc-card xc-pad">Administrator access is required.</section>;
  else if(page==='developer')content=<section className="xc-card xc-pad"><DeveloperPortal back={()=>window.location.assign('/apps')}/></section>;
  else if(page==='apps')content=<><section className="xc-card"><ConnectedApps/></section><section className="xc-card xc-pad">
    <div className="xc-row-head"><span className="xc-symbol xc-lavender"><Grid2X2 size={22}/></span><div><h2>Apps using X-Center ID</h2><p>Manage your connected apps or register your own integration.</p></div></div>
    <div className="xc-list-row"><div><strong>Integration guide</strong><p>Set up sign-in and use the API from any platform.</p></div><a className="xc-button xc-secondary" href="/docs#manual"><Code2 size={16}/> Developer docs</a></div>
    <div className="xc-list-row"><div><strong>Developer portal</strong><p>Register or review your applications.</p></div><a className="xc-button xc-secondary" href="/developer"><Code2 size={16}/> Developer apps</a></div>
  </section></>;
  else if(page==='settings')content=<><PreferenceControls value={preferences} change={changePreferences}/><section className="xc-card xc-pad">
    <div className="xc-list-row"><span>Mail app access</span><a className="xc-button xc-secondary" href="/mail-clients">Manage mail clients</a></div>
    <div className="xc-list-row"><span>Feedback and support</span><a className="xc-button xc-secondary" href="/support">Contact support</a></div>
    <div className="xc-list-row"><div className="xc-row-head"><CircleHelp size={22}/><div><strong>Introduction</strong><p>See how your X-Center ID works.</p></div></div><button className="xc-button xc-secondary" onClick={()=>setIntro(true)}>View introduction</button></div>
    <div className="xc-list-row"><div><strong>App version</strong><p>X-Center ID for web</p></div><button className="xc-button xc-secondary" onClick={()=>{
      taps.current+=1;
      if(timer.current) clearTimeout(timer.current);
      if(taps.current>=3){taps.current=0;setDev(true);}
      timer.current=setTimeout(()=>{setDev(false);setSampleMode(false);taps.current=0;},30000);
    }}>0.1.0</button></div>
    {dev&&<div className="xc-stack"><h2>Developer Options</h2><a href="/samples">Open sample integrations</a>
      <button className="xc-button xc-secondary" onClick={()=>setSampleMode(!sampleMode)}>{sampleMode?'Exit sample dashboard':'Open sample dashboard'}</button>
      {sampleMode&&<div className="xc-sample"><span className="xc-pill">Sample data</span><h2>Sample dashboard</h2>
        {Object.entries(sample).map(([section,items])=><div key={section}><h3>{section}</h3>{items.map(item=><p key={item.id}>{item.title} · {item.detail}</p>)}</div>)}</div>}
    </div>}
  </section></>;
  else content=<>
    <section className="xc-hero">
      <div><p className="xc-kicker">{accountMessage('personalAccount','Personal account')}</p><h2>{accountGreeting(profile.givenName)}</h2><p>@{profile.username}</p><TrustBadges verified={account.verified} admin={account.admin}/>
        <a className="xc-button xc-hero-button" href="/profile">{accountMessage('viewProfile','View profile')} <ArrowRight size={16}/></a></div>
      <div className="xc-avatar xc-hero-avatar">{picture?<img src={picture} alt=""/>:<UserRound size={43}/>}</div>
    </section>
    <section className="xc-shortcuts" aria-label="Account shortcuts">
      {accountShortcuts().map(({id,label,description})=>{
        const [Icon,tint]=shortcutIcons[id];
        return <a className="xc-card xc-shortcut" key={id} href={'/'+id}>
          <span className={'xc-symbol '+tint}><Icon size={22}/></span><div><h2>{label}</h2><p>{description}</p></div><ChevronRight className="xc-arrow" size={19}/>
        </a>;
      })}
    </section>
    <section className="xc-card xc-pad xc-account-status"><div className="xc-row-head"><span className="xc-symbol xc-mint"><ShieldCheck size={22}/></span>
      <div><h2>{accountMessage('accountStatus','Account status')}</h2><p>{accountStatus(account.passkeys.length,account.emails.filter(email=>email.verified).length)}</p></div></div>
    </section>
  </>;

  return <div className="xc-shell">
    <header className="xc-topbar"><button className="xc-icon-link xc-menu-toggle" aria-label={sidebar?'Close page sidebar':'Open page sidebar'} aria-expanded={sidebar} onClick={()=>setSidebar(!sidebar)}><Menu size={23}/></button><Logo/><div className="xc-top-actions">
      <a href="/settings" className="xc-icon-link" aria-label="Open settings"><Settings size={20}/></a>
      <a href="/profile" className="xc-avatar" aria-label="Open profile">{picture?<img src={picture} alt=""/>:<UserRound size={19}/>}</a>
    </div></header>
    {sidebar&&<button className="xc-nav-backdrop" aria-label="Close page sidebar" onClick={()=>setSidebar(false)}/>}
    <aside className="xc-side" data-open={sidebar} ref={sidebarRef}>
      <nav aria-label="Account sections">{sections.map(([id,label,Icon])=><a key={id} href={'/'+id} aria-current={page===id?'page':undefined}><Icon size={19}/><span>{accountMessage(id,label)}</span></a>)}
        {account.admin&&<a href="/admin" aria-current={page==='admin'?'page':undefined}><ShieldCheck size={19}/><span>Administration</span></a>}
      </nav>
      <button type="button" className="xc-signout" onClick={()=>void api('logout',{}).then(()=>window.location.assign('/signin')).catch(error=>setNotice(error.message))}><LogOut size={18}/> Sign out</button>
    </aside>
    <main className="xc-main">
      <div className="xc-page-title"><h1>{title}</h1><p>{summary}</p></div>
      {notice&&<p className="xc-notice" role="status">{notice}</p>}
      {content}
    </main>
    <nav className="xc-bottom" aria-label="Main screens">{[
      ['dashboard','Account',UserRound],['apps','Apps',Grid2X2],['settings','Settings',Settings],...(account.admin?[['admin','Admin',ShieldCheck]]:[]),
    ].map(([id,label,Icon])=>{const ItemIcon=Icon as typeof UserRound;const selected=id==='dashboard'?!['apps','permissions','developer','settings','support','mail-clients','admin'].includes(page):id==='apps'?['apps','permissions','developer'].includes(page):id==='settings'?['settings','support','mail-clients'].includes(page):page==='admin';return <a key={String(id)} href={'/'+id} aria-current={selected?'page':undefined}><ItemIcon size={22}/><span>{String(label)}</span></a>;})}</nav>
    {intro&&<Intro close={()=>setIntro(false)}/>}
  </div>;
}
