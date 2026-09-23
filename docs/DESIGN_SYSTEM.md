# Design System SENAI / Afonso Greco

Esta base visual é compartilhada entre Portal, Vision, Inventário e Apresentação.

## Arquivos canônicos

- `css/senai-tokens.css`: valores visuais compartilhados.
- `css/senai-foundation.css`: acessibilidade e comportamento estrutural comum.

Os dois arquivos devem permanecer idênticos nos quatro repositórios.

## Ordem obrigatória

Carregue sempre:

```html
<link rel="stylesheet" href="./css/senai-tokens.css">
<link rel="stylesheet" href="./css/senai-foundation.css">
<link rel="stylesheet" href="./css/arquivo-do-sistema.css">
```

Tokens vêm antes da foundation e dos estilos específicos.

## Tokens principais

Marca:

- `--senai-brand-blue`
- `--senai-brand-blue-strong`
- `--senai-brand-blue-dark`
- `--senai-brand-navy`
- `--senai-brand-orange`
- `--senai-brand-red`

Superfícies:

- `--senai-bg`
- `--senai-surface`
- `--senai-surface-soft`
- `--senai-ink`
- `--senai-muted`
- `--senai-line`

Estados:

- `--senai-success`
- `--senai-warning`
- `--senai-danger`

Geometria:

- `--senai-radius-sm`
- `--senai-radius-md`
- `--senai-radius-lg`
- `--senai-radius-pill`

Elevação:

- `--senai-shadow-sm`
- `--senai-shadow-md`
- `--senai-shadow-lg`

## Tema escuro

O tema compartilhado usa:

```html
<html data-theme="dark">
```

Os tokens de texto, superfície, borda e sombra são substituídos automaticamente.

## Regra para CSS de cada sistema

É permitido criar aliases locais:

```css
:root{
  --blue:var(--senai-brand-blue);
  --surface:var(--senai-surface);
}
```

Não redefina um token canônico fora de `css/senai-tokens.css`.

Evite:

```css
:root{
  --senai-brand-blue:#123456;
}
```

O Quality Gate bloqueia esse tipo de divergência.

## Foco e acessibilidade

`senai-foundation.css` fornece:

- foco visível por teclado;
- `.sr-only`;
- `.skip-link`;
- redução de movimento com `prefers-reduced-motion`;
- suporte básico a `forced-colors`.

`--senai-focus` é uma **cor**. O halo é `--senai-focus-ring`.

## Mudança de identidade visual

Ao mudar um token compartilhado:

1. altere `css/senai-tokens.css`;
2. replique exatamente o mesmo conteúdo nos quatro repositórios;
3. incremente a versão de cache nos HTMLs;
4. aguarde o Quality Gate e o smoke test;
5. valide Portal, Vision, Inventário e Apresentação em desktop e mobile.

Não altere os quatro sistemas individualmente para representar a mesma decisão visual.
