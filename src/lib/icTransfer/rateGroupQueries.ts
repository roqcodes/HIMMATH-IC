/** Rate groups with aggregated counterparty / branch membership. */

export const IC_RATE_GROUPS_WITH_MEMBERS_FROM = `
  FROM ic_rate_groups g
  LEFT JOIN (
    SELECT group_id, array_agg(counterparty_id::text) AS customer_ids
    FROM ic_rate_group_counterparties
    GROUP BY group_id
  ) cust ON cust.group_id = g.id
  LEFT JOIN (
    SELECT group_id, array_agg(branch_id) AS branch_ids
    FROM ic_rate_group_branches
    GROUP BY group_id
  ) br ON br.group_id = g.id`;

export const IC_RATE_GROUPS_WITH_MEMBERS_SELECT = `
  SELECT g.*,
    COALESCE(cust.customer_ids, ARRAY[]::varchar[]) AS customer_ids,
    COALESCE(br.branch_ids, ARRAY[]::varchar[]) AS branch_ids
  ${IC_RATE_GROUPS_WITH_MEMBERS_FROM}`;

export const SELECT_RATE_GROUPS_BY_IDS_WITH_MEMBERS = `
  SELECT g.*,
    COALESCE(cust.customer_ids, ARRAY[]::varchar[]) AS customer_ids,
    COALESCE(br.branch_ids, ARRAY[]::varchar[]) AS branch_ids
  FROM ic_rate_groups g
  LEFT JOIN (
    SELECT group_id, array_agg(counterparty_id::text) AS customer_ids
    FROM ic_rate_group_counterparties
    GROUP BY group_id
  ) cust ON cust.group_id = g.id
  LEFT JOIN (
    SELECT group_id, array_agg(branch_id) AS branch_ids
    FROM ic_rate_group_branches
    GROUP BY group_id
  ) br ON br.group_id = g.id
  WHERE g.id = ANY($1::text[])`;
