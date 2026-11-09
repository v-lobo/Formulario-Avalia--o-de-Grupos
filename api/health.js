const { getSupabase } = require("./_supabase");
const { TABLE, fail } = require("./_shared");
const { ROSTERS } = require("./_groups");
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
    return res.status(200).json({
      connected: true,
      academic_year: Number(process.env.ACADEMIC_YEAR || 2026),
      semester: 2,
    });
  } catch (error) {
    return fail(res, error);
  }
};
