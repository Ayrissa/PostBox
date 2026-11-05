# Postbox

**Русский** | [English below](#english)

Переписка с персонажем из чата в формате писем. Расширение открывается из меню-палочки (`✨ → Postbox`): на главном экране лежат запечатанные письма, внутри письма можно читать, отвечать и вести длинную переписку.

## Возможности
- Главный экран с письмами: сургучная печать, отправитель, адрес, дата, «кому». Непрочитанные запечатаны.
- Экран переписки: письма как листы бумаги, строка ответа с пером, ответ приходит в эту же переписку.
- Кнопки: перегенерировать последнее письмо, пересказать переписку в чат (коротко/подробно, можно скрыть текст), удалить (выбор нескольких писем).
- Письма пишет модель: адрес, дата, обращение и текст генерируются. Учитываются карточка, персона, лорбук, заметки автора, чат и прошлые письма.
- Персонаж пишет сам: по ключевым словам в его ответе, раз в N сообщений или по кнопке с пером. В группах письма приходят от разных персонажей.
- Картинки в письмах (по желанию): свой API или Image Generation Таверны.
- Оформление: 10 тем окна, шрифты (в т.ч. любой из Google Fonts), цвета бумаги/шрифта/печати.
- Реалистичная бумага: тип (гладкая, состаренная, грубая, мятая, случайная), неровные/рваные края, сгибы, помятость, пятна, кляксы, наклон. У каждого письма свой стабильный случайный вид.
- Конверты (отдельные настройки цвета, бумаги и украшений): лицевая сторона с марками, наклейками и адресом; обратная сторона с клапаном, печатью и рамкой; сложенный пергамент с лентой или бечёвкой (уже конвертов). Сургучные печати разных цветов с рисунком (буква, лилия, корона, звезда), ломаются при вскрытии.
- Фон окна: дерево, однотонный или своя картинка, с регулировкой яркости и затемнения. Можно загрузить свои печати и марки (PNG без фона): выбрать одну печать, выбрать какие марки выпадают и сколько их на конверте (0–4).
- Режим «каждый раз разные» для бумаги и конверта, кнопка случайных настроек конверта, соотношение сторон для картинок, выключатель расширения (в настройках окна и в панели расширений Таверны).
- Умный детектор: по желанию модель сама решает, уместно ли письмо. Ключевые слова и детектор проверяют и сообщения бота, и сообщения пользователя.
- Пересказ в чат подаётся как пересказ писем («В своём письме X пишет…»), сообщение Postbox в чате невидимо (модель его видит) и при перегенерации письма удаляется само.
- Устойчивый промпт: при отказе модели автоматически делается вторая, более мягкая попытка.
- Русский и английский, ПК и телефон.

## Приватность
Postbox **не читает ключи и API Таверны**. Для текста можно выбрать профиль Connection Manager (запрос выполняет сама Таверна) или собственный API в настройках расширения.

## Установка
`Extensions → Install extension`: `https://github.com/Ayrissa/Postbox`

---

## English

Letter-based correspondence with your chat characters. Open it from the wand menu (`✨ → Postbox`): sealed letters on the main screen, read, reply and keep a long correspondence.

### Features
- Inbox with wax-sealed letters (sender, address, date, recipient); unread ones are sealed.
- Thread view with paper sheets, a quill reply bar; the character answers in the same thread.
- Buttons: regenerate the last letter, recap to chat (short/detailed, optionally hidden), multi-select delete.
- Letters are written by the model (address, date, salutation, text) using the card, persona, lorebook, author's note, chat and earlier letters.
- Characters write on their own: on keywords, every N messages, or via the quill button. Group chats supported.
- Optional pictures: custom API or SillyTavern Image Generation.
- 10 window themes, fonts (incl. any Google Font), paper/ink/seal colors.
- Realistic paper: type (smooth, aged, rough, crumpled, random), uneven/torn edges, folds, wrinkles, stains, ink blots, tilt. Each letter gets its own stable random look.
- Envelopes (separate color, paper and decoration settings): front with stamps, stickers and address; back with flap, seal and frame; folded parchment with ribbon or twine (narrower than envelopes). Wax seals in different colors with emblems (letter, fleur-de-lis, crown, star), broken once opened.
- Window background: wood, plain or a custom image with brightness and darkening controls. You can upload your own seals and stamps (transparent PNG): pick one seal, choose which stamps appear and how many are on the envelope (0-4).
- "Different every time" mode for paper and envelope, a random-envelope button, aspect ratio for pictures, and an on/off switch (in the window settings and in SillyTavern's extensions panel).
- Optional smart detector: the model decides when a letter fits. Keywords and the detector check both bot and user messages.
- Recaps are told as letters ("In her letter, X writes..."), the Postbox chat message is invisible (the model still sees it) and is removed automatically when a letter is regenerated.
- Refusal-resistant prompt: if the model refuses, a second, softer attempt is made automatically.
- Russian and English, desktop and mobile.

### Privacy
Postbox **never reads SillyTavern's keys or APIs**. Use a Connection Manager profile (the request is made by SillyTavern itself) or Postbox's own API settings.

### Install
`Extensions → Install extension`: `https://github.com/Ayrissa/Postbox`

## License
MIT © Ayrissa
