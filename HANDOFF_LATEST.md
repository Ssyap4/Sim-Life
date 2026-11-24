# Sim-Life — current release v0.33.0 (2026-11-24)
- Owner approved, PR #63 merged: 5660632cd8780ce7366d2c7b4f1c2b2262bfa7e4, tag v0.33.0 pushed. Tested head ea378b734b809d94ba64dc180476f82b115110fb. Full cloud QA SUCCESS https://github.com/Ssyap4/Sim-Life/actions/runs/45350305216 : 573/573 tests, furniture audit (282 actions), build, isolation, mobile visual regression. User checked wardrobe/shop and Android on physical phones; latest fitting camera geometry test passed, final screenshots not personally inspected.
- Production D:\Sim-Life, http://192.168.0.124:3111/ ; PID 4204 listening, health ok/testNoCodes=false, HTML/new bundle index-zd0hNhK9.js HTTP 200. Production reset explicitly approved: balance 10000, 2 free starter pet items, no purchased items, no sold static fixtures, no active shifts; access and trusted-devices files retained. Prior household backed up by reset script under server-data/release-backups. Never copy preview data into main.
- Preview D:\Sim-Life-033-Wardrobe, branch feat/wardrobe-033, port 3165, data D:\Sim-Life-033-WardrobeData, no codes, 100k. Latest rule: per deployed test update reset progress, retain placed objects; on approved production updates start fresh with default furniture, no bought items, normal balance, unchanged access/device credentials. Use explicit server/reset-release.ts once per deployment, NOT every restart. This overrides older preservation rules.
- 0.33: physical clothing shop, two starter wardrobes, 12 outfits per role including original, distinctive footwear, independent isolated fitting scene on existing renderer, checkout/owned outfits; no laundry. Android regular Chrome/Firefox AA and low-power context, high DPR, physical confirmation. Separate industrial scene with Ozon/WB, roof signs, walking/car travel, shifts via entrance or phone. Approved pay ladders/new jobs detailed in docs/RELEASE_033.md; barista/inventory retired. Office wardrobe moved to clear wing passage.
- Next priority: electronics store; discuss design with owner first. Review prices/economy as needed, preserve approved wages. Other agreed future shops: furniture, pet supplies, cosmetics; not auto/building materials. Veterinary clinic later: only illness after sustained severe food/attention neglect, NPC reception/phone booking/diagnosis/treatment, use Alina's existing veterinary career. Main two deep professions still deferred. Read AGENTS.md, docs/RELEASE_033.md, docs/ROADMAP.md, README and actual git/health first.
- ALINA-PC weak: no heavy local WebGL/Blender/full regressions; cloud heavy checks. iPhone 11 portrait primary. Main only after owner approves. Mobile visual changes inspect real frames, don't equate test logs with screenshots.

---

## Historical handoff (not current)

# Sim-Life — current release v0.32.0 (2026-11-24)

- Owner approved after real multiplayer badminton and table tennis. PR #62 merged: 24077ba347eee384aeef896ddc816f11f4f6efd3; tag v0.32.0. Tested head 173766afe2e83e397ba1dd79577ff6d734f3739f has identical release tree.
- Full cloud QA SUCCESS https://github.com/Ssyap4/Sim-Life/actions/runs/45335495337 : 569/569 tests, 75/75 furniture, 282 actions, TypeScript, build, isolation and mobile visual job. Actual 390x844 park/badminton/swing/picnic frames inspected. User approved live tennis. No physical iPhone FPS measured; close-up camera can be obstructed by foreground trees/benches.
- Main D:\Sim-Life, http://192.168.0.124:3111/ ; restarted production PID 7944, health ok, testNoCodes=false, HTML and index-DSYIEhp-.js HTTP 200. Real data D:\Sim-Life\server-data; backup D:\Sim-Life-Backups\v032-predeploy-20261124-084531, 8 files SHA256 verified before deployment. No preview state copied.
- Preview feat/leisure-032, D:\Sim-Life-032-Leisure, 3164, D:\Sim-Life-032-LeisureData. Test no codes, 100k on fresh saves. The table purchased in preview is not in main.
- 0.32 forest park, badminton 45s/16 hits, table tennis 60s/24 hits, fair 50/50 shared server result, dog play/toilet, picnic 90s with actual portions and conversations, campfire recipes/ingredients, marshmallows, seven leisure furniture SKUs, swing hinge alignment. See docs/RELEASE_032.md.
- New live testing method: lightweight authenticated WebSocket client for free role on preview only, with actual user consent. Real normal commands, not state cheats. User checks rendering; text logs are not visual inspection. Disconnect after activity. Match completed: Alina won.
- Next 0.33 approved: clothing and appearance, full outfit skins, physical store/fitting/cashier, no delivery, no laundry. First prototype outfits and verify poses; then aim for 20 sets per character. 0.31 skipped; no fishing. 0.34 calendar later. No new stage started.
- Weak ALINA-PC: no heavy local WebGL, Blender, or full regressions. Cloud for heavy jobs, physical iPhone 11 portrait primary; main only with user approval. Read AGENTS.md, docs/RELEASE_032.md.

---

## Historical handoff (not current)

# Sim-Life - current release: v0.30.0 (2026-11-24)

- User approved release after checks. PR #61 merged into main: bee28d04765e0084b2ed172ad48f62a815547f79; tag v0.30.0 pushed. Tested branch head 66d780e39997155d6f2d9ddd5d8e5a7b0b98c880 has identical tree.
- Full cloud regression SUCCESS: 557/557, zero failures/skips; furniture audit 68/68, 268 actions, production build and isolation passed: https://github.com/Ssyap4/Sim-Life/actions/runs/45322855275 .
- Earlier mobile visual job SUCCESS (138204060515), real cloud 390x844 frames inspected: cafe, dog/cat begging, pet menu. Final CSS hides overlapping camera controls and treat button moved first. Repeated final mobile job 138205265661 was still installing Chromium at deployment; do not claim it passed or that physical iPhone FPS was measured.
- Main production: D:\Sim-Life, port 3111, http://192.168.0.124:3111/ ; health ok, testNoCodes=false, LAN HTML and bundle index-CdyIPTba.js HTTP 200. Real save directory D:\Sim-Life\server-data; backup D:\Sim-Life-Backups\v030-predeploy-20261124-065659 (8 files SHA-256 verified). No preview data copied.
- Preview branch feat/cafe-table-service-030, D:\Sim-Life-030-Cafe, port 3163, D:\Sim-Life-030-Cafe-PreviewData. Keep isolated.
- Cafe: three tables, cashier, eight meals, seated talks, preparation progress, served plates, 32-second meals both home and cafe. Starter cat house and scratcher, six dog toys, autonomous toy use. Furniture placement independent of unrelated resident/pet activities, physical obstacles retained; 13 decor products removed from shop, existing items sellable.
- Needs: toilet +100, shower +80, ordinary bath +90, foam +100 hygiene and +35 comfort/+10 mood. Ordinary food +60-70, premium +100. Pets approach real eating owners, Verdell begs upright, Simba raises paw; each pet 3 free treats per game day shared by both owners, +30 satiety/+12 happiness/+8 bond. Treat at table does not interrupt meal.
- ALINA-PC weak: no heavy local WebGL automation, Blender or full regressions; use cloud. Physical iPhone 11 portrait primary. Main changes require user approval. Next stage not started.

---

## Historical handoff (older releases; not current)


# Sim-Life - current verified release: v0.29.0 (2026-11-24)

- User approved the release. PR #60 merged into main: 4a4db94366fb708dfcd6a564b322e382c4d2e0bd; tag v0.29.0 pushed. Tested branch head debe9508fd868a111a5a27931518c889e08cf2cd has identical tree to the release merge.
- Complete cloud regression SUCCESS: https://github.com/Ssyap4/Sim-Life/actions/runs/45309807065 ; focused + mobile scene checks SUCCESS: https://github.com/Ssyap4/Sim-Life/actions/runs/45309806992 .
- Production build on ALINA-PC succeeded. Main: D:\Sim-Life, http://192.168.0.124:3111/ ; health HTTP 200, testNoCodes=false, production HTML and JS bundle HTTP 200 verified. Main server uses D:\Sim-Life\server-data. Backup: D:\Sim-Life-Backups\v029-predeploy-20261124-050342 . No test data copied to production.
- Preview remains isolated at port 3162, D:\Sim-Life-028-Simba-RealPose, preview-data-happiness-029-100k. Never mix preview and real household data.
- Release features: authored Simba rest poses and furniture occupancy / remove Simba; three cat houses, comfort and autonomy; separate home and district, physical courier, free family SUV with no erroneous roof cabinet, vehicle trips and parking return, sleep pose recovery, contextual wishes and personal happiness shop. Reward costs: cleanliness 600, bladder 825, hunger 1200, sleep 2250; each lasts 24 game hours. See docs/RELEASE_029.md and AGENTS.md.
- Automated mobile scene checks passed; no new manual visual inspection or physical iPhone FPS measurement claimed in this release turn.
- ALINA-PC is weak: no full local regression, heavy browser automation, Blender or WebGL renders. Use cloud checks, physical iPhone 11 portrait as final visual reference. New main changes require user approval. Next stage is not started.

---

## Historical handoff (older releases; do not treat as current)

# Sim-Life — HANDOFF LATEST

## Новейший утверждённый релиз: 0.27 «Живые характеры» — 23.11.2026

Владелец прямо утвердил перенос **0.27 v6 в main** и переход в новый чат. Исходная ветка \`feat/living-personalities-027\`, Draft PR #51, последний проверенный коммит перед релизом \`727a85df7f08ee410c9b589a4aee25ec2814932c\`. **Не доверяй этому тексту вместо фактического подтверждения**: первым делом проверить \`git log -1\`, ветку \`main\`, GitHub PR/тег \`v0.27.0\` и \`http://127.0.0.1:3111/health\`. После успешного слияния официальная версия \`v0.27.0\`.

**Ключевое:** Влад, Алина, Верделл и Симба получили выраженные индивидуальные реакции, время-зависимые семейные привычки и более спокойные приветствия. У Симбы наконец появились физические **котыные места** на настоящих диванах, кроватях и совместимой покупной мебели: расчёт точек по SKU форме/габаритам/повороту, реальный серверный маршрут к полу у мебели, прыжок, отдых с небольшим восстановлением энергии, спуск и инвалидирование после продажи/переезда мебели. Код: \`src/shared/CatPerches.ts\`, \`server/pets.ts\`, \`src/game/PetActor.ts\`, \`src/game/World.ts\`, \`server/tests/catPerches-027.test.ts\`. Подробности и ограничения: \`docs/RELEASE_027.md\`, \`docs/PREVIEW_027_PERSONALITIES.md\`.

**СОХРАНЕНИЯ:** основной каталог \`D:\Sim-Life\`, сервер \`3111\`, реальные данные и личные коды \`D:\Sim-Life\server-data\` (никогда не перезаписывать!). ПЕРЕД выпуском скопированы и сверены по SHA-256 **все 7 файлов** в \`D:\Sim-Life-Backups\v027-predeploy-20261123-221752\`. Тестовая версия 0.27: \`D:\Sim-Life-027\`, порт \`3157\`, отдельные сохранения \`D:\Sim-Life-027-Data\`, тестовый вход без кодов только здесь. После переноса версии тестовый экземпляр можно выключить или хранить для отладки, не смешивая игровые состояния.

**Проверки:** на ветке прошли профильные TypeScript / автономия / кот / район / production build и облачные настоящие WebGL-кадры на iPhone 11 390×844. Перед релизом обязательно отдельный ПОЛНЫЙ облачный прогон \`npm run check\`, все тесты, \`npm run audit:furniture\`, \`vite build\`. Проверить фактический результат, а не предполагать! Финальная поза Симбы на диване уже без левитации, однако художественная реалистичность лежания «клубком» пока может быть улучшена; не рассказывать, что всё идеально. В физическом iPhone реальный FPS отдельно не измерен.

**ALINA-PC слабый:** не запускать там WebGL/Chrome автоматизацию, Blender и тяжёлые регрессии; облачные GitHub Actions для 3D и тестов. Main менять для следующих этапов только после одобрения владельца. 0.29–0.30 и две большие карьеры (Алина — реконструкция/восстановление волос → собственная студия, Влад — разработка ПО/игр → студия) пока откладываются. Не вводить стирку/грязную одежду до рабочего визуального гардероба. Экран — физический iPhone 11, портрет, mobile-first. Проверять глазами 3D, не только тестами. Остальной исторический контекст ниже.

---

## Актуально с релиза 0.26 «Жизнь вдвоём», 23.11.2026
После утверждения пользователя выпуска 0.26 исходная ветка `feat/life-together-evenings-026`, Draft PR #50, представляет основной релиз `v0.26.0`. Обязательно подтвердить состояние `main`, тега и работающего порта 3111; не утверждать установку лишь по этому документу.

Новые функции: домашние вечера с реальным выбором блюд, совместной готовкой/ужином/отдыхом и серверным воспоминанием; «Поводы дня» из состояния партнёра, кормления питомцев, работы, еды, настоящей грязной посуды, бюджета, успехов; до двух награждаемых семейных ситуаций в игровые сутки; двухстороннее согласие. Камера «🎥 К действию» по нажатию следит за обоими, вручную отпускается. Повреждения сохранений, дубли порций, бесплатные награды и бескодовый доступ на основной сервер недопустимы. Полная реализация: `docs/RELEASE_026.md`, `docs/PREVIEW_026_LIFE_TOGETHER.md`.

**Боевые данные** исключительно `D:\Sim-Life\server-data`, основной каталог `D:\Sim-Life`, порт 3111, личные коды. Изолированная тестовая ветка 0.26: `D:\Sim-Life-026-Evenings`, порт 3156, тестовые данные `D:\Sim-Life-026-Evenings-Data`. Не смешивать. Перед релизом сохранить отдельный проверенный бэкап `household.json` и `access.json` за пределами репозитория. Основная машина ALINA-PC очень слабая: не запускать локально тяжёлый браузер/WebGL, Blender, рендеры и полные тесты. Облако — для тестов/визуальных кадров, физический iPhone 11 — эталон реального FPS.

Ниже — историческое состояние основного релиза 0.25, сохранённое для справки.


Дата: 23 ноября 2026. **Владелец утвердил основной выпуск 0.25 «Семейные решения»** (новая версия `main`, `v0.25.0`). Эта запись заменяет прежнюю преамбулу об основной 0.21: этап 0.21 остаётся её основой, но объединены 0.22–0.25. Сверять фактический `git log -1`, `git status` и `/health`, а не только документы.

## Текущее состояние 0.25

- Репозиторий: https://github.com/Ssyap4/Sim-Life; `main` — последняя **одобренная** версия, новые разработки только в отдельных ветках. Цепочка Draft PR: #46 (0.22) → #47 (0.23) → #48 (0.24) → #49 (0.25). Источник выпуска — `feat/family-finance-home-025` (вся история после 0.21 без отклонения от main). Правила `AGENTS.md`; подробности `docs/RELEASE_025.md` и `docs/PREVIEW_025_FAMILY_BUDGET.md`.
- Боевой локальный каталог `D:\Sim-Life`, порт **3111**, данные семьи только `D:\Sim-Life\server-data` (`household.json`, `access.json`, доверенные устройства). Запуск `START_SIM_LIFE.cmd`, `npm run start`, смартфон на домашнем Wi-Fi обычно `http://192.168.0.124:3111/`. **Нельзя публиковать коды, токены или содержимое сохранения**, нельзя использовать `SIM_LIFE_TEST_NO_CODES=1` на 3111 или открывать порт в публичный интернет. Бэкапы в `D:\Sim-Life-Backups`; перед релизом 0.25 должна быть сделана и проверена отдельная копия реальной семьи. Реальная игра и предпросмотры не делят данные.
- Тестовые worktree: `D:\Sim-Life-024` / порт 3154 / `D:\Sim-Life-024-Data`; `D:\Sim-Life-025` / порт 3155 / `D:\Sim-Life-025-Data`. Предпросмотры без кодов только на отдельном безопасном порту и с отдельной тестовой семейной папкой. Не выдавать тестовое сохранение за настоящую семью. Порты/IP и наличие запущенных процессов надо проверять, а не угадывать.
- Самый важный технический запрет: **ALINA-PC ОЧЕНЬ СЛАБЫЙ**. Нельзя нагружать его Chrome/WebGL-автоматизацией, Blender, 3D-рендером, огромными прогонами тестов. Лёгкие `git`/файловые команды, сборка по необходимости; тяжёлые проверки — отдельные облачные GitHub Actions при наличии доступа. **Главный эталон — физический iPhone 11**, а не большой монитор и не динамический остров. Опираться на реальные кадры/прогоны; облачная эмуляция не доказывает FPS на настоящем телефоне.
- Сами персонажи: **Влад** (разработка игр/ПО и вайбкодинг), **Алина** (реконструкция/восстановление волос, НЕ салон стрижек). **Симба** — настоящий домашний длинный стройный гладкошёрстный рыжий полосатый кот по фотографиям; **Верделл** — чёрный шпиц с фирменной анимацией «зайка», встаёт на задние и просит двумя передними лапами. Модели не должны превратиться в пластилиновые шары, а анимации могут совершенствоваться без разрушения старых.
- Геймплей мира: жилой дом + квартал + парк + пруд + торговая улица в одной 3D-сцене. **14 NPC: 4 хозяина своих уникальных дворов** Марина, Денис, Виктория, Артём; 10 независимых горожан. 7 коммерческих фасадов с крупными крышными вывесками; 8 посещаемых точек включая парк. Гуляют, читают, садовничают, готовят, заходят в заведения; обход препятствий. Не придумывать им отношения с игроками или диалоги до отдельного утверждения.
- Mobile-first интерфейс: свободная камера по умолчанию, `◎` включает слежение; ручное движение камеры его отключает. Внизу только Телефон и Навыки, питомцы лапкой сверху. Клавиатура, тапы, двойные касания, скролл Safari настроены; **не добавлять плавающих больших панелей**. ПК на большом мониторе — полный экран, но выбор дизайна по портретным iPhone. В интерфейсе **не показывать «релиз 0.XX» и технические заглушки**, только внутриигровые тексты.
- Повседневные механики: готовка с кулинарным уровнем, 33 блюда после 0.22 включая ресторанные рецепты с осмысленными ингредиентами и отдельными моделями; покупка в супермаркете/доставке. У мангала для любого блюда нужны уголь и жидкость для розжига. Порции реально на столе и в холодильнике, имеют сроки годности; можно есть, убирать остатки и накрывать стол контейнерами. Девять навыков, XP за готовку, порча, реальная мебель, продажа и перестановка, две сессии, очередь задач, автономия и подработки. Не вводить дублирование порций или еды.
- 0.23–0.24: улучшенные социальные взаимодействия и эмоции Влада/Алины, игрушки питомцев, походки и анимации, более живые экраны ПК (у Влада код/проекты, у Алины материалы по реконструкции волос), ТВ (готовка, концерты, животные, путешествия), физические действия «Убрать готовую еду» и «Накрыть стол». Прежние жесты, игры, ТВ и анимации сохранить.
- **0.25 семейные финансы:** единая серверная копилка, деньги переводятся между доступным семейным счётом и `state.savings.balance`; это не доход и не расход. Пять целей: подушка, дом, будущая студия Алины, будущая студия Влада, отдых. Цели не дают автоматического дохода и пока не открывают бизнес. Реальные расходы на продукты, доставку и питомцев в течение 10 игровых дней; можно менять лимиты, но это **ориентиры, а не блокировки покупок**. Платежи ЖКХ/связи/подписок проходят только из доступного семейного кошелька; накопления надо вернуть вручную. Ситуационные разговоры про долги/перерасход/сбережения и совместное «Спланировать бюджет вдвоём» за столом. Код: `src/shared/familyBudget.ts`, `server/familyBudget.ts`, `src/budgetUI.ts`, `src/billingUI.ts`, `server/life.ts`.
- Совместное бюджетирование и отношения: сервер — источник правды, два игрока с собственными кодами; переводы сериализуются на сервере без двойных списаний. В сохранениях версия схемы остаётся 2, поле `savings` безопасно добавляется при миграции, остальные данные не обнуляются. Тесты включают проверку двух одновременных переводов, ошибок в полях, старых сохранений и смены десятого игрового дня.
- **Стирка/грязная одежда/штрафы/переодевания запрещены до полноценного настоящего гардероба с визуальной сменой 3D-одежды и сохранением выбора.** Пока не делать.
- **Две главные будущие глубокие профессии не торопить**: Алина проходит путь от учёбы и первых клиентов через реальные материалы, оборудование, расходники, помещение и репутацию до собственной студии профессиональной реконструкции волос, команды и нескольких рабочих мест. Влад от вайбкодинга/мелких IT-заказов до собственной game-dev/software студии, офиса, сотрудников, мини-Tycoon с проектами, сроками, рисками, релизами, отзывами и продажами. Их развить **после** крепкой повседневной жизни и экономического выбора.
- Экономика — российские рубли, приблизительно реалистичные цены Москвы/МО; заказывать готовую еду дороже, чем готовить дома. Смысл игры личный, для Влада и Алины, не публичный коммерческий релиз. Пользователь предпочитает **много реальных лёгких механик, персонажей и животных, а не дорогие тени и огромный пустой мир**.
- Резервная копия, сверка контрольных сумм и отдельные игровые данные обязательны при следующих выпусках. **Тесты только затронутых систем**, кроме релиза, когда нужна одна полная регрессия. Крупные изменения проверять глазами в мобильном размере **начало–процесс–результат**, а не только автоматикой. Если графика неверна — исправлять, а не ссылаться на зелёные тесты. Честно отделять фактически проверенное от неподтверждённого.
- Общение с пользователем живое, дружеское, можно юмор и материться, особенно по поводу багов и разработки. **Начинать работу по прямой просьбе, а не без конца обещать «поехали».** Следующий большой этап обычно сначала обсудить и утвердить, затем делать; в новом чате сначала сверить фактическую версию. Промпт для перехода оформлять в один подробный кодовый блок только когда пользователь просит.

## Документы и история

Сохраняются `AGENTS.md`, `README.md`, `docs/RELEASE_025.md`,
`docs/PREVIEW_025_FAMILY_BUDGET.md`, `docs/RELEASE_021.md`,
`docs/RELEASE_020.md`, `docs/RELEASE_019.md`,
`docs/PREVIEW_021_DISTRICT.md`, исходники и GitHub PR #46–49.

**После перехода в новый чат:** сначала прочитать `AGENTS.md`, этот файл,
последний коммит `main`, основной сервер и его проверки. Разработку нового
этапа вести в отдельной ветке/worktree и портом с отдельными сохранениями.
