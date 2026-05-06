// ===== THEME =====
function initTheme() {
  const saved = localStorage.getItem('dash_theme') || 'dark';
  applyTheme(saved);
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      localStorage.setItem('dash_theme', next);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const icon = theme === 'light' ? '☀️' : '🌙';
  const el = document.querySelector('.theme-icon');
  if (el) el.textContent = icon;
}

// ===== STATE =====
const state = {
  currentStep: 1,
  unit: '', grade: '', class: '', group: '',
  leaderName: '',
  evaluationId: null,
  members: [] // { name, ratings: { field: { score, obs } } }
};

// ===== CLASS MAP =====
const CLASS_MAP = {
  'Farol-6': ['A', 'B'],
  'Farol-7': ['A'],
  'Jatiúca-6': ['A', 'B', 'C', 'D', 'E'],
  'Jatiúca-7': ['A', 'B', 'C', 'D'],
};

// ===== CRITERIA DEFINITIONS =====
const MEMBER_CRITERIA = [
  { key: 'responsabilidade', label: 'Responsabilidade', icon: '📌',
    desc: 'Cumpre os prazos e faz sua parte no trabalho sem precisar que alguém cobre.' },
  { key: 'relacionamento', label: 'Relacionamento Interpessoal', icon: '🤝',
    desc: 'Trata todos com respeito e se dá bem com os colegas do grupo.' },
  { key: 'cooperacao', label: 'Cooperação', icon: '💪',
    desc: 'Ajuda os colegas quando eles precisam e trabalha junto com a equipe.' },
  { key: 'organizacao', label: 'Organização', icon: '📂',
    desc: 'Mantém seus materiais em ordem e segue o planejamento do grupo.' },
  { key: 'educacao', label: 'Educação', icon: '🎓',
    desc: 'É educado, respeitoso e se comporta bem durante as atividades.' },
];

const LEADER_CRITERIA = [
  { key: 'responsabilidade', label: 'Responsabilidade', icon: '📌',
    desc: 'Cumpre os prazos e lidera dando o exemplo no trabalho.' },
  { key: 'espirito_equipe', label: 'Espírito de Equipe', icon: '🌟',
    desc: 'Motiva o grupo e se preocupa com todos os integrantes.' },
  { key: 'orientacao_professor', label: 'Orientação com Professor', icon: '📖',
    desc: 'Busca ajuda do professor quando o grupo precisa e passa as informações para a equipe.' },
  { key: 'iniciativa', label: 'Iniciativa', icon: '🚀',
    desc: 'Toma decisões e começa as atividades sem esperar que outros peçam.' },
  { key: 'educacao', label: 'Educação', icon: '🎓',
    desc: 'É educado, respeitoso e se comporta bem durante as atividades.' },
];

// ===== DOM REFS =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSelectButtons();
  initNavigation();
  initMemberSystem();
  initLeaderForm();
});

// ===== SELECT BUTTONS (Unit/Grade) =====
function initSelectButtons() {
  $$('.select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      // Deselect siblings
      btn.closest('.select-group').querySelectorAll('.select-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state[group] = btn.dataset.value;
      btn.closest('.form-group').classList.remove('error');
      updateClassDropdown();
    });
  });
}

function updateClassDropdown() {
  const sel = $('#class-select');
  const key = `${state.unit}-${state.grade}`;
  const classes = CLASS_MAP[key];

  sel.innerHTML = '';
  if (!classes) {
    sel.innerHTML = '<option value="">Selecione unidade e série</option>';
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = '<option value="">Selecione a turma</option>' +
    classes.map(c => `<option value="${c}">Turma ${c}</option>`).join('');
}

// ===== NAVIGATION =====
function initNavigation() {
  $('#btn-next-1').addEventListener('click', () => {
    if (validateStep1()) goToStep(2);
  });
  $('#btn-next-2').addEventListener('click', () => {
    if (validateStep2()) submitMemberEvals();
  });
  $('#btn-next-3').addEventListener('click', () => goToStep(4));
  $('#btn-submit').addEventListener('click', () => {
    if (validateLeaderEval()) submitLeaderEval();
  });
}

function goToStep(step) {
  // Hide current
  $(`.form-step.active`).classList.remove('active');
  // Show target
  $(`#step-${step}`).classList.add('active');

  // Update progress
  $$('.step').forEach(s => {
    const sNum = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');
    if (sNum < step) s.classList.add('completed');
    if (sNum === step) s.classList.add('active');
  });
  // Update lines
  for (let i = 1; i < 5; i++) {
    const line = $(`#line-${i}-${i + 1}`);
    if (line) line.classList.toggle('filled', i < step);
  }

  state.currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (step === 4) {
    $('#leader-name-display').textContent = state.leaderName;
  }
}

// ===== VALIDATION =====
function validateStep1() {
  let valid = true;
  const name = $('#leader-name').value.trim();
  if (!name) { setError('#leader-name'); valid = false; } else { clearError('#leader-name'); }
  state.leaderName = name;

  if (!state.unit) {
    $('#unit-group').closest('.form-group').classList.add('error'); valid = false;
  }
  if (!state.grade) {
    $('#grade-group').closest('.form-group').classList.add('error'); valid = false;
  }

  const cls = $('#class-select').value;
  if (!cls) { setError('#class-select'); valid = false; } else { clearError('#class-select'); state.class = cls; }

  const grp = $('#group-select').value;
  if (!grp) { setError('#group-select'); valid = false; } else { clearError('#group-select'); state.group = grp; }

  if (!valid) showToast('Preencha todos os campos!', 'error');
  return valid;
}

function validateStep2() {
  const cards = $$('.member-card');
  if (cards.length === 0) {
    showToast('Adicione pelo menos um integrante!', 'error');
    return false;
  }

  state.members = [];
  let valid = true;

  cards.forEach((card, idx) => {
    const nameInput = card.querySelector('.member-name-input');
    const name = nameInput.value.trim();
    if (!name) { nameInput.closest('.form-group').classList.add('error'); valid = false; }
    else { nameInput.closest('.form-group').classList.remove('error'); }

    const ratings = {};
    MEMBER_CRITERIA.forEach(c => {
      const score = getStarValue(card, c.key);
      const obs = card.querySelector(`.obs-${c.key}`).value.trim();
      if (!score) {
        card.querySelector(`.stars-${c.key}`).classList.add('error');
        valid = false;
      } else {
        card.querySelector(`.stars-${c.key}`).classList.remove('error');
      }
      ratings[c.key] = { score, obs };
    });

    state.members.push({ name, ratings });
  });

  if (!valid) showToast('Preencha todos os nomes e estrelas!', 'error');
  return valid;
}

function validateLeaderEval() {
  const form = $('#leader-eval-form');
  let valid = true;

  LEADER_CRITERIA.forEach(c => {
    const score = getStarValue(form, `leader_${c.key}`);
    if (!score) {
      form.querySelector(`.stars-leader_${c.key}`).classList.add('error');
      valid = false;
    } else {
      form.querySelector(`.stars-leader_${c.key}`).classList.remove('error');
    }
  });

  if (!valid) showToast('Avalie todas as estrelas!', 'error');
  return valid;
}

function setError(sel) { $(sel).closest('.form-group').classList.add('error'); }
function clearError(sel) { $(sel).closest('.form-group').classList.remove('error'); }

// ===== MEMBER SYSTEM =====
let memberCount = 0;
function initMemberSystem() {
  $('#btn-add-member').addEventListener('click', addMember);
  // Add first member automatically
  addMember();
}

function addMember() {
  memberCount++;
  const container = $('#members-container');
  const card = document.createElement('div');
  card.className = 'member-card';
  card.dataset.index = memberCount;

  let ratingsHTML = MEMBER_CRITERIA.map(c => `
    <div class="rating-group">
      <div class="rating-header">
        <span>${c.icon}</span>
        <h3>${c.label}</h3>
        <span class="rating-value stars-value-${c.key}" style="display:none">0/5</span>
      </div>
      <p class="rating-desc">${c.desc}</p>
      <div class="stars-container stars-${c.key}">
        <div class="stars" data-field="${c.key}">
          ${[1,2,3,4,5].map(n => `<span class="star" data-value="${n}">★</span>`).join('')}
        </div>
      </div>
      <div class="rating-obs form-group" style="margin-top:6px">
        <textarea class="obs-${c.key}" placeholder="Observação (opcional)" rows="2"></textarea>
      </div>
    </div>
  `).join('');

  card.innerHTML = `
    <div class="member-card-header">
      <div class="member-number">
        <div class="member-badge">${memberCount}</div>
        <span style="font-weight:600">Integrante ${memberCount}</span>
      </div>
      <button type="button" class="btn btn-danger btn-sm btn-remove-member" title="Remover">✕</button>
    </div>
    <div class="form-group">
      <label>Nome do Aluno</label>
      <input type="text" class="member-name-input" placeholder="Digite o nome do colega" autocomplete="off">
      <span class="error-msg">Digite o nome do aluno.</span>
    </div>
    ${ratingsHTML}
  `;

  container.appendChild(card);
  initStars(card);

  // Remove button
  card.querySelector('.btn-remove-member').addEventListener('click', () => {
    if ($$('.member-card').length <= 1) {
      showToast('É preciso ter pelo menos um integrante!', 'error');
      return;
    }
    card.style.opacity = '0';
    card.style.transform = 'translateX(-20px)';
    setTimeout(() => {
      card.remove();
      renumberMembers();
    }, 300);
  });

  // Scroll to new member
  setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
}

function renumberMembers() {
  $$('.member-card').forEach((card, i) => {
    card.querySelector('.member-badge').textContent = i + 1;
    card.querySelector('.member-number span').textContent = `Integrante ${i + 1}`;
  });
  memberCount = $$('.member-card').length;
}

// ===== STAR RATING =====
function initStars(container) {
  container.querySelectorAll('.stars').forEach(starsEl => {
    const stars = starsEl.querySelectorAll('.star');

    stars.forEach(star => {
      star.addEventListener('mouseenter', () => {
        const val = parseInt(star.dataset.value);
        stars.forEach(s => s.classList.toggle('hovered', parseInt(s.dataset.value) <= val));
      });

      star.addEventListener('mouseleave', () => {
        stars.forEach(s => s.classList.remove('hovered'));
      });

      star.addEventListener('click', () => {
        const val = parseInt(star.dataset.value);
        stars.forEach(s => s.classList.toggle('selected', parseInt(s.dataset.value) <= val));
        starsEl.dataset.selected = val;
        starsEl.closest('.stars-container').classList.remove('error');
        // Update value badge
        const field = starsEl.dataset.field;
        const badge = container.querySelector(`.stars-value-${field}`);
        if (badge) { badge.textContent = `${val}/5`; badge.style.display = 'inline-flex'; }
      });
    });
  });
}

function getStarValue(container, field) {
  const starsEl = container.querySelector(`.stars[data-field="${field}"]`);
  return starsEl ? parseInt(starsEl.dataset.selected) || 0 : 0;
}

// ===== LEADER FORM =====
function initLeaderForm() {
  const form = $('#leader-eval-form');
  let html = LEADER_CRITERIA.map(c => `
    <div class="rating-group">
      <div class="rating-header">
        <span>${c.icon}</span>
        <h3>${c.label}</h3>
        <span class="rating-value stars-value-leader_${c.key}" style="display:none">0/5</span>
      </div>
      <p class="rating-desc">${c.desc}</p>
      <div class="stars-container stars-leader_${c.key}">
        <div class="stars" data-field="leader_${c.key}">
          ${[1,2,3,4,5].map(n => `<span class="star" data-value="${n}">★</span>`).join('')}
        </div>
      </div>
      <div class="rating-obs form-group" style="margin-top:6px">
        <textarea class="obs-leader_${c.key}" placeholder="Observação (opcional)" rows="2"></textarea>
      </div>
    </div>
  `).join('');
  form.innerHTML = html;
  initStars(form);
}

// ===== API CALLS =====
async function submitMemberEvals() {
  showLoading(true);
  try {
    // 1. Create evaluation session
    const evalRes = await fetch('/api/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leader_name: state.leaderName,
        unit: state.unit,
        grade: state.grade,
        class: state.class,
        group_number: parseInt(state.group),
      }),
    });
    const evalData = await evalRes.json();
    if (!evalRes.ok) throw new Error(evalData.error);
    state.evaluationId = evalData.id;

    // 2. Submit member evaluations
    const members = state.members.map(m => ({
      member_name: m.name,
      responsabilidade: m.ratings.responsabilidade.score,
      responsabilidade_obs: m.ratings.responsabilidade.obs,
      relacionamento: m.ratings.relacionamento.score,
      relacionamento_obs: m.ratings.relacionamento.obs,
      cooperacao: m.ratings.cooperacao.score,
      cooperacao_obs: m.ratings.cooperacao.obs,
      organizacao: m.ratings.organizacao.score,
      organizacao_obs: m.ratings.organizacao.obs,
      educacao: m.ratings.educacao.score,
      educacao_obs: m.ratings.educacao.obs,
    }));

    const memRes = await fetch(`/api/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluation_id: state.evaluationId, members }),
    });
    if (!memRes.ok) throw new Error((await memRes.json()).error);

    showToast('Avaliações dos integrantes salvas!', 'success');
    goToStep(3);
  } catch (e) {
    showToast('Erro ao salvar: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function submitLeaderEval() {
  showLoading(true);
  const form = $('#leader-eval-form');
  try {
    const data = {};
    LEADER_CRITERIA.forEach(c => {
      data[c.key] = getStarValue(form, `leader_${c.key}`);
      data[c.key + '_obs'] = form.querySelector(`.obs-leader_${c.key}`).value.trim();
    });

    const res = await fetch(`/api/leader`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluation_id: state.evaluationId, ...data }),
    });
    if (!res.ok) throw new Error((await res.json()).error);

    showToast('Avaliação do líder salva com sucesso!', 'success');
    goToStep(5);
  } catch (e) {
    showToast('Erro ao salvar: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ===== HELPERS =====
function showToast(msg, type = '') {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function showLoading(show) {
  $('#loading').classList.toggle('hidden', !show);
}
