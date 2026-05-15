(function () {
  'use strict';

  // Placeholder notes — swap with real ones once we have them.
  // { t: seconds, text, gold? }
  var NOTES = [
    { t: 3,  text: 'small step back on the 1, not the 5',          gold: false },
    { t: 8,  text: 'commit the body roll BEFORE the hand turn',    gold: true  },
    { t: 13, text: 'lower the frame — shoulders are creeping up',  gold: false },
    { t: 17, text: 'chest stays over the right foot',              gold: false },
  ];

  // Loop window (seconds). The source video may be longer; we cap the demo.
  var LOOP_END = 20;

  // How long a note's caption + active highlight sticks after its timestamp.
  var ACTIVE_WINDOW = 4;

  function fmt(s) {
    s = Math.max(0, s);
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function init(root) {
    var video    = root.querySelector('[data-notebook-video]');
    var bar      = root.querySelector('[data-notebook-bar]');
    var fill     = root.querySelector('.dz-scrub-fill');
    var knob     = root.querySelector('.dz-scrub-knob');
    var curEl    = root.querySelector('[data-notebook-cur]');
    var totalEl  = root.querySelector('[data-notebook-total]');
    var playBtn  = root.querySelector('[data-notebook-play]');
    var backBtn  = root.querySelector('[data-notebook-back]');
    var fwdBtn   = root.querySelector('[data-notebook-fwd]');
    var capEl    = root.querySelector('[data-notebook-caption]');
    var capTs    = capEl.querySelector('.dz-app-caption-ts');
    var capText  = capEl.querySelector('.dz-app-caption-text');
    var notesEl  = root.querySelector('[data-notebook-notes]');

    var dragging = false;
    var noteEls = [];
    var tickEls = [];
    var duration = LOOP_END;
    // While dragging, render this position instead of video.currentTime so
    // the playhead tracks the cursor even if the video can't seek that fast.
    var dragTime = null;

    // Build note rows + scrub-bar ticks.
    NOTES.forEach(function (n) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'dz-app-note';
      var ts = document.createElement('span');
      ts.className = 'dj-ts' + (n.gold ? ' gold' : '');
      ts.textContent = fmt(n.t);
      var txt = document.createElement('span');
      txt.className = 'text';
      txt.textContent = n.text;
      row.appendChild(ts);
      row.appendChild(txt);
      row.addEventListener('click', function () { seek(n.t); });
      notesEl.appendChild(row);
      noteEls.push(row);

      var tick = document.createElement('div');
      tick.className = 'dz-scrub-tick';
      tick.style.left = ((n.t / LOOP_END) * 100) + '%';
      bar.appendChild(tick);
      tickEls.push(tick);
    });

    function activeIdx(t) {
      var idx = -1;
      for (var i = 0; i < NOTES.length; i++) {
        if (NOTES[i].t <= t + 0.1) idx = i;
      }
      if (idx >= 0 && t - NOTES[idx].t > ACTIVE_WINDOW) return -1;
      return idx;
    }

    function setPlayIcon(playing) {
      playBtn.innerHTML = playing
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>';
    }

    function render() {
      var t = (dragTime != null) ? dragTime : Math.min(video.currentTime || 0, duration);
      var pct = Math.min(100, Math.max(0, (t / duration) * 100));
      fill.style.width = pct + '%';
      knob.style.left  = pct + '%';
      curEl.textContent = fmt(t);

      var ai = activeIdx(t);
      for (var i = 0; i < noteEls.length; i++) {
        noteEls[i].classList.toggle('active', i === ai);
        tickEls[i].classList.toggle('active', i === ai);
      }
      if (ai >= 0) {
        capTs.className = 'dj-ts dz-app-caption-ts' + (NOTES[ai].gold ? ' gold' : '');
        capTs.textContent = fmt(NOTES[ai].t);
        capText.textContent = NOTES[ai].text;
        capEl.hidden = false;
      } else {
        capEl.hidden = true;
      }
    }

    function seek(t) {
      t = Math.max(0, Math.min(duration - 0.05, t));
      try { video.currentTime = t; } catch (_) {}
    }

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

    // Continuous render loop — keeps the playhead smooth between the sparse
    // timeupdate events the browser fires.
    (function tick() {
      render();
      requestAnimationFrame(tick);
    })();

    // Initial state.
    setPlayIcon(false);
    totalEl.textContent = fmt(duration);

    // Try muted autoplay; fall back silently if the browser blocks it.
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  function boot() {
    var els = document.querySelectorAll('[data-notebook]');
    for (var i = 0; i < els.length; i++) init(els[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
