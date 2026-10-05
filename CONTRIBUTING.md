# Continuar o protótipo

O trabalho acontece no [repositório privado abrantesv/inmuebles24-prototype](https://github.com/abrantesv/inmuebles24-prototype). Acesso ao GitHub, ao Figma e ao site publicado é independente. A CI verifica a aplicação; publicar uma versão é uma decisão separada.

## Preparar uma alteração

1. Leia [PRODUCT.md](PRODUCT.md) e [docs/FLOW.md](docs/FLOW.md) para entender o comportamento vigente. Para telas, consulte [docs/DESIGN-HANDOFF.md](docs/DESIGN-HANDOFF.md); para código, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
2. Instale Node.js ≥22.12.0 e execute `npm ci`. `.nvmrc` seleciona Node 22. Inicie com `npm run dev -- --host 127.0.0.1 --port 5180`.
3. Crie uma branch focada na alteração. Defina qual estado ou problema será resolvido antes de mudar componentes compartilhados.
4. Use dados fictícios ao ensaiar o contato. Para repetir o primeiro contato, faça o [reset direcionado do perfil](docs/ARCHITECTURE.md#armazenamento-e-reset-do-perfil).

## Preservar a experiência

- Mantenha home Holofote, Onda e seus estados de interrupção/movimento reduzido. Não reintroduza comparadores ou laboratórios no aplicativo.
- Mantenha filtros e imóvel na barra; resumo, pergunta, contato e confirmação pertencem à mesma superfície. A interna deve preservar rota, identidade e retorno à busca.
- Preserve fotos, fatos e anunciantes associados ao anúncio correto. Acrescente proveniência quando incorporar conteúdo. Não invente galeria, selo Premium ou características para reproduzir o exemplo do Figma.
- Faça ajustes de mobile dentro do escopo responsivo. Confira 1512 × 982, 390 px e 320 px, com fechamento acessível, teclado e campos de 16 px no contato.
- Mantenha os fluxos simulados e locais. Não adicione integração, envio real, credenciais, rastreamento ou deploy automático como parte de um ajuste visual.

O contrato atual de design está no handoff. Mudanças do sistema devem ser deliberadas e documentadas. CSS é importado somente por `src/main.jsx`, com ajustes específicos após as bases.

## Entregar para revisão

1. Rode `npm run check` e registre o resultado: 57 testes V2, 4 testes Sites e build na base desta entrega. Se a alteração acrescentar testes, atualize a contagem documentada.
2. Refaça os passos de [FLOW.md](docs/FLOW.md) afetados. Para contato ou navegação, confira primeiro/segundo imóvel, formulário inválido, edição de perfil, voltar/avançar e recarregamento.
3. Anexe capturas dos estados alterados e informe viewport, idioma, moeda e preferência de movimento. Não trate emulação como teste em Safari nativo ou aparelho físico.
4. Abra uma pull request explicando o problema, comportamento final, arquivos relevantes e verificação realizada. Atualize produto, fluxo ou handoff quando a alteração mudar o contrato.
5. Confira o conteúdo antes de compartilhar: não incluir `.env`, tokens, contas, perfis do navegador, caches, dados reais de contato, arquivos privados, logs de contexto ou protótipos antigos. Preserve assets e proveniência necessários ao aplicativo.

O pacote de hospedagem usa configuração genérica sem `project_id`. A revisão ou merge de uma pull request não publica o site. Fotos e marcas de terceiros permanecem materiais de um conceito interno; esta colaboração não transfere direitos sobre esses assets.
