# Desafio Frontend — Marketplace de NFTs

## Execução da base (T01)

Use Node.js 22.13+ da série 22 ou Node.js 24. Instale pelo lockfile e inicie o servidor.

```sh
npm ci
npm run dev:demo
```

Abra a URL exibida pelo Vite. `npm run dev:demo` usa `.env.demo` para ativar o catálogo fictício e os cenários de diagnóstico via MSW. A rota `/integracao` consulta `GET /api/v1/status` por TanStack Query e Axios após a inicialização do worker. Nesse modo os fluxos são reproduzíveis sem a chave da OpenSea.

No Windows, encerre os servidores `dev` e `preview` deste projeto com Ctrl+C antes de rodar `npm ci` novamente. O Vite pode manter o binário do Lightning CSS em uso e impedir a reinstalação. Se aparecer `EPERM` nesse arquivo e o comando `vite` ficar indisponível em seguida, encerre os servidores e repita `npm ci` para restaurar as dependências.

```sh
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run preview
npm run build:demo
npm run preview:demo
npx playwright install chromium
npm run test:e2e
```

O Playwright inicia e encerra o servidor de demonstração por padrão. Para testar o build da demo, rode `npm run build:demo` e defina `PLAYWRIGHT_SERVER=preview` antes de `npm run test:e2e`. Também é possível definir `PLAYWRIGHT_BASE_URL` para usar um servidor demo já em execução. O relatório HTML é salvo em `playwright-report` e traces de falha em `test-results`.

## Diagnóstico de tempo real (T02b)

Com os mocks ativos, abra `/integracao`. O painel Socket.IO recebe um evento público ao conectar. **Iniciar sessão de teste** obtém uma credencial REST do MSW e habilita o evento privado. **Interromper conexão de teste** fecha o transporte do lado do mock. O cliente reconecta automaticamente, recebe um novo identificador de conexão e repete a inscrição. **Voltar a visitante** troca a conexão e volta a receber apenas eventos públicos. A credencial de diagnóstico fica em memória na aba e a criação de outra sessão de teste substitui a anterior.

## Catálogo e cenários de teste (T03)

Em `/integracao`, o painel **Catálogo de teste** consulta o catálogo paginado pela API. **Ativar cenário vazio** deixa a listagem vazia e conserva a escolha ao recarregar. **Restaurar dados de teste** repõe o cenário padrão e os dados iniciais em IndexedDB, encerra a sessão do diagnóstico Socket.IO e volta à primeira página.

O cenário padrão inclui nove obras em três páginas, uma obra esgotada, uma obra com duas edições e duas contas fictícias.

## Descoberta e carrinho de visitante (T04)

Na página inicial, use busca, categoria, rede e ordenação. A URL guarda os controles e a página, inclusive ao recarregar ou usar o histórico. Abra uma obra, escolha edição e quantidade e adicione ao carrinho. Em `/carrinho`, ajuste a quantidade ou remova itens. O carrinho permanece ao recarregar na mesma aba. Para voltar à seed, use **Restaurar dados de teste** em `/integracao`.

## Conta e revisão do checkout (T05)

Em `/carrinho`, selecione **Continuar para pagamento**. Quem estiver como visitante passa por `/login` ou `/cadastro` e volta a `/checkout`. A seleção de visitante é incorporada ao carrinho da conta, respeitando o estoque por edição. Use **Sair** para trocar de conta.

| E-mail fictício | Senha de demonstração |
| --- | --- |
| `marina@example.test` | `AcervoDemo#01` |
| `caio@example.test` | `AcervoDemo#02` |

O teste de sessão em `tests/e2e/account-session.spec.ts` reproduz a expiração no meio da revisão e a retomada após autenticar novamente.

## Cupons e cotação (T06)

Adicione uma obra ao carrinho e use `ACERVO5` para aplicar 5% de desconto. Use `EXPIRADO` para reproduzir a expiração de cupom ou um código desconhecido para ver a validação de cupom inválido. O cupom válido fica no carrinho após recarregar e passa para a conta quando ela ainda está sem cupom.

No checkout, escolha Ethereum ou Polygon e selecione **Confirmar valores**. A API revalida a cotação, que tem validade de cinco minutos. Se preço, estoque, cupom ou taxa tiverem mudado, revise a nova cotação. **Atualizar revisão** consulta novamente o carrinho e os valores. Os testes em `tests/e2e/checkout-quote.spec.ts` reproduzem mudança de preço, edição esgotada e validade vencida.

## NFTs reais via OpenSea

`npm run dev` abre a descoberta ao vivo por padrão. Inicie o Vite com a credencial no ambiente do servidor. No PowerShell 7, digite a chave quando solicitada.

```powershell
$env:OPENSEA_API_KEY = Read-Host 'Chave da OpenSea' -MaskInput
npm run dev
```

A home encaminha para `/opensea`. O catálogo geral mostra uma seleção de várias coleções em alta, com até quatro coleções por página. **À venda** exibe os anúncios ativos com nome, preço e descrição breve. Use **Todos os NFTs**, a busca global ou uma coleção do ranking para explorar mais itens. O detalhe mostra o melhor anúncio ativo quando disponível, com preço por unidade na moeda original. O ranking usa os intervalos de 24h, 7 e 30 dias. Defina `OPENSEA_COLLECTION` para alterar o banner de destaque. A navegação usa Ethereum e Polygon.

A chave é lida no servidor pelo proxy em `/api/opensea`. Para preview, execute `npm run build` e `npm run preview` com `OPENSEA_API_KEY` no ambiente do servidor. Na Vercel, configure a mesma variável para a função em `api/opensea.ts`. [Chaves da OpenSea](https://docs.opensea.io/reference/api-keys) · [Anúncios da coleção](https://docs.opensea.io/reference/get_best_listings_collection).

O carrinho, a conta, os cupons e a revisão do checkout funcionam nos dois modos por meio do MSW. No catálogo ao vivo, o carrinho aceita anúncios em ETH e em USDC.e na rede Polygon. O carrinho verifica o anúncio via proxy e preserva o preço observado. A revisão simulada mostra os totais de cada moeda separadamente e seleciona Polygon quando há USDC.e.

## Redesign do marketplace

No modo demo, em **Início**, a faixa de categorias e a busca do cabeçalho aplicam filtros ao catálogo. O carrossel permite abrir a obra ou explorar a coleção. O ranking da demo usa dados simulados e oferece seleção de período, ordenação e controle das colunas no desktop. O plano e os critérios de aceite estão em [REDESIGN.md](REDESIGN.md).

## Enunciado

Implemente o **NFT Marketplace** em React e TypeScript, seguindo o [layout no Figma](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1).

O desafio avalia fidelidade visual, qualidade das interações, integração com APIs, gerenciamento de estado assíncrono, tempo real, acessibilidade e performance.

## 1. Escopo

Entregue os fluxos de descoberta, compra e conta do colecionador, com versões desktop e mobile. APIs, autenticação, carteiras e pagamentos devem funcionar com dados simulados. Integrações reais com blockchain, extensões de carteira e gateways de pagamento estão fora do escopo.

O Figma define a identidade visual e a composição das telas. Este enunciado define os comportamentos e os cenários de avaliação. Estados não desenhados devem seguir o mesmo padrão visual.

## 2. Stack obrigatória

| Responsabilidade | Tecnologia |
| --- | --- |
| Interface | React |
| Linguagem | TypeScript |
| Roteamento | TanStack Router |
| Estado remoto | TanStack Query |
| Cliente HTTP | Axios |
| Integração de dados | REST APIs |
| Tempo real | Socket.IO |
| Estilização | Tailwind CSS |
| Componentes | shadcn/ui |
| Mocking | MSW |
| Testes E2E e regressão visual | Playwright |
| Auditoria de performance e qualidade | Lighthouse |

As tecnologias devem participar efetivamente da solução. A ferramenta de build, a organização do projeto e as bibliotecas complementares ficam a critério do candidato.

## 3. Telas e fluxos

| Tela | Funcionalidades obrigatórias |
| --- | --- |
| Início | Destaques, catálogo, busca, filtros, ordenação e navegação para o NFT |
| Detalhes do NFT | Galeria, informações, edição, quantidade, favoritos e compra |
| Carrinho de NFTs | Edição de quantidades, remoção, cupom e resumo de valores |
| Pagamento | Dados do colecionador, seleção de carteira e rede, revisão e envio do pedido |
| Confirmação de pedido | Resultado, identificação da transação, itens, taxas e total |
| Login | Autenticação, validação e retorno ao fluxo anterior |
| Cadastro | Criação de conta, validação e tratamento de conflito |
| Perfil do colecionador | Edição dos dados, avatar e alteração de senha |
| Carteiras | Cadastro e edição de carteiras principal e secundária |

Implemente os frames desktop e mobile disponíveis. Perfil, carteiras e confirmação também devem funcionar em mobile, mesmo sem um frame específico.

Páginas editoriais, suporte, atividade, ofertas e downloads não fazem parte da entrega. Links externos e ações auxiliares devem ter comportamento coerente; ações fora do escopo não devem aparentar sucesso funcional.

### Catálogo e detalhe

- Busca, filtros, ordenação e paginação devem compor o estado da URL e sobreviver a refresh e navegação pelo histórico.
- Filtros devem ser combináveis; mudança de filtro deve reiniciar a paginação.
- As consultas devem refletir os parâmetros enviados à API, com tratamento de resultados vazios, falhas e respostas fora de ordem.
- O detalhe deve suportar acesso direto, NFT inexistente, edição indisponível e limite de quantidade.
- Favoritos devem persistir para o usuário autenticado.

### Carrinho

- Adicionar, alterar e remover itens, respeitando a disponibilidade por NFT e edição.
- Manter o carrinho após refresh e preservar os itens do visitante ao autenticar.
- Aplicar e remover cupom, com tratamento de código inválido ou expirado.
- Exibir subtotal, desconto, taxa de rede e total coerentes com a resposta da API.
- Refletir alterações de preço e disponibilidade recebidas enquanto o carrinho estiver aberto.

Valores em ETH devem trafegar como strings decimais e manter precisão nos cálculos e na apresentação. Quantidades são inteiras. A cotação da API é a referência para finalizar o pedido.

### Pagamento e confirmação

- Validar os campos do layout e permitir revisão antes do envio.
- Utilizar as carteiras cadastradas, com seleção de rede e simulação de conexão, recusa e desconexão.
- Revalidar preço, disponibilidade, cupom e taxas antes de confirmar a compra. Mudanças devem exigir nova confirmação do usuário.
- Impedir pedidos duplicados em cliques repetidos ou reenvios após timeout.
- Representar pedido pendente, confirmado e recusado, com recuperação após refresh ou reconexão.
- Exibir a confirmação somente para pedido efetivamente confirmado na simulação.
- Preservar os itens em falhas; após confirmação, remover do carrinho apenas os itens e quantidades comprados.

O recibo deve reproduzir o snapshot do pedido. Alterações posteriores no catálogo não podem modificar seus valores. Referências de transação e links de exploração são simulados.

### Conta e sessão

Cadastro, login, logout e sessão são obrigatórios, integrados à API simulada. Checkout, perfil, carteiras, favoritos e pedidos exigem autenticação.

A sessão deve ser recuperável após refresh. Trate expiração durante a navegação e durante o checkout, preservando o contexto para retomada. Logout e troca de usuário devem limpar dados privados em cache e subscriptions da sessão anterior.

Valide os formulários de cadastro, perfil, senha e carteiras, incluindo erros retornados pela API. Alterações confirmadas devem permanecer após refresh. Use credenciais fictícias e não armazene senhas em claro.

## 4. Integração e estado

Use TanStack Router nas rotas, parâmetros de busca e proteção dos fluxos privados. Use TanStack Query nas consultas, mutations e sincronização do cache. As chamadas REST devem passar pelo Axios.

A solução deve garantir:

- contratos tipados entre transporte, estado e interface;
- estados de carregamento, vazio, erro, sucesso e atualização em segundo plano;
- invalidação coerente após mutations e eventos;
- cancelamento ou descarte de respostas obsoletas;
- isolamento dos dados por usuário e pelos parâmetros da consulta;
- recuperação de falhas sem duplicar operações;
- tratamento de rotas inexistentes e acesso direto a qualquer tela prevista.

Aplique atualização otimista em pelo menos uma interação, com rollback em caso de falha. A política de cache, retries e sincronização deve ser documentada.

## 5. Contratos REST

Defina e documente os contratos utilizados. Os recursos mínimos são:

| Recurso | Operações |
| --- | --- |
| Sessão e conta | Cadastro, login, consulta da sessão, logout e expiração |
| NFTs | Listagem com busca/filtros/ordenação/paginação e detalhe por identificador |
| Favoritos | Consulta, inclusão e remoção |
| Carrinho | Consulta, inclusão, alteração e remoção de itens |
| Cotação | Validação de cupom, disponibilidade, descontos, taxas e total |
| Pedidos | Criação idempotente e consulta do estado e recibo |
| Perfil | Consulta, atualização de dados/avatar e alteração de senha |
| Carteiras | Consulta, cadastro e atualização |

As respostas devem representar erros de validação, sessão inválida, falta de permissão, recurso inexistente, conflito de disponibilidade e falha transitória.

As mutations de pedido devem aceitar uma chave de idempotência. Na simulação, a mesma tentativa deve recuperar o mesmo pedido; reutilizar a chave com conteúdo diferente deve gerar conflito.

## 6. Mocking com MSW

Implemente os mocks na camada de rede, reutilizando contratos e cenários entre desenvolvimento, demonstração e testes. Componentes, hooks e cliente Axios não devem conter respostas fictícias ou caminhos alternativos de negócio.

Os mocks devem manter estado consistente entre catálogo, favoritos, carrinho, perfil, carteiras e pedidos. Persistência local é permitida para sustentar refresh; o reset deve restaurar integralmente um cenário conhecido.

### Simulating Network Conditions and Failures

Simule condições de rede e falhas com MSW, incluindo lentidão, latência variável, timeouts, indisponibilidade de conexão e respostas HTTP de erro. Os cenários devem ser configuráveis e reproduzíveis, permitindo avaliar o carregamento, o feedback de erro e a recuperação da interface.

Disponibilize fixtures com variedade suficiente para exercitar filtros e paginação, pelo menos dois usuários e cenários determinísticos de:

- sucesso e resultado vazio;
- latência variável e respostas fora de ordem;
- falhas de conexão e respostas HTTP 4xx/5xx;
- sessão expirada e acesso não autorizado;
- conflito de cadastro ou de validação de formulário;
- cupom inválido ou expirado;
- preço alterado ou edição esgotada durante a compra;
- timeout após criação do pedido, com recuperação por idempotência;
- pagamento confirmado e pagamento recusado.

Use MSW também na simulação dos eventos, com uma integração compatível com o protocolo Socket.IO, como [@mswjs/socket.io-binding](https://github.com/mswjs/socket.io-binding). Documente o transporte utilizado e suas limitações no ambiente de mocks.

Os cenários devem exercitar `socket.io-client`. Substituir o socket por chamadas diretas a setters, callbacks ou ao cache não atende ao requisito.

A camada de mocks deve ser ativada por configuração e estar disponível no build de demonstração. Mudanças nos dados simulados devem ser refletidas tanto nas respostas REST quanto nos eventos correspondentes.

## 7. Tempo real com Socket.IO

Implemente, no mínimo, os seguintes eventos:

| Evento | Comportamento esperado |
| --- | --- |
| `nft.updated` | Atualizar preço e disponibilidade no catálogo, detalhe e carrinho |
| `order.updated` | Atualizar o estado do pedido e apresentar confirmação ou recusa |

Os eventos devem carregar identidade estável, recurso afetado e versão. O cliente deve tolerar duplicatas e eventos antigos, sem regredir um estado mais recente nem reaplicar efeitos.

Após reconexão, reconcilie os recursos ativos com a API REST. Eventos de uma sessão anterior não podem atualizar dados de outro usuário. Listeners e subscriptions devem ser liberados ao encerrar seu ciclo de vida.

Implemente o cenário:

1. Um NFT está no carrinho.
2. Seu preço ou disponibilidade muda durante a navegação.
3. A interface informa a alteração e atualiza o resumo.
4. O checkout impede a confirmação com uma cotação desatualizada.

Também deve funcionar uma interrupção de conexão enquanto o pedido está pendente. Após reconectar ou recarregar a página, o usuário deve recuperar seu estado sem criar outra compra. Pedidos confirmados ou recusados são terminais.

## 8. Interface, responsividade e acessibilidade

Preserve tipografia, cores, espaçamentos, hierarquia, imagens, proporções e composição do Figma. Adapte os componentes shadcn/ui à identidade visual do projeto.

Todas as telas devem funcionar em desktop, tablet e mobile, com atenção a filtros, navegação, formulários, carrinho e checkout. Avalie, no mínimo, larguras de 390, 768 e 1440 pixels.

Use **skeletons com shimmer effect** nos componentes dependentes de dados durante o carregamento, incluindo catálogo, detalhe e resumo do carrinho. Preserve as dimensões do conteúdo para evitar deslocamentos de layout e respeite a preferência por movimento reduzido.

São obrigatórios:

- navegação por teclado e foco visível;
- controle de foco em diálogos e drawers;
- semântica adequada, labels e mensagens de erro associadas aos campos;
- alternativas textuais para imagens relevantes;
- contraste legível e estados não dependentes apenas de cor;
- feedback acessível para mutations e alterações em tempo real;
- ausência de overflow horizontal indevido e perda de conteúdo com zoom.

Use os assets do arquivo quando disponíveis e mantenha imagens e fontes necessárias acessíveis à execução local. Documente qualquer substituição de asset ou ajuste de acessibilidade em relação ao layout.

## 9. Testes com Playwright

Entregue testes E2E executáveis com os mocks, cobrindo:

1. Busca, filtros combinados, ordenação, paginação e restauração pelo histórico.
2. Acesso direto ao detalhe e tratamento de recurso inexistente.
3. Cadastro, login, expiração de sessão, logout e troca de usuário.
4. Favoritos, incluindo falha de mutation e recuperação do estado.
5. Carrinho, quantidades, remoção, cupom e persistência após refresh/login.
6. Compra completa, do catálogo ao recibo confirmado.
7. Falha de pagamento, clique repetido e timeout com recuperação do mesmo pedido.
8. Edição de perfil, avatar, senha e carteiras, com erros de validação.
9. Alteração de preço/disponibilidade via Socket.IO durante o checkout.
10. Eventos duplicados ou antigos, desconexão e retomada de pedido pendente.
11. Navegação por teclado, foco de diálogos e validação de formulários.
12. Skeletons durante carregamento lento, feedback de falha e recuperação após nova tentativa.

Execute os fluxos principais em Chromium, nos viewports desktop e mobile. Inclua regressão visual de início, detalhe, carrinho e pagamento, com baselines versionadas e dados estáveis.

Cada teste deve partir de um estado isolado. Controle relógio, latência e disparo dos eventos nos cenários sensíveis a tempo. Entregue relatório HTML e traces das falhas.

As verificações devem observar a interface e os resultados das operações. Os testes de tempo real precisam passar pelo cliente Socket.IO e os de REST pelos handlers MSW.

## 10. Performance e Lighthouse

Audite início e detalhe do NFT com Lighthouse em perfis mobile e desktop, usando build otimizado e o cenário padrão dos mocks.

| Categoria | Meta |
| --- | ---: |
| Performance | ≥ 90 |
| Accessibility | ≥ 95 |
| Best Practices | ≥ 95 |
| SEO | ≥ 90 |

Execute três medições por página e perfil e reporte a mediana de cada categoria. Versione a configuração da auditoria e entregue relatórios HTML/JSON, versões das ferramentas, ambiente e condições de execução.

Registre LCP, CLS e TBT. Justifique resultados abaixo das metas e identifique as causas. A auditoria deve carregar as imagens, fontes e funcionalidades da entrega, sem simplificações exclusivas para melhorar a pontuação.

## 11. Critérios de avaliação

| Critério | Pontos | Evidência esperada |
| --- | ---: | --- |
| Fidelidade visual e responsividade | 20 | Aderência ao Figma e consistência entre tamanhos de tela |
| Fluxos e experiência de uso | 20 | Compra e conta completas, validações e recuperação de erros |
| Integração e estado | 15 | Router, Query, Axios, contratos e cache coerentes |
| Tempo real | 10 | Eventos, reconexão, ordenação e sincronização com REST |
| Mocking | 10 | MSW, cenários determinísticos, persistência e reset |
| Testes | 10 | Cobertura dos fluxos e falhas com Playwright |
| Acessibilidade | 5 | Operação por teclado, semântica, foco e feedback |
| Performance | 5 | Resultados e análise das auditorias Lighthouse |
| Arquitetura e documentação | 5 | Tipagem, responsabilidades e execução reproduzível |
| **Total** | **100** | |

São eliminatórios: ausência de uso efetivo da stack obrigatória, fluxos principais apenas visuais, compra confirmada sem resposta da simulação, exposição de dados entre usuários, eventos simulados diretamente na UI ou ausência de testes E2E executáveis.

## 12. Entrega

Entregue código-fonte, lockfile, assets, mocks, fixtures, testes e configurações de auditoria.

O **deploy é obrigatório**. Envie o link do repositório e uma URL pública da aplicação. Recomenda-se [Vercel](https://vercel.com/docs/frameworks/frontend/vite); [Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/) e [Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/) também são aceitos.

A versão publicada deve corresponder ao código entregue e permanecer acessível durante a avaliação, com os mocks e os fluxos de tempo real funcionando. Acesso direto e refresh das rotas devem funcionar no ambiente publicado.

O `README.md` da solução deve conter setup, variáveis de ambiente, credenciais fictícias, seleção e reset dos cenários, comandos de execução e instruções para reproduzir os fluxos de falha.

Documente os contratos REST e eventos, a política de sessão, o estado do carrinho, a estratégia de cache e a reconciliação entre REST e Socket.IO. Registre limitações, decisões de UX e eventuais desvios do Figma em `ARCHITECTURE.md`.

Disponibilize comandos para desenvolvimento com mocks, build, preview, verificação de tipos, lint, testes Playwright e auditoria Lighthouse.

A entrega deve executar a partir de um checkout limpo, sem depender de serviços privados ou do backend de produção.
