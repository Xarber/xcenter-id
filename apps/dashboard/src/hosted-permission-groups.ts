export type HostedPermission={
  source:string;destination:string;collection:string;label:string;
  sourceName:string;destinationName:string;sourceIcon?:string;destinationIcon?:string;enabled:boolean;unsecure?:boolean;
};
export const permissionDirections=[
  ['destination','Data this app can access','No incoming data access.'],
  ['source','Data shared from this app','No outgoing data access.'],
] as const;

export function groupHostedPermissions(items:HostedPermission[],client:string,direction:'source'|'destination'){
  const groups=new Map<string,{id:string;name:string;icon?:string;permissions:HostedPermission[]}>();
  for(const item of items){
    if(item[direction]!==client)continue;
    const incoming=direction==='destination';
    const id=incoming?item.source:item.destination;
    let group=groups.get(id);
    if(!group){
      group={id,name:incoming?item.sourceName:item.destinationName,
        icon:incoming?item.sourceIcon:item.destinationIcon,permissions:[]};
      groups.set(id,group);
    }
    group.permissions.push(item);
  }
  return [...groups.values()];
}
