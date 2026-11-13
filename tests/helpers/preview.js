// Preview local descartável. Usa PostgreSQL em memória, nunca o Supabase real.
const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { createDatabase } = require("./database");
const tables = new Set([
  "stem_class_settings",
  "stem_group_rosters",
  "stem_peer_submissions",
  "stem_form_periods",
  "stem_peer_drafts",
]);
const functions = new Set([
  "stem_register_group",
  "stem_set_group_limit",
  "stem_manage_period",
  "stem_manage_record",
  "stem_save_peer_draft",
]);
function identifier(value) {
  if (!/^[a-z_]+$/.test(value))
    throw new Error("Identificador inválido no preview");
  return '"' + value + '"';
}
async function start() {
  const db = await createDatabase();
  const context = {
    academic_year: 2026,
    semester: 2,
    unit: "Farol",
    grade: "6",
    class: "A",
    group_number: 1,
  };
  const members = [
    "Ana · Demonstração",
    "Bruno · Demonstração",
    "Clara · Demonstração",
  ].map((name) => ({ id: randomUUID(), name }));
  const roster = { ...context, id: randomUUID(), members };
  await db.query("select public.stem_register_group($1::jsonb)", [
    JSON.stringify(roster),
  ]);
  for (let n = 0; n < 3; n++) {
    const evaluator = members[n === 2 ? 0 : n];
    const ratings = members
      .filter((m) => m.id !== evaluator.id)
      .map((m) => ({
        member_id: m.id,
        member_name: m.name,
        responsabilidade: 4,
        relacionamento: 5,
        cooperacao: 3,
        organizacao: 4,
        educacao: 5,
        responsabilidade_obs: "Resposta fictícia para conferir o painel.",
        relacionamento_obs: "",
        cooperacao_obs: "",
        organizacao_obs: "",
        educacao_obs: "",
      }));
    await db.query(
      `insert into public.stem_peer_submissions(id,evaluator_name,unit,grade,class,group_number,academic_year,semester,members,roster_id,evaluator_id)
      values($1,$2,'Farol','6','A',1,2026,2,$3::jsonb,$4,$5)`,
      [
        randomUUID(),
        evaluator.name,
        JSON.stringify(ratings),
        roster.id,
        evaluator.id,
      ],
    );
  }
  const rest = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const url = new URL(req.url, "http://localhost");
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      const parts = url.pathname.split("/").filter(Boolean);
      const name = parts.at(-1);
      if (parts.includes("rpc")) {
        if (!functions.has(name)) throw new Error("RPC inválida no preview");
        const args = Object.entries(body),
          values = args.map(([, v]) =>
            v && typeof v === "object" ? JSON.stringify(v) : v,
          );
        await db.query(
          `select public.${identifier(name)}(${args.map(([k], i) => identifier(k) + ` => $${i + 1}`).join(",")})`,
          values,
        );
        return res.end("null");
      }
      if (!tables.has(name)) {
        res.statusCode = 404;
        return res.end("{}");
      }
      if (req.method === "POST") {
        for (const row of Array.isArray(body) ? body : [body]) {
          const entries = Object.entries(row),
            values = entries.map(([, v]) =>
              v && typeof v === "object" ? JSON.stringify(v) : v,
            );
          await db.query(
            `insert into public.${identifier(name)}(${entries.map(([k]) => identifier(k)).join(",")}) values(${values.map((_, i) => `$${i + 1}`).join(",")})`,
            values,
          );
        }
        res.statusCode = 201;
        return res.end("");
      }
      const columns = url.searchParams.get("select") || "*",
        values = [],
        where = [];
      for (const [key, val] of url.searchParams) {
        if (["select", "order", "limit", "offset"].includes(key)) continue;
        if (val === "is.null") where.push(`${identifier(key)} is null`);
        else if (val.startsWith("eq.")) {
          values.push(val.slice(3));
          where.push(`${identifier(key)} = $${values.length}`);
        } else throw new Error("Filtro inválido no preview");
      }
      const order = (url.searchParams.get("order") || "")
        .split(",")
        .filter(Boolean)
        .map((s) => {
          const [column, direction] = s.split(".");
          return identifier(column) + (direction === "desc" ? " desc" : " asc");
        });
      const limit = Math.min(
          Number(url.searchParams.get("limit") || 10000),
          10000,
        ),
        offset = Number(url.searchParams.get("offset") || 0);
      const query =
        `select ${columns === "*" ? "*" : columns.split(",").map(identifier).join(",")} from public.${identifier(name)}` +
        (where.length ? " where " + where.join(" and ") : "") +
        (order.length ? " order by " + order.join(",") : "") +
        ` limit ${limit} offset ${offset}`;
      const { rows } = await db.query(query, values);
      if (req.headers.accept?.includes("vnd.pgrst.object")) {
        if (rows.length !== 1) {
          res.statusCode = 406;
          return res.end(
            JSON.stringify({ code: "PGRST116", message: "Expected one row" }),
          );
        }
        return res.end(JSON.stringify(rows[0]));
      }
      res.setHeader(
        "Content-Range",
        `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
      );
      res.end(req.method === "HEAD" ? "" : JSON.stringify(rows));
    } catch (error) {
      res.statusCode = error.code === "23505" ? 409 : 400;
      res.end(
        JSON.stringify({
          code: error.code || "preview_error",
          message: error.message,
        }),
      );
    }
  });
  await new Promise((resolve) => rest.listen(0, "127.0.0.1", resolve));
  process.env.SUPABASE_URL = `http://127.0.0.1:${rest.address().port}`;
  process.env.SUPABASE_SECRET_KEY = "sb_secret_local_preview_only";
  process.env.ADMIN_PASSWORD = "preview-stem";
  process.env.PORT = process.env.PREVIEW_PORT || "4185";
  console.log(
    "Preview com dados fictícios. Senha de demonstração: preview-stem",
  );
  require("../../server");
}
start().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
