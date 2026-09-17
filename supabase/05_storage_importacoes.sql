-- ============================================================
-- SENAI LAB INVENTÁRIO — STORAGE PARA IMPORTAÇÕES V1.2
-- Execute em bancos já existentes.
-- Libera XLSX, XLS, CSV e PDF no bucket privado dos uploads.
-- ============================================================

begin;

do $$
begin
    if not exists (
        select 1 from storage.buckets where id = 'inventario-privado'
    ) then
        raise exception 'Bucket inventario-privado não encontrado. Execute primeiro 01_inventario_schema.sql.';
    end if;
end;
$$;

update storage.buckets
set
    public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array[
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/pdf',
        'text/csv',
        'application/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream'
    ]
where id = 'inventario-privado';

commit;

select
    id,
    public,
    file_size_limit,
    allowed_mime_types,
    case
        when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
             = any(allowed_mime_types)
        then 'OK - XLSX liberado para importação'
        else 'ATENÇÃO - MIME XLSX não foi liberado'
    end as resultado
from storage.buckets
where id = 'inventario-privado';
