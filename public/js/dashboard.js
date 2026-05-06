// ===== AUTH =====
const AUTH_PASS = 'professor';
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

document.addEventListener('DOMContentLoaded', () => {
  $('#auth-btn').addEventListener('click', authenticate);
  $('#auth-pass').addEventListener('keydown', e => { if (e.key === 'Enter') authenticate(); });
  if (sessionStorage.getItem('dash_auth')) showDashboard();
});

function authenticate() {
  if ($('#auth-pass').value === AUTH_PASS) {
    sessionStorage.setItem('dash_auth', '1');
    showDashboard();
  } else {
    $('#auth-pass').style.borderColor = 'var(--danger)';
    $('#auth-pass').value = '';
    $('#auth-pass').placeholder = 'Senha incorreta!';
  }
}

function showDashboard() {
  $('#auth-gate').style.display = 'none';
  $('#dashboard').style.display = 'block';
  initDashboard();
}

// ===== CHART.JS DEFAULTS =====
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = 'Inter, sans-serif';

const COLORS = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6'];
const COLORS_BG = COLORS.map(c => c + '33');

// ===== DASHBOARD =====
let charts = {};

async function initDashboard() {
  initTabs();
  initFilters();
  await loadData();
}

// ===== TABS =====
function initTabs() {
  $$('.dash-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.dash-tab').forEach(t => t.classList.remove('active'));
      $$('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      $(`#tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

// ===== FILTERS =====
const CLASS_MAP = {
  'Farol-6':['A','B'], 'Farol-7':['A'],
  'Jatiúca-6':['A','B','C','D','E'], 'Jatiúca-7':['A','B','C','D'],
};

function initFilters() {
  ['f-unit','f-grade','f-group'].forEach(id => {
    $(`#${id}`).addEventListener('change', () => { updateClassFilter(); loadData(); });
  });
  $('#f-class').addEventListener('change', loadData);
  $('#btn-clear-filters').addEventListener('click', () => {
    ['f-unit','f-grade','f-class','f-group'].forEach(id => $(`#${id}`).value = '');
    updateClassFilter();
    loadData();
  });
}

function updateClassFilter() {
  const unit = $('#f-unit').value;
  const grade = $('#f-grade').value;
  const sel = $('#f-class');
  sel.innerHTML = '<option value="">Todas Turmas</option>';
  if (unit && grade) {
    const classes = CLASS_MAP[`${unit}-${grade}`] || [];
    classes.forEach(c => { sel.innerHTML += `<option value="${c}">Turma ${c}</option>`; });
  }
}

function getFilters() {
  const f = {};
  const unit = $('#f-unit').value; if (unit) f.unit = unit;
  const grade = $('#f-grade').value; if (grade) f.grade = grade;
  const cls = $('#f-class').value; if (cls) f.class = cls;
  const grp = $('#f-group').value; if (grp) f.group_number = grp;
  return f;
}

// ===== DATA LOADING =====
async function loadData() {
  const filters = getFilters();
  const qs = new URLSearchParams(filters).toString();

  try {
    const [statsRes, evalsRes] = await Promise.all([
      fetch(`/api/stats?${qs}`),
      fetch(`/api/evaluations?${qs}`)
    ]);
    const stats = await statsRes.json();
    const evals = await evalsRes.json();
    renderAll(stats, evals);
  } catch (e) {
    console.error('Error loading data:', e);
  }
}

// ===== RENDER =====
function renderAll(stats, evals) {
  renderStatsCards(stats);
  renderRadarMembers(stats);
  renderRadarLeaders(stats);
  renderClassComparison(stats);
  renderGroupRanking(stats);
  renderGroupCriteria(stats);
  renderLeaderRanking(stats);
  renderLeaderVsMember(stats);
  renderDetailsTable(evals);
}

// ===== STATS CARDS =====
function renderStatsCards(stats) {
  const ms = stats.memberStats || {};
  const ls = stats.leaderStats || {};
  const avgAll = ((ms.avg_resp||0)+(ms.avg_rel||0)+(ms.avg_coop||0)+(ms.avg_org||0)+(ms.avg_edu||0)) / 5;

  const cards = [
    { icon:'📊', value: ms.total_evals || 0, label:'Avaliações' },
    { icon:'👥', value: ms.total_members || 0, label:'Alunos Avaliados' },
    { icon:'👑', value: ls.total_leader_evals || 0, label:'Líderes Avaliados' },
    { icon:'⭐', value: avgAll ? avgAll.toFixed(1) : '—', label:'Média Geral' },
  ];

  $('#stats-cards').innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="stat-icon">${c.icon}</div>
      <div class="stat-value">${c.value}</div>
      <div class="stat-label">${c.label}</div>
    </div>
  `).join('');
}

// ===== RADAR: MEMBERS =====
function renderRadarMembers(stats) {
  const ms = stats.memberStats || {};
  destroyChart('radarMembers');
  if (!ms.total_members) { noData('chart-radar-members'); return; }
  clearNoData('chart-radar-members');
  charts.radarMembers = new Chart($('#chart-radar-members'), {
    type: 'radar',
    data: {
      labels: ['Responsabilidade','Relacionamento','Cooperação','Organização','Educação'],
      datasets: [{
        label: 'Média',
        data: [ms.avg_resp, ms.avg_rel, ms.avg_coop, ms.avg_org, ms.avg_edu],
        backgroundColor: COLORS_BG[0], borderColor: COLORS[0], borderWidth: 2, pointRadius: 4,
      }]
    },
    options: {
      responsive: true, scales: { r: { min: 0, max: 5, ticks: { stepSize: 1 } } },
      plugins: { legend: { display: false } },
    }
  });
}

// ===== RADAR: LEADERS =====
function renderRadarLeaders(stats) {
  const ls = stats.leaderStats || {};
  destroyChart('radarLeaders');
  if (!ls.total_leader_evals) { noData('chart-radar-leaders'); return; }
  clearNoData('chart-radar-leaders');
  charts.radarLeaders = new Chart($('#chart-radar-leaders'), {
    type: 'radar',
    data: {
      labels: ['Responsabilidade','Espírito de Equipe','Orientação Prof.','Iniciativa','Educação'],
      datasets: [{
        label: 'Média',
        data: [ls.avg_resp, ls.avg_esp, ls.avg_ori, ls.avg_ini, ls.avg_edu],
        backgroundColor: COLORS_BG[3], borderColor: COLORS[3], borderWidth: 2, pointRadius: 4,
      }]
    },
    options: {
      responsive: true, scales: { r: { min: 0, max: 5, ticks: { stepSize: 1 } } },
      plugins: { legend: { display: false } },
    }
  });
}

// ===== CLASS COMPARISON =====
function renderClassComparison(stats) {
  const cs = stats.classStats || [];
  destroyChart('classComp');
  if (!cs.length) { noData('chart-class-comparison'); return; }
  clearNoData('chart-class-comparison');

  charts.classComp = new Chart($('#chart-class-comparison'), {
    type: 'bar',
    data: {
      labels: cs.map(c => `${c.unit} ${c.grade}º ${c.class}`),
      datasets: [
        { label:'Responsabilidade', data: cs.map(c=>r(c.avg_resp)), backgroundColor: COLORS[0] },
        { label:'Relacionamento', data: cs.map(c=>r(c.avg_rel)), backgroundColor: COLORS[1] },
        { label:'Cooperação', data: cs.map(c=>r(c.avg_coop)), backgroundColor: COLORS[2] },
        { label:'Organização', data: cs.map(c=>r(c.avg_org)), backgroundColor: COLORS[3] },
        { label:'Educação', data: cs.map(c=>r(c.avg_edu)), backgroundColor: COLORS[4] },
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, max: 5 } },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } } },
    }
  });
}

// ===== GROUP RANKING =====
function renderGroupRanking(stats) {
  const gs = stats.groupStats || [];
  destroyChart('groupRank');
  if (!gs.length) { noData('chart-group-ranking'); return; }
  clearNoData('chart-group-ranking');

  const sorted = [...gs].sort((a,b) => b.avg_overall - a.avg_overall);
  charts.groupRank = new Chart($('#chart-group-ranking'), {
    type: 'bar',
    data: {
      labels: sorted.map(g => `${g.unit} ${g.grade}º${g.class} G${g.group_number}`),
      datasets: [{
        label: 'Média Geral',
        data: sorted.map(g => r(g.avg_overall)),
        backgroundColor: sorted.map((_,i) => COLORS[i % COLORS.length] + '99'),
        borderColor: sorted.map((_,i) => COLORS[i % COLORS.length]),
        borderWidth: 1, borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y', responsive: true,
      scales: { x: { beginAtZero: true, max: 5 } },
      plugins: { legend: { display: false } },
    }
  });
}

// ===== GROUP CRITERIA =====
function renderGroupCriteria(stats) {
  const gs = stats.groupStats || [];
  destroyChart('groupCrit');
  if (!gs.length) { noData('chart-group-criteria'); return; }
  clearNoData('chart-group-criteria');

  charts.groupCrit = new Chart($('#chart-group-criteria'), {
    type: 'bar',
    data: {
      labels: gs.map(g => `G${g.group_number} (${g.unit} ${g.grade}º${g.class})`),
      datasets: [
        { label:'Responsabilidade', data: gs.map(g=>r(g.avg_resp)), backgroundColor: COLORS[0] },
        { label:'Relacionamento', data: gs.map(g=>r(g.avg_rel)), backgroundColor: COLORS[1] },
        { label:'Cooperação', data: gs.map(g=>r(g.avg_coop)), backgroundColor: COLORS[2] },
        { label:'Organização', data: gs.map(g=>r(g.avg_org)), backgroundColor: COLORS[3] },
        { label:'Educação', data: gs.map(g=>r(g.avg_edu)), backgroundColor: COLORS[4] },
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, max: 5 } },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } } },
    }
  });
}

// ===== LEADER RANKING =====
function renderLeaderRanking(stats) {
  const lg = stats.leaderGroupStats || [];
  destroyChart('leaderRank');
  if (!lg.length) { noData('chart-leader-ranking'); return; }
  clearNoData('chart-leader-ranking');

  const sorted = [...lg].sort((a,b) => b.avg_overall - a.avg_overall);
  charts.leaderRank = new Chart($('#chart-leader-ranking'), {
    type: 'bar',
    data: {
      labels: sorted.map(g => `${g.unit} ${g.grade}º${g.class} G${g.group_number}`),
      datasets: [{
        label: 'Média do Líder',
        data: sorted.map(g => r(g.avg_overall)),
        backgroundColor: sorted.map((_,i) => COLORS[(i+3) % COLORS.length] + '99'),
        borderColor: sorted.map((_,i) => COLORS[(i+3) % COLORS.length]),
        borderWidth: 1, borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y', responsive: true,
      scales: { x: { beginAtZero: true, max: 5 } },
      plugins: { legend: { display: false } },
    }
  });
}

// ===== LEADER VS MEMBER =====
function renderLeaderVsMember(stats) {
  const gs = stats.groupStats || [];
  const lg = stats.leaderGroupStats || [];
  destroyChart('lvmChart');
  if (!gs.length && !lg.length) { noData('chart-leader-vs-member'); return; }
  clearNoData('chart-leader-vs-member');

  // Match groups
  const labels = []; const memberData = []; const leaderData = [];
  gs.forEach(g => {
    const key = `${g.unit}-${g.grade}-${g.class}-${g.group_number}`;
    const leader = lg.find(l => `${l.unit}-${l.grade}-${l.class}-${l.group_number}` === key);
    labels.push(`G${g.group_number} (${g.unit} ${g.grade}º${g.class})`);
    memberData.push(r(g.avg_overall));
    leaderData.push(leader ? r(leader.avg_overall) : 0);
  });

  charts.lvmChart = new Chart($('#chart-leader-vs-member'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Integrantes', data: memberData, backgroundColor: COLORS[0]+'99', borderColor: COLORS[0], borderWidth: 1, borderRadius: 6 },
        { label: 'Líder', data: leaderData, backgroundColor: COLORS[3]+'99', borderColor: COLORS[3], borderWidth: 1, borderRadius: 6 },
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, max: 5 } },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } } },
    }
  });
}

// ===== DETAILS TABLE =====
async function renderDetailsTable(evals) {
  const container = $('#details-table-container');
  if (!evals.length) {
    container.innerHTML = '<div class="empty-state"><span class="emoji">📭</span><p>Nenhuma avaliação encontrada.</p></div>';
    return;
  }

  let html = `<table class="detail-table">
    <thead><tr>
      <th>Data</th><th>Líder</th><th>Unidade</th><th>Série</th><th>Turma</th><th>Grupo</th><th>Integrantes</th><th>Ações</th>
    </tr></thead><tbody>`;

  evals.forEach(ev => {
    const date = new Date(ev.created_at).toLocaleDateString('pt-BR');
    html += `<tr>
      <td>${date}</td><td><strong>${ev.leader_name}</strong></td>
      <td>${ev.unit}</td><td>${ev.grade}º</td><td>${ev.class}</td>
      <td>Grupo ${ev.group_number}</td><td>${ev.member_count}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="viewDetail(${ev.id})">Ver</button></td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// ===== VIEW DETAIL =====
window.viewDetail = async function(id) {
  try {
    const res = await fetch(`/api/evaluation?id=${id}`);
    const data = await res.json();
    showDetailModal(data);
  } catch (e) { console.error(e); }
};

function showDetailModal(data) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,26,.9);z-index:5000;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';

  let membersHTML = (data.members || []).map(m => `
    <div style="margin-bottom:16px;padding:12px;background:rgba(255,255,255,.03);border-radius:10px">
      <strong style="color:var(--accent-light)">👤 ${m.member_name}</strong>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;font-size:.82rem">
        <span>📌 Responsabilidade: ${scoreLabel(m.responsabilidade)}</span>
        <span>🤝 Relacionamento: ${scoreLabel(m.relacionamento)}</span>
        <span>💪 Cooperação: ${scoreLabel(m.cooperacao)}</span>
        <span>📂 Organização: ${scoreLabel(m.organizacao)}</span>
        <span>🎓 Educação: ${scoreLabel(m.educacao)}</span>
      </div>
      ${obsSection(m)}
    </div>
  `).join('');

  let leaderHTML = '';
  if (data.leaderEval) {
    const le = data.leaderEval;
    leaderHTML = `
      <h3 style="margin:16px 0 8px;color:var(--gold-light)">👑 Avaliação do Líder: ${data.leader_name}</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.82rem">
        <span>📌 Responsabilidade: ${scoreLabel(le.responsabilidade)}</span>
        <span>🌟 Espírito Equipe: ${scoreLabel(le.espirito_equipe)}</span>
        <span>📖 Orientação Prof.: ${scoreLabel(le.orientacao_professor)}</span>
        <span>🚀 Iniciativa: ${scoreLabel(le.iniciativa)}</span>
        <span>🎓 Educação: ${scoreLabel(le.educacao)}</span>
      </div>
      ${leaderObsSection(le)}
    `;
  }

  overlay.innerHTML = `
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);max-width:600px;width:100%;max-height:80vh;overflow-y:auto;padding:28px 24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2>📋 ${data.leader_name} — ${data.unit} ${data.grade}º ${data.class} Grupo ${data.group_number}</h2>
        <button class="modal-close-btn" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer">✕</button>
      </div>
      <h3 style="margin-bottom:8px;color:var(--accent-light)">👥 Integrantes Avaliados</h3>
      ${membersHTML}
      ${leaderHTML}
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function scoreLabel(v) {
  const cls = v >= 4 ? 'high' : v >= 3 ? 'mid' : 'low';
  return `<span class="score ${cls}">${'★'.repeat(v)}${'☆'.repeat(5-v)} (${v})</span>`;
}

function obsSection(m) {
  const fields = [
    ['responsabilidade_obs','Responsabilidade'], ['relacionamento_obs','Relacionamento'],
    ['cooperacao_obs','Cooperação'], ['organizacao_obs','Organização'], ['educacao_obs','Educação']
  ];
  const obs = fields.filter(([k]) => m[k]).map(([k,l]) => `<div style="font-size:.78rem;color:var(--text-dim)"><strong>${l}:</strong> ${m[k]}</div>`);
  return obs.length ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">${obs.join('')}</div>` : '';
}

function leaderObsSection(le) {
  const fields = [
    ['responsabilidade_obs','Responsabilidade'], ['espirito_equipe_obs','Espírito Equipe'],
    ['orientacao_professor_obs','Orientação Prof.'], ['iniciativa_obs','Iniciativa'], ['educacao_obs','Educação']
  ];
  const obs = fields.filter(([k]) => le[k]).map(([k,l]) => `<div style="font-size:.78rem;color:var(--text-dim)"><strong>${l}:</strong> ${le[k]}</div>`);
  return obs.length ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">${obs.join('')}</div>` : '';
}

// ===== HELPERS =====
function r(v) { return v ? Math.round(v * 100) / 100 : 0; }
function destroyChart(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }
function noData(canvasId) {
  const canvas = $(`#${canvasId}`);
  const parent = canvas.parentElement;
  const existing = parent.querySelector('.empty-state');
  if (!existing) {
    canvas.style.display = 'none';
    parent.insertAdjacentHTML('beforeend', '<div class="empty-state"><span class="emoji">📭</span><p>Sem dados para exibir.</p></div>');
  }
}
function clearNoData(canvasId) {
  const canvas = $(`#${canvasId}`);
  const parent = canvas.parentElement;
  const existing = parent.querySelector('.empty-state');
  if (existing) existing.remove();
  canvas.style.display = '';
}
