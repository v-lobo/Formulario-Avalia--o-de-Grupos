const { getSupabase } = require("./_supabase");
const { TABLE, fail } = require("./_shared");
const { ROSTERS } = require("./_groups");
const { currentPeriod } = require("./_periods");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET")
    return res.status(405).json({ error: "Método não permitido." });
  try {
    const checks = await Promise.all(
      [TABLE, ROSTERS].map((table) =>
        getSupabase().from(table).select("id", { head: true, count: "exact" }),
      ),
    );
    for (const check of checks) if (check.error) throw check.error;
    const current = await currentPeriod(getSupabase());
    return res.status(200).json({
      connected: true,
      academic_year: current.academic_year,
      semester: current.semester,
      is_open: current.is_open,
    });
  } catch (error) {
    return fail(res, error);
  }
};
