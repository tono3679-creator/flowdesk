-- マイグレーションの前に1回だけ適用する土台（何度実行しても同じ結果になる）。
-- 公開環境（Supabase / Neon）・ローカル・CI の PostgreSQL で共通に使う。
--
--   * ログイン中の利用者の権限で SQL を実行するロール（authenticated）と、未ログインのロール（anon）
--   * トランザクションに設定した利用者 ID を読む auth.uid()
--
-- Supabase にはロールと auth.uid() が最初からあるので、無いときだけ作る（同じ名前・同じ動きにしている）。
-- アプリはトランザクションごとにロールを authenticated に切り替え、request.jwt.claims に利用者 ID を入れる（src/lib/db/rls.ts）。
-- ログイン用の利用者・セッションは Supabase Auth と衝突しないよう app_auth スキーマに置く（20261113000004_sessions.sql）。
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
end $$;
-- 接続するユーザー（DB の所有者）が、トランザクションの中で authenticated に切り替えられるようにする
grant anon, authenticated to current_user;
grant usage on schema public to anon, authenticated;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $f$
      create function auth.uid() returns uuid language sql stable as $b$
        select coalesce(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        )::uuid
      $b$
    $f$;
    execute 'grant execute on function auth.uid() to anon, authenticated';
  end if;
end $$;
