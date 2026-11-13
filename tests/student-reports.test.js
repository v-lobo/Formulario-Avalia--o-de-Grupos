const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarize, summarizeSelection } = require('../public/js/student-reports');

test('relatório calcula médias e distribuição somente das avaliações recebidas do aluno', () => {
  const student = { name: 'Clara', received: 2, evaluations: [
    { responsabilidade: 1, relacionamento: 2, cooperacao: 3, organizacao: 4, educacao: 5 },
    { responsabilidade: 5, relacionamento: 4, cooperacao: 3, organizacao: 2, educacao: 1 },
  ] };
  const report = summarize(student);
  assert.equal(report.mean, 3);
  assert.deepEqual(report.categories.map(c => c.mean), [3, 3, 3, 3, 3]);
  assert.deepEqual(report.categories[0].counts, [1, 0, 0, 0, 1]);
  assert.equal(report.categories[0].satisfied, 0.5);
  assert.deepEqual(report.categories[2].counts, [0, 0, 2, 0, 0]);
  assert.equal(report.categories[2].satisfied, 0);
});

const student = (name, label, note, received = 1, classLabel) => ({
  name, label, received, classLabel,
  evaluations: Array.from({ length: received }, () => ({ responsabilidade: note, relacionamento: note, cooperacao: note, organizacao: note, educacao: note })),
});

test('média do recorte dá o mesmo peso a cada aluno, mesmo com quantidades diferentes de avaliações', () => {
  const selection = summarizeSelection([
    student('Ana', 'Farol · 6º A · G1', 5),
    student('Bruno', 'Farol · 6º A · G2', 1, 3),
  ]);
  assert.equal(selection.mean, 3);
  assert.equal(selection.classes.length, 1);
  assert.deepEqual(selection.students.map(s => s.groupNumber), ['1', '2']);
});

test('resumo separa unidades e turmas e ordena nomes com acentos, independentemente do grupo', () => {
  const source = [
    student('Zélia', 'Farol · 6º A · G1', 4),
    student('Bruno', 'Jatiúca · 6º A · G1', 2),
    student('Ágata', 'Farol · 6º A · G2', 3),
    student('Ana', 'Farol · 6º A · G1', 5),
  ];
  const selection = summarizeSelection(source);
  assert.deepEqual(selection.classes.map(c => c.label), ['Farol · 6º A', 'Jatiúca · 6º A']);
  assert.deepEqual(selection.classes[0].students.map(s => s.name), ['Ágata', 'Ana', 'Zélia']);
  assert.equal(source[0].name, 'Zélia');
  const individual = summarizeSelection([source[0]]);
  assert.equal(individual.students.length, 1);
  assert.equal(individual.mean, 4);
});
