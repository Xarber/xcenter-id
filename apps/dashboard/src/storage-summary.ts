import {formatStorage} from './storage-size.mjs';
export const storageCategories = [
  ['files','Files','#4875ec'],
  ['account','Account information','#9473d6'],
  ['security','Security metadata','#278f75'],
  ['apps','App data and metadata','#bd6b29'],
  ['mail','Mail','#c2547a'],
] as const;

export const formatBytes=formatStorage;
