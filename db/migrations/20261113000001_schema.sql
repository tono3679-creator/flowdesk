-- FlowDesk のスキーマ（表・型・index）
--
-- * すべての業務表に organization_id を持たせ、(organization_id, id) を一意にする。
--   子の表は (organization_id, 親id) の複合外部キーで参照するため、別の会社の行は指せない。
-- * 金額は bigint（円・整数）。浮動小数点は使わない。
-- * 日付だけの項目（期限・予定日・計上日）は date（名前は *_on）、日時は timestamptz（*_at）。
-- * 業務ルール（自動更新・確度・売上の同期）は 20261113000002、RLS と権限は 20261113000003。

create schema if not exists app_private;
create schema if not exists app_auth;
revoke all on schema app_private from public;
revoke all on schema app_auth from public;

-- ---------------------------------------------------------------
-- 型
-- ---------------------------------------------------------------
create type public.org_role as enum ('admin', 'manager', 'member');
create type public.customer_type as enum ('corporate', 'individual');
create type public.inquiry_status as enum ('new', 'in_progress', 'on_hold', 'converted', 'closed', 'not_needed');
create type public.priority_level as enum ('low', 'medium', 'high', 'urgent');
create type public.stage_category as enum ('open', 'won', 'completed', 'lost', 'hold');
create type public.task_status as enum ('todo', 'doing', 'waiting', 'done');
create type public.activity_type as enum ('call', 'email', 'line', 'online_meeting', 'visit', 'meeting', 'quote', 'other');

-- ---------------------------------------------------------------
-- ログインの利用者（Supabase Auth と衝突しないよう app_auth に置く）
-- ---------------------------------------------------------------
create table app_auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  encrypted_password text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index users_email_lower_idx on app_auth.users (lower(email)) where email is not null;

-- ---------------------------------------------------------------
-- 組織（テナント）
-- ---------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  is_demo boolean not null default false,
  demo_expires_at timestamptz,
  is_showcase boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_demo or demo_expires_at is not null)
);
create index organizations_demo_idx on public.organizations (demo_expires_at) where is_demo;

create table public.organization_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  industry text not null default 'その他サービス業' check (char_length(industry) <= 50),
  timezone text not null default 'Asia/Tokyo' check (char_length(timezone) <= 50),
  currency text not null default 'JPY' check (currency in ('JPY')),
  -- アラートの判定条件
  unanswered_hours integer not null default 24 check (unanswered_hours between 1 and 720),
  quote_follow_days integer not null default 7 check (quote_follow_days between 1 and 180),
  no_contact_days integer not null default 30 check (no_contact_days between 1 and 365),
  -- 初回対応率の基準（この時間以内に初回対応したら「対応できた」）
  first_response_target_hours integer not null default 24 check (first_response_target_hours between 1 and 720),
  -- 業種ごとに変える選択肢
  inquiry_categories text[] not null default array['新規のご相談', '見積依頼', '資料請求', '既存契約の相談', 'サポート', 'その他'],
  deal_types text[] not null default array['新規', '追加', '保守・運用', 'スポット', 'その他'],
  priority_labels jsonb not null default '{"low":"低","medium":"中","high":"高","urgent":"緊急"}'::jsonb,
  -- 案件化・見積提出のときにタスクを自動で作る
  auto_tasks boolean not null default true,
  updated_at timestamptz not null default now(),
  check (cardinality(inquiry_categories) between 1 and 30),
  check (cardinality(deal_types) between 1 and 30)
);

create table public.profiles (
  id uuid primary key references app_auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  title text check (char_length(title) <= 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

-- 採番（顧客・問い合わせ・案件の番号。会社ごとに 1, 2, 3 …）
create table app_private.counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,
  value integer not null default 0,
  primary key (organization_id, kind)
);

-- ---------------------------------------------------------------
-- 設定で変える一覧
-- ---------------------------------------------------------------
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  category public.stage_category not null default 'open',
  default_probability integer not null check (default_probability between 0 and 100),
  -- Kanban の列名（同じ列名のステータスは1列にまとめる。null はボードに出さない）
  board_column text check (char_length(board_column) <= 20),
  -- このステータスに入ったら見積提出日を記録する
  marks_quote_submitted boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);
create index pipeline_stages_org_idx on public.pipeline_stages (organization_id, sort_order);

create table public.inquiry_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create table public.customer_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  color text not null default 'slate' check (color in ('slate', 'blue', 'green', 'amber', 'red', 'violet', 'teal', 'pink')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

-- ---------------------------------------------------------------
-- 顧客
-- ---------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number integer not null,
  type public.customer_type not null default 'corporate',
  company_name text check (char_length(company_name) <= 100),
  name text check (char_length(name) <= 50),
  department text check (char_length(department) <= 50),
  position text check (char_length(position) <= 50),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 200),
  address text check (char_length(address) <= 200),
  owner_id uuid,
  rank text check (rank in ('S', 'A', 'B', 'C')),
  memo text check (char_length(memo) <= 2000),
  last_contact_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, number),
  check (coalesce(company_name, '') <> '' or coalesce(name, '') <> ''),
  check (type = 'individual' or coalesce(company_name, '') <> ''),
  foreign key (organization_id, owner_id) references public.organization_members (organization_id, user_id) on delete set null (owner_id)
);
create index customers_org_idx on public.customers (organization_id, updated_at desc);
create index customers_owner_idx on public.customers (organization_id, owner_id);
create index customers_email_idx on public.customers (organization_id, lower(email));
create index customers_search_idx on public.customers
  using gin ((coalesce(company_name, '') || ' ' || coalesce(name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '')) extensions.gin_trgm_ops);

create table public.customer_tag_relations (
  organization_id uuid not null,
  customer_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (customer_id, tag_id),
  foreign key (organization_id, customer_id) references public.customers (organization_id, id) on delete cascade,
  foreign key (organization_id, tag_id) references public.customer_tags (organization_id, id) on delete cascade
);
create index customer_tag_relations_tag_idx on public.customer_tag_relations (organization_id, tag_id);

-- ---------------------------------------------------------------
-- 問い合わせ
-- ---------------------------------------------------------------
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number integer not null,
  customer_id uuid,
  received_at timestamptz not null default now(),
  source_id uuid,
  category text check (char_length(category) <= 30),
  title text not null check (char_length(title) between 1 and 100),
  content text check (char_length(content) <= 5000),
  -- 受付時に聞いた連絡先（顧客に紐づける前でも、誰からの問い合わせか分かるように）
  contact_name text check (char_length(contact_name) <= 50),
  company_name text check (char_length(company_name) <= 100),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 200),
  owner_id uuid,
  priority public.priority_level not null default 'medium',
  status public.inquiry_status not null default 'new',
  next_action_on date,
  first_response_at timestamptz,
  last_activity_at timestamptz,
  converted_deal_id uuid,
  converted_at timestamptz,
  memo text check (char_length(memo) <= 2000),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, number),
  check ((status = 'converted') = (converted_deal_id is not null)),
  foreign key (organization_id, customer_id) references public.customers (organization_id, id) on delete set null (customer_id),
  foreign key (organization_id, source_id) references public.inquiry_sources (organization_id, id) on delete set null (source_id),
  foreign key (organization_id, owner_id) references public.organization_members (organization_id, user_id) on delete set null (owner_id)
);
create index inquiries_org_received_idx on public.inquiries (organization_id, received_at desc);
create index inquiries_status_idx on public.inquiries (organization_id, status);
create index inquiries_owner_idx on public.inquiries (organization_id, owner_id);
create index inquiries_customer_idx on public.inquiries (organization_id, customer_id);
create index inquiries_next_action_idx on public.inquiries (organization_id, next_action_on) where next_action_on is not null;
create index inquiries_search_idx on public.inquiries
  using gin ((title || ' ' || coalesce(content, '') || ' ' || coalesce(contact_name, '') || ' ' || coalesce(company_name, '')) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------
-- 案件
-- ---------------------------------------------------------------
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number integer not null,
  customer_id uuid not null,
  inquiry_id uuid,
  title text not null check (char_length(title) between 1 and 100),
  owner_id uuid,
  deal_type text check (char_length(deal_type) <= 30),
  stage_id uuid not null,
  probability integer not null default 0 check (probability between 0 and 100),
  -- 確度を手で決めた案件（ステータスが変わっても既定の確度で上書きしない。受注・失注は除く）
  probability_manual boolean not null default false,
  estimated_amount bigint not null default 0 check (estimated_amount between 0 and 100000000000),
  -- 受注見込金額 = 見積金額 × 受注確度（円未満は四捨五入。src/lib/domain/money.ts と同じ式）
  expected_revenue bigint generated always as (round(estimated_amount * probability / 100.0)::bigint) stored,
  actual_amount bigint check (actual_amount between 0 and 100000000000),
  started_on date,
  quote_submitted_on date,
  expected_close_on date,
  expected_complete_on date,
  -- 受注日・失注日（ステータスの分類が受注／失注になった日）
  closed_on date,
  completed_on date,
  -- 売上計上日（空なら完了日、それもなければ受注日）
  revenue_on date,
  lost_reason text check (char_length(lost_reason) <= 50),
  last_contact_at timestamptz,
  next_follow_up_on date,
  memo text check (char_length(memo) <= 5000),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, number),
  unique (inquiry_id),
  foreign key (organization_id, customer_id) references public.customers (organization_id, id) on delete restrict,
  foreign key (organization_id, inquiry_id) references public.inquiries (organization_id, id) on delete set null (inquiry_id),
  foreign key (organization_id, stage_id) references public.pipeline_stages (organization_id, id) on delete restrict,
  foreign key (organization_id, owner_id) references public.organization_members (organization_id, user_id) on delete set null (owner_id)
);
create index deals_org_stage_idx on public.deals (organization_id, stage_id);
create index deals_owner_idx on public.deals (organization_id, owner_id);
create index deals_customer_idx on public.deals (organization_id, customer_id);
create index deals_follow_idx on public.deals (organization_id, next_follow_up_on) where next_follow_up_on is not null;
create index deals_closed_idx on public.deals (organization_id, closed_on) where closed_on is not null;
create index deals_search_idx on public.deals using gin ((title || ' ' || coalesce(memo, '')) extensions.gin_trgm_ops);

alter table public.inquiries
  add foreign key (organization_id, converted_deal_id) references public.deals (organization_id, id) on delete set null (converted_deal_id);

create table public.deal_stage_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  deal_id uuid not null,
  from_stage_id uuid,
  to_stage_id uuid not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  foreign key (organization_id, deal_id) references public.deals (organization_id, id) on delete cascade,
  foreign key (organization_id, from_stage_id) references public.pipeline_stages (organization_id, id) on delete set null (from_stage_id),
  foreign key (organization_id, to_stage_id) references public.pipeline_stages (organization_id, id) on delete cascade
);
create index deal_stage_history_deal_idx on public.deal_stage_history (organization_id, deal_id, changed_at);

-- ---------------------------------------------------------------
-- タスク
-- ---------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text check (char_length(description) <= 2000),
  assignee_id uuid,
  customer_id uuid,
  inquiry_id uuid,
  deal_id uuid,
  priority public.priority_level not null default 'medium',
  status public.task_status not null default 'todo',
  start_on date,
  due_on date,
  completed_at timestamptz,
  memo text check (char_length(memo) <= 2000),
  -- 案件化・見積提出のときにシステムが作ったタスク
  is_auto boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (start_on is null or due_on is null or start_on <= due_on),
  check ((status = 'done') = (completed_at is not null)),
  foreign key (organization_id, assignee_id) references public.organization_members (organization_id, user_id) on delete set null (assignee_id),
  foreign key (organization_id, customer_id) references public.customers (organization_id, id) on delete set null (customer_id),
  foreign key (organization_id, inquiry_id) references public.inquiries (organization_id, id) on delete set null (inquiry_id),
  foreign key (organization_id, deal_id) references public.deals (organization_id, id) on delete set null (deal_id)
);
create index tasks_due_idx on public.tasks (organization_id, due_on) where status <> 'done';
create index tasks_assignee_idx on public.tasks (organization_id, assignee_id, status);
create index tasks_deal_idx on public.tasks (organization_id, deal_id);
create index tasks_customer_idx on public.tasks (organization_id, customer_id);
create index tasks_inquiry_idx on public.tasks (organization_id, inquiry_id);

-- ---------------------------------------------------------------
-- 対応履歴
-- ---------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid,
  inquiry_id uuid,
  deal_id uuid,
  user_id uuid,
  activity_type public.activity_type not null,
  occurred_at timestamptz not null default now(),
  content text not null check (char_length(content) between 1 and 5000),
  result text check (char_length(result) <= 1000),
  next_action_on date,
  memo text check (char_length(memo) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (customer_id is not null or inquiry_id is not null or deal_id is not null),
  foreign key (organization_id, customer_id) references public.customers (organization_id, id) on delete cascade,
  foreign key (organization_id, inquiry_id) references public.inquiries (organization_id, id) on delete cascade,
  foreign key (organization_id, deal_id) references public.deals (organization_id, id) on delete cascade,
  foreign key (organization_id, user_id) references public.organization_members (organization_id, user_id) on delete set null (user_id)
);
create index activities_org_idx on public.activities (organization_id, occurred_at desc);
create index activities_customer_idx on public.activities (organization_id, customer_id, occurred_at);
create index activities_deal_idx on public.activities (organization_id, deal_id, occurred_at);
create index activities_inquiry_idx on public.activities (organization_id, inquiry_id, occurred_at);
create index activities_user_idx on public.activities (organization_id, user_id, occurred_at);

-- ---------------------------------------------------------------
-- 売上（受注した案件ごとに1件。deals のトリガーが作り・直し・消す）
-- ---------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  deal_id uuid not null,
  customer_id uuid not null,
  owner_id uuid,
  amount bigint not null check (amount >= 0),
  recognized_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id),
  foreign key (organization_id, deal_id) references public.deals (organization_id, id) on delete cascade,
  foreign key (organization_id, customer_id) references public.customers (organization_id, id) on delete cascade,
  foreign key (organization_id, owner_id) references public.organization_members (organization_id, user_id) on delete set null (owner_id)
);
create index sales_org_date_idx on public.sales (organization_id, recognized_on);
