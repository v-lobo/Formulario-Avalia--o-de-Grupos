# Referência visual · Avaliação de equipes

## PDFs · identidade institucional

Revisão em 13/11/2026: vermelho institucional `#e8432c` na faixa, nos acentos e no rodapé; vermelho escuro `#a92f24` nos destaques de texto; fundos suaves `#fff2ef` e texto principal `#282735`. A logo oficial aparece no cabeçalho, com período e identificação do STEM alinhados à direita. O resumo, as continuações e as páginas individuais compartilham o mesmo cabeçalho e rodapé.

Os tamanhos do gráfico e dos indicadores foram preservados a pedido do usuário: gráfico de 180 × 85 mm, média individual em 17 pt e média do recorte em 19 pt. As cinco cores da escala de satisfação são mantidas para consistência com o painel. A revisão altera somente a apresentação dos PDFs, sem mudar cálculos, ordenação ou conteúdo do Excel.

Análise realizada em 10/11/2026, a partir das páginas públicas e do painel aberto no navegador:

- [Avaliação dos Professores](https://avaliacao-professores.vercel.app/): início, identificação e estilos de avaliação.
- [Painel da Coordenação](https://avaliacao-professores.vercel.app/coordenacao): visão geral, respostas e estilos de login.

As medidas abaixo vêm dos arquivos `base.css`, `aluno.css` e `coord.css` servidos pela referência. O resultado local foi conferido no navegador. O escopo inclui formulário dos alunos e painel do professor, conforme confirmado pelo usuário.

## Tipografia

Fonte Nunito, com pesos 500, 700, 800 e 900, carregada pelo Google Fonts. Texto principal em azul-marinho `#141e46`; texto secundário `#4b5170`; metadados `#80849b`. Entrelinha geral de 1,45.

| Elemento da referência | Medida | Aplicação em equipes |
| --- | --- | --- |
| Título da etapa | 24 px, peso 900 | Seleção de unidade, série, turma e grupo |
| Nome do avaliado | 27,2–35,2 px, peso 900 | Nome do colega na avaliação |
| Opções de identificação | 18,4 px, peso 800 | Unidade, série, turma, grupo e nomes |
| Texto do critério | 17,28 px, peso 800 | Título de cada critério |
| Opções da escala | 15,2 px, peso 800 | Rótulos completos de satisfação |
| Título do painel | 25,6 px, peso 900 | Gestão das avaliações |
| Título de bloco do painel | 17,6 px, peso 900 | Análises e tabelas |
| Valor dos indicadores | 32 px, peso 900 | Cartões de totais e médias |
| Tabelas | 14,4 px; cabeçalho 12 px | Listagens do professor |
| Rótulos dos filtros | 13,6 px, peso 800 | Filtros e buscas |

O título grande da abertura dos professores (28,8–41,6 px) não foi introduzido como uma nova tela: o formulário de equipes continua começando na escolha da unidade.

## Cartões e espaçamento

- Fundo geral `#f6f6f8`, superfícies brancas e faixa superior de 6 px em degradê: `#f6a42c → #e8432c → #c2306f`, a 120°.
- Cartões principais com raio de 14 px e sombra `0 1px 2px rgba(20,30,70,.06), 0 4px 16px rgba(20,30,70,.06)`.
- Área dos alunos com largura máxima de 900 px, incluindo margens internas de 16–40 px; cartão com conteúdo interno de 20–40 px.
- Área do painel com largura máxima de 1240 px; blocos internos com 20 px de preenchimento e distância de 18 px.
- Login do professor com largura máxima de 380 px, preenchimento de 32 px e logo de 52 px de altura.

## Seletores, botões e busca

| Componente | Padrão aplicado |
| --- | --- |
| Cartões de escolha | Altura mínima de 64 px, borda de 2 px `#c9c9d4`, raio de 10 px, intervalo de 12,8 px |
| Grade de opções | Colunas automáticas com mínimo de 140 px; turmas e grupos com mínimo de 96 px |
| Botões principais | Altura mínima de 48 px, raio de 999 px, fonte 16,8 px e peso 800 |
| Ações do painel | Altura mínima de 38 px, fonte 15,2 px |
| Abas do painel | Pílulas; ativa em marinho com texto branco |
| Inputs do cadastro e login | Altura mínima de 46 px, borda de 1 px e raio de 10 px |
| Selects do painel | Altura mínima de 38 px, borda de 1 px e raio de 10 px |
| Buscas de respostas e cadastros | Mesma tipografia, altura de 38 px, borda e raio dos inputs do painel |
| Opções da escala | Altura mínima de 58 px, borda de 2 px, raio de 10 px e seleção em marinho |
| Foco por teclado | Contorno de 3 px em laranja `#f39a2b` |

A tela de respostas da referência apresenta filtros, sem uma busca textual equivalente às buscas existentes em equipes. Por isso, as buscas foram adaptadas ao padrão dos campos do painel; sua lógica foi preservada.

## Adaptação e comportamento

As etapas sequenciais, cadastros, regras de avaliação, valores numéricos de 1 a 5, observações e recursos de gestão permanecem os do projeto de equipes. Os rótulos de satisfação já existentes passam a aparecer em cada opção, como na referência. O turno aparece abaixo da letra da turma.

A navegação dos alunos usa uma barra fixa no rodapé, com espaço reservado para não cobrir o fim do formulário. No celular, a escala se organiza verticalmente abaixo de 620 px, seguindo a referência; filtros e abas quebram linha. Tabelas largas permitem rolagem dentro do próprio bloco.

## Arquivos

- `public/css/ui.css`: cores, tipografia, foco e controles compartilhados.
- `public/css/form.css`: layout dos alunos, escolhas, avaliação e revisão.
- `public/css/dashboard.css`: login, cabeçalho, abas, filtros, indicadores e tabelas.
- `public/css/dashboard-controls.css`: estrutura dos recursos de gestão já existentes, complementada pelo tema do painel.

As alterações visuais são locais; esta tarefa não publica o projeto.

## Verificação realizada

- `npm test`: 32 testes passaram, sem falhas.
- Sintaxe dos scripts de formulário e painel verificada com `node --check`.
- Demonstração local com dados fictícios: seleção das etapas, cadastro de integrantes, avaliação dos colegas, revisão, envio com comprovante e consulta do envio no painel.
- Login, quatro abas, busca por comprovante, busca sem resultados e abertura/cancelamento do diálogo de gestão conferidos no navegador.
- Layout conferido em desktop e em uma área de 390 px de largura: escolhas com 64 px de altura, buscas e selects com 38 px, escala vertical e ausência de transbordamento horizontal na página. As tabelas usam rolagem interna.
- Nenhum erro de console observado no painel durante a conferência.
