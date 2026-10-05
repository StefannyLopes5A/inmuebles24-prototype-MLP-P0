# Arquitetura do protótipo

Aplicação cliente em React 19.2.0 e Vite 6.4.2, sem backend de negócio. Requer Node.js ≥22.12.0; `.nvmrc` indica Node 22. Assets e catálogo são locais. As interações não chamam IA, anunciantes, autenticação ou endpoints externos; o único worker entregue serve arquivos estáticos e o fallback da aplicação.

## Onde alterar

| Arquivo | Responsabilidade |
| --- | --- |
| `src/main.jsx` | Único ponto de entrada, provider de idioma, migração de links antigos e imports de CSS. |
| `src/App.jsx` | Estado da rota, critérios, perfil, favoritos, recibos, navegação e composição das páginas. |
| `src/Home.jsx`, `src/HomeSearch.jsx` | Header, home, HouseCard, frase e controles de busca. |
| `src/SearchBar.jsx`, `src/ResultsFlowPage.jsx` | Estados da barra Mora, assistência local e grade de resultados. |
| `src/MiniListing.jsx`, `src/PropertyDetail.jsx` | Mini-listing, pergunta, contato/reutilização/confirmação e página interna. |
| `src/journey.js`, `src/searchCriteria.js`, `src/searchInput.js` | Normalização, correspondências, sugestões para demonstração, URL, critérios e interpretação local. |
| `src/contactFlow.js`, `src/contactProfile.js` | Validação, mensagens/recibos simulados e persistência do perfil. |
| `src/listingPresentation.js`, `src/listing-details.json` | Apresentação baseada no anúncio, fotos e atributos adicionais confirmados. |
| `src/i18n.jsx`, `src/data.js`, `src/real-listings.json` | Idioma, moeda e snapshot do catálogo. |
| `src/homeIntro.js`, `src/homeMotion.js`, `src/searchFlowMotion.js` | Holofote, interações dos cards, expansão da barra e Onda. |

Os CSS entram somente por `main.jsx`. A ordem termina em `home-evolution.css` → `home-motion.css` → `search-flow.css` → `search-transition.css` → `mini-listing.css` → `mobile-polish.css`. Há camadas históricas anteriores; confira a cascata antes de adicionar regras. Ajustes de mobile pertencem às media queries, preservando o desktop.

## Estado e rotas

`App` lê `readJourney()` no carregamento e em `popstate`. `journeyUrl()` produz URLs com `view=home|results|listing`, critérios, preferência e `property`. Essa rota é suficiente para reabrir a mesma busca ou página interna. O histórico guarda posição de rolagem e camada de navegação; abrir/fechar o mini-listing e entrar/voltar da interna preserva o anúncio de origem.

Nome, e-mail, telefone, mensagens de contato, destinatários e recibos não são serializados pela URL. O texto livre de busca (`note`) faz parte dos critérios compartilháveis; mantenha dados pessoais fora desse campo.

`matchingHomes()` calcula correspondências estritas. `prototypeResults()` começa por elas e completa até pelo menos 40 anúncios distintos com sugestões ordenadas do catálogo. `App` mantém as correspondências na frente e pode priorizar preferência de quartos e favoritos. Não substitua a contagem estrita usada pela assistência pela quantidade de cards de demonstração.

A barra tem estados `collapsed`, `edit`, `input`, `suggest`, `qualify`, `answer` e `listing`. Quando há `activeHome`, ela renderiza `MiniListing`, que mantém seus estados de resumo, pergunta, contato e confirmação. A reutilização do perfil é um subestado do contato. A página interna usa `PropertyDetail`; suas ações passam a intenção de contato à mesma barra.

A sugestão proativa é disparada por rolagem efetiva seguida de 750 ms de pausa, desde que a barra esteja recolhida, sem edição ou imóvel aberto e com alternativa disponível. A home e a rota interna passam `proactive={false}`; resultados conservam esse recurso.

## Armazenamento e reset do perfil

| Local | Chave / conteúdo | Duração |
| --- | --- | --- |
| `localStorage` | `inmuebles24-v2-contact-profile`: `name`, `email`, `phone`. | Entre visitas no mesmo navegador e origem. |
| `sessionStorage` | `inmuebles24-v2-session`: `saved`, `receipts`, cópia legada `profile`. | Sessão da aba; pode sobreviver a recarregamento. |
| `localStorage` | `inmuebles24-v2-language`, `inmuebles24-v2-currency`. | Idioma e moeda entre visitas. |
| Estado React | Edição, pergunta, canal, animações e estado transitório do contato. | Enquanto o componente está montado. |

`readContactProfile()` prioriza a chave persistente e usa o perfil legado da sessão como fallback. Leitura e escrita tratam armazenamento bloqueado ou JSON inválido sem impedir o fluxo. O perfil é persistido após um contato válido; cada recibo contém somente o canal escolhido e se associa a um imóvel específico.

Para repetir o primeiro contato **sem apagar favoritos, moeda, idioma ou dados de outros sites**:

1. Abra o protótipo e o Console do DevTools dessa página. Feche outras abas desse mesmo protótipo durante o reset.
2. Execute o trecho abaixo. Ele remove somente a chave de perfil da aplicação e sua cópia legada na sessão, depois recarrega.
3. Abra um imóvel e simule um novo contato usando dados fictícios. Recibos anteriores continuam na sessão e ainda contêm sua cópia do canal escolhido.

```js
(() => {
  const sessionKey = 'inmuebles24-v2-session';
  localStorage.removeItem('inmuebles24-v2-contact-profile');
  const raw = sessionStorage.getItem(sessionKey);
  if (raw) {
    try {
      const session = JSON.parse(raw);
      if (session && typeof session === 'object' && !Array.isArray(session)) {
        delete session.profile;
        sessionStorage.setItem(sessionKey, JSON.stringify(session));
      }
    } catch {
      // A sessão ilegível já é ignorada pelo aplicativo.
    }
  }
  location.reload();
})();
```

Para reiniciar também favoritos e recibos de demonstração, remova especificamente `inmuebles24-v2-session` no painel Session Storage e `inmuebles24-v2-contact-profile` no Local Storage e recarregue. Não use `localStorage.clear()`, `sessionStorage.clear()` nem a opção de limpar todos os dados do navegador. Endereços locais e o site publicado têm origens distintas, portanto não compartilham esse perfil.

## Dados, assets e contato

O snapshot tem 100 anúncios, com IDs, preço MXN, endereço e foto correspondentes. `LISTING-SOURCES.json` documenta origem e arquivos; `AGENCY-SOURCES.json` registra 13 logos e as associações verificadas. O anunciante do contato vem dessa evidência, nunca do fallback decorativo do HouseCard. `FIGMA-ASSETS.json`, `ASSET-SOURCES.json` e [o inventário do mini-listing](../public/assets/mini-listing/ASSETS.md) registram os assets visuais.

`listing-details.json` só acrescenta fotos e fatos confirmados. Ausência de informação permanece `null`/“a confirmar”; cada anúncio tem hoje uma foto local. `listingSummary()` compara fatos e critérios; `answerListingQuestion()` usa regras locais e pede confirmação quando não tem informação. Não há análise de imagem ou LLM.

`contactValidation()` exige nome e o canal selecionado: e-mail válido ou telefone com `+`, código do país e 10–15 dígitos. A mensagem é formada com imóvel, busca e eventual pergunta. `MiniListing` usa um guard contra duplicação e um timer de 420 ms; `createContactReceipt()` grava um recibo com `simulated: true`, sem requisição de rede. A intenção de visita não representa agendamento.

## Build, CI e hospedagem

`npm run check` gera o build primeiro e então executa 57 testes V2 e 4 testes Sites. A ordem permite validar o pacote de hospedagem também em um clone novo. Os testes usam o runner nativo `node --test`; não há banco de dados ou credenciais para preparar. Eles cobrem lógica, normalização, armazenamento, mensagens, identidade e worker. Conferência de layout, toque, teclado e movimentos segue [FLOW.md](FLOW.md).

Vite gera `dist/client/`. `scripts/prepare-sites-build.mjs` copia o worker para `dist/server/index.js` e a configuração para `dist/.openai/hosting.json`. O worker serve `env.ASSETS`; em uma rota HTML desconhecida de GET/HEAD, devolve o `index.html` para a aplicação resolver a URL. Ele não recebe contatos nem executa IA.

O handoff do GitHub usa `.openai/hosting.json` genérico, sem `project_id`, e não contém destino privado de publicação ou credenciais. `.github/workflows/verify.yml` roda `npm ci` e `npm run check` em pushes para `main` e pull requests, com permissão de leitura. Não faz deploy. A V2 já publicada mantém seu acesso restrito separadamente; clonar o repositório não altera essa audiência.
