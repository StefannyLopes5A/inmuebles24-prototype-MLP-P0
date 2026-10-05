# Inmuebles24 prototype

Leia PRODUCT.md, docs/FLOW.md e docs/DESIGN-HANDOFF.md antes de mudar a experiência. README.md explica execução; docs/ARCHITECTURE.md mapeia o código.

- Preserve a home Holofote, a transição Onda, os filtros existentes e o desktop aprovado. Use branches `codex/` para trabalho de agentes e alterações focadas.
- O mini-listing e todos os estados de contato ficam na barra de busca expandida. O imóvel completo usa a rota interna. Não reintroduza modal de imóvel ou laboratório de alternativas.
- Todas as interações são simuladas e locais. Não adicione serviços, credenciais, envio real de contato ou publicação automática sem pedido explícito.
- Preserve a identidade do catálogo e a proveniência dos assets. Preferência do usuário não é fato sobre o imóvel; atributos desconhecidos continuam a confirmar.
- Após alterações, rode `npm run check` e confira os estados afetados em desktop, 390 px e 320 px. Respeite movimento reduzido, foco e teclado.
- Nunca inclua dados pessoais reais de teste, credenciais, caches ou contexto privado. Não publique nem convide colaboradores sem autorização.

Referência do mini-listing: https://www.figma.com/design/KcIrcsopqwSQCWp6s8omaI/?node-id=518-16812
