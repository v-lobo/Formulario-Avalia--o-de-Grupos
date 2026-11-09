# Avaliação de equipes · STEM · Colégio Contato

Publicado em https://formulario-avaliacao-de-grupos.vercel.app/.

## Fluxo dos alunos

1. Escolher unidade, série, turma (com turno) e grupo, em telas sequenciais.
2. Quando o grupo ainda não tem cadastro, informar os nomes de todos os integrantes. A tela começa com dois campos e permite adicionar mais, até 16 integrantes. Nomes vazios ou repetidos são rejeitados.
3. Depois de salvar o cadastro, voltar automaticamente à seleção da unidade.
4. Ao selecionar um grupo cadastrado, escolher o próprio nome na lista de integrantes.
5. Avaliar cada um dos outros integrantes, um por vez, nos cinco critérios de 1 a 5, com observações opcionais. O próprio aluno é excluído automaticamente.
6. Revisar e enviar. O servidor usa os nomes do cadastro e exige exatamente os outros integrantes do grupo.

A lista é cadastrada uma única vez por unidade, série, turma, grupo, ano e semestre. Cadastros concorrentes não sobrescrevem a lista existente. O nome é escolhido pelo aluno; esse fluxo não é autenticação individual.

## Painel do professor

Acesso em `/dashboard.html`, com `ADMIN_PASSWORD` validada no servidor. Oferece filtros, médias por critério, equipe e aluno, observações e CSV em UTF-8.

Em **Configurar quantidade de grupos por turma**, o professor pode aumentar ou diminuir os limites (1 a 99), com efeito na seleção dos alunos. O limite não pode ficar abaixo do maior grupo que já possui integrantes cadastrados. O cadastro de integrantes e a alteração do limite bloqueiam a mesma configuração de turma no banco, evitando corridas entre as operações.

Os valores iniciais e os turnos estão em `public/js/school-config.js`, compartilhado pelo navegador e pelo servidor. Alterações do professor são persistidas em `stem_class_settings`; o arquivo contém apenas os valores iniciais.

## Executar localmente

Requer Node.js 22 ou superior (verificado com 24).

1. `npm ci`
2. Copiar `.env.example` para `.env` e configurar `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `ADMIN_PASSWORD`. A chave legada `SUPABASE_SERVICE_ROLE_KEY` também é aceita.
3. `npm start`
4. Abrir http://localhost:4183.

O projeto Supabase é `contato-atividades` (`vbaedyhqmrmaovnerloo`). Em um banco novo, aplicar `supabase-peer-schema.sql` e depois `supabase-roster-schema.sql`.

- `stem_class_settings`: limites por turma e período.
- `stem_group_rosters`: integrantes com identificadores estáveis, em um cadastro único por grupo e período.
- `stem_peer_submissions`: avaliações individuais, com referência ao cadastro, avaliador e colegas avaliados.

As alterações mantêm as avaliações anteriores. Registros antigos sem cadastro vinculado continuam legíveis no painel. Os esquemas de outros aplicativos não são alterados.

RLS habilitada e acesso direto negado a `anon` e `authenticated`. O servidor usa Secret/service_role. As funções de cadastro e configuração usam `SECURITY INVOKER`, com execução restrita a `service_role`. A ausência de políticas para os clientes é intencional neste modelo ([documentação](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).

`ACADEMIC_YEAR` define o ano letivo (padrão 2026); o semestre é 2. Novos períodos recebem os valores iniciais de configuração e cadastros independentes.

## Publicação

Projeto Vercel: `formulario-avaliacao-de-grupos`, equipe `victors-projects-e6ab6573`. Pasta pública `public`, funções `api`, variáveis somente no servidor. `.env`, `.env.local` e artefatos de teste são ignorados no Git e na publicação.

O comprovante aparece após confirmação do banco. O envio inteiro é gravado em uma operação. Repetir o mesmo UUID não duplica uma avaliação. Rascunhos permanecem apenas na página durante erros e não são armazenados permanentemente no navegador.

## Verificação

`npm test` cobre limites e turnos iniciais, cadastro, nomes repetidos, lista completa de colegas, exclusão do avaliador, nomes canônicos, configuração pelo professor, permissões, repetição de envio e falhas do banco.

Verificação no navegador e no Supabase real: cadastro de três integrantes, retorno à unidade, seleção pelo nome, avaliação dos dois colegas, alteração dos limites e bloqueio de redução abaixo de um grupo cadastrado. Dois cadastros simultâneos para um mesmo grupo retornaram 201 e 409, preservando uma única lista. Os registros fictícios são removidos após a conferência.

## Visual

Cartão central minimalista, logo oficial e cores do Contato, seguindo a prova eletrônica. A seleção em telas sequenciais segue a avaliação de professores.
