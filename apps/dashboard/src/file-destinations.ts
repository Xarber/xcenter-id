export type FolderDestination = {id:string;name:string;parent:string|null};

export function destinationLabels(folders:FolderDestination[],excluded?:string){
  const byId=new Map(folders.map(folder=>[folder.id,folder]));
  return folders.flatMap(folder=>{
    const labels=[];
    let node:FolderDestination|undefined=folder;
    while(node&&labels.length<8){
      if(node.id===excluded)return [];
      labels.unshift(node.name);
      node=node.parent?byId.get(node.parent):undefined;
    }
    return [{id:folder.id,label:labels.join(' / ')}];
  }).sort((left,right)=>left.label.localeCompare(right.label));
}
