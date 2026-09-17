-- ============================================================
-- SENAI LAB INVENTÁRIO — DADOS INICIAIS
-- Execute após 01_inventario_schema.sql
-- ============================================================

begin;

insert into public.inv_categorias (nome,tipo,descricao)
values
    ('Impressão 3D','equipamento','Impressoras 3D, acessórios e equipamentos de prototipagem.'),
    ('Corte e Gravação Laser','equipamento','Máquinas de corte e gravação a laser.'),
    ('Eletrônica','equipamento','Instrumentos, fontes, osciloscópios, multímetros e bancadas.'),
    ('Ferramentas','equipamento','Ferramentas elétricas e manuais de uso controlado.'),
    ('Informática','equipamento','Computadores, tablets, periféricos e rede.'),
    ('Robótica','componente','Kits, placas, motores, sensores e atuadores.'),
    ('Arduino / Microcontroladores','componente','Placas Arduino, ESP32, Raspberry Pi e similares.'),
    ('Sensores','componente','Sensores eletrônicos e módulos de aquisição.'),
    ('Motores e Atuadores','componente','Motores DC, servos, motores de passo e drivers.'),
    ('Componentes Eletrônicos','componente','Resistores, capacitores, CIs, conectores e módulos.'),
    ('Filamentos 3D','consumivel','PLA, PETG, ABS, TPU e outros filamentos.'),
    ('Chapas e Materiais Laser','consumivel','MDF, acrílico, papelão e outros materiais para laser.'),
    ('Materiais de Oficina','material','Materiais gerais de oficina e fabricação.'),
    ('EPIs','material','Equipamentos de proteção individual e itens de segurança.')
on conflict do nothing;

-- Estrutura inicial: SENAI > SENAI Lab.
with unidade as (
    insert into public.inv_localizacoes (nome,codigo,tipo,descricao)
    select 'SENAI','SENAI','unidade','Unidade SENAI'
    where not exists (select 1 from public.inv_localizacoes where codigo='SENAI')
    returning id
), unidade_id as (
    select id from unidade
    union all
    select id from public.inv_localizacoes where codigo='SENAI' limit 1
)
insert into public.inv_localizacoes (parent_id,nome,codigo,tipo,descricao)
select id,'SENAI Lab','LAB','laboratorio','Laboratório SENAI Lab'
from unidade_id
where not exists (select 1 from public.inv_localizacoes where codigo='LAB');

insert into public.inv_configuracoes (chave,valor)
values
    ('geral',jsonb_build_object(
        'nome','SENAI Lab Inventário',
        'moeda','BRL',
        'dias_alerta_garantia',30,
        'dias_alerta_manutencao',7,
        'horas_item_parado',168,
        'prefixo_codigo','LAB-INV'
    )),
    ('emprestimos',jsonb_build_object(
        'permitir_solicitacao_aluno',true,
        'exigir_confirmacao',true,
        'alertar_atraso',true
    )),
    ('inventario_fisico',jsonb_build_object(
        'permitir_auditor',true,
        'exigir_localizacao',false
    ))
on conflict (chave) do nothing;

commit;

select
    (select count(*) from public.inv_categorias where ativo=true) as categorias,
    (select count(*) from public.inv_localizacoes where ativo=true) as localizacoes,
    'OK - dados iniciais criados' as resultado;
