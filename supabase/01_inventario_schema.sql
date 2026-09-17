-- ============================================================
-- SENAI LAB INVENTÁRIO — SCHEMA V1
-- Execute no MESMO Supabase usado pelo ecossistema SENAI Lab.
-- ============================================================

begin;

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- ------------------------------------------------------------
-- PERFIS / PERMISSÕES
-- ------------------------------------------------------------
create table if not exists public.inv_perfis (
    user_id uuid primary key references auth.users(id) on delete cascade,
    nome text not null,
    email text not null,
    papel text not null default 'aluno'
        check (papel in ('administrador','gestor','instrutor','aluno','auditor')),
    ativo boolean not null default false,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create unique index if not exists inv_perfis_email_idx
    on public.inv_perfis (lower(email));

create or replace function private.inv_criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.inv_perfis (user_id, nome, email, papel, ativo)
    values (
        new.id,
        coalesce(nullif(new.raw_user_meta_data ->> 'nome',''), split_part(coalesce(new.email,'usuario'), '@', 1)),
        coalesce(new.email, new.id::text),
        'aluno',
        false
    )
    on conflict (user_id) do nothing;
    return new;
end;
$$;

revoke execute on function private.inv_criar_perfil() from public, anon, authenticated;

drop trigger if exists senai_lab_inventario_criar_perfil on auth.users;
create trigger senai_lab_inventario_criar_perfil
after insert on auth.users
for each row execute function private.inv_criar_perfil();

insert into public.inv_perfis (user_id, nome, email, papel, ativo)
select
    u.id,
    coalesce(nullif(u.raw_user_meta_data ->> 'nome',''), split_part(coalesce(u.email,'usuario'),'@',1)),
    coalesce(u.email, u.id::text),
    'aluno',
    false
from auth.users u
on conflict (user_id) do nothing;

-- Se o Sistema de Gestão já possui equipe_perfis.nivel, reaproveita os acessos.
do $$
begin
    if to_regclass('public.equipe_perfis') is not null
       and exists (
            select 1 from information_schema.columns
            where table_schema='public' and table_name='equipe_perfis' and column_name='nivel'
       ) then
        execute $sql$
            update public.inv_perfis ip
            set
                nome = coalesce(nullif(ep.nome,''), ip.nome),
                email = coalesce(nullif(ep.email,''), ip.email),
                papel = case ep.nivel
                    when 'proprietario' then 'administrador'
                    when 'administracao' then 'gestor'
                    when 'equipe' then 'instrutor'
                    else ip.papel
                end,
                ativo = case
                    when ep.ativo = true and ep.nivel in ('proprietario','administracao','equipe') then true
                    else ip.ativo
                end,
                atualizado_em = now()
            from public.equipe_perfis ep
            where ep.user_id = ip.user_id
        $sql$;
    end if;
end;
$$;

create or replace function private.inv_papel()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select p.papel
    from public.inv_perfis p
    where p.user_id = (select auth.uid())
      and p.ativo = true
    limit 1;
$$;

create or replace function private.inv_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.inv_perfis p
        where p.user_id = (select auth.uid())
          and p.ativo = true
    );
$$;

create or replace function private.inv_pode_gerir()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(private.inv_papel() in ('administrador','gestor'), false);
$$;

create or replace function private.inv_pode_operar()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(private.inv_papel() in ('administrador','gestor','instrutor'), false);
$$;

create or replace function private.inv_pode_auditar()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(private.inv_papel() in ('administrador','gestor','auditor'), false);
$$;

revoke execute on function private.inv_papel() from public, anon;
revoke execute on function private.inv_ativo() from public, anon;
revoke execute on function private.inv_pode_gerir() from public, anon;
revoke execute on function private.inv_pode_operar() from public, anon;
revoke execute on function private.inv_pode_auditar() from public, anon;
grant execute on function private.inv_papel() to authenticated;
grant execute on function private.inv_ativo() to authenticated;
grant execute on function private.inv_pode_gerir() to authenticated;
grant execute on function private.inv_pode_operar() to authenticated;
grant execute on function private.inv_pode_auditar() to authenticated;

-- ------------------------------------------------------------
-- CADASTROS BASE
-- ------------------------------------------------------------
create table if not exists public.inv_categorias (
    id uuid primary key default gen_random_uuid(),
    parent_id uuid references public.inv_categorias(id) on delete set null,
    nome text not null,
    tipo text not null check (tipo in ('equipamento','material','componente','consumivel')),
    descricao text not null default '',
    ativo boolean not null default true,
    criado_em timestamptz not null default now()
);

create unique index if not exists inv_categorias_nome_tipo_idx
    on public.inv_categorias (lower(nome), tipo) where ativo = true;

create table if not exists public.inv_localizacoes (
    id uuid primary key default gen_random_uuid(),
    parent_id uuid references public.inv_localizacoes(id) on delete set null,
    nome text not null,
    codigo text,
    tipo text not null default 'local'
        check (tipo in ('unidade','laboratorio','sala','almoxarifado','armario','prateleira','local')),
    descricao text not null default '',
    ativo boolean not null default true,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create unique index if not exists inv_localizacoes_codigo_idx
    on public.inv_localizacoes (lower(codigo)) where codigo is not null and ativo = true;

create table if not exists public.inv_itens (
    id uuid primary key default gen_random_uuid(),
    codigo_interno text not null unique,
    patrimonio text unique,
    nome text not null,
    categoria_id uuid references public.inv_categorias(id) on delete set null,
    subcategoria text,
    tipo_item text not null default 'equipamento'
        check (tipo_item in ('equipamento','material','componente','consumivel')),
    marca text,
    modelo text,
    numero_serie text,
    codigo_barras text unique,
    qr_token uuid not null default gen_random_uuid() unique,
    foto_url text,
    descricao text not null default '',
    especificacoes text not null default '',
    voltagem text,
    potencia text,
    capacidade text,
    fabricante text,
    manual_url text,
    quantidade numeric(14,3) not null default 1 check (quantidade >= 0),
    unidade text not null default 'un',
    estoque_minimo numeric(14,3) not null default 0 check (estoque_minimo >= 0),
    localizacao_id uuid references public.inv_localizacoes(id) on delete set null,
    armario text,
    prateleira text,
    responsavel text,
    status text not null default 'disponivel'
        check (status in ('disponivel','em_uso','emprestado','manutencao','danificado','reservado','baixado','perdido')),
    data_aquisicao date,
    valor_unitario numeric(14,2) check (valor_unitario is null or valor_unitario >= 0),
    garantia_ate date,
    nota_fiscal_url text,
    observacoes text not null default '',
    ativo boolean not null default true,
    criado_por uuid references auth.users(id) on delete set null,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create index if not exists inv_itens_nome_idx on public.inv_itens (lower(nome));
create index if not exists inv_itens_status_idx on public.inv_itens (status);
create index if not exists inv_itens_categoria_idx on public.inv_itens (categoria_id);
create index if not exists inv_itens_localizacao_idx on public.inv_itens (localizacao_id);
create index if not exists inv_itens_qr_idx on public.inv_itens (qr_token);

-- ------------------------------------------------------------
-- MOVIMENTAÇÕES
-- ------------------------------------------------------------
create table if not exists public.inv_movimentacoes (
    id bigint generated always as identity primary key,
    item_id uuid not null references public.inv_itens(id) on delete cascade,
    tipo text not null
        check (tipo in ('entrada','saida','transferencia','emprestimo','devolucao','manutencao','baixa','ajuste')),
    quantidade numeric(14,3) not null default 1 check (quantidade > 0),
    localizacao_origem_id uuid references public.inv_localizacoes(id) on delete set null,
    localizacao_destino_id uuid references public.inv_localizacoes(id) on delete set null,
    responsavel text,
    motivo text not null default '',
    observacoes text not null default '',
    realizado_por uuid references auth.users(id) on delete set null,
    criado_em timestamptz not null default now()
);

create index if not exists inv_movimentacoes_item_idx on public.inv_movimentacoes (item_id, criado_em desc);

-- ------------------------------------------------------------
-- EMPRÉSTIMOS
-- ------------------------------------------------------------
create table if not exists public.inv_emprestimos (
    id uuid primary key default gen_random_uuid(),
    item_id uuid not null references public.inv_itens(id) on delete restrict,
    quantidade numeric(14,3) not null default 1 check (quantidade > 0),
    retirado_por_nome text not null,
    retirado_por_email text,
    data_retirada timestamptz,
    previsao_devolucao timestamptz not null,
    data_devolucao timestamptz,
    autorizado_por uuid references auth.users(id) on delete set null,
    solicitado_por uuid references auth.users(id) on delete set null,
    estado_retirada text not null default '',
    estado_devolucao text,
    observacoes text not null default '',
    assinatura_confirmada boolean not null default false,
    status text not null default 'solicitado'
        check (status in ('solicitado','aberto','devolvido','atrasado','perdido','cancelado')),
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create index if not exists inv_emprestimos_item_idx on public.inv_emprestimos (item_id);
create index if not exists inv_emprestimos_status_idx on public.inv_emprestimos (status, previsao_devolucao);

-- ------------------------------------------------------------
-- MANUTENÇÃO
-- ------------------------------------------------------------
create table if not exists public.inv_manutencoes (
    id uuid primary key default gen_random_uuid(),
    item_id uuid not null references public.inv_itens(id) on delete restrict,
    problema text not null,
    identificado_em timestamptz not null default now(),
    tipo text not null default 'corretiva'
        check (tipo in ('preventiva','corretiva','calibracao','inspecao','outro')),
    tecnico_responsavel text,
    pecas_utilizadas text not null default '',
    custo numeric(14,2) check (custo is null or custo >= 0),
    data_envio date,
    previsao date,
    data_conclusao date,
    diagnostico text not null default '',
    solucao text not null default '',
    fotos jsonb not null default '[]'::jsonb,
    status text not null default 'aberta'
        check (status in ('aberta','em_andamento','aguardando_peca','concluida','cancelada')),
    criado_por uuid references auth.users(id) on delete set null,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create index if not exists inv_manutencoes_item_idx on public.inv_manutencoes (item_id, criado_em desc);
create index if not exists inv_manutencoes_status_idx on public.inv_manutencoes (status);

-- ------------------------------------------------------------
-- INVENTÁRIO FÍSICO
-- ------------------------------------------------------------
create table if not exists public.inv_inventarios_fisicos (
    id uuid primary key default gen_random_uuid(),
    titulo text not null,
    responsavel text not null,
    status text not null default 'aberto'
        check (status in ('aberto','em_contagem','concluido','cancelado')),
    iniciado_em timestamptz not null default now(),
    concluido_em timestamptz,
    observacoes text not null default '',
    criado_por uuid references auth.users(id) on delete set null,
    criado_em timestamptz not null default now()
);

create table if not exists public.inv_contagens (
    id bigint generated always as identity primary key,
    inventario_id uuid not null references public.inv_inventarios_fisicos(id) on delete cascade,
    item_id uuid not null references public.inv_itens(id) on delete restrict,
    resultado text not null default 'pendente'
        check (resultado in ('pendente','encontrado','nao_encontrado','danificado')),
    quantidade_encontrada numeric(14,3),
    localizacao_confirmada_id uuid references public.inv_localizacoes(id) on delete set null,
    observacoes text not null default '',
    conferido_por uuid references auth.users(id) on delete set null,
    conferido_em timestamptz,
    unique (inventario_id, item_id)
);

create index if not exists inv_contagens_inventario_idx on public.inv_contagens (inventario_id, resultado);

-- ------------------------------------------------------------
-- NOTIFICAÇÕES / CONFIGURAÇÕES / AUDITORIA
-- ------------------------------------------------------------
create table if not exists public.inv_notificacoes (
    id bigint generated always as identity primary key,
    user_id uuid references auth.users(id) on delete cascade,
    severidade text not null default 'info'
        check (severidade in ('info','warning','danger','success')),
    titulo text not null,
    mensagem text not null,
    entidade text,
    entidade_id text,
    lida_em timestamptz,
    criado_em timestamptz not null default now()
);

create table if not exists public.inv_configuracoes (
    chave text primary key,
    valor jsonb not null default '{}'::jsonb,
    atualizado_por uuid references auth.users(id) on delete set null,
    atualizado_em timestamptz not null default now()
);

create table if not exists public.inv_auditoria (
    id bigint generated always as identity primary key,
    user_id uuid references auth.users(id) on delete set null,
    acao text not null,
    entidade text not null,
    entidade_id text,
    dados jsonb not null default '{}'::jsonb,
    criado_em timestamptz not null default now()
);

create index if not exists inv_auditoria_entidade_idx on public.inv_auditoria (entidade, entidade_id, criado_em desc);
create index if not exists inv_notificacoes_user_idx on public.inv_notificacoes (user_id, lida_em, criado_em desc);

-- ------------------------------------------------------------
-- UTILITÁRIOS DE DATA / AUDITORIA
-- ------------------------------------------------------------
create or replace function private.inv_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.atualizado_em := now();
    return new;
end;
$$;

create or replace function private.inv_auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id text;
    v_dados jsonb;
begin
    v_id := coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', null);
    v_dados := jsonb_build_object(
        'operacao', tg_op,
        'antes', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
        'depois', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    );

    insert into public.inv_auditoria (user_id, acao, entidade, entidade_id, dados)
    values ((select auth.uid()), lower(tg_op), tg_table_name, v_id, v_dados);

    return coalesce(new, old);
end;
$$;

revoke execute on function private.inv_touch_updated_at() from public, anon, authenticated;
revoke execute on function private.inv_auditar() from public, anon, authenticated;

-- updated_at
foreach_tbl:
do $$
declare
    t text;
begin
    foreach t in array array['inv_perfis','inv_localizacoes','inv_itens','inv_emprestimos','inv_manutencoes']
    loop
        execute format('drop trigger if exists %I on public.%I', 'trg_'||t||'_touch', t);
        execute format('create trigger %I before update on public.%I for each row execute function private.inv_touch_updated_at()', 'trg_'||t||'_touch', t);
    end loop;
end;
$$;

-- auditoria
do $$
declare
    t text;
begin
    foreach t in array array['inv_itens','inv_localizacoes','inv_movimentacoes','inv_emprestimos','inv_manutencoes','inv_inventarios_fisicos','inv_contagens','inv_perfis']
    loop
        execute format('drop trigger if exists %I on public.%I', 'trg_'||t||'_audit', t);
        execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.inv_auditar()', 'trg_'||t||'_audit', t);
    end loop;
end;
$$;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.inv_perfis enable row level security;
alter table public.inv_categorias enable row level security;
alter table public.inv_localizacoes enable row level security;
alter table public.inv_itens enable row level security;
alter table public.inv_movimentacoes enable row level security;
alter table public.inv_emprestimos enable row level security;
alter table public.inv_manutencoes enable row level security;
alter table public.inv_inventarios_fisicos enable row level security;
alter table public.inv_contagens enable row level security;
alter table public.inv_notificacoes enable row level security;
alter table public.inv_configuracoes enable row level security;
alter table public.inv_auditoria enable row level security;

revoke all on table public.inv_perfis from anon, authenticated;
revoke all on table public.inv_categorias from anon, authenticated;
revoke all on table public.inv_localizacoes from anon, authenticated;
revoke all on table public.inv_itens from anon, authenticated;
revoke all on table public.inv_movimentacoes from anon, authenticated;
revoke all on table public.inv_emprestimos from anon, authenticated;
revoke all on table public.inv_manutencoes from anon, authenticated;
revoke all on table public.inv_inventarios_fisicos from anon, authenticated;
revoke all on table public.inv_contagens from anon, authenticated;
revoke all on table public.inv_notificacoes from anon, authenticated;
revoke all on table public.inv_configuracoes from anon, authenticated;
revoke all on table public.inv_auditoria from anon, authenticated;

grant select on table public.inv_perfis to authenticated;
grant select on table public.inv_categorias to authenticated;
grant select on table public.inv_localizacoes to authenticated;
grant select on table public.inv_itens to authenticated;
grant select on table public.inv_movimentacoes to authenticated;
grant select on table public.inv_emprestimos to authenticated;
grant select on table public.inv_manutencoes to authenticated;
grant select on table public.inv_inventarios_fisicos to authenticated;
grant select on table public.inv_contagens to authenticated;
grant select on table public.inv_notificacoes to authenticated;
grant select on table public.inv_configuracoes to authenticated;
grant select on table public.inv_auditoria to authenticated;

grant insert, update, delete on table public.inv_categorias to authenticated;
grant insert, update, delete on table public.inv_localizacoes to authenticated;
grant insert, update on table public.inv_itens to authenticated;
grant insert on table public.inv_movimentacoes to authenticated;
grant insert, update on table public.inv_emprestimos to authenticated;
grant insert, update on table public.inv_manutencoes to authenticated;
grant insert, update on table public.inv_inventarios_fisicos to authenticated;
grant insert, update on table public.inv_contagens to authenticated;
grant update on table public.inv_notificacoes to authenticated;
grant insert, update on table public.inv_configuracoes to authenticated;
grant update on table public.inv_perfis to authenticated;

-- leitura geral para perfil ativo
create policy "inv perfis leitura" on public.inv_perfis
for select to authenticated
using (private.inv_ativo());

create policy "inv categorias leitura" on public.inv_categorias
for select to authenticated using (private.inv_ativo());
create policy "inv localizacoes leitura" on public.inv_localizacoes
for select to authenticated using (private.inv_ativo());
create policy "inv itens leitura" on public.inv_itens
for select to authenticated using (private.inv_ativo());
create policy "inv movimentacoes leitura" on public.inv_movimentacoes
for select to authenticated using (private.inv_ativo());
create policy "inv emprestimos leitura" on public.inv_emprestimos
for select to authenticated using (private.inv_ativo());
create policy "inv manutencoes leitura" on public.inv_manutencoes
for select to authenticated using (private.inv_ativo());
create policy "inv fisicos leitura" on public.inv_inventarios_fisicos
for select to authenticated using (private.inv_ativo());
create policy "inv contagens leitura" on public.inv_contagens
for select to authenticated using (private.inv_ativo());
create policy "inv configuracoes leitura" on public.inv_configuracoes
for select to authenticated using (private.inv_ativo());
create policy "inv auditoria leitura" on public.inv_auditoria
for select to authenticated using (private.inv_pode_auditar());

-- escrita gerencial
create policy "inv categorias escrita" on public.inv_categorias
for all to authenticated using (private.inv_pode_gerir()) with check (private.inv_pode_gerir());
create policy "inv localizacoes escrita" on public.inv_localizacoes
for all to authenticated using (private.inv_pode_gerir()) with check (private.inv_pode_gerir());
create policy "inv itens inserir" on public.inv_itens
for insert to authenticated with check (private.inv_pode_gerir());
create policy "inv itens atualizar" on public.inv_itens
for update to authenticated using (private.inv_pode_gerir()) with check (private.inv_pode_gerir());
create policy "inv movimentacoes inserir" on public.inv_movimentacoes
for insert to authenticated with check (private.inv_pode_operar());
create policy "inv emprestimos inserir" on public.inv_emprestimos
for insert to authenticated with check (private.inv_ativo());
create policy "inv emprestimos atualizar" on public.inv_emprestimos
for update to authenticated using (private.inv_pode_operar()) with check (private.inv_pode_operar());
create policy "inv manutencoes inserir" on public.inv_manutencoes
for insert to authenticated with check (private.inv_pode_operar());
create policy "inv manutencoes atualizar" on public.inv_manutencoes
for update to authenticated using (private.inv_pode_operar()) with check (private.inv_pode_operar());
create policy "inv fisicos inserir" on public.inv_inventarios_fisicos
for insert to authenticated with check (private.inv_pode_auditar());
create policy "inv fisicos atualizar" on public.inv_inventarios_fisicos
for update to authenticated using (private.inv_pode_auditar()) with check (private.inv_pode_auditar());
create policy "inv contagens inserir" on public.inv_contagens
for insert to authenticated with check (private.inv_pode_auditar());
create policy "inv contagens atualizar" on public.inv_contagens
for update to authenticated using (private.inv_pode_auditar()) with check (private.inv_pode_auditar());
create policy "inv configuracoes escrita" on public.inv_configuracoes
for all to authenticated using (private.inv_pode_gerir()) with check (private.inv_pode_gerir());

-- notificações: usuário vê as próprias; gestores veem todas
create policy "inv notificacoes leitura" on public.inv_notificacoes
for select to authenticated
using (private.inv_pode_gerir() or user_id = (select auth.uid()));
create policy "inv notificacoes atualizar" on public.inv_notificacoes
for update to authenticated
using (private.inv_pode_gerir() or user_id = (select auth.uid()))
with check (private.inv_pode_gerir() or user_id = (select auth.uid()));

-- somente administrador altera perfis
create policy "inv perfis atualizar admin" on public.inv_perfis
for update to authenticated
using (private.inv_papel() = 'administrador')
with check (private.inv_papel() = 'administrador');

-- ------------------------------------------------------------
-- RPC: ITEM PÚBLICO VIA QR (DADOS SANITIZADOS)
-- ------------------------------------------------------------
create or replace function public.inv_item_publico(p_token uuid)
returns table (
    id uuid,
    codigo_interno text,
    patrimonio text,
    nome text,
    tipo_item text,
    marca text,
    modelo text,
    status text,
    localizacao text,
    foto_url text,
    descricao text
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        i.id,
        i.codigo_interno,
        i.patrimonio,
        i.nome,
        i.tipo_item,
        i.marca,
        i.modelo,
        i.status,
        l.nome,
        i.foto_url,
        i.descricao
    from public.inv_itens i
    left join public.inv_localizacoes l on l.id = i.localizacao_id
    where i.qr_token = p_token
      and i.ativo = true
    limit 1;
$$;

revoke execute on function public.inv_item_publico(uuid) from public;
grant execute on function public.inv_item_publico(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- RPC: DASHBOARD
-- ------------------------------------------------------------
create or replace function public.inv_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not private.inv_ativo() then
        raise exception 'Acesso não autorizado.';
    end if;

    return jsonb_build_object(
        'total_itens', (select count(*) from public.inv_itens where ativo = true),
        'disponiveis', (select count(*) from public.inv_itens where ativo = true and status = 'disponivel'),
        'em_uso', (select count(*) from public.inv_itens where ativo = true and status = 'em_uso'),
        'emprestados', (select count(*) from public.inv_itens where ativo = true and status = 'emprestado'),
        'manutencao', (select count(*) from public.inv_itens where ativo = true and status = 'manutencao'),
        'danificados', (select count(*) from public.inv_itens where ativo = true and status = 'danificado'),
        'estoque_baixo', (select count(*) from public.inv_itens where ativo = true and estoque_minimo > 0 and quantidade <= estoque_minimo),
        'sem_localizacao', (select count(*) from public.inv_itens where ativo = true and localizacao_id is null),
        'valor_patrimonio', (select coalesce(sum(quantidade * coalesce(valor_unitario,0)),0) from public.inv_itens where ativo = true),
        'emprestimos_atrasados', (select count(*) from public.inv_emprestimos where status in ('aberto','atrasado') and previsao_devolucao < now())
    );
end;
$$;

revoke execute on function public.inv_dashboard() from public, anon;
grant execute on function public.inv_dashboard() to authenticated;

-- ------------------------------------------------------------
-- RPC: REGISTRAR MOVIMENTAÇÃO E AJUSTAR ITEM
-- ------------------------------------------------------------
create or replace function public.inv_registrar_movimentacao(
    p_item_id uuid,
    p_tipo text,
    p_quantidade numeric,
    p_destino uuid default null,
    p_responsavel text default null,
    p_motivo text default '',
    p_observacoes text default ''
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_item public.inv_itens%rowtype;
    v_id bigint;
    v_qtd numeric := coalesce(p_quantidade,0);
begin
    if not private.inv_pode_operar() then
        raise exception 'Sem permissão para movimentar itens.';
    end if;

    if p_tipo not in ('entrada','saida','transferencia','emprestimo','devolucao','manutencao','baixa','ajuste') then
        raise exception 'Tipo de movimentação inválido.';
    end if;

    select * into v_item from public.inv_itens where id = p_item_id and ativo = true for update;
    if not found then raise exception 'Item não encontrado.'; end if;

    if p_tipo <> 'transferencia' and v_qtd <= 0 then
        raise exception 'Quantidade inválida.';
    end if;

    if p_tipo = 'entrada' then
        update public.inv_itens set quantidade = quantidade + v_qtd where id = p_item_id;
    elsif p_tipo = 'saida' then
        if v_item.quantidade < v_qtd then raise exception 'Estoque insuficiente.'; end if;
        update public.inv_itens set quantidade = quantidade - v_qtd where id = p_item_id;
    elsif p_tipo = 'ajuste' then
        update public.inv_itens set quantidade = v_qtd where id = p_item_id;
    elsif p_tipo = 'transferencia' then
        if p_destino is null then raise exception 'Informe a localização de destino.'; end if;
        update public.inv_itens set localizacao_id = p_destino where id = p_item_id;
    elsif p_tipo = 'manutencao' then
        update public.inv_itens set status = 'manutencao' where id = p_item_id;
    elsif p_tipo = 'baixa' then
        update public.inv_itens set status = 'baixado', ativo = false where id = p_item_id;
    end if;

    insert into public.inv_movimentacoes (
        item_id, tipo, quantidade, localizacao_origem_id, localizacao_destino_id,
        responsavel, motivo, observacoes, realizado_por
    ) values (
        p_item_id, p_tipo, greatest(v_qtd,1), v_item.localizacao_id, p_destino,
        nullif(trim(coalesce(p_responsavel,'')),''), trim(coalesce(p_motivo,'')),
        trim(coalesce(p_observacoes,'')), (select auth.uid())
    ) returning id into v_id;

    return v_id;
end;
$$;

revoke execute on function public.inv_registrar_movimentacao(uuid,text,numeric,uuid,text,text,text) from public, anon;
grant execute on function public.inv_registrar_movimentacao(uuid,text,numeric,uuid,text,text,text) to authenticated;

-- ------------------------------------------------------------
-- RPC: EMPRÉSTIMO / DEVOLUÇÃO / APROVAÇÃO
-- ------------------------------------------------------------
create or replace function public.inv_solicitar_emprestimo(
    p_item_id uuid,
    p_quantidade numeric,
    p_nome text,
    p_email text,
    p_previsao timestamptz,
    p_estado text default '',
    p_observacoes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_item public.inv_itens%rowtype;
    v_id uuid := gen_random_uuid();
    v_papel text;
    v_status text;
begin
    if not private.inv_ativo() then raise exception 'Acesso não autorizado.'; end if;
    if coalesce(p_quantidade,0) <= 0 then raise exception 'Quantidade inválida.'; end if;
    if p_previsao is null or p_previsao <= now() then raise exception 'Previsão de devolução inválida.'; end if;

    select * into v_item from public.inv_itens where id = p_item_id and ativo = true for update;
    if not found then raise exception 'Item não encontrado.'; end if;
    if v_item.quantidade < p_quantidade then raise exception 'Quantidade indisponível.'; end if;

    v_papel := private.inv_papel();
    v_status := case when v_papel in ('administrador','gestor','instrutor') then 'aberto' else 'solicitado' end;

    insert into public.inv_emprestimos (
        id,item_id,quantidade,retirado_por_nome,retirado_por_email,
        data_retirada,previsao_devolucao,autorizado_por,solicitado_por,
        estado_retirada,observacoes,assinatura_confirmada,status
    ) values (
        v_id,p_item_id,p_quantidade,trim(p_nome),nullif(lower(trim(coalesce(p_email,''))),''),
        case when v_status='aberto' then now() else null end,p_previsao,
        case when v_status='aberto' then (select auth.uid()) else null end,(select auth.uid()),
        trim(coalesce(p_estado,'')),trim(coalesce(p_observacoes,'')),v_status='aberto',v_status
    );

    if v_status='aberto' then
        update public.inv_itens
        set quantidade = quantidade - p_quantidade,
            status = case when quantidade - p_quantidade <= 0 then 'emprestado' else status end
        where id = p_item_id;

        insert into public.inv_movimentacoes (item_id,tipo,quantidade,responsavel,motivo,realizado_por)
        values (p_item_id,'emprestimo',p_quantidade,trim(p_nome),'Empréstimo registrado',(select auth.uid()));
    end if;

    return v_id;
end;
$$;

revoke execute on function public.inv_solicitar_emprestimo(uuid,numeric,text,text,timestamptz,text,text) from public, anon;
grant execute on function public.inv_solicitar_emprestimo(uuid,numeric,text,text,timestamptz,text,text) to authenticated;

create or replace function public.inv_aprovar_emprestimo(p_emprestimo_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v public.inv_emprestimos%rowtype;
    i public.inv_itens%rowtype;
begin
    if not private.inv_pode_operar() then raise exception 'Sem permissão.'; end if;
    select * into v from public.inv_emprestimos where id=p_emprestimo_id for update;
    if not found or v.status <> 'solicitado' then raise exception 'Solicitação inválida.'; end if;
    select * into i from public.inv_itens where id=v.item_id for update;
    if i.quantidade < v.quantidade then raise exception 'Quantidade indisponível.'; end if;

    update public.inv_emprestimos
    set status='aberto',data_retirada=now(),autorizado_por=(select auth.uid()),assinatura_confirmada=true
    where id=p_emprestimo_id;

    update public.inv_itens
    set quantidade=quantidade-v.quantidade,
        status=case when quantidade-v.quantidade <= 0 then 'emprestado' else status end
    where id=v.item_id;

    insert into public.inv_movimentacoes (item_id,tipo,quantidade,responsavel,motivo,realizado_por)
    values (v.item_id,'emprestimo',v.quantidade,v.retirado_por_nome,'Empréstimo aprovado',(select auth.uid()));
    return true;
end;
$$;

revoke execute on function public.inv_aprovar_emprestimo(uuid) from public, anon;
grant execute on function public.inv_aprovar_emprestimo(uuid) to authenticated;

create or replace function public.inv_devolver_emprestimo(
    p_emprestimo_id uuid,
    p_estado text default '',
    p_observacoes text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v public.inv_emprestimos%rowtype;
begin
    if not private.inv_pode_operar() then raise exception 'Sem permissão.'; end if;
    select * into v from public.inv_emprestimos where id=p_emprestimo_id for update;
    if not found or v.status not in ('aberto','atrasado') then raise exception 'Empréstimo não está em aberto.'; end if;

    update public.inv_emprestimos
    set status='devolvido',data_devolucao=now(),estado_devolucao=trim(coalesce(p_estado,'')),
        observacoes=concat_ws(E'\n',nullif(observacoes,''),nullif(trim(coalesce(p_observacoes,'')),''))
    where id=p_emprestimo_id;

    update public.inv_itens
    set quantidade=quantidade+v.quantidade,
        status=case when status='emprestado' then 'disponivel' else status end
    where id=v.item_id;

    insert into public.inv_movimentacoes (item_id,tipo,quantidade,responsavel,motivo,realizado_por)
    values (v.item_id,'devolucao',v.quantidade,v.retirado_por_nome,'Devolução registrada',(select auth.uid()));
    return true;
end;
$$;

revoke execute on function public.inv_devolver_emprestimo(uuid,text,text) from public, anon;
grant execute on function public.inv_devolver_emprestimo(uuid,text,text) to authenticated;

-- ------------------------------------------------------------
-- RPC: INVENTÁRIO FÍSICO
-- ------------------------------------------------------------
create or replace function public.inv_criar_inventario_fisico(
    p_titulo text,
    p_responsavel text,
    p_observacoes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id uuid := gen_random_uuid();
begin
    if not private.inv_pode_auditar() then raise exception 'Sem permissão para inventário físico.'; end if;

    insert into public.inv_inventarios_fisicos (id,titulo,responsavel,status,observacoes,criado_por)
    values (v_id,trim(p_titulo),trim(p_responsavel),'em_contagem',trim(coalesce(p_observacoes,'')),(select auth.uid()));

    insert into public.inv_contagens (inventario_id,item_id,resultado)
    select v_id,id,'pendente' from public.inv_itens where ativo=true;

    return v_id;
end;
$$;

revoke execute on function public.inv_criar_inventario_fisico(text,text,text) from public, anon;
grant execute on function public.inv_criar_inventario_fisico(text,text,text) to authenticated;

create or replace function public.inv_concluir_inventario_fisico(p_inventario_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not private.inv_pode_auditar() then raise exception 'Sem permissão.'; end if;
    update public.inv_inventarios_fisicos
    set status='concluido',concluido_em=now()
    where id=p_inventario_id and status='em_contagem';
    return found;
end;
$$;

revoke execute on function public.inv_concluir_inventario_fisico(uuid) from public, anon;
grant execute on function public.inv_concluir_inventario_fisico(uuid) to authenticated;

-- ------------------------------------------------------------
-- STORAGE
-- ------------------------------------------------------------
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
    'inventario-publico','inventario-publico',true,20971520,
    array['image/png','image/jpeg','image/webp','application/pdf']
)
on conflict (id) do update set public=true, file_size_limit=20971520;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
    'inventario-privado','inventario-privado',false,20971520,
    array['image/png','image/jpeg','image/webp','application/pdf']
)
on conflict (id) do update set public=false, file_size_limit=20971520;

-- Leitura pública apenas do bucket de fotos/manuais públicos.
drop policy if exists "inventario publico leitura" on storage.objects;
create policy "inventario publico leitura"
on storage.objects for select to public
using (bucket_id='inventario-publico');

-- Usuários ativos podem inserir arquivos.
drop policy if exists "inventario arquivos inserir" on storage.objects;
create policy "inventario arquivos inserir"
on storage.objects for insert to authenticated
with check (bucket_id in ('inventario-publico','inventario-privado') and private.inv_ativo());

drop policy if exists "inventario arquivos privados ler" on storage.objects;
create policy "inventario arquivos privados ler"
on storage.objects for select to authenticated
using (bucket_id='inventario-privado' and private.inv_ativo());

drop policy if exists "inventario arquivos atualizar" on storage.objects;
create policy "inventario arquivos atualizar"
on storage.objects for update to authenticated
using (bucket_id in ('inventario-publico','inventario-privado') and private.inv_pode_gerir())
with check (bucket_id in ('inventario-publico','inventario-privado') and private.inv_pode_gerir());

drop policy if exists "inventario arquivos apagar" on storage.objects;
create policy "inventario arquivos apagar"
on storage.objects for delete to authenticated
using (bucket_id in ('inventario-publico','inventario-privado') and private.inv_pode_gerir());

-- ------------------------------------------------------------
-- REALTIME
-- ------------------------------------------------------------
do $$
declare
    t text;
begin
    if exists (select 1 from pg_publication where pubname='supabase_realtime') then
        foreach t in array array['inv_itens','inv_movimentacoes','inv_emprestimos','inv_manutencoes','inv_notificacoes']
        loop
            if not exists (
                select 1 from pg_publication_tables
                where pubname='supabase_realtime' and schemaname='public' and tablename=t
            ) then
                execute format('alter publication supabase_realtime add table public.%I', t);
            end if;
        end loop;
    end if;
end;
$$;

commit;

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
select
    (select count(*) from public.inv_perfis) as perfis,
    to_regclass('public.inv_itens') is not null as itens_ok,
    to_regclass('public.inv_emprestimos') is not null as emprestimos_ok,
    to_regclass('public.inv_manutencoes') is not null as manutencoes_ok,
    'OK - SENAI Lab Inventário V1 criado' as resultado;
