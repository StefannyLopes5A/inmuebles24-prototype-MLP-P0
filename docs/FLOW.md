# Fluxo de validação · busca acompanhada

Percurso implementado em **05/10/2026**. O objetivo é verificar se alguém consegue sair de uma intenção inicial, avaliar alternativas e simular contatos com mais de um anunciante sem perder critérios nem repetir o cadastro. Todas as respostas e ações são locais.

## Preparar a sessão

1. Rode o projeto conforme [README.md](../README.md) e use dados fictícios, como `Pessoa Teste` e `pessoa@example.com`.
2. Para testar primeiro contato, remova o perfil conforme [reset direcionado](ARCHITECTURE.md#armazenamento-e-reset-do-perfil). O perfil persiste entre visitas; abrir novamente o site não o apaga.
3. Comece em `/`. Espanhol mexicano e MXN são os padrões; o seletor de idioma fica no rodapé e a moeda no header. Se já houver preferência salva, ela será retomada.

## Construir e refinar a busca

1. **Escolher operação e tipo.** Aceite explicitamente comprar e apartamento na frase, mesmo se já aparecerem como sugestão. Ajuste bairro, quartos e preço. Confirme que o CTA só libera após as duas escolhas. Como base reproduzível, use Narvarte Poniente, 2+ quartos e até MXN 7.500.000.
2. **Iniciar a busca.** Observe a primeira dobra se retrair, a Onda revelar filtros e os skeletons darem lugar à grade. Uma nova interação deve interromper a sequência sem travar a busca. Com movimento reduzido, os controles ficam disponíveis imediatamente.
3. **Editar por menu.** Abra bairro ou orçamento na barra compacta. A frase expande, os filtros chegam laranja e completos e o menu abre ao terminar a revelação. Altere o valor, confira a atualização sem Aplicar e feche a barra. No histograma, teste clique/arraste das barras e os campos; o perfil gráfico é ilustrativo.
4. **Editar por texto.** Use o Smart Input para pedir `3 quartos` ou `hasta 8 millones`. Confira os tokens e os critérios resultantes. Faça uma pergunta sobre os bairros e verifique que ela não altera filtros silenciosamente. Remova um token e recarregue para conferir que não reaparece.
5. **Explorar a assistência.** Diga que precisa trabalhar em casa e escolha canto na sala, quarto dedicado ou coworking. A seleção representa intenção, sem atribuir essa característica a um imóvel. Para uma sugestão de bairro, recolha a barra, role de fato além de 300 px e pause por 750 ms. Só deve aparecer se houver alternativas e nenhuma edição ou imóvel aberto; escolha um bairro ou recuse.

## Avaliar e contatar imóveis

1. **Abrir um card.** Confira foto, endereço, preço, atributos, anunciante e resumo no mini-listing dentro da barra. Dados não confirmados devem continuar “a confirmar”. A lista usa pelo menos 40 cards para explorar o layout; só parte deles pode corresponder exatamente à busca.
2. **Fazer uma pergunta.** Use “Tirar uma dúvida” / “Resolver una duda”. Uma questão sobre medidas pode usar a área publicada; uma pergunta sobre janela ou planta deve pedir confirmação. Ao seguir para contato, a pergunta acompanha a mensagem simulada.
3. **Registrar o primeiro contato.** Preencha nome e e-mail ou WhatsApp. Envie um campo inválido para conferir a mensagem junto dele e a preservação dos outros dados. Corrija e envie: o estado de registro dura 420 ms e impede duplicação. A confirmação permanece na barra e o recibo pertence àquele imóvel/anunciante.
4. **Abrir a interna.** Use “Ver imóvel” / “Ver inmueble”; compare a identidade com o mini-listing. Teste recarregar, voltar e avançar. No mobile, preço e contato vêm logo após a foto. “Falar com imobiliária” e “Solicitar visita” abrem contato na barra; não há agendamento real. Rolar essa página não deve disparar sugestões proativas de bairro.
5. **Contatar outro imóvel.** Volte aos resultados e abra outro card. O formulário resume o perfil já preenchido e oferece edição; o novo recibo tem outro imóvel e seu próprio destinatário. Reabra a aplicação no mesmo navegador para conferir a reutilização entre visitas. Nome, e-mail, telefone e recibos não devem aparecer na URL.

## Outras entradas e checagens

| Situação | Comportamento esperado |
| --- | --- |
| Escolher uma ideia da home | Aplica a busca completa e conta como operação/tipo explícitos. |
| Prévia por foto, foco ou toque | Abre o imóvel correspondente e conserva sua identidade. |
| Fechar, clicar fora ou Escape | Recolhe a superfície e preserva os critérios; devolve a exploração. |
| Favoritar e trocar idioma/moeda | Mantém o imóvel e a busca; o coração muda de cor. USD continua demonstrativo. |
| Armazenamento bloqueado | Permite ensaiar contato em memória; reutilização futura pode não persistir. |

Em desktop de 1512 × 982, confira as duas colunas do mini-listing. Em 390 px e 320 px, percorra resumo, pergunta, formulário e sucesso: o conteúdo rola dentro da barra, fechar permanece alcançável e os campos de contato usam 16 px. Teste Tab, Shift+Tab e Escape, além de movimento reduzido. Essas verificações no navegador não equivalem a teste em aparelho físico.

## Vídeo de demonstração

O roteiro é desktop, sem áudio, narração, legendas ou elementos de apresentação adicionados à interface. Mostrar home e escolhas → Onda → menu e Smart Input → qualificação/sugestão → favorito e mini-listing → interna → primeiro contato → segundo contato com reutilização. As pausas devem permitir leitura, e a gravação deve retratar o build entregue. Duração e URL só devem ser informadas após conferir o arquivo final.

## Estado da entrega

O percurso está implementado e a revisão visual final liberou a entrega após a correção da ordem de conteúdo da interna no mobile. As capturas e os limites estão em [DESIGN-HANDOFF.md](DESIGN-HANDOFF.md#evidências-e-limites). Para a verificação automatizada, execute `npm run check`: 57 testes V2, 4 testes Sites e build. Safari nativo, aparelhos físicos e eficácia do conceito com usuários ainda não foram validados.
