// ===== AUTH =====
const AUTH_PASS = 'tato123';
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

document.addEventListener('DOMContentLoaded', () => {
  $('#auth-btn').addEventListener('click', authenticate);
  $('#auth-pass').addEventListener('keydown', e => { if (e.key === 'Enter') authenticate(); });
});

function authenticate() {
  if ($('#auth-pass').value === AUTH_PASS) {
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

// ===== THEME =====
function initTheme() {
  const saved = localStorage.getItem('dash_theme') || 'dark';
  applyTheme(saved);
  $('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('dash_theme', next);
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const icon = theme === 'light' ? '☀️' : '🌙';
  $('.theme-icon').textContent = icon;
  // Update Chart.js defaults
  Chart.defaults.color = theme === 'light' ? '#475569' : '#94a3b8';
  Chart.defaults.borderColor = theme === 'light' ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)';
  // Re-render charts if data is loaded
  if (cachedStats) renderCharts(cachedStats);
}

// ===== CHART.JS DEFAULTS =====
Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.font.size = 12;

const MEMBER_COLOR = '#6366f1';
const LEADER_COLOR = '#f59e0b';
const CRITERIA_COLORS = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#3b82f6','#f97316'];

// ===== STATE =====
let charts = {};
let cachedStats = null;
let cachedEvals = null;

// ===== INIT =====
async function initDashboard() {
  initTheme();
  initFilters();
  await loadData();
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
  $('#btn-export-csv').addEventListener('click', exportCSV);
}

function updateClassFilter() {
  const unit = $('#f-unit').value;
  const grade = $('#f-grade').value;
  const sel = $('#f-class');
  sel.innerHTML = '<option value="">Todas</option>';
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
    cachedStats = stats;
    cachedEvals = evals;
    renderAll(stats, evals);
  } catch (e) {
    console.error('Error loading data:', e);
  }
}

// ===== RENDER =====
function renderAll(stats, evals) {
  renderStatsCards(stats);
  renderCharts(stats);
  renderSummaryTable(stats);
}

// ===== STATS CARDS =====
function renderStatsCards(stats) {
  const ms = stats.memberStats || {};
  const ls = stats.leaderStats || {};
  const combinedAvg = stats.combinedAvg || 0;
  const totalLow = stats.totalLowScores || 0;

  // Compute separate averages
  const memberAvg = ms.total_members > 0
    ? ((ms.avg_resp || 0) + (ms.avg_rel || 0) + (ms.avg_coop || 0) + (ms.avg_org || 0) + (ms.avg_edu || 0)) / 5
    : 0;
  const leaderAvg = ls.total_leader_evals > 0
    ? ((ls.avg_resp || 0) + (ls.avg_esp || 0) + (ls.avg_ori || 0) + (ls.avg_ini || 0) + (ls.avg_edu || 0)) / 5
    : 0;

  const cards = [
    { icon: '📋', color: 'purple', value: ms.total_evals || 0, label: 'Formulários' },
    { icon: '👥', color: 'green', value: ms.total_members || 0, label: 'Integrantes avaliados' },
    { icon: '⭐', color: 'amber', value: combinedAvg ? combinedAvg.toFixed(1) : '—', label: 'Média geral' },
    { icon: '👤', color: 'blue', value: memberAvg ? memberAvg.toFixed(1) : '—', label: 'Média integrantes' },
    { icon: '👑', color: 'gold', value: leaderAvg ? leaderAvg.toFixed(1) : '—', label: 'Média líderes' },
    { icon: '⚠️', color: 'red', value: totalLow, subValue: stats.totalPossibleScores ? `/ ${stats.totalPossibleScores}` : '', label: 'Notas 1 ou 2' },
  ];

  $('#stats-cards').innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="stat-icon-wrap ${c.color}">${c.icon}</div>
      <div class="stat-info">
        <div class="stat-value">${c.value}${c.subValue ? ` <span style="font-size:0.65em;color:var(--text-muted);font-weight:600;margin-left:4px">${c.subValue}</span>` : ''}</div>
        <div class="stat-label">${c.label}</div>
      </div>
    </div>
  `).join('');
}

// ===== CHARTS =====
function renderCharts(stats) {
  renderCriteriaChart(stats);
  renderTeamsChart(stats);
}

// --- Média por Critério ---
function renderCriteriaChart(stats) {
  const ms = stats.memberStats || {};
  const ls = stats.leaderStats || {};
  destroyChart('criteria');

  const hasMembers = ms.total_members > 0;
  const hasLeaders = ls.total_leader_evals > 0;
  if (!hasMembers && !hasLeaders) { noData('chart-criteria'); return; }
  clearNoData('chart-criteria');

  // All criteria labels in one chart
  const labels = [];
  const memberData = [];
  const leaderData = [];

  // Member criteria
  const memberCriteria = [
    { label: 'Responsabilidade', val: ms.avg_resp },
    { label: 'Relacionamento', val: ms.avg_rel },
    { label: 'Cooperação', val: ms.avg_coop },
    { label: 'Organização', val: ms.avg_org },
    { label: 'Educação', val: ms.avg_edu },
  ];

  // Leader criteria
  const leaderCriteria = [
    { label: 'Responsabilidade (líder)', val: ls.avg_resp },
    { label: 'Espírito de Equipe', val: ls.avg_esp },
    { label: 'Orientação Prof.', val: ls.avg_ori },
    { label: 'Iniciativa', val: ls.avg_ini },
    { label: 'Educação (líder)', val: ls.avg_edu },
  ];

  // Combine into a grouped bar chart: member criteria + leader criteria side by side
  const allCriteria = [
    ...memberCriteria.map(c => ({ ...c, group: 'Integrantes' })),
    ...leaderCriteria.map(c => ({ ...c, group: 'Líder' }))
  ];

  allCriteria.forEach(c => labels.push(c.label));
  const memberVals = memberCriteria.map(c => r(c.val));
  const leaderVals = leaderCriteria.map(c => r(c.val));

  // Use a single horizontal bar chart
  const allLabels = [...memberCriteria.map(c => c.label), ...leaderCriteria.map(c => c.label)];
  const allValues = [...memberVals, ...leaderVals];
  const allColors = [
    ...memberCriteria.map(() => MEMBER_COLOR),
    ...leaderCriteria.map(() => LEADER_COLOR)
  ];
  const allBgColors = allColors.map(c => c + '22');

  const theme = document.documentElement.dataset.theme;

  charts.criteria = new Chart($('#chart-criteria'), {
    type: 'bar',
    data: {
      labels: allLabels,
      datasets: [{
        data: allValues,
        backgroundColor: allColors.map(c => c + '30'),
        borderColor: allColors,
        borderWidth: 1.5,
        borderRadius: 6,
        barPercentage: 0.7,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 10 } },
      scales: {
        x: {
          beginAtZero: true, max: 5,
          grid: { color: 'var(--dash-chart-grid)' },
          ticks: { stepSize: 1 }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11, weight: '500' } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw.toFixed(1)} / 5.0`
          }
        }
      }
    }
  });
}

// --- Equipes em Comparação ---
function renderTeamsChart(stats) {
  const gs = stats.groupStats || [];
  destroyChart('teams');
  if (!gs.length) { noData('chart-teams'); return; }
  clearNoData('chart-teams');

  const labels = gs.map(g => `G${g.group_number} · ${g.unit} ${g.grade}º${g.class}`);
  const memberAvgs = gs.map(g => r(g.member_avg));
  const leaderAvgs = gs.map(g => g.leader_avg !== null ? r(g.leader_avg) : null);

  charts.teams = new Chart($('#chart-teams'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Média Colegas',
          data: memberAvgs,
          backgroundColor: MEMBER_COLOR + '40',
          borderColor: MEMBER_COLOR,
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
        },
        {
          label: 'Média Líder',
          data: leaderAvgs,
          backgroundColor: LEADER_COLOR + '40',
          borderColor: LEADER_COLOR,
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 5, grid: { color: 'var(--dash-chart-grid)' }, ticks: { stepSize: 1 } },
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 16, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw !== null ? ctx.raw.toFixed(1) : '—'} / 5.0` } }
      }
    }
  });
}

// ===== SUMMARY TABLE =====
function renderSummaryTable(stats) {
  const gs = stats.groupStats || [];
  const container = $('#summary-table-container');

  if (!gs.length) {
    container.innerHTML = '<div class="empty-state"><span class="emoji">📭</span><p>Nenhuma avaliação encontrada.</p></div>';
    return;
  }

  let html = `<table class="summary-table">
    <thead><tr>
      <th>Unidade</th><th>Série</th><th>Turma</th><th>Grupo</th>
      <th>Líder</th><th>Integrantes</th>
      <th>Média Colegas</th><th>Média Líder</th><th>Atenção</th><th></th>
    </tr></thead><tbody>`;

  gs.forEach(g => {
    const memberBadge = avgBadge(g.member_avg);
    const leaderBadge = g.leader_avg !== null ? avgBadge(g.leader_avg) : '<span style="color:var(--dash-text-dim)">—</span>';

    let attentionHTML = '';
    if (g.low_details && g.low_details.length > 0) {
      attentionHTML = '<div class="attention-tags">';
      g.low_details.forEach(d => {
        d.fields.forEach(f => {
          attentionHTML += `<span class="attention-tag" title="${d.name}">⚠ ${d.name.split(' ')[0]}: ${f}</span>`;
        });
      });
      attentionHTML += '</div>';
    } else {
      attentionHTML = '<span class="attention-tag ok">✓ OK</span>';
    }

    html += `<tr>
      <td>${g.unit}</td><td>${g.grade}º</td><td>${g.class}</td>
      <td>Grupo ${g.group_number}</td>
      <td class="leader-name">${g.leader_name || '—'}</td>
      <td>${g.member_count}</td>
      <td>${memberBadge}</td>
      <td>${leaderBadge}</td>
      <td>${attentionHTML}</td>
      <td>
        <div style="display:flex; gap:8px">
          <button class="btn-view" onclick="viewDetail(${g.group_number}, '${g.unit}', '${g.grade}', '${g.class}')">Ver</button>
          <button class="btn-view" style="background:rgba(239,68,68,.15);color:var(--danger);border:none" onclick="deleteEvaluation(${g.id})" title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function avgBadge(val) {
  const cls = val >= 4 ? 'high' : val >= 3 ? 'mid' : 'low';
  return `<span class="avg-badge ${cls}">${val.toFixed(1)}</span>`;
}

// ===== VIEW DETAIL MODAL =====
window.viewDetail = async function(groupNum, unit, grade, cls) {
  // Find the evaluation(s) for this group
  const filters = { unit, grade, class: cls, group_number: groupNum };
  const qs = new URLSearchParams(filters).toString();

  try {
    const res = await fetch(`/api/evaluations?${qs}`);
    const evals = await res.json();
    if (!evals.length) return;

    // Get detailed data for first evaluation
    const detailRes = await fetch(`/api/evaluation?id=${evals[0].id}`);
    const data = await detailRes.json();
    showDetailModal(data);
  } catch (e) { console.error(e); }
};

function showDetailModal(data) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const membersHTML = (data.members || []).map(m => {
    const avg = (m.responsabilidade + m.relacionamento + m.cooperacao + m.organizacao + m.educacao) / 5;
    return `
    <div class="modal-member">
      <div class="modal-member-name">👤 ${m.member_name} <span style="font-size:0.85em;color:var(--text-muted);font-weight:normal;margin-left:8px">(Média: ${avg.toFixed(1)}/5)</span></div>
      <div class="modal-scores">
        <span>📌 Responsabilidade: ${scoreInline(m.responsabilidade)}</span>
        <span>🤝 Relacionamento: ${scoreInline(m.relacionamento)}</span>
        <span>💪 Cooperação: ${scoreInline(m.cooperacao)}</span>
        <span>📂 Organização: ${scoreInline(m.organizacao)}</span>
        <span>🎓 Educação: ${scoreInline(m.educacao)}</span>
      </div>
      ${obsSection(m)}
    </div>
  `}).join('');

  let leaderHTML = '';
  if (data.leaderEval) {
    const le = data.leaderEval;
    const avg = (le.responsabilidade + le.espirito_equipe + le.orientacao_professor + le.iniciativa + le.educacao) / 5;
    leaderHTML = `
      <div class="modal-section-title leader">👑 Avaliação do Líder: ${data.leader_name} <span style="font-size:0.85em;color:var(--text-muted);font-weight:normal;margin-left:8px">(Média: ${avg.toFixed(1)}/5)</span></div>
      <div class="modal-member">
        <div class="modal-scores">
          <span>📌 Responsabilidade: ${scoreInline(le.responsabilidade)}</span>
          <span>🌟 Espírito Equipe: ${scoreInline(le.espirito_equipe)}</span>
          <span>📖 Orientação Prof.: ${scoreInline(le.orientacao_professor)}</span>
          <span>🚀 Iniciativa: ${scoreInline(le.iniciativa)}</span>
          <span>🎓 Educação: ${scoreInline(le.educacao)}</span>
        </div>
        ${leaderObsSection(le)}
      </div>
    `;
  }

  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-top">
        <h2>📋 ${data.leader_name} — ${data.unit} ${data.grade}º ${data.class} Grupo ${data.group_number}</h2>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-section-title member">👥 Integrantes Avaliados</div>
      ${membersHTML || '<p style="color:var(--dash-text-dim);padding:12px">Nenhum integrante avaliado.</p>'}
      ${leaderHTML}
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function deleteEvaluation(id) {
  if (!confirm("Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita.")) return;
  
  try {
    const res = await fetch(`/api/delete?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert("Avaliação excluída com sucesso.");
      loadData(); // Recarrega os dados da tabela
    } else {
      const err = await res.json();
      alert("Erro ao excluir: " + (err.error || "Desconhecido"));
    }
  } catch (e) {
    console.error("Erro na exclusão:", e);
    alert("Erro de conexão ao tentar excluir.");
  }
}

function scoreInline(v) {
  const cls = v >= 4 ? 'high' : v >= 3 ? 'mid' : 'low';
  return `<span class="score-inline ${cls}">${v}/5</span>`;
}

function obsSection(m) {
  const fields = [
    ['responsabilidade_obs','Responsabilidade'], ['relacionamento_obs','Relacionamento'],
    ['cooperacao_obs','Cooperação'], ['organizacao_obs','Organização'], ['educacao_obs','Educação']
  ];
  const obs = fields.filter(([k]) => m[k]).map(([k,l]) => `<div><strong>${l}:</strong> ${m[k]}</div>`);
  return obs.length ? `<div class="modal-obs">${obs.join('')}</div>` : '';
}

function leaderObsSection(le) {
  const fields = [
    ['responsabilidade_obs','Responsabilidade'], ['espirito_equipe_obs','Espírito Equipe'],
    ['orientacao_professor_obs','Orientação Prof.'], ['iniciativa_obs','Iniciativa'], ['educacao_obs','Educação']
  ];
  const obs = fields.filter(([k]) => le[k]).map(([k,l]) => `<div><strong>${l}:</strong> ${le[k]}</div>`);
  return obs.length ? `<div class="modal-obs">${obs.join('')}</div>` : '';
}

// ===== EXPORT CSV =====
async function exportCSV() {
  const filters = getFilters();
  const qs = new URLSearchParams(filters).toString();

  try {
    const res = await fetch(`/api/evaluations?${qs}`);
    const evals = await res.json();

    if (!evals.length) {
      alert('Nenhum dado para exportar.');
      return;
    }

    // Fetch detailed data for all evaluations
    const detailPromises = evals.map(ev => fetch(`/api/evaluation?id=${ev.id}`).then(r => r.json()));
    const details = await Promise.all(detailPromises);

    // Build CSV rows
    const rows = [
      ['Unidade','Série','Turma','Grupo','Líder',
       'Tipo','Nome Avaliado',
       'Responsabilidade','Responsabilidade Obs',
       'Relacionamento/Espírito Equipe','Relacionamento/Espírito Equipe Obs',
       'Cooperação/Orientação Prof.','Cooperação/Orientação Prof. Obs',
       'Organização/Iniciativa','Organização/Iniciativa Obs',
       'Educação','Educação Obs'].join(';')
    ];

    details.forEach(d => {
      const base = [d.unit, `${d.grade}º`, d.class, `Grupo ${d.group_number}`, d.leader_name];

      (d.members || []).forEach(m => {
        rows.push([
          ...base, 'Integrante', m.member_name,
          m.responsabilidade, csvSafe(m.responsabilidade_obs),
          m.relacionamento, csvSafe(m.relacionamento_obs),
          m.cooperacao, csvSafe(m.cooperacao_obs),
          m.organizacao, csvSafe(m.organizacao_obs),
          m.educacao, csvSafe(m.educacao_obs)
        ].join(';'));
      });

      if (d.leaderEval) {
        const le = d.leaderEval;
        rows.push([
          ...base, 'Líder', d.leader_name,
          le.responsabilidade, csvSafe(le.responsabilidade_obs),
          le.espirito_equipe, csvSafe(le.espirito_equipe_obs),
          le.orientacao_professor, csvSafe(le.orientacao_professor_obs),
          le.iniciativa, csvSafe(le.iniciativa_obs),
          le.educacao, csvSafe(le.educacao_obs)
        ].join(';'));
      }
    });

    // Trigger download
    const bom = '\uFEFF';
    const blob = new Blob([bom + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avaliacoes_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Export error:', e);
    alert('Erro ao exportar.');
  }
}

function csvSafe(val) {
  if (!val) return '';
  return `"${String(val).replace(/"/g, '""')}"`;
}

// ===== HELPERS =====
function r(v) { return v != null ? Math.round(v * 100) / 100 : 0; }
function destroyChart(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }

function noData(canvasId) {
  const canvas = $(`#${canvasId}`);
  const parent = canvas.parentElement;
  if (!parent.querySelector('.empty-state')) {
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
