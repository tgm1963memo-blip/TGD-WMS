import { isGoLivePresentationEnabled } from './goLivePresentation.js';

const GO_LIVE_HIDDEN_GROUPS = new Set(['customer_ops_demo']);
const GO_LIVE_HIDDEN_ITEMS = new Set(['users_and_roles']);

export function isNavigationGroupVisible(groupKey) {
  if (isGoLivePresentationEnabled() && GO_LIVE_HIDDEN_GROUPS.has(groupKey)) {
    return false;
  }
  return true;
}

export function isNavigationItemVisible(itemKey) {
  if (isGoLivePresentationEnabled() && GO_LIVE_HIDDEN_ITEMS.has(itemKey)) {
    return false;
  }
  return true;
}
