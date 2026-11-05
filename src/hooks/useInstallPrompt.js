import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'tgd_install_prompt_dismissed';

// Chrome fires this once, usually before the handheld menu has mounted, so
// it has to be caught at module load rather than inside the hook.
let deferredPrompt = null;
const subscribers = new Set();

function publish(event) {
  deferredPrompt = event;
  subscribers.forEach((notify) => notify(event));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    publish(event);
  });
  window.addEventListener('appinstalled', () => publish(null));
}

function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// iPadOS Safari reports itself as a Mac, hence the touch check.
function isIos() {
  const { userAgent, platform, maxTouchPoints } = window.navigator;
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

// `mode` is 'prompt' (Android/desktop Chrome can install on a tap), 'ios'
// (Safari has no install API, so show the Add to Home Screen steps) or null.
export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(deferredPrompt);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    subscribers.add(setPromptEvent);
    return () => subscribers.delete(setPromptEvent);
  }, []);

  let mode = null;
  if (!dismissed && !isInstalled()) {
    if (promptEvent) mode = 'prompt';
    else if (isIos()) mode = 'ios';
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Storage blocked: it just asks again next launch.
    }
  }

  async function install() {
    await promptEvent?.prompt();
    publish(null);
  }

  return { mode, install, dismiss };
}
