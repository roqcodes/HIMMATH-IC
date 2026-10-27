'use client';

import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import type { ICFundAccount, ICFundStatementLine } from '@/types';

type Props = {
  slug: string;
  line: ICFundStatementLine;
  accounts?: ICFundAccount[];
};

export default function StatementParticularsCell({ slug, line, accounts }: Props) {
  if (line.voucherNo === 0 || !line.counterpartyAccountId) {
    return <>{line.particulars}</>;
  }

  return (
    <ICFundAccountLink
      slug={slug}
      accountId={line.counterpartyAccountId}
      name={line.particulars}
      accounts={accounts}
    />
  );
}
