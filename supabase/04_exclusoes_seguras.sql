-- ============================================================
-- SENAI LAB INVENTÁRIO — EXCLUSÕES SEGURAS V1.1
-- Execute após 03_importacoes_uploads.sql.
-- ============================================================

begin;

create or replace function public.inv_excluir_importacao(p_importacao_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_status text;
begin
    if not private.inv_pode_gerir() then
        raise exception 'Sem permissão para excluir lotes de importação.';
    end if;

    select status
      into v_status
      from public.inv_importacoes
     where id = p_importacao_id
     for update;

    if not found then
        return false;
    end if;

    if v_status in ('analisando','importando') then
        raise exception 'Lote em processamento não pode ser excluído.';
    end if;

    delete from public.inv_importacoes
     where id = p_importacao_id;

    return found;
end;
$$;

revoke execute on function public.inv_excluir_importacao(uuid) from public, anon;
grant execute on function public.inv_excluir_importacao(uuid) to authenticated;

commit;

select
    to_regprocedure('public.inv_excluir_importacao(uuid)') is not null as exclusao_upload_ok,
    'OK - exclusões seguras ativadas' as resultado;
