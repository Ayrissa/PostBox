import {
    S, DEFAULTS, DEFAULT_PROMPT, getContext, bus, t, esc, getPath, setPath, saveSettings, data, hasChat, getThread, unreadIn,
    pending, imgPending, candidates, getProfiles, loadModels, callLLM, requestLetter, sendReply, regenerateLast,
    deleteLetters, deleteThreads, markRead, recapThread, rerollLooks, uploadUserImage,
} from './core.js';
import { postmarkSvg, stampFor, sealHtml } from './deco.js';
import { envelopeHtml } from './envelope.js';
import { paperLook, seedOf, effPaper, randomEnvSettings } from './paper.js';

const ui = { previewSeed: Math.floor(Math.random() * 1e9), open: false, view: 'inbox', prev: 'inbox', sender: null, select: null, chooser: false, footerKey: '' };
let root, bodyEl, headEl, footEl;

const ic = n => `<i class="fa-solid fa-${n}"></i>`;
const btn = (act, icon, title, extra = '') => `<button class="pb-btn" data-act="${act}" title="${esc(title)}">${ic(icon)}${extra}</button>`;
const err = e => toastr.error(t('errGen') + (e?.message || e));

/* ------------------------------------------------ fonts & style */

const FONTS = {
    auto: { fam: "'Marck Script','Caveat',cursive", gf: ['Marck+Script'], style: 'normal' },
    italic: { fam: "'Cormorant Garamond','EB Garamond',Georgia,serif", gf: ['Cormorant+Garamond:ital,wght@1,500'], style: 'italic' },
    hand: { fam: "'Caveat','Marck Script',cursive", gf: ['Caveat:wght@500'], style: 'normal' },
    serif: { fam: "'EB Garamond',Georgia,serif", gf: ['EB+Garamond'], style: 'normal' },
    swirl: { fam: "'Great Vibes','Marck Script',cursive", gf: ['Great+Vibes', 'Marck+Script'], style: 'normal' },
};

export function applyStyle() {
    if (!root) return;
    const s = S();
    let f = FONTS[s.font];
    if (s.font === 'custom') {
        const name = String(s.customFont || '').replace(/[^A-Za-z0-9 ]/g, '').trim();
        f = name ? { fam: `'${name}','Marck Script',cursive`, gf: [name.replace(/ /g, '+')], style: 'normal' } : FONTS.auto;
    }
    f = f || FONTS.auto;
    let link = document.getElementById('pb_fonts');
    if (!link) { link = document.createElement('link'); link.id = 'pb_fonts'; link.rel = 'stylesheet'; document.head.appendChild(link); }
    const href = `https://fonts.googleapis.com/css2?${f.gf.map(x => 'family=' + x).join('&')}&display=swap`;
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
    root.dataset.theme = s.theme;
    root.dataset.bg = s.bg.mode;
    root.style.setProperty('--pb-tex', String((s.bg.strength || 0) / 100));
    root.style.setProperty('--pb-dim', String((s.bg.dim || 0) / 100 * 0.8));
    if (s.bg.image) root.style.setProperty('--pb-bg-image', `url("${s.bg.image}")`); else root.style.removeProperty('--pb-bg-image');
    root.style.setProperty('--pb-font', f.fam);
    root.style.setProperty('--pb-fstyle', f.style);
    root.style.setProperty('--pb-fs', String((s.fontSize || 100) / 100));
    for (const [k, v] of [['paper', s.paperColor], ['ink', s.inkColor], ['seal', s.sealColor]]) {
        if (v) root.style.setProperty(`--pb-${k}-o`, v); else root.style.removeProperty(`--pb-${k}-o`);
    }
}

/* ------------------------------------------------ render */

function headerHtml() {
    const v = ui.view, sel = ui.select;
    let left = '', title = '', right = '';
    if (v === 'inbox') {
        left = sel ? btn('cancelSel', 'chevron-left', t('cancel')) : '';
        title = `<span class="pb-title-text">${sel ? `${t('selected')}: ${sel.size}` : t('appName')}</span>`;
        right = sel ? btn('del', 'trash-can', t('delete')) : btn('request', 'feather-pointed', t('askLetter')) + btn('del', 'trash-can', t('delete')) + btn('settings', 'gear', t('settings'));
    } else if (v === 'thread') {
        left = sel ? btn('cancelSel', 'chevron-left', t('cancel')) : btn('back', 'chevron-left', t('back'));
        title = `${sealHtml(ui.sender, 'tiny')}<span class="pb-title-text">${sel ? `${t('selected')}: ${sel.size}` : esc(ui.sender)}</span>`;
        right = sel ? btn('del', 'trash-can', t('delete')) : btn('regen', 'arrows-rotate', t('regen')) + btn('recap', 'scroll', t('recap')) + btn('del', 'trash-can', t('delete')) + btn('settings', 'gear', t('settings'));
    } else {
        left = btn('back', 'chevron-left', t('back'));
        title = `<span class="pb-title-text">${t('settings')}</span>`;
    }
    return `<div class="pb-hl">${left}</div><div class="pb-title">${title}</div><div class="pb-hr">${right}${btn('close', 'xmark', t('close'))}</div>`;
}

function inboxHtml() {
    const threads = Object.values(data().threads).sort((a, b) => b.last - a.last);
    const wait = [...pending].filter(s => !data().threads[s]?.letters.length).map(s => `<div class="pb-env pb-wait"><div class="pb-env-body"><div class="pb-env-from">${esc(s)}</div><div class="pb-env-line">${t('waiting')}</div></div></div>`).join('');
    if (!threads.length && !wait) return `<div class="pb-empty">${ic('envelope-open-text')}<div>${t('empty')}</div><small>${t('emptyHint')}</small></div>`;
    return wait + threads.map(th => envelopeHtml(th, { selected: !!ui.select?.has(th.sender) })).join('');
}

function letterHtml(l, preview = false) {
    const s = S(), inc = l.dir === 'in', checked = !preview && ui.select?.has(l.id);
    const meta = [l.address, l.date].filter(Boolean).map(esc).join(' · ');
    const deco = inc ? `${s.deco.stamp ? stampFor(l.stamp || 0) : ''}${s.deco.postmark ? postmarkSvg(l.address, l.date) : ''}` : '';
    const pp = effPaper(l, s), look = paperLook(l, { paper: pp });
    let photo = '';
    if (l.image) photo = `<div class="pb-photo"><img src="${esc(l.image)}" alt="" loading="lazy"></div>`;
    else if (imgPending.has(l.id)) photo = `<div class="pb-photo pb-photo-wait">${ic('image')}<span>${t('drawing')}</span></div>`;
    const idAttr = preview ? '' : `data-id="${l.id}"`;
    return `<div class="pb-sheet ${inc ? 'in' : 'out'}${checked ? ' pb-sel' : ''}" ${idAttr} style="transform:rotate(${look.tilt.toFixed(2)}deg)">
<div class="pb-letter pb-paper" data-paper="${look.style}" style="${look.clip ? `clip-path:${look.clip};` : ''}filter:brightness(${look.bright.toFixed(3)});--grain:${pp.grain / 100}">
<div class="pb-tex" style="background-image:${look.tex}"></div><div class="pb-noise"></div>${look.blots}
<div class="pb-lcontent">
<div class="pb-lhead"><div class="pb-lmeta">${inc ? meta : esc(t('you'))}</div><div class="pb-ldeco">${deco}</div></div>
${inc && l.to ? `<div class="pb-lto">${esc(l.to)}</div>` : ''}
<div class="pb-lbody">${esc(l.body)}</div>
${photo}
${l.ps ? `<div class="pb-lps">${esc(l.ps)}</div>` : ''}
${l.signature ? `<div class="pb-lsign">${esc(l.signature)}</div>` : ''}
${inc && s.deco.seal ? `<div class="pb-lseal">${sealHtml(l.from, 'small', false, seedOf(l) + 5)}</div>` : ''}
</div>${checked ? '<span class="pb-check">' + ic('check') + '</span>' : ''}</div></div>`;
}

function threadHtml() {
    const th = getThread(ui.sender);
    const list = th ? th.letters.map(letterHtml).join('') : '';
    const wait = pending.has(ui.sender) ? `<div class="pb-sheet in"><div class="pb-letter pb-wait-letter">${ic('feather-pointed')}<span>${t('waiting')}</span></div></div>` : '';
    return (list || wait) ? list + wait : `<div class="pb-empty"><small>${t('threadEmpty')}</small></div>`;
}

function footerHtml() {
    if (ui.view !== 'thread') return '';
    return `<div class="pb-input"><textarea id="pb_input" rows="1" placeholder="${esc(t('replyPh'))}"></textarea><button class="pb-send" data-act="send" title="${esc(t('send'))}">${ic('feather-pointed')}</button></div>`;
}

function chooserHtml() {
    return `<div class="pb-modal"><div class="pb-modal-box"><div class="pb-modal-title">${t('chooseSender')}</div>${candidates().map(n => `<button class="pb-choice" data-act="pick" data-name="${esc(n)}">${sealHtml(n, 'tiny')}<span>${esc(n)}</span></button>`).join('')}<button class="pb-choice" data-act="closeChooser">${t('cancel')}</button></div></div>`;
}

export function render() {
    if (!ui.open || !root) return;
    headEl.innerHTML = headerHtml();
    const scroll = bodyEl.scrollTop;
    if (ui.view === 'settings') { /* settings is rendered once on entry */ }
    else {
        if (!hasChat()) bodyEl.innerHTML = `<div class="pb-empty"><div>${t('noChat')}</div></div>`;
        else bodyEl.innerHTML = (ui.view === 'inbox' ? inboxHtml() : threadHtml()) + (ui.chooser ? chooserHtml() : '');
        if (ui.view === 'thread') bodyEl.scrollTop = bodyEl.scrollHeight; else bodyEl.scrollTop = scroll;
    }
    const key = ui.view + '|' + ui.sender;
    if (key !== ui.footerKey) { footEl.innerHTML = footerHtml(); ui.footerKey = key; }
}

/* ------------------------------------------------ settings view */

function previewHtml() {
    const demo = { id: 'demo', dir: 'in', from: t('sampleFrom'), to: t('sampleTo'), address: t('sampleAddr'), date: t('sampleDate'), body: t('sampleBody'), signature: t('sampleSign'), ps: '', seed: ui.previewSeed, stamp: ui.previewSeed, read: true };
    const th = { sender: demo.from, letters: [demo], last: 0 };
    return `<div class="pb-prev-col">${envelopeHtml(th, { preview: true })}</div><div class="pb-prev-col">${letterHtml(demo, true)}</div>`;
}

function refreshPreview() {
    const el = bodyEl.querySelector('#pb_preview');
    if (el) el.innerHTML = previewHtml();
}

function settingsHtml() {
    const s = S(), g = k => getPath(s, k);
    const row = (label, inner) => `<label class="pb-row"><span>${label}</span>${inner}</label>`;
    const sel = (k, opts, rr = false) => `<select class="pb-in" data-k="${k}"${rr ? ' data-rr="1"' : ''}>${opts.map(([v, l]) => `<option value="${v}"${String(v) === String(g(k)) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    const chk = (k, label, rr = false) => `<label class="pb-chk"><input type="checkbox" class="pb-in" data-k="${k}"${rr ? ' data-rr="1"' : ''}${g(k) ? ' checked' : ''}><span>${label}</span></label>`;
    const inp = (k, type = 'text', extra = '') => `<input class="pb-in" type="${type}" data-k="${k}" value="${esc(g(k))}" ${extra}>`;
    const area = (k, rows, ph = '') => `<textarea class="pb-in" data-k="${k}" rows="${rows}" placeholder="${esc(ph)}">${esc(g(k))}</textarea>`;
    const colour = (k, label) => row(label, `<span class="pb-colorbox"><input type="color" class="pb-in" data-k="${k}" value="${esc(g(k) || '#888888')}"><button class="pb-mini" data-act="resetKey" data-k="${k}">${t('reset')}</button></span>`);
    const range = (k, label, a = 0, b = 100) => row(label, `<span class="pb-range"><input type="range" class="pb-in" data-k="${k}" min="${a}" max="${b}" value="${g(k)}"><span class="pb-val">${g(k)}%</span></span>`);
    const profiles = getProfiles();
    const c = s.conn;
    const typeOpts = [['clean', t('pClean')], ['aged', t('pAged')], ['rough', t('pRough')], ['crumpled', t('pCrumpled')], ['random', t('pRandom')]];
    const edgeOpts = [['straight', t('edgeStraight')], ['deckle', t('edgeDeckle')], ['torn', t('edgeTorn')]];
    const foldOpts = [['none', t('foldNone')], ['thirds', t('foldThirds')], ['cross', t('foldCross')]];

    const conn = c.mode === 'profile'
        ? (profiles.length ? row(t('profile'), sel('conn.profileId', [['', '—'], ...profiles.map(p => [p.id, esc(p.name)])])) : `<small class="pb-note">${t('noProfiles')}</small>`)
        : `${row(t('apiUrl'), inp('conn.url', 'text', 'placeholder="https://api.openai.com/v1" autocomplete="off"'))}
${row(t('apiKey'), inp('conn.key', 'password', 'autocomplete="new-password"'))}
${row(t('model'), inp('conn.model', 'text', 'list="pb_models" autocomplete="off"'))}<datalist id="pb_models"></datalist>
<div class="pb-btns"><button class="pb-mini" data-act="loadModels">${t('loadModels')}</button></div>`;

    const charStyles = candidates().map(n => `<label class="pb-col"><span>${t('charStyle')} ${esc(n)}</span><textarea class="pb-in" data-style-of="${esc(n)}" rows="2">${esc(s.charStyles?.[n] || '')}</textarea></label>`).join('');

    const images = s.images.mode === 'custom'
        ? `${row(t('apiUrl'), inp('images.url', 'text', 'placeholder="https://api.openai.com/v1"'))}${row(t('apiKey'), inp('images.key', 'password', 'autocomplete="new-password"'))}${row(t('model'), inp('images.model'))}${row(t('imgRatio'), sel('images.ratio', [['1:1', '1:1'], ['2:3', '2:3'], ['3:2', '3:2'], ['3:4', '3:4'], ['4:3', '4:3'], ['4:5', '4:5'], ['5:4', '5:4'], ['9:16', '9:16'], ['16:9', '16:9'], ['21:9', '21:9']]))}${row(t('imgRes'), sel('images.res', [['512', t('resSmall') + ' (512)'], ['768', t('resMedium') + ' (768)'], ['1024', t('resLarge') + ' (1024)'], ['1536', t('resXL') + ' (1536)']]))}${row(t('imgSizeOverride'), inp('images.size', 'text', 'placeholder="1536x1024"'))}<small class="pb-note">${t('imgSizeNote')}</small>` : '';

    const up = (label, target, has) => `<div class="pb-row"><span>${label}${has ? ` <i class="fa-solid fa-circle-check"></i>` : ''}</span><span class="pb-colorbox"><button class="pb-mini" data-act="pickFile" data-target="${target}">${t('upload')}</button><button class="pb-mini" data-act="clearFile" data-target="${target}">${t('clear')}</button></span></div>`;

    return `<div class="pb-settings">
<div class="pb-sec">${chk('enabled', t('enabledLabel'))}${row(t('language'), sel('lang', [['ru', 'Русский'], ['en', 'English']], true))}${chk('notify', t('notify'))}</div>

<div class="pb-sec"><h4>${t('secConn')}</h4>
${row(t('connMode'), sel('conn.mode', [['profile', t('connProfile')], ['custom', t('connCustom')]], true))}
${conn}
${row(t('temperature'), inp('conn.temperature', 'number', 'min="0" max="2" step="0.1"'))}
${row(t('maxTokens'), inp('maxTokens', 'number', 'min="200" max="8000" step="100"'))}
<div class="pb-btns"><button class="pb-mini" data-act="test">${t('test')}</button></div>
<small class="pb-note">${t('connNote')}</small></div>

<div class="pb-sec"><h4>${t('secWriting')}</h4>
${row(t('length'), sel('length', [['short', t('lenShort')], ['medium', t('lenMedium')], ['long', t('lenLong')]]))}
${row(t('era'), inp('era', 'text', `placeholder="${esc(t('eraPh'))}"`))}
<label class="pb-col"><span>${t('prompt')}</span><textarea class="pb-in" data-k="prompt" rows="7">${esc(s.prompt || DEFAULT_PROMPT)}</textarea></label>
<div class="pb-btns"><button class="pb-mini" data-act="resetPrompt">${t('promptReset')}</button></div>
<small class="pb-note">${t('promptNote')}</small>
<label class="pb-col"><span>${t('style')}</span>${area('style', 2, t('stylePh'))}</label>
${charStyles}</div>

<div class="pb-sec"><h4>${t('secContext')}</h4>
${chk('context.card', t('ctxCard'))}${chk('context.persona', t('ctxPersona'))}${chk('context.lorebook', t('ctxLore'))}${chk('context.authorNote', t('ctxNote'))}
${row(t('ctxMsgs'), inp('context.chatMessages', 'number', 'min="1" max="40"'))}
${row(t('ctxLetters'), inp('context.letters', 'number', 'min="1" max="30"'))}</div>

<div class="pb-sec"><h4>${t('secTriggers')}</h4>
${chk('triggers.auto', t('trAuto'))}${row(t('trEvery'), inp('triggers.every', 'number', 'min="1" max="200"'))}
${chk('triggers.keywords', t('trKw'))}
${chk('triggers.scanUser', t('scanUser'))}
${chk('triggers.smart', t('trSmart'))}${row(t('trSmartEvery'), inp('triggers.smartEvery', 'number', 'min="1" max="50"'))}
<small class="pb-note">${t('trSmartNote')}</small>
<label class="pb-col"><span>${t('trKwList')}</span>${area('triggers.kwList', 2)}</label>
<small class="pb-note">${t('trNote')}</small></div>

<div class="pb-sec"><h4>${t('secImages')}</h4>
${row(t('imgMode'), sel('images.mode', [['off', t('imgOff')], ['custom', t('imgCustom')], ['st', t('imgSt')]], true))}
${images}
${s.images.mode !== 'off' ? `<label class="pb-col"><span>${t('imgStyle')}</span>${area('images.style', 2)}</label>` : ''}</div>

<div class="pb-sec pb-prev-sec"><h4>${t('previewLabel')}</h4><div id="pb_preview" class="pb-prev">${previewHtml()}</div></div>

<div class="pb-sec"><h4>${t('secLook')}</h4>
${row(t('theme'), sel('theme', [['parchment', t('themeParchment')], ['midnight', t('themeMidnight')], ['forest', t('themeForest')], ['rose', t('themeRose')], ['light', t('themeLight')], ['dusk', t('themeDusk')], ['ocean', t('themeOcean')], ['burgundy', t('themeBurgundy')], ['noir', t('themeNoir')], ['snow', t('themeSnow')]]))}
${row(t('bgMode'), sel('bg.mode', [['wood', t('bgWood')], ['plain', t('bgPlain')], ['image', t('bgImage')]], true))}
${s.bg.mode === 'wood' ? range('bg.strength', t('bgStrength')) : ''}
${s.bg.mode === 'image' ? up(t('bgUpload'), 'bg', !!s.bg.image) : ''}
${s.bg.mode !== 'plain' ? range('bg.dim', t('bgDim')) : ''}
${row(t('font'), sel('font', [['auto', t('fontAuto')], ['italic', t('fontItalic')], ['hand', t('fontHand')], ['serif', t('fontSerif')], ['swirl', t('fontSwirl')], ['custom', t('fontCustom')]], true))}
${s.font === 'custom' ? row(t('customFont'), inp('customFont', 'text', 'placeholder="Pacifico"')) : ''}
${range('fontSize', t('fontSize'), 70, 150)}</div>

<div class="pb-sec"><h4>${t('secLetterPaper')}</h4>
${colour('paperColor', t('paperColor'))}${colour('inkColor', t('inkColor'))}
${row(t('paperStyle'), sel('paper.style', typeOpts))}${row(t('edge'), sel('paper.edge', edgeOpts))}${row(t('folds'), sel('paper.folds', foldOpts))}
${range('paper.wrinkles', t('wrinkles'))}${range('paper.stains', t('stains'))}${range('paper.blots', t('blots'))}${range('paper.grain', t('grain'))}
${chk('paper.tilt', t('tilt'))}
${chk('paper.randomEach', t('randomEach'))}
${chk('deco.stamp', t('decoStamp'))}${chk('deco.postmark', t('decoPostmark'))}${chk('deco.seal', t('decoSeal'))}
<div class="pb-btns"><button class="pb-mini" data-act="randomPaper">${ic('dice')} ${t('randomPaper')}</button><button class="pb-mini" data-act="reroll">${ic('shuffle')} ${t('reroll')}</button></div></div>

<div class="pb-sec"><h4>${t('secEnv')}</h4>
${row(t('envKind'), sel('env.kind', [['front', t('envFront')], ['back', t('envBack')], ['packet', t('envPacket')]], true))}
${colour('env.color', t('envColor'))}${colour('env.ink', t('envInk'))}
${row(t('paperStyle'), sel('env.type', typeOpts))}${row(t('edge'), sel('env.edge', edgeOpts))}${row(t('folds'), sel('env.folds', foldOpts))}
${range('env.wrinkles', t('wrinkles'))}${range('env.stains', t('stains'))}${range('env.grain', t('grain'))}
${row(t('ornament'), sel('env.ornament', [['none', t('orNone')], ['corners', t('orCorners')], ['frame', t('orFrame')]]))}
${s.env.kind === 'packet' ? row(t('binding'), sel('env.binding', [['ribbon', t('bindRibbon')], ['twine', t('bindTwine')], ['none', t('bindNone')]])) : ''}
${s.env.kind === 'front' ? chk('env.stickers', t('stickers')) : ''}
${s.env.kind !== 'back' ? chk('env.postmark', t('envPostmark')) : ''}
${chk('env.seal', t('envSeal'))}
${chk('env.randomEach', t('randomEach'))}
<div class="pb-btns"><button class="pb-mini" data-act="randomEnv">${ic('dice')} ${t('randomEnv')}</button></div>
<small class="pb-note">${t('envNote')}</small></div>

<div class="pb-sec"><h4>${t('secSeals')}</h4>
${row(t('emblem'), sel('deco.emblem', [['initial', t('emInitial')], ['fleur', t('emFleur')], ['crown', t('emCrown')], ['star', t('emStar')], ['none', t('emNone')]]))}
${chk('deco.sealVariety', t('sealVariety'))}
${colour('sealColor', t('sealColor'))}
<div class="pb-row"><span>${t('customSeal')}</span><button class="pb-mini" data-act="pickFile" data-target="seal">${t('upload')}</button></div>
<div class="pb-tiles"><div class="pb-tile gen${s.custom.sealSel ? '' : ' on'}" data-act="selSeal" data-i="-1" title="${esc(t('sealGenerated'))}">${ic('stamp')}</div>${s.custom.seals.map((u, i) => `<div class="pb-tile${s.custom.sealSel === u ? ' on' : ''}" data-act="selSeal" data-i="${i}"><img src="${esc(u)}" alt=""><span class="pb-x" data-act="delSeal" data-i="${i}">${ic('xmark')}</span></div>`).join('')}</div>
<div class="pb-row"><span>${t('customStamps')}</span><button class="pb-mini" data-act="pickFile" data-target="stamp">${t('upload')}</button></div>
${s.custom.stamps.length ? `<div class="pb-tiles">${s.custom.stamps.map((u, i) => `<div class="pb-tile${(s.custom.stampSel || []).includes(u) ? ' on' : ''}" data-act="toggleStamp" data-i="${i}"><img src="${esc(u)}" alt=""><span class="pb-x" data-act="delStamp" data-i="${i}">${ic('xmark')}</span></div>`).join('')}</div><small class="pb-note">${t('stampsPickNote')}</small>` : ''}
${row(t('stampsCount'), sel('env.stamps', [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4']]))}
</div>

<div class="pb-sec"><h4>${t('secRecap')}</h4>
${row(t('recapMode'), sel('recap.mode', [['short', t('recapShort')], ['detailed', t('recapDetailed')]]))}
${chk('recap.invisible', t('recapInvisible'))}</div>
</div>`;
}

function showSettings(keepScroll = false) {
    const sc = bodyEl.scrollTop;
    bodyEl.innerHTML = settingsHtml();
    bodyEl.scrollTop = keepScroll ? sc : 0;
}

/* ------------------------------------------------ navigation */

export function openWindow(view = 'inbox', sender = null) {
    if (!root) return;
    ui.open = true; ui.select = null; ui.chooser = false;
    ui.view = view; ui.sender = sender; ui.footerKey = '';
    root.hidden = false;
    applyStyle();
    if (view === 'thread' && sender) markRead(sender);
    render();
}

export function closeWindow() { ui.open = false; ui.select = null; if (root) root.hidden = true; }
export const isOpen = () => ui.open;
export const viewing = () => (ui.open && ui.view === 'thread' ? ui.sender : null);

async function requestFrom(name) {
    ui.chooser = false; render();
    try { await requestLetter(name); } catch (e) { err(e); }
}

async function onAction(act, el) {
    const ctx = getContext();
    switch (act) {
        case 'close': closeWindow(); break;
        case 'back':
            if (ui.view === 'settings') { ui.view = ui.prev; ui.footerKey = ''; render(); }
            else { ui.view = 'inbox'; ui.sender = null; ui.footerKey = ''; render(); }
            break;
        case 'settings': ui.prev = ui.view; ui.view = 'settings'; ui.select = null; headEl.innerHTML = headerHtml(); footEl.innerHTML = ''; ui.footerKey = ''; showSettings(); break;
        case 'cancelSel': ui.select = null; render(); break;
        case 'request': {
            if (!hasChat()) return toastr.warning(t('noChat'));
            const c = candidates();
            if (!c.length) return toastr.warning(t('noChat'));
            if (c.length === 1) requestFrom(c[0]); else { ui.chooser = true; render(); }
            break;
        }
        case 'pick': requestFrom(el.dataset.name); break;
        case 'closeChooser': ui.chooser = false; render(); break;
        case 'regen': regenerateLast(ui.sender).catch(err); break;
        case 'recap':
            try { toastr.info('…'); await recapThread(ui.sender); toastr.success(t('recapDone')); } catch (e) { err(e); }
            break;
        case 'del':
            if (!ui.select) { ui.select = new Set(); render(); break; }
            if (!ui.select.size) { ui.select = null; render(); break; }
            if (!confirm(t('confirmDel'))) break;
            {
                const ids = ui.select; ui.select = null;
                if (ui.view === 'inbox') await deleteThreads([...ids]);
                else { await deleteLetters(ui.sender, ids); if (!getThread(ui.sender)) { ui.view = 'inbox'; ui.sender = null; ui.footerKey = ''; } }
                render();
            }
            break;
        case 'send': {
            const ta = document.getElementById('pb_input');
            const text = ta?.value.trim();
            if (!text) break;
            ta.value = ''; ta.style.height = '';
            sendReply(ui.sender, text).catch(err);
            break;
        }
        case 'randomPaper': {
            const p = S().paper, rnd = (a, b) => Math.round(a + Math.random() * (b - a)), pick = arr => arr[rnd(0, arr.length - 1)];
            p.style = pick(['clean', 'aged', 'rough', 'crumpled', 'random']); p.edge = pick(['straight', 'deckle', 'torn']); p.folds = pick(['none', 'thirds', 'cross']);
            p.wrinkles = rnd(10, 75); p.stains = rnd(5, 70); p.blots = rnd(0, 50); p.grain = rnd(30, 85);
            saveSettings(); showSettings(true); break;
        }
        case 'reroll': ui.previewSeed = Math.floor(Math.random() * 1e9); await rerollLooks(); refreshPreview(); break;
        case 'pickFile': ui.fileTarget = el.dataset.target; document.getElementById('pb_file').click(); break;
        case 'selSeal': { const c = S().custom, i = Number(el.dataset.i); c.sealSel = i < 0 ? '' : c.seals[i] || ''; saveSettings(); showSettings(true); refreshPreview(); render(); break; }
        case 'delSeal': { const c = S().custom, i = Number(el.dataset.i), u = c.seals[i]; c.seals.splice(i, 1); if (c.sealSel === u) c.sealSel = ''; saveSettings(); showSettings(true); refreshPreview(); render(); break; }
        case 'toggleStamp': { const c = S().custom, u = c.stamps[Number(el.dataset.i)]; c.stampSel = c.stampSel.includes(u) ? c.stampSel.filter(x => x !== u) : [...c.stampSel, u]; saveSettings(); showSettings(true); refreshPreview(); render(); break; }
        case 'delStamp': { const c = S().custom, i = Number(el.dataset.i), u = c.stamps[i]; c.stamps.splice(i, 1); c.stampSel = c.stampSel.filter(x => x !== u); saveSettings(); showSettings(true); refreshPreview(); render(); break; }
        case 'randomEnv': Object.assign(S().env, randomEnvSettings()); saveSettings(); showSettings(true); refreshPreview(); render(); break;
        case 'clearFile': {
            const tg = el.dataset.target, st = S();
            if (tg === 'bg') st.bg.image = '';
            saveSettings(); applyStyle(); showSettings(true); refreshPreview(); render(); break;
        }
        case 'resetKey': setPath(S(), el.dataset.k, ''); saveSettings(); applyStyle(); showSettings(true); break;
        case 'resetPrompt': S().prompt = ''; saveSettings(); showSettings(true); break;
        case 'loadModels':
            try { const m = await loadModels(); document.getElementById('pb_models').innerHTML = m.map(x => `<option value="${esc(x)}"></option>`).join(''); toastr.success(t('modelsLoaded') + m.length); } catch (e) { err(e); }
            break;
        case 'test':
            try { await callLLM([{ role: 'user', content: 'Reply with: OK' }], 200); toastr.success(t('okTest')); } catch (e) { err(e); }
            break;
    }
}

/* ------------------------------------------------ init */

export function initUi() {
    root = document.createElement('div');
    root.id = 'pb_overlay'; root.className = 'pb-overlay'; root.hidden = true;
    root.innerHTML = '<div class="pb-window"><div class="pb-header" id="pb_head"></div><div class="pb-body" id="pb_body"></div><div class="pb-footer" id="pb_foot"></div></div>';
    document.body.appendChild(root);
    root.insertAdjacentHTML('beforeend', '<input type="file" id="pb_file" accept="image/*" hidden>');
    headEl = root.querySelector('#pb_head'); bodyEl = root.querySelector('#pb_body'); footEl = root.querySelector('#pb_foot');

    root.addEventListener('click', e => {
        if (e.target === root) return closeWindow();
        const actEl = e.target.closest('[data-act]');
        if (actEl) return onAction(actEl.dataset.act, actEl);
        if (ui.view === 'inbox') {
            const env = e.target.closest('.pb-env[data-sender]');
            if (!env) return;
            const sender = env.dataset.sender;
            if (ui.select) { ui.select.has(sender) ? ui.select.delete(sender) : ui.select.add(sender); render(); }
            else openWindow('thread', sender);
        } else if (ui.view === 'thread' && ui.select) {
            const sheet = e.target.closest('.pb-sheet[data-id]');
            if (sheet) { const id = sheet.dataset.id; ui.select.has(id) ? ui.select.delete(id) : ui.select.add(id); render(); }
        }
    });

    root.addEventListener('input', e => {
        const el = e.target;
        if (el.id === 'pb_input') { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; return; }
        if (el.dataset.styleOf) { const s = S(); s.charStyles = s.charStyles || {}; s.charStyles[el.dataset.styleOf] = el.value; saveSettings(); return; }
        const k = el.dataset.k;
        if (!k || !el.classList.contains('pb-in')) return;
        let v;
        if (el.type === 'checkbox') v = el.checked;
        else if (el.type === 'number' || el.type === 'range') { v = Number(el.value); if (!Number.isFinite(v)) return; }
        else v = el.value;
        if (k === 'prompt' && v.trim() === DEFAULT_PROMPT.trim()) v = '';
        if (getPath(S(), k) === v) return;
        setPath(S(), k, v); saveSettings();
        if (el.type === 'range') el.parentElement.querySelector('.pb-val').textContent = v + '%';
        applyStyle();
        if (ui.view === 'settings') refreshPreview();
        if (k === 'lang') { headEl.innerHTML = headerHtml(); bus.dispatchEvent(new Event('lang')); }
        if (k === 'enabled') bus.dispatchEvent(new Event('enabled'));
        if (k === 'recap.invisible') bus.dispatchEvent(new Event('recapview'));
        if (el.dataset.rr) showSettings(true);
    });
    root.addEventListener('change', e => { if (e.target.classList?.contains('pb-in')) e.target.dispatchEvent(new Event('input', { bubbles: true })); });

    root.querySelector('#pb_file').addEventListener('change', async e => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        try {
            const path = await uploadUserImage(f), st = S(), tg = ui.fileTarget;
            if (tg === 'bg') st.bg.image = path;
            else if (tg === 'seal') { st.custom.seals = [...st.custom.seals, path]; st.custom.sealSel = path; }
            else st.custom.stamps = [...st.custom.stamps, path];
            saveSettings(); applyStyle(); showSettings(true); refreshPreview(); render();
        } catch (err2) { toastr.error(t('errUpload') + (err2?.message || err2)); }
    });
    root.addEventListener('keydown', e => {
        if (e.target.id === 'pb_input' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onAction('send'); }
        if (e.key === 'Escape') closeWindow();
    });

    bus.addEventListener('change', () => { if (ui.open && ui.view !== 'settings') render(); });
    applyStyle();
}

export function onChatChanged() {
    ui.select = null; ui.chooser = false;
    if (ui.open) { ui.view = 'inbox'; ui.sender = null; ui.footerKey = ''; render(); }
}
