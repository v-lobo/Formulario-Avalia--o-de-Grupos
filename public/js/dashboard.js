const $ = (s) => document.querySelector(s);
const CRITERIA = [
  ["responsabilidade", "Responsabilidade"],
  ["relacionamento", "Relacionamento interpessoal"],
  ["cooperacao", "Cooperação"],
  ["organizacao", "Organização"],
  ["educacao", "Educação"],
];
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const normal = (value) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
let studentDetails = new Map();
let selectedStudentKey = null;
let exportingStudents = false;
let password = "",
  rows = [],
  visible = [],
  loading = false;
let schoolConfig = window.SCHOOL_CONFIG;
let management = { periods: [], submissions: [], rosters: [] },
  periodSelection = null,
  sessionVersion = 0,
  pendingAction = null,
  saving = false;
const periodLabel = (p) => `${p.academic_year} · ${p.semester}º semestre`;
const dateTime = (value) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${password}`,
      ...options.headers,
    },
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}
const mean = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const score = (value) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
const ratings = (m) => CRITERIA.map(([k]) => m[k]);
const team = (r) => `${r.unit} · ${r.grade}º ${r.class} · G${r.group_number}`;
function showError(message) {
  $("#dashboard-error").textContent = message;
  $("#dashboard-error").hidden = false;
}
async function load() {
  if (loading) return;
  const version = sessionVersion;
  loading = true;
  $("#dashboard-error").hidden = true;
  $("#management-message").hidden = true;
  $("#load-status").textContent = "Carregando avaliações…";
  $("#login-button").disabled = true;
  $("#dashboard").inert = true;
  try {
    const query = periodSelection
      ? "?" + new URLSearchParams(periodSelection)
      : "";
    const data = await api("/api/manage" + query);
    const selected = {
      academic_year: data.academic_year,
      semester: data.semester,
    };
    const settings = await api(
      "/api/settings?" + new URLSearchParams(selected),
    );
    if (version !== sessionVersion) return;
    management = data;
    periodSelection = selected;
    schoolConfig = settings.config;
    renderSettings();
    rows = data.submissions.filter((r) => !r.deleted_at);
    $("#login").hidden = true;
    $("#dashboard").hidden = false;
    const years = [...new Set(data.periods.map((p) => p.academic_year))].sort(
      (a, b) => b - a,
    );
    $("#f-year").innerHTML = years.map((y) => `<option>${y}</option>`).join("");
    $("#f-year").value = String(selected.academic_year);
    renderSemesters(selected.semester);
    $("#new-year").value = String(
      selected.semester === 1
        ? selected.academic_year
        : selected.academic_year + 1,
    );
    $("#new-semester").value = selected.semester === 1 ? "2" : "1";
    render();
    $("#load-status").textContent =
      "Atualizado em " + new Date().toLocaleTimeString("pt-BR");
  } catch (error) {
    if (version !== sessionVersion) return;
    rows = [];
    visible = [];
    management = { periods: [], submissions: [], rosters: [] };
    if (!$("#dashboard").hidden) render();
    showError(
      error.name === "TimeoutError"
        ? "O servidor demorou a responder. Tente novamente."
        : error.message,
    );
    $("#load-status").textContent = "Dados indisponíveis.";
  } finally {
    loading = false;
    $("#login-button").disabled = false;
    $("#dashboard").inert = false;
  }
}
function render() {
  $('#student-dialog').close();
  selectedStudentKey = null;
  $('#student-export-status').textContent = '';
  updateGroupOptions();
  const filters = [
    ["f-year", "academic_year"],
    ["f-unit", "unit"],
    ["f-grade", "grade"],
    ["f-class", "class"],
    ["f-group", "group_number"],
  ];
  visible = rows.filter((r) =>
    filters.every(
      ([id, key]) => !$("#" + id).value || String(r[key]) === $("#" + id).value,
    ),
  );
  const peers = visible.flatMap((r) => r.members),
    values = peers.flatMap(ratings),
    low = values.filter((n) => n <= 2).length;
  $("#metrics").innerHTML = [
    ["Formulários enviados", visible.length],
    ["Avaliações entre colegas", peers.length],
    ["Média geral", values.length ? score(mean(values)) : "—"],
    ["Notas 1 ou 2", low],
  ]
    .map(
      ([label, val]) =>
        `<article class="metric"><span>${label}</span><strong>${val}</strong></article>`,
    )
    .join("");
  $("#criteria-bars").innerHTML = categoryChart(peers);
  const groups = new Map(),
    students = new Map();
  visible.forEach((r) => {
    const label = team(r),
      g = groups.get(label) || { label, responses: 0, peers: 0, values: [] };
    g.responses++;
    g.peers += r.members.length;
    g.values.push(...r.members.flatMap(ratings));
    groups.set(label, g);
    r.members.forEach((m) => {
      const key = JSON.stringify([label, m.member_id || normal(m.member_name)]),
        s = students.get(key) || {
          name: m.member_name,
          label,
          received: 0,
          evaluations: [],
          values: [],
        };
      s.received++;
      s.evaluations.push(m);
      s.values.push(...ratings(m));
      students.set(key, s);
    });
  });
  $("#team-rows").innerHTML =
    [...groups.values()]
      .map(
        (g) =>
          `<tr><td>${esc(g.label)}</td><td>${g.responses}</td><td>${g.peers}</td><td>${score(mean(g.values))}</td><td class="flag">${g.values.filter((n) => n <= 2).length}</td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="5" class="empty">Nenhuma equipe encontrada.</td></tr>';
  studentDetails = students;
  document.querySelectorAll('[data-student-export]').forEach(button => { button.disabled = exportingStudents || !students.size; });
  $("#student-rows").innerHTML =
    [...students.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map(
        (s) =>
          `<tr><td><button type="button" class="student-detail-button" data-student-key="${esc(JSON.stringify([s.label, s.evaluations[0].member_id || normal(s.name)]))}" aria-haspopup="dialog">${esc(s.name)}</button></td><td>${esc(s.label)}</td><td>${s.received}</td><td>${score(mean(s.values))}</td><td class="flag">${s.values.filter((n) => n <= 2).length}</td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="5" class="empty">Nenhum aluno avaliado.</td></tr>';
  renderManagement();
}
function exportCSV(source = visible, backup = false) {
  if (!source.length) {
    showError("Não há avaliações para exportar.");
    return;
  }
  const csvRows = [
    [
      "Ano",
      "Semestre",
      "Data",
      "Unidade",
      "Série",
      "Turma",
      "Grupo",
      "Avaliador",
      "Colega avaliado",
      "Critério",
      "Nota",
      "Observação",
      "Comprovante",
      "Situação",
      "Removida em",
      "Motivo",
    ],
  ];
  source.forEach((r) =>
    r.members.forEach((m) =>
      CRITERIA.forEach(([key, label]) =>
        csvRows.push([
          r.academic_year,
          r.semester,
          r.created_at,
          r.unit,
          r.grade,
          r.class,
          r.group_number,
          r.evaluator_name,
          m.member_name,
          label,
          m[key],
          m[key + "_obs"] || "",
          r.id,
          r.deleted_at ? "Lixeira" : "Ativa",
          r.deleted_at || "",
          r.delete_reason || "",
        ]),
      ),
    ),
  );
  const cell = (value) => {
    let v = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(v)) v = "'" + v;
    return '"' + v.replace(/"/g, '""') + '"';
  };
  const blob = new Blob(
      ["\ufeff" + csvRows.map((r) => r.map(cell).join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `STEM-${backup ? "backup" : "avaliacoes"}-${$("#f-year").value}-${$("#f-semester").value}-semestre.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
$("#login").addEventListener("submit", (e) => {
  e.preventDefault();
  password = $("#password").value;
  periodSelection = null;
  sessionVersion++;
  $("#password").value = "";
  load();
});
["f-unit", "f-grade", "f-class", "f-group"].forEach((id) =>
  $("#" + id).addEventListener("change", render),
);
$("#refresh").addEventListener("click", load);
$("#export").addEventListener("click", () => exportCSV());
$("#backup").addEventListener("click", () =>
  exportCSV(management.submissions, true),
);
$("#logout").addEventListener("click", () => {
  $('#student-dialog').close();
  selectedStudentKey = null;
  studentDetails.clear();
  password = "";
  sessionVersion++;
  periodSelection = null;
  management = { periods: [], submissions: [], rosters: [] };
  rows = [];
  visible = [];
  $("#dashboard").hidden = true;
  $("#login").hidden = false;
  $("#dashboard-error").hidden = true;
  [
    "responses",
    "team-rows",
    "student-rows",
    "metrics",
    "criteria-bars",
    "rosters",
    "period-list",
    "participation-rows",
    "settings-rows",
    "form-status",
  ].forEach((id) => ($("#" + id).innerHTML = ""));
  $("#management-message").hidden = true;
  ["response-search", "roster-search"].forEach(
    (id) => ($("#" + id).value = ""),
  );
  $("#response-status").value = $("#roster-status").value = "active";
  $("#only-repeated").checked = false;
  selectTab("overview");
  $("#password").focus();
});
function renderSettings() {
  const items = [];
  for (const [unit, grades] of Object.entries(schoolConfig))
    for (const [grade, classes] of Object.entries(grades))
      for (const [cls, info] of Object.entries(classes))
        items.push({ unit, grade, class: cls, ...info });
  $("#settings-rows").innerHTML = items
    .map(
      (item) =>
        `<tr><td>${esc(item.unit)}</td><td>${item.grade}º ano</td><td>${item.class} — ${item.shift}</td><td><input type="number" min="1" max="99" step="1" value="${item.groups}" aria-label="Quantidade de grupos: ${item.unit}, ${item.grade}º ${item.class}"></td><td><button type="button" class="secondary" data-save-limit data-unit="${esc(item.unit)}" data-grade="${item.grade}" data-class="${item.class}">Salvar</button></td></tr>`,
    )
    .join("");
}
function updateGroupOptions() {
  const unit = $("#f-unit").value,
    grade = $("#f-grade").value,
    cls = $("#f-class").value,
    current = $("#f-group").value;
  const counts = [];
  for (const [u, grades] of Object.entries(schoolConfig))
    for (const [g, classes] of Object.entries(grades))
      for (const [c, info] of Object.entries(classes))
        if (
          (!unit || unit === u) &&
          (!grade || grade === g) &&
          (!cls || cls === c)
        )
          counts.push(info.groups);
  for (const row of rows)
    if (
      (!unit || row.unit === unit) &&
      (!grade || row.grade === grade) &&
      (!cls || row.class === cls)
    )
      counts.push(row.group_number);
  const maximum = Math.max(0, ...counts);
  $("#f-group").innerHTML =
    '<option value="">Todos</option>' +
    Array.from(
      { length: maximum },
      (_, index) => `<option value="${index + 1}">${index + 1}</option>`,
    ).join("");
  $("#f-group").value = Number(current) <= maximum ? current : "";
}
$("#settings-rows").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-limit]");
  if (!button || button.disabled) return;
  const input = button.closest("tr").querySelector("input"),
    groups = Number(input.value);
  if (!Number.isInteger(groups) || groups < 1 || groups > 99) {
    $("#settings-message").textContent =
      "Informe uma quantidade de 1 a 99 grupos.";
    input.focus();
    return;
  }
  const payload = {
    ...periodSelection,
    unit: button.dataset.unit,
    grade: button.dataset.grade,
    class: button.dataset.class,
    groups,
  };
  button.disabled = true;
  $("#dashboard").inert = true;
  $("#settings-message").textContent = "Salvando…";
  try {
    const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      }),
      data = await res.json();
    if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
    schoolConfig = data.config;
    input.value =
      schoolConfig[payload.unit][payload.grade][payload.class].groups;
    $("#settings-message").textContent =
      `${payload.unit} · ${payload.grade}º ${payload.class}: ${groups} grupos. Configuração salva.`;
    render();
  } catch (error) {
    $("#settings-message").textContent =
      error.name === "TimeoutError"
        ? "A resposta demorou. Atualize o painel para conferir se a alteração foi salva."
        : error.message;
  } finally {
    button.disabled = false;
    $("#dashboard").inert = false;
  }
});

function renderSemesters(preferred) {
  const semesters = management.periods
    .filter((p) => p.academic_year === Number($("#f-year").value))
    .map((p) => p.semester)
    .sort((a, b) => b - a);
  $("#f-semester").innerHTML = semesters
    .map((s) => `<option value="${s}">${s}º semestre</option>`)
    .join("");
  $("#f-semester").value = String(
    semesters.includes(Number(preferred)) ? preferred : semesters[0],
  );
}
$("#f-year").addEventListener("change", () => {
  renderSemesters($("#f-semester").value);
  changePeriod();
});
$("#f-semester").addEventListener("change", changePeriod);
function changePeriod() {
  periodSelection = {
    academic_year: Number($("#f-year").value),
    semester: Number($("#f-semester").value),
  };
  load();
}
function matchesFilters(r) {
  return [
    ["f-unit", "unit"],
    ["f-grade", "grade"],
    ["f-class", "class"],
    ["f-group", "group_number"],
  ].every(
    ([id, key]) => !$("#" + id).value || String(r[key]) === $("#" + id).value,
  );
}
const evaluatorKey = (r) =>
  JSON.stringify([
    r.roster_id || team(r),
    r.evaluator_id || normal(r.evaluator_name),
  ]);
function recordButton(kind, r) {
  return `<button type="button" class="record-action ${r.deleted_at ? "" : "danger"}" data-record-kind="${kind}" data-record-id="${esc(r.id)}" data-record-action="${r.deleted_at ? "restore" : "trash"}">${r.deleted_at ? "Restaurar" : kind === "roster" ? "Remover cadastro" : "Mover à lixeira"}</button>`;
}
function renderManagement() {
  const current = management.periods.find((p) => p.is_current);
  $("#form-status").textContent = current
    ? `Coleta dos alunos: ${periodLabel(current)} · ${current.is_open ? "Formulário aberto" : "Formulário fechado"}`
    : "Dados indisponíveis. Atualize o painel.";
  $("#form-status").classList.toggle("closed", !current?.is_open);
  const repeated = new Map();
  rows.forEach((r) =>
    repeated.set(evaluatorKey(r), (repeated.get(evaluatorKey(r)) || 0) + 1),
  );
  const search = normal($("#response-search").value);
  const responseRows = management.submissions.filter(
    (r) =>
      matchesFilters(r) &&
      Boolean(r.deleted_at) === ($("#response-status").value === "trash") &&
      (!search ||
        normal(
          [r.evaluator_name, r.id, ...r.members.map((m) => m.member_name)].join(
            " ",
          ),
        ).includes(search)) &&
      (!$("#only-repeated").checked ||
        (repeated.get(evaluatorKey(r)) || 0) > 1),
  );
  $("#responses-count").textContent =
    `${responseRows.length} ${responseRows.length === 1 ? "resposta" : "respostas"}`;
  $("#responses").innerHTML = responseRows.length
    ? `<div class="table-wrap"><table class="record-table"><thead><tr><th>Data e hora</th><th>Avaliador e respostas</th><th>Equipe</th><th>Situação</th><th>Ação</th></tr></thead><tbody>${responseRows
        .map(
          (r) =>
            `<tr><td>${esc(dateTime(r.created_at))}</td><td><button type="button" class="student-detail-button" data-response-detail="${esc(r.id)}" aria-haspopup="dialog">${esc(r.evaluator_name)}</button></td><td>${esc(team(r))}</td><td>${r.deleted_at ? '<span class="status-badge">Lixeira</span>' : (repeated.get(evaluatorKey(r)) || 0) > 1 ? '<span class="status-badge warning">Possível repetição</span>' : '<span class="status-badge open">Ativa</span>'}</td><td>${recordButton("submission", r)}</td></tr>`,
        )
        .join("")}</tbody></table></div>`
    : '<p class="empty">Nenhuma resposta para os filtros selecionados.</p>';
  const rosterSearch = normal($("#roster-search").value);
  const rosterRows = management.rosters.filter(
    (r) =>
      matchesFilters(r) &&
      Boolean(r.deleted_at) === ($("#roster-status").value === "trash") &&
      (!rosterSearch ||
        r.members.some((m) => normal(m.name).includes(rosterSearch))),
  );
  $("#rosters-count").textContent =
    `${rosterRows.length} ${rosterRows.length === 1 ? "cadastro" : "cadastros"}`;
  $("#rosters").innerHTML = rosterRows.length
    ? `<div class="table-wrap"><table class="record-table"><thead><tr><th>Equipe</th><th>Integrantes</th><th>Envios ativos</th><th>Ação</th></tr></thead><tbody>${rosterRows.map((r) => `<tr><td>${esc(team(r))}<small class="record-id">${esc(dateTime(r.created_at))}</small></td><td><ul class="roster-names">${r.members.map((m) => `<li>${esc(m.name)}</li>`).join("")}</ul>${r.deleted_at ? `<p class="help-text">${esc(r.delete_reason || "Sem motivo informado")}</p>` : ""}</td><td>${rows.filter((s) => s.roster_id === r.id).length}</td><td>${recordButton("roster", r)}</td></tr>`).join("")}</tbody></table></div>`
    : '<p class="empty">Nenhum cadastro para os filtros selecionados.</p>';
  $("#period-list").innerHTML = management.periods
    .map(
      (p) =>
        `<div class="period-row"><div><strong>${periodLabel(p)}</strong><span class="status-badge ${p.is_open ? "open" : ""}">${p.is_open ? "Aberto" : "Fechado"}</span>${p.is_current ? " <small>Atual</small>" : ""}</div><button type="button" class="${p.is_open ? "secondary" : "primary"}" data-period-action="${p.is_open ? "close" : "open"}" data-year="${p.academic_year}" data-semester="${p.semester}">${p.is_open ? "Fechar formulário" : "Abrir formulário"}</button></div>`,
    )
    .join("");
  $("#student-url").textContent = window.location.origin + "/";
  $("#student-url").href = window.location.origin + "/";
  const studentUrl = $("#student-url").href;
  if ($("#student-qr-code").dataset.url !== studentUrl) {
    const qr = qrcode(0, "M");
    qr.addData(studentUrl);
    qr.make();
    $("#student-qr-code").innerHTML = qr.createSvgTag({ cellSize: 6, margin: 24, scalable: true });
    $("#student-qr-code").dataset.url = studentUrl;
  }
  renderParticipation();
}
function renderParticipation() {
  const groups = management.rosters.filter(
    (r) => !r.deleted_at && matchesFilters(r),
  );
  const classMap = new Map();
  for (const r of [...groups, ...visible]) {
    const key = JSON.stringify([r.unit, r.grade, r.class]);
    if (!classMap.has(key))
      classMap.set(key, {
        unit: r.unit, grade: r.grade, class: r.class,
        label: `${r.unit} · ${r.grade}º ${r.class}`,
        groups: new Set(),
        members: new Set(),
        respondents: new Set(),
        submissions: 0,
      });
  }
  groups.forEach((r) => {
    const c = classMap.get(JSON.stringify([r.unit, r.grade, r.class]));
    c.groups.add(r.id);
    r.members.forEach((m) => c.members.add(JSON.stringify([r.id, m.id])));
  });
  visible.forEach((r) => {
    const c = classMap.get(JSON.stringify([r.unit, r.grade, r.class]));
    c.respondents.add(evaluatorKey(r));
    c.submissions++;
  });
  $("#participation-rows").innerHTML =
    [...classMap.values()]
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
      .map(
        (c) =>
          `<tr><td><button type="button" class="student-detail-button" data-participation-unit="${esc(c.unit)}" data-grade="${esc(c.grade)}" data-class="${esc(c.class)}" aria-haspopup="dialog">${esc(c.label)}</button></td><td>${c.groups.size}</td><td>${c.members.size}</td><td>${c.respondents.size}</td><td>${c.submissions}</td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="5" class="empty">Nenhum cadastro ou envio neste recorte.</td></tr>';
}
function selectTab(name) {
  document.querySelectorAll("[data-tab]").forEach((tab) => {
    const selected = tab.dataset.tab === name;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $("#panel-" + tab.dataset.tab).hidden = !selected;
  });
}
document.querySelectorAll("[data-tab]").forEach((tab) => {
  tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  tab.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const tabs = [...document.querySelectorAll("[data-tab]")];
    const i =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (tabs.indexOf(tab) +
              (e.key === "ArrowRight" ? 1 : -1) +
              tabs.length) %
            tabs.length;
    selectTab(tabs[i].dataset.tab);
    tabs[i].focus();
  });
});
["response-search", "roster-search"].forEach((id) =>
  $("#" + id).addEventListener("input", renderManagement),
);
["response-status", "roster-status", "only-repeated"].forEach((id) =>
  $("#" + id).addEventListener("change", renderManagement),
);
function confirmAction(title, description, payload, method, reason = false) {
  if (loading || saving) return;
  pendingAction = { payload, method };
  $("#dialog-title").textContent = title;
  $("#dialog-description").textContent = description;
  $("#reason-field").hidden = !reason;
  $("#record-reason").value = "";
  $("#dialog-error").hidden = true;
  $("#management-dialog").showModal();
}
$("#dashboard").addEventListener("click", (e) => {
  const record = e.target.closest("[data-record-id]");
  if (record) {
    const {
      recordKind: kind,
      recordId: id,
      recordAction: action,
    } = record.dataset;
    const row = (
      kind === "roster" ? management.rosters : management.submissions
    ).find((r) => r.id === id);
    if (!row) return;
    const restore = action === "restore",
      group = kind === "roster";
    confirmAction(
      restore
        ? "Restaurar registro?"
        : group
          ? "Remover cadastro do grupo?"
          : "Mover resposta à lixeira?",
      `${group ? team(row) : row.evaluator_name + " · " + team(row)}. ` +
        (restore
          ? group
            ? "O cadastro e as respostas removidas junto com ele voltarão à análise. Respostas removidas separadamente continuarão na lixeira."
            : "A resposta voltará às médias e aos relatórios."
          : group
            ? "O grupo ficará livre para novo cadastro. Este cadastro e suas respostas ativas irão para a lixeira, onde poderão ser restaurados."
            : "A resposta deixará de contar nas médias e poderá ser restaurada pela lixeira."),
      { kind, id, action },
      "PATCH",
      !restore,
    );
  }
  const period = e.target.closest("[data-period-action]");
  if (period) {
    const payload = {
      action: period.dataset.periodAction,
      academic_year: Number(period.dataset.year),
      semester: Number(period.dataset.semester),
    };
    confirmAction(
      payload.action === "open" ? "Abrir formulário?" : "Fechar formulário?",
      `${periodLabel(payload)}. ` +
        (payload.action === "open"
          ? "Este será o período atual para os alunos. Outro período que esteja aberto será fechado. As respostas anteriores serão preservadas."
          : "Novos cadastros e envios deste período serão interrompidos. As respostas anteriores serão preservadas."),
      payload,
      "POST",
    );
  }
});
$("#new-period").addEventListener("submit", (e) => {
  e.preventDefault();
  const year = Number($("#new-year").value),
    semester = Number($("#new-semester").value);
  if (!Number.isInteger(year) || year < 2020 || year > 2100)
    return showError("Informe um ano entre 2020 e 2100.");
  confirmAction(
    "Criar período de avaliação?",
    `${year} · ${semester}º semestre. Os limites serão copiados de ${periodLabel(periodSelection)}. O novo período será criado fechado, sem integrantes e sem respostas.`,
    {
      action: "create",
      academic_year: year,
      semester,
      source_year: periodSelection.academic_year,
      source_semester: periodSelection.semester,
    },
    "POST",
  );
});
$("#dialog-cancel").addEventListener("click", () =>
  $("#management-dialog").close(),
);
$("#management-dialog").addEventListener("cancel", (e) => {
  if (saving) e.preventDefault();
});
$("#management-confirm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pendingAction || saving) return;
  saving = true;
  $("#dialog-save").disabled = $("#dialog-cancel").disabled = true;
  $("#dialog-error").hidden = true;
  try {
    const { payload, method } = pendingAction;
    await api("/api/manage", {
      method,
      body: JSON.stringify({
        ...payload,
        ...(method === "PATCH" ? { reason: $("#record-reason").value } : {}),
      }),
    });
    if (payload.action === "create")
      periodSelection = {
        academic_year: payload.academic_year,
        semester: payload.semester,
      };
    $("#management-dialog").close();
    await load();
    if (!$("#dashboard-error").hidden) return;
    $("#management-message").textContent =
      payload.action === "trash"
        ? "Registro movido para a lixeira. Os indicadores foram atualizados."
        : payload.action === "restore"
          ? "Registro restaurado. Os indicadores foram atualizados."
          : payload.action === "create"
            ? "Período criado fechado. Abra o formulário quando quiser iniciar a coleta."
            : payload.action === "open"
              ? "Formulário aberto para os alunos."
              : "Formulário fechado. As respostas foram preservadas.";
    $("#management-message").hidden = false;
  } catch (err) {
    $("#dialog-error").textContent =
      err.name === "TimeoutError"
        ? "A resposta demorou. Cancele e atualize o painel para conferir se a alteração foi salva antes de tentar novamente."
        : err.message;
    $("#dialog-error").hidden = false;
  } finally {
    saving = false;
    $("#dialog-save").disabled = $("#dialog-cancel").disabled = false;
  }
});

function categoryChart(items) {
  const labels = ["Muito Insatisfeito", "Insatisfeito", "Neutro", "Satisfeito", "Muito Satisfeito"];
  if (!items.length) return '<p class="empty">Nenhuma avaliação neste recorte.</p>';
  return '<div class="category-legend">' + labels.map((label,i) => '<span><i class="level-'+(i+1)+'"></i>'+label+'</span>').join('') + '</div><div class="table-wrap"><table class="category-chart"><thead><tr><th>Categoria</th><th>Distribuição das respostas</th><th>Média</th><th>Notas 4–5</th><th>Resp.</th></tr></thead><tbody>' + CRITERIA.map(([key,label]) => {
    const values=items.map(m=>m[key]).filter(v=>Number.isInteger(v)&&v>=1&&v<=5), total=values.length;
    const counts=labels.map((_,i)=>values.filter(v=>v===i+1).length);
    const bars=counts.map((n,i)=>{const pct=total?n/total*100:0;return n?'<span class="level-'+(i+1)+'" style="width:'+pct+'%" tabindex="0" title="'+labels[i]+': '+n+' respostas ('+Math.round(pct)+'%)" aria-label="'+labels[i]+': '+n+' respostas ('+Math.round(pct)+'%)">'+(pct>=9?Math.round(pct)+'%':'')+'</span>':''}).join('');
    return '<tr><th>'+label+'</th><td><div class="category-stack">'+bars+'</div></td><td>'+ (total?score(mean(values)):'—')+'</td><td>'+(total?Math.round((counts[3]+counts[4])/total*100)+'%':'—')+'</td><td>'+total+'</td></tr>';
  }).join('')+'</tbody></table></div>';
}

// Ordenação independente para os dois resumos, preservada após atualizar filtros.
const summarySort = new Map();
function sortSummary(bodyId, column, direction) {
  const body=document.getElementById(bodyId);
  const rows=[...body.children];
  const text=row=>{const cell=row.children[column];const summary=cell.querySelector('summary');return (summary||cell).textContent.trim();};
  rows.sort((a,b)=>{
    const x=text(a),y=text(b);
    const result=column>=(bodyId==='student-rows'?2:1)
      ? Number(x.replace(',','.'))-Number(y.replace(',','.'))
      : x.localeCompare(y,'pt-BR',{numeric:true,sensitivity:'base'});
    return direction==='ascending'?result:-result;
  });
  rows.forEach(row=>body.appendChild(row));
  const headers=body.closest('table').querySelectorAll('thead th');
  headers.forEach((th,i)=>{th.setAttribute('aria-sort',i===column?direction:'none');const indicator=th.querySelector('.sort-indicator');if(indicator)indicator.textContent=i===column?(direction==='ascending'?' ▲':' ▼'):' ↕';});
}
for(const bodyId of ['team-rows','student-rows']) {
 const body=document.getElementById(bodyId);
 body.closest('table').querySelectorAll('thead th').forEach((th,column)=>{
   const label=th.textContent.trim();const button=document.createElement('button');button.type='button';button.className='column-sort';button.textContent=label;
   const indicator=document.createElement('span');indicator.className='sort-indicator';indicator.setAttribute('aria-hidden','true');indicator.textContent=' ↕';button.appendChild(indicator);th.replaceChildren(button);th.setAttribute('aria-sort','none');
   button.addEventListener('click',()=>{const previous=summarySort.get(bodyId);const direction=previous?.column===column&&previous.direction==='ascending'?'descending':'ascending';summarySort.set(bodyId,{column,direction});sortSummary(bodyId,column,direction);});
 });
 new MutationObserver(records=>{if(!records.some(r=>r.addedNodes.length>1))return;const state=summarySort.get(bodyId);if(state)sortSummary(bodyId,state.column,state.direction);}).observe(body,{childList:true});
}

$("#student-rows").addEventListener("click", (event) => {
  const button = event.target.closest("[data-student-key]");
  if (!button) return;
  const student = studentDetails.get(button.dataset.studentKey);
  if (!student) return;
  selectedStudentKey = button.dataset.studentKey;
  $('#student-dialog-export-status').textContent = '';
  $("#student-dialog-title").textContent = student.name;
  $("#student-dialog-context").textContent = student.label + " · " + student.received + " avaliações recebidas";
  $("#student-dialog-average").textContent = score(mean(student.values));
  $("#student-dialog-chart").innerHTML = categoryChart(student.evaluations);
  $("#student-dialog-notes").innerHTML = CRITERIA.map(([key, label]) => {
    const notes = student.evaluations.map(item => item[key + "_obs"]).filter(note => typeof note === "string" && note.trim());
    return '<section class="student-note-category"><h3>' + esc(label) + '</h3>' + (notes.length ? notes.map(note => '<p class="observation">' + esc(note) + '</p>').join('') : '<p class="help-text">Nenhuma observação recebida neste critério.</p>') + '</section>';
  }).join("");
  $("#student-dialog").showModal();
});
$("#student-dialog-close").addEventListener("click", () => $("#student-dialog").close());

document.querySelectorAll('[data-student-export]').forEach(button => button.addEventListener('click', async () => {
  if (exportingStudents || !password || loading) return;
  const individual = button.hasAttribute('data-individual');
  const selected = individual ? [studentDetails.get(selectedStudentKey)].filter(Boolean) : [...studentDetails.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const status = $(individual ? '#student-dialog-export-status' : '#student-export-status');
  if (!selected.length) { status.textContent = 'Não há alunos avaliados para exportar neste recorte.'; return; }
  const version = sessionVersion;
  exportingStudents = true;
  document.querySelectorAll('[data-student-export]').forEach(b => { b.disabled = true; });
  status.textContent = 'Preparando arquivo com as médias e os gráficos…';
  const period = `${periodSelection.academic_year} · ${periodSelection.semester}º semestre`;
  const name = individual ? selected[0].name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 70) : 'alunos';
  try {
    await StudentReports[button.dataset.studentExport](selected, period, `STEM-${name}-${periodSelection.academic_year}-${periodSelection.semester}`);
    if (version === sessionVersion) status.textContent = 'Arquivo gerado. Confira os downloads do navegador.';
  } catch (err) {
    if (version === sessionVersion) status.textContent = err.message || 'Não foi possível exportar. Tente novamente.';
  } finally {
    exportingStudents = false;
    document.querySelectorAll('[data-student-export]').forEach(b => { b.disabled = !studentDetails.size; });
  }
}));

$("#participation-rows").addEventListener("click", (event) => {
  const button = event.target.closest("[data-participation-unit]");
  if (!button) return;
  const sameClass = row => row.unit === button.dataset.participationUnit && String(row.grade) === button.dataset.grade && row.class === button.dataset.class;
  const rosters = management.rosters.filter(row => !row.deleted_at && sameClass(row) && matchesFilters(row)).sort((a,b) => a.group_number - b.group_number);
  const submissions = management.submissions.filter(row => !row.deleted_at && sameClass(row) && matchesFilters(row));
  let pending = 0, answered = 0;
  const cards = rosters.map(roster => {
    const members = roster.members.map(member => {
      const sent = submissions.some(row => row.roster_id === roster.id && row.evaluator_id === member.id);
      if (sent) answered++; else pending++;
      return '<li class="participation-member ' + (sent ? 'answered' : 'pending') + '"><span>' + esc(member.name) + '</span><strong>' + (sent ? 'Respondeu' : 'Falta responder') + '</strong></li>';
    });
    return '<section class="participation-group"><h3>Grupo ' + esc(roster.group_number) + '</h3><ul>' + members.join('') + '</ul></section>';
  });
  $("#participation-dialog-title").textContent = button.dataset.participationUnit + ' · ' + button.dataset.grade + 'º ' + button.dataset.class;
  $("#participation-dialog-summary").textContent = answered + ' alunos responderam · ' + pending + ' ainda faltam responder';
  $("#participation-dialog-summary").classList.toggle('has-pending', pending > 0);
  const legacy = submissions.filter(row => !rosters.some(roster => roster.id === row.roster_id));
  $("#participation-dialog-content").innerHTML = (cards.join('') || '<p>Nenhum grupo com cadastro ativo neste recorte.</p>') + (legacy.length ? '<p class="help-text">Há ' + legacy.length + ' envios sem vínculo com os cadastros ativos. Eles não identificam a participação dos integrantes listados.</p>' : '');
  $("#participation-dialog").showModal();
});
$("#participation-dialog-close").addEventListener("click", () => $("#participation-dialog").close());

$("#responses").addEventListener("click", event => {
  const button = event.target.closest("[data-response-detail]");
  if (!button) return;
  const response = management.submissions.find(row => row.id === button.dataset.responseDetail);
  if (!response) return;
  $("#response-dialog-title").textContent = response.evaluator_name;
  $("#response-dialog-context").textContent = team(response) + ' · ' + dateTime(response.created_at);
  $("#response-dialog-content").innerHTML = '<p class="record-id">Comprovante: ' + esc(response.id) + '</p>' + response.members.map(member => '<section class="student-note-category"><h3>' + esc(member.member_name) + '</h3>' + CRITERIA.map(([key,label]) => '<div class="response-criterion"><p>' + esc(label) + ': <strong>' + esc(member[key]) + '/5</strong></p>' + (member[key + '_obs'] ? '<p class="observation">' + esc(member[key + '_obs']) + '</p>' : '') + '</div>').join('') + '</section>').join('') + (response.deleted_at ? '<p>Removida em ' + esc(dateTime(response.deleted_at)) + '</p><p>' + esc(response.delete_reason || 'Sem motivo informado') + '</p>' : '');
  $("#response-dialog").showModal();
});
$("#response-dialog-close").addEventListener("click", () => $("#response-dialog").close());
$("#student-qr-code").addEventListener("click", () => {
  $("#qr-dialog-image").innerHTML = $("#student-qr-code").innerHTML;
  $("#qr-dialog").showModal();
});
$("#qr-dialog-close").addEventListener("click", () => $("#qr-dialog").close());
document.querySelectorAll("[data-download-qr]").forEach(button => {
  button.addEventListener("click", () => {
    const qr = qrcode(0, "M");
    qr.addData($("#student-url").href);
    qr.make();
    const count = qr.getModuleCount(), scale = 24, margin = 4;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = (count + margin * 2) * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    for (let row = 0; row < count; row++)
      for (let col = 0; col < count; col++)
        if (qr.isDark(row, col)) ctx.fillRect((col + margin) * scale, (row + margin) * scale, scale, scale);
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url;
      link.download = "qrcode-avaliacao-equipes.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, "image/png");
  });
});
