# Instruções de Montagem de MPV — Frontend specification

## Goal

Permitir consulta pública de instruções e reservar ações de manutenção a usuários autenticados com permissão.

## Personas and roles

- Persona — Visitante da área de instruções: Encontrar rapidamente uma instrução por código ou descrição.; roles: public-instructions-user-role
- Persona — Editor de instruções: Criar, editar e alterar o estado ativo de instruções com segurança.; roles: instructions-editor-role
- Persona — Administrador de instruções: Executar todas as ações editoriais e arquivar instruções.; roles: instructions-admin-role
- Role — Usuário público: Visualizar e pesquisar instruções de montagem de MPV sem autenticação.
- Role — Editor: Visualizar e pesquisar instruções., Criar e editar instruções., Alterar o estado ativo de instruções.
- Role — Administrador: Executar todas as permissões de editor., Solicitar e confirmar o arquivamento reversível de instruções.

## Routes

- `/instrucoes` — Instruções de Montagem de MPV: Oferecer busca, paginação e ações de manutenção sobre instruções de montagem de MPV.

## Primary journeys

- Localizar uma instrução: instructions-list-page (view) → instructions-list-page (search-instructions-action) → instructions-list-page (clear-instructions-search-action)
- Iniciar manutenção de uma instrução: instructions-list-page (view) → instructions-list-page (edit-instruction-action)
- Alterar estado ativo da instrução: instructions-list-page (view) → instructions-list-page (toggle-instruction-active-action)
- Excluir uma instrução: instructions-list-page (request-instruction-deletion-action) → instructions-list-page (confirm-instruction-deletion-action)

## Component strategy

- Estrutura geral da aplicação: application / not-applicable
- Cabeçalho utilitário: application / not-applicable
- Navegação principal de instruções: application / not-applicable
- Cabeçalho da listagem: application / not-applicable
- Ação Nova Instrução: application / not-applicable
- Barra de pesquisa de instruções: application / not-applicable
- Tabela de instruções: application / not-applicable
- Paginação da listagem: application / not-applicable
- Confirmação de exclusão: application / not-applicable
- Botão: shadcn / installed
- Campo de texto: shadcn / installed
- Tabela: shadcn / official-available
- Alternador: shadcn / official-available
- Paginação: shadcn / official-available
- Diálogo de alerta: shadcn / official-available

## Responsive

- Manter a composição de desktop observada em larguras amplas, com conteúdo quase integral e margens laterais consistentes.
- Empilhar título e ação Nova Instrução quando não houver largura suficiente para mantê-los na mesma linha.
- Empilhar campo e botões da pesquisa em telas estreitas sem alterar a ordem de foco.
- Abaixo de 768 px, substituir a tabela por cartões que preservem código, descrição, estado e ações; colocar a URL em detalhes expansíveis.
- Manter contagem e controles de paginação próximos aos resultados e permitir quebra controlada dos números de página.

## Accessibility

- Atender WCAG 2.2 nível AA nos fluxos de busca, paginação e manutenção.
- Fornecer rótulo programático ao campo de pesquisa, mesmo que permaneça visualmente oculto para preservar a aparência observada.
- Dar nomes acessíveis específicos aos botões por linha, como Editar instrução 186681 e Excluir instrução 186681.
- Expor o estado do alternador com nome específico, como Ativar instrução 186681, e não depender apenas de azul ou cinza.
- Anunciar por região viva a quantidade de resultados após busca, limpeza, paginação, alteração de estado ou exclusão.
- Associar cabeçalhos às células e preservar leitura lógica da tabela.
- Manter contraste mínimo de 4.5:1 para texto comum e foco visível em todos os controles.
- Informar o ambiente Homologação como texto, não apenas como cor.

## Keyboard

- Usar a ordem de foco visual: menu do usuário, navegação, Nova Instrução, pesquisa, Pesquisar, Limpar, controles das linhas e paginação.
- Permitir envio da pesquisa com Enter e limpeza por botão alcançável por teclado.
- Tornar alternadores, edição, exclusão e paginação acionáveis com teclado sem exigir interação de ponteiro.
- Conter foco no diálogo de exclusão e devolver o foco ao botão de exclusão da linha ao cancelar.

## Content

- Idioma observado: português do Brasil.
- Título observado: Instruções de Montagem de MPV.
- Rótulos observados: Instruções, Homologação, Nova Instrução, Pesquisar, Limpar, Ativo, Editar e Excluir.
- Colunas observadas: Código de MPV, Descrição de MPV, URL, Ativo, Editar e Excluir.
- Mostrar intervalo e total no padrão observado, por exemplo 21 a 40 de 192 registros.
- Preferir verbos diretos e mensagens de erro que expliquem recuperação sem expor detalhes técnicos.

## Visual direction

- Preservar a identidade predominantemente branca e azul, com azul médio na barra principal e azul escuro no item ativo.
- Usar hierarquia compacta de aplicação administrativa com título azul escuro, bordas cinza claras e controles de altura reduzida.
- Preservar alta densidade no desktop e linhas alternadas em branco e cinza muito claro para apoiar varredura horizontal.
- Alinhar código, descrição e URL à esquerda; centralizar alternador e ações nas respectivas colunas.
- Usar ícones simples de adição, edição, exclusão e setas acompanhados por texto ou nomes acessíveis.
- Não depender de cor para comunicar aba ativa, página atual, estado do alternador ou erros.

## Assumptions

- A aba Instruções representa o item ativo da navegação principal.
- O campo de pesquisa aceita um termo livre aplicado ao código e à descrição da instrução após o envio do formulário.
- Os ícones de lápis e lixeira representam respectivamente edição e exclusão da linha.
- O controle na coluna Ativo salva imediatamente, anuncia o resultado e restaura o valor anterior em caso de falha.
- A exclusão exige confirmação explícita e arquiva o registro para permitir recuperação administrativa.
- A rota canônica da listagem será /instrucoes até que a rota real seja confirmada.
- A interface e seus anúncios acessíveis usam português do Brasil.
- A consulta permanece pública; ações de manutenção dependem das permissões validadas da sessão.

## Open questions

- None.

## Conflicts

- None.

## Recommended decisions

- None.
