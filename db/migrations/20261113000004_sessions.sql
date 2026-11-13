-- ログインのセッション・回数制限・デモの片付け・メンバーの追加
--
-- * app_auth.sessions：Cookie にはランダムな値、DB にはその SHA-256 だけを保存する
-- * app_auth.rate_limits：ログインの失敗・デモの作成の回数（総当たり・大量作成の対策）
-- * app_private.demo_cleanup()：期限切れのデモ組織と、その匿名の利用者を消す（毎日の定期処理）
-- * public.admin_add_member()：管理者がメンバーを追加する（パスワードはアプリで scrypt にしてから渡す）

create table app_auth.sessions (
  token_hash text primary key,
  user_id uuid not null references app_auth.users (id) on delete cascade,
  -- 複数の組織に所属しているとき、どの組織として操作するか
  organization_id uuid references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user_idx on app_auth.sessions (user_id);
create index sessions_expires_idx on app_auth.sessions (expires_at);

create table app_auth.rate_limits (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);
create index rate_limits_bucket_idx on app_auth.rate_limits (bucket, created_at);
revoke all on app_auth.sessions, app_auth.rate_limits from public, anon, authenticated;

create or replace function app_private.demo_cleanup() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_users uuid[];
  v_count integer;
begin
  select coalesce(array_agg(distinct m.user_id), '{}') into v_users
    from public.organization_members m join public.organizations o on o.id = m.organization_id
   where o.is_demo and o.demo_expires_at < now();
  delete from public.organizations o where o.is_demo and o.demo_expires_at < now();
  get diagnostics v_count = row_count;
  delete from app_auth.users u where u.id = any(v_users) and u.is_anonymous
    and not exists (select 1 from public.organization_members m where m.user_id = u.id);
  delete from app_auth.sessions where expires_at < now();
  delete from app_auth.rate_limits where created_at < now() - interval '1 day';
  return v_count;
end $$;
revoke all on function app_private.demo_cleanup() from public, anon, authenticated;

create or replace function public.admin_add_member(
  p_email text, p_display_name text, p_title text, p_role public.org_role, p_password_hash text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := public.current_org_id();
  v_id uuid;
begin
  if v_org is null or public.current_org_role() is distinct from 'admin' then
    raise exception 'メンバーを追加できるのは管理者だけです' using errcode = '42501';
  end if;
  if (select o.is_demo from public.organizations o where o.id = v_org) then
    raise exception 'デモ環境ではメンバーを追加できません' using errcode = '42501';
  end if;
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(p_email) > 200 then
    raise exception 'メールアドレスの形式が正しくありません' using errcode = '22023';
  end if;
  if exists (select 1 from app_auth.users u where lower(u.email) = lower(p_email)) then
    raise exception 'このメールアドレスは既に登録されています' using errcode = '23514';
  end if;
  if p_password_hash !~ '^scrypt\$' then
    raise exception 'パスワードの形式が正しくありません' using errcode = '22023';
  end if;
  insert into app_auth.users (email, encrypted_password) values (lower(p_email), p_password_hash) returning id into v_id;
  insert into public.profiles (id, display_name, title) values (v_id, p_display_name, nullif(p_title, ''));
  insert into public.organization_members (organization_id, user_id, role) values (v_org, v_id, p_role);
  return v_id;
end $$;
revoke all on function public.admin_add_member(text, text, text, public.org_role, text) from public, anon;
grant execute on function public.admin_add_member(text, text, text, public.org_role, text) to authenticated;
