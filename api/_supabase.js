const { createClient } = require("@supabase/supabase-js");
let client;
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const error = new Error(
      "O armazenamento das avaliações ainda não foi configurado. Avise o professor.",
    );
    error.status = 503;
    throw error;
  }
  if (!client)
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return client;
}
module.exports = { getSupabase };
