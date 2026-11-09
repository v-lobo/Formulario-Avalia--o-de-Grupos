const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateSelection,
  validateRoster,
  checkRosterEvaluation,
  canonicalSubmission,
} = require("../api/_groups");
const CONFIG = require("../public/js/school-config");
test("configuração inicial corresponde às turmas e limites fornecidos", () => {
  const expected = {
    Farol: { 6: { A: ["Manhã", 9], B: ["Manhã", 8] }, 7: { A: ["Manhã", 9] } },
    Jatiúca: {
      6: {
        A: ["Manhã", 10],
        B: ["Manhã", 10],
        C: ["Manhã", 11],
        D: ["Tarde", 12],
        E: ["Tarde", 10],
      },
      7: {
        A: ["Manhã", 9],
        B: ["Manhã", 10],
        C: ["Tarde", 9],
        D: ["Tarde", 10],
      },
    },
  };
  for (const [unit, grades] of Object.entries(expected))
    for (const [grade, classes] of Object.entries(grades))
      for (const [cls, [shift, groups]] of Object.entries(classes)) {
        assert.deepEqual(CONFIG[unit][grade][cls], { shift, groups });
        assert.equal(
          validateSelection({ unit, grade, class: cls, group_number: groups }),
          null,
        );
        assert.ok(
          validateSelection({
            unit,
            grade,
            class: cls,
            group_number: groups + 1,
          }),
        );
      }
});
test("cadastro exige dois nomes, sem vazios nem duplicação por acento ou espaços", () => {
  assert.ok(validateRoster(["Um"]));
  assert.ok(validateRoster(["Um", ""]));
  assert.ok(validateRoster([" JOÃO  SILVA ", "Joao Silva"]));
  assert.equal(validateRoster(["Um", "Dois"]), null);
});
test("cada avaliação inclui exatamente os outros membros cadastrados", () => {
  const roster = {
    id: "grupo",
    unit: "Farol",
    grade: "6",
    class: "A",
    group_number: 1,
    academic_year: 2026,
    semester: 2,
    members: [
      { id: "a", name: "Ana" },
      { id: "b", name: "Bia" },
      { id: "c", name: "Caio" },
    ],
  };
  const body = {
    ...roster,
    roster_id: "grupo",
    evaluator_id: "a",
    members: [{ member_id: "c" }, { member_id: "b" }],
  };
  assert.equal(checkRosterEvaluation(body, roster), null);
  const canonical = canonicalSubmission(body, roster);
  assert.equal(canonical.evaluator_name, "Ana");
  assert.deepEqual(
    canonical.members.map((m) => m.member_name),
    ["Bia", "Caio"],
  );
  body.members[1].member_id = "c";
  assert.ok(checkRosterEvaluation(body, roster));
});
