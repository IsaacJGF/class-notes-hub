# PR 06 — Geral e gráficos
Base: b40b1fd6d3dd2340a803e3e8ea0d888b6bc4a3c4. Soft Blue.
## Alcance real
App.tsx monta Index na rota /, e NotFound na rota *. Index monta StudentRegistration e TurmaTab. TurmaTab monta Gradebook; a aba overview (Geral) é a visão ativa. SummaryTab importa ChartsSubpage, mas não é montado pela navegação atual. Não há gráfico acessível por essa rota. Não reativar SummaryTab, não criar gráfico, nova rota, nova métrica ou filtro. 06.03 é não aplicável à interface ativa; componentes antigos mantidos intactos até decisão funcional específica.
- 06.01: Cabeçalho e legenda compactos, estados vazios consistentes com PR05, pesquisa mantida na faixa superior da turma.
- 06.02: notas calculadas, P.E. e nota final com superfícies distintas; hierarquia numérica, total sem fixar teto artificial, preservação da seleção PR04.
- 06.03: inventário de gráficos legados; sem alteração de código desconectado.
- 06.04: limites já existentes 14 por bloco (exceto PE) e 70 na final, ícone e rótulo de acessibilidade além de cor, cabeçalhos de coluna identificados; legenda explícita de que total inclui P.E.; histórico com tokens de status existentes. Não criar classificações novas.
- 06.05: comparar cada valor de todos os 41 alunos em 3 períodos com cálculo independente da fixture, incluindo zero, ausência, atraso, PE; testar seleção/cópia da final, filtro e estado vazio; conferir histórico após transferência, preservar scroll, densidade e exportações. Repetir 75 checks do PR05.
Sem mudanças nas fórmulas, cálculo, dados, handlers, exportações, dependências, armazenamento ou versão. Auditoria Electron/Windows e desempenho controlado pendentes. Sem merge automático.
