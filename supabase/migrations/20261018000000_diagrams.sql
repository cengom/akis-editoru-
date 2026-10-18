-- Akış Editörü: bulut diyagram tablosu ve erişim kuralları.
-- Supabase panelinde SQL Editor'e yapıştırıp çalıştırın (bir kez yeterli; tekrar çalıştırmak da güvenlidir).

create table if not exists public.diagrams (
  id uuid primary key default gen_random_uuid(),
  -- Satırın sahibi. Ekleme sırasında otomatik olarak giriş yapan kullanıcı olur.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  -- Uygulamanın DiagramDocument JSON'u (schemaVersion, viewport, vsmMap, nodes, edges). En fazla 5 MB.
  document_json jsonb not null check (octet_length(document_json::text) <= 5242880),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diagrams_user_updated_idx on public.diagrams (user_id, updated_at desc);

-- updated_at her güncellemede sunucuda yenilenir (istemci saatine güvenilmez).
-- Uygulama bu değeri "başka yerde değişti mi?" kontrolü için kullanır.
create or replace function public.diagrams_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists diagrams_set_updated_at on public.diagrams;
create trigger diagrams_set_updated_at
  before update on public.diagrams
  for each row execute function public.diagrams_set_updated_at();

-- Row Level Security: her kullanıcı yalnızca kendi satırlarını görür ve değiştirir.
-- Misafir (anonim) kullanıcılar da "authenticated" rolündedir; kendi satırlarına erişir.
alter table public.diagrams enable row level security;

drop policy if exists "diagrams_select_own" on public.diagrams;
create policy "diagrams_select_own" on public.diagrams
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "diagrams_insert_own" on public.diagrams;
create policy "diagrams_insert_own" on public.diagrams
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "diagrams_update_own" on public.diagrams;
create policy "diagrams_update_own" on public.diagrams
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "diagrams_delete_own" on public.diagrams;
create policy "diagrams_delete_own" on public.diagrams
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Giriş yapmamış ziyaretçinin ("anon" rolü) tabloya hiç erişimi yok.
revoke all on public.diagrams from anon;
