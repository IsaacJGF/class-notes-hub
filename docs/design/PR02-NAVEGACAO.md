# PR 02 — Cabeçalho e navegação

Base: d4ba6eeba41704e7f9d5c3f989636ae01af7bf3d (PR 01 aprovado e integrado). Direção: Soft Blue.

- 02.01: header usa surface-global-header e brand, 49px como altura mínima desktop, logotipo e seletor existentes; no mobile, preservar alvo de toque (44px), mesmo que o header fique mais alto.
- 02.02: navegação Cadastro/turmas, blocos e subramificações com sublinhado azul; sem mudança de rotas, ordenação, rótulos ou comportamento Radix. Botões da navegação principal mantêm sua semântica, com aria-pressed. Scroll horizontal acessível, sem sidebar.
- 02.03: faixa de contexto compacta, mantém turma, contagem, período, A–Z, busca Geral e Adicionar aluno na mesma ordem. Quebra de linha em telas estreitas.
- 02.04: Geral continua com a busca no topo; outras abas mantêm o campo acima da tabela. Toolbar local aderente à viewport enquanto dentro da seção, usando overflow: clip nos ancestrais relevantes para não criar um scroll container artificial. Mantém os wrappers de tabela existentes. Foco com preventScroll, fallback de scroll mínimo se campo estiver fora da tela; Ctrl+F/Escape não sequestram a interação em modal. O alvo é zero salto na planilha manual; não se promete eliminação de todos os deslocamentos em toda tela. A região de rolagem interna e compactação da tabela pertencem ao PR 04.
- 02.05: 1366×768, 1920×1080 e 390×844 em teste automatizado; 390px é viewport web, não Electron. Alvos móveis de 44px nos controles de navegação e contexto.

Sem alteração de fórmula, nota, clipboard, esquema, armazenamento, importação/exportação, estado de período ou dependências. Gradebook e ActivitySummary alterados apenas nas classes de navegação e ancestrais da pesquisa. Mantém as alturas e controles da planilha neste PR. Não substitui o kit Radix nem cria nova função acadêmica. 

## Critérios
Build e testes existentes; lint sem novos erros; repetir 45 verificações de baseline e capturas, acrescentar troca de turma/período, navegação horizontal e teste de posição de pesquisa/foco. Verificar viewport sem overflow de página, elementos alcançáveis, seleção e notas exportadas. Comparar scroll e linhas visíveis com PR 01. Verificação manual Electron/Windows pendente antes da liberação final. Sem merge até aprovação do usuário.
