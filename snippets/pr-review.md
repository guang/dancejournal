# PR Review: guang/website-redesign-student-flow

> **Branch:** `guang/website-redesign-student-flow`
> **Last updated:** 2026-08-14
> **Reviewed through:** `455be78` — the last commit this review covers (fixes below are applied in the working tree on top of it)
> **Status:** In review — 0 open issues (all fixed this session, pending commit)

## Overview

Rewrites the dancejournal.app landing page from a three-pillar layout (Feedback / Compare / Progress) into a single student-first narrative: Nav · Hero · HOW IT WORKS (a vertical timeline of 6 numbered steps + 1 unnumbered bonus) · Final CTA · Footer. Two follow-up commits swapped static screenshots for autoplaying video loops on steps 1–3 and 6, retuned the phone-frame aspect ratio, replaced the bonus row's interactive notebook demo with a screenshot, tightened all timeline copy, and fixed a nav-overflow bug. PR: [#21](https://github.com/guang/dancejournal/pull/21), issue [#20](https://github.com/guang/dancejournal/issues/20).

## Issues to Address

- [x] ~~**[bug] Bonus demo phone renders squashed on desktop/tablet (>720px)**~~ — Moot: the bonus row no longer uses `.dz-app-phone` at all. — fixed in `4e95308`.

- [x] ~~**[bug] Video recording-pill crop clips real UI off the left/right edges**~~ — `assets/landing.css` (`.dj-phone-screen video`) — `455be78`'s fix for the red iOS recording-pill (visible because `object-position: top` keeps the source's top edge, pill included, fully in frame) oversized the video box to `height: 122%` with `top: -12%` to push the crop point down. Oversizing the box changed *its own aspect ratio* (0.41) away from the container's (0.5), which flipped `object-fit: cover`'s crop axis from vertical to horizontal — confirmed by rendering it: the right-side action rail ("Practice"/"Note"/"More") and left-edge captions were being cut off on all 4 videos, both desktop and mobile widths. _Fix applied:_ reverted to the same `width:100%; height:100%` box as `img` (matches container aspect, so `cover` only ever crops vertically), and simply changed `object-position` from `top center` to `bottom center` for `video` — this spends `cover`'s existing ~7–8% vertical crop budget on hiding the top chrome instead of the bottom, with zero horizontal side effects. Verified via ffmpeg-extracted frames + live browser render (network + screenshots) across all 4 videos at desktop (1024px) and mobile (375px) widths — no more edge clipping. — fixed in working tree, pending commit.
  - **Residual, minor:** during a ~1s "swipe to step" transition segment that appears in all 4 source recordings, a sliver of the red pill briefly peeks through (that segment's UI chrome is taller than the ~7-8% crop budget the status-bar case needed). Much smaller/less damaging than the horizontal-crop bug it replaces; would need trimming the source clips to fully eliminate — flagging for your visual judgment rather than guessing further at CSS.

- [x] ~~**[architecture] Dead CSS left behind by the section removal**~~ — `assets/landing.css` — Removed all of it: `.dz-section`/`.dz-section-inner`/`.dz-section.cream`/`.dz-section.dark` (+ its now-pointless `.dj-phone` dark-bezel override), `.dz-highlight`/`.dz-highlight-svg`, `.dz-split`/`.dz-split-text`/`.dz-split-visual` (+ its `1024px`/`768px` responsive overrides), `.dz-stamped-card`, `.dz-sub`, `.dz-chip`, `.dz-feedback-note`/`.dz-feedback-chip-tl`/`.dz-feedback-chip-br`, and the `.dz-section h2 .nowrap` rule + its mobile override. Confirmed zero remaining references via full-repo grep before deleting. — fixed in working tree, pending commit.

- [x] ~~**[architecture] Retiring the bonus notebook demo orphaned ~260 lines of CSS + ~320 lines of JS + a 2.1MB video asset**~~ — Removed the entire dead engine: `.dz-app-phone`/`.dz-app-bar*`/`.dz-app-video*`/`.dz-app-scrubber*`/`.dz-app-chat*`/`.dz-chat-*`/`.dz-scrub-*`/`.dz-phone-wrap`/`.dz-float`/`.dz-try-stamp`/`.dz-notebook-stage`/`.dz-phone-stage` (+ mobile overrides) from `landing.css`, the entire `init(root)` function (316 lines) and its dead `boot()` call site from `landing.js` (460 → 150 lines), the 4 now-`.dz-app-ctrl`/`.dz-chat-*`/`.dz-chat-input` selectors from the shared focus-ring rule, and the orphaned `notebook-demo.mp4`/`-poster.jpg` (2.1MB) + the pre-existing (not from this PR) `library-overview.mp4`/`-poster.jpg` (710KB) video files. Verified with `node -c` (both files parse) and a live render (no console errors, every timeline row still renders correctly). — fixed in working tree, pending commit.

- [x] ~~**[concern] Four autoplaying videos load unconditionally on page load, ~5MB total, no lazy-loading**~~ — `index.html`, `assets/landing.js` — Removed `autoplay` and changed `preload="auto"` → `preload="none"` on all 4 timeline videos; added `initLazyVideos()` (IntersectionObserver, 200px rootMargin) that calls `.play()` once a video is about to scroll into view, then unobserves. Verified via the network tab: page load now fetches only the 4 lightweight poster JPGs (0 `.mp4` requests); scrolling to step 1/2 triggers exactly those two `.mp4` requests, with steps 3/6 still unfetched until scrolled closer. — fixed in working tree, pending commit.

## Key Workflows to Verify

- **Scroll the full timeline at desktop width** — Load the page ≥1024px wide and scroll through all 6 steps + the bonus row. **Watch:** alternating left/right layout reads correctly, the rail connector line stays centered behind the numbered badges, each video starts playing smoothly as it's about to enter view (not before), and no recording-pill sliver is visible except briefly during the "swipe to step" transition noted above.
- **Resize through the tablet/mobile breakpoints (1024px → 900px → 768px → 720px → 375px)** — Confirmed via headless-frame testing this session: the nav's "Get it for / iOS / Android" fallback (shown on desktop/unknown platforms) never wraps awkwardly across this whole range, and the `.dz-install-lead` text correctly disappears below 768px, leaving just the two store pills. No further verification needed here.
- **Play each video on a slow/throttled connection** (Chrome DevTools → Network → Slow 4G) — **Watch:** the poster image should hold cleanly until a video's phone frame is about to scroll into view, at which point that single video (not all 4) starts fetching. This is now the expected, verified behavior — a quick real-device spot check is still worth doing before shipping.
- **Compare each timeline screenshot/video against its caption** — Steps 1–7 each show real app media; spot-check step 4's side-by-side comparison and step 5's pinned annotation aren't cropped in a way that loses the pointed-at content (unrelated to this session's fixes — these two steps still use the original `img`-based crop rule).
- **Share the URL through a social debugger** (Twitter/X Card Validator or Facebook Sharing Debugger against `https://dancejournal.app/`) — **Watch:** hero copy and OG card render correctly; only verifiable once deployed.
- **Click the download CTA in the hero and the final CTA on each target platform (iOS / Android / desktop)** — unchanged this session; confirm nothing about platform detection shifted.

## File Groups

### 1. Landing page markup — `index.html`
Timeline steps 1–3 and 6 now use `<video>` with `preload="none"` (no `autoplay` attribute — playback is now driven entirely by `initLazyVideos()` in `landing.js`, keyed off the new `data-lazy-video` attribute). Copy across all 7 timeline entries was shortened for scannability; em dashes replaced with hyphens throughout (title/OG/Twitter tags too). "(beta)" dropped from the Android line now that it's out of beta.

### 2. Styling — `assets/landing.css`
912 → 504 lines this session. The video crop fix (`.dj-phone-screen video`) now shares its box sizing with `img` and only overrides `object-position`. All CSS for the removed three-pillar sections and the removed notebook-demo engine is gone — the file now contains only rules with a live selector match in `index.html`. Nav gets `flex-wrap`/`row-gap` so the "Get it for + iOS + Android" fallback wraps instead of overflowing on narrow desktop widths (verified: it never actually needs to wrap in practice, see Key Workflows).

### 3. Behavior — `assets/landing.js`
460 → 150 lines. The dead notebook-demo controller (`init()`, scrubber/chat-thread/speed-toggle logic) is gone. New `initLazyVideos()` lazily starts each timeline video via `IntersectionObserver` instead of relying on the `autoplay` attribute, with a synchronous `.play()` fallback for browsers without `IntersectionObserver` support.

### 4. Media — `assets/shots/*`, `assets/video/*`
`notebook-demo.mp4`/`-poster.jpg` (orphaned by this PR) and `library-overview.mp4`/`-poster.jpg` (already orphaned before this PR) are deleted — both fully unreferenced, confirmed via repo-wide grep before removal.

### 5. Social share card — `assets/social/og-card.html`, `assets/social/og-card.png`
Untouched this session.

## Changes Made During Review

| # | Change | Commit |
|---|--------|--------|
| 1 | Swapped static screenshots for autoplay video loops (steps 1–3, 6); replaced bonus-row interactive notebook demo with a plain screenshot; retuned phone-frame aspect ratio; removed the bonus-phone specificity bug | `4e95308` |
| 2 | Tightened timeline copy; first attempt at cropping the video recording-pill (later found to clip content horizontally); nav flex-wrap fix; dropped "(beta)" | `455be78` |
| 3 | Fixed the video-crop regression (object-position swap, no more horizontal clipping); removed all dead three-pillar + notebook-demo CSS/JS/assets; made timeline videos lazy-load instead of eager-autoplay | working tree, pending commit |

## Open Questions / Future Work

- The brief pill-sliver during the "swipe to step" transition frame (noted above) — worth a look next time the source clips are touched, otherwise leave as-is.
- No repo-specific review checklist exists yet for `dancejournal`. This session's recurring pattern — "markup/CSS changed, but the box-sizing side effects of a `cover`-crop tweak weren't checked against the browser" and "a UI element's removal orphans its CSS+JS+asset trio" — would make a good first entry in `~/.claude/skills/pr-review-live/checklists/dancejournal.md`.
