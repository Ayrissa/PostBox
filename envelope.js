import { S, t, esc, unreadIn } from './core.js';
import { paperLook, seedOf, rng, effEnv } from './paper.js';
import { stampFor, postmarkSvg, stickerSvg, ticketSvg, sealHtml, ornamentHtml } from './deco.js';

const KRAFT = '#c9ad82', PARCHMENT = '#e6d6b0', INK = '#3a2515';
const ic = n => `<i class="fa-solid fa-${n}"></i>`;

function stampsHtml(n, seed) {
    const r = rng(seed + 11);
    const base = Math.floor(r() * 1e6);
    return Array.from({ length: n }, (_, i) => {
        const big = r() > 0.55;
        return `<span class="pb-es${big ? ' big' : ''}" style="transform:translateY(${((r() - 0.5) * 12).toFixed(1)}px) rotate(${((r() - 0.5) * 14).toFixed(1)}deg);z-index:${i}">${stampFor(base + i)}</span>`;
    }).join('');
}

export function envelopeHtml(th, { preview = false, selected = false, selectIcon = '' } = {}) {
    const li = [...th.letters].reverse().find(l => l.dir === 'in') || th.letters[th.letters.length - 1];
    if (!li) return '';
    const s = S(), e = effEnv(li, s), kind = e.kind || 'front';
    const un = preview ? 1 : unreadIn(th);
    const seed = seedOf(li);
    const look = paperLook(li, { paper: { style: e.type, edge: e.edge, folds: e.folds, wrinkles: e.wrinkles, stains: e.stains, blots: e.blots, grain: e.grain, tilt: false } });
    const color = e.color || (kind === 'packet' ? PARCHMENT : KRAFT), ink = e.ink || INK;
    const n = Math.max(0, Math.min(4, Number(e.stamps) || 0));

    const from = `<div class="pb-ei-from">${esc(t('from'))}: <b>${esc(li.from)}</b>${li.address ? `<br>${esc(li.address)}` : ''}</div>`;
    const to = `<div class="pb-ei-to">${esc(t('toWhom'))}: ${esc(li.to || '')}</div>`;
    const date = li.date ? `<div class="pb-ei-date">${esc(li.date)}</div>` : '';
    const seal = e.seal ? `<div class="pb-env-seal">${sealHtml(li.from, 'big', !un, seed)}</div>` : '';
    const orn = ornamentHtml(e.ornament);
    const marks = kind === 'back' ? '' : `${n ? `<div class="pb-es-wrap">${stampsHtml(n, seed)}</div>` : ''}${e.postmark ? `<div class="pb-env-pm">${postmarkSvg(li.address, li.date)}</div>` : ''}`;
    const stickers = (kind === 'front' && e.stickers) ? `<div class="pb-stk">${ticketSvg(seed)}${stickerSvg(li.date, seed)}</div>` : '';

    let inner = '', outer = '', extra = '';
    if (kind === 'front') {
        inner = `${marks}${stickers}<div class="pb-env-info">${from}${to}${date}</div>${orn}`;
    } else if (kind === 'back') {
        const open = !un;
        inner = `<svg class="pb-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g fill="none" vector-effect="non-scaling-stroke">
<path d="M0 100L50 56L100 100M0 0L50 56M100 0L50 56" stroke="rgba(0,0,0,.2)" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
<path d="M0 98L50 54M100 98L50 54" stroke="rgba(255,255,255,.28)" stroke-width="1" vector-effect="non-scaling-stroke"/></g></svg>
${open ? '' : '<div class="pb-flap-shadow"></div><div class="pb-flap-closed"></div>'}${orn}`;
        if (open) outer = '<div class="pb-flapwrap"><div class="pb-flap"></div></div>';
        extra = `<div class="pb-tag">${from}${to}${date}</div>`;
    } else { // packet
        const band = e.binding === 'ribbon' ? '<div class="pb-ribbon"></div>' : e.binding === 'twine' ? '<div class="pb-twine h"></div><div class="pb-twine v"></div>' : '';
        inner = `${marks}<div class="pb-env-info"><div class="pb-pk-l">${from}</div><div class="pb-pk-r">${to}${date}</div></div>${band}${orn}`;
    }

    const attr = preview ? '' : `data-sender="${esc(th.sender)}"`;
    return `<div class="pb-env pb-env-${kind} ${un ? 'sealed' : 'opened'}${e.ornament !== 'none' ? ' orn' : ''}${selected ? ' pb-sel' : ''}" ${attr} style="--p:${color};--i:${ink}">
${outer}<div class="pb-env-paper pb-paper" data-paper="${look.style}" style="${look.clip ? `clip-path:${look.clip};` : ''}filter:brightness(${look.bright.toFixed(3)});--grain:${e.grain / 100}">
<div class="pb-tex" style="background-image:${look.tex}"></div><div class="pb-noise"></div>${look.blots}${inner}</div>
${extra}${seal}${un && !preview ? `<span class="pb-badge">${un}</span>` : ''}${selected ? `<span class="pb-check">${ic('check')}</span>` : ''}</div>`;
}
