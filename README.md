# Avaliação de equipes · STEM · Colégio Contato

Publicado em https://formulario-avaliacao-de-grupos.vercel.app/.

## Fluxo dos alunos

1. Escolher unidade, série, turma (com turno) e grupo, em telas sequenciais.
2. Quando o grupo ainda não tem cadastro, informar os nomes de todos os integrantes. A tela começa com dois campos e permite adicionar mais, até 16 integrantes. Nomes vazios ou repetidos são rejeitados.
3. Depois de salvar o cadastro, voltar automaticamente à seleção da unidade.
4. Ao selecionar um grupo cadastrado, escolher o próprio nome na lista de integrantes.
5. Avaliar cada um dos outros integrantes, um por vez, nos cinco critérios de 1 a 5, com observações opcionais. O próprio aluno é excluído automaticamente.
6. Revisar e enviar. O servidor usa os nomes do cadastro e exige exatamente os outros integrantes do grupo.

A lista possui um cadastro ativo por unidade, série, turma, grupo, ano e semestre. Cadastros concorrentes não sobrescrevem a lista existente. O professor pode remover um cadastro para liberar o grupo para novo cadastro. O nome é escolhido pelo aluno; esse fluxo não é autenticação individual, por decisão de uso. Após o envio completo, o nome deixa de aparecer na seleção.

As notas e observações são salvas automaticamente em `stem_peer_drafts`, sem entrar nas médias do professor. Ao escolher novamente seu nome, inclusive em outro dispositivo, o aluno retoma o primeiro colega com critérios pendentes. Notas parciais também são recuperadas. O navegador guarda uma cópia temporária de alterações ainda não confirmadas pelo servidor; o status informa quando a sincronização falha e oferece nova tentativa. O envio final continua exigindo todos os colegas e os cinco critérios; somente esse envio oculta o nome e elimina o rascunho na mesma transação.

## Painel do professor

Acesso em `/dashboard.html`, com `ADMIN_PASSWORD` validada no servidor. Oferece filtros, médias por critério, equipe e aluno, observações e CSV em UTF-8.

Em **Acompanhamento por aluno**, os botões de PDF e Excel exportam somente os alunos dos filtros ativos. Ao exportar PDF, o professor escolhe **Relatório completo** ou **Somente resumo**. O resumo abre o PDF com os alunos separados por unidade/turma e em ordem alfabética, suas médias finais e a média do recorte (média aritmética das médias finais, com o mesmo peso para cada aluno). Listas grandes continuam em outras páginas. O relatório completo acrescenta uma página por aluno com média final e distribuição por categoria. A exportação individual oferece a mesma escolha, considerando somente aquele aluno. O arquivo `.xlsx` traz resumo com médias numéricas por critério e uma aba por aluno com contagens das notas e o gráfico incorporado como imagem. Ao clicar no nome, também é possível baixar somente o PDF ou Excel desse aluno. As bibliotecas são locais e carregadas apenas durante a exportação; `npm run assets` atualiza os arquivos de `public/js/vendor` a partir das versões fixadas no lockfile.

- **Visão geral:** médias e participação por turma. O número de respondentes distintos é separado do número de envios; registros antigos sem cadastro podem ter respondentes sem integrantes cadastrados correspondentes.
- **Respostas:** busca por nome ou comprovante, data e hora, detalhes das notas e observações, indicação de possíveis repetições e lixeira com restauração. A indicação usa o mesmo integrante no mesmo cadastro; não identifica pessoas pela identidade real e não elimina nada automaticamente.
- **Cadastros:** consulta de integrantes e remoção reversível do cadastro. Remover libera o grupo para novo cadastro e move suas respostas ativas à lixeira na mesma transação. Restaurar o cadastro também restaura somente as respostas removidas junto com ele; respostas removidas individualmente permanecem na lixeira. Se já houver novo cadastro ativo, a restauração é recusada até remover o novo cadastro. Um limite reduzido deve ser aumentado antes de restaurar um grupo acima dele.
- **Formulários:** abertura e fechamento por ano/semestre, criação de novos períodos copiando somente a configuração das turmas e backup CSV do período completo, incluindo a lixeira. Somente um período fica atual e aberto. Um período criado começa fechado, sem copiar alunos ou respostas. O CSV do topo exporta somente as respostas ativas dos filtros de turma; o backup ignora esses filtros.

Todas as ações de gestão exigem senha no backend. A lixeira usa `deleted_at`, mantém o motivo e não oferece exclusão definitiva. Os indicadores e a API de leitura normal excluem a lixeira. O banco bloqueia novos cadastros e avaliações se a coleta estiver fechada, inclusive quando um navegador antigo tenta enviar uma página já aberta.

Em **Configurar quantidade de grupos por turma**, o professor pode aumentar ou diminuir os limites (1 a 99), com efeito na seleção dos alunos. O limite não pode ficar abaixo do maior grupo que já possui integrantes cadastrados. O cadastro de integrantes e a alteração do limite bloqueiam a mesma configuração de turma no banco, evitando corridas entre as operações.

Os valores iniciais e os turnos estão em `public/js/school-config.js`, compartilhado pelo navegador e pelo servidor. Alterações do professor são persistidas em `stem_class_settings`; o arquivo contém apenas os valores iniciais.

## Executar localmente

Requer Node.js 22 ou superior (verificado com 24).

1. `npm ci`
2. Copiar `.env.example` para `.env` e configurar `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `ADMIN_PASSWORD`. A chave legada `SUPABASE_SERVICE_ROLE_KEY` também é aceita.
3. `npm start`
4. Abrir http://localhost:4183.

O projeto Supabase é `contato-atividades` (`vbaedyhqmrmaovnerloo`). Em um banco novo, aplicar `supabase-peer-schema.sql`, depois `supabase-roster-schema.sql` e as migrações de `supabase/migrations` em ordem de nome. Em um banco existente, aplicar somente as migrações ainda não executadas, uma vez cada.

- `stem_class_settings`: limites por turma e período.
- `stem_group_rosters`: integrantes com identificadores estáveis, em um cadastro único por grupo e período.
- `stem_peer_submissions`: avaliações individuais, com referência ao cadastro, avaliador e colegas avaliados.
- `stem_peer_drafts`: respostas em andamento, separadas dos resultados e vinculadas ao cadastro e avaliador.
- `stem_form_periods`: períodos, abertura da coleta e identificação do período atual.

As alterações mantêm as avaliações anteriores. Registros antigos sem cadastro vinculado continuam legíveis no painel. Os esquemas de outros aplicativos não são alterados.

RLS habilitada e acesso direto negado a `anon` e `authenticated`. O servidor usa Secret/service_role. As funções de cadastro e configuração usam `SECURITY INVOKER`, com execução restrita a `service_role`. A ausência de políticas para os clientes é intencional neste modelo ([documentação](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).

O período dos alunos vem de `stem_form_periods`, configurado no dashboard. A migração inicia 2026/2 aberto para preservar a coleta existente. `ACADEMIC_YEAR` permanece apenas como padrão dos helpers antigos; não seleciona o formulário publicado. Novos períodos copiam os limites da origem selecionada e recebem cadastros independentes.

### Demonstração local sem credenciais reais

Executar `npm run preview:demo` e abrir http://localhost:4185/dashboard.html. Senha de demonstração: `preview-stem`. O servidor usa PostgreSQL em memória (PGlite), com dados fictícios e uma camada REST local para o cliente Supabase. Não lê `.env`, não consulta o banco real e descarta os dados ao encerrar. `PREVIEW_PORT` permite usar outra porta. Para reiniciar os dados, encerrar e iniciar novamente.

## Publicação

Projeto Vercel: `formulario-avaliacao-de-grupos`, equipe `victors-projects-e6ab6573`. Pasta pública `public`, funções `api`, variáveis somente no servidor. `.env`, `.env.local` e artefatos de teste são ignorados no Git e na publicação.

Fluxo obrigatório: **commit → push → deploy**. A produção acompanha `main` no GitHub; o push nessa branch deve gerar o deployment pela integração Git da Vercel. Antes do commit, revisar as mudanças e executar `npm test` (e `npm run assets` se as bibliotecas de exportação forem atualizadas). Não publicar arquivos locais sem commit. Depois do push, aguardar o deployment e conferir seu SHA e o domínio de produção. As instruções persistentes estão em `AGENTS.md`.

As migrações de gestão e de bloqueio por integrante já estão em produção, registradas em 10/11/2026 com os nomes `dashboard_management` e `single_evaluator_submission`. A migração `resumable_peer_drafts` foi aplicada em 13/11/2026 antes da publicação do recurso. Os horários/versões registrados pelo Supabase podem diferir dos nomes dos arquivos locais; verificar também o nome e o esquema para não reaplicar uma migração existente. Para rollback, preservar as migrações e uma versão do backend compatível com a lixeira. Não operar a lixeira com o backend anterior à gestão.

A senha administrativa identificada no histórico deve ser trocada em todos os ambientes que a reutilizam, seguida de novo deployment. A chave legada `service_role` encontrada no projeto Supabase anterior deve ser revogada/rotacionada nesse projeto antes da limpeza do histórico. Não incluir valores reais em commits, documentação ou logs. Esta implementação não rotaciona credenciais nem reescreve o histórico automaticamente.

O comprovante aparece após confirmação do banco. O envio inteiro é gravado em uma operação. Repetir o mesmo UUID não duplica uma avaliação. Em bancos novos, a retomada depende das migrações `supabase/migrations/20261110132517_single_evaluator_submission.sql` e `supabase/migrations/20261113121452_resumable_peer_drafts.sql`, nessa ordem, depois da migração de gestão. A última cria somente a tabela de rascunhos, suas funções e a limpeza transacional; não altera respostas anteriores.

## Verificação

`npm test` cobre limites e turnos iniciais, cadastro, nomes repetidos, lista completa de colegas, exclusão do avaliador, nomes canônicos, configuração pelo professor, permissões, repetição de envio e falhas do banco. Inclui execução do SQL real em PGlite para validar fechamento, troca de período, cópia dos limites, lixeira, restauração, conflito de recadastro e privilégios dos papéis. Esses testes não usam credenciais nem dados de produção.

Verificação no navegador e no Supabase real: cadastro de três integrantes, retorno à unidade, seleção pelo nome, avaliação dos dois colegas, alteração dos limites e bloqueio de redução abaixo de um grupo cadastrado. Dois cadastros simultâneos para um mesmo grupo retornaram 201 e 409, preservando uma única lista. Os registros fictícios são removidos após a conferência.

## Visual

Cartão central minimalista, logo oficial e cores do Contato, seguindo a prova eletrônica. A seleção em telas sequenciais segue a avaliação de professores.
