import { LOCKOUT_MINUTES, MAX_FAILED_LOGINS, MIN_PASSWORD_LENGTH, WEAK_PASSWORDS } from "../config/security.js";

export type LoginFailureState = {
  failedLoginCount: number;
  lockedUntil: Date | null;
};

export function nextLoginFailureState(currentCount: number, now: Date): LoginFailureState {
  if (currentCount + 1 >= MAX_FAILED_LOGINS) {
    return {
      failedLoginCount: 0,
      lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000),
    };
  }
  return { failedLoginCount: currentCount + 1, lockedUntil: null };
}

export function isAccountLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}

export function passwordPolicyError(
  password: string,
  currentPassword: string,
  email: string,
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Password must include a letter and a number";
  if (WEAK_PASSWORDS.some((weak) => weak.toLowerCase() === password.toLowerCase())) {
    return "Choose a less common password";
  }
  if (password === currentPassword) return "New password must differ from the current password";
  const emailName = email.split("@")[0];
  if (emailName && password.toLowerCase().includes(emailName.toLowerCase())) {
    return "Password must not contain the part of your email before @";
  }
  return null;
}
