const { getSupabase } = require("./_supabase");
const { TABLE, fail } = require("./_shared");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET")
    return res.status(405).json({ error: "Método não permitido." });
  try {
    const { error } = await getSupabase()
      .from(TABLE)
      .select("id", { head: true, count: "exact" });
    if (error) throw error;
    return res
      .status(200)
      .json({
        connected: true,
        academic_year: Number(process.env.ACADEMIC_YEAR || 2026),
        semester: 2,
      });
  } catch (error) {
    return fail(res, error);
  }
};
