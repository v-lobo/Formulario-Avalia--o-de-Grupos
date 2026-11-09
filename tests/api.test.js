const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { randomUUID } = require("node:crypto");
let handler,
  server,
  calls = [],
  saved = new Map(),
  unavailable = false;
const payload = () => ({
  id: randomUUID(),
  evaluator_name: "Aluno Teste",
  unit: "Farol",
  grade: "6",
  class: "A",
  group_number: 1,
  members: [
    {
      member_name: "Colega Teste",
      responsabilidade: 5,
      relacionamento: 4,
      cooperacao: 3,
      organizacao: 2,
      educacao: 1,
    },
  ],
});
const response = () => ({
  code: 200,
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  status(c) {
    this.code = c;
    return this;
  },
  json(b) {
    this.body = b;
    return this;
  },
});
before(async () => {
  server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    calls.push(req.method);
    res.setHeader("Content-Type", "application/json");
    if (unavailable) {
      res.statusCode = 503;
      return res.end(
        JSON.stringify({ code: "unavailable", message: "Database down" }),
      );
    }
    if (req.method === "POST") {
      const row = JSON.parse(raw);
      if (saved.has(row.id)) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ code: "23505", message: "duplicate" }));
      }
      saved.set(row.id, row);
      res.statusCode = 201;
      return res.end();
    }
    const url = new URL(req.url, "http://localhost"),
      id = url.searchParams.get("id")?.slice(3);
    if (id) {
      const { id: ignore, ...rest } = saved.get(id);
      return res.end(JSON.stringify(rest));
    }
    return res.end(JSON.stringify([...saved.values()]));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.SUPABASE_SECRET_KEY = "sb_secret_local_test";
  process.env.ADMIN_PASSWORD = "local-test";
  handler = require("../api/evaluations");
});
after(() => server.close());
test("envia o formulário completo em uma única gravação", async () => {
  calls = [];
  const r = response();
  await handler({ method: "POST", headers: {}, body: payload() }, r);
  assert.equal(r.code, 201);
  assert.equal(r.body.saved, true);
  assert.deepEqual(calls, ["POST"]);
  assert.equal(saved.get(r.body.id).members.length, 1);
});
test("tentar novamente o mesmo envio não duplica dados", async () => {
  const p = payload(),
    first = response(),
    again = response();
  await handler({ method: "POST", headers: {}, body: p }, first);
  const size = saved.size;
  await handler({ method: "POST", headers: {}, body: p }, again);
  assert.equal(again.code, 201);
  assert.equal(saved.size, size);
  const changed = response();
  p.members[0].educacao = 5;
  await handler({ method: "POST", headers: {}, body: p }, changed);
  assert.equal(changed.code, 409);
});
test("dados inválidos não chegam ao banco", async () => {
  calls = [];
  const p = payload();
  p.members[0].educacao = 0;
  const r = response();
  await handler({ method: "POST", headers: {}, body: p }, r);
  assert.equal(r.code, 400);
  assert.deepEqual(calls, []);
});
test("leitura do painel exige autorização no backend", async () => {
  calls = [];
  const denied = response();
  await handler({ method: "GET", headers: {}, query: {} }, denied);
  assert.equal(denied.code, 401);
  assert.deepEqual(calls, []);
  const allowed = response();
  await handler(
    {
      method: "GET",
      headers: { authorization: "Bearer local-test" },
      query: {},
    },
    allowed,
  );
  assert.equal(allowed.code, 200);
  assert.ok(Array.isArray(allowed.body));
});
test("falha do banco nunca retorna sucesso", async () => {
  unavailable = true;
  const r = response();
  await handler({ method: "POST", headers: {}, body: payload() }, r);
  assert.equal(r.code, 502);
  assert.equal(r.body.saved, undefined);
  unavailable = false;
});
