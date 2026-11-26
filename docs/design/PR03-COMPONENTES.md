# PR 03 — Componentes compartilhados
Base: 3b6581693f8b3a85dfd3e698cd76e8ea1943ca00. Soft Blue aprovado. Implementação de 03.01–03.05.

| Componente | Padrão |
|---|---|
| Botão primário | action/action-text, 36px desktop, 44px mobile |
| Secundário | superfície branca, borda de controle, texto escuro |
| Discreto/ícone | hover em superfície ativa, foco visível |
| Destrutivo | token destructive, rótulo/ícone explícito |
| Campo e filtro | borda de controle, superfície branca, raio 6px; aria-invalid quando fornecido |
| Tooltip | portal Radix, colisão 12px, raio 9px, branco e sombra overlay, quebra de texto |
| Menu e popover | borda sutil, raio de card, sombra overlay, limite de viewport |
| Modal | superfície branca, raio 12px, altura limitada, scroll e ações responsivas |
| Estado | presente/ausente, realizada, atraso, pendência distintos; texto/ícone junto da cor |
| Toast | aparência compartilhada; disparos de sucesso/erro existentes intactos |

O tooltip de atividade mantém status e datas originais. Datas ISO apenas de dia são exibidas como dd mês abreviado yyyy; hora só se constar na string original (sem inventar hora ou converter o valor persistido). Importação CSV usa Dialog Radix já instalado para foco/Escape; parsing, contagens, arquivo e handlers permanecem. Confirmações nativas de exclusão continuam nativas. Controles de notas, densidade e estrutura de tabelas ficam no PR 04. Nav/abas aprovadas no PR 02 não sofrem alterações. Formulários nativos mantêm eventos e validação; tamanhos específicos permanecem quando necessários. Loading somente se já existir estado real. Não se afirma conformidade WCAG integral. Testar abertura/fechamento, foco, teclado, CSV válido/inválido, transferência, hover e status nas três resoluções e repetir baseline. Sem merge automático.

## Ajuste após primeira auditoria
Tooltip de atividade prefere acima do acionador (Radix pode inverter em colisão), largura máxima de 320px e margem de 12px em relação à viewport. A animação usa apenas opacidade, sem deslocamento/escala. Identificador de teste na superfície real, não no elemento de acessibilidade oculto. CSV: corrigir a fixture da auditoria (quebras de linha reais), sem mudar o parser. Aguardando reteste; não reduzir requisitos de cobertura.
