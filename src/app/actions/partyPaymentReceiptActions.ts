'use server';

import { query, withTransaction } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import { ensureLinkedAccount } from '@/lib/icFunds/icTransferFundSync';
import { validateVoucherCurrencyPolicy } from '@/lib/icFunds/currencyPolicy';
import { validateVoucherAccounts } from '@/lib/icFunds/voucherRules';
import { requireICFundsAccess } from '@/lib/icFunds/requireAccess';
import { icBranchTillSourceIdsForLookup } from '@/lib/icFunds/icBranchTill';
import { assertManagerCustomerAllowedAtIcBranch } from '@/lib/icTransfer/icBranchManagerScope';
import { assertManagerCustomerAllowedAtWarehouse } from '@/lib/icTransfer/warehouseManagerScope';
import {
  ensureInrCounterpartyAccount,
  ensureInrLinkedAccount,
  postInrVoucherInTx,
} from '@/lib/ledgers/inr/inrFundSync';
import { postPartyPaymentReceiptSchema } from '@/lib/validations/partyPaymentReceipt';
import type { ICFundAccountType } from '@/types';

export type PartyPaymentReceiptResult = { voucherId: string; book: 'AED' | 'INR' };

type ActionOk<T> = { success: true; data: T };
type ActionErr = { success: false; error: string };
type ActionResult<T> = ActionOk<T> | ActionErr;

export async function postPartyPaymentReceiptAction(
  input: unknown,
): Promise<ActionResult<PartyPaymentReceiptResult>> {
  const parsed = postPartyPaymentReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const access = await requireICFundsAccess(HQ_IC_FUNDS_BRANCH_ID, 'write');
  if (!access.ok) return { success: false, error: access.error };

  const amount = roundLedgerAmount(Number(parsed.data.amount));
  if (amount <= 0) return { success: false, error: 'Amount must be greater than zero' };

  const { voucherType, voucherDate, notes, managerId, customerId, book } = parsed.data;
  const aedAgentId = parsed.data.aedAgentId?.trim() || null;

  try {
    const cpRes = await query<{ kind: string; name: string }>(
      `SELECT kind, name FROM ic_counterparties WHERE id = $1 LIMIT 1`,
      [customerId],
    );
    if (cpRes.rows.length === 0 || String(cpRes.rows[0].kind) !== 'customer') {
      return { success: false, error: 'Select a customer counterparty.' };
    }
    const customerName = String(cpRes.rows[0].name);

    if (book === 'AED') {
      const icBranchId = parsed.data.icBranchId!;
      const scopeErr = await assertManagerCustomerAllowedAtIcBranch({
        icBranchId,
        managerId,
        customerId,
      });
      if (scopeErr) return { success: false, error: scopeErr.error };

      const id = await withTransaction(async client => {
        const tillIds = icBranchTillSourceIdsForLookup(icBranchId);
        const tillRes = await client.query(
          `SELECT id, account_type, status, branch_id, source_type, source_id
           FROM ic_fund_accounts
           WHERE branch_id = $1 AND source_type = 'ic_branch' AND source_id = ANY($2::text[])
           ORDER BY created_at ASC
           LIMIT 1
           FOR UPDATE`,
          [HQ_IC_FUNDS_BRANCH_ID, tillIds],
        );
        let tillId = tillRes.rows[0] ? String(tillRes.rows[0].id) : null;
        if (!tillId) {
          const branchRow = await client.query(`SELECT name FROM ic_branches WHERE id = $1 LIMIT 1`, [
            icBranchId,
          ]);
          tillId = await ensureLinkedAccount(client, {
            branchId: HQ_IC_FUNDS_BRANCH_ID,
            sourceType: 'ic_branch',
            sourceId: icBranchId,
            name: branchRow.rows[0] ? String(branchRow.rows[0].name) : 'Branch till',
          });
        }
        if (!tillId) throw new Error('Branch AED locker account not found.');

        const customerAedId = await ensureLinkedAccount(client, {
          branchId: HQ_IC_FUNDS_BRANCH_ID,
          sourceType: 'ic_counterparty',
          sourceId: customerId,
          name: customerName,
        });
        if (!customerAedId) throw new Error('Customer AED account not found.');

        const debitAccountId = voucherType === 'receipt' ? tillId : customerAedId;
        const creditAccountId = voucherType === 'receipt' ? customerAedId : tillId;

        const accounts = await client.query(
          `SELECT id, account_type, status, branch_id, source_type, source_id
           FROM ic_fund_accounts
           WHERE id = ANY($1::varchar[]) AND branch_id = $2
           ORDER BY id
           FOR UPDATE`,
          [[debitAccountId, creditAccountId], HQ_IC_FUNDS_BRANCH_ID],
        );
        if (accounts.rows.length !== 2) throw new Error('Ledger accounts not found');
        const debit = accounts.rows.find(r => String(r.id) === debitAccountId);
        const credit = accounts.rows.find(r => String(r.id) === creditAccountId);
        if (!debit || !credit) throw new Error('Ledger accounts not found');

        const ruleError = validateVoucherAccounts({
          voucherType,
          debitType: debit.account_type as ICFundAccountType,
          creditType: credit.account_type as ICFundAccountType,
          debitId: debitAccountId,
          creditId: creditAccountId,
        });
        if (ruleError) throw new Error(ruleError);
        const currencyError = validateVoucherCurrencyPolicy(debit, credit);
        if (currencyError) throw new Error(currencyError);

        await client.query(
          `INSERT INTO ic_fund_voucher_counters (branch_id, last_no) VALUES ($1, 0) ON CONFLICT (branch_id) DO NOTHING`,
          [HQ_IC_FUNDS_BRANCH_ID],
        );
        const counter = await client.query(
          `UPDATE ic_fund_voucher_counters SET last_no = last_no + 1 WHERE branch_id = $1 RETURNING last_no`,
          [HQ_IC_FUNDS_BRANCH_ID],
        );
        const voucherNo = Number(counter.rows[0]?.last_no) || 1;
        const voucherId = `ICFV-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;

        await client.query(
          `INSERT INTO ic_fund_vouchers (
             id, branch_id, voucher_no, voucher_type, voucher_date,
             debit_account_id, credit_account_id, amount, notes,
             created_by, created_by_name, created_by_user_id,
             reference_type, reference_id, manager_id, aed_agent_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'party_pr',$13,$14,$15)`,
          [
            voucherId,
            HQ_IC_FUNDS_BRANCH_ID,
            voucherNo,
            voucherType,
            voucherDate,
            debitAccountId,
            creditAccountId,
            amount,
            notes?.trim() ?? '',
            access.user.id ?? null,
            access.user.name ?? null,
            access.user.id ?? null,
            customerId,
            managerId,
            aedAgentId,
          ],
        );
        return voucherId;
      });

      revalidatePath('/admin/payments');
      revalidatePath('/admin/receipts');
      revalidatePath('/admin/branches');
      return { success: true, data: { voucherId: id, book: 'AED' } };
    }

    const warehouseId = parsed.data.warehouseId!;
    const scopeErr = await assertManagerCustomerAllowedAtWarehouse({
      warehouseId,
      managerId,
      customerId,
    });
    if (scopeErr) return { success: false, error: scopeErr.error };

    const id = await withTransaction(async client => {
      const whRes = await client.query(`SELECT name FROM ic_warehouses WHERE id = $1 LIMIT 1`, [warehouseId]);
      const warehouseInrId = await ensureInrLinkedAccount(
        client,
        HQ_IC_FUNDS_BRANCH_ID,
        'ic_warehouse',
        warehouseId,
        whRes.rows[0] ? String(whRes.rows[0].name) : 'Warehouse',
      );
      const customerInrId = await ensureInrCounterpartyAccount(
        client,
        HQ_IC_FUNDS_BRANCH_ID,
        customerId,
        customerName,
      );
      if (!warehouseInrId || !customerInrId) throw new Error('INR ledger accounts not found.');

      const debitAccountId = voucherType === 'receipt' ? warehouseInrId : customerInrId;
      const creditAccountId = voucherType === 'receipt' ? customerInrId : warehouseInrId;

      const voucherId = await postInrVoucherInTx(client, {
        branchId: HQ_IC_FUNDS_BRANCH_ID,
        voucherType,
        voucherDate,
        debitAccountId,
        creditAccountId,
        amount,
        notes: notes?.trim() ?? '',
        createdByName: access.user.name ?? access.user.id ?? null,
        referenceType: 'party_pr',
        referenceId: customerId,
        managerId,
        aedAgentId,
      });
      if (!voucherId) throw new Error('Failed to save INR voucher');
      return voucherId;
    });

    revalidatePath('/admin/payments');
    revalidatePath('/admin/receipts');
    revalidatePath('/admin/warehouse');
    return { success: true, data: { voucherId: id, book: 'INR' } };
  } catch (err) {
    logger.error({ err, input: parsed.data }, 'postPartyPaymentReceiptAction');
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save payment/receipt',
    };
  }
}
