const { getSupabase } = require("./_supabase");
const { authorize, fail, TABLE } = require("./_shared");
const { ROSTERS } = require("./_groups");
const { PERIODS, validPeriod } = require("./_periods");
const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
async function allRows(client, table, year, semester) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq("academic_year", year)
      .eq("semester", semester)
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ error: "Método não permitido." });
  }
  if (!authorize(req, res)) return;
  try {
    const client = getSupabase();
    if (req.method === "GET") {
      const { data: periods, error } = await client
        .from(PERIODS)
        .select("*")
        .order("academic_year", { ascending: false })
        .order("semester", { ascending: false });
      if (error) throw error;
      const current = periods.find((p) => p.is_current);
      const year = Number(req.query.academic_year || current?.academic_year);
      const semester = Number(req.query.semester || current?.semester);
      if (!validPeriod(year, semester))
        return res.status(400).json({ error: "Período inválido." });
      if (
        !periods.some(
          (p) => p.academic_year === year && p.semester === semester,
        )
      )
        return res.status(404).json({ error: "Período não encontrado." });
      const [submissions, rosters] = await Promise.all([
        allRows(client, TABLE, year, semester),
        allRows(client, ROSTERS, year, semester),
      ]);
      return res
        .status(200)
        .json({ periods, submissions, rosters, academic_year: year, semester });
    }
    const b = req.body || {};
    if (req.method === "POST") {
      if (
        !["create", "open", "close"].includes(b.action) ||
        !validPeriod(b.academic_year, b.semester) ||
        (b.action === "create" &&
          !validPeriod(b.source_year, b.source_semester))
      )
        return res
          .status(400)
          .json({ error: "Informe uma ação e um período válidos." });
      const { error } = await client.rpc("stem_manage_period", {
        p_action: b.action,
        p_year: b.academic_year,
        p_semester: b.semester,
        p_source_year: b.source_year ?? null,
        p_source_semester: b.source_semester ?? null,
      });
      if (error) throw error;
      return res
        .status(b.action === "create" ? 201 : 200)
        .json({ saved: true });
    }
    if (
      !["submission", "roster"].includes(b.kind) ||
      !uuid(b.id) ||
      !["trash", "restore"].includes(b.action) ||
      (b.reason !== undefined &&
        (typeof b.reason !== "string" || b.reason.length > 300))
    )
      return res
        .status(400)
        .json({ error: "Selecione um registro e uma ação válidos." });
    const { error } = await client.rpc("stem_manage_record", {
      p_kind: b.kind,
      p_id: b.id,
      p_restore: b.action === "restore",
      p_reason: (b.reason || "").trim(),
    });
    if (error) throw error;
    return res.status(200).json({ saved: true });
  } catch (error) {
    if (["22023", "23505"].includes(error.code))
      return res.status(409).json({
        error:
          error.code === "23505"
            ? "Já existe um cadastro ativo para este grupo ou período."
            : error.message,
      });
    if (error.code === "P0002")
      return res.status(404).json({ error: "Registro não encontrado." });
    return fail(res, error);
  }
};
