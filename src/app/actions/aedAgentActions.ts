'use server';

import { query } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { DbActionResult } from './dbActions';

export type IcAedAgent = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  status: 'active' | 'inactive';
  notes?: string | null;
  createdAt?: string;
};

const agentSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  notes: z.string().optional().nullable(),
});

function mapRow(row: Record<string, unknown>): IcAedAgent {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    notes: row.notes ? String(row.notes) : null,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
  };
}

export async function listIcAedAgentsAction(activeOnly = false): Promise<IcAedAgent[]> {
  const res = await query(
    `SELECT * FROM ic_aed_agents
     ${activeOnly ? "WHERE status = 'active'" : ''}
     ORDER BY name ASC`,
  );
  return res.rows.map(r => mapRow(r as Record<string, unknown>));
}

export async function createIcAedAgentAction(
  input: z.infer<typeof agentSchema>,
): Promise<DbActionResult<IcAedAgent>> {
  try {
    const parsed = agentSchema.parse(input);
    const res = await query(
      `INSERT INTO ic_aed_agents (name, phone, email, status, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        parsed.name,
        parsed.phone || null,
        parsed.email || null,
        parsed.status,
        parsed.notes || null,
      ],
    );
    const agent = mapRow(res.rows[0] as Record<string, unknown>);
    revalidatePath('/');
    return { success: true, data: agent };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create agent',
    };
  }
}

export async function updateIcAedAgentAction(
  id: string,
  input: z.infer<typeof agentSchema>,
): Promise<DbActionResult<IcAedAgent>> {
  try {
    const parsed = agentSchema.parse(input);
    const res = await query(
      `UPDATE ic_aed_agents
       SET name = $2, phone = $3, email = $4, status = $5, notes = $6
       WHERE id = $1 RETURNING *`,
      [id, parsed.name, parsed.phone || null, parsed.email || null, parsed.status, parsed.notes || null],
    );
    if (res.rows.length === 0) return { success: false, error: 'Agent not found' };
    revalidatePath('/');
    return { success: true, data: mapRow(res.rows[0] as Record<string, unknown>) };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update agent',
    };
  }
}
