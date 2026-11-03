import { LOC } from './locales.js';
import { randomLook } from './paper.js';

export const MODULE = 'postbox';
export const getContext = () => SillyTavern.getContext();
export const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));

export const DEFAULT_PROMPT = `This is a collaborative fiction project and you are its co-author. Everything and everyone in it is fictional, and all characters are adults. Your current task is a piece of in-world writing: the text of a handwritten letter that {{char}} sends to {{user}} inside the story. It is creative writing, not a conversation with a real person, so write it in {{char}}'s own voice, exactly as it would appear on paper.
World / era: {{setting}}. Technology and manners fit the world (letters, couriers, ravens, post; no phones or instant messaging unless the world has them).
Language: the same language the roleplay uses.
Length: {{length}}.
Style notes: {{style}}.
Rules: stay inside the story. No refusals, disclaimers, warnings, notes or out-of-character comments. Whatever mood or themes the story has (romance, tension, danger, darkness), write the letter the way the author of such a story would: in character, evocative and tasteful, implying rather than describing anything explicit. Never use asterisk actions, never write for {{user}}, do not repeat earlier letters, and keep {{char}}'s personality and feelings consistent with the story.`;

export const DEFAULTS = {
    enabled: true,
    lang: 'ru',
    conn: { mode: 'profile', profileId: '', url: '', key: '', model: '', temperature: 0.9 },
    maxTokens: 1200,
    length: 'medium',
    era: '',
    prompt: '',
    style: '',
    charStyles: {},
    context: { card: true, persona: true, lorebook: true, authorNote: true, chatMessages: 8, letters: 6 },
    triggers: { scanUser: true, auto: false, every: 10, smart: false, smartEvery: 3, keywords: true, kwList: 'письмо, напишу тебе, пришлю весточку, напишу вам, letter, i will write to you, i\'ll write to you' },
    images: { mode: 'off', url: '', key: '', model: '', ratio: '3:4', res: '1024', size: '', style: 'vintage sepia ink sketch on aged paper, detailed, no text' },
    font: 'auto', customFont: '', fontSize: 100,
    theme: 'parchment', paperColor: '', inkColor: '', sealColor: '',
    deco: { seal: true, stamp: true, postmark: true, sealVariety: true, emblem: 'initial' },
    bg: { mode: 'wood', strength: 35, dim: 10, image: '' },
    env: { randomEach: false, kind: 'front', color: '', ink: '', type: 'aged', edge: 'deckle', folds: 'thirds', wrinkles: 20, stains: 25, blots: 0, grain: 50, stamps: 2, stickers: true, ornament: 'corners', binding: 'ribbon', postmark: true, seal: true },
    custom: { seal: '', seals: [], sealSel: '', stamps: [], stampSel: [] },
    paper: { randomEach: false, style: 'aged', edge: 'deckle', folds: 'thirds', wrinkles: 30, stains: 30, blots: 15, grain: 55, tilt: true },
    recap: { mode: 'short', hide: false, invisible: true },
    notify: true,
};

export function fillDefaults(target, def) {
    for (const k of Object.keys(def)) {
        if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k])) {
            if (!target[k] || typeof target[k] !== 'object') target[k] = {};
            fillDefaults(target[k], def[k]);
        } else if (target[k] === undefined) target[k] = Array.isArray(def[k]) ? [...def[k]] : def[k];
    }
}

export function S() {
    const r = getContext().extensionSettings;
    if (!r[MODULE]) r[MODULE] = {};
    return r[MODULE];
}
export const saveSettings = () => getContext().saveSettingsDebounced();
export const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export function setPath(o, p, v) {
    const parts = p.split('.'); const last = parts.pop();
    parts.reduce((a, k) => a[k], o)[last] = v;
}
export function t(key) { const l = S().lang; return LOC[l]?.[key] ?? LOC.en[key] ?? key; }
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
export const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------ chat data (per chat, stored in chat metadata) */

export const pending = new Set();     // senders whose letter is being written
export const imgPending = new Set();  // letter ids whose picture is being drawn

export function data() {
    const md = getContext().chatMetadata;
    if (!md[MODULE]) md[MODULE] = { threads: {}, counter: 0 };
    return md[MODULE];
}
export async function saveData() {
    const ctx = getContext();
    try { await (ctx.saveMetadata ? ctx.saveMetadata() : ctx.saveChat()); } catch (e) { console.warn('[Postbox] save failed', e); }
}
export const hasChat = () => !!getContext().chatId;
export const getThread = sender => data().threads[sender];
export function ensureThread(sender) {
    const d = data();
    if (!d.threads[sender]) d.threads[sender] = { sender, letters: [], recapped: 0, last: Date.now() };
    return d.threads[sender];
}
export const unreadIn = th => th.letters.filter(l => l.dir === 'in' && !l.read).length;
export const unreadTotal = () => (hasChat() ? Object.values(data().threads).reduce((n, th) => n + unreadIn(th), 0) : 0);

export function candidates() {
    const ctx = getContext();
    if (ctx.groupId) {
        const g = ctx.groups?.find(x => String(x.id) === String(ctx.groupId));
        const names = (g?.members || []).map(av => ctx.characters.find(c => c.avatar === av)?.name).filter(Boolean);
        if (names.length) return names;
    }
    return ctx.name2 ? [ctx.name2] : [];
}

/* ------------------------------------------------ LLM */

const chatEndpoint = u => { u = String(u || '').trim().replace(/\/+$/, ''); return /\/chat\/completions$/i.test(u) ? u : u + '/chat/completions'; };
const baseUrl = u => String(u || '').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');

export async function callLLM(messages, maxTokens) {
    const c = S().conn;
    if (c.mode === 'profile') {
        const svc = getContext().ConnectionManagerRequestService;
        if (!svc) throw new Error(t('noCM'));
        if (!c.profileId) throw new Error(t('noProfile'));
        const r = await svc.sendRequest(c.profileId, messages, maxTokens, { stream: false, extractData: true, includePreset: true, includeInstruct: true }, { temperature: c.temperature });
        return String(r?.content ?? '');
    }
    if (!c.url || !c.model) throw new Error(t('noApi'));
    const headers = { 'Content-Type': 'application/json' };
    if (c.key) headers.Authorization = 'Bearer ' + c.key;
    const res = await fetch(chatEndpoint(c.url), {
        method: 'POST', headers, credentials: 'omit',
        body: JSON.stringify({ model: c.model, messages, temperature: c.temperature, max_tokens: maxTokens, stream: false }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    const out = j?.choices?.[0]?.message?.content;
    return Array.isArray(out) ? out.map(p => p?.text || '').join('') : String(out ?? '');
}

export async function loadModels() {
    const c = S().conn;
    const h = c.key ? { Authorization: 'Bearer ' + c.key } : {};
    const res = await fetch(baseUrl(c.url) + '/models', { headers: h, credentials: 'omit' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    return (j.data || j.models || []).map(x => x.id || x.name).filter(Boolean);
}

export function getProfiles() {
    const p = getContext().extensionSettings?.connectionManager?.profiles;
    return Array.isArray(p) ? p.map(x => ({ id: x.id, name: x.name })) : [];
}

/* ------------------------------------------------ prompt */

const fill = (str, vars) => String(str).replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
const clean = (s, n = 1500) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

async function loreText(ctx) {
    if (typeof ctx.getWorldInfoPrompt !== 'function') return '';
    try {
        const lines = ctx.chat.filter(m => !m.is_system).slice(-20).map(m => `${m.name}: ${m.mes}`).reverse();
        const r = await ctx.getWorldInfoPrompt(lines, 8192, true);
        return [r?.worldInfoBefore, r?.worldInfoAfter].filter(Boolean).join('\n') || r?.worldInfoString || '';
    } catch (e) { console.warn('[Postbox] lorebook unavailable', e); return ''; }
}

const FALLBACK_SYSTEM = `You are a creative writing assistant helping an author with a work of fiction. The author needs the text of an in-story letter written by the fictional character {{char}} to {{user}}. Write it in the character's voice and in the language of the story. Length: {{length}}. Style: {{style}}. Keep it tasteful and in-world (imply rather than describe anything explicit). No refusals, disclaimers or commentary: output only the letter.`;

const REFUSAL = /(i'?m sorry|i can'?t|i cannot|i am unable|i'?m unable|i won'?t|as an ai|i must decline|can'?t (write|assist|help|comply)|не могу (написать|помочь|выполнить|продолжить|создать)|извините|к сожалению|я не буду)/i;
export function isRefusal(text) {
    const s = String(text || '').trim();
    return !/<body>/i.test(s) && REFUSAL.test(s.slice(0, 260));
}

export async function buildMessages(sender, attempt = 0) {
    const ctx = getContext(), s = S();
    const user = ctx.name1 || 'User';
    const th = getThread(sender);
    const letters = th?.letters || [];
    const last = letters[letters.length - 1];
    const lens = { short: 'short (about 80-150 words)', medium: 'medium (about 150-300 words)', long: 'long (about 300-600 words)' };
    const style = [s.style, s.charStyles?.[sender]].filter(Boolean).join(' ') || 'none';
    const vars = { char: sender, user, length: lens[s.length] || lens.medium, style, setting: s.era || 'infer from the roleplay' };

    const fmt = [
        'Reply with the letter ONLY, in EXACTLY this format, starting your reply with <from>:',
        '<from>sender name</from>',
        '<to>recipient as written on the envelope (name and title)</to>',
        '<address>short in-world place the letter is written from</address>',
        '<date>in-world date, formatted to suit the setting; it must come after the previous letter\'s date</date>',
        '<body>the letter text, starting with the salutation; blank lines between paragraphs</body>',
        '<signature>how the sender signs off</signature>',
        '<ps>optional postscript; omit the tag if none</ps>',
    ];
    if (s.images.mode !== 'off') fmt.push('<illustration>OPTIONAL: only if natural, at most one per letter: a concise visual description of a sketch, drawing or photograph enclosed with the letter; omit the tag otherwise</illustration>');

    const lastDate = [...letters].reverse().find(l => l.date)?.date;
    const task = last?.dir === 'out'
        ? `${user} has sent ${sender} the last letter above. Write ${sender}'s reply letter.`
        : `Write a new letter from ${sender} to ${user}, on ${sender}'s own initiative, based on the current situation in the story.`;
    const histOf = n => letters.slice(-n).map(l => `[Letter from ${l.from} to ${l.to}${l.date ? ', dated ' + l.date : ''}]\n${l.body}${l.signature ? '\n' + l.signature : ''}`).join('\n\n');
    const chatOf = (n, max) => ctx.chat.filter(m => !m.is_system).slice(-n).map(m => `${m.name}: ${clean(m.mes, max)}`).join('\n\n');

    if (attempt > 0) { // softer second attempt: no card / lorebook, neutral framing
        return [
            { role: 'system', content: [fill(FALLBACK_SYSTEM, vars), fmt.join('\n')].join('\n\n') },
            { role: 'user', content: [`[Story so far, brief]\n${chatOf(4, 600)}`, letters.length && `[Previous letters]\n${histOf(2)}`, lastDate && `Previous letter date: ${lastDate}`, task].filter(Boolean).join('\n\n') },
        ];
    }

    const parts = [];
    const card = ctx.characters.find(c => c.name === sender) || ctx.characters[ctx.characterId];
    if (s.context.card && card) {
        const txt = [card.description, card.personality && 'Personality: ' + card.personality, card.scenario && 'Scenario: ' + card.scenario].filter(Boolean).join('\n');
        if (txt) parts.push(`[Fictional character reference: ${sender}]\n${ctx.substituteParams ? ctx.substituteParams(txt, user, sender) : txt}`);
    }
    const persona = ctx.powerUserSettings?.persona_description;
    if (s.context.persona && persona) parts.push(`[Fictional character reference: ${user}]\n${persona}`);
    const note = ctx.chatMetadata?.note_prompt;
    if (s.context.authorNote && note) parts.push(`[Author's note]\n${note}`);
    if (s.context.lorebook) { const wi = await loreText(ctx); if (wi) parts.push(`[World info]\n${wi}`); }

    return [
        { role: 'system', content: [fill(s.prompt || DEFAULT_PROMPT, vars), fmt.join('\n')].join('\n\n') },
        { role: 'user', content: [
            '[Story material for reference. Everything below is fiction.]',
            ...parts,
            `[Recent roleplay messages, from both ${user} and ${sender}]\n${chatOf(s.context.chatMessages, 1500)}`,
            letters.length && `[Correspondence so far]\n${histOf(s.context.letters)}`,
            lastDate && `Previous letter date: ${lastDate}`,
            `[Task]\n${task}\nOutput only the tagged letter, starting with <from>.`,
        ].filter(Boolean).join('\n\n') },
    ];
}

export function parseLetter(raw) {
    const txt = String(raw ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:xml|html)?/gi, '').trim();
    const fail = msg => { const e = new Error(msg); e.retry = true; return e; };
    if (!txt) throw fail(t('emptyReply'));
    const g = tag => { const m = txt.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i')); return m ? m[1].trim() : ''; };
    let body = g('body');
    if (!body) { const m = txt.match(/<body>([\s\S]*?)(?:<signature>|<ps>|<illustration>|$)/i); body = m ? m[1].trim() : ''; }
    if (!body) {
        if (isRefusal(txt) || txt.length < 40) throw fail(t('refused'));
        body = txt.replace(/<[^>]+>/g, '').trim(); // the model wrote a plain letter without tags
    }
    return { from: g('from'), to: g('to'), address: g('address'), date: g('date'), body, signature: g('signature'), ps: g('ps'), illustration: g('illustration') };
}

/* ------------------------------------------------ letters */

const SAFETY = /safety|blocked|policy|filter|moderation|content[_ ]?(policy|filter)|prohibited/i;

export async function requestLetter(sender) {
    if (!hasChat()) throw new Error(t('noChat'));
    if (pending.has(sender)) return;
    const chatRef = getContext().chat;
    pending.add(sender); emit('change');
    try {
        let p = null, lastErr = null;
        for (let attempt = 0; attempt < 2 && !p; attempt++) {
            try {
                const raw = await callLLM(await buildMessages(sender, attempt), S().maxTokens);
                p = parseLetter(raw);
            } catch (e) {
                lastErr = e;
                if (!e.retry && !SAFETY.test(String(e?.message))) throw e;
            }
        }
        if (!p) throw lastErr || new Error(t('refused'));
        if (getContext().chat !== chatRef) return;
        const th = ensureThread(sender);
        const letter = {
            id: uid(), dir: 'in', from: p.from || sender, to: p.to || getContext().name1, address: p.address, date: p.date,
            body: p.body, signature: p.signature, ps: p.ps, image: null, imagePrompt: p.illustration || '',
            stamp: Math.floor(Math.random() * 1e6), seed: Math.floor(Math.random() * 1e9), ts: Date.now(), read: false,
        };
        const look = randomLook(S());
        if (look.paper || look.env) letter.look = look;
        th.letters.push(letter); th.last = letter.ts;
        await saveData();
        emit('letter', { sender, letter });
        if (letter.imagePrompt && S().images.mode !== 'off') drawLetterImage(sender, letter.id);
    } finally {
        pending.delete(sender); emit('change');
    }
}

export async function sendReply(sender, text) {
    const th = ensureThread(sender);
    const ctx = getContext();
    th.letters.push({ id: uid(), dir: 'out', from: ctx.name1, to: sender, address: '', date: '', body: text, signature: '', ps: '', image: null, ts: Date.now(), read: true });
    th.last = Date.now();
    await saveData(); emit('change');
    await requestLetter(sender);
}

export async function regenerateLast(sender) {
    const th = getThread(sender);
    if (!th) return;
    const last = th.letters[th.letters.length - 1];
    if (last?.dir === 'in') { th.letters.pop(); await saveData(); emit('change'); await removeRecaps(sender, [last.id]); }
    await requestLetter(sender);
}

export async function deleteLetters(sender, ids) {
    const th = getThread(sender);
    if (!th) return;
    th.letters = th.letters.filter(l => !ids.has(l.id));
    if (!th.letters.length) delete data().threads[sender];
    await saveData(); emit('change');
    await removeRecaps(sender, [...ids]);
}

export async function deleteThreads(senders) {
    const gone = senders.map(s => [s, (data().threads[s]?.letters || []).map(l => l.id)]);
    senders.forEach(s => delete data().threads[s]);
    await saveData(); emit('change');
    for (const [s, ids] of gone) await removeRecaps(s, ids);
}

export async function markRead(sender) {
    const th = getThread(sender);
    if (!th) return;
    let changed = false;
    th.letters.forEach(l => { if (!l.read) { l.read = true; changed = true; } });
    if (changed) { await saveData(); emit('change'); }
}

/* ------------------------------------------------ images */

export async function uploadUserImage(file) {
    const b64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(file); });
    const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'png';
    return uploadImage(b64, ext);
}

async function uploadImage(b64, ext = 'png') {
    const ctx = getContext();
    const res = await fetch('/api/files/upload', { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify({ name: `postbox_${Date.now()}.${ext}`, data: b64 }) });
    if (!res.ok) throw new Error('upload HTTP ' + res.status);
    const j = await res.json();
    return '/' + String(j.path).replace(/^\/+/, '');
}

async function urlToBase64(url) {
    const blob = await (await fetch(url)).blob();
    return await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(blob); });
}

/** Size from the chosen aspect ratio and resolution (or the manual override, e.g. 1536x1024). */
export function imageSize() {
    const im = S().images;
    if (/^\d+x\d+$/i.test(String(im.size || '').trim())) return im.size.trim();
    const [a, b] = String(im.ratio || '1:1').split(':').map(Number);
    const k = (Number(im.res) || 1024) / Math.max(a, b);
    const r64 = v => Math.max(64, Math.round(v * k / 64) * 64);
    return `${r64(a)}x${r64(b)}`;
}

export async function makeImage(prompt) {
    const im = S().images, ctx = getContext();
    const full = `${prompt}. ${im.style}`.replace(/[|\n]/g, ' ');
    if (im.mode === 'st') {
        if (typeof ctx.executeSlashCommandsWithOptions !== 'function') throw new Error('Slash commands unavailable');
        const r = await ctx.executeSlashCommandsWithOptions(`/sd quiet=true ${full}`, { handleParserErrors: true, handleExecutionErrors: true });
        const p = String(r?.pipe || '').trim();
        if (!p) throw new Error('Image Generation returned nothing');
        return /^(https?:|\/)/.test(p) ? p : '/' + p;
    }
    if (!im.url || !im.model) throw new Error(t('noImgApi'));
    const headers = { 'Content-Type': 'application/json' };
    if (im.key) headers.Authorization = 'Bearer ' + im.key;
    const res = await fetch(baseUrl(im.url) + '/images/generations', { method: 'POST', headers, credentials: 'omit', body: JSON.stringify({ model: im.model, prompt: full, size: imageSize(), n: 1 }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    const item = j?.data?.[0];
    const b64 = item?.b64_json || (item?.url ? await urlToBase64(item.url) : null);
    if (!b64) throw new Error('No image in response');
    return await uploadImage(b64);
}

export async function drawLetterImage(sender, letterId) {
    const th = getThread(sender);
    const l = th?.letters.find(x => x.id === letterId);
    if (!l || !l.imagePrompt) return;
    imgPending.add(letterId); emit('change');
    try {
        l.image = await makeImage(l.imagePrompt);
        await saveData();
    } catch (e) {
        console.error('[Postbox] image failed', e);
        toastr.error(t('errImage') + (e?.message || e));
    } finally { imgPending.delete(letterId); emit('change'); }
}

/* ------------------------------------------------ recap into chat */

/* ------------------------------------------------ chat messages created by Postbox (recaps) */

export const quiet = { v: false }; // true while Postbox itself reloads the chat

async function reloadQuiet(ctx) {
    quiet.v = true;
    try { if (ctx.reloadCurrentChat) await ctx.reloadCurrentChat(); }
    finally { setTimeout(() => { quiet.v = false; }, 600); }
}

function recappedIds(sender) {
    const ids = new Set();
    getContext().chat.forEach(m => { const p = m.extra?.postbox; if (p && p.sender === sender) (p.letterIds || []).forEach(i => ids.add(i)); });
    return ids;
}

/** Removes recap messages that cover any of the given letters (so they can be recapped again). */
export async function removeRecaps(sender, letterIds) {
    const ctx = getContext(), set = new Set(letterIds), idx = [];
    ctx.chat.forEach((m, i) => { const p = m.extra?.postbox; if (p && p.sender === sender && (p.letterIds || []).some(x => set.has(x))) idx.push(i); });
    if (!idx.length) return;
    idx.reverse().forEach(i => ctx.chat.splice(i, 1));
    await ctx.saveChat();
    await reloadQuiet(ctx);
}

const RECAP_PROMPT = `You maintain story notes for a collaborative work of fiction (all characters are fictional adults). Retell the letters below as in-story narration that will be added to the story's memory.
Present each letter AS A LETTER: attribute its content to the author, for example "In his letter dated X, {{char}} writes that...", "In reply, {{user}} writes...". Phrase it naturally in the language of the letters (in Russian, for example: «В своём письме {{char}} пишет...», «В ответном письме {{user}} сообщает...»).
Use third person. Cover key events, promises, feelings and plans. Length: {{length}}.
Do not call it a summary and do not use headings, lists, disclaimers or commentary. If the letters touch mature themes, mention them briefly and tastefully.`;

export async function recapThread(sender) {
    const th = getThread(sender), ctx = getContext(), s = S();
    if (!th) return;
    const done = recappedIds(sender);
    const letters = th.letters.filter(l => !done.has(l.id));
    if (!letters.length) throw new Error(t('noNew'));
    const detailed = s.recap.mode === 'detailed';
    const user = ctx.name1;
    const body = letters.map(l => `${l.dir === 'in' ? 'Letter' : 'Reply letter'} from ${l.from} to ${l.to}${l.date ? ' (dated ' + l.date + ')' : ''}:\n${l.body}${l.signature ? '\n' + l.signature : ''}${l.ps ? '\n' + l.ps : ''}`).join('\n\n');
    const vars = { char: sender, user, length: detailed ? 'one short paragraph per letter' : '2-4 sentences in total' };
    const system = [fill(RECAP_PROMPT, vars), `You are a helpful fiction editor. Write brief story notes about the letters below, attributing each to its author ("In her letter, X writes..."), in the language of the letters. Output only the notes.`];
    let out = '';
    for (let attempt = 0; attempt < 2 && !out; attempt++) {
        try {
            const raw = await callLLM([{ role: 'system', content: system[attempt] }, { role: 'user', content: body }], detailed ? 900 : 400);
            const txt = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            if (txt && !isRefusal(txt)) out = txt;
        } catch (e) { if (attempt || !SAFETY.test(String(e?.message))) throw e; }
    }
    if (!out) throw new Error(t('refused'));
    const msg = {
        name: 'Postbox', is_user: false, is_system: false,
        send_date: ctx.humanizedDateTime ? ctx.humanizedDateTime() : new Date().toLocaleString(),
        mes: out,
        extra: { postbox: { recap: true, sender, letterIds: letters.map(l => l.id) } },
    };
    if (ctx.reloadCurrentChat) {
        // insert before the last message so the real last message keeps its swipe/regenerate controls
        ctx.chat.splice(Math.max(0, ctx.chat.length - 1), 0, msg);
        await ctx.saveChat();
        await reloadQuiet(ctx);
    } else {
        ctx.chat.push(msg);
        await ctx.addOneMessage(msg);
        await ctx.saveChat();
    }
}

/* ------------------------------------------------ extras */

export async function rerollLooks() {
    Object.values(data().threads).forEach(th => th.letters.forEach(l => {
        l.seed = Math.floor(Math.random() * 1e9); l.stamp = Math.floor(Math.random() * 1e6);
        const look = randomLook(S());
        if (look.paper || look.env) l.look = look; else delete l.look;
    }));
    await saveData(); emit('change');
}

/** Smart detector: asks the model whether a letter from `sender` would be natural right now. */
export async function detectLetter(sender) {
    const ctx = getContext();
    const recent = ctx.chat.filter(m => !m.is_system).slice(-4).map(m => `${m.name}: ${clean(m.mes, 700)}`).join('\n\n');
    const out = await callLLM([
        { role: 'system', content: `You decide whether ${sender} should send ${ctx.name1} a handwritten letter right now. Answer YES only if the latest messages say or clearly imply that ${sender} will write or send a letter or message by post, or if the characters are separated (distance, travel, captivity, war, etc.) so that a letter is natural at this moment. Otherwise answer NO. Reply with one word: YES or NO.` },
        { role: 'user', content: recent },
    ], 80);
    return /\byes\b/i.test(String(out).replace(/<think>[\s\S]*?<\/think>/gi, ''));
}
