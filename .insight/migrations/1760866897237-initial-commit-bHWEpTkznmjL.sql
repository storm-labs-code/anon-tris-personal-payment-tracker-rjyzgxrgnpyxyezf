create extension if not exists pgcrypto;

alter table category_budgets
  add constraint category_budgets_user_category_period_unique unique (user_id, category_id, period_start),
  add constraint category_budgets_amount_nonnegative check (amount >= 0),
  add constraint category_budgets_alert_threshold_percent_range check (alert_threshold_percent between 1 and 100),
  add constraint category_budgets_period_month_check check (period_start = date_trunc('month', period_start)::date);

create index idx_category_budgets_user_period_category on category_budgets (user_id, period_start, category_id);

create table overall_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade on update cascade,
  period_start date not null,
  amount bigint not null check (amount >= 0),
  alert_threshold_percent integer not null default 80 check (alert_threshold_percent between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint overall_budgets_period_month_check check (period_start = date_trunc('month', period_start)::date),
  constraint overall_budgets_user_period_unique unique (user_id, period_start)
);

create index idx_overall_budgets_user_period on overall_budgets (user_id, period_start);