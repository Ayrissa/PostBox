import { S, esc } from './core.js';
import { rng } from './paper.js';

const PALETTE = ['#8a3b32', '#2f5d50', '#33507a', '#7a5a2a', '#5a3a6a'];
const MOTIFS = [
    c => `<polygon points="20,12 23,21 33,21 25,27 28,37 20,31 12,37 15,27 7,21 17,21" fill="${c}"/>`,
    c => `<path d="M10 34V20l6 7 4-11 4 11 6-7v14z" fill="${c}"/><rect x="10" y="35" width="20" height="3" fill="${c}"/>`,
    c => `<g fill="${c}"><circle cx="20" cy="17" r="5"/><circle cx="26" cy="24" r="5"/><circle cx="14" cy="24" r="5"/><circle cx="23" cy="32" r="5"/><circle cx="17" cy="32" r="5"/></g><circle cx="20" cy="26" r="3" fill="#f3e6c4"/>`,
    c => `<path d="M10 38V22h4v3h4v-3h4v3h4v-3h4v16z" fill="${c}"/><rect x="17" y="30" width="6" height="8" fill="#f3e6c4"/>`,
];

export function stampSvg(seed = 0) {
    const c = PALETTE[seed % PALETTE.length];
    const m = MOTIFS[Math.floor(seed / 7) % MOTIFS.length](c);
    const val = [1, 2, 3, 5, 10][seed % 5];
    return `<svg class="pb-stamp" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<rect x="1.5" y="1.5" width="37" height="47" fill="#f3e6c4" stroke="${c}" stroke-width="3" stroke-dasharray="2 2.2"/>
<rect x="5" y="5" width="30" height="40" fill="none" stroke="${c}" stroke-width=".8"/>${m}
<text x="20" y="44" font-size="6" text-anchor="middle" fill="${c}" font-family="serif" font-weight="bold">${val}</text></svg>`;
}

export function postmarkSvg(address = '', date = '') {
    const a = esc(String(address).slice(0, 11).toUpperCase());
    const d = esc(String(date).slice(0, 11));
    return `<svg class="pb-pm" viewBox="0 0 92 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<g fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="22" cy="22" r="19"/><circle cx="22" cy="22" r="15"/><path d="M46 12h44M46 20h44M46 28h44M46 36h44"/></g>
<text x="22" y="20" text-anchor="middle" font-size="5.5" fill="currentColor" font-family="serif">${a}</text>
<text x="22" y="28" text-anchor="middle" font-size="5" fill="currentColor" font-family="serif">${d}</text></svg>`;
}

let sealCounter = 0;

const EMB = {
    fleur: `<g transform="translate(26 26.5) scale(.56)"><path d="M0 -24C8 -16 8 -4 0 7C-8 -4 -8 -16 0 -24Z"/>
<path d="M2 7C9 7 19 4 22 -4C23 -9 20 -13 16 -12C18 -8 15 -3 9 -1C6 0 3 2 2 7Z"/><path transform="scale(-1 1)" d="M2 7C9 7 19 4 22 -4C23 -9 20 -13 16 -12C18 -8 15 -3 9 -1C6 0 3 2 2 7Z"/>
<path d="M-10 10H10V14H-10Z"/><path d="M0 15C-4 18 -4 22 0 26C4 22 4 18 0 15Z"/></g>`,
    crown: '<g transform="translate(26 26) scale(.62)"><path d="M-18 12V-8l9 9 9-16 9 16 9-9V12z"/><rect x="-18" y="14" width="36" height="5" rx="1.5"/></g>',
    star: '<polygon transform="translate(26 26.5) scale(.62)" points="0,-20 5.9,-6.5 20.4,-6.2 8.9,2.9 13,16.8 0,8.7 -13,16.8 -8.9,2.9 -20.4,-6.2 -5.9,-6.5"/>',
};

function emblemGroup(kind, ch, fill, dy) {
    const inner = kind === 'initial'
        ? `<text x="26" y="32" text-anchor="middle" font-size="17" font-weight="700" font-family="Georgia,serif">${esc(ch)}</text>`
        : (EMB[kind] || '');
    return inner ? `<g transform="translate(0 ${dy})" style="fill:${fill}">${inner}</g>` : '';
}

export function sealSvg(initial, { seed = 1, color = null, emblem = 'initial' } = {}) {
    const r = rng(seed), id = 'pbs' + (++sealCounter);
    const R = 21, cx = 26, cy = 26;
    const a1 = r() * 6.28, a2 = r() * 6.28, a3 = r() * 6.28;
    const pts = Array.from({ length: 56 }, (_, i) => {
        const th = i / 56 * Math.PI * 2;
        const rad = R * (1 + 0.05 * Math.sin(5 * th + a1) + 0.035 * Math.sin(8 * th + a2) + 0.02 * Math.sin(13 * th + a3));
        return `${(cx + rad * Math.cos(th)).toFixed(2)},${(cy + rad * Math.sin(th)).toFixed(2)}`;
    }).join(' ');
    const drips = Array.from({ length: 2 }, () => {
        const th = r() * 6.28, d = R * (0.92 + r() * 0.1), k = 2.5 + r() * 2.5;
        return `<circle cx="${(cx + d * Math.cos(th)).toFixed(1)}" cy="${(cy + d * Math.sin(th)).toFixed(1)}" r="${k.toFixed(1)}"/>`;
    }).join('');
    const fill = color ? `fill:${color}` : 'fill:var(--s)';
    return `<svg viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs><radialGradient id="${id}h" cx=".33" cy=".28" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}s" cx=".62" cy=".72" r=".75"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient></defs>
<g style="${fill}">${drips}<polygon points="${pts}"/></g>
<polygon points="${pts}" fill="url(#${id}h)"/><polygon points="${pts}" fill="url(#${id}s)"/>
<circle cx="${cx}" cy="${cy}" r="${(R * 0.7).toFixed(1)}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="1.6"/>
<circle cx="${cx}" cy="${cy}" r="${(R * 0.7 - 1.4).toFixed(1)}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width=".8"/>
${emblemGroup(emblem, initial, 'rgba(255,255,255,.3)', 0.8)}${emblemGroup(emblem, initial, 'rgba(0,0,0,.4)', 0)}</svg>`;
}

/* ---- HTML helpers shared by letters and envelopes ---- */
const WAX = ['#8c1d22', '#6b1420', '#2f5d3a', '#254a7a', '#25252b', '#a8802a', '#5a2d6e'];
export const initial = n => (String(n || '?').trim().charAt(0).toUpperCase() || '?');

export function sealHtml(name, cls = '', broken = false, seed = 0) {
    const s = S();
    const color = (!s.sealColor && s.deco.sealVariety) ? WAX[hashStr(name) % WAX.length] : null;
    const img = s.custom?.sealSel;
    const one = () => (img ? `<img class="pb-seal-img" src="${esc(img)}" alt="">` : sealSvg(initial(name), { seed: seed || hashStr(name), color, emblem: s.deco.emblem || 'initial' }));
    return `<div class="pb-seal ${cls}${broken ? ' broken' : ''}">${broken ? `<span class="pb-half a">${one()}</span><span class="pb-half b">${one()}</span>` : one()}</div>`;
}

export function stampPool() {
    const c = S().custom || {};
    const all = c.stamps || [], sel = (c.stampSel || []).filter(x => all.includes(x));
    return sel.length ? sel : all;
}

export function stampFor(seed) {
    const list = stampPool();
    if (list.length) return `<img class="pb-stamp pb-stamp-img" src="${esc(list[Math.abs(seed) % list.length])}" alt="">`;
    return stampSvg(seed);
}

export function stickerSvg(date = '', seed = 0) {
    const r = rng(seed + 3);
    const d = esc(String(date).slice(0, 12)), num = 1 + Math.floor(r() * 30);
    return `<svg class="pb-sticker" viewBox="0 0 70 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<circle cx="35" cy="35" r="33" fill="#d9d5cb" stroke="#8d897f" stroke-width="1"/><circle cx="35" cy="35" r="29" fill="none" stroke="#6f6b62" stroke-width=".8"/>
<rect x="12" y="25" width="46" height="20" rx="2" fill="none" stroke="#5f5b52" stroke-width="1"/>
<text x="35" y="33" text-anchor="middle" font-size="6" fill="#4a463e" font-family="serif">${d}</text>
<text x="35" y="55" text-anchor="middle" font-size="12" font-weight="700" fill="#4a463e" font-family="serif">${num}</text></svg>`;
}

export function ticketSvg(seed = 0) {
    const r = rng(seed + 9), no = 10000 + Math.floor(r() * 89999);
    return `<svg class="pb-ticket" viewBox="0 0 90 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<rect x="1" y="1" width="88" height="48" fill="#e6dfc9" stroke="#9a927a" stroke-width="1"/>
<text x="6" y="14" font-size="8" font-weight="700" fill="#4a463e" font-family="monospace">${no} B</text>
<line x1="6" y1="19" x2="84" y2="19" stroke="#6f6b62" stroke-width=".8"/>
<text x="6" y="30" font-size="5.5" fill="#4a463e" font-family="monospace">TRANSPORT SERVICES</text>
<text x="6" y="42" font-size="5.5" fill="#4a463e" font-family="monospace">Nº ${Math.floor(r() * 99)}  ·  ${Math.floor(r() * 9) + 1} PM</text></svg>`;
}

const CORNER = `<svg class="pb-orn" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
<path d="M5 5C5 28 19 38 31 27C40 19 29 9 22 15C17 20 23 26 28 22"/><path d="M5 5C28 5 38 19 27 31C19 40 9 29 15 22C20 17 26 23 22 28"/>
<path d="M5 5L5 44M5 5L44 5" stroke-width="1.1"/></g><circle cx="5" cy="5" r="2.4" fill="currentColor"/></svg>`;
const FLEURON = '<svg class="pb-fleuron" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="currentColor"><path d="M12 2C16 6 16 11 12 15C8 11 8 6 12 2Z"/><path d="M11 14C7 11 3 10 2 14C1 18 6 19 9 17C7 17 6 15 7 14C8 13 10 13 11 14Z"/><path transform="translate(24 0) scale(-1 1)" d="M11 14C7 11 3 10 2 14C1 18 6 19 9 17C7 17 6 15 7 14C8 13 10 13 11 14Z"/><rect x="8" y="16" width="8" height="2" rx="1"/></g></svg>';

export function ornamentHtml(mode) {
    if (!mode || mode === 'none') return '';
    const corners = ['tl', 'tr', 'bl', 'br'].map(c => `<span class="pb-orn-w ${c}">${CORNER}</span>`).join('');
    if (mode === 'corners') return corners;
    const mids = ['t', 'b', 'l', 'r'].map(c => `<span class="pb-fl-w ${c}">${FLEURON}</span>`).join('');
    return `<div class="pb-frame"></div>${corners}${mids}`;
}

import { hashStr } from './paper.js';
