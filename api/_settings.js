const { CONFIG, period } = require("./_groups");
const SETTINGS = "stem_class_settings";
async function loadSettings(client, current = period()) {
  const read = () =>
    client
      .from(SETTINGS)
      .select("unit,grade,class,group_count")
      .eq("academic_year", current.academic_year)
      .eq("semester", current.semester);
  let { data, error } = await read();
  if (error) throw error;
  const missing = [];
  for (const [unit, grades] of Object.entries(CONFIG))
    for (const [grade, classes] of Object.entries(grades))
      for (const [cls, info] of Object.entries(classes)) {
        if (
          !data.some(
            (row) =>
              row.unit === unit && row.grade === grade && row.class === cls,
          )
        )
          missing.push({
            ...current,
            unit,
            grade,
            class: cls,
            group_count: info.groups,
          });
      }
  if (missing.length) {
    const result = await client.from(SETTINGS).upsert(missing, {
      onConflict: "academic_year,semester,unit,grade,class",
      ignoreDuplicates: true,
    });
    if (result.error) throw result.error;
    const resultRead = await read();
    if (resultRead.error) throw resultRead.error;
    data = resultRead.data;
  }
  const config = structuredClone(CONFIG);
  for (const row of data)
    if (config[row.unit]?.[row.grade]?.[row.class])
      config[row.unit][row.grade][row.class].groups = row.group_count;
  return config;
}
module.exports = { SETTINGS, loadSettings };
