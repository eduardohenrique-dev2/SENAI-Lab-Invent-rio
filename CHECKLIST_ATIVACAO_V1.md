# Checklist de Ativação — SENAI Lab Inventário V1

## 1. Supabase

Execute no SQL Editor do MESMO projeto Supabase usado pelo SENAI Lab, nesta ordem:

1. `supabase/01_inventario_schema.sql`
   - resultado esperado: `OK - SENAI Lab Inventário V1 criado`
2. `supabase/02_seed_inicial.sql`
   - resultado esperado: `OK - dados iniciais criados`

A migration cria:

- perfis e permissões;
- categorias;
- localizações;
- itens;
- movimentações;
- empréstimos;
- manutenção;
- inventário físico;
- notificações;
- configurações;
- auditoria;
- RLS;
- RPCs operacionais;
- buckets `inventario-publico` e `inventario-privado`;
- Realtime.

## 2. Login

Use a mesma conta do ecossistema SENAI Lab.

Mapeamento automático esperado:

- Proprietário → Administrador;
- Administração → Gestor;
- Equipe → Instrutor.

Validar:

- login com hCaptcha;
- nome e perfil exibidos no menu;
- logout;
- bloqueio para perfil inativo.

## 3. hCaptcha

Depois do deploy, confirme que o domínio final da Vercel está permitido no hCaptcha caso a configuração da sua conta use allowlist de hostnames.

## 4. Teste funcional mínimo

- cadastrar um equipamento;
- cadastrar um consumível com estoque mínimo;
- criar Sala → Armário → Prateleira;
- transferir um item entre localizações;
- solicitar/aprovar empréstimo;
- registrar devolução;
- abrir e concluir manutenção;
- iniciar inventário físico e marcar itens;
- gerar QR Code e abrir `/item.html?token=...` pelo celular;
- exportar CSV, Excel e PDF;
- verificar histórico e auditoria;
- confirmar atualização Realtime em duas abas.

## 5. Segurança

Confirmar que:

- não existe `service_role` no frontend;
- nota fiscal/documentação interna não aparece no QR público;
- usuário Aluno não consegue editar patrimônio;
- Auditor não consegue alterar itens;
- somente Administrador altera perfis;
- Gestor não altera usuários;
- buckets privados exigem sessão autorizada.

## 6. Produção

Quando todos os testes acima passarem, marcar a versão como:

**SENAI Lab Inventário V1 — validado em produção.**
