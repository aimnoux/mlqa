import './style.css';
import { questions } from './data/questions';
import type { Filter, Topic } from './types';

// ── Label maps ────────────────────────────────────────────

const TOPIC_LABEL: Record<Topic, string> = {
  llm: 'LLM',
  ai_engineering: 'AI-engineering',
  deep_learning: 'Deep Learning',
  nlp: 'NLP',
  classic_ml: 'Classic ML',
  statistics: 'Статистика',
  math: 'Математика',
  system_design: 'ML System Design',
  mlops: 'MLOps и инфра',
  python: 'Python',
  sql: 'SQL',
  algorithms: 'Алгоритмы',
  experience: 'Опыт',
  behavioral: 'Поведенческие',
};

const TOPICS: Array<Filter<Topic>> = [
  'all', 'llm', 'ai_engineering', 'deep_learning', 'nlp', 'classic_ml', 'statistics', 'math',
  'system_design', 'mlops', 'python', 'sql', 'algorithms', 'experience', 'behavioral',
];

// Частые вопросы — наверх; внутри одной частоты порядок из данных (по темам).
const sorted = [...questions].sort((a, b) => b.asked - a.asked || Number(a.id) - Number(b.id));

// ── SVG icons ─────────────────────────────────────────────

const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><path d="M9.5 9a2.5 2.5 0 0 1 4.86.83c0 1.67-2.5 2.5-2.5 2.5"/><path d="M11.9 15.5h.01"/></svg>`;
const ICON_SUN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
const ICON_MOON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const ICON_ARROW_UPRIGHT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M7 7h10v10"/></svg>`;
const ICON_SEND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`;
const ICON_LIST = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
const ICON_MSG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const ICON_LAYERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;

// ── Author ────────────────────────────────────────────────

const AUTHOR = {
  name: 'Максим Огородник',
  handle: '@maxouniai',
  href: 'https://t.me/maxouniai',
};

// ── Escape HTML ───────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── State ─────────────────────────────────────────────────

interface AppState {
  topic: Filter<Topic>;
  q: string;
}

let state: AppState = { topic: 'all', q: '' };
let openQuestionId: string | null = null;

// ── Theme ─────────────────────────────────────────────────

function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.getElementById('theme-btn')!.innerHTML = next === 'dark'
    ? `${ICON_SUN} Светлая`
    : `${ICON_MOON} Тёмная`;
}

// ── Plurals ───────────────────────────────────────────────

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// «1 уточнение», «2 уточнения», «5 уточнений»
function pluralFollowUps(n: number) {
  return `${n} ${plural(n, 'уточнение', 'уточнения', 'уточнений')}`;
}

// «спрашивали 2 раза», «спрашивали 5 раз»
function askedLabel(n: number) {
  return `спрашивали ${n} ${plural(n, 'раз', 'раза', 'раз')}`;
}

// ── Badge helpers ─────────────────────────────────────────

function topicBadge(topic: Topic) {
  return `<span class="badge badge-${topic}">${TOPIC_LABEL[topic]}</span>`;
}

function askedBadge(n: number) {
  return n > 1 ? `<span class="badge badge-asked">${askedLabel(n)}</span>` : '';
}

// ── Filter pill ───────────────────────────────────────────

function filterPill(label: string, value: string, count: number, active: boolean) {
  return `<button class="filter-pill${active ? ' active' : ''}" data-value="${value}">
    ${esc(label)}<span class="filter-count">${count}</span>
  </button>`;
}

// ── Render list ───────────────────────────────────────────

function renderList() {
  const topicCounts: Record<string, number> = {};
  questions.forEach((q) => {
    topicCounts[q.topic] = (topicCounts[q.topic] ?? 0) + 1;
  });

  const filtered = sorted.filter((q) => {
    if (state.topic !== 'all' && q.topic !== state.topic) return false;
    if (state.q) {
      const needle = state.q.toLowerCase();
      return q.question.toLowerCase().includes(needle)
        || q.followUps.some((f) => f.toLowerCase().includes(needle));
    }
    return true;
  });

  const topicPills = TOPICS
    .filter((t) => t === 'all' || (topicCounts[t] ?? 0) > 0)
    .map((t) => filterPill(
      t === 'all' ? 'Все' : TOPIC_LABEL[t],
      t, t === 'all' ? questions.length : (topicCounts[t] ?? 0),
      state.topic === t,
    )).join('');

  const cards = filtered.length
    ? filtered.map((q, i) => `
        <button
          class="case-card fade-in-up"
          data-question-id="${q.id}"
          style="animation-delay: ${Math.min(i, 20) * 0.03}s"
        >
          <div class="card-top">
            <div class="card-badges">
              ${topicBadge(q.topic)}
              ${askedBadge(q.asked)}
            </div>
            <span class="card-arrow">${ICON_ARROW_UPRIGHT}</span>
          </div>
          <h3 class="card-title">${esc(q.question)}</h3>
          ${q.followUps.length
            ? `<div class="card-footer">
                 <span class="card-q-count">${ICON_MSG} ${pluralFollowUps(q.followUps.length)}</span>
               </div>`
            : ''}
        </button>`
    ).join('')
    : `<div class="empty-state">Ничего не найдено</div>`;

  document.getElementById('question-list')!.innerHTML = cards;
  document.getElementById('stats-bar')!.textContent =
    `Показано ${filtered.length} из ${questions.length}`;
  document.getElementById('topic-pills')!.innerHTML = topicPills;

  bindCardEvents();
  bindFilterEvents();
}

// ── Modal ─────────────────────────────────────────────────

function openModal(id: string, pushUrl = true) {
  const q = questions.find((x) => x.id === id);
  if (!q) return;
  openQuestionId = id;

  const followUps = q.followUps.map((f, i) => `
    <li class="question-item">
      <span class="question-num">${i + 1}</span>
      <span>${esc(f)}</span>
    </li>`).join('');

  document.getElementById('modal-badges')!.innerHTML = `${topicBadge(q.topic)} ${askedBadge(q.asked)}`;
  document.getElementById('modal-title')!.textContent = q.question;
  document.getElementById('modal-questions')!.innerHTML = followUps;
  document.getElementById('modal-q-label')!.textContent =
    `Уточняющие вопросы (${q.followUps.length})`;

  // Вопросы без уточнений показываем без пустой секции
  document.getElementById('modal-body')!.hidden = q.followUps.length === 0;

  if (pushUrl) {
    const params = new URLSearchParams(location.search);
    params.set('id', id);
    history.pushState({ id }, '', `${location.pathname}?${params}`);
  }
  document.title = `${q.question} — ML Interview Questions`;

  document.getElementById('modal-overlay')!.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(pushUrl = true) {
  openQuestionId = null;
  if (pushUrl) {
    const params = new URLSearchParams(location.search);
    params.delete('id');
    const search = params.toString() ? `?${params}` : location.pathname;
    history.pushState({}, '', search);
  }
  document.title = 'ML Interview Questions';
  document.getElementById('modal-overlay')!.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Bind events ───────────────────────────────────────────

function bindCardEvents() {
  document.querySelectorAll<HTMLElement>('.case-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.questionId;
      if (id) openModal(id);
    });
  });
}

function bindFilterEvents() {
  document.querySelectorAll<HTMLElement>('.filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      state.topic = (pill.dataset.value ?? 'all') as Filter<Topic>;
      renderList();
    });
  });
}

// ── Bootstrap ─────────────────────────────────────────────

function init() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="page-wrap">
      <main class="main">
        <div class="container">

          <div class="theme-wrap">
            <button class="theme-btn" id="theme-btn" aria-label="Переключить тему">
              ${isDark() ? `${ICON_SUN} Светлая` : `${ICON_MOON} Тёмная`}
            </button>
          </div>

          <div class="hero fade-in-up">
            <div class="hero-icon-wrap">${ICON_CHAT}</div>
            <h1 class="hero-title">
              <span class="hero-title-line1">ML Interview</span>
              <span class="hero-title-line2">Questions</span>
            </h1>
            <p class="hero-subtitle">
              Вопросы с реальных технических собеседований на позиции Data Scientist, NLP и LLM-инженер
            </p>
            <div class="authors">
              <span class="authors-title">Автор сборника</span>
              <div class="authors-list">
                <div class="author-card author-card-lead">
                  <span class="author-name">${esc(AUTHOR.name)}</span>
                  <div class="author-links">
                    <a class="author-btn author-btn-telegram" href="${AUTHOR.href}" target="_blank" rel="noopener noreferrer"
                    >${ICON_SEND}<span class="author-btn-label">Telegram</span><span
                      class="author-btn-handle">${esc(AUTHOR.handle)}</span></a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="search-wrap">
            <input
              id="search-input"
              class="search-input"
              type="search"
              placeholder="Поиск по вопросам..."
              autocomplete="off"
              spellcheck="false"
            />
          </div>

          <div class="filters">
            <div class="filter-row">
              <span class="filter-label">Тема:</span>
              <div id="topic-pills" style="display:contents"></div>
            </div>
          </div>

          <p class="stats-bar" id="stats-bar"></p>

          <div class="case-grid" id="question-list"></div>

        </div>
      </main>

      <footer class="site-footer">
        <div class="container">
          <p class="footer-desc">Вопросы с реальных технических собеседований по ML, NLP и LLM</p>
          <div class="footer-contacts">
            <a class="footer-link" href="https://t.me/maxouniai" target="_blank" rel="noopener">
              ${ICON_SEND}<span>Telegram-канал</span>
            </a>
            <a class="footer-link" href="https://aimnoux.github.io/mlsd/" target="_blank" rel="noopener">
              ${ICON_LAYERS}<span>Кейсы по ML System Design</span>
            </a>
            <a class="footer-link" href="https://t.me/dgiknooor" target="_blank" rel="noopener">
              ${ICON_SEND}<span>Написать</span>
            </a>
          </div>
        </div>
      </footer>
    </div>

    <!-- Modal -->
    <div id="modal-overlay" class="modal-overlay" role="dialog" aria-modal="true">
      <div class="modal" id="modal">
        <div class="modal-header">
          <div class="modal-header-top">
            <div class="modal-badges" id="modal-badges"></div>
            <button class="modal-close" id="modal-close" aria-label="Закрыть">✕</button>
          </div>
          <h2 class="modal-title" id="modal-title"></h2>
        </div>
        <div class="modal-body" id="modal-body">
          <div>
            <div class="modal-section-head">
              ${ICON_LIST}
              <span id="modal-q-label">Уточняющие вопросы</span>
            </div>
            <ul class="questions-list" id="modal-questions"></ul>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('theme-btn')!.addEventListener('click', toggleTheme);

  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  let debounce: ReturnType<typeof setTimeout>;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.q = searchInput.value;
      renderList();
    }, 180);
  });

  document.getElementById('modal-close')!.addEventListener('click', () => closeModal());
  document.getElementById('modal-overlay')!.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openQuestionId) closeModal();
  });

  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(location.search).get('id');
    if (id) openModal(id, false);
    else closeModal(false);
  });

  renderList();

  const initialId = new URLSearchParams(location.search).get('id');
  if (initialId) openModal(initialId, false);
}

init();
