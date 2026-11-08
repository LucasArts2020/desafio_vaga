# Redesign do Acervo

O usuário principal é o colecionador que compara obras, avalia coleções e monta uma seleção antes do checkout. A homepage dá acesso ao catálogo e ao ranking com densidade de marketplace. O [README](README.md) define o comportamento. A [arquitetura](ARCHITECTURE.md), a [matriz](MATRIZ-RASTREABILIDADE.md) e o [backlog original](BACKLOG.md) detalham contratos e critérios.

## 1. Diagnóstico

| Área | Já verificado | Trabalho restante |
| --- | --- | --- |
| Descoberta | Catálogo REST, busca e filtros básicos pela URL, ordenação, paginação e detalhe direto, com estados ausente e esgotado. | Redesenhar a home, completar filtros e paginação cumulativa, fortalecer a galeria e integrar favoritos. |
| Carrinho e conta | Carrinho de visitante e autenticado persistem. Merge idempotente, login, cadastro, logout, expiração e isolamento de cache foram testados. | Perfil, avatar, senha, carteiras e acabamento das telas. |
| Checkout | Rota protegida, cupom, rede, valores em wei e revisão revalidada via REST. | Carteira simulada, dados do colecionador, criação idempotente, pendência, recusa, recibo e recuperação. |
| Demo e live | Fixtures MSW e reset locais. O proxy da OpenSea foi exercitado em dev e preview, com chave no servidor e adapter tipado. | Integrar indicadores de origem ao novo layout. Métricas live entram conforme cobertura do provedor. |
| Tempo real | Handshake, heartbeat e reconexão do cliente Socket.IO exercitados pelo diagnóstico. | Entregar `nft.updated`, `order.updated`, deduplicação, isolamento de inscrições e reconciliação. |
| Qualidade | Build, lint, tipos, sete testes unitários e 40 Playwright em cada ambiente na entrega anterior. | Baselines visuais, E2E de pedidos e tempo real de negócio, Lighthouse e deploy. |

O [PNG do Figma](DEV%20FRONT.png) orienta cor, composição e marca. O Dev Mode está indisponível. O anexo contém o briefing em texto e a pasta do projeto contém a exportação do Figma. A direção de navegação, destaques e ranking usa as referências públicas da [OpenSea](https://opensea.io/) e da [OKX Wallet](https://web3.okx.com/nft).

## 2. Design system e componentes

| Camada | Tokens ou componentes | Aplicação e critérios |
| --- | --- | --- |
| Cores | Background `#0c0d0b`, superfícies `#141613` e `#1b1e18`, borda `#30352b`, texto `#f2f3ed`, secundário `#abb1a3`, lima `#c8f671`. | Contraste de texto e foco, divisórias discretas, sinal numérico em variações. |
| Semântica | Sucesso `#98e5ab`, alerta `#f1c77d`, erro `#f08879`. | Usar texto junto da cor para resultado, ação pendente e falha. |
| Medidas | Espaço em múltiplos de 4 px, ritmo principal de 8 px, raio de 8 px, leitura em 12/14/16 px e títulos de 24/32 px. | Header compacto, controles acionáveis em 44 px no mobile, dígitos tabulares nas métricas. |
| Fundação | Button, Input, Card, Badge, Table, Skeleton, Avatar, DropdownMenu e ícones Lucide. | Compartilhar primitivas em `src/components/ui`. Usar tokens e variantes para densidade e contraste. |
| Refinamento | Tabs, Select, Dialog, Sheet, Popover, Tooltip, Separator, ScrollArea, Form, Alert e Pagination. | Aplicar conforme fluxo. Sheet para filtros mobile, Dialog com foco controlado, Form e Alert para erros de API, Pagination para navegação no catálogo. |

## 3. Homepage

| Região | Direção |
| --- | --- |
| Header | Marca Acervo, início, atalhos para catálogo e coleções, busca global, contador do carrinho e menu de conta com ações existentes. Favoritos e carteiras aparecem quando seus fluxos estiverem disponíveis. |
| Categorias | Controles compactos sincronizados com a URL, com estado selecionado perceptível. |
| Destaques | Um banner horizontal com arte do catálogo, coleção, contexto, controles manuais e CTA que aplica o filtro da coleção. A navegação manual funciona por teclado e evita movimento automático. |
| Ranking | Tabela densa com posição, coleção, volume e variação, piso e variação, proprietários e total de NFTs. Períodos 1h, 6h, 24h, 7 dias e 30 dias. TanStack Table controla ordenação e visibilidade. |
| Catálogo | Cards compactos, busca, filtros combináveis e paginação compartilhável. Atalhos de ranking e banner abrem o recorte da coleção. |
| Responsividade | Grid de três colunas e tabela completa em 1440 px. Colunas essenciais em 768 px. Em 390 px, banner empilhado, tabela compacta e checkout em uma coluna. O Sheet de filtros entra no refinamento do catálogo. |

## 4. Arquitetura e contratos

- O layout compartilhado fica em `src/app`. Os componentes e consultas de descoberta ficam em `src/features/catalog`. Primitivas, variantes e ícones compõem o design system.
- O ranking usa `GET /api/v1/collections/rankings?period=24h`. O contrato inclui `source: 'demo'`, período e linhas com valor em ETH como string. O mock calcula o piso das edições disponíveis e o número de obras pela base do catálogo. Volume, variações e proprietários são fixtures declaradas como simuladas. A posição corresponde ao volume do período. Ordenar a visualização mantém essa posição como referência.
- `GET /api/v1/nfts` mantém o contrato de paginação e aceita `collection` junto com os demais filtros. Filtros válidos reiniciam a página. Valores monetários ficam em strings decimais até os cálculos em wei.
- Queries de descoberta usam chave por parâmetros e encaminham o `AbortSignal` ao Axios. Interações transitórias, como slide ativo e visibilidade de coluna, ficam locais. O estado do catálogo que precisa sobreviver à navegação fica no Router.

## 5. OpenSea e MSW

O modo demo abre em **Início** e usa a API simulada para descoberta, sessões, carrinho e compra. O modo live abre em **OpenSea** e usa `GET /api/opensea`. O servidor adapta coleção, listagem por cursor e detalhe por contrato e token. `OPENSEA_API_KEY` fica no ambiente do servidor. Cache de 60 segundos, timeout e tratamento explícito de HTTP 429 limitam o uso da API. O provider aparece como atribuição na área live. [OpenSea API](https://docs.opensea.io/reference/api-overview) · [API Keys](https://docs.opensea.io/reference/api-keys).

Métricas do ranking nesta entrega pertencem à demo. O live mostra metadados e links originais. Os testes do desafio usam somente os handlers e cenários locais.

## 6. Backlog de integração

| ID | Fase | Prioridade | Depende de | Critério de aceite |
| --- | --- | --- | --- | --- |
| RD01 | 1–2 | P0 | README e briefing | Auditoria, proposta da home, tokens, contratos e plano ligados ao backlog existente. |
| RD02 | 3 | P0 | RD01 | Header compacto, busca global e contador vindos das operações reais da demo. Foco e navegação por teclado verificáveis. |
| RD03 | 4 | P0 | RD02 | Homepage com categorias, banner navegável, ranking REST demo, períodos, ordenação e colunas. CTA aplica coleção à URL. |
| RD04 | 4–6 | P1 | RD03, T09–T10 | Preço na URL com precisão, filtros mobile em Sheet, paginação cumulativa, galeria e favoritos com rollback. |
| RD05 | 5 | P1 | RD03 | Identificar fonte live e demo e preservar o proxy OpenSea, paginação e comportamento sem credencial. |
| RD06 | 7–8 | P0 | T06 | T07/T08, perfil e carteiras nas entregas T10/T11. Aceite do checkout só segue de cotação válida. Recibo reflete confirmação da API. |
| RD07 | 9 | P0 | RD06, T02b | T12 com eventos de negócio, versão, reconexão e isolamento por sessão. |
| RD08 | 10 | P1 | RD04, RD06–RD07 | T13/T14 com três larguras, teclado, movimento reduzido e baselines Playwright. |
| RD09 | 11 | P2 | RD08 | T15/T16 com Lighthouse reproduzível, documentação e deploy público verificado. |

## 7. Riscos e mitigação

| Risco | Tratamento |
| --- | --- |
| Misturar métricas de fixtures e dados reais | Contratos e rotas distintos. Ranking rotulado como simulado e exclusão de indicadores live sem cobertura comprovada. |
| Alterar navegação e quebrar autenticação ou carrinho | Reutilizar hooks, guards e endpoints. Executar a suíte de conta e checkout após a entrega visual. |
| Ranking denso e cabeçalho em tela estreita | Priorizar coleção e piso no mobile. Validar 390, 768 e 1440 px, foco e leitura por teclado. |
| Falta de capturas de referência específicas e assets originais | Registrar a exportação disponível e os substitutos já usados. Comparar a identidade ao PNG e a organização às referências públicas. |
| Dependência da OpenSea e exposição de credencial | Proxy server-side, quota e mensagens controladas. Testes de regressão independentes do fornecedor. |
| Ordem de implementação adiar o fluxo principal | Entregar uma homepage integrável e retomar T07/T08 antes do acabamento das telas restantes. |

## 8. Evidências da primeira entrega

RD01, RD02 e RD03 foram concluídas nesta entrega. Os demais critérios e dependências seguem na seção 6.

- A homepage usa `Input`, `Card`, `Badge`, `Table`, `Skeleton`, `Avatar` e `DropdownMenu` do shadcn/ui com os tokens do Acervo. Os fluxos existentes continuam disponíveis no cabeçalho, e os atalhos de favoritos e carteira dependem das respectivas entregas.
- `tests/e2e/marketplace-home.spec.ts` verifica a navegação do carrossel por teclado, o filtro de coleção e a busca pela URL, o contador do carrinho, a resposta do ranking pelo Service Worker, a mudança de período e a ordenação e visibilidade de colunas.
- A inspeção da homepage em 390, 768 e 1440 px incluiu checagem de overflow horizontal. As capturas de inspeção servem à revisão do ciclo. As baselines versionadas ficam em RD08.
- A separação por rotas reduziu o chunk de entrada de 623,09 kB para 496,46 kB minificados. O chunk da homepage tem 65,66 kB e é solicitado ao abrir a rota. As medições Lighthouse continuam previstas em RD09.
- `npm ci` em diretório isolado, lint, build com checagem de tipos e sete testes unitários passaram. O Playwright aprovou 44 casos em desenvolvimento e 44 no preview, em Chromium desktop e mobile. Relatórios em `playwright-report/dev` e `playwright-report/preview-verified`.

## 9. Migração da descoberta antes de T07

| ID | Prioridade | Dependência | Critério de aceite |
| --- | --- | --- | --- |
| LIVE01 | P0 | Proxy OpenSea e chave de servidor | Adaptar coleção, NFTs, busca, ranking e melhor anúncio. Manter valores de anúncio exatos e tratar dados ausentes e falhas da API sem usar fixtures. |
| LIVE02 | P0 | LIVE01 | Usar a OpenSea na home padrão e nas rotas de descoberta. Mostrar origem e permitir busca, navegação por coleção e detalhe. |
| LIVE03 | P0 | LIVE02 | Manter modo demo explícito para o desafio. Validar o modo padrão sem MSW, com uma consulta real, e a suíte da demo separadamente. |

O proxy continua em `GET /api/opensea`. `collection` seleciona um slug e `cursor` navega a coleção. `contract` e `identifier` identificam o detalhe dentro do slug. `q` consulta a busca e `period` seleciona o ranking. Os dados públicos usam Query e Axios sem credenciais privadas do Acervo. A credencial da OpenSea permanece no servidor. O MSW continua disponível no modo demo para validar os fluxos exigidos pelo desafio.

Sessão, carrinho, cupom, cotação e os eventos Socket.IO do Acervo são responsabilidades da aplicação. A integração de descoberta é somente leitura. O endpoint de execução de anúncio da OpenSea prepara uma transação on-chain, fora do escopo do desafio. A tabela ao vivo apresenta os períodos de volume disponíveis e valores com a moeda original. Variações que a API não fornece ficam fora da tabela ao vivo. [Ranking](https://docs.opensea.io/reference/get_top_collections) · [Estatísticas](https://docs.opensea.io/reference/get_collection_stats) · [Execução de anúncio](https://docs.opensea.io/reference/generate_listing_fulfillment_data_v2).

LIVE01–LIVE03 foram concluídas para a descoberta pública. Em Chromium desktop e mobile, o preview com a credencial real carregou a home, o ranking, a busca e o detalhe sem registrar Service Worker ou consultar endpoints privados. A verificação incluiu paginação, troca do período, refresh e preço exato de um anúncio ativo. As builds padrão e demo, lint e nove testes unitários passaram. A suíte da demo aprovou 44 testes em dev e 44 em preview.

## 10. Compra simulada com catálogo ao vivo

| ID | Prioridade | Dependência | Critério de aceite |
| --- | --- | --- | --- |
| LIVE04 | P0 | LIVE01–LIVE03 | Simplificar cards e detalhe. Exibir nome, preço da API quando disponível e descrição breve. |
| LIVE05 | P0 | LIVE04, T05–T06 | Restaurar conta, carrinho, cupom e revisão no modo padrão. Ao adicionar, a operação REST aceita somente a referência do NFT e consulta o anúncio ao vivo. A seleção mantém o preço ETH observado, isolado por carrinho. |

O MSW intercepta somente os contratos de comércio do Acervo no modo padrão. A consulta `/api/opensea` continua passando pelo servidor. O checkout é simulado e usa snapshots de anúncios em ETH, compatíveis com o contrato monetário existente.

LIVE04 e LIVE05 foram concluídas. A exibição padrão **À venda** mostra preços retornados pela OpenSea. **Todos os NFTs** mantém a navegação da coleção, com consulta de preço no detalhe. Chromium desktop e mobile confirmaram adição, contador, persistência após refresh, cupom, login e revisão com um NFT real em dev e preview. Builds, lint, 10 unitários e 44 Playwright da demo em cada ambiente passaram.
