const { getSupabase } = require("./_supabase");
const { isDeepStrictEqual } = require("node:util");
const { TABLE, validate, clean, authorize, fail } = require("./_shared");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "POST") {
    const message = validate(req.body);
    if (message) return res.status(400).json({ error: message });
    try {
      const row = clean(req.body);
      const { error } = await getSupabase().from(TABLE).insert(row);
      if (error && error.code !== "23505") throw error;
      if (error) {
        const { data, error: readError } = await getSupabase()
          .from(TABLE)
          .select(
            "evaluator_name,unit,grade,class,group_number,academic_year,semester,members",
          )
          .eq("id", row.id)
          .single();
        if (readError) throw readError;
        const { id, ...expected } = row;
        const same = isDeepStrictEqual(data, expected);
        if (!same)
          return res
            .status(409)
            .json({
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
