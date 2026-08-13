# PR Review: guang/website-redesign-student-flow

> **Branch:** `guang/website-redesign-student-flow`
> **Last updated:** 2026-08-14
> **Reviewed through:** `4e95308` — the last commit this review covers
> **Status:** In review — 4 open issues

## Overview

Rewrites the dancejournal.app landing page from a three-pillar layout (Feedback / Compare / Progress, each a standalone section with its own mockup) into a single student-first narrative: Nav · Hero · HOW IT WORKS (a vertical timeline of 6 numbered steps + 1 unnumbered bonus) · Final CTA · Footer. The old Compare/Progress sections are gone; their content now lives as real app screenshots/video inside the timeline. A follow-up commit (`4e95308`) swapped static screenshots for autoplaying video loops on steps 1–3 and 6, retuned the phone-frame aspect ratio, and replaced the bonus row's hand-built interactive notebook demo with a plain screenshot. PR: [#21](https://github.com/guang/dancejournal/pull/21), issue [#20](https://github.com/guang/dancejournal/issues/20).

## Issues to Address

- [x] ~~**[bug] Bonus demo phone renders squashed on desktop/tablet (>720px)**~~ — `assets/landing.css:323,329,402` — Moot as of `4e95308`: the bonus row no longer uses `.dz-app-phone`/`data-notebook` at all — it's now a plain `.dj-phone > img` like every other step, and both offending rules (`.dz-tl-bonus .dz-tl-shot .dz-app-phone` at desktop and its `@media (max-width: 720px)` override) were deleted outright rather than fixed in place. — fixed in `4e95308`.

- [ ] **[architecture] Dead CSS left behind by the section removal** — `assets/landing.css:332-393, 668-691, 828` — Still present, unchanged by the delta. The old three-pillar section markup (`.dz-section`, `.dz-section-inner`, `.dz-highlight`/`.dz-highlight-svg`, `.dz-split`/`.dz-split-text`/`.dz-split-visual`, `.dz-stamped-card`, `.dz-sub`, `.dz-chip`, `.dz-feedback-note`) and the `.dz-section h2 .nowrap` rule (plus its mobile override) are still unreferenced anywhere in `index.html` or `assets/landing.js`. _Simpler:_ delete the now-unused blocks in the same pass as the item below — same objective (CSS matches current markup) with meaningfully less dead weight.

- [ ] **[architecture] Retiring the bonus notebook demo orphaned ~260 lines of CSS + ~320 lines of JS + a 2.1MB video asset** — `assets/landing.css:250-260,405-668,824`, `assets/landing.js:26-342,447`, `assets/video/notebook-demo.mp4` (+ poster) — `4e95308` deleted the `data-notebook` markup from `index.html` (the interactive scrubber/chat-thread demo in the bonus row is now a plain screenshot), but left its entire supporting engine in place: `.dz-app-phone`, `.dz-app-bar*`, `.dz-app-video*`, `.dz-app-scrubber*`, `.dz-app-chat*`, `.dz-chat-*`, `.dz-scrub-*`, `.dz-phone-wrap`, `.dz-try-stamp` (+ mobile override) in CSS, the entire `init(root)` function and its `querySelectorAll('[data-notebook]')` call site in `boot()` in `landing.js` (now iterates zero elements — the whole ~316-line function is unreachable), and `assets/video/notebook-demo.mp4`/`notebook-demo-poster.jpg` (2.1MB, no longer linked from any `.html` file in the repo). Also a related pre-existing (not introduced by this PR) dead pair worth sweeping up in the same pass: `assets/video/library-overview.mp4`/`-poster.jpg` (710KB) — already unreferenced before `65e05e5`. _Simpler:_ delete the `init`/`boot` notebook wiring in `landing.js`, the `.dz-app-*`/`.dz-chat-*`/`.dz-scrub-*`/`.dz-phone-wrap`/`.dz-try-stamp` CSS blocks, and the four now-orphaned video/poster files — ~2.8MB and ~600 lines removed for a demo that no longer exists on the page.

- [ ] **[concern] Four autoplaying videos load unconditionally on page load, ~5MB total, no lazy-loading** — `index.html:85-89,104-108,123-127,176-180` — Steps 1, 2, 3, and 6 each render `<video muted playsinline loop autoplay preload="auto">`, all four inside the initial DOM (step 3 and step 6 are below the fold). `preload="auto"` + `autoplay` means the browser starts fetching and decoding all four immediately, regardless of scroll position — `step-1-import.mp4` (2.7MB) + `step-2-goal.mp4` (895KB) + `step-3-loop.mp4` (1.2MB) + `step-6-progress.mp4` (324KB) ≈ 5MB, on a landing page whose whole point is a fast first impression, and worse on cellular. There's no `IntersectionObserver`/lazy pattern in `landing.js` for these (the one `IntersectionObserver` mention in the file is a comment explaining why the *nav scroll* listener deliberately avoids one — unrelated). _Fix:_ either lazy-start playback (swap `autoplay` for a scroll-triggered `.play()` once each phone enters the viewport, keeping the poster as the pre-play frame) or drop `preload="auto"` to `preload="metadata"`/`"none"` for the below-the-fold steps (3, 6) so only what's likely to be seen loads eagerly.

## Key Workflows to Verify

- **Scroll the full timeline at desktop width** — Load the page ≥1024px wide and scroll through all 6 steps + the bonus row. **Watch:** alternating left/right layout reads correctly, the rail connector line stays centered behind the numbered badges, and each video (steps 1, 2, 3, 6) autoplays smoothly without jank as it scrolls into view — check whether page load itself feels sluggish given the ~5MB of eager video, per the concern above.
- **Resize through the tablet/mobile breakpoints (1024px → 768px → 720px → 375px)** — Watch the timeline specifically around 720px, where the layout switches from the alternating 3-column grid to the stacked 2-column (number rail + content) mobile layout. **Watch:** no row briefly shows a screenshot/video above its own title during the transition, and confirm the phone frame's new aspect ratio (`260×520` desktop / `1:2` mobile) doesn't visibly letterbox or over-crop any of the media.
- **Compare each timeline screenshot/video against its caption** — Steps 1–7 each show real app media; spot-check that none is visibly cropped in a way that loses the thing the copy is pointing at. Per the (now smaller, ~3–8%) bottom-crop margin below, pay closest attention to step 4's side-by-side comparison and step 5's pinned annotation, where the cropped strip is most likely to contain meaningful content.
- **Play each video on a slow/throttled connection (Chrome DevTools → Network → Slow 4G)** — **Watch:** whether the poster image displays cleanly while the video buffers, and whether the page still feels usable before all four videos finish loading — this is the practical test for the eager-loading concern above.
- **Share the URL through a social debugger** (Twitter/X Card Validator or Facebook Sharing Debugger against `https://dancejournal.app/`) — **Watch:** new hero copy ("(actually) reach your dance goals.") and the `step-5-annotate.jpg`-based OG card render correctly; this can only be verified once the branch is deployed, not from a local file open.
- **Click the download CTA in the hero and the final CTA on each target platform (iOS / Android / desktop)** — unchanged by this PR but shares the page with the removed hero chips; confirm nothing about the CTA's platform detection or layout shifted now that the chip row beneath it is gone.

## File Groups

### 1. Landing page markup — `index.html`
Replaces the `#feedback`/`#compare`/`#practice` sections and their hero chip links with one `.dz-timeline` section containing 6 numbered `.dz-tl-row` steps plus an unnumbered `.dz-tl-bonus` row. `4e95308` swapped the static `<img>` in steps 1, 2, 3, and 6 for autoplaying `<video>` loops, and replaced the bonus row's hand-built interactive demo (`data-notebook`, scrubber, simulated chat thread) with a plain `<img>` — same shape as the other steps now. Meta tags (title, description, OG, Twitter) were updated to the new hero copy across both commits (`"Actually reach your dance goals."` → `"(actually) reach your dance goals."`). No dangling anchor references remain (verified: nav and `landing.js` don't reference the removed section IDs).

### 2. Styling — `assets/landing.css`
Adds the `.dz-timeline`/`.dz-tl-*` rule set and removes several now-unused blocks tied to the deleted hero chips, progress flowchart, mini callouts, and compare callouts. `4e95308` retuned `.dz-tl-shot .dj-phone` height (556px → 520px desktop, `300/640` → `1/2` mobile aspect-ratio) to better match the real screenshots' native ratio, extended the `img` cover/crop rule to also cover `video`, and deleted the two bonus-phone-specific rules that caused the now-resolved specificity bug — but left the entire `.dz-app-*`/`.dz-chat-*`/`.dz-scrub-*` rule set those elements used to belong to still in the file, now fully dead (see Issues above). Still stops short of removing the older generation of dead CSS from the original section removal (`.dz-section`, `.dz-split*`, `.dz-highlight*`, `.dz-chip`, `.dz-feedback-note`, `.nowrap`).

### 3. Behavior — `assets/landing.js`
Not touched by either commit, but `4e95308`'s markup change silently orphaned the `init(root)` function (lines 26–342) — it's wired up in `boot()` via `document.querySelectorAll('[data-notebook]')`, which now matches zero elements since the only `data-notebook` element in the page was deleted. The function and its associated scrubber/chat-thread/speed-toggle logic are unreachable dead code (see Issues above). `initInstallLinks`, `initDownloadCtas`, `initNavScroll` are unaffected.

### 4. Media — `assets/shots/*`, `assets/video/*`
Steps 1, 2, 3, and 6 now use looping muted autoplay `<video>` (each with a JPG poster) instead of static screenshots — sourced from four new `.mp4`/`-poster.jpg` pairs in `assets/video/`. Steps 4 and 5 remain static screenshots, untouched. The bonus row's screenshot is new (`step-7-feedback.jpg`, replacing the old interactive demo). The four old static screenshots for steps 1/2/3/6 (`step-1-import.jpg` etc.) were deleted. `notebook-demo.mp4`/`-poster.jpg` (2.1MB) is now orphaned by the bonus-row markup change; `library-overview.mp4`/`-poster.jpg` (710KB) was already orphaned before this PR. See the eager-loading concern above re: the new videos' combined ~5MB weight.

### 5. Social share card — `assets/social/og-card.html`, `assets/social/og-card.png`
Headline, chip labels ("Loop it / Compare it / Pin the fix"), and featured screenshot (`step-5-annotate.jpg`) updated to match the new page narrative. `og-card.png` dimensions verified unchanged at 1200×630. Not touched by `4e95308`.

## Changes Made During Review

| # | Change | Commit |
|---|--------|--------|
| 1 | Swapped static screenshots for autoplay video loops (steps 1–3, 6); replaced bonus-row interactive notebook demo with a plain screenshot; retuned phone-frame aspect ratio to match screenshot ratios; removed the two CSS rules causing the bonus-phone specificity bug | `4e95308` |

## Open Questions / Future Work

- Should the eager-video-loading concern be fixed before merge, or tracked as fast-follow? Given the branch's whole premise is a snappier, more credible first impression, a ~5MB unconditional page-load payload seems worth resolving pre-merge rather than after.
- No repo-specific review checklist exists yet for `dancejournal` (only `dancenotes` and `dj-crm` have one under `~/.claude/skills/pr-review-live/checklists/`). Worth adding one if this repo keeps recurring bug patterns (e.g. this session's "markup changed, supporting CSS/JS left behind" pattern would be a good first entry).
