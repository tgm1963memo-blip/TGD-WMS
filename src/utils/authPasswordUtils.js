const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordStrength(password) {
  const value = String(password ?? '');
  if (value.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      code: 'PASSWORD_TOO_SHORT',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  return { valid: true, code: null, message: '' };
}

export function validatePasswordConfirmation(password, confirmPassword) {
  if (password !== confirmPassword) {
    return {
      valid: false,
      code: 'PASSWORD_MISMATCH',
      message: 'Password confirmation does not match.',
    };
  }
  return { valid: true, code: null, message: '' };
}
