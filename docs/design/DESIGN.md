# Design System — Soft Blue (PR 01)

Status: fundação implementada na branch de revisão; aprovação visual e merge ainda pendentes.
Fonte da decisão: [DECISAO-ETAPA01.md](DECISAO-ETAPA01.md). A referência original está em [soft-blue.tokens.json](soft-blue.tokens.json); o CSS executável em [design-tokens.css](../../src/styles/design-tokens.css), importado por src/index.css.

## 01.01 — Tokens e compatibilidade
Os tokens de cor armazenam canais HSL (não HEX nem função hsl inteira), para preservar hsl(var(--token) / alpha) e as classes Tailwind existentes. Não remover os aliases abaixo. Criar novos componentes com nomes semânticos; não duplicar valores HEX no JSX.

| Alias legado | Novo token semântico | Uso |
|---|---|---|
| `--background` | `--surface-canvas` | Compatibilidade |
| `--foreground` | `--text-main` | Compatibilidade |
| `--card` | `--surface-default` | Compatibilidade |
| `--card-foreground` | `--text-main` | Compatibilidade |
| `--popover` | `--surface-default` | Compatibilidade |
| `--popover-foreground` | `--text-main` | Compatibilidade |
| `--primary` | `--action` | Compatibilidade |
| `--primary-foreground` | `--action-text` | Compatibilidade |
| `--secondary` | `--surface-table-header` | Compatibilidade |
| `--secondary-foreground` | `--brand` | Compatibilidade |
| `--muted` | `--surface-muted` | Compatibilidade |
| `--muted-foreground` | `--text-muted` | Compatibilidade |
| `--accent` | `--surface-active` | Compatibilidade |
| `--accent-foreground` | `--text-main` | Compatibilidade |
| `--destructive` | `--status-low-grade` | Compatibilidade |
| `--destructive-foreground` | `--action-text` | Compatibilidade |
| `--border` | `--border-subtle` | Compatibilidade |
| `--input` | `--border-control` | Compatibilidade |
| `--ring` | `--focus` | Compatibilidade |
| `--present` | `--status-success` | Compatibilidade |
| `--present-foreground` | `--action-text` | Compatibilidade |
| `--present-light` | `--status-success-bg` | Compatibilidade |
| `--absent` | `--status-absent` | Compatibilidade |
| `--absent-foreground` | `--action-text` | Compatibilidade |
| `--absent-light` | `--status-absent-bg` | Compatibilidade |
| `--done` | `--status-done` | Compatibilidade |
| `--done-foreground` | `--action-text` | Compatibilidade |
| `--done-light` | `--status-done-bg` | Compatibilidade |
| `--not-done` | `--status-legacy-pending` | Compatibilidade |
| `--not-done-foreground` | `--action-text` | Compatibilidade |
| `--not-done-light` | `--status-legacy-pending-bg` | Compatibilidade |
| `--warning` | `--status-warning` | Compatibilidade |
| `--warning-foreground` | `--status-late` | Compatibilidade |
| `--warning-light` | `--status-late-bg` | Compatibilidade |
| `--warning-border` | `--status-warning-border` | Compatibilidade |
| `--table-header` | `--surface-table-header` | Compatibilidade |
| `--table-header-foreground` | `--text-muted` | Compatibilidade |
| `--table-stripe` | `--surface-stripe` | Compatibilidade |
| `--table-hover` | `--surface-hover` | Compatibilidade |
| `--sidebar-background` | `--surface-global-header` | Compatibilidade |
| `--sidebar-foreground` | `--text-main` | Compatibilidade |
| `--sidebar-primary` | `--action` | Compatibilidade |
| `--sidebar-primary-foreground` | `--action-text` | Compatibilidade |
| `--sidebar-accent` | `--surface-active` | Compatibilidade |
| `--sidebar-accent-foreground` | `--text-main` | Compatibilidade |
| `--sidebar-border` | `--border-subtle` | Compatibilidade |
| `--sidebar-ring` | `--focus` | Compatibilidade |

## 01.02 — Paleta
| Token | HEX | Finalidade |
|---|---|---|
| `--brand` | #354F78 | Identidade |
| `--action` | #345D9D | Ação |
| `--action-text` | #FFFFFF | Ação |
| `--surface-canvas` | #EEF4FB | Superfície |
| `--surface-default` | #FFFFFF | Superfície |
| `--text-main` | #263D59 | Texto |
| `--text-muted` | #526782 | Texto |
| `--border-subtle` | #D4E1F0 | Borda |
| `--surface-table-header` | #E7EFFA | Superfície |
| `--surface-selection` | #DEEBFF | Superfície |
| `--surface-active` | #DFEAFB | Superfície |
| `--surface-global-header` | #E0EBF9 | Superfície |
| `--status-low-grade` | #9B3342 | Estado semântico |
| `--status-low-grade-bg` | #FFF2F4 | Estado semântico |
| `--status-success` | #166534 | Estado semântico |
| `--status-success-bg` | #E8F6EB | Estado semântico |
| `--status-on-time-bg` | #ECF8EE | Estado semântico |
| `--status-late` | #92400E | Estado semântico |
| `--status-late-bg` | #FFF2D9 | Estado semântico |
| `--status-pending` | #9C303E | Estado semântico |
| `--status-pending-bg` | #FFF1F2 | Estado semântico |
| `--border-control` | #7589A4 | Borda |
| `--focus` | #345D9D | Foco |
| `--surface-muted` | #F2F6FB | Superfície |
| `--surface-stripe` | #F8FAFD | Superfície |
| `--surface-hover` | #EAF2FC | Superfície |
| `--status-absent` | #9B3342 | Estado semântico |
| `--status-absent-bg` | #FFF2F4 | Estado semântico |
| `--status-done` | #345D9D | Estado semântico |
| `--status-done-bg` | #E7EFFA | Estado semântico |
| `--status-legacy-pending` | #92400E | Estado semântico |
| `--status-legacy-pending-bg` | #FFF2D9 | Estado semântico |
| `--status-warning` | #92400E | Estado semântico |
| `--status-warning-border` | #D6B77D | Estado semântico |

Bordas decorativas suaves não precisam atingir 3:1; contornos de campos essenciais usam --border-control (#7589A4), distinto do token de borda decorativa. A cor de foco é --focus. --accent passa a superfície ativa clara com texto escuro (menus e exportação continuam com contraste). --primary é ação, não marca. O cabeçalho global ainda usa --primary e será separado no PR 02. Estados legados de pendência (âmbar) e ausência (vermelho) continuam distintos; o token de pendência vermelho aprovado está disponível para a padronização explícita do PR 03, sem trocar a semântica dos componentes existentes. Valores auxiliares (bordas de controle, zebra, hover e warning) foram escolhidos para compatibilidade/contraste, não são uma quarta direção visual. Nenhuma alteração de limiar, cálculo ou dados.

## 01.03 — Tipografia
Inter com a mesma importação existente e fallback local; manter raiz de 16px. Corpo 14px, tabelas 13px, cabeçalho 12px, meta 12px, seção 16px, página 20–24px. Números tabulares em .school-table; não alterar formatação ou valor de nota. Classes explícitas existentes permanecem, inclusive adaptação móvel; revisão de títulos/labels específicos nos PRs de componente.

## 01.04 — Dimensões, estados e sombras
Escala 4/8/12/16/24/32px. Raios: padrão/card 8px, campo/botão 6px, célula 5px, tabela 7px, modal 12px, tooltip 9px (protótipo aprovado prevalece sobre faixas genéricas do caderno). Sombras sutis e foco de 2px com offset de 2px. Alvos de 49px cabeçalho, 39px navegação, 34/36px linha e 26px input de nota são referências documentadas, não alturas impostas neste PR. Não mudar scroll, posicionamento da pesquisa, layout, navegação ou dimensões de controles existentes; validar alvos de toque nos PRs 02–07. Não substituir tooltips/menus nesta fase.

## 01.05 — Amostra isolada
Abra [amostra.html](amostra.html) a partir de um checkout local (arquivo estático, sem lógica acadêmica; usa o CSS real de tokens). Não existe rota nova no aplicativo. Exemplos permitidos: ação preenchida com texto branco; superfície ativa com texto escuro; campos com contorno de controle; nota baixa com texto semântico e superfície suave; foco visível. Proibido: texto branco em fundo pastel, usar apenas cor para indicar estado, novos HEX no JSX, mudar fórmula ou substituir ausência por zero.

## Validação e portões
- npm ci, npm run build, npm run lint, npm test; lint baseline: 3 erros e 7 avisos, não corrigir arquivos fora do escopo.
- Testes de tokens: resolução dos aliases, fidelidade à paleta aprovada, contraste mínimo dos pares selecionados (não é auditoria WCAG completa).
- Reexecutar fixture da Etapa 00 (41 alunos fictícios) em 1366×768, 1920×1080, 390×844. Capturas e fluxos com a mesma fixture; baseline e candidate identificados pelo SHA. Registrar diferenças, regressões e falhas.
- Sem mudança em Gradebook.tsx, TurmaTab.tsx, Index.tsx, handlers, useSchoolData, Electron, dependências ou package.json. App.css é template não importado e permanece intacto.
- Não aplicar PR 02–09 agora. Aprovação do usuário e ausência de regressão antes de merge.
- Referências T01, T03, T04, T06, T07; I05, I07, I08 (ver [EVIDENCIAS-ETAPA01.md](EVIDENCIAS-ETAPA01.md)).
