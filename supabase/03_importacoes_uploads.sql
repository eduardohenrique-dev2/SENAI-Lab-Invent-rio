-- ============================================================
-- SENAI LAB INVENTÁRIO — UPLOADS / IMPORTAÇÕES V1.1
-- Execute após 01_inventario_schema.sql e 02_seed_inicial.sql.
-- ============================================================

begin;

create table if not exists public.inv_importacoes (
    id uuid primary key default gen_random_uuid(),
    arquivo_nome text not null,
    arquivo_tipo text not null default 'misto'
        check (arquivo_tipo in ('xlsx','xls','csv','pdf','misto')),
    arquivos jsonb not null default '[]'::jsonb,
    status text not null default 'analisando'
        check (status in ('analisando','pronto','importando','concluido','concluido_com_erros','falhou','cancelado')),
    total_linhas integer not null default 0 check (total_linhas >= 0),
    novos integer not null default 0 check (novos >= 0),
    atualizados integer not null default 0 check (atualizados >= 0),
    ignorados integer not null default 0 check (ignorados >= 0),
    erros integer not null default 0 check (erros >= 0),
    resumo jsonb not null default '{}'::jsonb,
    criado_por uuid references auth.users(id) on delete set null,
    criado_em timestamptz not null default now(),
    concluido_em timestamptz
);

create table if not exists public.inv_importacao_linhas (
    id bigint generated always as identity primary key,
    importacao_id uuid not null references public.inv_importacoes(id) on delete cascade,
    numero_linha integer not null check (numero_linha > 0),
    origem text not null default '',
    acao text not null default 'novo'
        check (acao in ('novo','atualizar','ignorar','erro')),
    identificador text,
    dados jsonb not null default '{}'::jsonb,
    mensagem text,
    item_id uuid references public.inv_itens(id) on delete set null,
    criado_em timestamptz not null default now()
);

create index if not exists inv_importacoes_criado_idx
    on public.inv_importacoes (criado_em desc);

create index if not exists inv_importacao_linhas_lote_idx
    on public.inv_importacao_linhas (importacao_id, numero_linha);

alter table public.inv_importacoes enable row level security;
alter table public.inv_importacao_linhas enable row level security;

revoke all on public.inv_importacoes, public.inv_importacao_linhas from anon, authenticated;
grant select, insert, update on public.inv_importacoes to authenticated;
grant select, insert, update on public.inv_importacao_linhas to authenticated;

grant usage, select on sequence public.inv_importacao_linhas_id_seq to authenticated;

-- Reexecução segura.
drop policy if exists "inv importacoes leitura" on public.inv_importacoes;
drop policy if exists "inv importacoes inserir" on public.inv_importacoes;
drop policy if exists "inv importacoes atualizar" on public.inv_importacoes;
drop policy if exists "inv importacao linhas leitura" on public.inv_importacao_linhas;
drop policy if exists "inv importacao linhas inserir" on public.inv_importacao_linhas;
drop policy if exists "inv importacao linhas atualizar" on public.inv_importacao_linhas;

create policy "inv importacoes leitura" on public.inv_importacoes
for select to authenticated
using (private.inv_pode_gerir() or private.inv_pode_auditar());

create policy "inv importacoes inserir" on public.inv_importacoes
for insert to authenticated
with check (private.inv_pode_gerir() and criado_por = (select auth.uid()));

create policy "inv importacoes atualizar" on public.inv_importacoes
for update to authenticated
using (private.inv_pode_gerir())
with check (private.inv_pode_gerir());

create policy "inv importacao linhas leitura" on public.inv_importacao_linhas
for select to authenticated
using (private.inv_pode_gerir() or private.inv_pode_auditar());

create policy "inv importacao linhas inserir" on public.inv_importacao_linhas
for insert to authenticated
with check (private.inv_pode_gerir());

create policy "inv importacao linhas atualizar" on public.inv_importacao_linhas
for update to authenticated
using (private.inv_pode_gerir())
with check (private.inv_pode_gerir());

-- Auditoria dos lotes.
drop trigger if exists trg_inv_importacoes_audit on public.inv_importacoes;
create trigger trg_inv_importacoes_audit
after insert or update or delete on public.inv_importacoes
for each row execute function private.inv_auditar();

-- Realtime para acompanhar o andamento do lote em outras telas.
do $$
begin
    if exists(select 1 from pg_publication where pubname='supabase_realtime')
       and not exists(
            select 1 from pg_publication_tables
            where pubname='supabase_realtime'
              and schemaname='public'
              and tablename='inv_importacoes'
       ) then
        alter publication supabase_realtime add table public.inv_importacoes;
    end if;
end;
$$;

commit;

select
    to_regclass('public.inv_importacoes') is not null as importacoes_ok,
    to_regclass('public.inv_importacao_linhas') is not null as linhas_ok,
    'OK - módulo Uploads / Importações ativado' as resultado;
