# Publicação deste projeto

- O fluxo adotado pelo usuário é **commit → push → deploy**.
- A branch de produção é `main`, no repositório `v-lobo/Formulario-Avalia--o-de-Grupos`.
- O projeto Vercel é `formulario-avaliacao-de-grupos` (`prj_lxbKK5FoG2ICkZBZAiswL74K1wBU`), equipe `victors-projects-e6ab6573` (`team_Gx19q4VQyB20iw57x8y3AdSv`).
- Antes de publicar, revisar o diff, executar `npm run assets` quando as bibliotecas de exportação mudarem e executar `npm test`. Não incluir credenciais, `.env`, `.vercel`, dependências instaladas ou artefatos de teste no commit.
- Registrar todas as alterações da versão em um commit e enviar esse commit ao GitHub antes de iniciar qualquer deployment. Preferir o deployment automático do push em `main`.
- Não publicar uma pasta com alterações sem commit. Caso seja necessário acionar o deployment manualmente, usar a referência Git exata já enviada, preservando a correspondência entre o código publicado e o commit.
- Acompanhar o deployment até concluir, verificar que o domínio de produção aponta para o commit enviado e conferir a saúde da API e os recursos alterados.
- O banco Supabase `contato-atividades` (`vbaedyhqmrmaovnerloo`) é compartilhado. Inspecionar o histórico e o esquema antes de aplicar somente migrações pendentes. Preservar respostas, cadastros e esquemas de outros aplicativos.
