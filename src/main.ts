import './style.css';
import { interviewsCount, questions } from './data/questions';
import type { Filter, Question, Topic } from './types';

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

// Частые — наверх; при равной частоте порядок из данных.
const sorted = [...questions].sort((a, b) => b.asked - a.asked || Number(a.id) - Number(b.id));

const ICON_SUN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
const ICON_MOON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const ICON_CHEVRON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`;

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// ── State ─────────────────────────────────────────────────

const state: { topic: Filter<Topic>; q: string } = { topic: 'all', q: '' };
const openIds = new Set<string>();

// ── Theme ─────────────────────────────────────────────────

function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

function renderThemeBtn() {
  const btn = document.getElementById('theme-btn')!;
  btn.innerHTML = isDark() ? ICON_SUN : ICON_MOON;
  btn.setAttribute('aria-label', isDark() ? 'Светлая тема' : 'Тёмная тема');
}

function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  renderThemeBtn();
}

// ── Render ────────────────────────────────────────────────

function matches(q: Question) {
  if (state.topic !== 'all' && q.topic !== state.topic) return false;
  if (!state.q) return true;
  const needle = state.q.toLowerCase();
  return q.question.toLowerCase().includes(needle) || q.followUps.some((f) => f.toLowerCase().includes(needle));
}

function renderTopics() {
  const counts: Partial<Record<Topic, number>> = {};
  questions.forEach((q) => { counts[q.topic] = (counts[q.topic] ?? 0) + 1; });

  // Темы — по убыванию числа вопросов, пустые не показываем
  const topics = (Object.keys(counts) as Topic[]).sort((a, b) => counts[b]! - counts[a]!);
  const item = (value: string, label: string, n: number) => `
    <button class="topic${state.topic === value ? ' active' : ''}" data-topic="${value}">
      <span>${esc(label)}</span><span class="topic-count">${n}</span>
    </button>`;

  document.getElementById('topics')!.innerHTML =
    `<span class="topics-label">Темы</span>`
    + item('all', 'Все темы', questions.length)
    + topics.map((t) => item(t, TOPIC_LABEL[t], counts[t]!)).join('');
}

function questionHtml(q: Question) {
  const open = openIds.has(q.id);
  const n = q.followUps.length;
  const count = `<span class="q-count${q.asked > 1 ? ' hot' : ''}" title="Встречался на ${q.asked} ${plural(q.asked, 'собеседовании', 'собеседованиях', 'собеседованиях')}">${q.asked}×</span>`;
  const meta = `
    <span class="q-meta">
      <span>${TOPIC_LABEL[q.topic]}</span>
      ${n ? `<span class="q-toggle">${ICON_CHEVRON}${n} ${plural(n, 'уточнение', 'уточнения', 'уточнений')}</span>` : ''}
      <a class="q-link" href="?id=${q.id}" data-link="${q.id}">#${q.id}</a>
    </span>`;
  const body = `<span class="q-body"><span class="q-text">${esc(q.question)}</span>${meta}</span>`;

  // Вопрос без уточнений раскрывать нечего — это просто строка
  const row = n
    ? `<div class="q-row" role="button" tabindex="0" data-toggle="${q.id}" aria-expanded="${open}">${count}${body}</div>`
    : `<div class="q-row">${count}${body}</div>`;
  const followUps = n
    ? `<ol class="q-followups"${open ? '' : ' hidden'}>${q.followUps.map((f) => `<li>${esc(f)}</li>`).join('')}</ol>`
    : '';

  return `<article class="q${open ? ' open' : ''}" id="q-${q.id}">${row}${followUps}</article>`;
}

function renderList() {
  const filtered = sorted.filter(matches);
  document.getElementById('list')!.innerHTML = filtered.length
    ? filtered.map(questionHtml).join('')
    : `<p class="empty">Ничего не найдено</p>`;
}

function render() {
  renderTopics();
  renderList();
}

// ── Actions ───────────────────────────────────────────────

function toggleQuestion(id: string) {
  if (openIds.has(id)) openIds.delete(id);
  else openIds.add(id);
  const q = questions.find((x) => x.id === id);
  const el = document.getElementById(`q-${id}`);
  if (q && el) el.outerHTML = questionHtml(q);
}

async function copyLink(id: string, el: HTMLElement) {
  const url = `${location.origin}${location.pathname}?id=${id}`;
  history.replaceState(null, '', `?id=${id}`);
  try {
    await navigator.clipboard.writeText(url);
    el.textContent = 'ссылка скопирована';
    setTimeout(() => { el.textContent = `#${id}`; }, 1200);
  } catch {
    // Буфер обмена недоступен — ссылка всё равно уже в адресной строке
  }
}

function openFromUrl() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id || !questions.some((q) => q.id === id)) return;
  // Иначе при перезагрузке браузер вернёт старую прокрутку поверх нашей
  history.scrollRestoration = 'manual';
  openIds.add(id);
  render();
  const el = document.getElementById(`q-${id}`);
  el?.scrollIntoView({ block: 'center' });
  el?.classList.add('flash');
}

// ── Bootstrap ─────────────────────────────────────────────

function init() {
  document.getElementById('app')!.innerHTML = `
    <header class="header">
      <div class="wrap">
        <div class="header-top">
          <div>
            <h1 class="title">ML Interview Questions</h1>
            <p class="subtitle">
              ${questions.length} ${plural(questions.length, 'вопрос', 'вопроса', 'вопросов')} с ${interviewsCount} реальных собеседований на Data Scientist, NLP и LLM-инженера.
              Собирает <a href="https://t.me/maxouniai" target="_blank" rel="noopener">@maxouniai</a>
            </p>
          </div>
          <button class="theme-btn" id="theme-btn"></button>
        </div>
        <div class="search">
          <input id="search" type="search" placeholder="Поиск по вопросам и уточнениям" autocomplete="off" spellcheck="false" />
          <kbd>/</kbd>
        </div>
      </div>
    </header>

    <div class="wrap layout">
      <nav class="topics" id="topics" aria-label="Темы"></nav>
      <main>
        <div class="list-head">
          <span class="list-head-count">Раз</span>
          <span class="list-head-q">Вопрос</span>
        </div>
        <div id="list"></div>
      </main>
    </div>

    <footer class="footer">
      <div class="wrap">
        Вопросы анонимизированы: без компаний, имён и деталей проектов.
        Telegram-канал — <a href="https://t.me/maxouniai" target="_blank" rel="noopener">maxouni.ai</a>
      </div>
    </footer>
  `;

  renderThemeBtn();
  document.getElementById('theme-btn')!.addEventListener('click', toggleTheme);

  document.getElementById('topics')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-topic]');
    if (!btn) return;
    state.topic = btn.dataset.topic as Filter<Topic>;
    render();
    window.scrollTo({ top: 0 });
  });

  document.getElementById('list')!.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest<HTMLElement>('[data-link]');
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      copyLink(link.dataset.link!, link);
      return;
    }
    const row = target.closest<HTMLElement>('[data-toggle]');
    if (row) toggleQuestion(row.dataset.toggle!);
  });

  // Строка вопроса — div с role="button" (внутри неё ссылка, а <a> в <button> невалиден)
  document.getElementById('list')!.addEventListener('keydown', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-toggle]');
    if (!row || e.target !== row || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    toggleQuestion(row.dataset.toggle!);
    document.querySelector<HTMLElement>(`[data-toggle="${row.dataset.toggle}"]`)?.focus();
  });

  const search = document.getElementById('search') as HTMLInputElement;
  let debounce: ReturnType<typeof setTimeout>;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.q = search.value.trim(); renderList(); }, 150);
  });

  // «/» — фокус в поиск, Esc — очистить
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== search) {
      e.preventDefault();
      search.focus();
    } else if (e.key === 'Escape' && document.activeElement === search) {
      search.value = '';
      state.q = '';
      renderList();
      search.blur();
    }
  });

  render();
  openFromUrl();
}

init();
