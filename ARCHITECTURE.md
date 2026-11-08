# Arquitetura proposta

**Ciclo 0 · proposta para implementação.** A referência de comportamento é o [README](README.md). IDs de requisitos e sequência de entregas constam na [matriz](MATRIZ-RASTREABILIDADE.md) e no [backlog](BACKLOG.md).

O [plano de redesign](REDESIGN.md) detalha os tokens da interface, os componentes e o contrato adicional do ranking.

## Limites e decisões

| Decisão | Proposta | Motivo e validação |
| --- | --- | --- |
| D01 | SPA React + TypeScript em Vite, com TanStack Router, TanStack Query, Axios, Tailwind CSS e shadcn/ui. | Vite é escolha de build. Usar shadcn/ui em primitivas interativas e Tailwind para aplicar tokens estimados a partir da exportação desktop. Fixar versões e lockfile em T01/T02. |
| D02 | Contratos e invariantes compartilhados. UI → Router/Query → cliente Axios → REST. Runtime separado para `socket.io-client`. | Componentes e hooks consomem apenas operações de aplicação. O Axios serializa, anexa credenciais e normaliza erros. Respostas e regras simuladas ficam exclusivamente na camada de mocks. |
| D03 | MSW com domínio simulado e repositório IndexedDB versionado. Fixtures, relógio e controlador de cenários compartilhados entre dev, demo e Playwright. | Manter estoque, carrinho, sessão, cotação, pedidos, reservas e idempotência consistentes após refresh. Usar transações IndexedDB para escritas que precisam confirmar juntas, inclusive concorrentes no mesmo perfil. |
| D04 | Socket.IO real no cliente, com WebSocket interceptado por MSW e binding compatível. REST reconcilia o estado após interrupção. | Validar cedo com prova de handshake, mensagem e reconexão em Chromium no build de demonstração. [Binding oficial](https://github.com/mswjs/socket.io-binding) · [Opções do Socket.IO](https://socket.io/docs/v4/client-options/#transports). |
| D05 | ETH como string decimal no JSON e inteiro `bigint` em wei no domínio. | Cálculo e formatação sem conversão para `number`. Política de arredondamento única e testável. |
| D06 | Vercel como alvo inicial da SPA, com HTTPS, fallback de rotas e worker na origem. | Confirmar o ambiente autorizado em T16. Servir assets e `mockServiceWorker.js` como arquivos antes do fallback de HTML. |
| D07 | Descoberta ao vivo opcional da OpenSea em rotas separadas. | Preservar a reprodução do desafio com fixtures. Ler metadados reais por um proxy que mantém a chave no servidor. |

Organizar bootstrap, router e providers em `src/app`. Usar `src/features` para catálogo, carrinho, checkout e conta, `src/contracts` para DTOs e validação de fronteira, `src/lib` para transporte e formatação, `src/mocks` para handlers, estado, fixtures, relógio e emissor, e `tests/e2e` para cenários Playwright e baselines.

### Rotas propostas

| Rota | Acesso e comportamento |
| --- | --- |
| `/`, `/nfts/$nftId` | Públicas. Catálogo controla pesquisa e paginação pela URL. Detalhe diferencia carregamento, 404 de NFT e indisponibilidade de edição. |
| `/carrinho` | Visitante ou autenticado, conforme identidade ativa. |
| `/checkout` | Autenticado. Identifica tentativa em aberto do usuário e recupera revisão quando cabível. |
| `/pedidos/$orderId`, `/pedidos/$orderId/confirmacao` | Titular. A primeira exibe processamento/recusa. A segunda exige snapshot confirmado retornado pela API, encaminhando outros estados para o status. |
| `/login`, `/cadastro` | Públicas. `returnTo` validado como caminho interno da SPA. |
| `/perfil`, `/carteiras` | Titular autenticado. |
| Qualquer rota ausente | Not found do Router com caminho de volta ao início. |

Favoritar sem sessão encaminha ao login com retorno ao detalhe. Links externos usam destinos identificados e ações auxiliares sem implementação aparecem com indicação coerente de indisponibilidade. A seleção de edição e quantidade começa no estado da tela.

## Modelos e invariantes

| Modelo | Campos centrais e regras |
| --- | --- |
| `Nft` e `Edition` | ID estável, metadados, mídia com alt, edição, preço ETH, disponibilidade e `version` monotônica do NFT. Destaques e paginação vêm do catálogo REST. |
| `Account`, `Profile`, `Session` | Usuário com ID estável e e-mail normalizado único. Perfil com nome completo, nome público, e-mail, bio e referência de avatar. Sessão com token opaco, expiração e revogação. Armazenar hash com salt na simulação e limitar avatar em tipo/tamanho. |
| `Wallet`, `WalletConnection` | Carteira pertence ao usuário, tem ID, endereço fictício validado, rótulo, rede e slot `primary\|secondary`. Conexão simulada vincula titular, sessão, carteira, rede e expiração. Recusa e desconexão são observáveis e a API verifica conexão válida antes de aceitar pedido. |
| `Cart`, `CartLine` | Escopo de usuário ou visitante. Carrinho versionado, cupom opcional, linhas identificadas por `nftId + editionId`, quantidade inteira positiva. Escritas validam versão e disponibilidade. |
| `Quote` | `quoteId`, versão do carrinho, linhas elegíveis, preços unitários, quantidades, versões de NFTs, cupom aplicado, rede, subtotal, desconto, taxa, total e expiração. Vinculada ao carrinho e à identidade. A cotação com itens inválidos informa os problemas e não é elegível para pedido. |
| `OrderAttempt` | Escopo do usuário, chave e resultado persistido. Tentativa aceita guarda hash do corpo canônico e `orderId`. Tentativa encerrada sem pedido guarda uma marca de cancelamento. O payload é congelado após confirmação explícita. O hash considera todos os campos de negócio do envio. |
| `Order` e `Receipt` | ID, status, versão, instante, titular e snapshot imutável da cotação e dos dados pertinentes à compra. Estados `pending → confirmed` ou `pending → declined`. Referência e URL simuladas de exploração são geradas para pedido confirmado. |

O DTO de ETH aceita ponto decimal e até 18 casas, sem expoente ou sinal. O mock calcula subtotal pela soma de preço × quantidade, desconto limitado ao subtotal, e total por subtotal menos desconto mais taxa. Arredondar desconto percentual para baixo ao wei e preservar casas significativas na formatação. Preços e taxas enviados ao cliente vêm da API. Ordenação por preço usa comparação em wei, com desempate estável por ID.

### Sessão e carrinho

- Guardar o token fictício em `sessionStorage`, suficiente para refresh na mesma aba, e validar em `GET /session` antes de entrar em área privada. Guardar um identificador opaco do carrinho de visitante no mesmo escopo. Os dados duráveis e suas autorizações ficam no mock, com validação por credencial em todo acesso privado. Senha em texto só transita no formulário e no corpo da requisição de credencial fictícia.
- Tratar 401 de credencial expirada uma única vez por geração da sessão. Em logout, expiração ou troca de conta, cancelar leituras privadas, remover suas queries e mutations em cache, invalidar callbacks tardios pela geração e fechar o socket anterior. Revogar credencial no logout aceito pela API. Se o transporte falhar, encerrar acesso local imediatamente e informar o estado da revogação. Limpar campos privados da UI ao trocar de conta. Respostas com 401 de uma geração antiga não encerram a sessão atual.
- Login ou cadastro incorpora o carrinho de visitante de forma atômica e idempotente no mock. Para linhas iguais, somar até o limite disponível, preservando a quantidade já existente da conta e informando reduções, itens indisponíveis e conflitos de cupom. Consumir o identificador de visitante da origem apenas na transação concluída. Um retry do merge retorna o mesmo resultado ao mesmo titular. O carrinho privado não se torna carrinho de visitante no logout.
- Em expiração, guardar a rota interna e recuperar carrinho, tentativa e pedido pelo titular após autenticação. Valores privados não entram na URL. Dados não sensíveis da revisão podem ser reconstruídos do perfil e do carrinho, com reconexão da carteira e nova cotação quando necessário. Nunca restaurar rascunho, chave ou tentativa do usuário anterior para uma conta diferente.

## Contratos REST v1

Prefixo `/api/v1`. DTOs em JSON, salvo upload de avatar. Bearer opaco para operações privadas e `X-Guest-Cart` para carrinho/cotação de visitante. Em operação autenticada, a identidade do token é a autoridade. `userId` do cliente não define o titular. `version` é inteiro monotônico por recurso. Datas trafegam em ISO 8601 UTC.

| Método e recurso | Entrada principal | Sucesso |
| --- | --- | --- |
| `POST /auth/register` | Nome completo, e-mail, senha, aceite e ID visitante opcional. Conferir confirmação de senha no formulário. | 201, sessão, usuário e resultado do merge. |
| `POST /auth/login` | E-mail, senha e ID visitante opcional. | 200, sessão, usuário e resultado do merge. |
| `GET /session`, `DELETE /session` | Credencial da sessão. | 200 com usuário e expiração, ou 204 na revogação. Expiração retorna 401. |
| `GET /nfts` | `q` busca por obra, artista ou coleção. Filtros de categoria, rede e preço, ordem, página e tamanho. Derivar opções dos controles visíveis no PNG e das fixtures. | 200, `items`, destaques, total, página e tamanho. Arrays de filtro são normalizados antes de montar URL e query key. |
| `GET /nfts/{nftId}` | ID. | 200, NFT com mídia e edições. |
| `GET /favorites`, `PUT /favorites/{nftId}`, `DELETE /favorites/{nftId}` | Sessão e ID quando aplicável. | 200 com estado/lista ou 204 ao remover. Inclusão e remoção repetidas têm o mesmo efeito. |
| `POST /carts/guest` | Sem identidade. | 201, credencial opaca e carrinho vazio. Criar sob demanda ao iniciar o carrinho. |
| `GET /cart` | Identidade ativa. | 200, carrinho versionado. |
| `POST /cart/items` | NFT, edição, quantidade a adicionar, versão esperada. | 200, carrinho atualizado. |
| `PATCH /cart/items/{lineId}`, `DELETE /cart/items/{lineId}` | Quantidade absoluta no PATCH e versão esperada em ambos. | 200, carrinho atualizado. |
| `PUT /cart/coupon`, `DELETE /cart/coupon` | Código no PUT e versão esperada. | 200, carrinho atualizado após validação do código. |
| `POST /quotes` | Versão do carrinho e rede. Recurso calculado, sem mutation de carrinho. | 200, cotação com totais, validade e problemas por linha/cupom, se houver. |
| `POST /quotes/{quoteId}/review` | ID da cotação e sessão do titular. | 200 com ID e data da revisão, ou 409 se preço, estoque, cupom, taxa ou validade impedirem o aceite. |
| `POST /orders` | `Idempotency-Key`, `quoteId`, nome completo e e-mail de confirmação do colecionador, aceite, `walletConnectionId` e rede. | 201, pedido criado. 200 com o mesmo pedido no replay da tentativa. |
| `GET /orders/attempts/{key}`, `GET /orders?status=pending` | Sessão e chave/filtro. | 200, pedido da tentativa ou lista de pendentes do titular. |
| `PUT /orders/attempts/{key}/resolution` | Sessão e chave cuja resposta se perdeu e cujo corpo original deixou de estar disponível. | 200, pedido já criado ou tentativa encerrada. O encerramento grava uma marca que impede criação posterior com a mesma chave. |
| `GET /orders/{orderId}`, `GET /orders/{orderId}/receipt` | Sessão e ID. | 200, estado atual ou snapshot do recibo confirmado. |
| `GET /profile`, `PATCH /profile` | Sessão e campos editáveis no PATCH. | 200, perfil. |
| `PUT /profile/avatar`, `PUT /profile/password` | Avatar multipart, ou senha atual e nova em JSON. | 200, perfil atualizado no avatar. 204 na alteração de senha. |
| `GET /wallets`, `POST /wallets`, `PATCH /wallets/{walletId}` | Sessão, endereço, rótulo, rede e slot conforme operação. Troca de carteira principal atualiza os slots na mesma transação. | 200/201, lista ou carteira persistida. |
| `POST /wallet-connections`, `DELETE /wallet-connections/{id}` | Carteira e rede no POST, credencial ativa. | 201, conexão simulada ou 204 ao desconectar. |

O erro tipado inclui `code`, `message`, `fieldErrors?`, `details?` e `requestId`. Axios distingue timeout, cancelamento e erro de rede de resposta HTTP.

| Status | Exemplos |
| --- | --- |
| 400/422 | Query inválida, campos inválidos, cupom inválido/expirado, endereço inválido ou conexão recusada. |
| 401/403 | Credenciais inválidas/expiradas, ou credencial válida sem permissão. Em recurso privado por ID de outro titular, usar 404 para evitar revelar sua existência. |
| 404 | NFT, rota de API ou recurso/attempt ausente ou inacessível para aquela identidade. |
| 409 | Cadastro em conflito, versão do carrinho divergente, estoque, cotação desatualizada, chave incompatível, tentativa encerrada ou pedido sem recibo confirmado. Cotação desatualizada devolve motivo e cotação atual quando disponível. |
| 429/503 | Falha transitória, com `Retry-After` quando aplicável. Cenário de falha também exercita 500 e falha sem resposta. |

### Protocolo de compra

1. A API cotiza a seleção e a UI exibe os totais revisados. Ao enviar, a UI bloqueia cliques adicionais e persiste a chave por usuário antes de despachar. O mock valida sessão e procura a chave primeiro. Mesmo corpo retorna o pedido existente no estado atual, ainda que a cotação tenha expirado desde o primeiro envio. Corpo diferente retorna 409.
2. Na criação, validar carteira/rede, versões, estoque, cupom, taxa e validade da cotação. Havendo diferença, retornar 409 e exigir nova confirmação com outra chave. Verificação de disponibilidade, reserva, incremento da versão do carrinho, criação do pedido e registro da chave formam uma transação única. O incremento impede que outra chave compre com a mesma revisão. Se o envio falhar antes do commit, o retry com a mesma chave continua seguro. Se falhar depois, a consulta recupera o pedido criado.
3. Enquanto pendente, reservar estoque e a parcela das linhas compradas. Permitir editar o excedente e demais linhas. Bloquear remoção ou redução abaixo da parcela reservada. Na confirmação, baixar somente essa parcela uma vez na mesma transação que finaliza pedido e congela recibo. Na recusa, liberar as reservas sem descontar itens. Terminais não mudam.
4. Após timeout, procurar tentativa pela chave. Em 404, pode repetir a mesma requisição se o payload original ainda está disponível em memória. Após refresh, recuperar por chave ou pendentes. Caso o corpo original se perca e a consulta não encontre pedido, chamar a operação de resolução antes de liberar uma nova revisão. Ela usa a mesma transação de criação para verificar a chave e registrar o encerramento, de modo que um POST atrasado encontra o pedido existente ou recebe 409 por tentativa encerrada. T08 testa a corrida nos dois sentidos. O processamento pendente tem prazo e desfecho persistidos e pode ser finalizado na próxima leitura após refresh.

## Estado remoto e eventos

- Router valida e normaliza busca, filtros, ordenação e paginação. Mudança de filtro reinicia página. Query key de catálogo inclui todos os parâmetros normalizados. Passar `AbortSignal` ao Axios e ignorar respostas de uma geração de sessão já encerrada. Detalhe tem chave por NFT. Dados privados têm chaves por `userId`; carrinho e cotação incluem a identidade de carrinho e cotação inclui rede/versão. Sessão, formulários, filtros provisórios e foco têm escopos próprios. Estado remoto privado permanece em memória.
- Começar com `staleTime` de 30 s para catálogo e detalhe. Dados privados, carrinho, cotação e pedido pendente são considerados imediatamente sujeitos a revalidação. Consultas retomam no foco ou reconexão quando stale. Até duas tentativas adicionais com atraso exponencial para GET em falha de rede ou 5xx. Sem retry automático de mutations ou de erros de validação/autorização. Pedido tem recuperação explícita pela chave. Ajustar tempos com evidência.
- Após mutation, atualizar recurso pela resposta canônica e invalidar dependentes. Favorito atualiza otimisticamente com snapshot da query, cancelamento de leitura concorrente, rollback em falha e revalidação. Serializar operações concorrentes para o mesmo favorito e guardar a geração da sessão. Mudanças de edição, carrinho, cupom ou rede invalidam a revisão em aberto.
- Envelope de Socket.IO: `eventId`, `type`, `resourceId`, `version`, `occurredAt` e `payload`. `nft.updated` é público e sinaliza alterações em preço/estoque por edição. `order.updated` é privado e contém ID e status do pedido, sem dados do coletor ou recibo. O mock resolve a credencial e autoriza o titular ao enviar eventos privados. A UI valida versão/escopo antes de invalidar queries.
- Usar namespace padrão, WebSocket e eventos de texto. A prova T02b autoriza o envio privado por credencial apresentada em um evento após o handshake. Nos fluxos do marketplace, usar `session.subscribe` com confirmação por evento próprio e revalidar a credencial no envio para respeitar expiração e revogação. O mock trabalha com WebSocket, namespace padrão e eventos de texto. [Binding oficial](https://github.com/mswjs/socket.io-binding).
- Manter última versão por recurso e deduplicação de IDs com limite de memória. Usar o evento como sinal de invalidação; a API fornece os dados. Descartar evento atrasado e impedir que REST atrasado regrida uma versão já aplicada. Para listagens e cotações, usar cancelamento/invalidação e nova leitura quando houver versão concorrente. Após reconexão ou renovação da inscrição, revalidar catálogo/detalhe ativos, carrinho, cotação e pedido pendente. Poll REST de pedido pendente com intervalo controlado enquanto o socket estiver indisponível. Remover listeners e fechar conexão na troca de identidade ou desmontagem do provider.

## Mocks e cenários

Bootstrap inicia MSW antes de renderizar a SPA quando a configuração de mocks estiver ativa. Handlers REST e WebSocket leem a mesma base. O controlador seleciona seed, relógio e atrasos via configuração de demo e comandos de cenário exclusivos do modo mock. Playwright aciona o controlador e observa UI, REST e `socket.io-client`, usando contexto isolado por teste. O reset fecha conexões, cancela trabalhos e respostas atrasadas do cenário anterior e repõe base, relógio e credenciais de teste.

### Catálogo e persistência exercitados em T03

- IndexedDB `acervo-demo`, versão 1. Um registro no store `marketplace` contém a seed inteira. As escritas leem e gravam na mesma transação `readwrite`, com resposta após commit. A conexão com o banco é fechada ao concluir a operação. O reset substitui o registro e, na aba que o solicita, descarta a credencial e encerra as conexões do diagnóstico Socket.IO.
- `GET /nfts` aceita `q`, filtros repetíveis `category` e `network`, `minPrice` e `maxPrice` em ETH, `sort` com `recent`, `price-asc` ou `price-desc`, além de `page` e `pageSize`. O padrão é página 1 com três itens. O limite por página é 50. A busca ignora caixa e acentos. O preço do card é o menor entre as edições disponíveis, com fallback para o menor preço listado quando a obra está esgotada. Empates usam o ID.
- `GET /nfts/{nftId}` entrega as edições ou um erro tipado 404. A seed de T03 oferece metadados e edições. As mídias serão adicionadas na implementação do catálogo e na revisão visual.
- `GET /_demo/scenario` lê o cenário persistido. `PUT /_demo/scenario` aceita `default` ou `empty`. O cenário vazio afeta a listagem e os destaques. `POST /_demo/reset` restaura o padrão e a seed completa. Os endpoints de diagnóstico usam o mesmo transporte e handlers em dev e preview.
- Os hashes fictícios das duas contas foram gerados com PBKDF2-SHA-256 e salt por conta. O login, o isolamento dos recursos de conta e o restante dos cenários ainda dependem dos fluxos posteriores.

### Descoberta e carrinho de visitante em T04

- A busca de `/` usa `q`, `category`, `network`, `sort` e `page`, validados pelo Router. Cada combinação forma uma chave de Query. Filtros voltam à primeira página. As listas e os detalhes passam o sinal de cancelamento ao Axios. A paginação desta fatia usa **Página anterior** e **Próxima página**. O carregamento cumulativo previsto no layout fica em T09.
- A migração para IndexedDB versão 2 conserva a seed e o cenário existentes, inicializa os carrinhos e adiciona a mídia das três primeiras obras quando o registro antigo ainda está sem mídia. `POST /carts/guest` cria uma credencial opaca armazenada em `sessionStorage`. A API identifica o carrinho pelo header `X-Guest-Cart`, e a chave de Query inclui essa credencial.
- As escritas recebem `expectedVersion`, validam a versão e o estoque da edição na transação e devolvem o carrinho já calculado. A primeira escrita concorrente vence e a segunda recebe 409. Linhas de uma mesma obra podem coexistir em edições diferentes. A quantidade no carrinho de visitante não reserva estoque. Subtotal e preços são apresentados sem arredondamento em JavaScript `number`. Cupons, taxas e cotação serão integrados em T06.
- Para Órbita, Maré e Duna, T04 usa três SVGs locais autorais como substituições visuais. As demais obras usam um espaço reservado quando a API não tem mídia. O PNG continua como referência de composição para a revisão em T13.

### Autenticação e carrinho por conta em T05

- IndexedDB versão 3 conserva os carrinhos de visitante e adiciona as sessões, os carrinhos por conta e os registros de incorporação. Cadastro e login validam os dados pela API e só emitem a sessão após gravar a incorporação. O cadastro verifica unicidade do e-mail normalizado na transação. As senhas da demo ficam armazenadas como hashes PBKDF2 com salt.
- A credencial de visitante segue no header `X-Guest-Cart` no login e cadastro. A transação preserva itens já existentes na conta e incorpora quantidades até o limite disponível. Repetir a credencial de visitante para a mesma conta devolve o resultado anterior. Usá-la com outra conta retorna 403. O carrinho autenticado é resolvido pelo titular do Bearer, que tem precedência sobre a credencial de visitante.
- A sessão dura uma hora e o token opaco fica em `sessionStorage`. O guard de `/checkout` valida a sessão via REST antes de renderizar. O cabeçalho consulta a sessão periodicamente e no vencimento. Um 401 de sessão encerra apenas a credencial que assinou aquela requisição. Logout limpa a sessão local e solicita revogação. O contexto de retorno é limitado às rotas conhecidas do app.
- Sessão e carrinho privados têm prefixo de cache por credencial. A troca de sessão cancela leituras e remove queries e mutations privadas da credencial anterior. O carrinho recupera o estado do titular após novo login. `POST /_demo/session/expire` expira apenas a credencial apresentada, permitindo acionar o cenário em Playwright sem ajustar o relógio do sistema.

### Cupons, cotação e revisão em T06

- A migração para a versão 4 do IndexedDB mantém carrinhos, sessões e registros de incorporação. `PUT /cart/coupon` recebe `code` e `expectedVersion`. `DELETE /cart/coupon` recebe a versão esperada. Cupom inválido ou expirado retorna 422 e preserva o estado anterior. O cupom válido de visitante passa para a conta se ela ainda estiver sem cupom.
- `POST /quotes` recebe `expectedVersion` e `network`, calcula totais em wei e guarda um snapshot vinculado ao titular com validade de cinco minutos. Repetições com o mesmo estado e rede devolvem o mesmo ID enquanto válido. O carrinho usa uma estimativa em Ethereum. O checkout permite escolher Ethereum ou Polygon para a simulação de pagamento, independentemente da rede exibida no catálogo. As taxas da demo são 0,002 ETH e 0,0005 ETH, respectivamente.
- `POST /quotes/{quoteId}/review` confere titular, prazo, versão, estoque, cupom e taxas na transação. As pendências bloqueiam o aceite, mas preservam as linhas do carrinho. Uma mudança devolve 409. O checkout recota e exige novo clique. A mesma cotação revisada pode receber o mesmo aceite sem gravar outra revisão. A criação do pedido volta a validar esse estado em T07.
- `PATCH /_demo/editions/{nftId}/{editionId}` aceita `priceEth` e/ou `availableQuantity`, atualiza a fixture persistida e incrementa a versão do NFT quando há mudança. Os testes usam essa operação pelo MSW para simular alterações antes do aceite. A entrega das mudanças por Socket.IO entra em T12.

### Descoberta ao vivo da OpenSea

- No modo padrão, `/` encaminha para `/opensea`. TanStack Router guarda coleção, cursor e busca na URL. TanStack Query e Axios usam `GET /api/opensea` para catálogo e detalhe, `q` para busca global e `period` para o ranking. O detalhe combina metadados com o melhor anúncio ativo da OpenSea.
- `server/opensea.ts` usa `X-API-KEY` na API v2. Vite e Vercel reutilizam o handler. O proxy valida slug, contrato e identificador, restringe a descoberta a Ethereum e Polygon e usa cache de 60 segundos com compartilhamento de consultas simultâneas. O ranking usa até dez coleções por período e busca as estatísticas em lotes de cinco. Métricas indisponíveis ou limitadas por cota aparecem como travessão, mantendo a posição da coleção.
- Identificadores e valores atômicos de anúncio chegam como strings. O adapter usa BigInt para produzir o preço por unidade. A consulta `listed=1` cruza os anúncios ativos com os metadados consultados em lote. O detalhe resume a descrição em até 140 caracteres. Volume e piso preservam a moeda de cada campo. [Anúncios da coleção](https://docs.opensea.io/reference/get_best_listings_collection) · [Consulta em lote](https://docs.opensea.io/reference/get_nfts_batch.md).
- O MSW responde a conta, carrinho e cotação nos dois modos. O modo demo acrescenta catálogo de fixtures e diagnóstico Socket.IO. Ao receber `openSea: { collection, contract, identifier }` em `POST /api/v1/cart/items`, o handler consulta o anúncio pelo proxy e guarda o preço e o limite de quantidade. Anúncios em USDC.e na Polygon acrescentam valores próprios à linha e à cotação, preservando os campos em ETH para os fluxos existentes. O desconto em USDC.e é arredondado para baixo em milionésimos. A taxa de rede continua simulada em ETH e é exibida separadamente. [API v2](https://docs.opensea.io/reference/api-overview).

### Transporte exercitado em T02b

O lockfile fixa MSW 2.15.0, `@mswjs/socket.io-binding` 0.2.0 e `socket.io-client` 4.8.4. O binding publicado declara MSW 2 como dependência par. O cliente é importado depois da instalação do interceptor para usar o WebSocket interceptado. O MSW normaliza o caminho `/socket.io/` ao selecionar o handler. O mock reconhece Engine.IO 4 e envia pings a cada 25 s para complementar o heartbeat anunciado pelo binding. O intervalo é liberado ao fechar a conexão. [Metadados do binding publicado](https://www.npmjs.com/package/@mswjs/socket.io-binding/v/0.2.0).

`POST /api/v1/_demo/socket-session` fornece a credencial volátil por aba para a prova. `probe.subscribe` recebe `probe.private` somente com a credencial ativa e encerra a resposta com `probe.public`. `probe.interrupt` fecha o transporte do lado do mock. O cliente abre outro WebSocket e repete a inscrição. Os eventos de catálogo e pedidos, a autorização de conta e a reconciliação por REST serão integrados em T05 e T12.

| Cenário | Gatilho determinístico | Evidência |
| --- | --- | --- |
| Padrão / vazio | Seed com destaques, edições, filtros, mais de uma página, duas contas e carteira inicial. Consulta sem correspondência. | E01/E02/E03/E06 |
| Lento / fora de ordem | Atraso configurado por operação e parâmetros. Busca A demora mais que B. | E01/E12 |
| Rede / HTTP | Resposta de erro de rede, timeout, 4xx/5xx configurado por operação, incluindo falha da mutation de favorito. | E04/E07/E12 |
| Identidade | Avançar relógio até expiração, revogar sessão, tentar recurso de outro titular, cadastro repetido e falha de campo. | E03/E08 |
| Carrinho / cotação | Cupom válido, inválido e expirado. Mudar preço, taxa ou estoque entre revisão e envio. | E05/E09 |
| Carteira / pagamento | Conectar, recusar ou desconectar carteira. Desfecho de pedido confirmado ou recusado com prazo controlado. | E06/E07/E08 |
| Commit seguido de timeout | Persistir pedido e chave antes do atraso que vence o timeout do cliente. | E07 |
| Eventos e reconexão | Escrever mudança no repositório e emitir por WebSocket após commit. Reenviar versões antigas/duplicadas, fechar transporte, concluir pedido offline e reconectar. | E09/E10 |

## Referência visual desktop

A exportação [DEV FRONT.png](DEV%20FRONT.png) tem 4600 × 5331 px e reúne nove telas desktop. A leitura segue da esquerda para a direita em cada fileira.

| Posição | Tela | Elementos de referência |
| --- | --- | --- |
| Superior esquerda | Início | Marca Acervo, destaque dividido entre texto e obra, busca por obra/artista/coleção, controles de rede/preço/ordem, chips de categoria, três cards por linha e ação de carregar mais. |
| Superior centro | Detalhe | Galeria e miniaturas à esquerda, dados e cartão de compra à direita, quantidade, favorito e informações sobre a obra abaixo. |
| Superior direita | Carrinho | Indicador de etapa, itens com miniatura e controle de quantidade, cupom e resumo lateral. |
| Central esquerda | Pagamento | Dados do colecionador, escolha de carteira e rede, revisão dos itens, aceite e resumo lateral. |
| Central centro | Confirmação | Estado confirmado, identificador, lista de aquisições, referência simulada e resumo do pedido. |
| Central direita | Login | Card editorial ao lado do formulário, aviso de retorno à compra, e-mail, senha e estado de erro. |
| Inferior esquerda | Cadastro | Card editorial, nome completo, e-mail, senha, confirmação, aceite e conflito de e-mail. |
| Inferior centro | Perfil | Menu de conta, avatar, nome completo, nome público, e-mail, bio e alteração de senha. |
| Inferior direita | Carteiras | Menu de conta, cards principal/secundária, formulário com apelido, rede, endereço público e opção de carteira principal. |

Usar a composição escura e a cor lima de destaque como referência inicial. Reproduzir os estados de sucesso e erro com texto e semântica adequados. O PNG serve para comparar composição, hierarquia e estados desktop. As obras, ícones e fontes da aplicação devem vir de assets separados. Usar os originais que estiverem disponíveis e registrar as substituições por tela, com a respectiva fonte, quando forem necessárias. Os valores mostrados na imagem são exemplos visuais. Os totais da interface vêm da cotação REST.

A ação de carregar mais deve avançar o parâmetro de página na URL. O catálogo reconstrói as páginas visíveis em refresh e histórico, com chaves distintas por página e combinação de filtros. Documentar o comportamento de opções auxiliares visíveis no layout, como recuperação de senha, download e destinos editoriais, conforme o escopo do README.

## Validação visual e limitações de acesso

- O projeto seguirá com a exportação fornecida. A conta conectada recebeu erro de permissão e o usuário confirmou que não tem acesso ao Dev Mode. A exportação permite avaliar a composição das nove telas desktop. Medidas, fontes e cores extraídas da imagem são aproximações. Tokens oficiais e vínculos com componentes originais ficam sem verificação.
- Em 1440 px, comparar o build às nove telas da exportação. Em 768 e 390 px, validar as adaptações responsivas dos mesmos fluxos. Começar com galeria acima dos dados em telas estreitas, filtros em painel acessível e resumo depois dos itens do carrinho ou da revisão do pagamento. Verificar ordem de foco, leitura, zoom e ausência de overflow. Se houver exportações mobile, incorporá-las à comparação.
- Registrar decisões de composição, diferenças visíveis e substituições de mídia ao comparar o build. As baselines do Playwright capturam o resultado implementado após essa revisão e servem para detectar regressões.

## Riscos técnicos

- A prova de T02b confirmou o transporte no Chromium desktop e mobile. T12 precisa validar os eventos de negócio, a troca de sessão e a reconciliação usando a mesma camada de transporte.
- A base IndexedDB é local à origem e ao perfil do navegador. Contas e dados são fictícios. O isolamento exigido vale nas fronteiras da aplicação e do mock; a base local é inspecionável pelo usuário do navegador. A simulação não opera como backend multiusuário distribuído. T12 documentará entrega de eventos entre abas, se aplicável, e verificará reconciliação após perda de eventos.
- Priorizar imagem principal corretamente dimensionada, variantes responsivas, espaço reservado, fontes locais e divisão de bundle por rota. Medir o custo do bootstrap do MSW no build real. T15 registra as 12 medições e causas dos desvios, caso existam.
- T16 verifica publicação HTTPS, escopo do worker, fallback SPA e funcionamento do deploy com a mesma seed e os mesmos contratos usados nos testes.
