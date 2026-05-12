-- GHL integration: link quotes to GHL opportunities
alter table quotes add column if not exists ghl_opportunity_id text;

create index if not exists quotes_ghl_opportunity_idx
  on quotes(ghl_opportunity_id)
  where ghl_opportunity_id is not null;
