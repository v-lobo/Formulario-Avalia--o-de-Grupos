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
let password = "",
  rows = [],
  visible = [],
  loading = false;
let schoolConfig = window.SCHOOL_CONFIG;
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
  loading = true;
  $("#dashboard-error").hidden = true;
  $("#load-status").textContent = "Carregando avaliações…";
  $("#login-button").disabled = true;
  try {
    const [res, settingsRes] = await Promise.all([
      fetch("/api/evaluations?semester=2", {
        headers: { Authorization: `Bearer ${password}` },
        signal: AbortSignal.timeout(20000),
      }),
      fetch("/api/settings", { signal: AbortSignal.timeout(20000) }),
    ]);
    const [data, settings] = await Promise.all([
      res.json(),
      settingsRes.json(),
    ]);
    if (!res.ok)
      throw new Error(data.error || "Não foi possível carregar as avaliações.");
    if (!settingsRes.ok)
      throw new Error(
        settings.error ||
          "Não foi possível carregar a configuração das turmas.",
      );
    schoolConfig = settings.config;
    renderSettings();
    rows = data;
    $("#login").hidden = true;
    $("#dashboard").hidden = false;
    const selected = $("#f-year").value,
      years = [...new Set([2026, ...rows.map((r) => r.academic_year)])].sort(
        (a, b) => b - a,
      );
    $("#f-year").innerHTML = years.map((y) => `<option>${y}</option>`).join("");
    $("#f-year").value = years.includes(Number(selected))
      ? selected
      : String(years[0]);
    render();
    $("#load-status").textContent =
      "Atualizado em " + new Date().toLocaleTimeString("pt-BR");
  } catch (error) {
    rows = [];
    visible = [];
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
  }
}
function render() {
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
  $("#criteria-bars").innerHTML = peers.length
    ? CRITERIA.map(([key, label]) => {
        const avg = mean(peers.map((m) => m[key]));
        return `<div class="bar-row"><span>${label}</span><div class="bar-track"><div class="bar-fill" style="width:${(avg / 5) * 100}%"></div></div><strong>${score(avg)}</strong></div>`;
      }).join("")
    : '<p class="empty">Nenhuma avaliação para os filtros selecionados.</p>';
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
          values: [],
        };
      s.received++;
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
  $("#student-rows").innerHTML =
    [...students.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map(
        (s) =>
          `<tr><td>${esc(s.name)}</td><td>${esc(s.label)}</td><td>${s.received}</td><td>${score(mean(s.values))}</td><td class="flag">${s.values.filter((n) => n <= 2).length}</td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="5" class="empty">Nenhum aluno avaliado.</td></tr>';
  $("#responses").innerHTML =
    visible
      .map(
        (r) =>
          `<details class="details-item"><summary>${esc(r.evaluator_name)} <small>· ${esc(team(r))} · ${new Date(r.created_at).toLocaleDateString("pt-BR")}</small></summary>${r.members.map((m) => `<h3>${esc(m.member_name)}</h3>${CRITERIA.map(([key, label]) => `<div>${label}: <strong>${m[key]}/5</strong></div>${m[key + "_obs"] ? `<p class="observation">${esc(m[key + "_obs"])}</p>` : ""}`).join("")}`).join("")}</details>`,
      )
      .join("") || '<p class="empty">Ainda não há respostas neste recorte.</p>';
}
function exportCSV() {
  if (!visible.length) {
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
    ],
  ];
  visible.forEach((r) =>
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
  a.download = `STEM-avaliacoes-${$("#f-year").value}-2-semestre.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
$("#login").addEventListener("submit", (e) => {
  e.preventDefault();
  password = $("#password").value;
  $("#password").value = "";
  load();
});
["f-year", "f-unit", "f-grade", "f-class", "f-group"].forEach((id) =>
  $("#" + id).addEventListener("change", render),
);
$("#refresh").addEventListener("click", load);
$("#export").addEventListener("click", exportCSV);
$("#logout").addEventListener("click", () => {
  password = "";
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
  ].forEach((id) => ($("#" + id).innerHTML = ""));
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
        `<tr><td>${esc(item.unit)}</td><td>${item.grade}º ano</td><td>${item.class} — ${item.shift}</td><td><input type="number" min="1" max="99" step="1" value="${item.groups}" aria-label="Quantidade de grupos: ${item.unit}, ${item.grade}º ${item.class}" style="width:76px;padding:8px;border:1px solid #d5d5df;border-radius:6px"></td><td><button type="button" class="secondary" data-save-limit data-unit="${esc(item.unit)}" data-grade="${item.grade}" data-class="${item.class}">Salvar</button></td></tr>`,
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
    unit: button.dataset.unit,
    grade: button.dataset.grade,
    class: button.dataset.class,
    groups,
  };
  button.disabled = true;
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
  }
});
