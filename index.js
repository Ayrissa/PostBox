/**
 * Postbox — correspondence by letters with your SillyTavern characters.
 * Author: Ayrissa. License: MIT.
 *
 * Privacy: Postbox never reads SillyTavern's API keys or secrets. Writing goes either through
 * a Connection Manager profile (handled entirely by SillyTavern) or through Postbox's own API settings.
 */
import { S, DEFAULTS, fillDefaults, getContext, bus, t, data, hasChat, getThread, unreadTotal, unreadIn, requestLetter, pending, markRead, detectLetter, candidates, quiet } from './core.js';
import { initUi, openWindow, closeWindow, onChatChanged, applyStyle, viewing, isOpen } from './ui.js';

function updateBadge() {
    const n = S().enabled ? unreadTotal() : 0;
    $('#extensionsMenuButton').toggleClass('pb-has-mail', n > 0);
    $('#pb_menu_item .pb-count').text(n > 0 ? n : '').toggle(n > 0);
}

function applyEnabled() {
    const on = !!S().enabled;
    $('#pb_menu_item').toggle(on);
    $('#pb_enabled').prop('checked', on);
    updateBadge();
}

function addDrawer() {
    if ($('#pb_drawer').length) return;
    $('#extensions_settings2').append(`<div id="pb_drawer" class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>Postbox</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
<div class="inline-drawer-content"><label class="checkbox_label"><input type="checkbox" id="pb_enabled"><span id="pb_enabled_label">${t('enabledLabel')}</span></label><div id="pb_open" class="menu_button">${t('openBtn')}</div></div></div>`);
    $(document).on('change', '#pb_enabled', function () {
        S().enabled = this.checked; getContext().saveSettingsDebounced();
        if (!this.checked) closeWindow();
        bus.dispatchEvent(new Event('enabled'));
    });
    $(document).on('click', '#pb_open', () => { if (S().enabled) openWindow('inbox'); });
}

function addMenuItem() {
    if ($('#pb_menu_item').length) return;
    $('#extensionsMenu').append(`<div id="pb_menu_item" class="list-group-item flex-container flexGap5 interactable" tabindex="0">
<div class="fa-solid fa-envelope extensionsMenuExtensionButton"></div><span id="pb_menu_label">${t('menuItem')}</span><span class="pb-count" style="display:none"></span></div>`);
    $(document).on('click', '#pb_menu_item', () => { $('#extensionsMenu').hide?.(); openWindow('inbox'); });
}

const keywordRegex = () => {
    const list = String(S().triggers.kwList || '').split(',').map(x => x.trim()).filter(Boolean);
    if (!list.length) return null;
    return new RegExp(list.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
};

function fireLetter(sender) {
    const th = getThread(sender);
    if (pending.has(sender) || (th && unreadIn(th) > 0)) return; // don't pile up unread letters
    data().counter = 0;
    requestLetter(sender).catch(e => toastr.error(t('errGen') + (e?.message || e)));
}

/** Which character should write, when the trigger was a user's message. */
function pickSender(text) {
    const c = candidates();
    if (!c.length) return null;
    if (c.length === 1) return c[0];
    const low = String(text).toLowerCase();
    const named = c.find(n => low.includes(n.toLowerCase()));
    if (named) return named;
    const chat = getContext().chat;
    for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (!m.is_user && !m.is_system && !m.extra?.postbox && c.includes(m.name)) return m.name;
    }
    return c[0];
}

function onAnyMessage(id) {
    const ctx = getContext(), m = ctx.chat[id], s = S();
    if (!s.enabled || !m || m.is_system || m.extra?.postbox || !hasChat()) return;
    const fromUser = !!m.is_user;
    if (fromUser && !s.triggers.scanUser) return;
    const sender = fromUser ? pickSender(m.mes) : m.name;
    if (!sender) return;
    const d = data();
    if (!fromUser) d.counter = (d.counter || 0) + 1;
    if (s.triggers.keywords) {
        const rx = keywordRegex();
        if (rx && rx.test(String(m.mes).replace(/<[^>]*>/g, ' '))) return fireLetter(sender);
    }
    if (!fromUser && s.triggers.auto && d.counter >= s.triggers.every) return fireLetter(sender);
    if (s.triggers.smart) {
        d.smart = (d.smart || 0) + 1;
        if (d.smart >= s.triggers.smartEvery) {
            d.smart = 0;
            const th = getThread(sender);
            if (pending.has(sender) || (th && unreadIn(th) > 0)) return;
            detectLetter(sender).then(yes => { if (yes) fireLetter(sender); }).catch(e => console.warn('[Postbox] detector failed', e));
        }
    }
}

/** Recap messages made by Postbox stay in the chat (the model sees them) but are not shown. */
function hideRecaps() {
    const hide = S().enabled && S().recap.invisible;
    const chat = getContext().chat;
    $('#chat .mes').each(function () {
        const m = chat[Number(this.getAttribute('mesid'))];
        $(this).toggleClass('pb-hidden-mes', !!(hide && m?.extra?.postbox));
    });
}
let hideTimer = null;
const hideSoon = (ms = 80) => { clearTimeout(hideTimer); hideTimer = setTimeout(hideRecaps, ms); };

jQuery(() => {
    const st = S();
    if (st.envStyle && !st.env) st.env = { kind: st.envStyle, stamps: st.deco?.stamps ?? 2 }; // migrate from 0.2.0
    if (st.images && st.images.size === '1024x1024' && !st.images.ratio) st.images.size = ''; // size is now chosen by ratio
    fillDefaults(st, DEFAULTS);
    if (st.custom.seal) { if (!st.custom.seals.length) { st.custom.seals = [st.custom.seal]; st.custom.sealSel = st.custom.seal; } st.custom.seal = ''; } // migrate single seal
    initUi();
    applyStyle();
    addMenuItem();
    addDrawer();
    applyEnabled();

    const ctx = getContext();
    const ET = ctx.eventTypes || ctx.event_types;
    ctx.eventSource.on(ET.MESSAGE_RECEIVED, onAnyMessage);
    if (ET.MESSAGE_SENT) ctx.eventSource.on(ET.MESSAGE_SENT, onAnyMessage);
    ctx.eventSource.on(ET.CHAT_CHANGED, () => { if (!quiet.v) onChatChanged(); updateBadge(); hideSoon(300); setTimeout(hideRecaps, 1000); });
    ctx.eventSource.on(ET.CHARACTER_MESSAGE_RENDERED, () => hideSoon());
    const chatEl = document.getElementById('chat');
    if (chatEl) new MutationObserver(() => hideSoon(60)).observe(chatEl, { childList: true });
    bus.addEventListener('enabled', () => hideSoon(0));
    bus.addEventListener('recapview', () => hideSoon(0));
    hideSoon(500);

    bus.addEventListener('change', updateBadge);
    bus.addEventListener('lang', () => { $('#pb_menu_label').text(t('menuItem')); $('#pb_enabled_label').text(t('enabledLabel')); $('#pb_open').text(t('openBtn')); });
    bus.addEventListener('enabled', () => { if (!S().enabled) closeWindow(); applyEnabled(); });
    bus.addEventListener('letter', e => {
        const { sender, letter } = e.detail;
        if (!S().enabled) return;
        if (viewing() === sender) { markRead(sender); return; }
        if (S().notify) {
            toastr.info(`${t('newLetter')} ${letter.from}`, 'Postbox', { timeOut: 8000, onclick: () => openWindow('thread', sender) });
        }
    });
});
