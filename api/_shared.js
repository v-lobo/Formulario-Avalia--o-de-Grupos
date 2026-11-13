const crypto = require("node:crypto");
const SCHOOL_CONFIG = require("../public/js/school-config");
const TABLE = "stem_peer_submissions";
const CRITERIA = [
  "responsabilidade",
  "relacionamento",
  "cooperacao",
  "organizacao",
  "educacao",
];
const CLASS_MAP = {
  "Farol-6": ["A", "B"],
  "Farol-7": ["A"],
  "Jatiúca-6": ["A", "B", "C", "D", "E"],
  "Jatiúca-7": ["A", "B", "C", "D"],
};
const normalize = (value) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
const text = (value, max) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
function validate(
  body,
  {
    requireNames = true,
    config = SCHOOL_CONFIG,
    enforceGroupLimit = true,
  } = {},
) {
  if (!body) return "Avaliação inválida.";
  if (requireNames && !text(body.evaluator_name, 160))
    return "Informe seu nome completo.";
  if (!CLASS_MAP[`${body.unit}-${body.grade}`]?.includes(body.class))
    return "Selecione uma unidade, série e turma válidas.";
  if (
    !Number.isInteger(body.group_number) ||
    body.group_number < 1 ||
    body.group_number >
      (enforceGroupLimit
        ? config[body.unit]?.[body.grade]?.[body.class]?.groups || 0
        : 99)
  )
    return "Selecione um grupo válido para esta turma.";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.id || "",
    )
  )
    return "Identificador da avaliação inválido.";
  if (
    !Array.isArray(body.members) ||
    body.members.length < 1 ||
    body.members.length > 15
  )
    return "Adicione de 1 a 15 colegas.";
  const names = new Set(requireNames ? [normalize(body.evaluator_name)] : []);
  for (const member of body.members) {
    if (!member || (requireNames && !text(member.member_name, 160)))
      return "Informe o nome de cada colega.";
    const name = requireNames ? normalize(member.member_name) : "";
    if (requireNames && names.has(name))
      return "Cada colega deve aparecer uma única vez. Não inclua seu próprio nome.";
    names.add(name);
    for (const key of CRITERIA) {
      if (!Number.isInteger(member[key]) || member[key] < 1 || member[key] > 5)
        return "Preencha os cinco critérios de cada colega com notas de 1 a 5.";
      if (
        member[`${key}_obs`] !== undefined &&
        (typeof member[`${key}_obs`] !== "string" ||
          member[`${key}_obs`].length > 1200)
      )
        return "Cada observação deve ter até 1.200 caracteres.";
    }
  }
  return null;
}
function clean(
  body,
  current = {
    academic_year: Number(process.env.ACADEMIC_YEAR || 2026),
    semester: 2,
  },
) {
  return {
    id: body.id,
    ...(body.roster_id
      ? { roster_id: body.roster_id, evaluator_id: body.evaluator_id }
      : {}),
    evaluator_name: body.evaluator_name.trim(),
    unit: body.unit,
    grade: body.grade,
    class: body.class,
    group_number: body.group_number,
    academic_year: current.academic_year,
    semester: current.semester,
    members: body.members.map((m) =>
      Object.fromEntries([
        ["member_name", m.member_name.trim()],
        ...(m.member_id ? [["member_id", m.member_id]] : []),
        ...CRITERIA.flatMap((k) => [
          [k, m[k]],
          [`${k}_obs`, (m[`${k}_obs`] || "").trim()],
        ]),
      ]),
    ),
  };
}
function authorize(req, res) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    res.status(503).json({
      error: "O acesso do professor ainda não foi configurado no servidor.",
    });
    return false;
  }
  const hash = (value) => crypto.createHash("sha256").update(value).digest();
  if (
    !crypto.timingSafeEqual(
      hash(req.headers.authorization || ""),
      hash(`Bearer ${password}`),
    )
  ) {
    res.status(401).json({ error: "Senha incorreta." });
    return false;
  }
  res.setHeader("Cache-Control", "no-store");
  return true;
}
function fail(res, error) {
  console.error(
    "STEM storage failure:",
    error.code || error.status || error.name || "unknown",
  );
  return res.status(error.status === 503 ? 503 : 502).json({
    error:
      error.status === 503
        ? error.message
        : "Não foi possível acessar o banco de avaliações. Suas respostas continuam nesta página; tente novamente.",
  });
}
module.exports = {
  TABLE,
  CRITERIA,
  CLASS_MAP,
  normalize,
  validate,
  clean,
  authorize,
  fail,
};
