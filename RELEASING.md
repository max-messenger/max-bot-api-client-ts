# Релизный процесс @maxhub/max-bot-api

Этот документ описывает, как собирать changelog и выпускать новые версии пакета `@maxhub/max-bot-api`.

## Предварительные требования

1. **npm-аккаунт** с правами на публикацию пакета `@maxhub/max-bot-api`.
   Проверить авторизацию:
   ```sh
   npm whoami
   ```
   Если не авторизованы:
   ```sh
   npm login
   ```

2. **GitHub-токен** с правами `repo` для создания GitHub Release.
   Создать токен: https://github.com/settings/tokens

   Выбираем Personal access tokens (classic), прожимаем все галочки в repo (repo:status и тд). Expiration лучше выставить на 1, 2 или 3 месяца.

   Затем добавить в окружение:
   ```sh
   export GITHUB_TOKEN=ghp_ваш_токен
   ```
   (добавьте в `~/.zshrc` для постоянного использования)

3. **Рабочая ветка**: релиз выполняется только из ветки `main` с чистым git-статусом и синхронизированным upstream.

## Используемые инструменты

- [release-it](https://github.com/release-it/release-it) — оркестратор релиза
- [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog) — генерация `CHANGELOG.md` на основе коммитов
- Конфигурация: `.release-it.json`

## Что делает команда релиза

При запуске `npm run release` автоматически:

1. **Проверяет lint** (`npm run lint`) — релиз не начнётся при ошибках
2. **Определяет новую версию** на основе коммитов с прошлого тега:
   - `feat:` / `feature:` → minor (`0.2.0` → `0.3.0`)
   - `fix:` → patch (`0.2.0` → `0.2.1`)
   - `BREAKING CHANGE:` в теле коммита → major (`0.2.0` → `1.0.0`)
3. **Генерирует `CHANGELOG.md`** — группирует изменения по категориям
4. **Обновляет `version`** в `package.json` и `package-lock.json`
5. **Собирает пакет** (`npm run build`) → `dist/`
6. **Создаёт git-коммит** `chore(release): vX.Y.Z`
7. **Создаёт git-тег** `vX.Y.Z`
8. **Публикует в npm** (`npm publish`)
9. **Создаёт GitHub Release** с автогенерированными заметками
10. **Push коммита и тега** в `origin/main`

## Команды

### Проверка (dry-run) — без реальных изменений

```sh
npm run release:dry
```

Покажет планируемую версию и превью changelog, ничего не меняя в репозитории/реестре. **Всегда запускайте сначала dry-run.**

### Полный релиз (интерактивный)

```sh
npm run release
```

На каждом шаге запрашивает подтверждение (Y/n). Можно прервать на любом этапе.

### Неинтерактивный релиз (для CI/скриптов)

```sh
npx release-it --ci
```

Запускает весь процесс без вопросов — удобно в CI.

### Релиз конкретной версии (override)

```sh
npx release-it 0.3.5
```

### Только patch/minor/major/pre-release

```sh
npx release-it patch      # 0.2.0 → 0.2.1
npx release-it minor      # 0.2.0 → 0.3.0
npx release-it major      # 0.2.0 → 1.0.0
npx release-it prepatch   # 0.2.0 → 0.2.1-0
npx release-it preminor   # 0.2.0 → 0.3.0-0
npx release-it premajor   # 0.2.0 → 1.0.0-0
```

## Требования к коммитам

Changelog строится по [Conventional Commits](https://conventionalcommits.org). Рекомендуемый формат:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Поддерживаемые типы

| Тип | Раздел в CHANGELOG | Влияние на версию |
|---|---|---|
| `feat` / `feature` | ✨ Новые возможности | minor |
| `fix` | 🐛 Исправления | patch |
| `perf` | ⚡️ Производительность | patch |
| `refactor` | ♻️ Рефакторинг | patch |
| `revert` | ⏪️ Откаты изменений | patch |
| `docs` | 📚 Документация | — |
| `style` | 💎 Стили | — |
| `chore` | 🛠 Прочее | — |
| `build` | 📦 Сборка | — |
| `ci` | 👷 CI | — |

> ⚠️ Коммиты без recognized типа попадут в раздел «Прочее» и не повлияют на версию.

### Breaking change

Для мажорного бампа добавьте в тело коммита футер:
```
BREAKING CHANGE: описание того, что сломалось
```
или используйте `!` после типа/скоупа:
```
feat(api)!: переименованы пропсы Button
```

### Примеры

```
feat(Button): добавлен проп size="lg"
fix(Input): исправлен фокус при автофилле
docs: обновлён README
chore(deps): обновлены зависимости
```

## Первичная инициализация CHANGELOG

Если `CHANGELOG.md` ещё не существует, первый запуск `npm run release` создаст его с историей коммитов от предыдущего тега. Поскольку git-тегов ранее не было, первый релиз соберёт всю доступную историю — это нормально.

Чтобы создать тег для текущей версии `0.1.14` без релиза (чтобы будущие changelog начинались отсюда):

```sh
git tag -a v0.1.14 -m "Release 0.1.14"
git push origin v0.1.14
```

После этого следующий `npm run release` будет собирать changelog только от `v0.1.14`.

## Откат релиза

Если публикация прошла с ошибкой:

```sh
# Удалить git-тег
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z

# Откатить коммит релиза
git reset --hard HEAD~1
git push --force-with-lease origin main

# Снять версию с npm (только в течение 72 часов, deprecated)
npm deprecate @maxhub/max-bot-api@X.Y.Z "отозвано — используйте X.Y.W"
```

> Полностью удалить версию из npm невозможно после 72 часов — только deprecate.

## Структура конфигурации

| Файл | Назначение |
|---|---|
| `.release-it.json` | Основной конфиг release-it |
| `package.json` → `scripts.release` | Запуск release-it |
| `package.json` → `scripts.release:dry` | Dry-run |
| `package.json` → `files: ["./dist"]` | Что публикуется в npm |
| `CHANGELOG.md` | Генерируется автоматически |

## Проверочный чек-лист перед релизом

- [ ] Авторизован в npm (`npm whoami`)
- [ ] Установлен `GITHUB_TOKEN`
- [ ] Ветка `main`, нет незакоммиченных изменений (`git status`)
- [ ] Локальный main синхронизирован с origin (`git pull`)
- [ ] `npm run release:dry` показывает корректную версию и changelog
- [ ] `npm run build` проходит без ошибок
