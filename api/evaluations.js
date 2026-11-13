const { getSupabase } = require("./_supabase");
const { isDeepStrictEqual } = require("node:util");
const { TABLE, validate, clean, authorize, fail } = require("./_shared");
const {
  ROSTERS,
  validateContext,
  validateSelection,
  checkRosterEvaluation,
  canonicalSubmission,
} = require("./_groups");
const { loadSettings } = require("./_settings");
const { currentPeriod, checkOpen } = require("./_periods");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "POST") {
    const body = req.body;
    const message =
      validateContext(body) ||
      validate(body, { requireNames: false, enforceGroupLimit: false });
    if (message) return res.status(400).json({ error: message });
    const uuid = (value) =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      );
    if (!uuid(body.roster_id) || !uuid(body.evaluator_id))
      return res
        .status(400)
        .json({ error: "Selecione seu nome no grupo cadastrado." });
    try {
      const current = await currentPeriod(getSupabase());
      const closed = checkOpen(current, body);
      if (closed) return res.status(409).json({ error: closed });
      const config = await loadSettings(getSupabase(), current);
      const invalidSelection = validateSelection(body, config);
      if (invalidSelection)
        return res.status(400).json({ error: invalidSelection });
      const { data: roster, error: rosterError } = await getSupabase()
        .from(ROSTERS)
        .select("*")
        .eq("id", body.roster_id)
        .maybeSingle();
      if (rosterError) throw rosterError;
      const rosterMessage = checkRosterEvaluation(body, roster, current);
      if (rosterMessage) return res.status(400).json({ error: rosterMessage });
      const canonical = canonicalSubmission(body, roster);
      const canonicalError = validate(canonical, { config });
      if (canonicalError)
        return res.status(400).json({ error: canonicalError });
      const row = clean(canonical, current);
      const { error } = await getSupabase().from(TABLE).insert(row);
      if (error?.code === "22023")
        return res.status(409).json({ error: error.message });
      if (error && error.code !== "23505") throw error;
      if (error) {
        const { data, error: readError } = await getSupabase()
          .from(TABLE)
          .select(
            Object.keys(row)
              .filter((key) => key !== "id")
              .concat("deleted_at")
              .join(","),
          )
          .eq("id", row.id)
          .single();
        if (readError) throw readError;
        if (data.deleted_at)
          return res
            .status(409)
            .json({
              error: "Esta resposta foi movida para a lixeira pelo professor.",
            });
        delete data.deleted_at;
        const { id, ...expected } = row;
        const same = isDeepStrictEqual(data, expected);
        if (!same)
          return res.status(409).json({
            error:
              "Esse envio já foi registrado com outras respostas. Inicie uma nova avaliação.",
          });
      }
      return res.status(201).json({ id: row.id, saved: true });
    } catch (error) {
      return fail(res, error);
    }
  }
  if (req.method === "GET") {
    if (!authorize(req, res)) return;
    try {
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        let query = getSupabase()
          .from(TABLE)
          .select("*")
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499);
        query = query.is("deleted_at", null);
        for (const key of [
          "unit",
          "grade",
          "class",
          "group_number",
          "academic_year",
          "semester",
        ])
          if (req.query[key]) query = query.eq(key, req.query[key]);
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) break;
      }
      return res.status(200).json(rows);
    } catch (error) {
      return fail(res, error);
    }
  }
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Método não permitido." });
};
