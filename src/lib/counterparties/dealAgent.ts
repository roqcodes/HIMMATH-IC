export function dealAgentPartyId(row: {
  aedAgentCounterpartyId?: string | null;
  aedAgentId?: string | null;
}): string | null {
  const id = row.aedAgentCounterpartyId || row.aedAgentId;
  return id ? String(id) : null;
}

export function dealAgentDisplayName(
  row: {
    aedAgentName?: string | null;
    aedAgentCounterpartyId?: string | null;
    aedAgentId?: string | null;
  },
  nameOf?: (id: string) => string,
): string {
  if (row.aedAgentName?.trim()) return row.aedAgentName.trim();
  const id = dealAgentPartyId(row);
  if (id && nameOf) {
    const named = nameOf(id);
    if (named && named !== id) return named;
  }
  return 'Agent';
}
