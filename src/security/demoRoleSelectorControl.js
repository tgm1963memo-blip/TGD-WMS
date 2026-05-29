export const DEMO_ROLE_SELECTOR_MODES = Object.freeze({
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  CRITICAL_OVERRIDE: 'critical_override',
});

function normalizeEnvironment(value) {
  if (!value || typeof value !== 'string') return 'development';
  return value.trim().toLowerCase();
}

function normalizeBoolean(value) {
  if (value === true || value === 'true' || value === '1' || value === 'yes') return true;
  return false;
}

function isProductionConfig(config = {}) {
  const environment = normalizeEnvironment(config.appMode || config.environment || config.APP_ENV || config.mode);
  return config.isProduction === true || environment === 'production';
}

function allowDemoSelector(config = {}) {
  return normalizeBoolean(config.allowDemoRoleSelector || config.VITE_ALLOW_DEMO_ROLE_SELECTOR);
}

export function getDemoRoleSelectorMode(config = {}) {
  const production = isProductionConfig(config);
  const explicitlyAllowed = allowDemoSelector(config);

  if (production && explicitlyAllowed) return DEMO_ROLE_SELECTOR_MODES.CRITICAL_OVERRIDE;
  if (production) return DEMO_ROLE_SELECTOR_MODES.DISABLED;
  return DEMO_ROLE_SELECTOR_MODES.ENABLED;
}

export function isDemoRoleSelectorAllowed(config = {}) {
  return getDemoRoleSelectorMode(config) !== DEMO_ROLE_SELECTOR_MODES.DISABLED;
}

export function shouldShowDemoRoleSelector(config = {}) {
  return isDemoRoleSelectorAllowed(config);
}

export function createDemoRoleSelectorWarning(config = {}) {
  const mode = getDemoRoleSelectorMode(config);
  const production = isProductionConfig(config);

  if (mode === DEMO_ROLE_SELECTOR_MODES.CRITICAL_OVERRIDE) {
    return {
      severity: 'CRITICAL',
      message: 'Demo role selector is explicitly enabled in production and must be reviewed.',
      thaiMessage: 'คำเตือนระดับวิกฤต: เปิดตัวเลือกบทบาททดสอบใน Production ต้องตรวจสอบทันที',
    };
  }

  if (production) {
    return {
      severity: 'INFO',
      message: 'Demo role selector is disabled in production.',
      thaiMessage: 'ปิดตัวเลือกบทบาททดสอบใน Production แล้ว',
    };
  }

  return {
    severity: 'WARNING',
    message: 'Demo role selector is for development or staging review only.',
    thaiMessage: 'สำหรับทดสอบเท่านั้น ห้ามใช้เป็นสิทธิ์ผู้ใช้จริงใน Production',
  };
}

export function summarizeDemoRoleSelectorControl(config = {}) {
  const mode = getDemoRoleSelectorMode(config);
  const warning = createDemoRoleSelectorWarning(config);

  return {
    mode,
    allowed: isDemoRoleSelectorAllowed(config),
    visible: shouldShowDemoRoleSelector(config),
    production: isProductionConfig(config),
    severity: warning.severity,
    warning,
  };
}

export function assertDemoRoleSelectorProductionSafe(config = {}) {
  const summary = summarizeDemoRoleSelectorControl(config);

  return {
    ok: !summary.production || summary.mode === DEMO_ROLE_SELECTOR_MODES.DISABLED,
    ...summary,
  };
}
