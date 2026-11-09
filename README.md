# Avaliação de equipes · STEM · Colégio Contato

Formulário individual para o segundo semestre: cada aluno identifica sua equipe e avalia os outros integrantes nos mesmos cinco critérios (notas de 1 a 5 e observações opcionais).

## Executar localmente

Requer Node.js 22 ou superior.

1. `npm ci`
2. Copie `.env.example` para `.env` e configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `ADMIN_PASSWORD`. A chave legada `SUPABASE_SERVICE_ROLE_KEY` também é aceita. As chaves ficam apenas no servidor.
3. `npm start`
4. Abra http://localhost:4183. O painel fica em `/dashboard.html`.

O projeto Supabase escolhido é `contato-atividades` (`vbaedyhqmrmaovnerloo`). A tabela `public.stem_peer_submissions` foi criada em 09/11/2026. `supabase-peer-schema.sql` documenta a estrutura reproduzível. As tabelas e os esquemas de outros aplicativos foram preservados. As avaliações antigas não são transferidas automaticamente.

## Publicar na Vercel

Mantenha o projeto Vercel associado a este repositório. Configure as mesmas variáveis do `.env.example` no servidor da Vercel. A pasta pública é `public`, com funções em `api`. Node.js 24 é a versão local verificada. O endereço em produção depende do projeto Vercel selecionado. Não publique o `.env`.

O formulário só mostra o comprovante depois que o banco confirma a gravação. Uma tentativa repetida com o mesmo UUID não duplica o registro. O conjunto de colegas é salvo em uma única operação, sem sessões incompletas por gravações separadas.

As APIs antigas de liderança retornam 410. Os dados históricos do banco antigo não são apagados nem reescritos. A chave antiga gravada no histórico Git precisa ser revogada na conta de origem, caso o projeto volte a ficar disponível.

## Acesso e período

- Alunos enviam avaliações pelo servidor; não têm acesso de leitura ao banco.
- O painel valida `ADMIN_PASSWORD` no backend. A senha fica somente em memória durante a sessão do painel.
- RLS habilitada, sem permissões para `anon` e `authenticated`; o servidor usa a chave Secret/service_role.
- Ano letivo configurável por `ACADEMIC_YEAR` (padrão 2026); semestre fixado em 2 no servidor.
- O painel oferece filtros, médias por critério, equipe e aluno, observações e CSV em UTF-8.
- A identificação usa nomes digitados pelos alunos. Sem lista oficial de integrantes ou autenticação individual, o sistema não garante identidade nem que todos os colegas foram incluídos. A instrução é avaliar todos os demais; nomes duplicados e o próprio nome são rejeitados.
- Respostas ficam na página durante falhas de envio. Não há armazenamento permanente de rascunhos no navegador.

## Verificação

`npm test` verifica validação, acesso do professor, gravação única, repetição idempotente e falhas do armazenamento. Os testes de API usam um servidor local simulado. O teste SQL no Supabase real foi executado com `ROLLBACK` e deixou zero registros de teste. A conferência visual usa o navegador local; o teste completo navegador → API → Supabase foi concluído, incluindo leitura no painel e exportação CSV, usando dados fictícios depois removidos.

## Identidade visual

Logo oficial e referências visuais de `v-lobo/prova-eletronica`: azul `#252544`, vermelho `#e3221b`, fundo `#f2f3f7`, cartões claros e cantos arredondados. Apenas a identidade visual foi reutilizada.
