import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';

export function UatOnly({ children }) {
  if (isGoLivePresentationEnabled()) {
    return null;
  }

  return children;
}
