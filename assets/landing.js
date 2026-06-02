(function () {
  'use strict';

  // Initial thread: student opens with a request, teacher replies with timestamped notes.
  // Teacher messages have a `t` (seconds) that anchors them to the video timeline.
  var INITIAL_THREAD = [
    { from: 'student', text: 'can you check my clip please' },
    { from: 'teacher', t: 6,  text: 'hands should be higher — block shoulderblades, not ribcage' },
    { from: 'teacher', t: 8,  text: 'missing the twisting motion' },
    { from: 'teacher', t: 10, text: 'keep legs straight, only arms go down' },
  ];

  // Loop window (seconds). The source video may be longer; we cap the demo.
  var LOOP_END = 12;

  // How long a teacher note's caption + active highlight sticks after its timestamp.
  var ACTIVE_WINDOW = 4;

  function fmt(s) {
    s = Math.max(0, s);
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function init(root) {
    var video       = root.querySelector('[data-notebook-video]');
    var bar         = root.querySelector('[data-notebook-bar]');
    var fill        = root.querySelector('.dz-scrub-fill');
    var knob        = root.querySelector('.dz-scrub-knob');
    var curEl       = root.querySelector('[data-notebook-cur]');
    var totalEl     = root.querySelector('[data-notebook-total]');
    var playBtn     = root.querySelector('[data-notebook-play]');
    var backBtn     = root.querySelector('[data-notebook-back]');
    var speedBtn    = root.querySelector('[data-notebook-speed]');
    var capEl       = root.querySelector('[data-notebook-caption]');
    var capTs       = capEl.querySelector('.dz-app-caption-ts');
    var capText     = capEl.querySelector('.dz-app-caption-text');
    var threadEl    = root.querySelector('[data-notebook-thread]');
    var composerEl  = root.querySelector('[data-notebook-composer]');
    var inputEl     = root.querySelector('[data-notebook-input]');
    var sendBtn     = root.querySelector('[data-notebook-send]');

    var dragging = false;
    // teacherMsgs[i] = { idx, t, el } — only teacher messages participate in
    // timeline highlighting + caption. Indices match tickEls.
    var teacherMsgs = [];
    var tickEls = [];
    var duration = LOOP_END;
    // While dragging, render this position instead of video.currentTime so
    // the playhead tracks the cursor even if the video can't seek that fast.
    var dragTime = null;
    // While the browser is processing a seek, video.currentTime can briefly
    // report 0/NaN and flash the playhead to the start. Track the target
    // until the 'seeked' event confirms the browser landed there.
    var seekingTo = null;

    // Build the initial thread + scrub-bar ticks for teacher notes.
    INITIAL_THREAD.forEach(function (m) {
      if (m.from === 'teacher') {
        var msg = document.createElement('button');
        msg.type = 'button';
        msg.className = 'dz-chat-msg from-teacher';
        msg.setAttribute('aria-label', 'Jump to ' + fmt(m.t) + ' — ' + m.text);
        var ts = document.createElement('span');
        ts.className = 'dj-ts';
        ts.textContent = fmt(m.t);
        var txt = document.createElement('span');
        txt.className = 'text';
        txt.textContent = m.text;
        msg.appendChild(ts);
        msg.appendChild(txt);
        msg.addEventListener('click', function () { seek(m.t); });
        threadEl.appendChild(msg);
        teacherMsgs.push({ t: m.t, el: msg });

        var tick = document.createElement('div');
        tick.className = 'dz-scrub-tick';
        tick.style.left = ((m.t / LOOP_END) * 100) + '%';
        bar.appendChild(tick);
        tickEls.push(tick);
      } else {
        // student seed message — no timestamp pin, no jump behavior
        var bubble = document.createElement('div');
        bubble.className = 'dz-chat-msg from-student';
        bubble.textContent = m.text;
        threadEl.appendChild(bubble);
      }
    });

    function activeIdx(t) {
      var idx = -1;
      for (var i = 0; i < teacherMsgs.length; i++) {
        if (teacherMsgs[i].t <= t + 0.1) idx = i;
      }
      if (idx >= 0 && t - teacherMsgs[idx].t > ACTIVE_WINDOW) return -1;
      return idx;
    }

    function setPlayIcon(playing) {
      playBtn.innerHTML = playing
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>';
    }

    function render() {
      var actualT = (typeof video.currentTime === 'number' && isFinite(video.currentTime) && video.currentTime > 0)
        ? video.currentTime : 0;
      // Trust `seekingTo` until the video has actually landed near the target.
      // Otherwise a stray 'seeked' event (some browsers fire it when a seek is
      // rejected — e.g. before metadata, or when paused with `loop`) clears
      // the target and we'd render the stale currentTime (often 0).
      var rawT;
      if (seekingTo != null) {
        if (Math.abs(actualT - seekingTo) < 0.3) {
          seekingTo = null;
          rawT = actualT;
        } else {
          rawT = seekingTo;
        }
      } else {
        rawT = actualT;
      }
      var t = (dragTime != null) ? dragTime : Math.min(rawT, duration);
      var pct = Math.min(100, Math.max(0, (t / duration) * 100));
      fill.style.width = pct + '%';
      knob.style.left  = pct + '%';
      curEl.textContent = fmt(t);

      var ai = activeIdx(t);
      for (var i = 0; i < teacherMsgs.length; i++) {
        teacherMsgs[i].el.classList.toggle('active', i === ai);
        tickEls[i].classList.toggle('active', i === ai);
      }
      if (ai >= 0) {
        capTs.textContent = fmt(teacherMsgs[ai].t);
        capText.textContent = teacherMsgs[ai].el.querySelector('.text').textContent;
        capEl.hidden = false;
      } else {
        capEl.hidden = true;
      }
    }

    function seek(t) {
      t = Math.max(0, Math.min(duration - 0.05, t));
      seekingTo = t;
      function attempt() {
        try { video.currentTime = t; } catch (_) {}
      }
      attempt();
      // If metadata hasn't loaded yet, the first assignment is silently
      // rejected by some browsers; retry once metadata is in.
      if (video.readyState < 1) {
        video.addEventListener('loadedmetadata', attempt, { once: true });
      }
    }
    // Note: we intentionally do NOT clear `seekingTo` on the 'seeked' event;
    // render() clears it only after observing the video actually landed near
    // the target, which avoids a spurious snap-back-to-zero when 'seeked'
    // fires for a rejected seek.

    function timeFromEvent(e) {
      var rect = bar.getBoundingClientRect();
      var cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      var pct = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
      return pct * duration;
    }

    // Video lifecycle.
    video.addEventListener('loadedmetadata', function () {
      if (isFinite(video.duration) && video.duration > 0) {
        duration = Math.min(LOOP_END, video.duration);
        totalEl.textContent = fmt(duration);
      }
    });
    video.addEventListener('play',  function () { setPlayIcon(true); });
    video.addEventListener('pause', function () { setPlayIcon(false); });

    // Controls.
    playBtn.addEventListener('click', function () {
      if (video.paused) video.play(); else video.pause();
    });
    backBtn.addEventListener('click', function () { seek(video.currentTime - 3); });
    speedBtn.addEventListener('click', function () {
      var next = video.playbackRate === 1 ? 0.5 : 1;
      video.playbackRate = next;
      speedBtn.textContent = next + '×';
      speedBtn.setAttribute('aria-label', 'playback speed, currently ' + next + '×');
    });

    // Scrub bar drag — track cursor visually every move, throttle the actual
    // seek so iOS Safari doesn't choke on rapid currentTime writes. Window
    // move/end listeners attach ONLY while dragging so a global non-passive
    // touchmove doesn't interfere with taps on buttons elsewhere in the player.
    var pendingSeekRaf = 0;
    function commitSeek() {
      pendingSeekRaf = 0;
      if (dragTime != null) seek(dragTime);
    }
    function onMove(e) {
      dragTime = timeFromEvent(e);
      if (!pendingSeekRaf) pendingSeekRaf = requestAnimationFrame(commitSeek);
      if (e.cancelable) e.preventDefault();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      if (dragTime != null) seek(dragTime);
      dragTime = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend',  onUp);
      window.removeEventListener('touchcancel', onUp);
    }
    function onDown(e) {
      dragging = true;
      dragTime = timeFromEvent(e);
      seek(dragTime);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend',  onUp);
      window.addEventListener('touchcancel', onUp);
      if (e.cancelable) e.preventDefault();
    }
    bar.addEventListener('mousedown',  onDown);
    bar.addEventListener('touchstart', onDown, { passive: false });

    // Composer: arm the send button when there's text; submit appends a
    // student bubble pinned to the current video timestamp.
    function updateArmed() {
      var armed = inputEl.value.trim().length > 0;
      composerEl.classList.toggle('is-armed', armed);
      sendBtn.disabled = !armed;
    }
    inputEl.addEventListener('input', updateArmed);

    function appendStudentReply(text) {
      var bubble = document.createElement('div');
      bubble.className = 'dz-chat-msg from-student';
      bubble.textContent = text;
      threadEl.appendChild(bubble);
      threadEl.scrollTop = threadEl.scrollHeight;
    }

    composerEl.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = inputEl.value.trim();
      if (!text) return;
      appendStudentReply(text);
      inputEl.value = '';
      updateArmed();
      inputEl.focus();
    });

    // Continuous render loop — keeps the playhead smooth between the sparse
    // timeupdate events the browser fires.
    (function tick() {
      render();
      requestAnimationFrame(tick);
    })();

    // Initial state.
    setPlayIcon(false);
    totalEl.textContent = fmt(duration);
    updateArmed();

    // One-time teach pulse on the first teacher message to hint chat is tappable.
    if (teacherMsgs.length) {
      teacherMsgs[0].el.classList.add('dz-teach');
      setTimeout(function () {
        teacherMsgs[0].el.classList.remove('dz-teach');
      }, 6000);
    }

    // Try muted autoplay; fall back silently if the browser blocks it.
    var p = video.play();
    if (p && p.catch) p.catch(function () {});

    // Once the user has poked at the demo, kill the wobble on the "Live demo →"
    // stamp — its attention-grabbing job is done.
    var wrap = root.parentElement;
    var stamp = wrap && wrap.querySelector('.dz-try-stamp');
    if (stamp) {
      root.addEventListener('pointerdown', function () {
        stamp.classList.add('dz-quiet');
      }, { once: true });
    }
  }

  var APP_STORE_URL = 'https://apps.apple.com/app/id6751278168';
  var PLAY_STORE_URL = 'https://play.google.com/apps/testing/app.dancejournal.dancenotes';

  // Monochrome brand glyphs — inherit currentColor so they read correctly on the
  // button's shifting backgrounds (nav transparent→gold, final white→gold).
  var APPLE_SVG = '<svg viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50.1-84.9-18.7-26.8-47.1-41.7-84.6-44.6-35.6-2.8-74.5 20.8-88.8 20.8-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>';
  var ANDROID_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.1064L4.841 5.4053a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396"/></svg>';

  function makeStoreButton(baseClass, url, svg, label) {
    var a = document.createElement('a');
    a.className = baseClass;
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = '<span class="dz-store-glyph" aria-hidden="true">' + svg + '</span>' +
                  '<span>' + label + '</span>';
    return a;
  }

  // Set up every [data-install-link] based on the platform class the inline <head>
  // script applied before paint. On a known mobile platform the whole button links
  // to that one store and shows its logo. On desktop / unknown platforms we can't
  // tell which phone the visitor has, so we split into two separate store buttons.
  function initInstallLinks() {
    var html = document.documentElement;
    var mobileApple   = html.classList.contains('platform-ios');
    var mobileAndroid = html.classList.contains('platform-android');
    var links = document.querySelectorAll('[data-install-link]');

    for (var i = 0; i < links.length; i++) {
      var el = links[i];

      if (mobileApple || mobileAndroid) {
        el.setAttribute('href', mobileApple ? APP_STORE_URL : PLAY_STORE_URL);
        var glyph = el.querySelector('[data-store-glyph]');
        if (glyph) glyph.innerHTML = mobileApple ? APPLE_SVG : ANDROID_SVG;
        continue;
      }

      // Unknown platform → two separate buttons, each reusing the original
      // button's styling (dz-nav-cta / dz-final-cta).
      var box = document.createElement('div');
      box.className = 'dz-install-dual';
      // Lead the two buttons with a short label.
      var isNav = el.className.indexOf('dz-nav-cta') !== -1;
      var lead = document.createElement('span');
      lead.className = 'dz-install-lead';
      lead.textContent = isNav ? 'Get it for' : 'Get it on';
      box.appendChild(lead);
      box.appendChild(makeStoreButton(el.className, APP_STORE_URL, APPLE_SVG, 'iOS'));
      box.appendChild(makeStoreButton(el.className, PLAY_STORE_URL, ANDROID_SVG, 'Android'));
      el.parentNode.replaceChild(box, el);
    }
  }

  // Toggle .scrolled on the nav so the wordmark collapses and the CTA fills.
  // Plain scroll listener (passive) is lighter than an IntersectionObserver sentinel
  // for this single boolean — no element to insert, no observer to manage.
  function initNavScroll() {
    var nav = document.querySelector('.dz-nav');
    if (!nav) return;
    function onScroll() {
      nav.classList.toggle('scrolled', window.scrollY > 8);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function boot() {
    var els = document.querySelectorAll('[data-notebook]');
    for (var i = 0; i < els.length; i++) init(els[i]);

    initInstallLinks();
    initNavScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
