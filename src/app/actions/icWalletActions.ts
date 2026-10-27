'use server';

import { z } from 'zod';
import { positiveFormAmountSchema } from '@/lib/parseFormAmount';
import { query, withTransaction, sortedIds } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { assertStaffWriteAccess } from '@/app/actions/permissionActions';
import { logger } from '@/lib/logger';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import { ensureLinkedAccount } from '@/lib/icFunds/icTransferFundSync';
import {
  buildFifoWalletPaymentAllocations,
  formatWalletTxnId,
  normalizeAccountCurrency,
  roundFxCalc,
  roundWalletForeign,
  roundWalletRate,
  validateWalletPaymentAmount,
} from '@/lib/icTransfer/icWallet';
import {
  remainingForeignOwed,
  resolveSaleForeignPaymentStatus,
  sortSalesFifo,
  formatFxAmount,
  type FxOpenSaleLine,
} from '@/lib/icTransfer/saleFxProfit';
import { OPEN_CUSTOMER_SALES_SQL } from '@/lib/icTransfer/walletQueries';
import { applyUnappliedWalletCredits } from '@/lib/icTransfer/walletCredits.server';

const payToAgentSchema = z.object({
  customerId: z.string().trim().min(1),
  collectionAccountId: z.string().trim().min(1),
  amount: positiveFormAmountSchema,
  notes: z.string().trim().optional().nullable(),
});

const approveSchema = z.object({
  transactionId: z.string().uuid(),
  approve: z.boolean(),
  rejectionReason: z.string().trim().optional().nullable(),
});

function mapSaleToFxLine(row: Record<string, unknown>): FxOpenSaleLine {
  const convertedAmount = Number(row.converted_amount) || 0;
  const foreignCollected = Number(row.foreign_collected) || 0;
  return {
    saleId: String(row.id),
    units: Number(row.units) || 0,
    unitRate: Number(row.unit_rate) || 0,
    aedAmount: Number(row.aed_amount) || 0,
    convertedAmount,
    conversionRate: Number(row.conversion_rate),
    foreignRemaining: remainingForeignOwed(convertedAmount, foreignCollected),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
  };
}

async function loadCustomerOpenSales(client: { query: typeof query }, customerId: string) {
  const res = await client.query(`${OPEN_CUSTOMER_SALES_SQL} ORDER BY s.created_at ASC`, [customerId]);
  return res.rows.map(mapSaleToFxLine);
}

async function assertCustomerAgentLink(customerId: string, collectionAccountId: string) {
  const res = await query(
    `SELECT cca.id, c.currency AS customer_currency, a.currency AS agent_currency, a.status, a.account_type
     FROM customer_collection_agents cca
     JOIN customers c ON c.id = cca.customer_id
     JOIN ic_fund_accounts a ON a.id = cca.collection_account_id
     WHERE cca.customer_id = $1 AND cca.collection_account_id = $2
     LIMIT 1`,
    [customerId, collectionAccountId],
  );
  if (res.rows.length === 0) {
    throw new Error('This collection agent is not assigned to the customer');
  }
  const row = res.rows[0];
  if (String(row.account_type) !== 'collection_agent') throw new Error('Invalid collection agent');
  if (String(row.status) !== 'active') throw new Error('Collection agent is inactive');
  const customerCurrency = normalizeAccountCurrency(row.customer_currency);
  const agentCurrency = normalizeAccountCurrency(row.agent_currency);
  if (customerCurrency !== agentCurrency) {
    throw new Error(`Agent currency ${agentCurrency} does not match customer ${customerCurrency}`);
  }
  return customerCurrency;
}

async function resolveCustomerPersonalAccount(
  client: { query: typeof query },
  customerId: string,
  branchId: string,
) {
  const custRes = await client.query(`SELECT id, name FROM customers WHERE id = $1 LIMIT 1`, [customerId]);
  if (custRes.rows.length === 0) throw new Error('Customer not found');
  const customer = custRes.rows[0];
  const accountId = await ensureLinkedAccount(client, {
    branchId,
    sourceType: 'ic_customer',
    sourceId: customerId,
    name: String(customer.name),
    customerId,
  });
  if (!accountId) throw new Error('Could not resolve customer IC Funds account');
  return accountId;
}

async function nextWalletTransactionNo(
  client: { query: typeof query },
  branchId: string,
): Promise<number> {
  await client.query(
    `INSERT INTO ic_wallet_transaction_counters (branch_id, last_no) VALUES ($1, 0)
     ON CONFLICT (branch_id) DO NOTHING`,
    [branchId],
  );
  const counter = await client.query(
    `UPDATE ic_wallet_transaction_counters
     SET last_no = last_no + 1
     WHERE branch_id = $1
     RETURNING last_no`,
    [branchId],
  );
  return Number(counter.rows[0]?.last_no) || 1;
}

function mapWalletTransactionRow(row: Record<string, unknown>) {
  const transactionNo = Number(row.transaction_no) || 0;
  return {
    id: String(row.id),
    transactionNo,
    transactionLabel: formatWalletTxnId(transactionNo),
    transactionType: String(row.transaction_type) as 'customer_payment' | 'agent_transfer',
    customerId: row.customer_id ? String(row.customer_id) : undefined,
    customerName: row.customer_name ? String(row.customer_name) : undefined,
    customerBranchSlug: row.customer_branch_slug ? String(row.customer_branch_slug) : undefined,
    fromAccountId: String(row.from_account_id),
    fromAccountName: row.from_account_name ? String(row.from_account_name) : undefined,
    toAccountId: String(row.to_account_id),
    toAccountName: row.to_account_name ? String(row.to_account_name) : undefined,
    amount: Number(row.amount) || 0,
    currency: String(row.currency),
    status: String(row.status) as 'pending' | 'approved' | 'rejected',
    notes: row.notes ? String(row.notes) : undefined,
    enteredByName: row.entered_by_name ? String(row.entered_by_name) : undefined,
    approvedByName: row.approved_by_name ? String(row.approved_by_name) : undefined,
    rejectedByName: row.rejected_by_name ? String(row.rejected_by_name) : undefined,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
    allocationCount: Number(row.allocation_count) || 0,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
    approvedAt: row.approved_at ? new Date(String(row.approved_at)).toISOString() : undefined,
    rejectedAt: row.rejected_at ? new Date(String(row.rejected_at)).toISOString() : undefined,
  };
}

export async function recordPayToCollectionAgentAction(
  input: z.infer<typeof payToAgentSchema>,
  branchSlug?: string,
) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user) return { success: false as const, error: 'You must be signed in.' };

    const parsed = payToAgentSchema.parse(input);
    const isCustomer = user.role === 'customer';

    if (isCustomer) {
      if (user.customerId !== parsed.customerId) {
        return { success: false as const, error: 'You can only pay on your own account' };
      }
    } else if (branchSlug && branchSlug !== 'superadmin') {
      const branchRes = await query(`SELECT id FROM branches WHERE slug = $1 LIMIT 1`, [branchSlug]);
      if (branchRes.rows.length === 0) return { success: false as const, error: 'Branch not found' };
      const denied = await assertStaffWriteAccess(user, 'ic-funds', String(branchRes.rows[0].id));
      if (denied) return { success: false as const, error: denied };
    } else if (user.role !== 'admin' && user.role !== 'branch_manager' && user.role !== 'staff') {
      return { success: false as const, error: 'Unauthorized' };
    }

    const currency = await assertCustomerAgentLink(parsed.customerId, parsed.collectionAccountId);
    const status = isCustomer ? 'pending' : 'approved';

    const result = await withTransaction(async client => {
      await client.query(
        `SELECT id FROM ic_sales
         WHERE order_customer_id = $1 AND order_status = 'completed'
         ORDER BY id
         FOR UPDATE`,
        [parsed.customerId],
      );
      await client.query(
        `SELECT id FROM ic_fund_accounts WHERE id = ANY($1::varchar[]) ORDER BY id FOR UPDATE`,
        [sortedIds([parsed.collectionAccountId])],
      );

      await applyUnappliedWalletCredits(client, {
        customerId: parsed.customerId,
        collectionAccountId: parsed.collectionAccountId,
      });

      const openSales = await loadCustomerOpenSales(client, parsed.customerId);
      validateWalletPaymentAmount(openSales, parsed.amount);

      const fifoAllocs = buildFifoWalletPaymentAllocations(openSales, parsed.amount);
      const credit = fifoAllocs.find(a => !a.saleId);
      const fromAccountId = await resolveCustomerPersonalAccount(
        client,
        parsed.customerId,
        HQ_IC_FUNDS_BRANCH_ID,
      );
      await client.query(
        `SELECT id FROM ic_fund_accounts WHERE id = ANY($1::varchar[]) ORDER BY id FOR UPDATE`,
        [sortedIds([fromAccountId, parsed.collectionAccountId])],
      );

      const transactionNo = await nextWalletTransactionNo(client, HQ_IC_FUNDS_BRANCH_ID);

      const insertRes = await client.query(
        `INSERT INTO ic_wallet_transactions (
           branch_id, transaction_no, transaction_type, currency, amount, customer_id,
           from_account_id, to_account_id, status, notes,
           entered_by, entered_by_name, entered_by_user_id,
           approved_by, approved_by_name, approved_at
         ) VALUES ($1,$2,'customer_payment',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING id, transaction_no`,
        [
          HQ_IC_FUNDS_BRANCH_ID,
          transactionNo,
          currency,
          roundWalletForeign(parsed.amount),
          parsed.customerId,
          fromAccountId,
          parsed.collectionAccountId,
          status,
          parsed.notes || null,
          user.email || 'system',
          user.name || 'System',
          user.id || null,
          status === 'approved' ? user.email || 'system' : null,
          status === 'approved' ? user.name || 'System' : null,
          status === 'approved' ? new Date() : null,
        ],
      );
      const walletTxId = String(insertRes.rows[0].id);

      for (const alloc of fifoAllocs) {
        await client.query(
          `INSERT INTO ic_wallet_sale_allocations (
             wallet_transaction_id, sale_id, customer_id, collection_account_id,
             allocated_foreign, sale_conversion_rate
           ) VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            walletTxId,
            alloc.saleId,
            parsed.customerId,
            parsed.collectionAccountId,
            roundWalletForeign(alloc.allocatedForeign),
            alloc.saleConversionRate != null ? roundWalletRate(alloc.saleConversionRate) : null,
          ],
        );
      }

      if (status === 'approved') {
        await applyUnappliedWalletCredits(client, {
          customerId: parsed.customerId,
          collectionAccountId: parsed.collectionAccountId,
        });
        await applyWalletPaymentToSales(client, parsed.customerId);
      }

      return {
        transactionId: walletTxId,
        transactionNo: Number(insertRes.rows[0].transaction_no) || transactionNo,
        creditAmount: credit?.allocatedForeign ?? 0,
      };
    });

    return {
      success: true as const,
      transactionId: result.transactionId,
      transactionNo: result.transactionNo,
      status,
      message:
        status === 'pending'
          ? result.creditAmount > 1e-10
            ? `Payment submitted for approval. ${formatFxAmount(result.creditAmount)} ${currency} will be held as credit for future sales.`
            : 'Payment submitted for admin approval'
          : result.creditAmount > 1e-10
            ? `Payment recorded. ${formatFxAmount(result.creditAmount)} ${currency} held as credit for future sales.`
            : 'Payment recorded and allocated (FIFO)',
    };
  } catch (err) {
    logger.error({ err, input }, 'recordPayToCollectionAgentAction failed');
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to record payment',
    };
  }
}

async function applyWalletPaymentToSales(
  client: { query: typeof query },
  customerId: string,
) {
  const salesRes = await client.query(`${OPEN_CUSTOMER_SALES_SQL}`, [customerId]);
  for (const row of salesRes.rows) {
    const convertedAmount = Number(row.converted_amount) || 0;
    const foreignCollected = Number(row.foreign_collected) || 0;
    await client.query(
      `UPDATE ic_sales SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [resolveSaleForeignPaymentStatus(convertedAmount, foreignCollected), String(row.id)],
    );
  }
}

export async function approveWalletTransactionAction(
  input: z.infer<typeof approveSchema>,
  branchSlug?: string,
) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user || user.role === 'customer') {
      return { success: false as const, error: 'Unauthorized' };
    }
    if (user.role !== 'admin' && user.role !== 'branch_manager' && user.role !== 'staff') {
      return { success: false as const, error: 'Unauthorized' };
    }

    const parsed = approveSchema.parse(input);

    await withTransaction(async client => {
      const txRes = await client.query(
        `SELECT * FROM ic_wallet_transactions WHERE id = $1 FOR UPDATE`,
        [parsed.transactionId],
      );
      if (txRes.rows.length === 0) throw new Error('Transaction not found');
      const tx = txRes.rows[0];
      if (String(tx.status) !== 'pending') throw new Error('Transaction is not pending');

      if (parsed.approve) {
        await client.query(
          `UPDATE ic_wallet_transactions
           SET status = 'approved', approved_by = $1, approved_by_name = $2, approved_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [user.email || 'system', user.name || 'System', parsed.transactionId],
        );
        if (tx.customer_id) {
          await applyUnappliedWalletCredits(client, {
            customerId: String(tx.customer_id),
            collectionAccountId: String(tx.to_account_id),
          });
          await applyWalletPaymentToSales(client, String(tx.customer_id));
        }
      } else {
        await client.query(
          `UPDATE ic_wallet_transactions
           SET status = 'rejected', rejected_by = $1, rejected_by_name = $2,
               rejected_at = CURRENT_TIMESTAMP, rejection_reason = $3
           WHERE id = $4`,
          [
            user.email || 'system',
            user.name || 'System',
            parsed.rejectionReason || 'Rejected',
            parsed.transactionId,
          ],
        );
      }
    });

    return { success: true as const };
  } catch (err) {
    logger.error({ err, input }, 'approveWalletTransactionAction failed');
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to update transaction',
    };
  }
}

export async function listPendingWalletTransactionsAction(branchSlug?: string) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user || user.role === 'customer') {
      return { success: false as const, error: 'Unauthorized' };
    }

    const res = await query(
      `SELECT wt.*,
              c.name AS customer_name,
              cb.slug AS customer_branch_slug,
              fa.name AS from_account_name,
              ta.name AS to_account_name,
              (
                SELECT COUNT(*)::int
                FROM ic_wallet_sale_allocations wsa
                WHERE wsa.wallet_transaction_id = wt.id
              ) AS allocation_count
       FROM ic_wallet_transactions wt
       LEFT JOIN customers c ON c.id = wt.customer_id
       LEFT JOIN branches cb ON cb.id = c.branch_id
       JOIN ic_fund_accounts fa ON fa.id = wt.from_account_id
       JOIN ic_fund_accounts ta ON ta.id = wt.to_account_id
       WHERE wt.status = 'pending'
       ORDER BY wt.created_at ASC
       LIMIT 100`,
    );

    return {
      success: true as const,
      transactions: res.rows.map(row => {
        const mapped = mapWalletTransactionRow(row);
        return {
          ...mapped,
          collectionAccountId: mapped.toAccountId,
          collectionAccountName: mapped.toAccountName || '',
        };
      }),
    };
  } catch (err) {
    logger.error({ err }, 'listPendingWalletTransactionsAction failed');
    return { success: false as const, error: 'Failed to load pending payments' };
  }
}

export type CustomerWalletSaleRow = {
  saleId: string;
  units: number;
  unitRate: number;
  aedAmount: number;
  convertedAmount: number;
  conversionRate: number;
  foreignRemaining: number;
  foreignPaid: number;
  paymentStatus: 'pending' | 'partial' | 'paid';
  currency: string;
  createdAt?: string;
};

export type CustomerWalletAgentRow = {
  collectionAccountId: string;
  name: string;
  currency: string;
  isPrimary: boolean;
  balanceOnAgent: number;
};

export type CustomerWalletPaymentRow = {
  id: string;
  transactionNo: number;
  transactionLabel: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
  agentName: string;
  collectionAccountId: string;
  notes?: string;
  enteredByName?: string;
  allocationCount: number;
  createdAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
};

export type CustomerWalletStats = {
  openSaleCount: number;
  foreignTotalOwed: number;
  foreignPaidApproved: number;
  foreignRemaining: number;
  foreignCredit: number;
  pendingPaymentCount: number;
  pendingPaymentAmount: number;
  agentCount: number;
};

export type CustomerWalletStatus =
  | 'idle'
  | 'needs_agents'
  | 'needs_payment'
  | 'pending_approval'
  | 'ready';

function mapSaleToCustomerWalletRow(row: Record<string, unknown>): CustomerWalletSaleRow {
  const line = mapSaleToFxLine(row);
  const foreignPaid = roundFxCalc(Math.max(0, line.convertedAmount - line.foreignRemaining));
  const currency = normalizeAccountCurrency(row.currency as string | null | undefined);
  return {
    saleId: line.saleId,
    units: line.units,
    unitRate: line.unitRate,
    aedAmount: line.aedAmount,
    convertedAmount: line.convertedAmount,
    conversionRate: line.conversionRate,
    foreignRemaining: line.foreignRemaining,
    foreignPaid,
    paymentStatus: resolveSaleForeignPaymentStatus(line.convertedAmount, foreignPaid),
    currency,
    createdAt: line.createdAt,
  };
}

function resolveCustomerWalletStatus(input: {
  foreignRemaining: number;
  agentCount: number;
  pendingPaymentCount: number;
  openSaleCount: number;
}): CustomerWalletStatus {
  if (input.openSaleCount === 0 && input.foreignRemaining <= 1e-10) return 'idle';
  if (input.agentCount === 0 && input.foreignRemaining > 1e-10) return 'needs_agents';
  if (input.pendingPaymentCount > 0) return 'pending_approval';
  if (input.foreignRemaining > 1e-10) return 'needs_payment';
  if (input.agentCount > 0) return 'ready';
  return 'idle';
}

export async function getCustomerWalletSummaryAction(customerId: string, branchSlug?: string) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user) return { success: false as const, error: 'Unauthorized' };
    if (user.role === 'customer' && user.customerId !== customerId) {
      return { success: false as const, error: 'Unauthorized' };
    }

    const [salesRes, agentsRes, custRes, pendingRes, paymentsRes, creditRes] = await Promise.all([
      query(`${OPEN_CUSTOMER_SALES_SQL} ORDER BY s.created_at ASC`, [customerId]),
      query(
        `SELECT cca.collection_account_id, cca.is_primary, a.name, a.currency,
                COALESCE(agent_paid.balance, 0) AS balance_on_agent
         FROM customer_collection_agents cca
         JOIN ic_fund_accounts a ON a.id = cca.collection_account_id
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(GREATEST(wsa.allocated_foreign - wsa.settled_foreign, 0)), 0) AS balance
           FROM ic_wallet_sale_allocations wsa
           JOIN ic_wallet_transactions wt
             ON wt.id = wsa.wallet_transaction_id AND wt.status = 'approved'
           WHERE wsa.customer_id = cca.customer_id
             AND wsa.collection_account_id = cca.collection_account_id
         ) agent_paid ON TRUE
         WHERE cca.customer_id = $1
         ORDER BY cca.is_primary DESC, a.name`,
        [customerId],
      ),
      query(`SELECT id, name, currency FROM customers WHERE id = $1 LIMIT 1`, [customerId]),
      query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS total
         FROM ic_wallet_transactions
         WHERE customer_id = $1
           AND transaction_type = 'customer_payment'
           AND status = 'pending'`,
        [customerId],
      ),
      query(
        `SELECT wt.id, wt.transaction_no, wt.amount, wt.currency, wt.status, wt.notes,
                wt.created_at, wt.approved_at, wt.rejected_at, wt.rejection_reason,
                wt.entered_by_name,
                ta.id AS collection_account_id, ta.name AS agent_name,
                (
                  SELECT COUNT(*)::int
                  FROM ic_wallet_sale_allocations wsa
                  WHERE wsa.wallet_transaction_id = wt.id
                ) AS allocation_count
         FROM ic_wallet_transactions wt
         JOIN ic_fund_accounts ta ON ta.id = wt.to_account_id
         WHERE wt.customer_id = $1
           AND wt.transaction_type = 'customer_payment'
         ORDER BY wt.created_at DESC
         LIMIT 50`,
        [customerId],
      ),
      query(
        `SELECT COALESCE(SUM(GREATEST(wsa.allocated_foreign - wsa.settled_foreign, 0)), 0) AS credit
         FROM ic_wallet_sale_allocations wsa
         JOIN ic_wallet_transactions wt ON wt.id = wsa.wallet_transaction_id AND wt.status = 'approved'
         WHERE wsa.customer_id = $1 AND wsa.sale_id IS NULL`,
        [customerId],
      ),
    ]);

    const sales = salesRes.rows.map(mapSaleToCustomerWalletRow);
    const openSales = sales.filter(s => s.foreignRemaining > 1e-10 || s.foreignPaid > 1e-10);
    const foreignRemaining = roundFxCalc(
      sortSalesFifo(sales).reduce((s, row) => s + row.foreignRemaining, 0),
    );
    const foreignTotalOwed = roundFxCalc(
      salesWithBalance(sales).reduce((s, row) => s + row.convertedAmount, 0),
    );
    const foreignPaidApproved = roundFxCalc(sales.reduce((s, row) => s + row.foreignPaid, 0));
    const foreignCredit = roundFxCalc(Number(creditRes.rows[0]?.credit) || 0);
    const pendingPaymentCount = Number(pendingRes.rows[0]?.count) || 0;
    const pendingPaymentAmount = roundFxCalc(Number(pendingRes.rows[0]?.total) || 0);
    const agents: CustomerWalletAgentRow[] = agentsRes.rows.map(r => ({
      collectionAccountId: String(r.collection_account_id),
      name: String(r.name),
      currency: normalizeAccountCurrency(r.currency),
      isPrimary: Boolean(r.is_primary),
      balanceOnAgent: roundFxCalc(Number(r.balance_on_agent) || 0),
    }));

    const customerCurrency =
      custRes.rows.length > 0
        ? normalizeAccountCurrency(custRes.rows[0].currency)
        : undefined;
    const customerName = custRes.rows.length > 0 ? String(custRes.rows[0].name) : undefined;

    const stats: CustomerWalletStats = {
      openSaleCount: salesWithBalance(sales).length,
      foreignTotalOwed,
      foreignPaidApproved,
      foreignRemaining,
      foreignCredit,
      pendingPaymentCount,
      pendingPaymentAmount,
      agentCount: agents.length,
    };

    const status = resolveCustomerWalletStatus({
      foreignRemaining,
      agentCount: agents.length,
      pendingPaymentCount,
      openSaleCount: stats.openSaleCount,
    });

    const payments: CustomerWalletPaymentRow[] = paymentsRes.rows.map(row => {
      const transactionNo = Number(row.transaction_no) || 0;
      return {
        id: String(row.id),
        transactionNo,
        transactionLabel: formatWalletTxnId(transactionNo),
        amount: Number(row.amount) || 0,
        currency: String(row.currency),
        status: String(row.status) as CustomerWalletPaymentRow['status'],
        agentName: String(row.agent_name),
        collectionAccountId: String(row.collection_account_id),
        notes: row.notes ? String(row.notes) : undefined,
        enteredByName: row.entered_by_name ? String(row.entered_by_name) : undefined,
        allocationCount: Number(row.allocation_count) || 0,
        createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
        approvedAt: row.approved_at ? new Date(String(row.approved_at)).toISOString() : undefined,
        rejectedAt: row.rejected_at ? new Date(String(row.rejected_at)).toISOString() : undefined,
        rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
      };
    });

    return {
      success: true as const,
      customerName,
      foreignRemaining,
      foreignCredit,
      currency: customerCurrency,
      stats,
      status,
      sales: openSales,
      allSales: sales,
      agents,
      payments,
    };
  } catch (err) {
    logger.error({ err, customerId }, 'getCustomerWalletSummaryAction failed');
    return { success: false as const, error: 'Failed to load wallet summary' };
  }
}

function salesWithBalance(sales: CustomerWalletSaleRow[]): CustomerWalletSaleRow[] {
  return sales.filter(row => row.foreignRemaining > 1e-10);
}

export async function listCollectionAgentsForTransferAction(branchSlug?: string) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user || user.role === 'customer') {
      return { success: false as const, error: 'Unauthorized' };
    }

    const res = await query(
      `SELECT a.id, a.name, a.currency,
              COALESCE(SUM(GREATEST(wsa.allocated_foreign - wsa.settled_foreign, 0)), 0) AS balance
       FROM ic_fund_accounts a
       LEFT JOIN ic_wallet_sale_allocations wsa
         ON wsa.collection_account_id = a.id
        AND wsa.allocated_foreign - wsa.settled_foreign > 0.0001
       WHERE a.account_type = 'collection_agent' AND a.status = 'active'
       GROUP BY a.id, a.name, a.currency
       ORDER BY a.name`,
    );

    return {
      success: true as const,
      agents: res.rows.map(r => ({
        id: String(r.id),
        name: String(r.name),
        currency: normalizeAccountCurrency(r.currency),
        balance: roundFxCalc(Number(r.balance) || 0),
      })),
    };
  } catch (err) {
    logger.error({ err }, 'listCollectionAgentsForTransferAction failed');
    return { success: false as const, error: 'Failed to load collection agents' };
  }
}

const agentTransferSchema = z.object({
  fromAccountId: z.string().trim().min(1),
  toAccountId: z.string().trim().min(1),
  amount: positiveFormAmountSchema,
  notes: z.string().trim().optional().nullable(),
});

export async function recordAgentTransferAction(
  input: z.infer<typeof agentTransferSchema>,
  branchSlug?: string,
) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user || user.role === 'customer') {
      return { success: false as const, error: 'Unauthorized' };
    }

    const parsed = agentTransferSchema.parse(input);
    if (parsed.fromAccountId === parsed.toAccountId) {
      return { success: false as const, error: 'Source and destination must differ' };
    }

    await withTransaction(async client => {
      const accountsRes = await client.query(
        `SELECT id, account_type, currency, status FROM ic_fund_accounts
         WHERE id = ANY($1::varchar[])
         ORDER BY id
         FOR UPDATE`,
        [sortedIds([parsed.fromAccountId, parsed.toAccountId])],
      );
      if (accountsRes.rows.length !== 2) throw new Error('One or both agents not found');

      const from = accountsRes.rows.find(r => String(r.id) === parsed.fromAccountId);
      const to = accountsRes.rows.find(r => String(r.id) === parsed.toAccountId);
      if (!from || !to) throw new Error('Agents not found');
      if (String(from.account_type) !== 'collection_agent' || String(to.account_type) !== 'collection_agent') {
        throw new Error('Both accounts must be collection agents');
      }
      if (String(from.status) !== 'active' || String(to.status) !== 'active') {
        throw new Error('Inactive agents cannot transfer');
      }
      const fromCur = normalizeAccountCurrency(from.currency);
      const toCur = normalizeAccountCurrency(to.currency);
      if (fromCur !== toCur) {
        throw new Error('Agent-to-agent transfer requires the same currency');
      }

      const transactionNo = await nextWalletTransactionNo(client, HQ_IC_FUNDS_BRANCH_ID);
      const transferInsert = await client.query(
        `INSERT INTO ic_wallet_transactions (
           branch_id, transaction_no, transaction_type, currency, amount,
           from_account_id, to_account_id, status, notes,
           entered_by, entered_by_name, entered_by_user_id,
           approved_by, approved_by_name, approved_at
         ) VALUES ($1,$2,'agent_transfer',$3,$4,$5,$6,'approved',$7,$8,$9,$10,$8,$9,CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          HQ_IC_FUNDS_BRANCH_ID,
          transactionNo,
          fromCur,
          roundWalletForeign(parsed.amount),
          parsed.fromAccountId,
          parsed.toAccountId,
          parsed.notes || null,
          user.email || 'system',
          user.name || 'System',
          user.id || null,
        ],
      );
      const transferTxId = String(transferInsert.rows[0].id);

      const openRes = await client.query(
        `SELECT id, allocated_foreign, settled_foreign, customer_id, sale_id, sale_conversion_rate
         FROM ic_wallet_sale_allocations
         WHERE collection_account_id = $1
           AND allocated_foreign - settled_foreign > 0.0001
         ORDER BY id
         FOR UPDATE`,
        [parsed.fromAccountId],
      );

      let pool = parsed.amount;
      for (const row of openRes.rows) {
        if (pool <= 1e-10) break;
        const unsettled = roundFxCalc(Number(row.allocated_foreign) - Number(row.settled_foreign));
        const applied = roundFxCalc(Math.min(pool, unsettled));
        if (applied <= 1e-10) continue;

        const allocated = Number(row.allocated_foreign);
        if (applied >= allocated - 1e-10 && Number(row.settled_foreign) <= 1e-10) {
          await client.query(`DELETE FROM ic_wallet_sale_allocations WHERE id = $1`, [row.id]);
        } else {
          await client.query(
            `UPDATE ic_wallet_sale_allocations
             SET allocated_foreign = allocated_foreign - $1
             WHERE id = $2
               AND allocated_foreign - $1 >= settled_foreign
               AND allocated_foreign - $1 > 0`,
            [roundWalletForeign(applied), row.id],
          );
        }

        await client.query(
          `INSERT INTO ic_wallet_sale_allocations (
             wallet_transaction_id, sale_id, customer_id, collection_account_id,
             allocated_foreign, sale_conversion_rate
           ) VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            transferTxId,
            row.sale_id,
            row.customer_id,
            parsed.toAccountId,
            roundWalletForeign(applied),
            row.sale_conversion_rate != null ? roundWalletRate(Number(row.sale_conversion_rate)) : null,
          ],
        );

        pool = roundFxCalc(pool - applied);
      }

      if (pool > 1e-10) throw new Error('Insufficient balance on source agent');
    });

    return { success: true as const };
  } catch (err) {
    logger.error({ err, input }, 'recordAgentTransferAction failed');
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to transfer between agents',
    };
  }
}

export type WalletTransactionRow = ReturnType<typeof mapWalletTransactionRow>;

export type CollectionAgentWalletActivity = {
  heldBalance: number;
  currency: string;
  transactions: WalletTransactionRow[];
};

export async function listCollectionAgentWalletActivityAction(
  collectionAccountId: string,
  branchSlug?: string,
): Promise<
  { success: true; data: CollectionAgentWalletActivity } | { success: false; error: string }
> {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user) return { success: false, error: 'Unauthorized' };
    if (user.role === 'customer') return { success: false, error: 'Unauthorized' };
    if (user.role === 'collection_agent' && user.collectionAccountId !== collectionAccountId) {
      return { success: false, error: 'Unauthorized' };
    }

    const accountRes = await query(
      `SELECT id, account_type, currency, status
       FROM ic_fund_accounts
       WHERE id = $1
       LIMIT 1`,
      [collectionAccountId],
    );
    if (accountRes.rows.length === 0) return { success: false, error: 'Account not found' };
    const account = accountRes.rows[0];
    if (String(account.account_type) !== 'collection_agent') {
      return { success: false, error: 'Not a collection agent account' };
    }

    const currency = normalizeAccountCurrency(account.currency);

    const [heldRes, txRes] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(GREATEST(wsa.allocated_foreign - wsa.settled_foreign, 0)), 0) AS held
         FROM ic_wallet_sale_allocations wsa
         JOIN ic_wallet_transactions wt
           ON wt.id = wsa.wallet_transaction_id AND wt.status = 'approved'
         WHERE wsa.collection_account_id = $1`,
        [collectionAccountId],
      ),
      query(
        `SELECT wt.*,
                c.name AS customer_name,
                cb.slug AS customer_branch_slug,
                fa.name AS from_account_name,
                ta.name AS to_account_name,
                (
                  SELECT COUNT(*)::int
                  FROM ic_wallet_sale_allocations wsa
                  WHERE wsa.wallet_transaction_id = wt.id
                ) AS allocation_count
         FROM ic_wallet_transactions wt
         LEFT JOIN customers c ON c.id = wt.customer_id
         LEFT JOIN branches cb ON cb.id = c.branch_id
         JOIN ic_fund_accounts fa ON fa.id = wt.from_account_id
         JOIN ic_fund_accounts ta ON ta.id = wt.to_account_id
         WHERE wt.to_account_id = $1 OR wt.from_account_id = $1
         ORDER BY wt.created_at DESC, wt.transaction_no DESC
         LIMIT 50`,
        [collectionAccountId],
      ),
    ]);

    return {
      success: true,
      data: {
        heldBalance: roundFxCalc(Number(heldRes.rows[0]?.held) || 0),
        currency,
        transactions: txRes.rows.map(mapWalletTransactionRow),
      },
    };
  } catch (err) {
    logger.error({ err, collectionAccountId }, 'listCollectionAgentWalletActivityAction failed');
    return { success: false, error: 'Failed to load wallet activity' };
  }
}

const WALLET_TX_LIST_PAGE_SIZE = 50;

export async function listWalletTransactionsPageAction(options?: {
  branchSlug?: string;
  limit?: number;
  offset?: number;
  status?: 'all' | 'pending' | 'approved' | 'rejected';
  type?: 'all' | 'customer_payment' | 'agent_transfer';
}) {
  try {
    const user = await getSessionUser(options?.branchSlug);
    if (!user || user.role === 'customer') {
      return { success: false as const, error: 'Unauthorized' };
    }

    const branchFilter =
      options?.branchSlug && options.branchSlug !== 'superadmin' ? options.branchSlug : null;
    const limit = Math.min(Math.max(options?.limit ?? WALLET_TX_LIST_PAGE_SIZE, 1), 100);
    const offset = Math.max(options?.offset ?? 0, 0);
    const status = options?.status ?? 'all';
    const type = options?.type ?? 'all';

    const filters: string[] = ['($1::text IS NULL OR b.slug = $1)'];
    const params: unknown[] = [branchFilter];
    if (status !== 'all') {
      params.push(status);
      filters.push(`wt.status = $${params.length}`);
    }
    if (type !== 'all') {
      params.push(type);
      filters.push(`wt.transaction_type = $${params.length}`);
    }
    const whereSql = filters.join(' AND ');

    const countRes = await query(
      `SELECT COUNT(*)::int AS total
       FROM ic_wallet_transactions wt
       JOIN branches b ON b.id = wt.branch_id
       WHERE ${whereSql}`,
      params,
    );

    params.push(limit, offset);
    const listRes = await query(
      `SELECT wt.*,
              c.name AS customer_name,
              cb.slug AS customer_branch_slug,
              fa.name AS from_account_name,
              ta.name AS to_account_name,
              (
                SELECT COUNT(*)::int
                FROM ic_wallet_sale_allocations wsa
                WHERE wsa.wallet_transaction_id = wt.id
              ) AS allocation_count
       FROM ic_wallet_transactions wt
       JOIN branches b ON b.id = wt.branch_id
       LEFT JOIN customers c ON c.id = wt.customer_id
       LEFT JOIN branches cb ON cb.id = c.branch_id
       JOIN ic_fund_accounts fa ON fa.id = wt.from_account_id
       JOIN ic_fund_accounts ta ON ta.id = wt.to_account_id
       WHERE ${whereSql}
       ORDER BY wt.created_at DESC, wt.transaction_no DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      success: true as const,
      transactions: listRes.rows.map(mapWalletTransactionRow),
      total: Number(countRes.rows[0]?.total) || 0,
      limit,
      offset,
    };
  } catch (err) {
    logger.error({ err, options }, 'listWalletTransactionsPageAction failed');
    return { success: false as const, error: 'Failed to load wallet transactions' };
  }
}
