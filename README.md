# Рятівники країн проти Зомбі-Боса

**Рятівники країн проти Зомбі-Боса** — це дитяча браузерна гра українською мовою. Гравець звільняє 5 країн від веселих зомбі, відкриває нових бійців через Мегабокси, прокачує команду до 10 рівня і в кінці бʼється із Зомбі-Босом Буль-Булем.

Гра зроблена як легка HTML/CSS/JavaScript пригода без важкого хорору, крові чи страшних сцен. Візуальний стиль — яскравий, мультяшний, дружній для дитини.

## Головна ідея

Щоб дійти до фінального боса, потрібно врятувати всі 5 країн:

1. Україна
2. Польща
3. Японія
4. Бразилія
5. Єгипет

У кожній країні є **25 рівнів**. На **10 рівні** гравець отримує **Мегабокс**. Із Мегабокса з шансом **56%** можна вибити нового бійця. Якщо довго не щастить, працює pity-механіка — гра не блокує шлях до фіналу.

## Бійці

У грі є 5 бійців:

| Боєць | Роль | Ідея персонажа |
| --- | --- | --- |
| Артем Блискавка | швидкий герой | стартовий герой команди |
| Софія Щит | захисниця команди | витривала бійчиня зі щитом |
| Макс Ракета | сильний атакер | винахідник із ракетним рюкзаком |
| Ліна Іскра | розумна тактикиня | магічна помічниця команди |
| Данило Лев | потужний фінішер | герой у левʼячому капюшоні |

Кожного бійця можна прокачати до **10 рівня**. З кожним рівнем ростуть:

- HP
- урон

Прокачка коштує монети. За перший переможений рівень гравець отримує **50 монет**.

## Спрайти та анімації

У грі використані справжні згенеровані спрайти, а не emoji-only персонажі.

Для кожної сутності є повний набір файлів:

```text
assets/sprites/<group>/<id>/base.png
assets/sprites/<group>/<id>/source/idle-strip.png
assets/sprites/<group>/<id>/source/attack-strip.png
assets/sprites/<group>/<id>/source/hurt-strip.png
assets/sprites/<group>/<id>/source/victory-strip.png
assets/sprites/<group>/<id>/spritesheet.webp
assets/sprites/<group>/<id>/manifest.json
assets/sprites/<group>/<id>/qa/contact-sheet.png
assets/sprites/<group>/<id>/qa/previews/*.gif
```

Анімаційні стани:

| State | Кадри | Для чого |
| --- | ---: | --- |
| `idle` | 4 | спокійна анімація очікування |
| `attack` | 6 | удар героя або атака ворога |
| `hurt` | 4 | реакція на удар |
| `victory` | 4 | перемога / святкування |

Усього зараз є:

- 7 spritesheet atlas-файлів
- 7 manifest-файлів
- 7 contact sheets для QA
- 28 GIF previews

## Як запустити гру

Потрібен будь-який сучасний браузер і Python 3 для локального сервера.

```bash
npm run serve
```

Після запуску відкрити:

```text
http://127.0.0.1:4173/
```

Для QA-режиму з тестовими кнопками:

```text
http://127.0.0.1:4173/?qa=1
```

## Команди розробника

```bash
npm test
npm run sprites:validate
npm run smoke
npm run verify
```

`npm run verify` перевіряє:

- синтаксис JavaScript
- Python helper scripts
- всі automated tests
- наявність і контракт sprite assets
- smoke-check UI shell і sprite renderer

## Структура проєкту

```text
assets/
  concept/              # ImageGen concept/art bible
  sprites/              # готові ігрові sprite assets

docs/
  art/                  # промпти, аналіз і pipeline для графіки
  qa/                   # QA checklist

scripts/
  sprite_pipeline.py    # збирає atlas, manifest, contact sheet, GIF previews
  sprite_split_sheet.py # ріже generated 4-row sheet на state strips
  sprite_extract_strip.py # repair helper для одного animation row
  smoke-check.mjs       # smoke-перевірка UI

src/
  gameData.js           # країни, бійці, бос, базові константи
  gameLogic.js          # бойова логіка, Мегабокси, прокачка
  campaign.js           # прогрес кампанії та підказки
  saveSystem.js         # localStorage save/load/reset
  spriteCatalog.js      # atlas contract і список sprite assets
  main.js               # render, події, QA controls
  styles.css            # UI і CSS sprite animation

test/
  *.test.js             # automated tests
```

## GitHub опис

Рекомендована назва репозиторію:

```text
zombie-liberation-game
```

Опис українською:

```text
Дитяча браузерна гра українською: 5 країн, 5 бійців, Мегабокси, прокачка до 10 рівня і фінальна битва із Зомбі-Босом Буль-Булем.
```

## Статус

Поточна версія містить повний playable prototype:

- 5 країн по 25 рівнів
- 5 бійців
- Мегабокс на 10 рівні
- 56% шанс відкриття бійця
- прокачка до 10 рівня
- фінальний бос після звільнення всіх країн
- generated spritesheets і CSS animation states
- autosave у браузері через `localStorage`
- QA mode для швидкої перевірки повного сценарію
