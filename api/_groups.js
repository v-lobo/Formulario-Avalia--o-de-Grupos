const crypto = require("node:crypto");
const CONFIG = require("../public/js/school-config");
const { normalize } = require("./_shared");
const ROSTERS = "stem_group_rosters";
const period = () => ({
  academic_year: Number(process.env.ACADEMIC_YEAR || 2026),
  semester: 2,
});
function selection(body) {
  return {
    unit: body.unit,
    grade: body.grade,
    class: body.class,
    group_number: Number(body.group_number),
    ...period(),
  };
}
function validateContext(body) {
  if (
    !body ||
    typeof body.unit !== "string" ||
    typeof body.grade !== "string" ||
    typeof body.class !== "string"
  )
    return "Selecione unidade, série e turma.";
  if (
    !["Farol", "Jatiúca"].includes(body.unit) ||
    !["6", "7"].includes(body.grade) ||
    !Object.hasOwn(CONFIG[body.unit][body.grade], body.class)
  )
    return "Unidade, série ou turma inválida.";
  const group = Number(body.group_number);
  if (!Number.isInteger(group) || group < 1 || group > 99)
    return "Escolha um grupo válido.";
  return null;
}
function validateSelection(body, config = CONFIG) {
  const invalid = validateContext(body);
  if (invalid) return invalid;
  const entry = config[body.unit]?.[body.grade]?.[body.class];
  if (!entry) return "Unidade, série ou turma inválida.";
  if (!entry.groups) return "Os grupos desta turma ainda não foram definidos.";
  const group = Number(body.group_number);
  if (!Number.isInteger(group) || group < 1 || group > entry.groups)
    return `Escolha um grupo de 1 a ${entry.groups} para esta turma.`;
  return null;
}
function validateRoster(names) {
  if (!Array.isArray(names) || names.length < 2 || names.length > 16)
    return "Cadastre de 2 a 16 integrantes.";
  if (
    names.some(
      (name) => typeof name !== "string" || !name.trim() || name.length > 160,
    )
  )
    return "Preencha o nome de todos os integrantes (até 160 caracteres).";
  if (new Set(names.map(normalize)).size !== names.length)
    return "Há nomes repetidos. Informe cada integrante uma única vez.";
  return null;
}
function rosterRow(body) {
  return {
    id: crypto.randomUUID(),
    ...selection(body),
    members: body.names.map((name) => ({
      id: crypto.randomUUID(),
      name: name.trim().replace(/\s+/g, " "),
    })),
  };
}
async function findRoster(client, body) {
  let query = client.from(ROSTERS).select("*");
  for (const [key, value] of Object.entries(selection(body)))
    query = query.eq(key, value);
  return query.maybeSingle();
}
function checkRosterEvaluation(body, roster) {
  if (!roster || roster.id !== body.roster_id)
    return "O grupo selecionado não foi cadastrado.";
  const expectedContext = selection(body);
  if (
    Object.entries(expectedContext).some(
      ([key, value]) => roster[key] !== value,
    )
  )
    return "A identificação não corresponde ao grupo cadastrado.";
  const evaluator = roster.members.find(
    (member) => member.id === body.evaluator_id,
  );
  if (!evaluator) return "Selecione seu nome na lista do grupo.";
  const expected = roster.members.filter(
    (member) => member.id !== evaluator.id,
  );
  if (!Array.isArray(body.members) || body.members.length !== expected.length)
    return "Avalie todos os outros integrantes do grupo.";
  const ids = body.members.map((member) => member?.member_id);
  if (
    new Set(ids).size !== ids.length ||
    expected.some((member) => !ids.includes(member.id))
  )
    return "A avaliação deve conter exatamente os outros integrantes do seu grupo.";
  return null;
}
function canonicalSubmission(body, roster) {
  const evaluator = roster.members.find(
    (member) => member.id === body.evaluator_id,
  );
  return {
    ...body,
    evaluator_name: evaluator.name,
    members: roster.members
      .filter((member) => member.id !== evaluator.id)
      .map((member) => ({
        ...body.members.find((rating) => rating.member_id === member.id),
        member_name: member.name,
      })),
  };
}
module.exports = {
  ROSTERS,
  CONFIG,
  period,
  selection,
  validateContext,
  validateSelection,
  validateRoster,
  rosterRow,
  findRoster,
  checkRosterEvaluation,
  canonicalSubmission,
};
