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
      <div className="layout-auth login-layout">
        <div className="login-loading">Loading authentication state...</div>
      </div>
    );
  }

  if (session?.user) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return (
    <div className="layout-auth login-layout" data-testid="login-page">
      <div className="login-brand-panel">
        <div className="login-brand-content">
          <img alt="TGM logo" className="login-brand-logo" src={brandConfig.logoPath} />
          <h1 className="login-brand-title">{brandConfig.brandName}</h1>
          <p className="login-subtitle">Cold Storage Management System</p>
        </div>
      </div>
      <div className="login-form-panel">
        <div className="login-card">
          <StagingLoginPanel session={session} onSessionChange={() => {}} />
          <div className="login-footer login-safety-footer" role="status">
            <div>Controlled UAT only</div>
            <div>Production remains HOLD</div>
            <div>FINAL GO is NOT AUTHORIZED</div>
          </div>
        </div>
      </div>
    </div>
  );
}
