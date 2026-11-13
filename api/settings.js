const { getSupabase } = require("./_supabase");
const { authorize, fail } = require("./_shared");
const { validateContext } = require("./_groups");
const { loadSettings } = require("./_settings");
const { currentPeriod, validPeriod, PERIODS } = require("./_periods");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Método não permitido." });
  }
  if (req.method === "PATCH" && !authorize(req, res)) return;
  try {
    const client = getSupabase();
    let current = await currentPeriod(client);
    const source = req.method === "PATCH" ? req.body : req.query;
    if (source?.academic_year !== undefined || source?.semester !== undefined) {
      if (req.method === "GET" && !authorize(req, res)) return;
      const year = Number(source.academic_year),
        semester = Number(source.semester);
      if (!validPeriod(year, semester))
        return res.status(400).json({ error: "Período inválido." });
      const { data, error } = await client
        .from(PERIODS)
        .select("*")
        .eq("academic_year", year)
        .eq("semester", semester)
        .maybeSingle();
      if (error) throw error;
      if (!data)
        return res.status(404).json({ error: "Período não encontrado." });
      current = data;
    }
    if (req.method === "PATCH") {
      const body = req.body;
      if (
        !body ||
        validateContext({ ...body, group_number: 1 }) ||
        !Number.isInteger(body.groups) ||
        body.groups < 1 ||
        body.groups > 99
      )
        return res.status(400).json({
          error: "Escolha uma turma válida e uma quantidade de 1 a 99 grupos.",
        });
      await loadSettings(client, current);
      const { error } = await client.rpc("stem_set_group_limit", {
        p_selection: {
          unit: body.unit,
          grade: body.grade,
          class: body.class,
          academic_year: current.academic_year,
          semester: current.semester,
        },
        p_group_count: body.groups,
      });
      if (error?.code === "22023")
        return res.status(400).json({ error: error.message });
      if (error) throw error;
    }
    const config = await loadSettings(client, current);
    return res
      .status(200)
      .json({
        config,
        academic_year: current.academic_year,
        semester: current.semester,
        is_open: current.is_open,
      });
  } catch (error) {
    return fail(res, error);
  }
};
