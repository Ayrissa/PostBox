/* Procedural "paper" look: every letter gets its own seed, so wrinkles, stains, blots and edges are
   random but stable (they never change between renders). */

export function hashStr(s) {
    let h = 2166136261;
    for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const seedOf = l => (Number.isFinite(l?.seed) ? l.seed : Number.isFinite(l?.stamp) ? l.stamp : hashStr(l?.id || 'x'));

const STYLES = ['clean', 'aged', 'rough', 'crumpled'];

function edgePolygon(r, kind) {
    if (kind === 'straight') return '';
    const torn = kind === 'torn';
    const pts = [];
    const walker = amp => { let v = r() * amp; return () => { v += (r() - 0.5) * amp * 0.9; v = Math.max(0, Math.min(amp, v)); return v; }; };
    const f = n => n.toFixed(1);
    const nx = 28, ny = 46, nb = torn ? 40 : 28;
    let w = walker(3.2);
    for (let i = 0; i <= nx; i++) pts.push(`${(i / nx * 100).toFixed(2)}% ${f(w())}px`);
    w = walker(3.2);
    for (let i = 1; i <= ny; i++) pts.push(`calc(100% - ${f(w())}px) ${(i / ny * 100).toFixed(2)}%`);
    w = walker(3.2);
    for (let i = 0; i <= nb; i++) {
        const d = torn ? r() * 10 : w();
        pts.push(`${((1 - i / nb) * 100).toFixed(2)}% calc(100% - ${f(d)}px)`);
    }
    w = walker(3.2);
    for (let i = 1; i < ny; i++) pts.push(`${f(w())}px ${((1 - i / ny) * 100).toFixed(2)}%`);
    return `polygon(${pts.join(',')})`;
}

function blotHtml(r) {
    const size = 7 + r() * 11, h = size * (0.7 + r() * 0.5);
    const rad = () => `${(38 + r() * 34).toFixed(0)}%`;
    const radius = `${rad()} ${rad()} ${rad()} ${rad()} / ${rad()} ${rad()} ${rad()} ${rad()}`;
    const dots = Array.from({ length: 2 + Math.floor(r() * 3) }, () => {
        const dx = (r() - 0.5) * 38, dy = (r() - 0.5) * 30, k = 2 + r() * 3;
        return `${dx.toFixed(0)}px ${dy.toFixed(0)}px 0 -${k.toFixed(1)}px rgba(24,17,11,.8)`;
    }).join(',');
    return `<i class="pb-blot" style="left:${(8 + r() * 80).toFixed(1)}%;top:${(6 + r() * 86).toFixed(1)}%;width:${size.toFixed(1)}px;height:${h.toFixed(1)}px;border-radius:${radius};transform:rotate(${(r() * 360).toFixed(0)}deg);box-shadow:${dots}"></i>`;
}

export function paperLook(l, s, opts = {}) {
    const p = s.paper, r = rng(seedOf(l));
    let style = p.style;
    if (style === 'random') style = STYLES[Math.floor(r() * STYLES.length)];
    const wr = p.wrinkles / 100, st = p.stains / 100, bl = p.blots / 100;
    const layers = [];

    const fold = (angle, pos, k = 1) => {
        const a = (0.05 + wr * 0.12) * k;
        return `linear-gradient(${angle.toFixed(0)}deg,transparent calc(${pos.toFixed(1)}% - 3px),rgba(0,0,0,${a.toFixed(3)}) calc(${pos.toFixed(1)}% - .5px),rgba(255,255,255,${(a * 1.7).toFixed(3)}) calc(${pos.toFixed(1)}% + 1.5px),transparent calc(${pos.toFixed(1)}% + 6px))`;
    };
    if (p.folds === 'thirds' || p.folds === 'cross') {
        layers.push(fold(180, 33 + (r() - 0.5) * 3), fold(180, 66 + (r() - 0.5) * 3));
        if (p.folds === 'cross') layers.push(fold(90, 50 + (r() - 0.5) * 3));
    }
    const creases = Math.round(wr * (style === 'crumpled' ? 8 : 3));
    for (let i = 0; i < creases; i++) layers.push(fold(r() * 180, 12 + r() * 76, 0.55 + r() * 0.4));

    const stains = Math.round(st * 4) + (style === 'aged' ? 2 : 0);
    for (let i = 0; i < stains; i++) {
        const a = 0.05 + r() * 0.1 * (0.5 + st);
        layers.push(`radial-gradient(ellipse ${(14 + r() * 26).toFixed(0)}% ${(9 + r() * 20).toFixed(0)}% at ${(r() * 100).toFixed(0)}% ${(r() * 100).toFixed(0)}%,rgba(135,90,35,${a.toFixed(3)}),rgba(135,90,35,${(a * 0.35).toFixed(3)}) 55%,transparent 100%)`);
    }

    const blots = Array.from({ length: Math.round(bl * 3) }, () => blotHtml(r)).join('');
    const edge = opts.edge || p.edge;
    return {
        style,
        tex: layers.length ? layers.join(',') : 'none',
        clip: edgePolygon(r, edge),
        tilt: p.tilt ? (r() - 0.5) * 1.5 : 0,
        bright: 1 + (r() - 0.5) * 0.06,
        blots,
    };
}

/* ---- per-letter random looks ("different every time") ---- */
const pick = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
const ENV_COLORS = ['#c9ad82', '#e6d6b0', '#b9764f', '#a9b09a', '#9aa5b4', '#d8c7a8', '#c4a07a'];

export function randomLook(s) {
    const out = {};
    if (s.paper.randomEach) out.paper = { style: pick(['clean', 'aged', 'rough', 'crumpled']), edge: pick(['straight', 'deckle', 'torn']), folds: pick(['none', 'thirds', 'cross']), wrinkles: rnd(10, 70), stains: rnd(5, 65), blots: rnd(0, 40), grain: rnd(30, 80) };
    if (s.env.randomEach) out.env = randomEnvSettings();
    return out;
}

export function randomEnvSettings() {
    return { kind: pick(['front', 'back', 'packet']), color: pick(ENV_COLORS), type: pick(['clean', 'aged', 'rough', 'crumpled']), edge: pick(['straight', 'deckle', 'torn']), folds: pick(['none', 'thirds', 'cross']), wrinkles: rnd(5, 55), stains: rnd(5, 55), grain: rnd(30, 80), ornament: pick(['none', 'corners', 'frame']), stamps: rnd(1, 4), stickers: Math.random() > 0.5, binding: pick(['ribbon', 'twine', 'none']) };
}

export const effPaper = (l, s) => ({ ...s.paper, ...(l?.look?.paper || {}) });
export const effEnv = (l, s) => ({ ...s.env, ...(l?.look?.env || {}) });
