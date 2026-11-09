const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validate, clean, authorize } = require("../api/_shared");
const { randomUUID } = require("node:crypto");
const valid = () => ({
  id: randomUUID(),
  evaluator_name: "Aluna Exemplo",
  unit: "Farol",
  grade: "6",
  class: "A",
  group_number: 1,
  members: [
    {
      member_name: "Colega Exemplo",
      responsabilidade: 5,
      relacionamento: 4,
      cooperacao: 3,
      organizacao: 2,
      educacao: 1,
    },
  ],
});
test("aceita avaliação individual completa sem campos de liderança", () => {
  const body = valid();
  assert.equal(validate(body), null);
  const row = clean(body);
  assert.equal(row.semester, 2);
  assert.equal(row.academic_year, 2026);
  assert.equal(row.evaluator_name, body.evaluator_name);
  assert.equal("leader_name" in row, false);
});
test("recusa nota ausente, zero, decimal ou acima de cinco", () => {
  for (const value of [undefined, 0, 2.5, 6, "5"]) {
    const b = valid();
    b.members[0].organizacao = value;
    assert.ok(validate(b));
  }
});
test("recusa autoavaliação e colegas repetidos com acentos, espaços e caixa diferentes", () => {
  const b = valid();
  b.evaluator_name = "  JOÃO   SILVA ";
  b.members[0].member_name = "Joao Silva";
  assert.ok(validate(b));
  const c = valid();
  c.members.push({ ...c.members[0], member_name: " COLEGA  EXEMPLO " });
  assert.ok(validate(c));
});
test("recusa turma incompatível e arrays vazios ou grandes", () => {
  const b = valid();
  b.class = "E";
  assert.ok(validate(b));
  b.class = "A";
  b.members = [];
  assert.ok(validate(b));
  b.members = Array(16).fill(valid().members[0]);
  assert.ok(validate(b));
});
test("limita observações e não aceita cliente escolher período ou campos extras", () => {
  const b = valid();
  b.academic_year = 1900;
  b.semester = 1;
  b.extra = "campo";
  const row = clean(b);
  assert.equal(row.semester, 2);
  assert.equal(row.academic_year, 2026);
  assert.equal("extra" in row, false);
  b.members[0].educacao_obs = "x".repeat(1201);
  assert.ok(validate(b));
});
test("protege os dados do professor no servidor", () => {
  process.env.ADMIN_PASSWORD = "senha-teste";
  const response = {
    statusCode: 200,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(body) {
      this.body = body;
    },
    setHeader() {},
  };
  assert.equal(authorize({ headers: {} }, response), false);
  assert.equal(response.statusCode, 401);
  assert.equal(
    authorize({ headers: { authorization: "Bearer senha-teste" } }, response),
    true,
  );
  delete process.env.ADMIN_PASSWORD;
  assert.equal(authorize({ headers: {} }, response), false);
  assert.equal(response.statusCode, 503);
});
test("endpoints antigos deixam de gravar avaliações e de expor dados", () => {
  for (const endpoint of [
    "members",
    "leader",
    "delete",
    "stats",
    "evaluation",
  ]) {
    const res = {
      status(c) {
        this.code = c;
        return this;
      },
      json(b) {
        this.body = b;
      },
    };
    require("../api/" + endpoint)({ method: "POST" }, res);
    assert.equal(res.code, 410);
  }
});
