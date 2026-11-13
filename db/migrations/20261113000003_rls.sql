-- 行レベルセキュリティ（RLS）と権限
--
-- * どの表も「自分の組織（current_org_id()）」の行しか見えない・書けない
-- * 管理者・マネージャーは組織の全件。一般担当者は「自分が担当」「未割当」「自分が作った」ものだけ
--   （顧客は重複登録を防ぐため全員が見られる。売上は自分の案件の分だけ）
-- * 設定（組織・ステータス・経路・タグ・メンバー）を変えられるのは管理者だけ
-- * 自動で決まる列（番号・作成者・最終接触日・初回対応日時・受注見込・売上）は書き込みの権限を付けない
-- 関数呼び出しは (select …) で包み、1回の問い合わせで1回だけ評価させる。

alter table public.organizations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.inquiry_sources enable row level security;
alter table public.customer_tags enable row level security;
alter table public.customers enable row level security;
alter table public.customer_tag_relations enable row level security;
alter table public.inquiries enable row level security;
alter table public.deals enable row level security;
alter table public.deal_stage_history enable row level security;
alter table public.tasks enable row level security;
alter table public.activities enable row level security;
alter table public.sales enable row level security;

-- まず全部取り上げてから、必要なものだけ許可する
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema app_private from public, anon, authenticated;
revoke all on all tables in schema app_private from public, anon, authenticated;
revoke all on all tables in schema app_auth from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema app_private revoke all on functions from public;

grant usage on schema app_private to authenticated;

-- ---------------------------------------------------------------
-- 権限（表・列）
-- ---------------------------------------------------------------
grant select on public.organizations, public.organization_settings, public.profiles, public.organization_members,
  public.pipeline_stages, public.inquiry_sources, public.customer_tags, public.customers, public.customer_tag_relations,
  public.inquiries, public.deals, public.deal_stage_history, public.tasks, public.activities, public.sales
  to authenticated;

grant update (name) on public.organizations to authenticated;
grant update (industry, timezone, unanswered_hours, quote_follow_days, no_contact_days, first_response_target_hours,
              inquiry_categories, deal_types, priority_labels, auto_tasks)
  on public.organization_settings to authenticated;
grant update (display_name, title) on public.profiles to authenticated;
grant update (role, is_active) on public.organization_members to authenticated;

grant insert (organization_id, name, category, default_probability, board_column, marks_quote_submitted, sort_order, is_active),
      update (name, category, default_probability, board_column, marks_quote_submitted, sort_order, is_active), delete
  on public.pipeline_stages to authenticated;
grant insert (organization_id, name, sort_order, is_active), update (name, sort_order, is_active), delete
  on public.inquiry_sources to authenticated;
grant insert (organization_id, name, color, sort_order), update (name, color, sort_order), delete
  on public.customer_tags to authenticated;

grant insert (organization_id, type, company_name, name, department, position, phone, email, address, owner_id, rank, memo),
      update (type, company_name, name, department, position, phone, email, address, owner_id, rank, memo), delete
  on public.customers to authenticated;
grant insert (organization_id, customer_id, tag_id), delete on public.customer_tag_relations to authenticated;

grant insert (organization_id, customer_id, received_at, source_id, category, title, content, contact_name, company_name,
              phone, email, owner_id, priority, status, next_action_on, memo),
      update (customer_id, received_at, source_id, category, title, content, contact_name, company_name,
              phone, email, owner_id, priority, status, next_action_on, memo), delete
  on public.inquiries to authenticated;

grant insert (organization_id, customer_id, title, owner_id, deal_type, stage_id, probability, probability_manual,
              estimated_amount, actual_amount, started_on, quote_submitted_on, expected_close_on, expected_complete_on,
              closed_on, revenue_on, lost_reason, next_follow_up_on, memo),
      update (customer_id, title, owner_id, deal_type, stage_id, probability, probability_manual,
              estimated_amount, actual_amount, started_on, quote_submitted_on, expected_close_on, expected_complete_on,
              closed_on, revenue_on, lost_reason, next_follow_up_on, memo), delete
  on public.deals to authenticated;

grant insert (organization_id, title, description, assignee_id, customer_id, inquiry_id, deal_id, priority, status, start_on, due_on, memo),
      update (title, description, assignee_id, customer_id, inquiry_id, deal_id, priority, status, start_on, due_on, memo), delete
  on public.tasks to authenticated;

grant insert (organization_id, customer_id, inquiry_id, deal_id, user_id, activity_type, occurred_at, content, result, next_action_on, memo),
      update (customer_id, inquiry_id, deal_id, user_id, activity_type, occurred_at, content, result, next_action_on, memo), delete
  on public.activities to authenticated;

grant execute on function public.current_org_id(), public.current_org_role(), public.is_org_manager(), public.org_today(uuid),
  public.convert_inquiry(uuid, text, bigint, text, boolean)
  to authenticated;
-- トリガー関数（呼び出した利用者の権限で動くもの）
grant execute on function app_private.touch_updated_at(), app_private.set_created_by(), app_private.enforce_member_owner(), app_private.bulk_loading(),
  app_private.activity_user(), app_private.task_completed_at()
  to authenticated;

-- ---------------------------------------------------------------
-- ポリシー
-- ---------------------------------------------------------------
create policy organizations_read on public.organizations for select to authenticated
  using (id = (select public.current_org_id()));
create policy organizations_update on public.organizations for update to authenticated
  using (id = (select public.current_org_id()) and (select public.current_org_role()) = 'admin')
  with check (id = (select public.current_org_id()));

create policy settings_read on public.organization_settings for select to authenticated
  using (organization_id = (select public.current_org_id()));
create policy settings_update on public.organization_settings for update to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.current_org_role()) = 'admin')
  with check (organization_id = (select public.current_org_id()));

create policy members_read on public.organization_members for select to authenticated
  using (organization_id = (select public.current_org_id()));
create policy members_update on public.organization_members for update to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.current_org_role()) = 'admin')
  with check (organization_id = (select public.current_org_id()));

-- 同じ組織のメンバーのプロフィールだけ見える。自分のプロフィールは自分で、他人のは管理者が直せる
create policy profiles_read on public.profiles for select to authenticated
  using (exists (select 1 from public.organization_members m where m.user_id = profiles.id and m.organization_id = (select public.current_org_id())));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or ((select public.current_org_role()) = 'admin'
         and exists (select 1 from public.organization_members m where m.user_id = profiles.id and m.organization_id = (select public.current_org_id()))));

-- 設定で変える一覧：読むのは全員・書くのは管理者
do $$
declare
  t text;
begin
  foreach t in array array['pipeline_stages', 'inquiry_sources', 'customer_tags'] loop
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (organization_id = (select public.current_org_id()))', t);
    execute format($p$create policy %1$s_write on public.%1$s for all to authenticated
      using (organization_id = (select public.current_org_id()) and (select public.current_org_role()) = 'admin')
      with check (organization_id = (select public.current_org_id()) and (select public.current_org_role()) = 'admin')$p$, t);
  end loop;
end $$;

-- 顧客：全員が見て登録できる。編集は担当者か未割当（マネージャー以上は全件）。削除はマネージャー以上
create policy customers_read on public.customers for select to authenticated
  using (organization_id = (select public.current_org_id()));
create policy customers_insert on public.customers for insert to authenticated
  with check (organization_id = (select public.current_org_id()));
create policy customers_update on public.customers for update to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.is_org_manager()) or owner_id is null or owner_id = (select auth.uid()) or created_by = (select auth.uid())))
  with check (organization_id = (select public.current_org_id()));
create policy customers_delete on public.customers for delete to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.is_org_manager()));

create policy tag_rel_read on public.customer_tag_relations for select to authenticated
  using (organization_id = (select public.current_org_id()));
create policy tag_rel_write on public.customer_tag_relations for insert to authenticated
  with check (organization_id = (select public.current_org_id()));
create policy tag_rel_delete on public.customer_tag_relations for delete to authenticated
  using (organization_id = (select public.current_org_id()));

-- 問い合わせ：一般は自分担当・未割当・自分が受け付けたもの
create policy inquiries_read on public.inquiries for select to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.is_org_manager()) or owner_id is null or owner_id = (select auth.uid()) or created_by = (select auth.uid())));
create policy inquiries_insert on public.inquiries for insert to authenticated
  with check (organization_id = (select public.current_org_id()));
create policy inquiries_update on public.inquiries for update to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.is_org_manager()) or owner_id is null or owner_id = (select auth.uid())))
  with check (organization_id = (select public.current_org_id()));
create policy inquiries_delete on public.inquiries for delete to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.is_org_manager()));

-- 案件：一般は自分が担当・作成したもの
create policy deals_read on public.deals for select to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.is_org_manager()) or owner_id = (select auth.uid()) or created_by = (select auth.uid())));
create policy deals_insert on public.deals for insert to authenticated
  with check (organization_id = (select public.current_org_id()));
create policy deals_update on public.deals for update to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.is_org_manager()) or owner_id = (select auth.uid())))
  with check (organization_id = (select public.current_org_id()));
create policy deals_delete on public.deals for delete to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.is_org_manager()));

create policy deal_history_read on public.deal_stage_history for select to authenticated
  using (organization_id = (select public.current_org_id())
         and exists (select 1 from public.deals d where d.organization_id = deal_stage_history.organization_id and d.id = deal_stage_history.deal_id));

-- タスク：一般は自分が担当・作成したもの、自分の案件のもの
create policy tasks_read on public.tasks for select to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.is_org_manager()) or assignee_id = (select auth.uid()) or created_by = (select auth.uid())
              or (deal_id is not null and exists (select 1 from public.deals d where d.organization_id = tasks.organization_id and d.id = tasks.deal_id))));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (organization_id = (select public.current_org_id()));
create policy tasks_update on public.tasks for update to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.is_org_manager()) or assignee_id = (select auth.uid()) or created_by = (select auth.uid())))
  with check (organization_id = (select public.current_org_id()));
create policy tasks_delete on public.tasks for delete to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.is_org_manager()) or created_by = (select auth.uid())));

-- 対応履歴：一般は自分の記録と、見られる案件・問い合わせの記録、顧客だけに紐づく記録
create policy activities_read on public.activities for select to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.is_org_manager()) or user_id = (select auth.uid())
              or (deal_id is not null and exists (select 1 from public.deals d where d.organization_id = activities.organization_id and d.id = activities.deal_id))
              or (inquiry_id is not null and exists (select 1 from public.inquiries i where i.organization_id = activities.organization_id and i.id = activities.inquiry_id))
              or (deal_id is null and inquiry_id is null)));
create policy activities_insert on public.activities for insert to authenticated
  with check (organization_id = (select public.current_org_id()));
create policy activities_update on public.activities for update to authenticated
  using (organization_id = (select public.current_org_id()) and ((select public.is_org_manager()) or user_id = (select auth.uid())))
  with check (organization_id = (select public.current_org_id()));
create policy activities_delete on public.activities for delete to authenticated
  using (organization_id = (select public.current_org_id()) and ((select public.is_org_manager()) or user_id = (select auth.uid())));

-- 売上：マネージャー以上は全件、一般は自分の案件の分
create policy sales_read on public.sales for select to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.is_org_manager()) or owner_id = (select auth.uid())));

-- ---------------------------------------------------------------
-- メンバー：最後の管理者は外せない
-- ---------------------------------------------------------------
create or replace function app_private.keep_one_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (old.role = 'admin' and old.is_active) and (new.role <> 'admin' or not new.is_active)
     and not exists (select 1 from public.organization_members m
                      where m.organization_id = old.organization_id and m.user_id <> old.user_id and m.role = 'admin' and m.is_active) then
    raise exception '管理者が1人もいなくなるため変更できません' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger members_keep_admin before update on public.organization_members
  for each row execute function app_private.keep_one_admin();
