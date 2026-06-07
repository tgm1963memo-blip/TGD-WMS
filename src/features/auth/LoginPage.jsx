import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { StagingLoginPanel } from '../../components/dashboard/StagingLoginPanel.jsx';
import { brandConfig } from '../../config/brandConfig.js';

export function LoginPage() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="layout-auth">
        <div style={{ padding: '40px', color: 'var(--tgd-muted-text)' }}>
          Loading authentication state...
        </div>
      </div>
    );
  }

  if (session?.user) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return (
    <div className="layout-auth">
      <div className="login-container">
        <div className="login-header">
          <img alt="TGM logo" className="login-logo" src={brandConfig.logoPath} />
          <h1>{brandConfig.brandName}</h1>
          <p>TGD Cold Storage WMS</p>
        </div>
        <StagingLoginPanel session={session} onSessionChange={() => {}} />
      </div>
    </div>
  );
}
