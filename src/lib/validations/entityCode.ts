import { z } from 'zod';

const entityCodeValueSchema = z.union([
  z.null(),
  z
    .string()
    .max(32, 'Code must be at most 32 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Use letters, numbers, dash, or underscore only'),
]);

export const entityCodeSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform(val => {
    const t = typeof val === 'string' ? val.trim() : '';
    return t ? t.toUpperCase() : null;
  })
  .pipe(entityCodeValueSchema);

export function formatEntitySelectLabel(name: string, code?: string | null): string {
  const c = code?.trim();
  return c ? `${c} · ${name}` : name;
}

export function entityCodeConflictMessage(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    if ((error as { code?: string }).code === '23505') {
      return 'This code is already in use.';
    }
  }
  return null;
}
