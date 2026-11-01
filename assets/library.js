// Move Library pages: choice sheets + filters (style/topic pages), the move player (move pages), and the
// store hand-off. The player and hand-off are adapted from the share site's /m/ page
// (public_share/clip.js in the app repo): same speed trick, same first-visit-store / return-visit-app rule,
// same visited flag and event beacon, so a dancer who has used both behaves the same on either.
(function () {
  'use strict';

  var IOS_STORE = 'https://apps.apple.com/app/id6751278168';
  var ANDROID_STORE = 'https://play.google.com/store/apps/details?id=app.dancejournal.dancenotes';
  var SHARE = 'https://share.dancejournal.app';
  var VISITED_FLAG = 'dj_visited_share';  // shared with /m/ and /c/: any earlier store tap counts
  var ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5h3v14H8zm5 0h3v14h-3z"/></svg>';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function clamp01(n) { return isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; }
  function visited() { try { return localStorage.getItem(VISITED_FLAG) === '1'; } catch (e) { return false; } }

  function storeUrl(ct) {
    var base = /android/i.test(navigator.userAgent || '') ? ANDROID_STORE : IOS_STORE;
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'pt=dancejournal&ct=' + ct;
  }

  // Fire-and-forget, never in the way of playback or navigation. /api/clip-event is CORS-open.
  function sendEvent(clipId, type, extra) {
    if (!clipId || !/(^|\.)dancejournal\.app$/.test(location.hostname)) return; // no test traffic in clip_web_events
    try {
      var body = { clipId: clipId, type: type };
      if (extra) for (var k in extra) body[k] = extra[k];
      fetch(SHARE + '/api/clip-event', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify(body),
      }).catch(function () {});
    } catch (e) { /* best-effort */ }
  }

  // ── sheets (the app's ChoiceSheet) ──────────────────────────────────────
  var openSheet = null;
  function showSheet(sheet) {
    if (!sheet) return;
    sheet.hidden = false;
    openSheet = sheet;
    var first = $('[aria-pressed="true"]', sheet) || $('.lb-sheet-row', sheet);
    if (first) first.focus();
  }
  function hideSheet() { if (openSheet) { openSheet.hidden = true; openSheet = null; } }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideSheet(); });
  $all('[data-sheet]').forEach(function (btn) {
    btn.addEventListener('click', function () { showSheet(document.getElementById(btn.getAttribute('data-sheet'))); });
  });
  $all('.lb-sheet [data-close]').forEach(function (el) { el.addEventListener('click', hideSheet); });

  // A sheet row sets one filter; the URL keeps it (?level=beginner) so a shared link opens filtered.
  function wireFilter(sheetId, param, labels, apply) {
    var sheet = document.getElementById(sheetId);
    if (!sheet) return null;
    var pillBtn = $('[data-sheet="' + sheetId + '"]');
    var state = { value: '' };
    function set(value, push) {
      state.value = value || '';
      $all('.lb-sheet-row[data-value]', sheet).forEach(function (row) {
        row.setAttribute('aria-pressed', String(row.getAttribute('data-value') === state.value));
      });
      if (pillBtn) {
        $('[data-pill-label]', pillBtn).textContent = labels[state.value] || labels[''];
        pillBtn.classList.toggle('on', !!state.value);
      }
      if (push) {
        var url = new URL(location.href);
        if (state.value) url.searchParams.set(param, state.value); else url.searchParams.delete(param);
        history.replaceState(null, '', url);
      }
      apply();
    }
    $all('.lb-sheet-row[data-value]', sheet).forEach(function (row) {
      row.addEventListener('click', function () { set(row.getAttribute('data-value'), true); hideSheet(); });
    });
    var initial = new URLSearchParams(location.search).get(param) || '';
    if (initial && !Object.prototype.hasOwnProperty.call(labels, initial)) initial = '';
    state.set = set;
    set(initial, false);
    return state;
  }
  var LEVEL_LABELS = { '': 'All levels', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  var LEVEL_WORD = { beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced' };

  // ── style page: Level narrows the topic cards and their counts ─────────
  var stylePage = $('[data-style-page]');
  if (stylePage) {
    var level = null;
    var applyStyle = function () {
      var lv = level ? level.value : '';
      var shown = 0;
      $all('.lb-topic', stylePage).forEach(function (card) {
        var n = Number(card.getAttribute(lv ? 'data-' + lv : 'data-total')) || 0;
        card.hidden = n === 0;
        if (n) shown++;
        $('[data-meta]', card).textContent = n + ' ' + (lv ? LEVEL_WORD[lv] + ' ' : '') + (n === 1 ? 'move' : 'moves');
        var href = card.getAttribute('href').split('?')[0];
        card.setAttribute('href', lv ? href + '?level=' + lv : href);
      });
      $('[data-empty]', stylePage).hidden = shown > 0;
    };
    level = wireFilter('sheet-level', 'level', LEVEL_LABELS, function () { if (level) applyStyle(); });
    applyStyle();
    var reset = $('[data-reset]', stylePage);
    if (reset) reset.addEventListener('click', function () { level.set('', true); });
    // The style sheet's one real row is the current style: just close.
    $all('#sheet-style .lb-sheet-row[data-value]').forEach(function (row) { row.addEventListener('click', hideSheet); });
  }

  // ── topic page: Level + Length narrow the tiles; empty rows drop out ──
  var topicPage = $('[data-topic-page]');
  if (topicPage) {
    var lvl = null, len = null;
    var applyTopic = function () {
      if (!lvl || !len) return;
      var total = 0;
      $all('[data-row]', topicPage).forEach(function (row) {
        var n = 0;
        $all('.lb-tile', row).forEach(function (tile) {
          var ok = (!lvl.value || tile.getAttribute('data-level') === lvl.value) &&
                   (!len.value || tile.getAttribute('data-len') === len.value);
          tile.hidden = !ok;
          if (ok) n++;
        });
        row.hidden = n === 0;
        $('[data-row-count]', row).textContent = n;
        total += n;
      });
      var meta = $('[data-topic-meta]', topicPage);
      var all = Number(meta.getAttribute('data-total'));
      meta.textContent = (total === all ? all : total + ' of ' + all) + (all === 1 ? ' move' : ' moves');
      var empty = $('[data-empty]', topicPage);
      empty.hidden = total > 0;
      if (!total) {
        // Suggest the level with the most moves here, e.g. "No beginner rotisseries yet. Try Intermediate (26)".
        var best = null;
        $all('#sheet-level .lb-sheet-row[data-value]').forEach(function (row) {
          var v = row.getAttribute('data-value'), n = Number($('.lb-count', row).textContent) || 0;
          if (v && v !== lvl.value && (!best || n > best.n)) best = { v: v, n: n };
        });
        var noun = topicPage.getAttribute('data-noun') || 'moves';
        var msg = lvl.value && !len.value ? 'No ' + LEVEL_WORD[lvl.value] + ' ' + noun + ' yet. ' : 'No moves match these filters. ';
        empty.innerHTML = '';
        empty.appendChild(document.createTextNode(msg));
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'lb-linkbtn';
        if (lvl.value && !len.value && best) {
          btn.textContent = 'Try ' + LEVEL_LABELS[best.v] + ' (' + best.n + ')';
          btn.onclick = function () { lvl.set(best.v, true); };
        } else {
          btn.textContent = 'Show all';
          btn.onclick = function () { lvl.set('', true); len.set('', true); };
        }
        empty.appendChild(btn);
      }
    };
    lvl = wireFilter('sheet-level', 'level', LEVEL_LABELS, applyTopic);
    len = wireFilter('sheet-length', 'length', { '': 'All lengths', short: 'Short', long: 'Long' }, applyTopic);
    applyTopic();
  }

  // ── the store hand-off (clip.js's wireCta) ─────────────────────────────
  // First visit: a plain link to the store. iOS Safari can show an error dialog for an unregistered custom
  // scheme before any fallback fires, and a first-time visitor most likely has no app. Return visit: try the
  // app's scheme and fall back to the store if the page is still visible after 1.4 s.
  $all('[data-cta]').forEach(function (cta) {
    var kind = cta.getAttribute('data-kind'), id = cta.getAttribute('data-id');
    var ct = kind === 'clip' ? 'web_move' : 'web_topic';
    var scheme = kind === 'clip' ? 'dancenotes://clip?id=' : 'dancenotes://collection?id=';
    var wasVisited = visited();
    cta.href = storeUrl(ct);
    cta.target = '_self';
    if (wasVisited) {
      $('[data-cta-label]', cta).textContent = 'Open in Dance Journal app';
      var sub = cta.parentNode.parentNode.querySelector('[data-cta-sub]') || cta.parentNode.querySelector('[data-cta-sub]');
      if (sub) { sub.innerHTML = 'Not installed yet? <a href="' + storeUrl(ct) + '">Get the app</a>'; sub.hidden = false; }
    }
    cta.addEventListener('click', function (e) {
      if (kind === 'clip') sendEvent(id, 'cta_tap');
      try { localStorage.setItem(VISITED_FLAG, '1'); } catch (err) { /* ignore */ }
      if (!wasVisited) return;
      e.preventDefault();
      var fallback = setTimeout(function () { location.href = storeUrl(ct); }, 1400);
      var onHide = function () { clearTimeout(fallback); document.removeEventListener('visibilitychange', onHide); };
      document.addEventListener('visibilitychange', onHide);
      location.href = scheme + encodeURIComponent(id);
    });
  });

  // ── move page: the player ───────────────────────────────────────────────
  var movePage = $('[data-move-page]');
  if (!movePage) return;
  var clipId = movePage.getAttribute('data-clip-id');
  var player = $('[data-player]');
  var video = $('[data-video]', player);
  var stage = $('.lb-stage', player);
  var pp = $('[data-pp]', player), progress = $('[data-progress]', player), fill = $('[data-fill]', player);
  var band = $('[data-band]', player), timeEl = $('[data-time]', player), soundBtn = $('[data-sound]', player);
  var loopBtn = $('[data-loop]', player), mirrorBtn = $('[data-mirror]', player);
  var rate = 1, loopA = null, loopB = null, raf = 0;

  sendEvent(clipId, 'view');

  // iOS traps (from clip.js): seeking and leaving fullscreen can reset playbackRate to 1, and Safari
  // pitch-drops/mutes below ~0.5× unless preservesPitch is switched off.
  function applyRate(r) {
    rate = r;
    video.playbackRate = r;
    video.preservesPitch = false;
    video.webkitPreservesPitch = false;
  }
  function play() { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
  function toggle() { if (video.paused) play(); else video.pause(); }
  function syncPlay() { pp.innerHTML = video.paused ? ICON_PLAY : ICON_PAUSE; pp.setAttribute('aria-label', video.paused ? 'Play' : 'Pause'); }
  function syncTime() {
    var d = video.duration || 0;
    if (d) {
      var pct = video.currentTime / d * 100;
      fill.style.width = pct + '%';
      progress.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
    timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(d);
  }
  function syncBand() {
    var d = video.duration || 0;
    if (loopA == null || !d) { band.hidden = true; return; }
    var b = loopB == null ? video.currentTime : loopB;
    band.hidden = false;
    band.style.left = (loopA / d * 100) + '%';
    band.style.width = Math.max(0.5, (b - loopA) / d * 100) + '%';
  }
  // A→B loop. requestAnimationFrame instead of timeupdate (~4 Hz) so the jump back lands on the beat.
  function tick() {
    if (loopA != null && loopB != null && video.currentTime >= loopB) video.currentTime = loopA;
    syncTime();
    if (loopA != null && loopB == null) syncBand();
    raf = video.paused ? 0 : requestAnimationFrame(tick);
  }

  pp.addEventListener('click', toggle);
  video.addEventListener('click', toggle);
  video.addEventListener('play', function () { syncPlay(); if (!raf) raf = requestAnimationFrame(tick); });
  video.addEventListener('pause', syncPlay);
  video.addEventListener('loadedmetadata', syncTime);
  video.addEventListener('seeked', function () { applyRate(rate); syncTime(); });
  video.addEventListener('webkitendfullscreen', function () { applyRate(rate); });
  video.addEventListener('error', function () {
    stage.innerHTML = '<p class="lb-fail">Couldn\'t play this move.</p>';
    var credit = $('[data-credit]');
    var cta = $('[data-cta]');
    if (credit && cta) { cta.href = credit.href; $('[data-cta-label]', cta).textContent = 'Watch it on Instagram ↗'; }
  });

  function seekTo(clientX) {
    if (!video.duration) return;
    var r = progress.getBoundingClientRect();
    video.currentTime = clamp01((clientX - r.left) / r.width) * video.duration;
    syncTime();
  }
  var scrubbing = false;
  progress.addEventListener('pointerdown', function (e) { if (!video.duration) return; e.preventDefault(); scrubbing = true; progress.setPointerCapture(e.pointerId); seekTo(e.clientX); });
  progress.addEventListener('pointermove', function (e) { if (scrubbing) seekTo(e.clientX); });
  progress.addEventListener('pointerup', function () { scrubbing = false; });
  progress.addEventListener('pointercancel', function () { scrubbing = false; });

  // Autoplay muted (browsers only allow muted autoplay); bachata is learned on the count, so sound is one obvious tap.
  function syncSound() { soundBtn.textContent = video.muted ? 'Sound on' : 'Sound off'; }
  soundBtn.addEventListener('click', function () { video.muted = !video.muted; if (video.paused) play(); syncSound(); });
  syncSound();

  $all('[data-rate]', player).forEach(function (chip) {
    chip.addEventListener('click', function () {
      applyRate(Number(chip.getAttribute('data-rate')));
      $all('[data-rate]', player).forEach(function (c) { var on = c === chip; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); });
      sendEvent(clipId, 'rate_change', { rate: rate });
    });
  });

  mirrorBtn.addEventListener('click', function () {
    var on = !stage.classList.contains('mirrored');
    stage.classList.toggle('mirrored', on);
    mirrorBtn.setAttribute('aria-pressed', String(on));
  });

  // Start loop → End loop → Clear loop, the app's words (#1460).
  loopBtn.addEventListener('click', function () {
    if (loopA == null) {
      loopA = video.currentTime; loopB = null;
      loopBtn.textContent = 'End loop';
      loopBtn.setAttribute('aria-pressed', 'true');
    } else if (loopB == null) {
      var t = video.currentTime;
      if (t <= loopA + 0.15) { loopB = Math.min(video.duration || loopA + 1, loopA + 1); } else { loopB = t; }
      video.currentTime = loopA;
      loopBtn.textContent = 'Clear loop';
    } else {
      loopA = loopB = null;
      loopBtn.textContent = 'Start loop';
      loopBtn.setAttribute('aria-pressed', 'false');
    }
    syncBand();
    if (video.paused) play();
  });

  var credit = $('[data-credit]');
  if (credit) credit.addEventListener('click', function () { sendEvent(clipId, 'credit_tap'); });

  var shareBtn = $('[data-share]');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var data = { title: shareBtn.getAttribute('data-title'), url: location.href.split('?')[0] };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(data.url).then(function () {
        var sub = $('.lb-sticky-move [data-cta-sub]');
        if (sub) { var was = sub.innerHTML, wasHidden = sub.hidden; sub.textContent = 'Link copied'; sub.hidden = false; setTimeout(function () { sub.innerHTML = was; sub.hidden = wasHidden; }, 1800); }
      }).catch(function () {});
    });
  }

  syncPlay();
  syncTime();
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  if (!reduce && !saveData) play();
})();
