export const sharingIcons = [
  ['records','Records'],['folder','Folder'],['photo','Photo'],['calendar','Calendar'],
  ['location','Location'],['heart','Heart'],['shield','Shield'],
] as const;

export type SharingRequest = {
  source: string;
  collection: string;
  label: string;
  name?: string;
  description?: string;
  icon?: (typeof sharingIcons)[number][0];
};
export type SharingSource = {client: string; name: string; collections: string[]};
export type SharingConfig = {shared: string[]; requests: SharingRequest[]};
export const blankRequest = (): SharingRequest => ({source:'',collection:'',label:''});

export function cleanSharing({shared,requests}: SharingConfig): SharingConfig {
  return {
    shared:shared.map(item=>item.trim()).filter(Boolean),
    requests:requests.map(({source,collection,label,name,description,icon})=>({
      source,collection,label:label.trim(),...(name?.trim()?{name:name.trim()}:{}),
      ...(description?.trim()?{description:description.trim()}:{}),...(icon?{icon}:{}),
    })),
  };
}

export type SharingEditorProps = {
  value: SharingConfig;
  onChange: (value: SharingConfig) => void;
  sources: SharingSource[];
  canPublish: boolean;
};
