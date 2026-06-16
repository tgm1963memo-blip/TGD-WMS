import { isGoLivePresentationEnabled } from './goLivePresentation.js';

export function isProductionPresentationActive() {
  return isGoLivePresentationEnabled();
}

export function getPageShellClassName(base = 'page-shell') {
  return isGoLivePresentationEnabled() ? `${base} page-shell--golive` : base;
}
