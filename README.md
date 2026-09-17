# SENAI Lab Inventário

Sistema completo de inventário, patrimônio, estoque, empréstimos, manutenção e rastreabilidade do SENAI Lab.

## Versão atual

**V1 — base funcional completa** em HTML, CSS e JavaScript puro, integrada ao mesmo Supabase do ecossistema SENAI Lab.

## Stack

- HTML5 + CSS3 + JavaScript puro;
- Supabase Auth;
- PostgreSQL + RLS;
- Supabase Storage;
- Supabase Realtime;
- QR Code;
- exportação CSV, Excel e PDF;
- Vercel.

## Módulos

- Dashboard operacional e patrimonial;
- cadastro de equipamentos, materiais, componentes e consumíveis;
- estoque e alerta de mínimo;
- localização hierárquica;
- movimentações e rastreabilidade;
- empréstimos, aprovações e devoluções;
- manutenção;
- inventário físico;
- QR Code público sanitizado por item;
- usuários e permissões;
- relatórios CSV / Excel / PDF;
- auditoria técnica;
- notificações e alertas operacionais;
- configurações.

## Cadastro de item

A ficha suporta:

- código interno e patrimônio;
- categoria e subcategoria;
- marca, modelo, série, código de barras e QR;
- foto;
- descrição e especificações;
- voltagem, potência, capacidade e fabricante;
- manual/documentação;
- quantidade, unidade e estoque mínimo;
- localização, armário e prateleira;
- responsável e status;
- aquisição, valor e garantia;
- nota fiscal privada;
- observações internas.

## Perfis

- `administrador` — acesso completo;
- `gestor` — inventário, estoque, empréstimos, manutenção, relatórios e configurações;
- `instrutor` — consulta, empréstimos e movimentações autorizadas;
- `aluno` — consulta sanitizada e solicitação de empréstimo;
- `auditor` — consulta, inventário físico, relatórios e auditoria.

O projeto usa o **mesmo Supabase Auth** do ecossistema SENAI Lab. Na migration inicial, usuários existentes do sistema principal são mapeados automaticamente quando possível:

- `proprietario` → `administrador`;
- `administracao` → `gestor`;
- `equipe` → `instrutor`.

Novos usuários do Supabase Auth recebem perfil `aluno` inativo até liberação.

## Segurança

- RLS em todas as tabelas internas;
- operações críticas validadas no banco;
- `service_role` nunca é usado no navegador;
- bucket público somente para imagens que podem aparecer no QR;
- bucket privado para nota fiscal e documentação interna;
- QR público usa RPC sanitizada e não retorna custo, nota fiscal, observações internas ou dados de usuários;
- auditoria automática de alterações;
- CSP, HSTS, `nosniff`, proteção contra iframe e `noindex` via `vercel.json`.

A Project URL e a **Publishable Key** do Supabase podem aparecer no frontend. Não coloque Secret key, `service_role`, senha SMTP ou qualquer outro segredo neste repositório.

## Estrutura

- `index.html` — painel principal e login;
- `item.html` — ficha pública sanitizada aberta pelo QR;
- `css/app.css` — interface administrativa responsiva;
- `css/item-public.css` — ficha pública do QR;
- `css/tipografia-senai.css` — pilha tipográfica do SENAI Lab, sem distribuir arquivos de fonte;
- `assets/logo-senai-lab.svg` — logotipo oficial usado no ecossistema;
- `favicon.svg` — favicon SENAI Lab;
- `js/config.js` — configuração pública do Supabase;
- `js/app.js` — autenticação, permissões e todos os módulos do sistema;
- `js/item-public.js` — consulta pública segura do QR;
- `supabase/01_inventario_schema.sql` — schema, RLS, RPCs, Storage e Realtime;
- `supabase/02_seed_inicial.sql` — categorias, localização raiz e configurações iniciais;
- `vercel.json` — headers de produção.

## Ativação

No **mesmo projeto Supabase** já usado pelo SENAI Lab:

1. Abra o SQL Editor.
2. Execute inteiro `supabase/01_inventario_schema.sql`.
3. Confirme no resultado: `OK - SENAI Lab Inventário V1 criado`.
4. Execute inteiro `supabase/02_seed_inicial.sql`.
5. Confirme no resultado: `OK - dados iniciais criados`.
6. Faça o deploy deste repositório na Vercel.
7. Adicione o domínio final da Vercel aos hostnames permitidos do hCaptcha, caso a sua configuração do hCaptcha exija allowlist por domínio.
8. Acesse `/` e entre com a mesma conta autorizada do SENAI Lab.

## QR Code

Cada item possui um `qr_token` aleatório. A etiqueta gerada no painel aponta para:

`/item.html?token=<token>`

A ficha pública mostra somente identificação operacional, status e localização. Para solicitar empréstimo ou executar ações internas, o usuário é direcionado para o sistema autenticado.

## Relatórios

A V1 exporta:

- inventário geral;
- estoque;
- empréstimos;
- manutenções;
- movimentações;
- inventário físico.

Formatos: **CSV, Excel e PDF**.

## Observação sobre fontes

A interface tenta usar a mesma família tipográfica do ecossistema SENAI Lab por `local()` e possui fallbacks seguros. Nenhum arquivo proprietário de fonte é distribuído neste repositório.

---

Copyright © 2026 Eduardo Henrique Gonçalves.
