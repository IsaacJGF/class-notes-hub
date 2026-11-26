# Etapa 01 — decisão visual aprovada

**Estado: aprovada em 25/11/2026 (horário de Brasília).**  
**Direção:** C — Soft Blue.  
**Declaração do usuário:** “Minha escolha para a Etapa 01 é Soft Blue. Registre minha decisão e dê continuidade à Etapa 01.”  
**Ajustes adicionais solicitados:** nenhum.  
**Baseline:** `4d4faf185853ab1d744bf91e62720129814f21d8` (main, merge do PR #39).

## Escopo da aprovação

Aprovação da direção estética e do protótipo comparativo, não autorização para merge, publicação, atualização local ou alteração da lógica acadêmica. Etapa 01 encerrada quanto à escolha visual. PR 01 liberado para ser iniciado separadamente, a partir de main conferida e com esta documentação como referência; não foi implementado nesta branch.

A/B Corporate Navy e Neutral Minimal permanecem alternativas históricas; C Soft Blue é a única direção selecionada. Manter a geometria comum do protótipo (sem introduzir densidade selecionável). Utilizar a fixture da Etapa 00: 41 alunos fictícios, 2 turmas, 3 trimestres, cinco avaliações AEP/AL/AV/AG/Teste e P.E., valores ausentes, zeros e decimais.

## Decisões e critérios
- Cabeçalho global azul claro, 49 px; navegação horizontal de 39 px e aba sublinhada; manter logotipo real, rótulos, ordem e seletor de trimestre. Não adicionar sidebar.
- Superfícies brancas sobre fundo azul suave; marca #354F78, ação #345D9D, texto #263D59. Os valores completos estão em [soft-blue.tokens.json](soft-blue.tokens.json).
- Linhas 34 px desktop, 36 px mobile; campos de nota 26 px, tipografia tabular. São referências geométricas a validar no React real, não valores incondicionalmente obrigatórios se houver problemas de acessibilidade.
- Cabeçalhos leves, seleção #DEEBFF com contorno da ação, totais calculados em superfície diferenciada, notas abaixo da média com destaque discreto. Preservar limiar e todas as regras atuais.
- Pesquisa no topo da Geral; nas demais abas junto da tabela. Região de rolagem interna e foco sem salto ao Ctrl+F são objetivos do redesign, não correções já implantadas. Validar foco, busca com acentos, Escape e deslocamento.
- Não mudar fórmulas, arredondamento, limites, localStorage, esquema, notas vazias vs. zero, exportação, importação, cadastro, transferência ou clipboard. Não criar indicadores novos nem ativar componentes inacessíveis só por estética.
- Tema escuro permanece opcional e requer aprovação separada.

## Evidências
| Resolução | AL: linhas completas | Geral | AEP |
|---|---:|---:|---:|
| 1366×768 | 8 | 11 | 7 |
| 1920×1080 | 18 | 20 | 16 |
| 390×844 | 7 | 11 | 6 |

Valores do protótipo HTML, não do app React. Teste Soft Blue de Ctrl+F: scroll interno 850 → 850 px; pesquisa sem acentos, decimal e Geral aprovados no ensaio; nenhum pageerror registrado. No relatório comparativo: contraste de texto principal 11,09:1, secundário sobre cabeçalho 5,01:1 e botões 6,57:1. São pares selecionados, não certificação WCAG. A Etapa 00 registrou build e 28 testes unitários aprovados, 45 verificações web aprovadas, lint com 3 erros e 7 avisos já existentes. No notebook a AL passou, no protótipo, de 0 para 8 linhas; meta de implementação ≥8. Não usar comparação móvel com scroll inicial diferente como ganho causal.

## Referências por componente
| Componente | Referências | Diretriz |
|---|---|---|
| Cabeçalho e abas | Linear (I05), Microsoft Fluent 2 (T06) | Hierarquia leve, aba ativa sublinhada |
| Planilha | Attio (I10), IBM Carbon Data Table (T05), ARIA APG (T08) | Densidade, foco, seleção, operação pelo teclado |
| Botões e campos | Untitled UI (I07), shadcn/ui (I08) | Hierarquia, raios, foco consistente |
| Status e tooltips | Fluent 2 (T06), Untitled UI (I07) | Texto/ícone e cor, datas legíveis |
| Contraste e acessibilidade | WCAG 2.2 (T07) | Validar pares reais, foco e teclado |
| Tokens | NN/g (T01), DTCG (T04) | Centralizar propriedades semânticas |

## Limites e próximos portões
Os protótipos são HTML independentes, com dados fictícios em memória. Exportação, configuração de divisões, adição de atividades e ações destrutivas são ilustrativas; não constituem validação de regressão. Avaliação manual no Electron/Windows e acessibilidade abrangente seguem pendentes antes da liberação final. A largura mínima da janela Electron é 1024 px; 390×844 corresponde à versão web. Os gráficos de SummaryTab/ChartsSubpage precisam ter acessibilidade na navegação confirmada antes do PR 06. Os PRs seguintes devem conter capturas comparáveis, testes e aprovação. 
