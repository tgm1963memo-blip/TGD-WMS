import React, { createContext, useContext, useEffect, useState } from 'react';
import { getStoredAuthSession, subscribeToStagingAuth } from '../../services/stagingAuthService.js';

const AuthContext = createContext({
  session: null,
  loading: true,
  error: null,
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    // Only use subscribeToStagingAuth to avoid deadlocking GoTrueClient.
    // supabase-js will immediately fire an INITIAL_SESSION event.

    // With an expired token and no signal that event waits out the refresh
    // retries, which can take many seconds, so don't hold the app for it.
    if (navigator.onLine === false) {
      const stored = getStoredAuthSession();
      if (stored) {
        setSession(stored);
        setLoading(false);
      }
    }

    // Wi-Fi with no internet looks online, so the check above does not catch
    // it. If the event has not come after a few seconds, go on with the
    // stored session; the event still corrects it whenever it arrives.
    const slowStartTimer = setTimeout(() => {
      if (!isMounted) return;
      const stored = getStoredAuthSession();
      if (!stored) return;
      setSession((current) => current ?? stored);
      setLoading(false);
    }, 5000);

    const subscription = subscribeToStagingAuth((nextSession) => {
      if (!isMounted) return;
      clearTimeout(slowStartTimer);
      setSession(nextSession ?? getStoredAuthSession());
      setError(null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(slowStartTimer);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
