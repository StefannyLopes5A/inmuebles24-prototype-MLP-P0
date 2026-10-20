# Inmuebles24 · Busca acompanhada com Mora

Protótipo de uma busca imobiliária que ganha contexto durante a exploração. A Mora compartilha a barra com os filtros: ajuda a refinar a intenção, apresenta um imóvel e conduz contatos simulados com dados reutilizáveis.

React 19.2.0 + Vite 6.4.2, responsivo, em espanhol mexicano e português brasileiro. Não há backend, autenticação, IA remota, envio de leads ou agendamento real. Use dados fictícios nos testes.

## Rodar localmente

Requer **Node.js ≥22.12.0** e npm. O arquivo `.nvmrc` seleciona Node 22. Com acesso ao [repositório privado](https://github.com/abrantesv/inmuebles24-prototype):

```sh
git clone https://github.com/abrantesv/inmuebles24-prototype.git
cd inmuebles24-prototype
npm ci
npm run dev -- --host 127.0.0.1 --port 5180
```

Abra o endereço informado pelo Vite. Não é necessário criar `.env` nem configurar contas de serviços. Com nvm instalado, execute `nvm use` antes de instalar as dependências.

## Verificar e continuar

```sh
npm run check
```

Esse comando gera o build e executa **69 testes V2 + 4 testes Sites**. Para executar cada parte:

| Comando | Resultado |
| --- | --- |
| `npm run test:v2` | Regras de busca, interpretação local, contato, persistência e apresentação do imóvel. |
| `npm run test:sites` | Servidor de assets e fallback de rotas; requer `npm run build` antes. |
| `npm run build` | Gera a aplicação e prepara o pacote de hospedagem. |
| `npm run preview -- --host 127.0.0.1` | Abre o build local para conferência. |

Comece por [PRODUCT.md](PRODUCT.md) para entender a experiência. Use [o percurso de validação](docs/FLOW.md) para testar, [o handoff de design](docs/DESIGN-HANDOFF.md) para alterar telas e [a arquitetura](docs/ARCHITECTURE.md) para localizar a implementação. O fluxo de contribuição está em [CONTRIBUTING.md](CONTRIBUTING.md).

A referência externa é o [arquivo Figma KcIrcsopqwSQCWp6s8omaI — mini-listing 518:16812](https://www.figma.com/design/KcIrcsopqwSQCWp6s8omaI/?node-id=518-16812). O acesso ao arquivo depende das permissões do Figma. [DESIGN.md](DESIGN.md) aponta para o contrato visual atual em `docs/DESIGN-HANDOFF.md`.

## Dados e simulação

- O catálogo contém **100 anúncios capturados em 28/09/2026**, 50 de venda e 50 de aluguel, com uma fotografia local correspondente a cada imóvel. Não é um catálogo atualizado em tempo real.
- A grade exibe pelo menos **40 cards distintos** para demonstrar o layout. Correspondências exatas vêm primeiro; sugestões do catálogo completam a exploração. O contador não significa 40 imóveis que atendem a todos os critérios.
- Mora, sugestões e contatos são simulados localmente. Os controles do aplicativo não enviam mensagens nem abrem serviços externos. URLs de origem permanecem nos arquivos de proveniência.
- Nome, e-mail e telefone persistem neste navegador entre visitas. Favoritos, alertas e o momento informado à Mora ficam na sessão; listas compartilhadas ficam neste navegador (o link só abre aqui); recibos de contato somem ao recarregar. A URL contém somente critérios, preferência, ordem e identificador do imóvel ou da lista. Veja [armazenamento e reset do perfil](docs/ARCHITECTURE.md#armazenamento-e-reset-do-perfil).
- MXN é a moeda original. USD usa o fator **fixo e ilustrativo de 20 MXN/USD**, informado no seletor; não representa cotação atual.

A proveniência está em [LISTING-SOURCES.json](LISTING-SOURCES.json), [AGENCY-SOURCES.json](AGENCY-SOURCES.json), [FIGMA-ASSETS.json](FIGMA-ASSETS.json) e [ASSET-SOURCES.json](ASSET-SOURCES.json). Os 13 logos locais têm origem registrada; reutilização decorativa em cards não comprova a identidade do anunciante. O contato só usa a associação verificada do anúncio. Este é um conceito privado para discussão interna: a presença de fotografias e marcas não concede direitos de uso nem implica afiliação ou licença para publicação comercial.

## Publicação e acesso

A [V2 existente no Sites](https://inmuebles24-busca-acompanada-v2.viktorherald.chatgpt.site/) tem **acesso restrito às contas já autorizadas**. Acesso ao GitHub ou ao Figma não concede acesso a esse site. Para continuar o trabalho, use o ambiente local.

O pacote do GitHub usa `.openai/hosting.json` genérico, sem `project_id`. `npm run build` produz `dist/client/index.html`, `dist/server/index.js` e `dist/.openai/hosting.json`; o worker serve os assets e as rotas da aplicação. A configuração de um destino de publicação é uma etapa separada. A CI do GitHub executa testes e build: **não faz deploy automático**.

Este repositório recebe somente o snapshot do aplicativo, assets, proveniência e documentação necessária. Credenciais, contas, arquivos privados de contexto, logs e protótipos antigos não fazem parte do handoff.

## Evidências e limites

As capturas da entrega estão em [qa/mini-listing/](qa/mini-listing/): desktop em 1512 × 982, mobile em 390 px, formulário em 320 px e página interna responsiva. A revisão final liberou a entrega após corrigir a ordem da interna no mobile: foto → preço/contato → informações. Consulte [o registro de evidências](docs/DESIGN-HANDOFF.md#evidências-e-limites).

Movimento reduzido tem tratamento no código. Não houve validação em Safari nativo ou aparelho físico; os testes automatizados não substituem essa verificação. O [vídeo do percurso completo](https://github.com/abrantesv/inmuebles24-prototype/releases/tag/v1.0.0) tem 2 min 32 s, em 1512 × 982 a 30 fps, sem áudio nem legendas. O arquivo MP4 está nos anexos da release. `npm run check` passou nesta entrega: 61 testes e build concluído.
