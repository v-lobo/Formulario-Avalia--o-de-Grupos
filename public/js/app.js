const $ = (selector) => document.querySelector(selector);
const CONFIG = window.SCHOOL_CONFIG;
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
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const normalize = (value) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
const state = {
  view: "unit",
  unit: "",
  grade: "",
  class: "",
  group_number: null,
  config: CONFIG,
  roster: null,
  names: ["", ""],
  evaluator: null,
  peers: [],
  ratings: {},
  peerIndex: 0,
  busy: false,
  id: null,
  dirty: false,
};
function error(message, target) {
  $("#form-error").textContent = message;
  $("#form-error").hidden = false;
  if (target) target.focus();
  else $("#form-error").scrollIntoView({ behavior: "smooth", block: "center" });
}
function busy(value, message = "Carregando…") {
  state.busy = value;
  $("#busy-status").hidden = !value;
  $("#busy-status").textContent = message;
  $("#screen")
    .querySelectorAll("button")
    .forEach((button) => (button.disabled = value));
}
async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(
      data.error || "Não foi possível concluir. Tente novamente.",
    );
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}
function context() {
  return {
    unit: state.unit,
    grade: state.grade,
    class: state.class,
    group_number: state.group_number,
  };
}
function contextLabel() {
  return [
    state.unit,
    state.grade ? `${state.grade}º ano` : "",
    state.class
      ? `${state.class} — ${state.config[state.unit][state.grade][state.class].shift}`
      : "",
    state.group_number ? `Grupo ${state.group_number}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
const button = (label, action, value = "", className = "choice-button") =>
  `<button type="button" class="${className}" data-action="${action}" data-value="${esc(value)}">${esc(label)}</button>`;
const actions = (nextLabel, action) =>
  `<div class="actions">${button("Voltar", "back", "", "secondary")}${nextLabel ? button(nextLabel, action, "", "primary") : ""}</div>`;
function show(view) {
  state.view = view;
  $("#form-error").hidden = true;
  $("#flow-notice").hidden = true;
  render();
  $("#screen h2")?.focus();
}
function render() {
  $("#teacher-entry").hidden = state.view !== "unit";
  $("#selection-context").textContent = contextLabel();
  $("#selection-context").hidden = !state.unit;
  let content = "";
  switch (state.view) {
    case "unit":
      content = `<h2 tabindex="-1">Escolha sua unidade</h2><div class="choice-list">${["Farol", "Jatiúca"].map((unit) => button(unit, "unit", unit)).join("")}</div>`;
      break;
    case "grade":
      content = `<h2 tabindex="-1">Escolha sua série</h2><div class="choice-list">${["6", "7"].map((grade) => button(`${grade}º ano`, "grade", grade)).join("")}</div>${actions()}`;
      break;
    case "class":
      content = `<h2 tabindex="-1">Escolha sua turma</h2><div class="choice-list">${Object.entries(
        state.config[state.unit][state.grade],
      )
        .map(([cls, info]) => button(`${cls} — ${info.shift}`, "class", cls))
        .join("")}</div>${actions()}`;
      break;
    case "group": {
      const count = state.config[state.unit][state.grade][state.class].groups;
      content = `<h2 tabindex="-1">Escolha seu grupo</h2><div class="group-grid">${Array.from({ length: count }, (_, index) => button(`Grupo ${index + 1}`, "group", index + 1)).join("")}</div>${actions()}`;
      break;
    }
    case "register":
      content = `<h2 tabindex="-1">Cadastre os integrantes</h2><p class="section-description">Este grupo ainda não foi cadastrado. Informe o nome completo de todos os integrantes, incluindo o seu.</p><div class="roster-fields">${state.names.map((name, index) => `<div class="roster-field"><label class="field">Integrante ${index + 1}<input data-roster-index="${index}" value="${esc(name)}" maxlength="160" placeholder="Nome completo" autocomplete="off" required></label>${state.names.length > 2 ? button("Remover", "remove-name", index, "remove") : ""}</div>`).join("")}</div>${state.names.length < 16 ? button("+ Adicionar integrante", "add-name", "", "add-member") : ""}<p class="register-hint">Após salvar, você voltará à seleção da unidade.</p>${actions("Salvar integrantes", "save-roster")}`;
      break;
    case "identify":
      content = `<h2 tabindex="-1">Qual é o seu nome?</h2><div class="choice-list">${state.roster.members.map((member) => button(member.name, "evaluator", member.id)).join("")}</div>${actions()}`;
      break;
    case "rate": {
      const peer = state.peers[state.peerIndex],
        values = state.ratings[peer.id];
      content = `<p class="peer-progress">Colega ${state.peerIndex + 1} de ${state.peers.length}</p><h2 tabindex="-1">${esc(peer.name)}</h2><div class="scale"><strong>Como este colega participa do grupo?</strong><p>1 Nunca · 2 Raramente · 3 Às vezes<br>4 Frequentemente · 5 Sempre</p></div>${CRITERIA.map(([key, label, description]) => `<fieldset class="rating"><legend>${label}</legend><p>${description}</p><div class="scores">${[1, 2, 3, 4, 5].map((n) => `<label class="score"><input type="radio" data-rating="${key}" name="rating-${key}" value="${n}" aria-label="${n} — ${["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"][n - 1]}" ${values[key] === n ? "checked" : ""}><span>${n}</span></label>`).join("")}</div><details ${values[key + "_obs"] ? "open" : ""}><summary>Adicionar observação (opcional)</summary><textarea data-note="${key}" maxlength="1200" aria-label="Observação sobre ${label}">${esc(values[key + "_obs"] || "")}</textarea></details></fieldset>`).join("")}${actions(state.peerIndex + 1 < state.peers.length ? "Próximo colega" : "Revisar", "next-peer")}`;
      break;
    }
    case "review":
      content = `<h2 tabindex="-1">Confira sua avaliação</h2><p class="section-description">Você: <strong>${esc(state.evaluator.name)}</strong></p><h3>Colegas avaliados</h3>${state.peers.map((peer) => `<div class="review-row"><strong>${esc(peer.name)}</strong><span>5 critérios preenchidos</span></div>`).join("")}${actions("Enviar avaliação", "submit")}`;
      break;
    case "done":
      content = `<div class="done"><div class="success-icon" aria-hidden="true">✓</div><h2 tabindex="-1">Avaliação registrada</h2><p>Suas respostas foram enviadas ao professor.</p><p class="receipt">Comprovante: ${esc(state.id)}</p>${button("Voltar ao início", "restart", "", "primary")}</div>`;
      break;
  }
  $("#screen").innerHTML = content;
  if (state.busy)
    $("#screen")
      .querySelectorAll("button")
      .forEach((button) => (button.disabled = true));
}
async function refreshConfig() {
  const data = await request("/api/settings");
  state.config = data.config;
  $("#period").textContent = `2º semestre · ${data.academic_year}`;
}
async function openGroups() {
  busy(true, "Carregando grupos…");
  try {
    await refreshConfig();
    show("group");
  } catch (err) {
    error(
      err.name === "TimeoutError"
        ? "A conexão demorou. Tente selecionar a turma novamente."
        : err.message,
    );
  } finally {
    busy(false);
  }
}
async function selectGroup(value) {
  state.group_number = Number(value);
  state.roster = null;
  busy(true, "Consultando grupo…");
  try {
    const data = await request("/api/groups?" + new URLSearchParams(context()));
    if (data.roster) {
      state.roster = data.roster;
      show("identify");
    } else {
      state.names = ["", ""];
      state.dirty = false;
      show("register");
    }
  } catch (err) {
    error(
      err.name === "TimeoutError"
        ? "A consulta demorou. Selecione o grupo novamente."
        : err.message,
    );
  } finally {
    busy(false);
  }
}
async function saveRoster() {
  const names = state.names.map((name) => name.trim());
  const empty = names.findIndex((name) => !name);
  if (empty >= 0)
    return error(
      "Preencha o nome de todos os integrantes.",
      $(`[data-roster-index="${empty}"]`),
    );
  if (new Set(names.map(normalize)).size !== names.length)
    return error("Há nomes repetidos. Informe cada integrante uma única vez.");
  busy(true, "Salvando integrantes…");
  try {
    await request("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...context(), names }),
    });
    restart(
      "Integrantes cadastrados. Escolha novamente a unidade para iniciar sua avaliação.",
    );
  } catch (err) {
    if (err.data?.already_registered)
      restart(
        "Este grupo já foi cadastrado. Selecione sua identificação e escolha seu nome.",
      );
    else
      error(
        err.name === "TimeoutError"
          ? "A resposta demorou. Tente salvar novamente; o cadastro não será duplicado."
          : err.message,
      );
  } finally {
    busy(false);
  }
}
function chooseEvaluator(id) {
  const evaluator = state.roster.members.find((member) => member.id === id);
  if (!evaluator) return;
  state.evaluator = evaluator;
  state.peers = state.roster.members.filter((member) => member.id !== id);
  state.ratings = Object.fromEntries(state.peers.map((peer) => [peer.id, {}]));
  state.peerIndex = 0;
  state.id = crypto.randomUUID();
  state.dirty = false;
  show("rate");
}
function validatePeer(index, focus = true) {
  const peer = state.peers[index];
  for (const [key, label] of CRITERIA)
    if (!state.ratings[peer.id][key]) {
      if (focus)
        error(`Escolha uma nota de ${label}.`, $(`[data-rating="${key}"]`));
      return false;
    }
  return true;
}
async function submitEvaluation() {
  const incomplete = state.peers.findIndex(
    (peer, index) => !validatePeer(index, false),
  );
  if (incomplete >= 0) {
    state.peerIndex = incomplete;
    show("rate");
    validatePeer(incomplete);
    return;
  }
  busy(true, "Enviando avaliação…");
  try {
    const payload = {
      ...context(),
      id: state.id,
      roster_id: state.roster.id,
      evaluator_id: state.evaluator.id,
      members: state.peers.map((peer) => ({
        member_id: peer.id,
        ...state.ratings[peer.id],
      })),
    };
    const data = await request("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!data.saved) throw new Error("Não foi possível registrar a avaliação.");
    state.dirty = false;
    show("done");
  } catch (err) {
    error(
      err.name === "TimeoutError"
        ? "O envio demorou. Suas respostas continuam aqui; tente novamente."
        : err.message,
    );
  } finally {
    busy(false);
  }
}
function restart(message = "") {
  Object.assign(state, {
    view: "unit",
    unit: "",
    grade: "",
    class: "",
    group_number: null,
    roster: null,
    names: ["", ""],
    evaluator: null,
    peers: [],
    ratings: {},
    peerIndex: 0,
    id: null,
    dirty: false,
  });
  show("unit");
  if (message) {
    $("#flow-notice").textContent = message;
    $("#flow-notice").hidden = false;
  }
}
function goBack() {
  switch (state.view) {
    case "grade":
      restart();
      break;
    case "class":
      state.grade = "";
      state.class = "";
      state.group_number = null;
      show("grade");
      break;
    case "group":
      state.class = "";
      state.group_number = null;
      show("class");
      break;
    case "register":
    case "identify":
      state.group_number = null;
      state.roster = null;
      state.dirty = false;
      show("group");
      break;
    case "rate":
      if (state.peerIndex > 0) {
        state.peerIndex--;
        show("rate");
      } else {
        state.dirty = false;
        show("identify");
      }
      break;
    case "review":
      state.peerIndex = state.peers.length - 1;
      show("rate");
      break;
  }
}
$("#flow-form").addEventListener("submit", (event) => event.preventDefault());
$("#screen").addEventListener("input", (event) => {
  if (event.target.matches("[data-roster-index]")) {
    state.names[Number(event.target.dataset.rosterIndex)] = event.target.value;
    state.dirty = true;
  }
  if (event.target.matches("[data-note]")) {
    state.ratings[state.peers[state.peerIndex].id][
      event.target.dataset.note + "_obs"
    ] = event.target.value;
    state.dirty = true;
  }
});
$("#screen").addEventListener("change", (event) => {
  if (event.target.matches("[data-rating]")) {
    state.ratings[state.peers[state.peerIndex].id][
      event.target.dataset.rating
    ] = Number(event.target.value);
    state.dirty = true;
  }
});
$("#screen").addEventListener("click", async (event) => {
  const selected = event.target.closest("[data-action]");
  if (!selected || state.busy) return;
  const { action, value } = selected.dataset;
  switch (action) {
    case "unit":
      state.unit = value;
      state.grade = "";
      state.class = "";
      state.group_number = null;
      show("grade");
      break;
    case "grade":
      state.grade = value;
      state.class = "";
      state.group_number = null;
      show("class");
      break;
    case "class":
      state.class = value;
      state.group_number = null;
      await openGroups();
      break;
    case "group":
      await selectGroup(value);
      break;
    case "back":
      goBack();
      break;
    case "add-name":
      if (state.names.length < 16) {
        state.names.push("");
        render();
        $(`[data-roster-index="${state.names.length - 1}"]`).focus();
      }
      break;
    case "remove-name":
      if (state.names.length > 2) {
        state.names.splice(Number(value), 1);
        render();
      }
      break;
    case "save-roster":
      await saveRoster();
      break;
    case "evaluator":
      chooseEvaluator(value);
      break;
    case "next-peer":
      if (validatePeer(state.peerIndex)) {
        if (state.peerIndex + 1 < state.peers.length) {
          state.peerIndex++;
          show("rate");
        } else show("review");
      }
      break;
    case "submit":
      await submitEvaluation();
      break;
    case "restart":
      restart();
      break;
  }
});
window.addEventListener("beforeunload", (event) => {
  if (state.dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
render();
