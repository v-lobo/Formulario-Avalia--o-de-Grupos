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
const { currentPeriod, checkOpen } = require("./_periods");
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
    const current = await currentPeriod(client);
    const closed = checkOpen(current, body);
    if (closed) return res.status(409).json({ error: closed });
    const [config, rosterResult] = await Promise.all([
      loadSettings(client, current),
      req.method === "GET" ? findRoster(client, body, current) : Promise.resolve(null),
    ]);
    const invalidSelection = validateSelection(body, config);
    if (invalidSelection)
      return res.status(400).json({ error: invalidSelection });
    if (req.method === "GET") {
      const { data, error } = rosterResult;
      if (error) throw error;
      let submitted = [];
      if (data) {
        const result = await client.from("stem_peer_submissions").select("evaluator_id").eq("roster_id", data.id).is("deleted_at", null);
        if (result.error) throw result.error;
        submitted = result.data.map((r) => r.evaluator_id);
      }
      return res
        .status(200)
        .json({ roster: data ? { id: data.id, members: data.members, submitted_evaluator_ids: submitted } : null });
    }
    const row = rosterRow(body, current);
    const { error } = await client.rpc("stem_register_group", {
      p_roster: row,
    });
    if (error?.code === "23505")
      return res.status(409).json({
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
