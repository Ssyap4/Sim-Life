# Sim-Life 0.47.0 — Отношения, уход, музыка и тактильный отклик (25.11.2026)
Owner explicitly approved production of 0.46–0.47 and all previous updates. Release code/tag v0.47.0: eae39afcfe0fcb8c35217b88d075f661ae89e6e8. Main and annotated tag pushed and verified. Deployed D:\Sim-Life port 3111, http://192.168.0.124:3111/, listener PID 2068 at switch. HTTP health OK, testNoCodes:false, bundle index-CrI_HrF6.js. Eight soundtrack MP3 range requests HTTP 206 with audio/mpeg. Production reset once to 10000 RUB/default furniture and two free starter pet furnishings per standing owner release policy. Access and trusted-device hashes unchanged before launch. Backup D:\Sim-Life-Backups\v047-predeploy-20261125\at-switch verified 13 files; old dist at dist-045. Never reset on ordinary restart.
## 0.46
Gifts: bouquet 850 RUB, sweets 450 RUB, courier delivery 149 RUB, shared stock only usable after receipt; consumed once on accepted completed interaction; no second payment, cooldown and memories. Shoulder massage on real sofa with two seats, recipient recovery, cooldown. Breakfast in bed uses real ingredients and cooking skill, fresh serving from prepared batch, wooden tray, bed route/pose, recipient consumes one portion, leftovers on table; previous breakfast at table remains. Vlad home shaving, styling, perfume; separate care effects and compliments. BRO separate barbershop by car, optional phone booking, five professional services: Fade 1200, shave 900, styling 700, face 800, full 2900 RUB. Timed care effects and anti-farm, no hair geometry changes. See docs/PREVIEW_046.md.
## 0.47
Owner rejected all generated/recorded effects and selected eight supplied tracks. ONLY background music: 43:55, 37 MB, automatic shuffled full cycles without immediate repeat, soft boundary fades, volume/skip/mute in phone, pause/resume, independent of scene. No UI, voices, pets, footsteps, TV, PC, console, ambient or smart-speaker sounds; mechanics preserved. MP3 HTTP streaming supports ranges for Safari. Repository PUBLIC: never commit/upload private recordings; ignored public/audio/soundtrack/*.mp3. Cache D:\Sim-Life-PrivateSoundtrack contains eight prepared files + manifest. For EVERY new worktree/deployment install local music before building: powershell -File scripts/install-private-soundtrack.ps1. Public cloud builds intentionally have no MP3. If missing, use original Desktop 1–8.mp3 and scripts/import-private-soundtrack.py; see docs/PREVIEW_047_AUDIO.md. Do not fetch replacements.
Mobile: short 8–20 ms vibration for supported Android with 85 ms cooldown, opt-out in phone autonomy settings; visual press state for touch, respects reduced motion and scroll/pointer cancellation. iPhone Safari has no Vibration API/Taptic Engine access; visual only. No added audio.
## QA
Cloud run 45653746974 job 139344769885 at eae39af: 759 tests, 758 pass, 0 fail, 1 intentional skip (private audio assets absent in public checkout); build passed. Local private asset check passed, 19/19 combined focused tests plus version assertions 3/3, typecheck/build successful. First cloud run 45653372425 failed only stale version assertion, fixed in eae39af. Live deployment verified. Detailed 0.46 animation/contact screenshots, physical iPhone/Android FPS and actual vibration remain unverified; owner approved release. Do not claim physical performance. No heavy tests/rendering on ALINA-PC.
## Next
No new feature selected. Discuss with owner. Deep careers only near full release; board games later; no garden, restaurant, physical furniture shop, new NPC interaction, weather v2, RGB, laundry, development counter or model work unless requested. Maintain mobile-first, separate previews 100000 RUB, main only by explicit approval; restore private soundtrack locally before builds. 

---

# Sim-Life 0.45.0 — Красота, уход и новые персонажи (25.11.2026)
Owner explicitly approved production of 0.44 + 0.45 v3 and all previous updates. Code/tag v0.45.0: 7026c7e5876abeed14b816d8a6ace7a4e000473a. Deployed D:\Sim-Life port 3111, http://192.168.0.124:3111/, PID 2616 at switch. Health OK, testNoCodes:false; /assets/index-BFlD-J9f.js, /assets/vlad-CTEbhJdU.glb and /assets/alina-CuN7AyTn.glb HTTP 200. Production reset once: 10000 RUB, default furniture plus two starter pet items. Access/trusted-device hashes unchanged before launch. Backup D:\Sim-Life-Backups\v045-predeploy-20261125\at-switch verified 12 files SHA-256; old dist retained. Never reset on ordinary restart.
## 0.44 care
Seven optional vanity procedures for Alina: brush +5 for 12h/15s; daily hair +15 24h/40s; festive +20 24h/50s; light makeup +15 24h/35s; evening +25 24h/50s; skin +10 24h/30s; perfume +10 12h/8s. Timed server effects grouped hair/makeup/skin/scent; base 40, max 100. At 60/80/95 mood drain x.9/.8/.75; at 80/95 social bonus x1.15/1.25. No mandatory penalty; no cosmetics store or new HUD bar. Repeat refreshes duration, upgrades replace and grant difference, weaker active procedure denied; compliments cannot be farmed. Five context conversations: Alina asks makeup/hair/scent/look, Vlad compliments, partner answers, once per fresh group or upgrade; +15 mood/+20 social before modifier. 20s nearby dialogues, optional morning brushing in full autonomy, care wishes. Existing vanity in bedroom, seated props and animations. Care indicators in needs section.
## 0.45 models
Codex remake df42ade based on 2479ee2; polish branch feat/character-polish-045, final asset commit a830c4b (cloud source 4da282c). Original skeletons 18 joints, bind matrices, wardrobe IDs, Smile/CloseLids/Blink, animated eye joints retained. Alina blue eyes, blonde sculpted waves, DailyStyle/EveningStyle morphs and two makeup masks. Vlad swamp-green irises, short fade, clean-shaven, compact lateral volumetric ears, refined nose and cheeks. Both orbital geometry softened. Alina 61,252 triangles default/129,612 all wardrobe; GLB 3,747,300 bytes; Vlad 56,456/121,346; GLB 3,314,032 bytes. Sources art/characters/remake/ and remake*.py; runtime src/assets/characters/remake/; old models retained via ?characters=legacy and loading fallback. No finger joints added. See docs/CHARACTER_REMAKE_045.md for Codex baseline (its counts are historical). Visual likeness still approximate; owner explicitly chooses to pause model work and release current result.
## QA
Full cloud regression 45636878690 job 139284604687 at 7026c7e: 755/755, build success. First full run 45636410052 had 753/755; fixed nightstand decor obstacle indices in locations and furnishingPlacement and aligned care conversations from 8s to 20s. Focused 23/23 after fix. Cloud portrait comparison run 45635407911 at 4da282c passed asset/rig/wardrobe/focused tests, build, and 390x844 before/after renders; all final comparison sheets personally inspected. Cloud asset artifact 15032857329, comparison artifact 15032837411; committed binaries from export verified locally. Prior care mobile runs 45616644851 and 45617465022. Physical iPhone 60.1 FPS/p95 17 ms was on older HD experiment, NOT final 0.45; final FPS, Android physical and detailed finger contact still unverified. Do not claim physical performance. Bundle warnings historical.
## Next
No new feature approved. Ask owner what direction next, do not start careers until near full release; board games later; no garden, restaurant, physical furniture shop, new NPC interaction, weather v2, RGB, laundry or development counter without approval. Model work paused unless owner requests. Maintain mobile-first, separate previews 100000 RUB, retain placed items in previews, main only by owner approval. No Blender/WebGL/heavy test suites on ALINA-PC.


---

# Current approved release 0.43.0 — Health and console gaming (25.11.2026)
Owner explicitly approved main and deployment. Verify main/tag v0.43.0 and live port 3111; read docs/RELEASE_043.md. Release code eb3ba4aa00b58916201af7e48902c3ace3e6e154; full cloud regression and mobile QA passed at f2af797, version-only follow-up and build passed. Manual mobile screenshots reviewed; detailed finger contact/physical FPS/audio unverified. No next feature approved. Deep careers near full release, board games later, no new NPC interaction or development counter. Preserve existing reset/mobile-first/isolated test rules, no heavy QA on ALINA-PC. Older sections historical where superseded.

# Current approved release 0.41.0 — PULSE Fitness (25.11.2026)
Owner explicitly approved production and closing fitness scope. Verify main/tag v0.41.0 and port 3111, read docs/RELEASE_041.md. Release code bd76cf488579a6c44ad943b53f63db4b91a1d5f4; full cloud regression 732/732, mobile visual QA success, physical device FPS/contact/audio not verified. Next stage not selected; deep careers only near full release, no new NPC interaction, no excessive gym mechanics. No development-turn counter; weather v2 paused, no RGB/lights. Preserve existing mobile-first/isolated test/reset rules; no heavy QA on ALINA-PC. Older sections below historical where superseded.

# Current approved release 0.40.0 (2026-11-24)
Read docs/RELEASE_040.md and HANDOFF_LATEST.md. Owner approved 0.40 production; verify main, v0.40.0 and health port 3111. No development-turn counter. Next stage not selected; no lights/RGB, weather v2 paused. Full cloud regression result unverified, physical FPS/audio and manual visual QA outstanding. Preserve mobile-first, isolated test saves, no heavy QA on ALINA-PC. Earlier release rules below historical where superseded.

# Current approved release 0.39.0 (2026-11-24)
See docs/RELEASE_039.md and HANDOFF_LATEST.md; verify main, tag and port 3111 before assuming deployment. Owner requested winter snow throughout the plot, then release; further 0.39 weather development is paused. Do not start 0.40 or another feature without the owner's choice. Earlier release notes below are historical.

# Актуальное направление 0.37 (24.11.2026)
Владелец утвердил условный выпуск 0.37 «Живой уют»: аудио 0.36 v1–v4, эмоции 0.37 v1–v2, графический эксперимент Astra, Graphics Polish v1–v5 и финальная полировка двора. Проверять фактическое развёртывание по HANDOFF_LATEST.md. Следующий этап: продолжение эмоций (мимика, язык тела, настроение, желания, небольшие события); затем 0.38 семейная жизнь, 0.39 полноценная погода и сезоны, 0.40 умный дом. Главные карьеры — ближе к полному релизу, не фиксировать в 0.41. Визуальные пресеты погоды не являются игровой погодой. Не трогать main без согласия, не запускать тяжёлые проверки на ALINA-PC.

# Актуальное направление 0.34 (24.11.2026)
Владелец утвердил 0.35 «Жизнь с питомцами». Фактический релиз v0.35.0, PR #65, подробности в HANDOFF_LATEST.md и docs/RELEASE_035.md. Следующий этап ещё не согласован. Правила сбросов в конце файла приоритетнее старых. Не трогать main для дальнейшей разработки без согласия. Гигиена только Верделлу; фонтанчики, аксессуары, болезни и ветклиника не входят в 0.35. Не запускать тяжёлые проверки на ALINA-PC.

# Актуальное направление 0.33 (24.11.2026)
Владелец утвердил 0.33 «Гардероб и новый район». Следующий этап — электроника, детали docs/RELEASE_033.md и docs/ROADMAP.md. Последнее правило сбросов в конце этого файла имеет приоритет над историческими правилами: тесты 100k и сохраняют размещённые предметы, основа чистая со штатной мебелью, коды не менять. Android исправление не откатывать. Фактический статус проверять по HANDOFF_LATEST.md и живому серверу.

# Актуальное направление после 0.32 (24.11.2026)

Владелец утвердил 0.32 «Отдых и развлечения». Фактический релиз сверять по HANDOFF_LATEST.md, GitHub main/тегу, порту 3111. 0.31 пропущена, рыбалка исключена. Следующая 0.33 — одежда и внешность: полный комплект вместо наложения множества слоёв, общие риг и лицо, выбор в физическом магазине с примерочной/кассой, без доставки. Сначала проверить несколько комплектов во всех ключевых позах, затем целевой ассортимент 20 на персонажа. Стирку и штрафы за грязную одежду не вводить. Главные профессии пока не начинать.

Совместные игровые проверки: по просьбе владельца можно подключить лёгкий WebSocket-клиент за свободного персонажа только на изолированном тестовом сервере. Покупки, действия и приглашения — настоящими серверными командами; партнёр принимает сам. Не запускать тяжёлый браузер на ALINA-PC, не заменять визуальный просмотр текстовыми логами, не занимать основную игру. Отключать клиента после партии. В 0.32 так реально проверены бадминтон и настольный теннис.

Подробности 0.32: docs/RELEASE_032.md. Облачная полная регрессия перед релизом, профильные тесты при обычных правках. 

# Sim-Life — правила работы разработчика для всех будущих чатов и агентов

## Согласованное направление 0.29 (ещё не основной релиз)

Комфорт мебели с реальным влиянием на отдых и сон, обновление каталога, три домика Симбы (вход внутрь, отдых, прыжки на крышу, комплекс с когтеточкой), автономия всех семи потребностей с порогом 50%, полный режим с широким набором реальных действий, компактные уведомления о проблемах и желаниях. Стирку, грязную одежду, новую обязательную гигиену и уборку помещений пока не вводить. Не тратить деньги автоматически, не перехватывать ручные команды, не запускать тяжёлый браузер на ALINA-PC. Проверить облачные профильные тесты и реальные кадры на телефоне перед выпуском.

## АКТУАЛЬНОЕ РЕШЕНИЕ ВЛАДЕЛЬЦА — 24.11.2026: свежие тесты и 100 000 ₽

**ЭТО ПРАВИЛО ПРИОРИТЕТНЕЕ СТАРЫХ ТРЕБОВАНИЙ ПО СОХРАНЕНИЯМ НИЖЕ.** Игра находится в ранней стадии: полноценная играбельность, модели, управление и отладка важнее сохранения тестового прогресса. Не трать время владельца на постоянные разговоры о защите сохранений и не устраивай лишние бэкапы/миграции для временных сборок.

- **Каждая новая тестовая сборка может начинаться с нового чистого сохранения.** Создавай отдельный каталог тестовых данных для новой версии/preview, вместо переноса старого прогресса. Тестовые данные можно сбрасывать/пересоздавать без церемоний. Не перепутай каталоги и не удаляй случайно данные другого запущенного сервера.
- **Стартовый тестовый баланс — ровно 100 000 ₽**, не миллион и не 100 миллионов: крупные суммы загромождают мобильный HUD. Достаточно для проверки покупок, мебели, продуктов и механик. Это правило относится к новым тестовым домохозяйствам; существующим не начислять деньги заново при перезапуске.
- Реализация: для тестового сервера с `SIM_LIFE_TEST_NO_CODES=1` запуск через `server/index.ts` задаёт `previewStartMoney: 100_000`; `server/server.ts` применяет сумму **только при первом создании изолированного тестового сохранения**. Обычная экономика и начальный баланс игры без тестового режима не меняются.
- Продолжай давать **одну ссылку на конкретную сборку для iPhone и Android**; различаются лишь аппаратные настройки графики и FPS. Android Firefox в полном качестве, Chrome/WebGL пока требует отдельной диагностики.
- В тестовой сборке вход без кодов, изолированный тестовый порт и новые данные. Не путать тесты с `main` / портом 3111. При утверждённой установке новой основной версии разрешено начать новый игровой прогресс; не трогай действующий сервер без согласованного развёртывания.
- Приоритет разработки сейчас: **действительно работающая и красивая игра, исправление багов, анимаций и удобства на телефонах**, а не долгосрочная поддержка совместимости черновых сохранений. Не добавлять заглушки вместо механик и не заявлять о визуальном успехе без просмотра реальных кадров.

## Текущая основная версия на 24.11.2026 — 0.28.0

Фактический релиз: `main`, тег `v0.28.0`, коммит `14ea2bba82758cc6664713ea606e6aa71537d357`. Разделы ниже про 0.27, 0.26, 0.25 и 0.21 сохранены как история, **не как актуальная версия**. Перед разработкой проверяй живой `main`, а не исторические заголовки. В 0.28 добавлены «Питомцы 2.0» и полировка NPC/анимаций; Android-полный рендер и кошачьи позы развиваются в отдельных ветках. Производительность Android ещё требует отдельной работы.

## Текущий основной выпуск 0.27 — «Живые характеры» (23 ноября 2026)

Владелец утвердил выпуск 0.27 v6 как основной. Исходный PR #51 \`feat/living-personalities-027\`. **После фактического слияния и установки проверять main, тег v0.27.0 и HTTP /health порта 3111**, а не верить этому документу без проверки. Основная машина: \`D:\Sim-Life\`, постоянные сохранения и коды: \`D:\Sim-Life\server-data\`. Перед развёртыванием создан и проверен отдельный SHA-256-бэкап: \`D:\Sim-Life-Backups\v027-predeploy-20261123-221752\`. Нельзя заменять его тестовой базой.

0.27: выразительные характеры Влада, Алины, Симбы и Верделла; бытовой ритм, мягкие реакции и приветствия; новая серверно-проверенная кошачья рутина выбора лежанки/прыжка/отдыха на встроенной или совместимой купленной мебели с учётом геометрии и ограничений, без прохода сквозь предметы. Подробнее \`docs/RELEASE_027.md\`, \`docs/PREVIEW_027_PERSONALITIES.md\`, \`HANDOFF_LATEST.md\`. Реальный FPS на физическом iPhone 11 проверять отдельно. 0.29–0.30 и глубочайшие карьеры пока не начинать. На слабом ALINA-PC не запускать тяжёлый браузер/WebGL и полную регрессию.



## Основной выпуск 0.26 — «Жизнь вдвоём» (23 ноября 2026)

Новый утверждённый пользователем этап 0.26 продолжает 0.25 «Семейные решения», Draft PR #50 `feat/life-together-evenings-026`. После подтверждённого слияния основная версия — `main` / `v0.26.0`, рабочий каталог `D:\Sim-Life`, порт 3111 с личными кодами, единственные настоящие семейные данные — `D:\Sim-Life\server-data`. **При переходе в новый чат сверяйте это с фактическим `git log`, тегами и `/health`; документация не является подтверждением развертывания.** Точные правила и механики: `docs/RELEASE_026.md`, `docs/PREVIEW_026_LIFE_TOGETHER.md`.

0.26: совместные реалистичные вечера и три способа устроить ужин без создания еды из воздуха; парные маршруты, согласие, общая память, эмоции; «Поводы дня» из реальных потребностей, питомцев, работы, еды и домашних дел, без случайных штрафов; выборочное приближение камеры к обоим персонажам. Основная платформа — iPhone 11, портретная ориентация. Визуальный WebGL проверять в независимом облаке, а не на очень слабом ALINA-PC. Затронутый код — профильными тестами, полный прогон перед крупным релизом, плюс просмотр настоящей 3D-сцены глазами. **Не перепутать любые тестовые данные с `server-data`.** Не менять `main` и реальные сохранения без нового разрешения на дальнейшие этапы.


## Основной выпуск 0.25 — «Семейные решения» (23 ноября 2026)

Пользователь прямо одобрил выпуск 0.25 в `main`; предыдущая основная 0.21 была на коммите `3d18e39`. Этот релиз включает **ВСЮ цепочку 0.22–0.25**, исходный Draft PR #46 → #47 → #48 → #49. Новая официальная основная версия: `v0.25.0` (после подтверждённого слияния и локального обновления); `D:\Sim-Life`, порт 3111 **с персональными кодами**, `D:\Sim-Life\server-data` с семейными сохранениями. Полные подробности в `docs/RELEASE_025.md` и `HANDOFF_LATEST.md`. Старые упоминания 0.21 ниже — исторический контекст, **НЕ актуальная основная версия**.

Новая 0.25: реальные накопления между кошельком и копилкой, пять целей (включая обе будущие студии), реальные лимиты расходов на 10 игровых дней, синхронизация двух игроков и отдельная история переводов. В 0.24 — ПК/ТВ, дополнительные домашние действия с реальными порциями еды, «зайка» Верделла; 0.23 — герои/питомцы/игрушки; 0.22 — ресторанная кулинария и ингредиенты. Все новые финансы серверные. Счета расходуются **только с доступного кошелька**, накопления нужно снять руками. До следующего релиза **НЕ менять main без нового разрешения**.

**Особенно важно:** ALINA-PC очень слабый; нельзя гонять на нём большие регрессии, Chrome/WebGL-автоматизацию, Blender, 3D-рендеры, нагрузки. Облачные GitHub Actions — для тяжёлых проверок, если доступны; физический iPhone 11 — первичный экран. Не выдавать прошедшие автотесты за визуальную проверку действий в живой игре. Сохранять собственные снимки перед любым обновлением сервера.


## Приоритет после 0.21 — живая семейная игра

Согласовано: делать Влада, Алину, Верделла и Симбу выразительными и живыми, прорабатывать их модели, эмоции, анимации, бытовые действия и содержательные совместные взаимодействия прежде декоративной графики, теней и размера мира. Новые занятия должны создавать реальные игровые выборы и реакции, а не имитировать их одним описанием. Экономика — рубли, покупки, накопления и реалистичные обязательные расходы.

**По-прежнему запрещено вводить стирку, грязную одежду, штрафы за одежду и обязательные переодевания.** Сначала нужен полноценный гардероб с визуально настоящей сменой 3D-одежды и сохранением выбора. Только затем механики ухода за вещами.

Две главные профессии пока не торопить: Алина — профессиональная реконструкция/восстановление волос и будущая собственная студия (НЕ парикмахерская); Влад — вайбкодинг, разработка ПО и игр, затем своя студия разработки. Их полнота важнее количества мелких подработок.

0.22 ресторанные рецепты — Draft PR #46. Первый отдельный этап 0.23 по живым персонажам — Draft PR #47, основанный на рабочей ветке 0.22. Без согласования владельца не сливать ни один PR в main. Главная 0.21 на порту 3111 и её сохранения остаются неизменными.


Этот файл — постоянные инструкции проекта. При возобновлении разработки в новом чате/сеансе сначала прочитай этот файл, действующий README, текущую ветку и предыдущие изменения. Не полагайся только на память чата.

## Дворы и развлечения NPC в 0.21

**Четыре жильца имеют собственные разноплановые участки**: у каждого
скамейка и мангал; выращивают помидоры, травы, цветы или капусту.
Их занятия должны соответствовать видимым предметам и реальным точкам:
сидят на лавочке, читают, смотрят телефон, поливают, ухаживают за
грядками, собирают овощи, готовят на мангале, общаются с гостями из
соседних домов. Не превращать все дворы обратно в идентичный декор.

Не вводить отношения, дружбу и диалоговые карточки NPC без отдельного
утверждения. Подготовленные действия и позы можно переиспользовать
позже. При добавлении новых предметов обновлять физические препятствия
и маршруты так, чтобы дверь, общий проход и площадки для действий
оставались доступны. Беречь FPS iPhone 11, батчить растения, делать
профильные тесты, проверять крупные визуальные изменения глазами.

## Текущее правило 0.21: живой, но лёгкий район

С версии 0.21 **четыре конкретных NPC** (Марина, Денис, Виктория, Артём)
закреплены **по одному** за четырьмя соседскими домиками. Их реальные маршруты
включают выход/возврат через собственную дверь, домашние дела, прогулки,
посещения заведений и общение. **Остальные десять NPC** независимы от домов:
они приходят с краёв общественных дорожек, гуляют, встречаются на площади
и у парка, заходят к реальным входам всех семи коммерческих зданий и парка,
плавно исчезают у двери и затем появляются у неё для обратного пути.
Посещения NPC — визуальная жизнь района, без подмены семейных покупок и денег.

**Не возвращать старую систему**, в которой 14 NPC редко появляются и
все привязаны к четырём домам. При этом избегать толпы, сквозных проходов,
невидимых NPC из-за слишком короткой дистанции подгрузки и тяжёлых
моделей на iPhone 11. Планы детерминированы по игровым часам, маршруты
обходят коллизии зданий, оград, растений и пруда; на недоступные точки
по прямой идти запрещено. Реальный FPS проверяется на телефоне.

## Обязательная проверка крупных изменений — код + глаза

**При любом крупном внедрении новой механики, взаимодействия, предметов, анимаций, 3D-моделей, мебели, магазина, меню или многопользовательской функции НЕЛЬЗЯ ограничиваться одними автотестами.** Разработчик обязан:
1. Проверить только затронутый код и связанные с ним сценарии; типы/сборку выполнять по необходимости, без автоматического прогона всего проекта (если пользователь не попросил исключить автотесты). Полные тесты — только по отдельным критериям ниже.
2. **Лично открыть реальную работающую игру в браузере**, выполнить изменённое действие персонажем, визуально проверить начало, середину и конец (камера и сцена, 3D-модель, анимация, расположение рук, предметов, реакции UI, результат).
3. Отдельно посмотреть масштабирование/наложения в мобильном портретном режиме и не ухудшить производительность.
4. Для многопользовательских/парных механик визуально проверить оба персонажа или обе сессии там, где это возможно.
5. Если что-то реально выглядит неверно или обнаружен баг, **исправить самому и повторить визуальный просмотр**, а не выдавать чистые тесты за доказательство качества графики.
6. Сообщать пользователю, что именно просмотрено лично, какие проверки прошли, а что осталось непроверенным. Не утверждать, что глазами проверены кадры, которых фактически не видел.

Это **постоянное правило, распространяющееся на все будущие чаты**. Пользователь не должен каждый раз просить об этом отдельно. Если пользователь явно просит не запускать автотесты — выполнить ручную/визуальную проверку, не нарушая его просьбу.

## Безопасность разработки

- Основная утверждённая версия: **main / релиз 0.21 «Живой район»**, каталог D:\Sim-Life, сервер 3111 с приватными кодами, сохранения семьи D:\Sim-Life\server-data. Релиз включает предыдущие 0.19–0.20 и 0.21 (единый район, маршруты NPC, озеленение, камера, мобильный стиль). Перед любой следующей крупной версией — отдельный worktree/ветка и прямое утверждение пользователя. История прежних этапов ниже — архив.
- Архивные предпросмотры имеют отдельные worktree, порты и данные. Предпросмотр 0.21: ветка feat/world-character-overhaul-021, PR #45, порт 3150. Не переносить тестовый прогресс поверх семьи; новые версии разрабатывать отдельно от main.
- **Во всех будущих тестовых сборках вход должен быть без кодов**: выбор персонажа и кнопка входа; отдельные сохранения, отдельный preview-порт и явный `SIM_LIFE_TEST_NO_CODES=1`. Никогда не отключать защиту настоящей основной семьи на 3111, не использовать бескодовый preview в публичной сети. В режиме «Выключена» новая автономия обязана сохранять прежние фоновые действия и спасение критических потребностей из 0.16.
- Сохранить рабочую механику расхождения персонажей и питомцев, не ухудшать FPS на мобильном.
- Не заменять существенные реализации инструкциями пользователю: разработчик сам редактирует файлы, запускает игру, проверяет её, исправляет ошибки.
- Переходный промпт для нового чата составлять **только когда пользователь просит перейти**; всегда включать в него ссылку на этот файл и правило визуальных проверок.

## Постоянное правило игровой атмосферы

- Игрок **не должен видеть** в интерфейсе названия этапов разработки и номера релизов («в 0.16», «предпросмотр», «тестовая версия», «заглушка», внутренние пути вроде `access.json`). Пояснять механику естественным игровым языком. Версии, бэкапы и технические пути допустимы в коде, тестах и документации, но не в HUD, телефоне, подсказках, экранах входа и меню. Проверять видимые тексты при больших обновлениях.

## Повседневная жизнь и угли для мангала (0.16)

- Древесный уголь и жидкость для розжига доступны через общий каталог реального супермаркета и доставки (ПК и телефон), их остатки хранятся в семейном запасе.
- **Каждое** приготовление на мангале требует одну закладку угля и одну порцию розжига поверх основных ингредиентов, для каждого рецепта, включая будущие. Проверять нехватку до начала готовки и списывать материалы один раз только при успешном приготовлении.
- Обычные блюда на кухне не требуют топлива для мангала.

## Постоянные механики 0.18 — соседи, еда, навыки и Safari

- Историческое правило 0.18: 14 соседей были привязаны к четырём домикам и появлялись редко. **В 0.21 оно заменено разделом «живой район» выше**: четыре домовладельца и десять независимых прохожих. Сохранять детерминированные общие часы, не создавать новых семейных сохранений.
- После успешной готовки порции находятся на физическом столе, а НЕ мгновенно в холодильнике. По нажатию на любую 3D-тарелку в доме или у мангала: съесть либо убрать в холодильник; из холодильника — достать порцию на стол. Только фактические партии с местом хранения «холодильник» учитываются в его заполнении. Никакого дублирования или восстановления свежести переставлением.
- Еда на столе портится обычно через 8 игровых часов (салаты — 6); в холодильнике порча замедляется пропорционально оставшейся свежести, без сброса возраста. Старые семейные сохранения и уже существовавшие сроки годности нужно беречь.
- Вся успешно завершённая готовка, включая автономную и совместную, даёт реальный личный XP в навыке «Кулинария». Отмена и ошибки XP не дают. Уровень/XP показываются в меню готовки; все девять навыков — в телефоне в приложении «Навыки и развитие».
- Никогда не делать список рецептов через CSS display:contents в мобильном Safari: использовать реальную сетку, скролл и отдельные карточки с раскрывающимися ингредиентами. Проверять 320×568. Стулья: реальные позы таза/ног на сиденье, правильный поворот к столу.
- Дополнительная документация: docs/RELEASE_018.md и docs/PREVIEW_018_NEIGHBORHOOD.md. Полный набор тестов не запускать после мелких правок; только перед крупным релизом либо по явной просьбе.

## Mobile-first — обязательное правило с 0.17 и во всех будущих чатах

**Sim-Life — игра прежде всего для смартфонов.** Экран компьютера — лишь полноэкранный способ запустить ту же игру, а не эталон для дизайна. Для всех дальнейших крупных и мелких доработок интерфейса, магазинов, доставки, готовки, мебели, карточек товаров, потребностей, взаимодействий, телефона и профессий:
1. Проектируй и проверяй UI **исключительно в телефонном масштабе и вертикальной ориентации**, используя реальные мобильные размеры (320×568, 360×780, 390×844, 430×932) и эмуляцию касаний. Широкий ПК-экран не является основанием объявлять интерфейс проверенным или удобным. Сам ПК по-прежнему открывает игру на весь экран, без отдельного desktop-редизайна.
2. Самостоятельно проходи **только затронутые изменением пользовательские сценарии** в мобильном браузере. Например, правка доставки → поиск, каталог, корзина и оформление; правка готовки → рецепты, ингредиенты, приготовление; мебель → фильтры и установка. Не перепроверяй все прочие разделы после локальных правок. В затронутом сценарии учитывай маленькие экраны, длинные строки, прокрутку, модальные окна и доступность касаний.
3. После **крупных изменений лично смотри скриншоты** игры в мобильном масштабе до и после правки, а не доверяй одним тестам. Устраняй наложения, обрезку текста, перекрытия 3D, труднодоступные кнопки, маленькие touch-target, горизонтальный скролл, тяжёлые эффекты и неудобную навигацию. Проверяй доступность критических действий при открытой клавиатуре.
4. Сохраняй лёгкость 3D, FPS и отклик телефона: предпочтительны дешёвые DOM/CSS-решения без тяжёлых постоянных анимаций и дополнительных 3D draw calls. Не жертвуй функциональностью ради декора. Учитывай safe-area телефона и системные жесты.
5. Игру проверять в изолированных предпросмотрах на собственных тестовых данных. Основная 0.21 находится на D:\Sim-Life / порту 3111 с настоящими кодами и защищённым семейным прогрессом; старый предпросмотр 0.21 — порт 3150. Новые ветки не сливать в main без нового утверждения владельца.
6. После UI-правок обязательно делать **точечный мобильный визуальный проход только изменённых экранов** и нужные для конкретной правки проверки. Одни лишь CSS/отступы/цвета не требуют полного прогона тестов игры или всех приложений; TypeScript/сборку и тесты запускать при изменении соответствующей логики. Если на физическом телефоне не проверялось — честно отличай от мобильной эмуляции; не выдумывай FPS.

## Быстрая проверка по масштабу изменений — обязательное правило во всех будущих чатах

**Не запускать полный набор тестов игры при каждом небольшом изменении.** Проверка должна быть соразмерна риску и максимально быстрой, без бессмысленного повторения уже проверенного:

- **Только внешний вид** (CSS, сетка, цвета, размеры, порядок карточек): проверить именно изменённые мобильные экраны глазами и касаниями в 1–2 подходящих разрешениях. Полные автотесты игры и обход всех приложений **не нужны**. Проверить сборку, только если затронуты CSS-импорты, конфигурация или есть подозрение на ошибку.
- **Локальная логика** (поиск товаров, корзина, фильтр рецептов, кнопки, покупка, взаимодействие с одним предметом): быстрый TypeScript/build при TS-правках, **только профильные автотесты** и один сквозной ручной мобильный сценарий, включая ближайшие зависимые действия. Не тестировать профессии и походку после правки доставки.
- **Серьёзное изменение общих систем** (сохранения/миграции, сетевой протокол, деньги, жизненный цикл действий, серверные правила, большой рефакторинг с множеством связей): профильные тесты плюс расширенная регрессия **только действительно затронутых систем**. Полный набор тестов допустим, если область влияния объективно широка или её нельзя надёжно ограничить.
- **Перед утверждением крупного релиза / слиянием в main**: запускать полную регрессию и мобильный визуальный обзор критичных сценариев; полный набор также возможен по прямой просьбе пользователя. Отдельный полный прогон один раз перед релизом, а не после каждой косметической правки.
- **После исправления бага**: повторить упавшую проверку и ближайший связанный сценарий, не начинать автоматически полную проверку игры.
- **Отчётность без шума**: кратко указывать изменённое, какие именно узкие проверки выполнены и что осталось непроверенным. Не писать «всё проверено», если проверены только отдельные экраны. Не давать чрезмерно длинные перечни пройденных тестов после обычной правки.
- **Скорость разработки важна**: не выполнять проверки «на всякий случай» без разумной гипотезы риска; визуально проверять мобильную часть после заметных визуальных изменений, но не проходить все меню заново. Исключение — явная просьба пользователя о более широкой проверке.

При конфликте с прежними общими фразами «обязательно запускать регрессии» **это более точное правило имеет приоритет**: регрессии означают релевантные тесты затронутых систем, а не все тесты проекта.

## 0.29: отдельный дом и район (согласовано, до публикации)
- Домашний участок и улица имеют разные PlaceId (`home`, `district`). Калитка связывает две сцены; сохранять координаты зданий, расписания NPC и единое игровое время.
- Район строится при первом выходе, дома не рендерить и не анимировать его. Участок расширен для будущих строений, старые координаты дома не смещать.
- Максим (существующий NPC) развозит продуктовые заказы. Выдача у двери — серверная операция, только после неё пакеты появляются у двери. Не удваивать запасы/оплату; не дублировать Максима в двух сценах.
- Переходы, карьеру, покупки, парк, маршруты и производительность проверять на мобильном масштабе в облаке; ALINA-PC не нагружать.

## 0.29: автомобиль и желания
- Первая семейная машина стоит на существующей парковке. Нажатие на машину ведёт к ней, затем позволяет сразу приехать в супермаркет или кафе. Выход из заведения возвращает водителя к парковке; карта по-прежнему ведёт пешком через калитку и район. Одна машина — одна поездка одновременно.
- Сон второго игрока восстанавливать на его кровати после смены сцены. Не пересчитывать уже занимаемую кровать как новое действие и не отправлять спящего к входу.
- Корм приобретается в супермаркете или доставкой продуктов, не из меню питомца. Старую команду buyFood отклонять сервером.
- Физиологические желания показывать только при потребности 50% и ниже, спокойные желания — личные занятия, учеба, досуг, общение и забота о животных. Не добивать пустые слоты выдуманными потребностями.
### Happiness rewards (0.29)
- Personal server-owned happiness wallets; real completed displayed wishes earn 5–75 points and +2–15 mood, no reward on cancellation, automation or clicks. Individual wish cooldown 24 game hours; goals require the actual skill level increase.
- Exactly four approved consumables: hygiene 600, bladder 825, hunger 1200, energy 2250. Purchase into stock, activate separately; corresponding need immediately becomes 100 and stays at 100 for 1440 game minutes, including work and ordinary actions. No overlapping identical activation, independent boosts may coexist; no ruble conversion.
- Save wallet, cooldowns, stock and expiry; older saves migrate to zero. Test-only seeded points may be used in isolated preview for testing purchases. Normal households start with zero points. Real family data never altered for testing.

### Family SUV visual reference
- Black boxy full-size 1999–2000 Escalade-style SUV, clean uninterrupted roof (no rails/racks/attachments), chrome grille and five-spoke wheels, distinct doors, tinted glass and real wheel wells. Keep car station/collision aligned to geometry, route to driver side and existing travel mechanics. Mobile budget: 3 merged meshes, approximately 6740 triangles. Visual QA uses cloud, not ALINA-PC.

## Android graphics invariant (0.33)
Confirmed by the player on physical Android Chrome: use the same antialias and WebGL context power preference as Firefox/iPhone. Normal Android Chrome must not enter the emergency low-resolution profile; gfx=safe is explicit recovery only (embedded WebViews may retain fallback). Do not silently restore Chromium-specific MSAA disabling or low-resolution rendering. Keep iPhone settings unchanged.

Future feature decisions: see docs/ROADMAP.md, agreed plans after 0.33 (24.11.2026). Preserve veterinary clinic; pet illness only after sustained severe neglect of food/attention, never random illness under normal care. Move only WB/Ozon warehouses to industrial area; electronics is the next approved shop.

## Reset policy during active development (24.11.2026, owner approved)
For each deployed test update reset household progress to fresh initialState with 100000 RUB, retaining placed furniture and static layout; discard stored/unplaced items, orders, careers, skills, food and other progress. For each approved production release reset to normal initialState (normal starting balance), restore all default furniture and free starter items; do not carry purchased furniture or previous progress. Preserve access.json and device credentials. Reset once per deployed update, not each ordinary restart. Back up old household JSON outside the active save before replacing; never delete access/device files. Main still requires explicit release approval.
