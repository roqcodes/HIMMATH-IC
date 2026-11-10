import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import { icfTd } from '@/components/ic-funds/ui';

export function BalanceWithPending({
  balance,
  pendingBalance = 0,
  book = 'AED',
}: {
  balance: number;
  pendingBalance?: number;
  book?: 'AED' | 'INR';
}) {
  const pending = pendingBalance ?? 0;
  const Fmt = book === 'INR' ? FmtLedgerInr : FmtLedgerAed;
  return (
    <div className="text-right font-mono tabular-nums">
      <span className={balance < 0 ? 'text-red-600' : ''}><Fmt amount={balance} /></span>
      {pending !== 0 ? (
        <span className="block text-[10px] font-medium text-amber-600"><Fmt amount={pending} /> pending</span>
      ) : null}
    </div>
  );
}

export function BalanceWithPendingCell({
  balance,
  pendingBalance = 0,
  book = 'AED',
}: {
  balance: number;
  pendingBalance?: number;
  book?: 'AED' | 'INR';
}) {
  return (
    <td className={icfTd}>
      <BalanceWithPending balance={balance} pendingBalance={pendingBalance} book={book} />
    </td>
  );
}
