# PR 05 — Cards, atividades e cadastro
Base: 309dfbdb26101f514c71953d26d1cb9b274006ec. Soft Blue.
- 05.01: Card compartilhado e cards de cadastro usam superfície branca, raio 8px, títulos 14–16px, padding e borda semânticos; sem mudar a estrutura da planilha PR04.
- 05.02: manter formulário de turma, aluno, chips de turmas, busca, filtro, ordenação, CSV e menus. Layout responsivo, rótulos acessíveis, erro de turma duplicada com role alert. Não alterar critérios de cadastro/exclusão. Ctrl+F no cadastro não captura teclas dentro de modal.
- 05.03: formulário de atividades em grid, desktop com nome/data/prazo/ação na mesma linha, campos condicionais abaixo; mobile nome em largura completa, data e prazo lado a lado e botão completo. Preserva lógica de prazo, validação, criação, exportação e registros.
- 05.04: estados vazios com texto e ícone, sem ações fictícias. Alertas de aproveitamento mantêm limite, cálculo, lista e expansão; lista com rolagem quando extensa. Sem métricas novas.
- 05.05: repetir auditoria PR04 de 66 verificações, mais cadastro, duplicata, busca/filtro, criação de atividade nos três modos de prazo e alertas/estados vazios. Capturas 1366x768, 1920x1080 e 390x844. Verificar densidade AL >=8, clipboard e exportação antes das mutações. Sem merge até aprovação. Lint legado e validação Electron/Windows permanecem.
