import React, { createContext, useContext, useEffect, useState } from 'react';
import { getStagingSession, subscribeToStagingAuth } from '../../services/stagingAuthService.js';

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

    getStagingSession().then((result) => {
      if (!isMounted) return;
      setSession(result.data ?? null);
      setError(result.error ?? null);
      setLoading(false);
    });

    const subscription = subscribeToStagingAuth((nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setError(null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
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
