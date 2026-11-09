const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const CLASS_MAP = {
  "Farol-6": ["A", "B"],
  "Farol-7": ["A"],
  "Jatiúca-6": ["A", "B", "C", "D", "E"],
  "Jatiúca-7": ["A", "B", "C", "D"],
};
const CRITERIA = [
  [
    "responsabilidade",
    "Responsabilidade",
    "Cumpre os prazos e faz sua parte nas atividades.",
  ],
  [
    "relacionamento",
    "Relacionamento interpessoal",
    "Escuta os colegas e resolve diferenças com respeito.",
  ],
  [
    "cooperacao",
    "Cooperação",
    "Ajuda os colegas e contribui para o trabalho em equipe.",
  ],
  [
    "organizacao",
    "Organização",
    "Cuida dos materiais e segue o planejamento do grupo.",
  ],
  [
    "educacao",
    "Educação",
    "Trata colegas e professores com gentileza e respeito.",
  ],
];
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const normal = (name) =>
  name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
const state = {
  step: 1,
  id: crypto.randomUUID(),
  members: [],
  online: false,
  sending: false,
};
function error(message, target) {
  $("#form-error").textContent = message;
  $("#form-error").hidden = false;
  target?.focus();
  if (!target)
    $("#form-error").scrollIntoView({ behavior: "smooth", block: "center" });
}
function step(number) {
  state.step = number;
  $("#form-error").hidden = true;
  $$("[data-step]").forEach(
    (el) => (el.hidden = Number(el.dataset.step) !== number),
  );
  $$("[data-progress]").forEach((el) => {
    el.removeAttribute("aria-current");
    if (Number(el.dataset.progress) === number)
      el.setAttribute("aria-current", "step");
    el.classList.toggle("complete", Number(el.dataset.progress) < number);
  });
  $(`[data-step="${number}"] h2`).focus();
}
function metadata() {
  const data = new FormData($("#evaluation-form"));
  return {
    evaluator_name: $("#evaluator-name").value.trim(),
    unit: data.get("unit") || "",
    grade: data.get("grade") || "",
    class: $("#class-select").value,
    group_number: Number($("#group-select").value),
  };
}
function validateIdentity() {
  const m = metadata();
  if (!m.evaluator_name) {
    error("Informe seu nome completo.", $("#evaluator-name"));
    return false;
  }
  if (!m.unit || !m.grade || !m.class || !m.group_number) {
    error("Escolha unidade, série, turma e grupo.");
    return false;
  }
  return true;
}
function updateClasses() {
  const m = metadata(),
    select = $("#class-select");
  const classes = CLASS_MAP[`${m.unit}-${m.grade}`] || [];
  select.disabled = !classes.length;
  select.innerHTML =
    `<option value="">${classes.length ? "Selecione sua turma" : "Escolha unidade e série"}</option>` +
    classes.map((c) => `<option value="${c}">Turma ${c}</option>`).join("");
}
function syncMembers() {
  state.members.forEach((m) => {
    const card = document.querySelector(`[data-member="${m.id}"]`);
    if (!card) return;
    m.member_name = card.querySelector(".member-name").value.trim();
    CRITERIA.forEach(([key]) => {
      m[key] = Number(
        card.querySelector(`input[name="${m.id}-${key}"]:checked`)?.value || 0,
      );
      m[key + "_obs"] = card.querySelector(`[data-note="${key}"]`).value.trim();
    });
  });
}
function renderMembers() {
  $("#members").innerHTML = state.members
    .map(
      (m, index) => `<article class="member-card" data-member="${m.id}">
    <div class="member-head"><label class="field">Nome do colega ${index + 1}<input class="member-name" value="${escapeHTML(m.member_name)}" maxlength="160" placeholder="Nome completo do colega" required></label><button class="remove" type="button" data-remove="${m.id}" aria-label="Remover colega ${index + 1}">Remover</button></div>
    ${CRITERIA.map(([key, label, desc]) => `<fieldset class="rating"><legend>${label}</legend><p>${desc}</p><div class="scores">${[1, 2, 3, 4, 5].map((n) => `<label class="score"><input type="radio" name="${m.id}-${key}" value="${n}" aria-label="${n} — ${["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"][n - 1]}" ${m[key] === n ? "checked" : ""}><span>${n}</span></label>`).join("")}</div><details ${m[key + "_obs"] ? "open" : ""}><summary>Adicionar observação (opcional)</summary><textarea data-note="${key}" maxlength="1200" aria-label="Observação sobre ${label}" placeholder="Conte um exemplo ou algo que pode melhorar.">${escapeHTML(m[key + "_obs"] || "")}</textarea></details></fieldset>`).join("")}</article>`,
    )
    .join("");
  $("#add-member").disabled = state.members.length >= 15;
}
function addMember() {
  syncMembers();
  if (state.members.length >= 15) return;
  state.members.push({ id: crypto.randomUUID(), member_name: "" });
  renderMembers();
  $("#members").lastElementChild.querySelector("input").focus();
}
function validateMembers() {
  syncMembers();
  if (!state.members.length) {
    error("Adicione pelo menos um colega.");
    return false;
  }
  const names = new Set([normal(metadata().evaluator_name)]);
  for (const m of state.members) {
    const card = document.querySelector(`[data-member="${m.id}"]`);
    if (!m.member_name) {
      error(
        "Informe o nome de cada colega.",
        card.querySelector(".member-name"),
      );
      return false;
    }
    if (names.has(normal(m.member_name))) {
      error(
        "Não repita nomes nem inclua seu próprio nome.",
        card.querySelector(".member-name"),
      );
      return false;
    }
    names.add(normal(m.member_name));
    for (const [key, label] of CRITERIA)
      if (!m[key]) {
        error(
          `Escolha uma nota de ${label} para ${m.member_name}.`,
          card.querySelector(`input[name="${m.id}-${key}"]`),
        );
        return false;
      }
  }
  return true;
}
function review() {
  const m = metadata();
  $("#review").innerHTML =
    `<div class="review-meta"><strong>${escapeHTML(m.evaluator_name)}</strong>${escapeHTML(m.unit)} · ${m.grade}º ano · Turma ${m.class} · Grupo ${m.group_number}<br><small>${escapeHTML($("[data-period]").textContent)}</small></div><h3>Colegas avaliados (${state.members.length})</h3>` +
    state.members
      .map(
        (m) =>
          `<div class="review-row"><strong>${escapeHTML(m.member_name)}</strong><span>5 de 5 critérios preenchidos</span></div>`,
      )
      .join("");
}
async function checkConnection() {
  try {
    const res = await fetch("/api/health", {
        signal: AbortSignal.timeout(12000),
      }),
      data = await res.json();
    if (!res.ok || !data.connected) throw new Error(data.error);
    state.online = true;
    $("#connection").textContent = "● Formulário disponível";
    $("#connection").className = "connection online";
    $$("[data-period]").forEach(
      (el) => (el.textContent = `2º semestre · ${data.academic_year}`),
    );
  } catch {
    state.online = false;
    $("#connection").className = "connection offline";
    $("#connection").textContent =
      "Armazenamento indisponível. Você pode preencher as respostas, mas o envio precisa da conexão com o banco.";
  }
}
$$('input[name="unit"],input[name="grade"]').forEach((el) =>
  el.addEventListener("change", updateClasses),
);
$("#next-1").addEventListener("click", () => {
  if (validateIdentity()) {
    if (!state.members.length) addMember();
    step(2);
  }
});
$("#add-member").addEventListener("click", addMember);
$("#members").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove]");
  if (btn) {
    syncMembers();
    state.members = state.members.filter((m) => m.id !== btn.dataset.remove);
    renderMembers();
  }
});
$("#next-2").addEventListener("click", () => {
  if (validateMembers()) {
    review();
    step(3);
  }
});
$$("[data-back]").forEach((el) =>
  el.addEventListener("click", () => step(Number(el.dataset.back))),
);
$("#evaluation-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (state.step !== 3 || state.sending) return;
  if (!validateIdentity()) {
    step(1);
    return;
  }
  if (!validateMembers()) {
    step(2);
    return;
  }
  state.sending = true;
  $("#submit").disabled = true;
  $("#submit").textContent = "Enviando…";
  $("#form-error").hidden = true;
  try {
    const payload = {
      ...metadata(),
      id: state.id,
      members: state.members.map(({ id, ...m }) => m),
    };
    const res = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    if (!res.ok || !data.saved)
      throw new Error(data.error || "Não foi possível registrar a avaliação.");
    $("#receipt").textContent = `Comprovante: ${data.id}`;
    step(4);
  } catch (err) {
    error(
      err.name === "TimeoutError"
        ? "O servidor demorou a responder. Suas respostas continuam aqui. Tente enviar novamente."
        : err.message,
    );
  } finally {
    state.sending = false;
    $("#submit").disabled = false;
    $("#submit").textContent = "Enviar avaliação →";
  }
});
$("#restart").addEventListener("click", () => {
  $("#evaluation-form").reset();
  state.id = crypto.randomUUID();
  state.members = [];
  $("#members").innerHTML = "";
  updateClasses();
  step(1);
  checkConnection();
});
window.addEventListener("beforeunload", (e) => {
  if (state.step > 1 && state.step < 4) {
    e.preventDefault();
    e.returnValue = "";
  }
});
checkConnection();
