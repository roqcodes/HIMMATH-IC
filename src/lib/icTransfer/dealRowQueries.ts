/** Row shapes for mapICPurchaseRow / mapICSaleRow (includes AED agent denormalized fields). */

export const IC_PURCHASE_ROW_SELECT = `
  SELECT p.*, aa.counterparty_id AS aed_agent_counterparty_id, aa.name AS aed_agent_name
  FROM ic_purchases p
  LEFT JOIN ic_aed_agents aa ON aa.id = p.aed_agent_id`;

export const IC_SALE_ROW_SELECT = `
  SELECT s.*, a.name AS delivery_agent_name, aa.counterparty_id AS aed_agent_counterparty_id, aa.name AS aed_agent_name
  FROM ic_sales s
  LEFT JOIN ic_delivery_agents a ON s.delivery_agent_id = a.id
  LEFT JOIN ic_aed_agents aa ON aa.id = s.aed_agent_id`;
