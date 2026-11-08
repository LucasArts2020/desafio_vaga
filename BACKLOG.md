# Backlog e plano de entregas

[Matriz de rastreabilidade](MATRIZ-RASTREABILIDADE.md) · [Arquitetura e contratos](ARCHITECTURE.md) · [Enunciado](README.md)

**Prioridades.** P0 desbloqueia a primeira compra funcional ou reduz risco eliminatório. P1 completa o escopo obrigatório. P2 reúne auditoria e entrega pública, também obrigatórias. Cada tarefa lista dependências diretas. E01–E12 seguem o §9 do README.

| ID | Ciclo | Prioridade | Dependências | Tarefa e critérios de aceitação | Estado |
| --- | --- | --- | --- | --- | --- |
| T00 | 0 | P0 | README | Ler §§1–12, rastrear os requisitos até tarefas verificáveis e registrar arquitetura, contratos, mocks e evidências esperadas. | Concluída após verificação documental |
| T01 | 1 | P0 | T00 | Criar base Vite/React/TS, providers TanStack, Axios, Tailwind e uma primitiva shadcn/ui. Instalação com lockfile, start, build, preview, typecheck e lint passam. Router resolve rota direta e not found. MSW inicia por configuração antes das requests. | Concluída |
| T02 | 1 | P0 | T00. T02b depende de T01 | **T02a · Referência visual.** Inventariar as telas da exportação, identificar campos/filtros e registrar limitações, critérios de comparação e estratégia para mobile e assets. **T02b · Transporte.** Fixar versões compatíveis e demonstrar handshake, evento público/privado e reconexão em Chromium, inclusive no preview. | T02a concluída com a exportação disponível. T02b concluída em dev e preview |
| T03 | 1 | P0 | T01 | Tipar contratos iniciais e montar repositório transacional, duas contas fictícias, catálogo paginável, cenários e reset. Um teste verifica persistência após refresh, reset integral e transporte Axios/MSW. Testar parsing e cálculo de ETH em wei. | Concluída em dev e preview |
| T04 | 2 | P0 | T03 | Entregar catálogo/detalhe básicos e carrinho de visitante. Provar URL normalizada, acesso direto, erro de detalhe, quantidade por edição, refresh e transporte real. Executar núcleo de E01/E02/E05. | Concluída em dev e preview |
| T05 | 2 | P0 | T03–T04 | Entregar cadastro/login/logout, proteção do checkout e merge atômico. Provar retorno ao checkout, persistência da sessão, login repetido sem duplicar merge, expiração, 401/403 e isolamento entre A e B. Executar E03 e parte autenticada de E05. | Concluída em dev e preview |
| T06 | 2 | P0 | T04–T05 | Cotação REST com desconto, rede, taxa, validade e revisão. Exercitar cupons inválido/expirado, edição esgotada, recotação e centésimos/subfrações de ETH. Mudanças entre cotação e compra exigem novo aceite, em conjunto com T07. | Concluída em dev e preview para a revisão. Revalidação no envio fica em T07 |
| T07 | 2 | P0 | T05–T06 | Concluir primeiro caminho funcional catálogo → detalhe → carrinho → login → checkout → pedido → recibo. Usar carteira cadastrada nas fixtures, rede e conexão simulada. Confirmar somente a partir da API. Demonstrar revisão, status pendente/confirmado e snapshot imutável. E06 em Chromium desktop/mobile. | Pendente |
| T08 | 3 | P0 | T07 | Completar recuperação por chave e pedido pendente, inclusive envio concorrente, payload diferente com mesma chave, timeout pós-commit, refresh antes da resposta e sessão expirada. Provar recusa preservando carrinho, confirmação descontando apenas o comprado e terminais imutáveis. Executar E03/E07 e a recuperação REST de E10. | Pendente |
| T09 | 4 | P1 | T04, T06 | Completar filtros, destaques, galeria, regras de combinação, ordem/paginação, estados de vazio/erro/background e skeletons. Vincular “Carregar mais” à página na URL e restaurar resultados no histórico. Completar E01/E02/E05/E12, inclusive latência variável e resposta fora de ordem. | Pendente |
| T10 | 4 | P1 | T05 | Favoritos com rollback, perfil, avatar e senha. Refresh mantém alterações, erro por campo é associado, cache privado é limpo na troca de identidade. Executar E04 e parte de conta de E08. | Pendente |
| T11 | 4 | P1 | T07, T10 | Entregar carteiras principal/secundária, seleção de rede e conexão/recusa/desconexão. Usar os campos observados na exportação desktop. Validar formulários e erros de API e terminar E08. | Pendente |
| T12 | 4 | P1 | T02b, T08 | Integrar eventos Socket.IO à mesma base REST. Provar carrinho recotado e revisão bloqueada após mudança, eventos fora de ordem/duplicados, desconexão, pendência recuperada e isolamento da sessão anterior. Executar E09/E10 com cliente real. | Pendente |
| T13 | 5 | P1 | T02a, T09–T12 | Comparar as nove telas desktop à exportação em 1440 px. Validar tablet e mobile em 768 e 390 px e registrar decisões para telas sem exportação. Verificar teclado, foco, contraste, zoom e movimento reduzido. Usar assets e fontes locais e registrar substituições. Executar E11/E12 e revisar baselines das quatro telas obrigatórias. | Pendente |
| T14 | 5 | P1 | T08–T13 | Executar E01–E12 com fixtures independentes, relógio e eventos determinísticos. Versionar baselines e disponibilizar relatório HTML e traces em falha. Atualizar setup, credenciais, cenários e reset na documentação da solução. | Pendente |
| T15 | 6 | P2 | T13–T14 | Auditar início/detalhe em desktop/mobile com três rodadas cada, no build otimizado com cenário padrão e mídia real. Entregar configuração e HTML/JSON, medianas, LCP/CLS/TBT, versões, ambiente e justificativas de desvios às metas. | Pendente |
| T16 | 6 | P2 | T14–T15 | Reproduzir comandos a partir de checkout limpo. Publicar commit validado com mock worker e fallback SPA. Comprovar rota direta, refresh, compra e evento via URL pública. Entregar URLs do repositório e da aplicação. | Pendente |

## Pontos de integração

| Ciclo | Entrega verificável |
| --- | --- |
| 0 | Matriz, proposta de arquitetura, contratos e backlog. |
| 1 | SPA abre em dev e preview, com contratos, primeira fixture, reset e prova de transporte verificáveis. |
| 2 | Primeira compra confirmada com recibo e dados servidos por MSW. UI funcional a partir dos contratos e da referência desktop do PNG. |
| 3 | Mesmo caminho de compra suporta expiração, recusa, refresh, timeout e concorrência sem duplicar. |
| 4 | Descoberta e conta completas, com eventos de mudança e recuperação após desconexão. |
| 5 | UI responsiva, regressão visual versionada e suíte E2E completa. |
| 6 | Auditoria reproduzível e build de demonstração publicado. |

Integrar em fatias menores que o ciclo. Cada integração roda build, tipos, lint e os testes aplicáveis à área alterada, mantendo o smoke da fatia já entregue. Mudança de contrato atualiza DTOs, handlers e consumidores na mesma entrega. Atualizar status de tarefa somente após confrontar seus critérios com os resultados.

## Registro do ciclo 0

- **Concluída.** T00. Leitura integral das 12 seções do README, com 20 requisitos rastreados, arquitetura inicial e critérios para T01–T16.
- **Pendências e dependências.** T02b depende do preview de T01. A comparação do build e a validação responsiva ficam em T13. A publicação depende de um repositório remoto e ambiente autorizado.
- **Problemas.** O Figma MCP informou ausência de permissão de edição. A exportação cobre desktop. A arquitetura registra os limites de fidelidade e como validar as adaptações.
- **Verificações e testes.** Conferência das referências entre matriz e backlog, cobertura dos 12 cenários E2E e das 12 seções do README. Testes de aplicação não aplicáveis a este ciclo de documentação.
- **Próxima tarefa recomendada.** T01 para estabelecer a base executável. Em seguida, T02b para validar cedo a combinação MSW/Socket.IO.

### Atualização da referência visual

- **Concluída.** T02a. Inspeção da [exportação local](DEV%20FRONT.png) e inventário das nove telas desktop na arquitetura, com campos dos formulários, paginação, estratégia de assets e critérios para a validação mobile.
- **Limitação registrada.** O usuário confirmou que o Dev Mode está indisponível. A comparação com frames mobile poderá ser acrescentada caso haja exportações.
- **Verificação.** Inspeção visual do PNG de 4600 × 5331 px e conferência dos links e das nove telas contra o README.

## Registro do ciclo 1 · Entrega T01

- **Concluída.** T01. A rota técnica `/integracao` consulta `GET /api/v1/status` via TanStack Query e Axios, recebe a resposta do handler MSW e permite nova consulta pelo botão shadcn/ui. O Router resolve acesso direto, refresh e rota desconhecida. Com mocks desativados, o Chromium confirmou ausência de registro do worker e exibição de erro da API.
- **Testes executados.** `npm ci`, `npm run typecheck`, `npm run lint` e `npm run build` passaram. Playwright em Chromium executou quatro casos em dev e quatro no preview, divididos entre desktop e mobile, todos aprovados. Relatórios gerados em `playwright-report/dev` e `playwright-report/preview`.
- **Problemas identificados.** A configuração inicial usava a opção de tratamento de requisição da API anterior do MSW. A configuração foi adaptada ao MSW 3, com fallback restrito a `/api/v1/*`. A auditoria apontou uma versão transitiva de `minimatch` na cadeia do lint. O lockfile fixa a versão corrigida por override e o `npm ci` final reportou zero vulnerabilidades.
- **Pendências.** T02b e T03 já podem avançar. A rota técnica serve à validação da infraestrutura. Os fluxos de catálogo, carrinho e sessão começam a partir de T04.
- **Próxima tarefa recomendada.** T02b para verificar handshake, eventos públicos e privados e reconexão pelo Socket.IO com MSW em Chromium, incluindo o preview.

## Registro do ciclo 1 · Entrega T02b

- **Concluída.** T02b. O diagnóstico em `/integracao` provou handshake por WebSocket, evento público para visitante, evento privado vinculado à credencial emitida via REST, heartbeat e reconexão com novo identificador de transporte e nova inscrição. Ao trocar para visitante, a conexão anterior é descartada.
- **Testes executados.** `npm ci` com o lockfile em diretório isolado, lint e build com checagem de tipos passaram. O Playwright passou oito testes em dev e oito no preview, incluindo Chromium desktop/mobile e regressão REST. Relatórios em `playwright-report/dev` e `playwright-report/preview`.
- **Problemas identificados.** O binding publicado exige MSW 2. O lockfile fixa MSW 2.15.0, binding 0.2.0 e Socket.IO 4.8.4. A primeira rodada detectou que o MSW normaliza o caminho de transporte para o namespace ao procurar o handler. O handler foi corrigido e o mock acrescentou o heartbeat ausente no binding.
- **Pendências.** T03 para modelos iniciais, persistência, fixtures, reset e precisão em wei. T05 integra a sessão do marketplace. T12 implementa `nft.updated`, `order.updated` e reconciliação com REST.
- **Próxima tarefa recomendada.** T03 para viabilizar as primeiras operações de catálogo e carrinho com estado de mock persistente.

## Registro do ciclo 1 · Entrega T03

- **Concluída.** T03. O painel em `/integracao` consulta o catálogo paginado via Query, Axios e MSW. A seed em IndexedDB contém nove obras, duas contas fictícias com hashes e os cenários padrão e vazio. O reset restaura a seed em uma transação e encerra as conexões do diagnóstico na aba. Preços são strings decimais, com parsing, cálculo e ordenação em wei.
- **Testes executados.** Tipos, lint, build e quatro testes unitários passaram. O Playwright aprovou 12 casos em dev e 12 no preview, em Chromium desktop e mobile. Os casos novos cobriram persistência após refresh, reset com sessão de diagnóstico ativa, filtros combinados, preços com diferença de um wei e erros 400/404. Uma checagem adicional confirmou os hashes das duas contas e a independência de cada nova seed.
- **Problema identificado.** A inferência do MSW escolhia apenas o tipo do erro em handlers com respostas de sucesso e erro. Os handlers declaram a união de resposta para preservar a tipagem nas duas situações.
- **Pendências.** T04 consome os contratos na navegação pública. T05 integra as contas fictícias ao login. Outros cenários de falha e as mídias de apresentação entram nas entregas previstas.
- **Próxima tarefa recomendada.** T04 para montar início, detalhe por URL e carrinho persistente de visitante.

## Registro do ciclo 2 · Entrega T04

- **Concluída.** T04. Início com busca, categoria, rede, ordenação e página na URL. Detalhe direto com estados de obra inexistente, edição esgotada e limite por edição. Carrinho de visitante com adição, alteração, remoção e subtotal retornado pela API simulada. Refresh mantém as linhas e a credencial da aba.
- **Testes executados.** Build com checagem de tipos, lint e quatro testes unitários passaram. O Playwright aprovou 22 casos em dev e 22 no preview, em Chromium desktop e mobile. Os novos cenários cobrem o núcleo de E01/E02/E05, conflito entre escritas, acesso sem credencial e migração IndexedDB preservando o cenário. Também conferi início em 1440 px, carrinho vazio em 768 px e detalhe em 390 px, com imagens disponíveis e sem overflow horizontal nesses estados.
- **Problemas identificados.** A primeira execução do teste de carrinho parou no seletor da edição. O teste passou a localizar o combobox pelo papel e nome acessíveis. A falta das obras originais foi tratada com três ilustrações SVG locais, registradas na arquitetura. O catálogo usa navegação anterior/próxima nesta fatia.
- **Pendências.** T05 integra cadastro, login, logout, expiração e merge do carrinho. T06 entrega cupons e cotação. T09 entrega o carregamento cumulativo e o restante dos cenários de descoberta.
- **Próxima tarefa recomendada.** T05 para proteger o checkout e incorporar o carrinho de visitante à conta autenticada.

## Registro do ciclo 2 · Entrega T05

- **Concluída.** T05. Cadastro, login e logout usam a API simulada. O Router protege a revisão do checkout e retoma a rota após autenticar. O carrinho é incorporado uma única vez, respeita a quantidade existente na conta e permanece isolado entre titulares. A sessão expirada limpa o cache e permite retomar a revisão da própria conta.
- **Testes executados.** Build, tipos, lint e quatro testes unitários passaram. O Playwright aprovou 32 casos em dev e 32 no preview, em Chromium desktop e mobile. Os novos testes cobrem credencial inválida, conflito de e-mail, repetição do merge, 401 após logout, 403 por tentativa de reaproveitar carrinho de outra conta, expiração na revisão, retorno interno e migração do carrinho da versão 2. Conferi as telas de autenticação nas larguras 390, 768 e 1440 px sem overflow horizontal nos estados observados.
- **Problemas identificados.** A checagem inicial apontou tipos de resposta ambíguos nos handlers e parâmetros de retorno com opcionais inferidos como obrigatórios. Os contratos e os tipos de rota foram explicitados antes das rodadas finais.
- **Pendências.** T06 adiciona cupons, taxa de rede, cotação e revisão de valores. T07 completa o envio do pedido e a confirmação. As inscrições Socket.IO da conta entram em T12.
- **Próxima tarefa recomendada.** T06 para integrar o subtotal do carrinho à cotação da API e validar cupons.

## Registro do ciclo 2 · Entrega T06

- **Concluída.** T06. Carrinho e checkout usam subtotal, desconto, taxa de rede e total da cotação REST. Aplicação e remoção de cupom são versionadas. A revisão da cotação exige titular, validade e correspondência com o estado atual do carrinho e do catálogo.
- **Testes executados.** Build, tipos, lint e quatro testes unitários passaram. Playwright aprovou 40 casos em dev e 40 no preview, em Chromium desktop e mobile. Os novos casos cobrem cupom inválido e expirado, aplicação/remoção, refresh e login, troca de rede, recotação por diferença de um wei, estoque esgotado, cotação vencida, cotação de outra conta e migração de sessão e carrinho. Conferi o checkout com cupom em 390, 768 e 1440 px.
- **Problema identificado.** Uma mudança no catálogo pode invalidar a cotação sem alterar a versão do carrinho. A API compara o snapshot completo no aceite e responde com 409 se a cotação estiver desatualizada.
- **Pendências.** T07 usa a cotação revisada para criar o pedido após nova revalidação e integrar a carteira de teste. T12 entrega as atualizações de catálogo e pedido por Socket.IO.
- **Próxima tarefa recomendada.** T07 para completar o primeiro fluxo até o recibo confirmado pela API simulada.

## Registro do ciclo 2 · Integração OpenSea

- **Concluída.** Descoberta ao vivo em `/opensea` com coleção Doodles por padrão, detalhe direto, cursor, mídia e links originais. A credencial entra por variável de servidor, e o proxy restringe a consulta à coleção configurada. A descoberta do desafio e a compra de demonstração usam as fixtures do Acervo.
- **Testes executados.** O Chromium consultou a OpenSea real em dev e preview, com 12 NFTs na primeira página, cursor, imagem e detalhe após refresh. O bundle e as requisições do navegador foram inspecionados para confirmar que a credencial ficou no servidor. Build, lint, sete testes unitários e 40 testes Playwright em cada ambiente passaram.
- **Problema identificado.** O Vite avisou que imports sem extensão na configuração seriam incompatíveis com o carregador nativo futuro. Os imports do servidor agora usam extensão explícita.
- **Pendências.** A função da Vercel tem o adaptador implementado. O deploy e a validação pública seguem em T16. A próxima tarefa do fluxo de compra é T07.

## Registro do ciclo de redesign · Entrega RD01–RD03

- **Concluídas.** RD01–RD03. O [plano de redesign](REDESIGN.md) registra diagnóstico, decisões, contratos, dependências e riscos. Cabeçalho e homepage foram integrados ao Router, ao catálogo e ao carrinho existentes. O ranking responde via REST e MSW e identifica as métricas simuladas.
- **Testes executados.** `npm ci` em diretório isolado, lint, build com checagem de tipos e sete testes unitários passaram. Playwright aprovou 44 casos em desenvolvimento e 44 no preview, em Chromium desktop e mobile. A inspeção da homepage cobriu 390, 768 e 1440 px sem overflow horizontal.
- **Problemas identificados.** A nova faixa de categorias tornou ambíguo o seletor de um teste, corrigido com papel e nome acessíveis. O build passou a carregar páginas sob demanda para reduzir o chunk de entrada. Uma execução concorrente removeu artefatos do Playwright durante o encerramento de um teste. A repetição do preview com diretório de saída isolado passou por completo.
- **Pendências.** RD04 reúne filtros de preço, Sheet mobile, paginação cumulativa, galeria e favoritos. T07–T08 destravam os eventos de pedido da T12. Baselines visuais, Lighthouse e deploy seguem em T14–T16.
- **Próxima tarefa recomendada.** T07, que depende de T05–T06, para ligar a cotação revisada ao pedido idempotente e ao recibo confirmado pela API simulada.

## Registro do ciclo · Migração da descoberta OpenSea

- **Concluídas.** LIVE01–LIVE03 do [plano de redesign](REDESIGN.md). O modo padrão usa a OpenSea para coleção, NFTs, busca, ranking e anúncios ativos. O modo demo mantém os contratos privados do Acervo e o MSW, com comandos próprios.
- **Testes executados.** Os builds padrão e demo, lint e nove testes unitários passaram. Playwright aprovou 44 casos da demo em dev e 44 no preview. O Chromium exercitou a API real em desktop e mobile e confirmou que o modo padrão consulta o proxy sem iniciar MSW. O detalhe foi verificado com e sem anúncio ativo.
- **Problemas identificados.** A OpenSea retorna volume e piso em moedas que podem diferir. O adapter preserva a moeda de cada campo e converte o preço atômico do anúncio sem perda de precisão. Um teste da demo aguardava um clique que podia perder a corrida para o redirecionamento de sessão expirada. O teste passou a recarregar a rota protegida para verificar a mesma revalidação de forma determinística.
- **Pendências.** A descoberta ao vivo requer `OPENSEA_API_KEY` no ambiente do servidor. Conta, carrinho, cotação e Socket.IO do Acervo seguem no modo demo. Serviços privados reais dependeriam de um backend do Acervo. O checkout do desafio não envolve transação on-chain.
- **Próxima tarefa recomendada.** T07 segue disponível no modo demo e depende dos contratos de sessão e cotação de T05–T06.

## Registro do ciclo · Carrinho com catálogo OpenSea

- **Concluídas.** LIVE04–LIVE05. Cards e detalhe exibem nome, preço quando disponível e descrição breve. Carrinho, conta, cupom e revisão voltaram ao modo padrão com o catálogo ao vivo.
- **Problema identificado.** A listagem geral de NFTs da OpenSea não inclui preço por item. O catálogo inicia em **À venda**, que cruza os anúncios ativos com os metadados consultados em lote. A opção **Todos os NFTs** preserva a listagem geral.
- **Testes executados.** Build padrão e demo, lint e 10 testes unitários passaram. Playwright aprovou 44 casos da demo em dev e 44 no preview. Em Chromium desktop e mobile, o fluxo com um anúncio real passou em dev e preview até a revisão do checkout, incluindo contador, refresh, cupom e login.
- **Pendências.** Anúncios em outras moedas podem ser consultados, mas o carrinho usa o contrato monetário em ETH. O carrinho armazena preço e quantidade observados na adição para a simulação. Pedido e recibo seguem em T07.
- **Próxima tarefa recomendada.** T07, dependente dos contratos T05–T06, para criar o pedido idempotente e apresentar o recibo simulado.

## Registro do ciclo · Destaque das coleções

- **Concluído.** O ranking ao vivo passou para o topo da home, sem moldura ou divisórias, com até dez coleções e vendas por período. O detalhe do NFT usa um link em texto para a OpenSea.
- **Validação.** A API real retornou dez coleções com métricas de volume e vendas. Chromium confirmou a tabela sem bordas ou overflow em 390, 768 e 1440 px, a troca de período por teclado e o detalhe com link de texto e botão do carrinho. Build, lint, 10 unitários e 44 Playwright em desenvolvimento passaram.
- **Limitação.** Quando a OpenSea limita uma consulta de estatísticas, a linha mantém sua posição e usa travessão nos campos indisponíveis.
- **Próxima tarefa.** T07 para pedido e recibo no checkout simulado.

## Acompanhamento no GitHub

As tarefas `T`, `RD` e `LIVE` estão nas [issues com a etiqueta `acervo-backlog`](https://github.com/LucasArts2020/desafio_vaga/issues?q=is%3Aissue+label%3Aacervo-backlog). A importação preserva os IDs, critérios de aceite, evidências e prioridades `P0`–`P2`. A [T07](https://github.com/LucasArts2020/desafio_vaga/issues/9) é a próxima entrega P0 do checkout. O vínculo ao GitHub Projects e a inclusão automática de novas issues com essa etiqueta dependem de acesso ao quadro.

## Registro do ciclo · Detalhe e carrinho em USDC.e

- **Concluído.** O botão de voltar usa shadcn/ui com seta Lucide e preserva coleção, busca ou paginação. A identificação da fonte aparece como **Dados da OpenSea**. O carrinho e a revisão simulada aceitam USDC.e na Polygon e exibem a taxa em ETH separadamente.
- **Problema identificado.** O anúncio Forretress da captura custava 8 USDC.e. A validação anterior aceitava apenas ETH, por isso a ação do carrinho ficava oculta.
- **Validação.** Chromium desktop e mobile verificaram retorno à coleção, inclusão do anúncio real, login, cupom, bloqueio na rede incompatível e revisão na Polygon. Com ACERVO5, o total do anúncio foi 7,6 USDC.e e a taxa simulada foi 0,0005 ETH. Build, lint, 10 unitários e 44 Playwright em desenvolvimento passaram.
- **Próxima tarefa.** T07 segue pendente. O pedido e o recibo devem preservar os totais de cada moeda da cotação revisada.

## Registro do ciclo · Catálogo geral

- **Concluído.** O catálogo ao vivo abre com até três NFTs de cada uma de até quatro coleções em alta por página. O banner de destaque e as páginas individuais de coleção continuam disponíveis.
- **Validação.** Build, lint e 11 unitários passaram. Chromium conferiu em 390 e 1440 px os dois filtros, a paginação e o retorno do detalhe ao catálogo geral. A primeira página retornou 12 NFTs de quatro coleções reais.
- **Próxima tarefa.** T07 para pedido e recibo no checkout simulado.
