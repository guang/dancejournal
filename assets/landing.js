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
    var fwdBtn      = root.querySelector('[data-notebook-fwd]');
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
    backBtn.addEventListener('click', function () { seek(video.currentTime - 5); });
    fwdBtn .addEventListener('click', function () { seek(video.currentTime + 5); });

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

  // Point every [data-install-link] at the right store based on the platform class
  // applied by the inline script in <head>. Apple ecosystem → App Store; everything
  // else → Play Store.
  function initInstallLinks() {
    var APP_STORE_URL = 'https://apps.apple.com/app/id6751278168';
    var PLAY_STORE_URL = 'https://play.google.com/apps/testing/app.dancejournal.dancenotes';
    var html = document.documentElement;
    var useAppStore = html.classList.contains('platform-ios') ||
                      html.classList.contains('platform-macos');
    var url = useAppStore ? APP_STORE_URL : PLAY_STORE_URL;
    var links = document.querySelectorAll('[data-install-link]');
    for (var i = 0; i < links.length; i++) links[i].setAttribute('href', url);
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
