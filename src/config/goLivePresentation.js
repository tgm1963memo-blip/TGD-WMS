export function isGoLivePresentationEnabled() {
  if (import.meta.env.VITE_GO_LIVE_PRESENTATION === 'false') {
    return false;
  }

  if (import.meta.env.VITE_GO_LIVE_PRESENTATION === 'true') {
    return true;
  }

  return import.meta.env.PROD;
}
