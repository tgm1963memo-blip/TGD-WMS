import { isGoLivePresentationEnabled } from './goLivePresentation.js';

export function isProductionPresentationActive() {
  return isGoLivePresentationEnabled();
}

export function getPageShellClassName(base = 'page-shell') {
  const normalized = String(base).trim();
  return isGoLivePresentationEnabled() ? `${normalized} page-shell--golive` : normalized;
}