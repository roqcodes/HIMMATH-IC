import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/** Ensure transaction pooler URLs include pgbouncer=true (port 6543). */
function normalizeDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  const isTransactionPooler =
    parsed.port === '6543' || parsed.searchParams.get('pgbouncer') === 'true';
  if (isTransactionPooler && parsed.searchParams.get('pgbouncer') !== 'true') {
    parsed.searchParams.set('pgbouncer', 'true');
  }
  return parsed.toString();
}

/**
 * Supabase pooler modes:
 * - Session (port 5432): each pg client = one real DB session. Cap ~15 on free/pro small tiers.
 *   Unsafe for serverless at scale — many warm lambdas × pool max exhausts the cap (EMAXCONNSESSION).
 * - Transaction (port 6543 + ?pgbouncer=true): multiplexed — required for Vercel/production.
 */
const connectionString = normalizeDatabaseUrl(env.DATABASE_URL);
const parsed = new URL(connectionString);
const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

const isTransactionPooler =
  parsed.port === '6543' || parsed.searchParams.get('pgbouncer') === 'true';

const isSessionPooler = !isTransactionPooler && (parsed.port === '5432' || parsed.port === '');

const isServerless =
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.VERCEL_ENV) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  Boolean(process.env.NETLIFY);

function resolvePoolMax(): number {
  const raw = process.env.PG_POOL_MAX;
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
  }
  if (isSessionPooler) {
    // One slot per warm serverless instance — still risky at high concurrency; prefer port 6543.
    return isServerless ? 1 : 3;
  }
  return isServerless ? 2 : 6;
}

/** Parallel queries per HTTP request — must stay ≤ pool max on session pooler. */
export const QUERY_CONCURRENCY =
  isServerless && isSessionPooler ? 1 : isSessionPooler ? 2 : 4;

if (
  isServerless &&
  isSessionPooler &&
  process.env.NODE_ENV === 'production' &&
  !((globalThis as { __asicPgPoolWarned?: boolean }).__asicPgPoolWarned)
) {
  (globalThis as { __asicPgPoolWarned?: boolean }).__asicPgPoolWarned = true;
  logger.warn(
    {
      poolMax: resolvePoolMax(),
      host: parsed.hostname,
      port: parsed.port || '5432',
    },
    'DATABASE_URL uses Supabase session pooler on serverless — set transaction pooler (port 6543, ?pgbouncer=true) in production env to avoid EMAXCONNSESSION',
  );
}

const pool =
  ((globalThis as { __asicPg?: Pool }).__asicPg ??=
    new Pool({
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: resolvePoolMax(),
      idleTimeoutMillis: isServerless ? 1_000 : 5_000,
      connectionTimeoutMillis: 8_000,
      allowExitOnIdle: isServerless,
      options: '-c statement_timeout=20000',
    }));

export type SqlQuery = {
  <R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<R>>;
};

/** Run independent queries with bounded concurrency (avoids pooler session exhaustion). */
export async function runQueryBatch<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  concurrency: number = QUERY_CONCURRENCY,
): Promise<T[]> {
  if (tasks.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, tasks.length));
  const results = new Array<T>(tasks.length);
  let next = 0;

  const workers = Array.from({ length: limit }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= tasks.length) break;
      results[index] = await tasks[index]();
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Never call query()/pool.connect() while this client is still checked out.
 * Session pooler often allows only 1 slot per serverless instance — a nested
 * connect waits until connectionTimeoutMillis then throws
 * "timeout exceeded when trying to connect".
 */
export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Hold a client only for multi-step transactions. Independent reads should use query(). */
export async function withConnection<T>(fn: (query: SqlQuery) => Promise<T>): Promise<T> {
  return withClient(async (client) => fn((text, params) => client.query(text, params)));
}

export function isRetryableTxError(err: unknown): boolean {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
  return code === '40001' || code === '40P01';
}

function backoffMs(attempt: number): number {
  return 20 * 2 ** (attempt - 1) + Math.random() * 25;
}

/** Stable lock order — always lock the same ids alphabetically to avoid deadlocks. */
export function sortedIds(ids: Iterable<string>): string[] {
  return [...new Set([...ids].map(String).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** BEGIN/COMMIT/ROLLBACK on one client. Retries serialization/deadlock failures. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const maxAttempts = 4;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withClient(async (client) => {
        await client.query('BEGIN');
        try {
          const result = await fn(client);
          await client.query('COMMIT');
          return result;
        } catch (err) {
          try {
            await client.query('ROLLBACK');
          } catch {
            /* ignore */
          }
          throw err;
        }
      });
    } catch (err) {
      lastErr = err;
      if (!isRetryableTxError(err) || attempt === maxAttempts) throw err;
      await new Promise(resolve => setTimeout(resolve, backoffMs(attempt)));
    }
  }
  throw lastErr;
}

export function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return pool.query<R>(text, params);
}

export { pool, isSessionPooler, isTransactionPooler };
