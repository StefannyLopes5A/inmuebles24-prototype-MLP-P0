# Inmuebles24 · Busca acompanhada

Contrato vigente em **05/10/2026**. Este documento consolida o comportamento entregue; não é um histórico de alternativas.

## Proposta

A pessoa começa com uma intenção de moradia, explora imóveis e ajusta a busca sem perder o contexto. A Mora divide a mesma barra com os filtros, esclarece preferências e permite simular contatos com vários anunciantes sem repetir o cadastro. A assistência é opcional: ninguém precisa responder à Mora para abrir um imóvel ou contatar seu anunciante.

O protótipo serve para discutir a experiência com designers e testar sua compreensão. Não é um marketplace de produção, nem valida conversão, qualidade de leads, disponibilidade ou políticas comerciais.

## Busca e exploração

1. A home Holofote apresenta uma frase editável. Operação e tipo de imóvel precisam ser escolhidos explicitamente para liberar a busca, inclusive quando a pessoa aceita os valores sugeridos. Pular a animação não satisfaz esse requisito. Uma ideia da home aplica uma busca completa e conta como escolha explícita.
2. A transição Onda transforma a primeira dobra na barra compacta e revela os resultados. Ações novas interrompem a sequência; movimento reduzido usa a troca imediata. Os cinco carrosséis da home mantêm dez imóveis distintos por seleção e a operação escolhida.
3. Na barra, filtros abrem a frase expandida e seu menu. Mudanças atualizam os resultados sem botão Aplicar. O orçamento usa um histograma ilustrativo manipulável; o gráfico não é uma contagem real de anúncios. Valores de filtro continuam em MXN.
4. O Smart Input interpreta localmente termos reconhecidos, cria tokens editáveis/removíveis e distingue perguntas de mudanças de critérios. Texto não reconhecido permanece contexto. Preferências de trabalho em casa podem significar canto na sala, quarto dedicado ou coworking; são intenção da pessoa, não evidência de uma planta ou ambiente real.
5. Após rolagem efetiva e uma pausa de 750 ms nos resultados, Mora pode sugerir bairros ou esclarecer uma preferência. Não interrompe edição, imóvel aberto ou contato. Essa assistência proativa fica desativada na home e na página interna. A pessoa pode recusar e continuar.

A grade usa o mesmo HouseCard da home, com quatro colunas no desktop e uma no mobile. Ela mantém pelo menos 40 anúncios distintos para a demonstração, ordenando correspondências exatas antes das sugestões do catálogo. O coração vazio abre um modal de listas de favoritos, no padrão do Airbnb: a pessoa escolhe uma lista ou cria outra com nome de até 50 caracteres, pré-preenchido com a cidade e os bairros da busca. Cada imóvel fica em uma lista. O coração preenchido desfavorita direto, sem abrir o modal, e mostra no mesmo cartão branco “Removido de {lista}” com **Desfazer**; para trocar de lista, use **Alterar** no aviso de salvo. Favoritar só altera a cor do coração — **não muda a posição do card nem a ordenação dos resultados**. O aviso “Salvo em {lista}” oferece **Ver pasta** e **Alterar** (reabre o modal). A rota `view=favorites` mostra todas as listas, começando por **Vistos recentemente**, que guarda automaticamente cada imóvel aberto (mini-listing ou interna, até 24). O interior de uma lista, `view=compare&list={id}`, coloca os imóveis lado a lado com uma leitura local do que combina, o que vale considerar e por que se aproxima do perfil — sem inventar fatos do anúncio; voltar leva à grade de listas. Listas e vistos permanecem só na sessão; a URL leva apenas o id da lista. Ao salvar o terceiro favorito sem conta, o modal de listas encolhe e vira um convite único por sessão — “Não perca seus favoritos”, com os três imóveis em leque — com **Fazer login** e **Ignorar** (que mostra o aviso de salvo). O login é **simulado**: qualquer botão (Continuar, Google, Apple) entra, nada digitado é guardado ou enviado. Com a sessão iniciada, “Entrar” vira o avatar, cujo menu leva a Favoritos e a Sair da conta; os demais itens avisam que ficam fora do protótipo. Não há controle de mapa, abas de resultados, seletor de alternativas ou laboratório de animações no percurso vigente.

## Imóvel e contato

O [mini-listing de referência no Figma](https://www.figma.com/design/KcIrcsopqwSQCWp6s8omaI/?node-id=518-16812) ocupa a barra expandida. Resumo, pergunta, formulário breve, reutilização de dados e confirmação usam essa mesma superfície. O resumo combina fatos publicados, compatibilidade com critérios explícitos e pontos a confirmar.

“Ver imóvel” abre uma página interna com a mesma identidade e busca. No mobile, a leitura segue foto → preço e ações de contato → informações. Voltar, avançar e recarregar preservam a rota. Contato e solicitação de visita reabrem a barra; solicitar visita só muda a intenção do contato simulado, sem reservar horário.

O primeiro contato pede nome e um canal: e-mail **ou** WhatsApp. Há validação por campo e uma etapa simulada de registro de 420 ms, protegida contra envio duplicado. Uma pergunta feita no mini-listing acompanha a mensagem. O recibo se associa ao imóvel e ao anunciante correto; imóveis sem associação confirmada são apresentados como anunciante não confirmado.

No contato seguinte, os dados aparecem resumidos e podem ser editados. Nome, e-mail e telefone ficam em `localStorage` para novas visitas. Favoritos e recibos ficam em `sessionStorage`; a sessão também mantém uma cópia legada do perfil para compatibilidade. Nenhum dado de contato, rascunho ou recibo entra na URL. Se o armazenamento for bloqueado ou estiver corrompido, o contato pode ser ensaiado sem garantir persistência.

## Conteúdo e limites

- Catálogo local de 100 anúncios públicos capturados em 28/09/2026: 50 de compra e 50 de aluguel. Uma foto real por imóvel acompanha sua identidade entre cards, mini-listing, interna e contato.
- Não se inventam galeria adicional, selo Premium, andar, vagas, política de pets, medidas de ambientes, janelas ou disponibilidade. Informações ausentes são tratadas como “a confirmar”. O valor de área anômalo de 1 m² não vira medida confiável.
- Há 13 logos de origem registrada e 14 associações verificadas entre anúncio e logo; usos ilustrativos nos cards não determinam o destinatário do contato. Atribuição e arquivos originais permanecem na proveniência.
- Espanhol mexicano é o idioma inicial; português brasileiro e moeda são preferências locais. USD usa conversão demonstrativa fixa de 20 MXN/USD. Endereços, nomes de anunciantes e fatos do catálogo não são traduzidos ou recriados.
- Toda IA, sugestão e ação de contato é simulada no navegador. Não há serviços externos acionados pelos controles, envio de dados, login real, pagamento, crédito, agenda, contato em lote ou análise de fotografias.

## Continuidade

A home Holofote, Onda, menus, histograma, Smart Input, favoritos e a barra branca com filtros laranja são a base preservada. O nome da assistente na interface é **Mora**. A extensão visual atual está em [DESIGN-HANDOFF.md](docs/DESIGN-HANDOFF.md); o roteiro funcional, em [FLOW.md](docs/FLOW.md).

O repositório privado de handoff é [abrantesv/inmuebles24-prototype](https://github.com/abrantesv/inmuebles24-prototype). O [site V2 existente](https://inmuebles24-busca-acompanada-v2.viktorherald.chatgpt.site/) permanece restrito às contas autorizadas; permissões de um serviço não dão acesso ao outro. A CI só verifica testes e build. Uma nova publicação exige configurar seu destino separadamente.
