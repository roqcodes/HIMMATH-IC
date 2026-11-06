import { fmtLedgerAed, FmtLedgerAed } from '@/lib/icFunds/format';
import { icfTd } from '@/components/ic-funds/ui';

export function BalanceWithPending({
  balance,
  pendingBalance = 0,
}: {
  balance: number;
  pendingBalance?: number;
}) {
  const pending = pendingBalance ?? 0;
  return (
    <div className="text-right font-mono tabular-nums">
      <span className={balance < 0 ? 'text-red-600' : ''}><FmtLedgerAed amount={balance} /></span>
      {pending !== 0 ? (
        <span className="block text-[10px] font-medium text-amber-600"><FmtLedgerAed amount={pending} /> pending</span>
      ) : null}
    </div>
  );
}

export function BalanceWithPendingCell({
  balance,
  pendingBalance = 0,
}: {
  balance: number;
  pendingBalance?: number;
}) {
  return (
    <td className={icfTd}>
      <BalanceWithPending balance={balance} pendingBalance={pendingBalance} />
    </td>
  );
}
