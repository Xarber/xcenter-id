const sampleClients=new Set(['places-demo','trips-demo','notes-external','trips-external']);
export const isSampleClient=(client:string)=>sampleClients.has(client);
