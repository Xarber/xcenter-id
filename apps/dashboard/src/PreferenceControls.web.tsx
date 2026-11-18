import {languages,type Preferences} from './preferences';
export default function PreferenceControls({value,change}:{value:Preferences;change:(value:Preferences)=>void}){
 return <section className="xc-card xc-pad xc-stack"><h2>Appearance and language</h2>
 <label>Language<select aria-label="Language" value={value.language} onChange={e=>change({...value,language:e.target.value})}>{languages.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label>Theme<select aria-label="Theme" value={value.theme} onChange={e=>change({...value,theme:e.target.value as Preferences['theme']})}><option value="system">Follow device</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
 <p>These preferences are saved on this device.</p></section>;
}
