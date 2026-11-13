const { PGlite } = require("@electric-sql/pglite");
const fs = require("node:fs");
const path = require("node:path");
const config = require("../../public/js/school-config");
async function createDatabase() {
  const db = await PGlite.create();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls;",
    );
    for (const file of [
      "supabase-peer-schema.sql",
      "supabase-roster-schema.sql",
      "supabase/migrations/20261110124955_dashboard_management.sql",
      "supabase/migrations/20261113121452_resumable_peer_drafts.sql",
    ])
      await db.exec(
        fs.readFileSync(path.join(__dirname, "../..", file), "utf8"),
      );
    for (const [unit, grades] of Object.entries(config))
      for (const [grade, classes] of Object.entries(grades))
        for (const [cls, info] of Object.entries(classes))
          await db.query(
            "insert into public.stem_class_settings values (2026, 2, $1, $2, $3, $4)",
            [unit, grade, cls, info.groups],
          );
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
module.exports = { createDatabase };
