const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { randomUUID } = require("node:crypto");
const config = require("../public/js/school-config");
let handler,
  groupsHandler,
  settingsHandler,
  server,
  calls = [],
  saved = new Map(),
  rosters = new Map(),
  unavailable = false;
const baseRoster = {
  id: randomUUID(),
  unit: "Farol",
  grade: "6",
  class: "A",
  group_number: 1,
  academic_year: 2026,
  semester: 2,
  members: [
    { id: randomUUID(), name: "Aluno Teste" },
    { id: randomUUID(), name: "Colega Teste" },
  ],
};
const settings = [];
for (const [unit, grades] of Object.entries(config))
  for (const [grade, classes] of Object.entries(grades))
    for (const [cls, info] of Object.entries(classes))
      settings.push({ unit, grade, class: cls, group_count: info.groups });
const ratings = (id) => ({
  member_id: id,
  responsabilidade: 5,
  relacionamento: 4,
  cooperacao: 3,
  organizacao: 2,
  educacao: 1,
});
const payload = (roster = baseRoster) => ({
  id: randomUUID(),
  unit: roster.unit,
  grade: roster.grade,
  class: roster.class,
  group_number: roster.group_number,
  roster_id: roster.id,
  evaluator_id: roster.members[0].id,
  members: roster.members.slice(1).map((member) => ratings(member.id)),
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
const request = async (handler, body, method = "POST", auth = "") => {
  const res = response();
  await handler(
    {
      method,
      headers: auth ? { authorization: "Bearer " + auth } : {},
      body,
      query: body,
    },
    res,
  );
  return res;
};
before(async () => {
  rosters.set(baseRoster.id, baseRoster);
  server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const url = new URL(req.url, "http://localhost");
    calls.push({ method: req.method, path: url.pathname });
    res.setHeader("Content-Type", "application/json");
    const reply = (status, data) => {
      res.statusCode = status;
      res.end(data === undefined ? "" : JSON.stringify(data));
    };
    if (unavailable)
      return reply(503, { code: "unavailable", message: "Database down" });
    if (url.pathname.endsWith("/stem_class_settings"))
      return reply(200, settings);
    if (url.pathname.endsWith("/rpc/stem_set_group_limit")) {
      const { p_selection: s, p_group_count: count } = JSON.parse(raw),
        row = settings.find(
          (r) =>
            r.unit === s.unit && r.grade === s.grade && r.class === s.class,
        );
      const max = Math.max(
        0,
        ...[...rosters.values()]
          .filter(
            (r) =>
              r.unit === s.unit && r.grade === s.grade && r.class === s.class,
          )
          .map((r) => r.group_number),
      );
      if (count < max)
        return reply(400, {
          code: "22023",
          message: `Grupo ${max} já cadastrado`,
        });
      row.group_count = count;
      return reply(200);
    }
    if (url.pathname.endsWith("/rpc/stem_register_group")) {
      const { p_roster: row } = JSON.parse(raw);
      if (
        [...rosters.values()].some((r) =>
          [
            "unit",
            "grade",
            "class",
            "group_number",
            "academic_year",
            "semester",
          ].every((k) => r[k] === row[k]),
        )
      )
        return reply(409, { code: "23505", message: "duplicate" });
      rosters.set(row.id, row);
      return reply(200);
    }
    if (url.pathname.endsWith("/stem_group_rosters")) {
      const matches = [...rosters.values()].filter((r) =>
        [...url.searchParams]
          .filter(([k]) => !["select", "limit"].includes(k))
          .every(([k, v]) => String(r[k]) === v.slice(3)),
      );
      return reply(200, matches);
    }
    if (req.method === "POST") {
      const row = JSON.parse(raw);
      if (saved.has(row.id))
        return reply(409, { code: "23505", message: "duplicate" });
      saved.set(row.id, row);
      return reply(201);
    }
    const id = url.searchParams.get("id")?.slice(3);
    if (id) {
      const { id: ignore, ...row } = saved.get(id);
      return reply(200, row);
    }
    return reply(200, [...saved.values()]);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.SUPABASE_SECRET_KEY = "sb_secret_local_test";
  process.env.ADMIN_PASSWORD = "local-test";
  handler = require("../api/evaluations");
  groupsHandler = require("../api/groups");
  settingsHandler = require("../api/settings");
});
after(() => server.close());
test("salva todos os colegas em uma única gravação, com nomes canônicos do cadastro", async () => {
  calls = [];
  const p = payload();
  p.evaluator_name = "Nome adulterado";
  p.members[0].member_name = "Outra pessoa";
  const r = await request(handler, p);
  assert.equal(r.code, 201);
  assert.equal(saved.get(r.body.id).evaluator_name, "Aluno Teste");
  assert.equal(saved.get(r.body.id).members[0].member_name, "Colega Teste");
  assert.equal(
    calls.filter(
      (call) =>
        call.method === "POST" && call.path.endsWith("/stem_peer_submissions"),
    ).length,
    1,
  );
});
test("repetir envio não duplica, mas mudar respostas com o mesmo UUID gera conflito", async () => {
  const p = payload();
  await request(handler, p);
  const size = saved.size;
  assert.equal((await request(handler, p)).code, 201);
  assert.equal(saved.size, size);
  p.members[0].educacao = 5;
  assert.equal((await request(handler, p)).code, 409);
});
test("notas inválidas são rejeitadas antes de acessar o banco", async () => {
  calls = [];
  const p = payload();
  p.members[0].educacao = 0;
  assert.equal((await request(handler, p)).code, 400);
  assert.deepEqual(calls, []);
});
test("recusa avaliador inexistente, autoavaliação, integrante estranho e colega faltando", async () => {
  for (const mutate of [
    (p) => (p.evaluator_id = randomUUID()),
    (p) => (p.members[0].member_id = p.evaluator_id),
    (p) => (p.members[0].member_id = randomUUID()),
    (p) => (p.members = []),
  ]) {
    const p = payload();
    mutate(p);
    assert.equal((await request(handler, p)).code, 400);
  }
  const p = payload();
  p.unit = "Jatiúca";
  assert.equal((await request(handler, p)).code, 400);
});
test("recusa envios do fluxo antigo sem cadastro do grupo", async () => {
  const p = payload();
  delete p.roster_id;
  assert.equal((await request(handler, p)).code, 400);
});
test("consulta apenas o grupo selecionado e permite cadastro uma única vez", async () => {
  const selection = {
    unit: "Jatiúca",
    grade: "6",
    class: "D",
    group_number: 12,
  };
  assert.equal(
    (await request(groupsHandler, selection, "GET")).body.roster,
    null,
  );
  const first = await request(groupsHandler, {
    ...selection,
    names: ["Pessoa Um", "Pessoa Dois", "Pessoa Três"],
  });
  assert.equal(first.code, 201);
  const repeated = await request(groupsHandler, {
    ...selection,
    names: ["Pessoa Quatro", "Pessoa Cinco"],
  });
  assert.equal(repeated.code, 409);
  const existing = (await request(groupsHandler, selection, "GET")).body.roster;
  assert.equal(existing.members.length, 3);
  assert.equal(existing.members[0].name, "Pessoa Um");
  assert.equal(
    (await request(groupsHandler, { ...selection, group_number: 13 }, "GET"))
      .code,
    400,
  );
});
test("configuração do professor aumenta grupos e impede redução abaixo do cadastro", async () => {
  const cls = { unit: "Jatiúca", grade: "6", class: "D" };
  assert.equal(
    (await request(settingsHandler, { ...cls, groups: 15 }, "PATCH")).code,
    401,
  );
  assert.equal(
    (
      await request(
        settingsHandler,
        { ...cls, groups: 15 },
        "PATCH",
        "local-test",
      )
    ).code,
    200,
  );
  const newGroup = {
    ...cls,
    group_number: 15,
    names: ["Aluno Novo", "Colega Novo"],
  };
  assert.equal((await request(groupsHandler, newGroup)).code, 201);
  const roster = (await request(groupsHandler, newGroup, "GET")).body.roster;
  const fullRoster = { ...newGroup, ...roster };
  assert.equal((await request(handler, payload(fullRoster))).code, 201);
  assert.equal(
    (
      await request(
        settingsHandler,
        { ...cls, groups: 14 },
        "PATCH",
        "local-test",
      )
    ).code,
    400,
  );
});
test("leitura de avaliações exige autorização no backend", async () => {
  calls = [];
  assert.equal((await request(handler, {}, "GET")).code, 401);
  assert.deepEqual(calls, []);
  assert.equal((await request(handler, {}, "GET", "local-test")).code, 200);
});
test("falha no banco nunca retorna sucesso", async () => {
  unavailable = true;
  assert.equal((await request(handler, payload())).code, 502);
  unavailable = false;
});
