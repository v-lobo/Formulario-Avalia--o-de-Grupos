const { getSupabase } = require("./_supabase");
const { authorize, fail } = require("./_shared");
const { validateContext, period } = require("./_groups");
const { loadSettings } = require("./_settings");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Método não permitido." });
  }
  if (req.method === "PATCH" && !authorize(req, res)) return;
  try {
    const client = getSupabase();
    if (req.method === "PATCH") {
      const body = req.body;
      if (
        !body ||
        validateContext({ ...body, group_number: 1 }) ||
        !Number.isInteger(body.groups) ||
        body.groups < 1 ||
        body.groups > 99
      )
        return res
          .status(400)
          .json({
            error:
              "Escolha uma turma válida e uma quantidade de 1 a 99 grupos.",
          });
      await loadSettings(client);
      const { error } = await client.rpc("stem_set_group_limit", {
        p_selection: {
          unit: body.unit,
          grade: body.grade,
          class: body.class,
          ...period(),
        },
        p_group_count: body.groups,
      });
      if (error?.code === "22023")
        return res.status(400).json({ error: error.message });
      if (error) throw error;
    }
    const config = await loadSettings(client);
    return res.status(200).json({ config, ...period() });
  } catch (error) {
    return fail(res, error);
  }
};
