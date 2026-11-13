const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createDatabase } = require("./helpers/database");

test("SQL real: períodos, lixeira, recadastro e privilégios", async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  const context = {
    academic_year: 2026,
    semester: 2,
    unit: "Farol",
    grade: "6",
    class: "A",
    group_number: 1,
  };
  const roster = {
    ...context,
    id: randomUUID(),
    members: [
      { id: randomUUID(), name: "Pessoa A" },
      { id: randomUUID(), name: "Pessoa B" },
    ],
  };
  const row = () => ({
    ...context,
    id: randomUUID(),
    roster_id: roster.id,
    evaluator_id: roster.members[0].id,
    evaluator_name: "Pessoa A",
    members: [
      {
        member_id: roster.members[1].id,
        member_name: "Pessoa B",
        responsabilidade: 5,
        relacionamento: 4,
        cooperacao: 3,
        organizacao: 2,
        educacao: 1,
      },
    ],
  });
  const register = (r) =>
    db.query("select public.stem_register_group($1::jsonb)", [
      JSON.stringify(r),
    ]);
  const insert = (r) =>
    db.query(
      "insert into public.stem_peer_submissions select * from jsonb_populate_record(null::public.stem_peer_submissions, $1::jsonb)",
      [
        JSON.stringify({
          ...r,
          created_at: new Date().toISOString(),
          delete_reason: "",
        }),
      ],
    );
  const manage = (kind, id, restore) =>
    db.query("select public.stem_manage_record($1, $2::uuid, $3, 'Teste')", [
      kind,
      id,
      restore,
    ]);
  const first = row(),
    second = row();
  await t.test(
    "período inicial aberto e múltiplos envios permitidos",
    async () => {
      await register(roster);
      await insert(first);
      await insert(second);
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.stem_peer_submissions",
          )
        ).rows[0].n,
        2,
      );
    },
  );
  await t.test(
    "remoção individual é reversível e não é desfeita ao restaurar cadastro",
    async () => {
      await manage("submission", first.id, false);
      await manage("roster", roster.id, false);
      const all = (
        await db.query(
          "select id, deleted_at, deleted_with_roster from public.stem_peer_submissions order by id",
        )
      ).rows;
      assert.ok(all.every((r) => r.deleted_at));
      assert.equal(
        all.find((r) => r.id === first.id).deleted_with_roster,
        null,
      );
      assert.equal(
        all.find((r) => r.id === second.id).deleted_with_roster,
        roster.id,
      );
      await assert.rejects(
        manage("submission", second.id, true),
        /Restaure primeiro/,
      );
      await manage("roster", roster.id, true);
      assert.ok(
        (
          await db.query(
            "select deleted_at from public.stem_peer_submissions where id=$1",
            [first.id],
          )
        ).rows[0].deleted_at,
      );
      assert.equal(
        (
          await db.query(
            "select deleted_at from public.stem_peer_submissions where id=$1",
            [second.id],
          )
        ).rows[0].deleted_at,
        null,
      );
      await manage("submission", first.id, true);
    },
  );
  await t.test(
    "recadastro liberado e restauração conflitante não perde dados",
    async () => {
      await manage("roster", roster.id, false);
      await assert.rejects(insert(row()), /cadastro foi removido/);
      const replacement = { ...roster, id: randomUUID() };
      await register(replacement);
      await assert.rejects(manage("roster", roster.id, true), /novo cadastro/);
      await manage("roster", replacement.id, false);
      await manage("roster", roster.id, true);
    },
  );
  await t.test(
    "fechamento bloqueia gravações no banco, inclusive por cliente antigo",
    async () => {
      await db.query("select public.stem_manage_period('close', 2026, 2)");
      await assert.rejects(insert(row()), /formulário está fechado/);
      await assert.rejects(
        register({ ...roster, id: randomUUID(), group_number: 2 }),
        /formulário está fechado/,
      );
      await db.query("select public.stem_manage_period('open', 2026, 2)");
      await insert(row());
    },
  );
  await t.test(
    "novo período copia configuração sem copiar cadastros ou respostas",
    async () => {
      await db.query(
        "select public.stem_manage_period('create', 2027, 1, 2026, 2)",
      );
      const p = (
        await db.query(
          "select * from public.stem_form_periods where academic_year=2027",
        )
      ).rows[0];
      assert.equal(p.is_open, false);
      assert.equal(p.is_current, false);
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.stem_class_settings where academic_year=2027",
          )
        ).rows[0].n,
        12,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.stem_group_rosters where academic_year=2027",
          )
        ).rows[0].n,
        0,
      );
      await db.query("select public.stem_manage_period('open', 2027, 1)");
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.stem_form_periods where is_open",
          )
        ).rows[0].n,
        1,
      );
      await assert.rejects(insert(row()), /período mudou/);
      await assert.rejects(
        db.query(
          "select public.stem_manage_period('create', 2027, 1, 2026, 2)",
        ),
        { code: "23505" },
      );
    },
  );
  await t.test(
    "restauração respeita o limite de grupos e não altera outros registros",
    async () => {
      await manage("roster", roster.id, false);
      const upper = {
        ...roster,
        id: randomUUID(),
        group_number: 8,
        academic_year: 2027,
        semester: 1,
      };
      await register(upper);
      await manage("roster", upper.id, false);
      await db.query("select public.stem_set_group_limit($1::jsonb, 2)", [
        JSON.stringify(upper),
      ]);
      await assert.rejects(
        manage("roster", upper.id, true),
        /Aumente a quantidade/,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.stem_peer_submissions",
          )
        ).rows[0].n,
        3,
      );
    },
  );
  await t.test(
    "anon e authenticated não podem consultar tabelas nem executar gestão",
    async () => {
      const grants = (
        await db.query(`select r.rolname,
      has_table_privilege(r.rolname, 'public.stem_form_periods', 'select') as can_read,
      has_function_privilege(r.rolname, 'public.stem_manage_record(text,uuid,boolean,text)', 'execute') as can_manage
      from pg_roles r where rolname in ('anon','authenticated','service_role')`)
      ).rows;
      for (const r of grants) {
        assert.equal(r.can_read, r.rolname === "service_role");
        assert.equal(r.can_manage, r.rolname === "service_role");
      }
      await db.exec("set role service_role");
      await db.query("select public.stem_manage_period('close', 2027, 1)");
      await manage("submission", first.id, false);
      await db.exec("reset role");
    },
  );
});
