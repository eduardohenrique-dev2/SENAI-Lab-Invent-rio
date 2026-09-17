# SENAI Lab Inventário

Sistema completo de inventário, patrimônio, estoque, empréstimos, manutenção e rastreabilidade do SENAI Lab.

## Versão atual

**V1.1 — Uploads e importação automática de patrimônio** em HTML, CSS e JavaScript puro, integrada ao mesmo Supabase do ecossistema SENAI Lab.

## Stack

- HTML5 + CSS3 + JavaScript puro;
- Supabase Auth;
- PostgreSQL + RLS;
- Supabase Storage;
- Supabase Realtime;
- QR Code;
- leitura de Excel / CSV / PDF textual;
- exportação CSV, Excel e PDF;
- Vercel.

## Módulos

- Dashboard operacional e patrimonial;
- cadastro de equipamentos, materiais, componentes e consumíveis;
- **Uploads / Importação de patrimônio**;
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

## Uploads / Importação de patrimônio

Administradores e Gestores possuem uma área própria **Uploads / Importar**.

O fluxo é:

1. selecionar ou arrastar um ou mais arquivos;
2. analisar os dados sem alterar o banco;
3. revisar a prévia dos itens reconhecidos;
4. confirmar a importação;
5. consultar posteriormente o histórico do lote.

Formatos aceitos:

- `.xlsx`;
- `.xls`;
- `.csv`;
- `.pdf` com texto selecionável.

PDFs formados apenas por imagem/scan não são interpretados automaticamente. O sistema informa a limitação em vez de gerar dados que não estejam presentes no arquivo.

A análise reconhece aliases comuns de colunas como patrimônio/tombamento, nome/descrição do bem, categoria, marca, modelo, número de série, quantidade, localização, sala, armário, prateleira, responsável, situação/status, aquisição, valor e garantia.

Antes de confirmar, cada linha recebe uma classificação:

- `Novo`;
- `Atualizar`;
- `Ignorar`;
- `Erro`.

Duplicidades são comparadas por patrimônio, código interno, número de série e código de barras. Campos vazios do arquivo não apagam dados existentes.

Quando permitido pelo usuário, o importador também pode criar categorias e a hierarquia de localizações que ainda não existirem. Os arquivos originais ficam armazenados no bucket privado e cada lote registra totais de novos, atualizados, ignorados e erros.

O repositório inclui `MODELO_IMPORTACAO_PATRIMONIO.csv` como referência opcional de colunas.

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
- `gestor` — inventário, uploads, estoque, empréstimos, manutenção, relatórios e configurações;
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
- bucket privado para nota fiscal, documentação interna e arquivos originais de importação;
- QR público usa RPC sanitizada e não retorna custo, nota fiscal, observações internas ou dados de usuários;
- auditoria automática de alterações;
- CSP, HSTS, `nosniff`, proteção contra iframe e `noindex` via `vercel.json`.

A Project URL e a **Publishable Key** do Supabase podem aparecer no frontend. Não coloque Secret key, `service_role`, senha SMTP ou qualquer outro segredo neste repositório.

## Estrutura

- `index.html` — painel principal e login;
- `item.html` — ficha pública sanitizada aberta pelo QR;
- `css/app.css` — interface administrativa responsiva;
- `css/importacoes.css` — interface de uploads/importação;
- `css/item-public.css` — ficha pública do QR;
- `css/tipografia-senai.css` — pilha tipográfica do SENAI Lab, sem distribuir arquivos de fonte;
- `assets/logo-senai-lab.svg` — logotipo oficial usado no ecossistema;
- `favicon.svg` — favicon SENAI Lab;
- `js/config.js` — configuração pública do Supabase e carregamento dos módulos;
- `js/app.js` — autenticação, permissões e módulos principais;
- `js/importacoes.js` — leitura, prévia e importação de planilhas/PDFs;
- `js/item-public.js` — consulta pública segura do QR;
- `supabase/01_inventario_schema.sql` — schema, RLS, RPCs, Storage e Realtime;
- `supabase/02_seed_inicial.sql` — categorias, localização raiz e configurações iniciais;
- `supabase/03_importacoes_uploads.sql` — lotes e histórico de uploads;
- `MODELO_IMPORTACAO_PATRIMONIO.csv` — exemplo opcional de planilha;
- `vercel.json` — headers de produção.

## Ativação

No **mesmo projeto Supabase** já usado pelo SENAI Lab:

1. Execute `supabase/01_inventario_schema.sql` e confirme `OK - SENAI Lab Inventário V1 criado`.
2. Execute `supabase/02_seed_inicial.sql` e confirme `OK - dados iniciais criados`.
3. Execute `supabase/03_importacoes_uploads.sql` e confirme `OK - módulo Uploads / Importações ativado`.
4. Faça o deploy deste repositório na Vercel.
5. Adicione o domínio final da Vercel aos hostnames permitidos do hCaptcha, caso a sua configuração do hCaptcha exija allowlist por domínio.
6. Acesse `/` e entre com a mesma conta autorizada do SENAI Lab.

## QR Code

Cada item possui um `qr_token` aleatório. A etiqueta gerada no painel aponta para:

`/item.html?token=<token>`

A ficha pública mostra somente identificação operacional, status e localização. Para solicitar empréstimo ou executar ações internas, o usuário é direcionado para o sistema autenticado.

## Relatórios

A V1.1 exporta:

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
