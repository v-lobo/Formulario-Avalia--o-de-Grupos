const PERIODS = "stem_form_periods";
const validPeriod = (year, semester) =>
  Number.isInteger(year) &&
  year >= 2020 &&
  year <= 2100 &&
  Number.isInteger(semester) &&
  [1, 2].includes(semester);
async function currentPeriod(client) {
  const { data, error } = await client
    .from(PERIODS)
    .select("*")
    .eq("is_current", true)
    .single();
  if (error) throw error;
  return data;
}
function checkOpen(period, body = {}) {
  if (!period.is_open)
    return "O formulário está fechado. Aguarde a abertura pelo professor.";
  if (
    (body.academic_year !== undefined &&
      Number(body.academic_year) !== period.academic_year) ||
    (body.semester !== undefined && Number(body.semester) !== period.semester)
  )
    return "O período do formulário mudou. Volte ao início e atualize a página.";
  return null;
}
module.exports = { PERIODS, validPeriod, currentPeriod, checkOpen };
