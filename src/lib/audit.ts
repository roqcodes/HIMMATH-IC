import 'server-only';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { User } from '@/types';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'void'
  | 'status_change'
  | 'export'
  | 'login'
  | 'settings';

export async function writeAuditLog(input: {
  actor?: Pick<User, 'id' | 'email' | 'role'> | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  branchId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (actor_id, actor_email, actor_role, action, entity_type, entity_id, branch_id, before_json, after_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)`,
      [
        input.actor?.id ?? null,
        input.actor?.email ?? null,
        input.actor?.role ?? null,
        input.action,
        input.entityType,
        input.entityId ?? null,
        input.branchId ?? null,
        input.before ? JSON.stringify(input.before) : null,
        input.after ? JSON.stringify(input.after) : null,
      ],
    );
  } catch (error) {
    logger.warn({ error, entityType: input.entityType }, 'audit_log write skipped');
  }
}
