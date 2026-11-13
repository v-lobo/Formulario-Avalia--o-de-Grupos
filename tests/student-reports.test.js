const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarize } = require('../public/js/student-reports');

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
