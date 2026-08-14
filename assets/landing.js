(function () {
  'use strict';

  var APP_STORE_URL = 'https://apps.apple.com/app/id6751278168';
  var PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.dancejournal.dancenotes';

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

  // Build the explicit "Download for iPhone / Android" buttons into any
  // [data-download-cta] container (hero + final CTA). Mirrors initInstallLinks'
  // platform detection: a known phone shows only its own store; desktop / unknown
  // platforms are ambiguous, so we show both. Each button's styling comes from the
  // container's data-btn-class (dz-download-btn in the hero, dz-final-cta below).
  function initDownloadCtas() {
    var html = document.documentElement;
    var mobileApple   = html.classList.contains('platform-ios');
    var mobileAndroid = html.classList.contains('platform-android');
    var groups = document.querySelectorAll('[data-download-cta]');

    for (var i = 0; i < groups.length; i++) {
      var box = groups[i];
      var btnClass = box.getAttribute('data-btn-class') || 'dz-download-btn';
      var iphone  = makeStoreButton(btnClass, APP_STORE_URL,  APPLE_SVG,   'Download for iPhone');
      var android = makeStoreButton(btnClass, PLAY_STORE_URL, ANDROID_SVG, 'Download for Android');

      if (mobileApple) {
        box.appendChild(iphone);
      } else if (mobileAndroid) {
        box.appendChild(android);
      } else {
        box.appendChild(iphone);
        box.appendChild(android);
      }
    }
  }

  // Toggle .scrolled on the nav so the wordmark collapses and the CTA fills.
  // Plain scroll listener (passive) is lighter than an IntersectionObserver sentinel
  // for this single boolean — no element to insert, no observer to manage.
  function initNavScroll() {
    var nav = document.querySelector('.dz-nav');
    if (!nav) return;
    // Hysteresis: separate on/off thresholds leave a dead zone between them so the
    // class can't rapidly flip when the scroll position parks near the trigger.
    // .scrolled shrinks the sticky nav's padding (~12px of height), and that layout
    // shift makes the browser's scroll anchoring nudge scrollY by a few px — enough
    // to recross a single threshold and cause a visible white↔gold flicker. The gap
    // (24px) comfortably exceeds that nudge.
    var ON = 32, OFF = 8;
    var scrolled = false;
    function onScroll() {
      var y = window.scrollY;
      if (!scrolled && y > ON) {
        scrolled = true;
        nav.classList.add('scrolled');
      } else if (scrolled && y < OFF) {
        scrolled = false;
        nav.classList.remove('scrolled');
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Timeline step videos start fetching/playing only once they're about to
  // scroll into view (rootMargin gives it a head start), instead of all four
  // loading + autoplaying on page load — the combined ~5MB was hurting first
  // load, and steps 3/6 sit below the fold anyway. The poster image covers
  // the gap until playback starts.
  function initLazyVideos() {
    var videos = document.querySelectorAll('[data-lazy-video]');
    if (!videos.length) return;
    if (!('IntersectionObserver' in window)) {
      videos.forEach(function (v) { v.play(); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var p = entry.target.play();
        if (p && p.catch) p.catch(function () {});
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '200px 0px' });
    videos.forEach(function (v) { observer.observe(v); });
  }

  function boot() {
    initInstallLinks();
    initDownloadCtas();
    initNavScroll();
    initLazyVideos();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
