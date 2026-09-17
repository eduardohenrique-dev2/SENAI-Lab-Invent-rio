# SENAI Lab Inventário

Sistema completo de inventário, patrimônio, estoque, empréstimos, manutenção e rastreabilidade do SENAI Lab.

## Stack

- HTML5
- CSS3
- JavaScript puro
- Supabase Auth / Postgres / Storage / Realtime
- Vercel

## Módulos

- Dashboard operacional
- Equipamentos, materiais, componentes e consumíveis
- Estoque e alertas de mínimo
- Localizações hierárquicas
- Movimentações
- Empréstimos e devoluções
- Manutenção
- Inventário físico
- QR Code por item
- Usuários e permissões
- Relatórios CSV / Excel / PDF
- Auditoria
- Notificações
- Configurações

## Perfis

- `administrador`
- `gestor`
- `instrutor`
- `aluno`
- `auditor`

O projeto usa o mesmo Supabase Auth do ecossistema SENAI Lab. Na migration inicial, usuários existentes do sistema principal são mapeados automaticamente quando possível: `proprietario` → Administrador, `administracao` → Gestor e `equipe` → Instrutor.

## Ativação

1. Execute `supabase/01_inventario_schema.sql` no mesmo projeto Supabase usado pelo SENAI Lab.
2. Execute `supabase/02_seed_inicial.sql` para criar categorias e localização raiz.
3. Faça o deploy na Vercel.
4. Acesse `/` e entre com sua conta autorizada.

> A Publishable Key do Supabase pode ficar no navegador. Nunca coloque `service_role` no frontend.

## Identidade

A interface mantém a identidade visual do SENAI Lab, com logotipo oficial em SVG, favicon, azul institucional e laranja Lab.

---

Copyright © 2026 Eduardo Henrique Gonçalves.