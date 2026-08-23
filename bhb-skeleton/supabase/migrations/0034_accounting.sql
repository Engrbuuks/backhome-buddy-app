-- 0034: proper revenue accounting.
-- Distinguish SERVICE line items (money you actually earn) from PURCHASE /
-- passthrough items (money the client gives you to spend on their behalf — NOT
-- revenue). Revenue = service items only. Profit = revenue - buddy payout.

-- Tag each quote line as a service fee or a passthrough purchase.
alter table quote_items add column if not exists item_type text not null default 'service';
-- allowed: 'service' | 'purchase'

-- Cache the service-only revenue on the request, so reporting is fast and the
-- historical figure is locked in at quote time.
alter table requests add column if not exists service_revenue_ngn numeric(12,2);

-- Backfill: for existing requests, assume the whole client price was service
-- revenue (there was no purchase split before), so nothing changes retroactively.
update requests
set service_revenue_ngn = client_price_ngn
where service_revenue_ngn is null and client_price_ngn is not null;
