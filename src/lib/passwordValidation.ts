export const PASSWORD_MIN_LENGTH = 6;

export const PASSWORD_REQUIREMENTS_HINT =
  'At least 6 characters, no spaces';

export const PASSWORD_INVALID_MESSAGE =
  'Password must be at least 6 characters with no spaces.';

export function validatePassword(pw: string) {
  const checks = {
    length: pw.length >= PASSWORD_MIN_LENGTH,
    noSpaces: !/\s/.test(pw),
  };
  const isValid = Object.values(checks).every(Boolean);
  return { checks, isValid };
}
