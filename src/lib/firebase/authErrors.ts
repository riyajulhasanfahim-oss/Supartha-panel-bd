/**
 * Translates Firebase Authentication error codes into calm, clear user-facing messages.
 * Never leaks raw technical Firebase error strings or internal config details.
 */
export function toUserFriendlyAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const normalized = `${code.toLowerCase()} ${message}`;

  if (
    normalized.includes('auth/invalid-credential') ||
    normalized.includes('auth/wrong-password') ||
    normalized.includes('auth/user-not-found') ||
    normalized.includes('invalid_login_credentials')
  ) {
    return 'Incorrect email or password. Please double-check your credentials and try again.';
  }

  if (normalized.includes('auth/email-already-in-use')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }

  if (normalized.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }

  if (normalized.includes('auth/weak-password')) {
    return 'Password is too weak. Please choose at least 6 characters.';
  }

  if (normalized.includes('auth/too-many-requests')) {
    return 'Too many unsuccessful attempts. Please wait a few minutes before trying again.';
  }

  if (normalized.includes('auth/user-disabled')) {
    return 'This account has been disabled. Contact support for assistance.';
  }

  if (normalized.includes('auth/network-request-failed')) {
    return 'Network error while connecting. Check your internet connection and retry.';
  }

  if (normalized.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in was cancelled before completion.';
  }

  if (normalized.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not yet enabled in this Firebase project. Contact the site administrator.';
  }

  if (normalized.includes('auth/unauthorized-domain')) {
    return 'This domain is not authorized for sign-in in the connected Firebase project.';
  }

  return 'Authentication could not be completed right now. Please try again.';
}
