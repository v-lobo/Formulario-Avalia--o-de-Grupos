const { getSupabase } = require("./_supabase");
const { fail } = require("./_shared");
const {
  validateContext,
  validateSelection,
  validateRoster,
  rosterRow,
  findRoster,
} = require("./_groups");
const { loadSettings } = require("./_settings");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Método não permitido." });
  }
  const body = req.method === "GET" ? req.query : req.body;
  const invalid = validateContext(body);
  if (invalid) return res.status(400).json({ error: invalid });
  if (req.method === "POST") {
    const message = validateRoster(body.names);
    if (message) return res.status(400).json({ error: message });
  }
  try {
    const client = getSupabase();
    const config = await loadSettings(client);
    const invalidSelection = validateSelection(body, config);
    if (invalidSelection)
      return res.status(400).json({ error: invalidSelection });
    if (req.method === "GET") {
      const { data, error } = await findRoster(getSupabase(), body);
      if (error) throw error;
      return res
        .status(200)
        .json({ roster: data ? { id: data.id, members: data.members } : null });
    }
    const row = rosterRow(body);
    const { error } = await client.rpc("stem_register_group", {
      p_roster: row,
    });
    if (error?.code === "23505")
      return res
        .status(409)
        .json({
          error:
            "Este grupo já foi cadastrado. Volte ao início e escolha seu nome.",
          already_registered: true,
        });
    if (error?.code === "22023")
      return res.status(400).json({ error: error.message });
    if (error) throw error;
    return res.status(201).json({ registered: true });
  } catch (error) {
    return fail(res, error);
  }
};
