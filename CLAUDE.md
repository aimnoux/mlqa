# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Команды

```bash
npm install
npm run dev      # Vite dev-сервер
npm run build    # tsc (type-check) + vite build → dist/
npm run preview  # локальный просмотр собранного dist/
```

Тестов и линтера нет. Единственная проверка — `tsc` в составе `npm run build`; она обязательна перед пушем, потому что CI выполняет ту же команду. `tsconfig.json` включает `strict`, `noUnusedLocals`, `noUnusedParameters`.

## Архитектура

Статический сайт-банк вопросов с собеседований. Vite + TypeScript без фреймворков и рантайм-зависимостей. Дизайн — спокойная тёплая палитра («бумажный» фон, графитовый текст, один приглушённый шалфейный акцент), шрифты Onest и JetBrains Mono из Google Fonts; светлая и тёмная тема через `data-theme` на `<html>`, начальное значение ставит инлайн-скрипт в `index.html`).

- [src/data/questions.ts](src/data/questions.ts) — весь контент: `questions: Question[]` и `interviewsCount` (из скольких собесов собран банк — обновлять вручную).
- [src/types.ts](src/types.ts) — `Question`, объединение `Topic`, `Filter<T>`.
- [src/main.ts](src/main.ts) — всё приложение: слева список тем со счётчиками (на мобильных — горизонтальная лента), справа плотный список вопросов по убыванию `asked`, уточнения раскрываются в строке, поиск (`/` — фокус), permalink `?id=`.
- [src/style.css](src/style.css) — стили, палитра только из CSS-переменных `:root` / `[data-theme='dark']`.

Состояние — `state` (тема, поиск) и `openIds` (раскрытые вопросы). События навешены делегированием на `#topics` и `#list`, поэтому перерисовка контейнеров не требует повторного bind. Строка вопроса — `div role="button"`, а не `<button>`: внутри неё ссылка-permalink. Всё пользовательское в `innerHTML` проходит через `esc()`.

Новое значение `Topic`: объединение в `types.ts` и подпись в `TOPIC_LABEL` в `main.ts`. Темы в сайдбаре сортируются по числу вопросов автоматически, пустые скрываются.

## Пайплайн из записей собесов

1. Записи кладутся в `inbox/` (содержимое в .gitignore — записи, транскрипты и разборы приватные и **никогда не коммитятся**).
2. `python3 scripts/transcribe.py --new-only -j 8` — Deepgram (nova-3, ru, diarize), результат в `inbox/transcripts/<имя>/`. Нужен `DEEPGRAM_API_KEY`. Автоугадывание «кто кандидат» ненадёжно — проверять по содержанию и фиксировать `--me N`.
3. Из `interviewer.md` (с `transcript.md` как контекстом) извлекаются вопросы в `inbox/questions/<имя>.json`.
4. В `src/data/questions.ts` добавляются только универсальные вопросы: анонимизированные, без компаний, имён и деталей проектов кандидата. Дубли с уже существующими не добавляются новым объектом — у существующего увеличивается `asked` и дописываются новые уточнения. `id` существующих вопросов не менять (на них ведут permalink), новые получают следующий номер. Статистика в README обновляется вручную.

## Деплой

Push в `main` → [.github/workflows/deploy.yml](.github/workflows/deploy.yml) → GitHub Pages. Сайт: https://aimnoux.github.io/mlqa/, поэтому в [vite.config.ts](vite.config.ts) `base: '/mlqa/'`.

## Язык

Интерфейс и контент — на русском. Код и идентификаторы — на английском.
