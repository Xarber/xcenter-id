import releases from './release-history.json';

export const releaseHistory=releases;
export const currentRelease=releases[0];
export const seenReleaseKey='authnjs.dashboard.lastRelease';
export const onboardingKey='authnjs.dashboard.onboarding.v1';
export const enteredKey='authnjs.dashboard.entered';
export type Release=typeof currentRelease;

export function releaseByVersion(version:string){
  return releaseHistory.find(release=>release.version===version);
}

export function releaseStatus(release:Release){
  return release.status;
}

export function releaseOverview(release:Release){
  const features=release.features.slice(0,3);
  if(features.length<3&&release.fixes.length){
    features.push(['shield','Fixes & Improvements',release.fixes[0]]);
  }
  return features;
}

export function releaseAnnouncement(previous:string|null){
  if(previous===currentRelease.version)return [];
  const previousIndex=releaseHistory.findIndex(release=>release.version===previous);
  if(previousIndex<1)return releaseOverview(currentRelease);
  const releases=releaseHistory.slice(0,previousIndex);
  const features=releases.flatMap(release=>release.features);
  return features.length ? features.slice(0,3) : releaseOverview(currentRelease);
}
