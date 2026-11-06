'use client';

import CounterpartyLink from '@/components/counterparties/CounterpartyLink';
import { dealAgentDisplayName, dealAgentPartyId } from '@/lib/counterparties/dealAgent';

type DealAgentFields = {
  aedAgentName?: string | null;
  aedAgentCounterpartyId?: string | null;
  aedAgentId?: string | null;
};

export default function DealAgentHint({
  deal,
  nameOf,
  branchSlug,
}: {
  deal: DealAgentFields;
  nameOf?: (id: string) => string;
  branchSlug?: string;
}) {
  const id = dealAgentPartyId(deal);
  if (!id) return null;
  return (
    <div className="mt-0.5 text-[10px] text-slate-500">
      Agent{' '}
      <CounterpartyLink
        counterpartyId={deal.aedAgentCounterpartyId || id}
        name={dealAgentDisplayName(deal, nameOf)}
        branchSlug={branchSlug}
        className="font-medium text-slate-600 hover:text-sky-800 hover:underline"
        stopPropagation
      />
    </div>
  );
}
