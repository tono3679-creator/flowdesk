-- 業務ルール（トリガーと関数）
--
-- * 現在の利用者の組織・役割：current_org_id() / current_org_role()
-- * 採番・更新日時・作成者は DB が入れる（画面から偽れない）
-- * 一般担当者は「担当者」を自分以外に変えられない（担当者の変更はマネージャー以上）
-- * 案件：ステータスが変わったら確度・受注日・失注日・見積提出日を更新し、履歴と売上を自動で記録
-- * 対応履歴：登録すると顧客・案件の最終接触日、問い合わせの初回対応日時（未対応→対応中）、次回予定を自動で更新
-- * 問い合わせの案件化：convert_inquiry()（顧客・内容・担当者・対応履歴を引き継ぐ）

-- ---------------------------------------------------------------
-- 現在の利用者
-- ---------------------------------------------------------------
-- 利用者がどの組織として操作しているか。アプリが request.jwt.claims に org_id を入れる（無ければ最初に所属した組織）。
-- 所属していない組織の ID を入れても null になる（＝何も見えない）。
create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id
    from public.organization_members m
   where m.user_id = auth.uid()
     and m.is_active
     and (
       nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'org_id', '') is null
       or m.organization_id = (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'org_id')::uuid
     )
   order by m.created_at, m.organization_id
   limit 1
$$;

create or replace function public.current_org_role() returns public.org_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.organization_members m
   where m.user_id = auth.uid() and m.organization_id = public.current_org_id() and m.is_active
$$;

-- 管理者またはマネージャー（チーム全体を見られる）
create or replace function public.is_org_manager() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(public.current_org_role() in ('admin', 'manager'), false)
$$;

-- 組織のタイムゾーンでの「今日」
create or replace function public.org_today(p_org uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select s.timezone from public.organization_settings s where s.organization_id = p_org), 'Asia/Tokyo'))::date
$$;

-- デモデータの一括登録中か（Seed・デモ作成だけが使う。生成したデータに履歴・売上・最終接触日などが揃っているので、
-- 自動で作るトリガーを止める）。ログイン中の利用者（role を authenticated に切り替えた接続）からは有効にできない
create or replace function app_private.bulk_loading() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('flowdesk.bulk_load', true), '') = 'on'
     and coalesce(nullif(current_setting('role', true), ''), 'none') = 'none'
$$;

-- ---------------------------------------------------------------
-- 共通のトリガー
-- ---------------------------------------------------------------
create or replace function app_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- 作成者は必ずログイン中の利用者（DB 所有者の接続＝Seed のときは渡された値のまま）
create or replace function app_private.set_created_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;

-- 会社ごとの連番
create or replace function app_private.assign_number() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v integer;
begin
  if app_private.bulk_loading() then
    return new;
  end if;
  insert into app_private.counters (organization_id, kind, value) values (new.organization_id, tg_table_name, 1)
  on conflict (organization_id, kind) do update set value = app_private.counters.value + 1
  returning value into v;
  new.number := v;
  return new;
end $$;

-- 一般担当者は、担当者の欄（引数の列名）を自分か空以外にできない。変更前が他人のときは変えられない
create or replace function app_private.enforce_member_owner() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_col text := tg_argv[0];
  v_new uuid := (to_jsonb(new) ->> v_col)::uuid;
  v_old uuid;
begin
  if auth.uid() is null or public.is_org_manager() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    v_old := (to_jsonb(old) ->> v_col)::uuid;
    if v_new is not distinct from v_old then
      return new;
    end if;
  end if;
  if v_new is not null and v_new <> auth.uid() then
    raise exception '担当者を他のメンバーに変更できるのはマネージャー以上です' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['organizations', 'organization_settings', 'profiles', 'customers', 'inquiries', 'deals', 'tasks', 'activities', 'sales'] loop
    execute format('create trigger %1$s_touch before update on public.%1$s for each row execute function app_private.touch_updated_at()', t);
  end loop;
  foreach t in array array['customers', 'inquiries', 'deals', 'tasks'] loop
    execute format('create trigger %1$s_created_by before insert on public.%1$s for each row execute function app_private.set_created_by()', t);
  end loop;
  foreach t in array array['customers', 'inquiries', 'deals'] loop
    execute format('create trigger %1$s_number before insert on public.%1$s for each row execute function app_private.assign_number()', t);
  end loop;
end $$;

create trigger customers_owner before insert or update of owner_id on public.customers
  for each row execute function app_private.enforce_member_owner('owner_id');
create trigger inquiries_owner before insert or update of owner_id on public.inquiries
  for each row execute function app_private.enforce_member_owner('owner_id');
create trigger deals_owner before insert or update of owner_id on public.deals
  for each row execute function app_private.enforce_member_owner('owner_id');

-- ---------------------------------------------------------------
-- 関連の補完：案件・問い合わせから顧客を埋める（タスク・対応履歴）
-- ---------------------------------------------------------------
create or replace function app_private.fill_customer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.customer_id is null and new.deal_id is not null then
    select d.customer_id into new.customer_id from public.deals d where d.organization_id = new.organization_id and d.id = new.deal_id;
  end if;
  if new.customer_id is null and new.inquiry_id is not null then
    select i.customer_id into new.customer_id from public.inquiries i where i.organization_id = new.organization_id and i.id = new.inquiry_id;
  end if;
  return new;
end $$;
create trigger tasks_fill_customer before insert or update of deal_id, inquiry_id, customer_id on public.tasks
  for each row execute function app_private.fill_customer();
create trigger activities_fill_customer before insert or update of deal_id, inquiry_id, customer_id on public.activities
  for each row execute function app_private.fill_customer();

-- 一般担当者の対応履歴は、自分の名前でしか登録できない
create or replace function app_private.activity_user() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    if new.user_id is null then
      new.user_id := auth.uid();
    elsif new.user_id <> auth.uid() and not public.is_org_manager() then
      raise exception '対応履歴の担当者は自分にしてください' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger activities_user before insert or update of user_id on public.activities
  for each row execute function app_private.activity_user();

-- ---------------------------------------------------------------
-- タスク：完了日時
-- ---------------------------------------------------------------
create or replace function app_private.task_completed_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'done' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger tasks_completed_at before insert or update of status, completed_at on public.tasks
  for each row execute function app_private.task_completed_at();

-- ---------------------------------------------------------------
-- 案件：ステータスに合わせた確度・日付
-- ---------------------------------------------------------------
create or replace function app_private.deal_stage_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_stage public.pipeline_stages;
  v_old_cat public.stage_category;
  v_today date := public.org_today(new.organization_id);
begin
  if app_private.bulk_loading() then
    return new;
  end if;
  select * into v_stage from public.pipeline_stages s where s.organization_id = new.organization_id and s.id = new.stage_id;
  if v_stage.id is null then
    raise exception 'ステータスが見つかりません' using errcode = '23503';
  end if;
  if tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    select s.category into v_old_cat from public.pipeline_stages s where s.organization_id = old.organization_id and s.id = old.stage_id;
  end if;

  -- 確度：受注は100%・失注は0%で固定。それ以外は手動で決めていなければステータスの既定値
  if v_stage.category in ('won', 'completed') then
    new.probability := 100;
  elsif v_stage.category = 'lost' then
    new.probability := 0;
  elsif not new.probability_manual and (tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id or old.probability_manual) then
    new.probability := v_stage.default_probability;
  end if;

  -- 受注日・失注日・完了日
  if v_stage.category in ('won', 'completed', 'lost') then
    if tg_op = 'INSERT' or v_old_cat is distinct from v_stage.category and not (v_old_cat in ('won', 'completed') and v_stage.category in ('won', 'completed')) then
      new.closed_on := coalesce(new.closed_on, v_today);
    end if;
  elsif tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    new.closed_on := null;
  end if;
  if v_stage.category = 'completed' then
    new.completed_on := coalesce(new.completed_on, v_today);
  elsif tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    new.completed_on := null;
  end if;
  if v_stage.category <> 'lost' and (tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id) then
    new.lost_reason := null;
  end if;
  -- 受注したら、受注金額が空なら見積金額を入れる
  if v_stage.category in ('won', 'completed') and new.actual_amount is null then
    new.actual_amount := new.estimated_amount;
  end if;
  if v_stage.marks_quote_submitted and new.quote_submitted_on is null then
    new.quote_submitted_on := v_today;
  end if;
  return new;
end $$;
create trigger deals_stage_rules before insert or update of stage_id, probability, probability_manual, actual_amount, estimated_amount, closed_on on public.deals
  for each row execute function app_private.deal_stage_rules();

-- 案件：ステータスの履歴・売上の同期・見積フォローのタスク
create or replace function app_private.deal_after_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_cat public.stage_category;
  v_auto boolean;
  v_days integer;
begin
  if app_private.bulk_loading() then
    return null;
  end if;
  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    insert into public.deal_stage_history (organization_id, deal_id, from_stage_id, to_stage_id, changed_by, changed_at)
    values (new.organization_id, new.id, case when tg_op = 'UPDATE' then old.stage_id end, new.stage_id, auth.uid(), now());
  end if;

  select s.category into v_cat from public.pipeline_stages s where s.organization_id = new.organization_id and s.id = new.stage_id;
  if v_cat in ('won', 'completed') then
    insert into public.sales (organization_id, deal_id, customer_id, owner_id, amount, recognized_on)
    values (new.organization_id, new.id, new.customer_id, new.owner_id, coalesce(new.actual_amount, new.estimated_amount),
            coalesce(new.revenue_on, new.completed_on, new.closed_on, public.org_today(new.organization_id)))
    on conflict (deal_id) do update
      set customer_id = excluded.customer_id, owner_id = excluded.owner_id, amount = excluded.amount, recognized_on = excluded.recognized_on
      where (public.sales.customer_id, public.sales.owner_id, public.sales.amount, public.sales.recognized_on)
            is distinct from (excluded.customer_id, excluded.owner_id, excluded.amount, excluded.recognized_on);
  else
    delete from public.sales where deal_id = new.id;
  end if;

  -- 見積を提出したら「見積フォロー」のタスクを作る（設定でオフにできる）
  if new.quote_submitted_on is not null and (tg_op = 'INSERT' or old.quote_submitted_on is null) and v_cat = 'open'
     and auth.uid() is not null then
    select s.auto_tasks, s.quote_follow_days into v_auto, v_days from public.organization_settings s where s.organization_id = new.organization_id;
    if v_auto then
      insert into public.tasks (organization_id, title, description, assignee_id, customer_id, deal_id, priority, status, due_on, is_auto, created_by)
      values (new.organization_id, '見積フォロー：' || left(new.title, 80),
              '見積提出から' || v_days || '日後のフォローです。検討状況を確認し、次回の予定を対応履歴に残してください。',
              new.owner_id, new.customer_id, new.id, 'high', 'todo', new.quote_submitted_on + v_days, true, auth.uid());
    end if;
  end if;
  return null;
end $$;
create trigger deals_after_change after insert or update on public.deals
  for each row execute function app_private.deal_after_change();

-- 案件を削除したら、元の問い合わせを「対応中」に戻す（案件化の取り消し）
create or replace function app_private.deal_before_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.inquiries
     set status = 'in_progress', converted_deal_id = null, converted_at = null
   where organization_id = old.organization_id and converted_deal_id = old.id;
  return old;
end $$;
create trigger deals_before_delete before delete on public.deals
  for each row execute function app_private.deal_before_delete();

-- ---------------------------------------------------------------
-- 対応履歴 → 顧客・案件・問い合わせへ反映
-- ---------------------------------------------------------------
create or replace function app_private.refresh_contact(p_org uuid, p_customer uuid, p_deal uuid, p_inquiry uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_customer is not null then
    update public.customers c
       set last_contact_at = (select max(a.occurred_at) from public.activities a where a.organization_id = p_org and a.customer_id = p_customer)
     where c.organization_id = p_org and c.id = p_customer
       and c.last_contact_at is distinct from (select max(a.occurred_at) from public.activities a where a.organization_id = p_org and a.customer_id = p_customer);
  end if;
  if p_deal is not null then
    update public.deals d
       set last_contact_at = (select max(a.occurred_at) from public.activities a where a.organization_id = p_org and a.deal_id = p_deal)
     where d.organization_id = p_org and d.id = p_deal
       and d.last_contact_at is distinct from (select max(a.occurred_at) from public.activities a where a.organization_id = p_org and a.deal_id = p_deal);
  end if;
  if p_inquiry is not null then
    update public.inquiries i
       set first_response_at = x.first_at, last_activity_at = x.last_at
      from (select min(a.occurred_at) first_at, max(a.occurred_at) last_at from public.activities a
             where a.organization_id = p_org and a.inquiry_id = p_inquiry) x
     where i.organization_id = p_org and i.id = p_inquiry
       and (i.first_response_at, i.last_activity_at) is distinct from (x.first_at, x.last_at);
  end if;
end $$;

create or replace function app_private.activity_after_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if app_private.bulk_loading() then
    return null;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform app_private.refresh_contact(old.organization_id, old.customer_id, old.deal_id, old.inquiry_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform app_private.refresh_contact(new.organization_id, new.customer_id, new.deal_id, new.inquiry_id);
  end if;
  if tg_op = 'INSERT' then
    -- 対応したので「未対応」を「対応中」に。次回対応日があれば問い合わせ・案件の予定に入れる
    if new.inquiry_id is not null then
      update public.inquiries i
         set status = case when i.status = 'new' then 'in_progress'::public.inquiry_status else i.status end,
             next_action_on = coalesce(new.next_action_on, case when i.next_action_on <= public.org_today(i.organization_id) then null else i.next_action_on end)
       where i.organization_id = new.organization_id and i.id = new.inquiry_id;
    end if;
    if new.deal_id is not null then
      update public.deals d
         set next_follow_up_on = coalesce(new.next_action_on, case when d.next_follow_up_on <= public.org_today(d.organization_id) then null else d.next_follow_up_on end),
             quote_submitted_on = case when new.activity_type = 'quote' then coalesce(d.quote_submitted_on, (new.occurred_at at time zone 'Asia/Tokyo')::date) else d.quote_submitted_on end
       where d.organization_id = new.organization_id and d.id = new.deal_id;
    end if;
  end if;
  return null;
end $$;
create trigger activities_after_change after insert or update or delete on public.activities
  for each row execute function app_private.activity_after_change();

-- ---------------------------------------------------------------
-- 問い合わせの案件化
-- ---------------------------------------------------------------
-- 顧客（未登録なら問い合わせの連絡先から作る）・内容・担当者・対応履歴・タスクを案件へ引き継ぎ、問い合わせを「案件化」にする。
-- 権限：マネージャー以上、またはその問い合わせの担当者（未割当なら誰でも。自分が担当になる）
create or replace function public.convert_inquiry(
  p_inquiry_id uuid, p_title text, p_estimated_amount bigint, p_deal_type text, p_create_task boolean default true
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := public.current_org_id();
  v_uid uuid := auth.uid();
  v_inq public.inquiries;
  v_customer uuid;
  v_stage uuid;
  v_owner uuid;
  v_deal uuid;
  v_today date;
begin
  if v_org is null or v_uid is null then
    raise exception 'ログインしてください' using errcode = '42501';
  end if;
  select * into v_inq from public.inquiries i where i.organization_id = v_org and i.id = p_inquiry_id for update;
  if v_inq.id is null then
    raise exception '問い合わせが見つかりません' using errcode = 'P0002';
  end if;
  if not public.is_org_manager() and v_inq.owner_id is not null and v_inq.owner_id <> v_uid then
    raise exception 'この問い合わせを案件化できるのは担当者かマネージャー以上です' using errcode = '42501';
  end if;
  if v_inq.status = 'converted' then
    raise exception 'この問い合わせは案件化済みです' using errcode = '23514';
  end if;
  if coalesce(trim(p_title), '') = '' or char_length(p_title) > 100 then
    raise exception '案件名を100文字以内で入力してください' using errcode = '22023';
  end if;
  v_today := public.org_today(v_org);
  v_owner := coalesce(v_inq.owner_id, v_uid);

  v_customer := v_inq.customer_id;
  if v_customer is null then
    insert into public.customers (organization_id, number, type, company_name, name, phone, email, owner_id, created_by)
    values (v_org, 0, case when coalesce(v_inq.company_name, '') = '' then 'individual'::public.customer_type else 'corporate' end,
            nullif(v_inq.company_name, ''), coalesce(nullif(v_inq.contact_name, ''), case when coalesce(v_inq.company_name, '') = '' then '（氏名未登録）' end),
            v_inq.phone, v_inq.email, v_owner, v_uid)
    returning id into v_customer;
    update public.inquiries set customer_id = v_customer where id = v_inq.id;
    update public.activities set customer_id = v_customer where organization_id = v_org and inquiry_id = v_inq.id and customer_id is null;
    update public.tasks set customer_id = v_customer where organization_id = v_org and inquiry_id = v_inq.id and customer_id is null;
  end if;

  select s.id into v_stage from public.pipeline_stages s
   where s.organization_id = v_org and s.is_active and s.category = 'open' order by s.sort_order, s.created_at limit 1;
  if v_stage is null then
    raise exception '進行中のステータスがありません。設定で案件ステータスを追加してください' using errcode = '23514';
  end if;

  insert into public.deals (organization_id, number, customer_id, inquiry_id, title, owner_id, deal_type, stage_id,
                            estimated_amount, started_on, next_follow_up_on, memo, created_by)
  values (v_org, 0, v_customer, v_inq.id, trim(p_title), v_owner, nullif(trim(coalesce(p_deal_type, '')), ''), v_stage,
          greatest(coalesce(p_estimated_amount, 0), 0), v_today, v_inq.next_action_on,
          nullif(concat_ws(E'\n\n', '【問い合わせ内容】' || E'\n' || v_inq.content, nullif(v_inq.memo, '')), ''), v_uid)
  returning id into v_deal;

  update public.inquiries
     set status = 'converted', converted_deal_id = v_deal, converted_at = now(), owner_id = v_owner
   where id = v_inq.id;
  -- 問い合わせの対応履歴・タスクを案件にも紐づける
  update public.activities set deal_id = v_deal where organization_id = v_org and inquiry_id = v_inq.id and deal_id is null;
  update public.tasks set deal_id = v_deal where organization_id = v_org and inquiry_id = v_inq.id and deal_id is null;
  perform app_private.refresh_contact(v_org, v_customer, v_deal, null);

  if p_create_task and (select s.auto_tasks from public.organization_settings s where s.organization_id = v_org) then
    insert into public.tasks (organization_id, title, description, assignee_id, customer_id, inquiry_id, deal_id, priority, status, start_on, due_on, is_auto, created_by)
    values (v_org, 'ヒアリングの日程調整：' || left(trim(p_title), 80), '案件化しました。ヒアリングの日程を調整し、要件・予算・時期を確認してください。',
            v_owner, v_customer, v_inq.id, v_deal, 'high', 'todo', v_today, v_today + 2, true, v_uid);
  end if;
  return v_deal;
end $$;
