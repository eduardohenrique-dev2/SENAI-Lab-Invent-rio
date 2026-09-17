-- ============================================================
-- SENAI LAB INVENTÁRIO — LIMPEZA DE ITENS IMPORTADOS V1.2
-- Execute após 03_importacoes_uploads.sql.
--
-- Segurança:
-- * considera somente itens que nasceram em linhas com ação "novo";
-- * preserva itens cadastrados manualmente;
-- * preserva histórico dos uploads;
-- * não remove item com empréstimo/solicitação pendente;
-- * executa baixa lógica (ativo=false / status=baixado).
-- ============================================================

begin;

create or replace function public.inv_resumo_itens_importados()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_total integer := 0;
    v_bloqueados integer := 0;
begin
    if not private.inv_pode_gerir() then
        raise exception 'Sem permissão para consultar itens importados.';
    end if;

    with importados as (
        select distinct l.item_id
        from public.inv_importacao_linhas l
        join public.inv_itens i on i.id = l.item_id
        where l.acao = 'novo'
          and l.item_id is not null
          and i.ativo = true
    ),
    bloqueados as (
        select distinct e.item_id
        from public.inv_emprestimos e
        join importados x on x.item_id = e.item_id
        where e.status in ('solicitado','aberto','atrasado')
    )
    select
        count(*)::integer,
        count(*) filter (where b.item_id is not null)::integer
    into v_total, v_bloqueados
    from importados x
    left join bloqueados b on b.item_id = x.item_id;

    return jsonb_build_object(
        'total', coalesce(v_total,0),
        'bloqueados', coalesce(v_bloqueados,0),
        'elegiveis', greatest(coalesce(v_total,0) - coalesce(v_bloqueados,0), 0)
    );
end;
$$;

create or replace function public.inv_excluir_todos_itens_importados(
    p_confirmacao text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_item record;
    v_removidos integer := 0;
    v_bloqueados integer := 0;
    v_responsavel text;
begin
    if not private.inv_pode_gerir() then
        raise exception 'Sem permissão para excluir itens importados.';
    end if;

    if coalesce(p_confirmacao,'') <> 'EXCLUIR IMPORTADOS' then
        raise exception 'Confirmação inválida.';
    end if;

    select coalesce(nullif(p.nome,''), nullif(p.email,''), 'Administrador')
      into v_responsavel
      from public.inv_perfis p
     where p.user_id = (select auth.uid())
     limit 1;

    select count(distinct i.id)::integer
      into v_bloqueados
      from public.inv_importacao_linhas l
      join public.inv_itens i
        on i.id = l.item_id
       and i.ativo = true
      join public.inv_emprestimos e
        on e.item_id = i.id
       and e.status in ('solicitado','aberto','atrasado')
     where l.acao = 'novo'
       and l.item_id is not null;

    for v_item in
        select distinct i.id, i.quantidade
        from public.inv_importacao_linhas l
        join public.inv_itens i
          on i.id = l.item_id
         and i.ativo = true
        where l.acao = 'novo'
          and l.item_id is not null
          and not exists (
              select 1
              from public.inv_emprestimos e
              where e.item_id = i.id
                and e.status in ('solicitado','aberto','atrasado')
          )
        order by i.id
    loop
        perform public.inv_registrar_movimentacao(
            v_item.id,
            'baixa',
            greatest(coalesce(v_item.quantidade,1),1),
            null,
            coalesce(v_responsavel,'Administrador'),
            'Limpeza em massa de itens importados',
            'Item criado pelo módulo Uploads / Importar. Removido do inventário ativo por ação administrativa em massa. Histórico preservado.'
        );
        v_removidos := v_removidos + 1;
    end loop;

    return jsonb_build_object(
        'removidos', v_removidos,
        'bloqueados', coalesce(v_bloqueados,0),
        'historico_preservado', true
    );
end;
$$;

revoke execute on function public.inv_resumo_itens_importados() from public, anon;
revoke execute on function public.inv_excluir_todos_itens_importados(text) from public, anon;

grant execute on function public.inv_resumo_itens_importados() to authenticated;
grant execute on function public.inv_excluir_todos_itens_importados(text) to authenticated;

commit;

select
    to_regprocedure('public.inv_resumo_itens_importados()') is not null as resumo_ok,
    to_regprocedure('public.inv_excluir_todos_itens_importados(text)') is not null as limpeza_ok,
    'OK - limpeza segura de itens importados ativada' as resultado;
