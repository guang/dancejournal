// Generate the Move Library pages from .cache/library.json (written by export.js).
//
//   node scripts/library/build.js
//
// Writes, at the repo root:
//   library/index.html                 → redirect to the only live style (today /bachata/)
//   <style>/index.html                 → style page: Style ▼, All levels ▼, "Moves by topic" cards
//   <style>/<topic>/index.html         → topic page: subtopic rows of covers (the app's #1436 layout)
//   <style>/moves/<move>/index.html    → move page: player, Full tutorial row, more from this video
//   sitemap.xml, robots.txt
// Every generated folder is wiped and rewritten, so a takedown or a dropped move disappears on the next build.
// The pages mirror the app's Discover on purpose (storyboard 2026-10-21-website-seo-share): same rows, same
// words, the app's light theme. Topic order, rows and levels come from the published Firestore state only.
const fs = require('fs'), path = require('path');
const QRCode = require(require.resolve('qrcode', { paths: [__dirname] }));

const ROOT = path.resolve(__dirname, '..', '..');
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const COPY = JSON.parse(fs.readFileSync(path.join(__dirname, 'topics.json'), 'utf8'));
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '.cache', 'library.json'), 'utf8'));
const { SITE, SHARE, INDEX_LIBRARY, LENGTH_SHORT_MAX_S } = CFG;
const V = 3; // cache-buster for library.css / library.js

// Standard rows in the app's order (dj-library pipeline/subtopics.json). Display rule (docs/move-library-handoff.md §3):
// Start here first, then the topic's own rows, then the other standard rows, then "More" for anything unfiled.
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const LEVEL_NAME = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

// ── helpers ───────────────────────────────────────────────────────────────
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = (s) => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'move';
const fmt = (sec) => { const s = Math.max(0, Math.round(sec)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const cleanTitle = (t) => { const s = String(t || '').replace(/^\(.*?\)\s*/, '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
function write(rel, html) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

// ── model ─────────────────────────────────────────────────────────────────
const clips = DATA.clips;
const topics = DATA.topics
  .map((t) => {
    const copy = COPY[t.id] || {};
    const style = t.genre || 'bachata';
    const ids = t.clipIds.filter((id) => clips[id]);
    const facet = (id) => t.moveFacets[id] || {};
    const known = new Set(t.subtopics.map((s) => s.id));
    const order = [
      ...t.subtopics.filter((s) => s.id === 'start-here'),
      ...t.subtopics.filter((s) => !s.standard),
      ...t.subtopics.filter((s) => s.standard && s.id !== 'start-here'),
    ];
    const rows = order.map((s) => ({ id: s.id, title: s.title, ids: ids.filter((id) => facet(id).subtopic === s.id) }));
    rows.push({ id: 'more', title: 'More', ids: ids.filter((id) => !known.has(facet(id).subtopic)) });
    const title = copy.title || cleanTitle(t.title);
    return {
      id: t.id, style, slug: copy.slug || slugify(title), title,
      h1: copy.h1 || `${CFG.styles[style] ? CFG.styles[style].name : cleanTitle(style)} ${title.toLowerCase()}`,
      intro: copy.intro || '', cover: t.cover, shelfOrder: t.shelfOrder == null ? 999 : t.shelfOrder,
      ids, facet, rows: rows.filter((r) => r.ids.length),
    };
  })
  // Storyboard Q1: a topic gets a web page only once it has a "Start here" row — a stranger needs a first step.
  .filter((t) => CFG.styles[t.style] && t.rows.some((r) => r.id === 'start-here'))
  .sort((a, b) => a.shelfOrder - b.shelfOrder || a.title.localeCompare(b.title));

// One page per move. A move listed in two topics lives under the first (by shelf order).
const moves = {};
const usedSlugs = {};
for (const t of topics) {
  for (const r of t.rows) {
    for (const id of r.ids) {
      if (moves[id]) continue;
      const c = clips[id];
      let slug = slugify(c.name);
      if (usedSlugs[t.style + '/' + slug]) slug = slug + '-' + id.replace(/^move_/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      usedSlugs[t.style + '/' + slug] = true;
      moves[id] = { ...c, slug, topic: t, row: r, level: t.facet(id).level || null };
    }
  }
}
const moveUrl = (id) => `/${moves[id].topic.style}/moves/${moves[id].slug}/`;
const topicUrl = (t) => `/${t.style}/${t.slug}/`;
const lenOf = (id) => (clips[id].duration != null && clips[id].duration > LENGTH_SHORT_MAX_S ? 'long' : 'short');

// ── shared chrome ─────────────────────────────────────────────────────────
const ROBOTS = (indexable) => `<meta name="robots" content="${indexable ? 'index,follow' : 'noindex,follow'}">`;

function head({ title, description, canonical, image, indexable, ld = [] }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  ${ROBOTS(indexable)}
  <link rel="canonical" href="${SITE}${canonical}">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" href="/assets/icons/app-icon.png" type="image/png" sizes="256x256">
  <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
  <meta name="description" content="${esc(description)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE}${canonical}">
  ${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
  <meta name="theme-color" content="#FAF9F8">
  <link rel="stylesheet" href="/assets/landing.css?v=97">
  <link rel="stylesheet" href="/assets/library.css?v=${V}">
  <!-- Cloudflare Web Analytics -->
  <script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "11651d9885e34755b7715f68c4ef9fc0"}'></script>
  <!-- End Cloudflare Web Analytics -->
  <script>
    (function () {
      var ua = navigator.userAgent, platform = navigator.platform || '';
      var isIOS = /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      var isAndroid = /Android/.test(ua), isMac = !isIOS && /Mac/.test(platform);
      var h = document.documentElement;
      h.classList.add(isIOS ? 'platform-ios' : isAndroid ? 'platform-android' : isMac ? 'platform-macos' : 'platform-other');
      h.classList.add('js');
    })();
  </script>
  ${ld.map(jsonLd).join('\n  ')}
</head>`;
}

const NAV = `<nav class="dz-nav">
    <a class="dj-wordmark dz-nav-wm" href="/" aria-label="Dance Journal home">
      <span class="dj-mark dj-mark-img"><img src="/assets/icons/app-icon.png" alt="" width="40" height="40" loading="eager"></span>
      <span class="dj-word">Dance Journal</span>
    </a>
    <div class="dz-nav-right">
      <a href="/library/" class="dz-nav-library" aria-current="page">Library</a>
      <a href="/changelog.html" class="dz-nav-whatsnew">What's new</a>
      <a href="#" target="_blank" rel="noopener" class="dz-nav-cta" data-install-link>
        <span class="dz-store-glyph" data-store-glyph aria-hidden="true"></span>
        <span>Get the app</span>
      </a>
    </div>
  </nav>`;

const FOOTER = `<footer class="dz-footer">
    <div class="links">
      <a href="/library/">Library</a>
      <a href="/changelog.html">What's new</a>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
      <a href="/support.html">Support</a>
    </div>
    <div class="copyright">© 2026 Dance Journal</div>
  </footer>
  <script src="/assets/landing.js?v=33" defer></script>
  <script src="/assets/library.js?v=${V}" defer></script>
</body>
</html>
`;

const CARET = '<svg class="lb-caret" viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="M216.49,104.49l-80,80a12,12,0,0,1-17,0l-80-80a12,12,0,0,1,17-17L128,159l71.51-71.52a12,12,0,0,1,17,17Z"/></svg>';
const CHECK = '<svg viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
const SHARE_ICON = '<svg viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="M216,112v96a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V112A16,16,0,0,1,56,96H80a8,8,0,0,1,0,16H56v96H200V112H176a8,8,0,0,1,0-16h24A16,16,0,0,1,216,112ZM93.66,69.66,120,43.31V136a8,8,0,0,0,16,0V43.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,69.66Z"/></svg>';

// A ChoiceSheet: title, rows with counts in a right-hand column, the selected row in ink with a check.
function sheet(id, title, rows) {
  return `<div class="lb-sheet" id="${id}" hidden role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="lb-sheet-scrim" data-close></div>
    <div class="lb-sheet-panel">
      <div class="lb-sheet-grip" aria-hidden="true"></div>
      <h2 class="lb-sheet-title">${esc(title)}</h2>
      ${rows.map((r) => r.href
        ? `<a class="lb-sheet-row lb-sheet-link" href="${r.href}">${esc(r.label)}</a>`
        : `<button type="button" class="lb-sheet-row" data-value="${esc(r.value)}" aria-pressed="${r.on ? 'true' : 'false'}"><span>${esc(r.label)}</span><span class="lb-count" data-count-for="${esc(r.value)}">${r.count == null ? '' : r.count}</span><span class="lb-check">${CHECK}</span></button>`).join('\n      ')}
    </div>
  </div>`;
}
const pill = (forId, label, extra = '') => `<button type="button" class="lb-pill" data-sheet="${forId}" ${extra}><span data-pill-label>${esc(label)}</span>${CARET}</button>`;

function ctaBlock({ kind, id, label }) {
  return `<div class="lb-sticky">
    <a class="lb-cta" href="#" data-cta data-kind="${kind}" data-id="${esc(id)}">
      <span data-cta-label>${esc(label)}</span>
    </a>
    <p class="lb-cta-sub" data-cta-sub hidden></p>
  </div>`;
}

// ── style page ────────────────────────────────────────────────────────────
function stylePage(style, list) {
  const name = CFG.styles[style].name;
  const total = list.reduce((n, t) => n + t.ids.length, 0);
  const levelCounts = Object.fromEntries(LEVELS.map((l) => [l, list.reduce((n, t) => n + t.ids.filter((id) => t.facet(id).level === l).length, 0)]));
  const canonical = `/${style}/`;
  const desc = `${total} ${name.toLowerCase()} moves in ${list.length} topics, each cut to one move and credited to the teacher. Loop them, slow them down and practice them in Dance Journal.`;
  const cards = list.map((t) => {
    const lv = Object.fromEntries(LEVELS.map((l) => [l, t.ids.filter((id) => t.facet(id).level === l).length]));
    return `<a class="lb-topic" href="${topicUrl(t)}" data-total="${t.ids.length}" ${LEVELS.map((l) => `data-${l}="${lv[l]}"`).join(' ')}>
        <span class="lb-topic-cover">${t.cover ? `<img src="${esc(t.cover)}" alt="" loading="lazy">` : ''}</span>
        <span class="lb-topic-text"><span class="lb-topic-title">${esc(t.title)}</span><span class="lb-topic-meta" data-meta>${plural(t.ids.length, 'move', 'moves')}</span></span>
      </a>`;
  }).join('\n      ');
  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${name} move library`, url: SITE + canonical, description: desc },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: `${name} moves by topic`, itemListElement: list.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.h1, url: SITE + topicUrl(t) })) },
  ];
  return `${head({ title: `${name} move library · ${total} moves · Dance Journal`, description: desc, canonical, image: list[0] && list[0].cover, indexable: INDEX_LIBRARY, ld })}
<body class="lb">
  ${NAV}
  <main class="lb-main" data-style-page>
    <p class="lb-eyebrow">Style</p>
    <button type="button" class="lb-style" data-sheet="sheet-style">${esc(name)}${CARET}</button>
    <h1 class="lb-sub-h1">${esc(name)} move library · ${plural(total, 'move', 'moves')}</h1>
    <div class="lb-pills js-only">${pill('sheet-level', 'All levels')}</div>
    <h2 class="lb-section">Moves by topic</h2>
    <div class="lb-topics">
      ${cards}
    </div>
    <p class="lb-empty" data-empty hidden>No topics at this level yet. <button type="button" class="lb-linkbtn" data-reset>Show all levels</button></p>
  </main>
  ${sheet('sheet-style', 'Style', [
    { value: style, label: name, count: total, on: true },
    { href: '/#how-it-works', label: 'Other styles: the app works with any style →' },
  ])}
  ${sheet('sheet-level', 'Level', [
    { value: '', label: 'All levels', count: total, on: true },
    ...LEVELS.filter((l) => levelCounts[l]).map((l) => ({ value: l, label: LEVEL_NAME[l], count: levelCounts[l] })),
  ])}
  ${FOOTER}`;
}

// ── topic page ────────────────────────────────────────────────────────────
function topicPage(t) {
  const name = CFG.styles[t.style].name;
  const canonical = topicUrl(t);
  const teachers = [...new Set(t.ids.map((id) => clips[id].handle).filter(Boolean))];
  const desc = `${t.ids.length} ${name.toLowerCase()} ${t.title.toLowerCase()}, from where to start to the ones that look hard. ${t.intro}`.slice(0, 300);
  const levelCounts = Object.fromEntries(LEVELS.map((l) => [l, t.ids.filter((id) => t.facet(id).level === l).length]));
  const lenCounts = { short: t.ids.filter((id) => lenOf(id) === 'short').length, long: t.ids.filter((id) => lenOf(id) === 'long').length };
  const rows = t.rows.map((r) => `<section class="lb-row" id="${esc(r.id)}" data-row>
      <h2 class="lb-row-title">${esc(r.title)} <span class="lb-row-count" data-row-count>${r.ids.length}</span></h2>
      <div class="lb-rail">
        ${r.ids.map((id) => `<a class="lb-tile" href="${moveUrl(id)}" data-level="${esc(t.facet(id).level || '')}" data-len="${lenOf(id)}">
          <img src="${esc(clips[id].poster)}" alt="${esc(clips[id].name)}" loading="lazy" width="132" height="176">
          <span class="lb-tile-play">${PLAY}</span>
          <span class="lb-sr">${esc(clips[id].name)}</span>
        </a>`).join('\n        ')}
      </div>
    </section>`).join('\n    ');
  const ld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: `${name} move library`, item: `${SITE}/${t.style}/` },
      { '@type': 'ListItem', position: 2, name: t.title, item: SITE + canonical },
    ] },
    ...t.rows.map((r) => ({ '@context': 'https://schema.org', '@type': 'ItemList', name: `${t.h1}: ${r.title.toLowerCase()}`, url: `${SITE}${canonical}#${r.id}`,
      itemListElement: r.ids.map((id, i) => ({ '@type': 'ListItem', position: i + 1, name: clips[id].name, url: SITE + moveUrl(id) })) })),
  ];
  return `${head({ title: `${t.h1} · ${t.ids.length} moves · Dance Journal`, description: desc, canonical, image: t.cover, indexable: INDEX_LIBRARY, ld })}
<body class="lb lb-with-bar">
  ${NAV}
  <main class="lb-main lb-has-sticky" data-topic-page data-noun="${esc(t.title.toLowerCase())}">
    <p class="lb-crumb"><a href="/${t.style}/">${esc(name)} move library</a> › ${esc(t.title)}</p>
    <h1 class="lb-h1">${esc(t.h1)}</h1>
    <p class="lb-meta" data-topic-meta data-total="${t.ids.length}">${plural(t.ids.length, 'move', 'moves')}</p>
    ${t.intro ? `<p class="lb-intro">${esc(t.intro)}</p>` : ''}
    <div class="lb-pills js-only">${pill('sheet-level', 'All levels')}${pill('sheet-length', 'All lengths')}</div>
    ${rows}
    <p class="lb-empty" data-empty hidden>No moves match these filters. <button type="button" class="lb-linkbtn" data-reset>Show all</button></p>
    <section class="lb-credits">
      <h2 class="lb-row-title">Teachers in this topic</h2>
      <p>${teachers.map((h) => `<a href="https://www.instagram.com/${esc(h)}/" rel="noopener" target="_blank">@${esc(h)}</a>`).join(' · ')}</p>
      <p class="lb-fine">Moves are cut from public Instagram reels and credited to their teachers. <a href="/support.html">Report a move</a></p>
    </section>
  </main>
  ${sheet('sheet-level', 'Level', [
    { value: '', label: 'All levels', count: t.ids.length, on: true },
    ...LEVELS.filter((l) => levelCounts[l]).map((l) => ({ value: l, label: LEVEL_NAME[l], count: levelCounts[l] })),
  ])}
  ${sheet('sheet-length', 'Length', [
    { value: '', label: 'All lengths', count: t.ids.length, on: true },
    { value: 'short', label: `Short · up to ${LENGTH_SHORT_MAX_S}s`, count: lenCounts.short },
    { value: 'long', label: `Long · over ${LENGTH_SHORT_MAX_S}s`, count: lenCounts.long },
  ])}
  ${ctaBlock({ kind: 'collection', id: t.id, label: 'Practice these in Dance Journal' })}
  ${FOOTER}`;
}

// ── move page ─────────────────────────────────────────────────────────────
async function movePage(id) {
  const m = moves[id], t = m.topic, r = m.row;
  const name = CFG.styles[t.style].name;
  const canonical = moveUrl(id);
  const flat = t.rows.flatMap((row) => row.ids);
  const next = flat[(flat.indexOf(id) + 1) % flat.length];
  const rowRest = [...r.ids.slice(r.ids.indexOf(id) + 1), ...r.ids.slice(0, r.ids.indexOf(id))].filter((x) => x !== id).slice(0, 10);
  const siblings = m.sourceClipId ? Object.keys(moves).filter((x) => x !== id && moves[x].sourceClipId === m.sourceClipId) : [];
  const at = m.moveStartMs != null ? fmt(m.moveStartMs / 1000) : null;
  const qrTarget = `${SHARE}/m/${encodeURIComponent(id)}?src=qr`;
  const qr = await QRCode.toString(qrTarget, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1A1A1A', light: '#FFFFFF' } });
  const desc = `${m.name}: a ${name.toLowerCase()} ${t.title.toLowerCase().replace(/s$/, '')} move${m.handle ? ` by @${m.handle}` : ''}. Loop it, slow it down, mirror it, and practice it in Dance Journal.`;
  const thumbs = (ids) => ids.map((x) => `<a class="lb-tile" href="${moveUrl(x)}"><img src="${esc(moves[x].poster)}" alt="${esc(moves[x].name)}" loading="lazy" width="132" height="176"><span class="lb-tile-play">${PLAY}</span><span class="lb-sr">${esc(moves[x].name)}</span></a>`).join('');
  const ld = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: `${name} move library`, item: `${SITE}/${t.style}/` },
    { '@type': 'ListItem', position: 2, name: t.title, item: SITE + topicUrl(t) },
    { '@type': 'ListItem', position: 3, name: m.name, item: SITE + canonical },
  ] }];
  // Move pages stay noindex until a move has a reviewed one-line description (storyboard: "Every move gets a URL. Not every move gets indexed.").
  return `${head({ title: `${m.name} · ${name} ${t.title.toLowerCase()} · Dance Journal`, description: desc, canonical, image: m.poster, indexable: false, ld })}
<body class="lb lb-move-body lb-with-bar">
  ${NAV}
  <main class="lb-main lb-has-sticky lb-move" data-move-page data-clip-id="${esc(id)}">
    <div class="lb-move-head">
      <p class="lb-crumb"><a href="/${t.style}/">${esc(name)} move library</a> › <a href="${topicUrl(t)}">${esc(t.title)}</a> › <a href="${topicUrl(t)}#${esc(r.id)}">${esc(r.title)}</a></p>
      <h1 class="lb-h1 lb-move-h1">${esc(m.name)}${m.level ? ` <span class="lb-level">${LEVEL_NAME[m.level]}</span>` : ''}</h1>
      ${m.instagramUrl ? `<a class="lb-credit" href="${esc(m.instagramUrl)}" target="_blank" rel="noopener" data-credit>Full tutorial · ${m.handle ? `@${esc(m.handle)}` : 'on Instagram'}${at ? ` · this move at ${at}` : ''} <span aria-hidden="true">↗</span></a>` : ''}
    </div>
    <div class="lb-player" data-player>
      <div class="lb-stage">
        <video src="${esc(m.url)}" poster="${esc(m.poster)}" playsinline muted loop preload="metadata" data-video></video>
        <button type="button" class="lb-sound" data-sound>Sound on</button>
      </div>
      <div class="lb-transport">
        <button type="button" class="lb-pp" data-pp aria-label="Play">${PLAY}</button>
        <div class="lb-progress" data-progress role="slider" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i data-fill></i><b class="lb-loopband" data-band hidden></b></div>
        <span class="lb-time" data-time>0:00 / ${m.duration != null ? fmt(m.duration) : '0:00'}</span>
      </div>
      <div class="lb-tools">
        <button type="button" class="lb-chip on" data-rate="1" aria-pressed="true">1×</button>
        <button type="button" class="lb-chip" data-rate="0.5" aria-pressed="false">0.5×</button>
        <button type="button" class="lb-chip" data-rate="0.25" aria-pressed="false">0.25×</button>
        <button type="button" class="lb-chip lb-tool" data-mirror aria-pressed="false">Mirror</button>
        <span class="lb-break" aria-hidden="true"></span>
        <button type="button" class="lb-chip lb-tool lb-loopbtn" data-loop>Start loop</button>
        <a class="lb-chip lb-next" href="${moveUrl(next)}">Next move ›</a>
      </div>
    </div>
    <div class="lb-move-info">
      <div class="lb-qr">
        <span class="lb-qr-code" aria-hidden="true">${qr}</span>
        <span><b>Practice this move on your phone</b><small>Scan to open it in Dance Journal. New to the app? Install it, then scan again.</small></span>
      </div>
      ${siblings.length ? `<h2 class="lb-row-title">More from this video <span class="lb-row-count">${siblings.length}</span></h2><div class="lb-grid3">${thumbs(siblings)}</div>` : ''}
      ${rowRest.length ? `<h2 class="lb-row-title">Next in ${esc(t.title)} · ${esc(r.title)}</h2><div class="lb-rail">${thumbs(rowRest)}</div>` : ''}
      <p class="lb-fine">We host a short study copy so it can loop and slow down. All credit to the teacher. <a href="/support.html">Report this move</a></p>
    </div>
  </main>
  <div class="lb-sticky lb-sticky-move">
    <div class="lb-sticky-row">
      <a class="lb-cta" href="#" data-cta data-kind="clip" data-id="${esc(id)}"><span data-cta-label>Practice this move</span></a>
      <button type="button" class="lb-share" data-share data-title="${esc(m.name)}" aria-label="Share this move">${SHARE_ICON}</button>
    </div>
    <p class="lb-cta-sub" data-cta-sub hidden></p>
  </div>
  ${FOOTER}`;
}

// ── run ───────────────────────────────────────────────────────────────────
(async () => {
  const styles = [...new Set(topics.map((t) => t.style))];
  // Wipe what we generated last time (only the folders we own), then rewrite.
  for (const s of Object.keys(CFG.styles)) fs.rmSync(path.join(ROOT, s), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'library'), { recursive: true, force: true });

  const urls = [];
  for (const s of styles) {
    const list = topics.filter((t) => t.style === s);
    write(`${s}/index.html`, stylePage(s, list));
    urls.push(`/${s}/`);
    for (const t of list) { write(`${s}/${t.slug}/index.html`, topicPage(t)); urls.push(topicUrl(t)); }
  }
  for (const id of Object.keys(moves)) write(`${moves[id].topic.style}/moves/${moves[id].slug}/index.html`, await movePage(id));

  const first = styles[0] || 'bachata';
  write('library/index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Move Library · Dance Journal</title>
<meta name="robots" content="noindex,follow"><link rel="canonical" href="${SITE}/${first}/">
<meta http-equiv="refresh" content="0; url=/${first}/"><script>location.replace('/${first}/' + location.search)</script></head>
<body><a href="/${first}/">Open the Move Library</a></body></html>
`);

  const indexed = INDEX_LIBRARY ? urls : [];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['/', '/changelog.html', ...indexed].map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}
</urlset>
`);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  const skipped = DATA.topics.filter((t) => !topics.some((x) => x.id === t.id)).map((t) => t.id);
  console.log(`built ${styles.length} style page(s), ${topics.length} topic page(s), ${Object.keys(moves).length} move page(s)` +
    (skipped.length ? `; skipped (no Start here row yet): ${skipped.join(', ')}` : '') + `; INDEX_LIBRARY=${INDEX_LIBRARY}`);
})().catch((e) => { console.error(e); process.exit(1); });
