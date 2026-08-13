# PR Review: guang/website-redesign-student-flow

> **Branch:** `guang/website-redesign-student-flow`
> **Last updated:** 2026-08-13
> **Reviewed through:** `65e05e5` — the last commit this review covers
> **Status:** In review — iterating

## Overview

Rewrites the dancejournal.app landing page from a three-pillar layout (Feedback / Compare / Progress, each a standalone section with its own mockup) into a single student-first narrative: Nav · Hero · HOW IT WORKS (a vertical timeline of 6 numbered steps + 1 unnumbered bonus) · Final CTA · Footer. The old Compare/Progress sections are gone; their content now lives as real app screenshots inside timeline steps 4 and 6. PR: [#21](https://github.com/guang/dancejournal/pull/21), issue [#20](https://github.com/guang/dancejournal/issues/20).

## Issues to Address

- [ ] **[bug] Bonus demo phone renders squashed on desktop/tablet (>720px)** — `assets/landing.css:323,329,402` — Three rules compete for the interactive bonus-row phone's (`.dj-phone.dz-app-phone`) box size: `.dz-tl-shot .dj-phone` (specificity 0,2,0) sets `width:260px; height:556px`; `.dz-tl-bonus .dz-tl-shot .dz-app-phone` (0,3,0) sets only `width: min(280px,100%)`; the base `.dz-app-phone` (0,1,0) sets `width:min(308px,…); height:min(740px,…)`. Because CSS resolves each *property* independently by specificity, width resolves to `min(280px,100%)` (highest-specificity rule wins) but height falls back to `556px` from the 0,2,0 rule — not the intended `740px`-based native height. Net effect: the interactive demo phone renders at ~280×556 (ratio 0.50) instead of its native 308×740 (ratio 0.42), i.e. visibly stubbier/wider than a real phone silhouette. The `@media (max-width: 720px)` block *does* fix this explicitly (`assets/landing.css:805`: `.dz-tl-bonus .dz-tl-shot .dz-app-phone { height: auto; aspect-ratio: 308 / 740; }`), which confirms this was a known problem that only got patched for mobile. _Fix:_ add the same `height: auto; aspect-ratio: 308 / 740;` to the unscoped `.dz-tl-bonus .dz-tl-shot .dz-app-phone` rule at line 329 so desktop/tablet isn't left on the accidental 556px height.

- [ ] **[architecture] Dead CSS left behind by the section removal** — `assets/landing.css:332-393, 668-691, 828` — The old three-pillar section markup (`.dz-section`, `.dz-section-inner`, `.dz-highlight`/`.dz-highlight-svg`, `.dz-split`/`.dz-split-text`/`.dz-split-visual`, `.dz-stamped-card`, `.dz-sub`, `.dz-chip`, `.dz-feedback-note`) and the `.dz-section h2 .nowrap` rule (plus its mobile override at line 828) are no longer referenced anywhere in `index.html` or `assets/landing.js` — confirmed via grep, zero hits for every one of these class names outside `landing.css` itself. This PR already deleted the matching `.dz-hero-chips*`, `.dz-progress-flow`/`.dz-flow-*`, `.dz-mini-callouts`, and `.dz-compare-callout*` blocks (good), but stopped short of the rest of the same generation of dead code. _Simpler:_ delete the now-unused blocks in the same pass — same objective (a CSS file that matches the current markup) with meaningfully less dead weight to trip over on the next redesign.

- [ ] **[concern] Screenshot aspect ratios vary; top-anchored `cover` crop may cut content** — `assets/landing.css:133-135` (`.dj-phone-screen img { object-fit: cover; object-position: top center; }`) vs. the six new screenshots, whose native ratios range 0.462–0.514 (w/h) against the fixed phone-frame ratio of ~0.468 (260×556 desktop) / 300:640 (mobile). Images wider-than-frame (e.g. `step-3-loop.jpg` at 0.514) get side-cropped; images taller-than-frame (e.g. `step-4-compare.jpg` at 0.462, the widest miss) get bottom-cropped since anchoring is `top center`. `step-4-compare` is specifically the side-by-side comparison screenshot — worth confirming visually that the bottom crop doesn't clip the second (bottom) video or its controls. _Fix:_ no code change needed if a visual check confirms nothing important sits in the cropped margin; otherwise re-crop the source screenshot before re-exporting.

## Key Workflows to Verify

- **Scroll the full timeline at desktop width** — Load the page ≥1024px wide and scroll through all 6 steps + the bonus row. **Watch:** alternating left/right layout reads correctly, the rail connector line stays centered behind the numbered badges, and — per the bug above — check whether the bonus interactive demo phone (step "+") looks visibly squat/wide compared to the numbered steps' phone frames.
- **Resize through the tablet/mobile breakpoints (1024px → 768px → 720px → 375px)** — Watch the timeline specifically around 720px, where the layout switches from the alternating 3-column grid to the stacked 2-column (number rail + content) mobile layout. **Watch:** no row briefly shows a screenshot above its own title during the transition (this is what the explicit `grid-column`/`grid-row` placement in the `@media (max-width: 720px)` block is meant to prevent), and confirm the bonus phone is proportional here (it should be, since the mobile aspect-ratio override applies).
- **Compare each timeline screenshot against its caption** — Steps 1–6 each show a real app screenshot; spot-check that none is visibly cropped in a way that loses the thing the copy is pointing at (especially step 4's side-by-side comparison and step 5's pinned annotation, per the concern above).
- **Share the URL through a social debugger** (Twitter/X Card Validator or Facebook Sharing Debugger against `https://dancejournal.app/`) — **Watch:** new hero copy ("Actually reach your dance goals.") and the `step-5-annotate.jpg`-based OG card render correctly; this can only be verified once the branch is deployed, not from a local file open.
- **Click the download CTA in the hero and the final CTA on each target platform (iOS / Android / desktop)** — unchanged by this PR but shares the page with the removed hero chips; confirm nothing about the CTA's platform detection or layout shifted now that the chip row beneath it is gone.

## File Groups

### 1. Landing page markup — `index.html`
Replaces the `#feedback`/`#compare`/`#practice` sections and their hero chip links with one `.dz-timeline` section containing 6 numbered `.dz-tl-row` steps plus an unnumbered `.dz-tl-bonus` row. The bonus row reuses the existing interactive demo phone (`data-notebook` video player) unchanged — only its container moved. Meta tags (title, description, OG, Twitter) were updated to the new hero copy. No dangling anchor references remain (verified: nav and `landing.js` don't reference the removed section IDs).

### 2. Styling — `assets/landing.css`
Adds the `.dz-timeline`/`.dz-tl-*` rule set (rail connector, alternating desktop grid, dedicated mobile re-flow at `≤720px`) and removes several now-unused blocks tied to the deleted hero chips, progress flowchart, mini callouts, and compare callouts. Stops short of removing the older generation of dead CSS from the same section removal (`.dz-section`, `.dz-split*`, `.dz-highlight*`, `.dz-chip`, `.dz-feedback-note`, `.nowrap`) — see Issues above. Also introduces the specificity conflict on the bonus phone's height.

### 3. Screenshots — `assets/shots/*`
Three old mockup PNGs (`compare-screen.png`, `feedback-screen.png`, `progress-screen.png`) replaced with six real app screenshots (`step-1-import.jpg` … `step-6-progress.jpg`), one per timeline step. Reasonable file sizes (61–107KB). Aspect ratios aren't uniform across the set — see the cropping concern above.

### 4. Social share card — `assets/social/og-card.html`, `assets/social/og-card.png`
Headline, chip labels ("Loop it / Compare it / Pin the fix"), and featured screenshot (`step-5-annotate.jpg`) updated to match the new page narrative. `og-card.png` dimensions verified unchanged at 1200×630.

## Changes Made During Review

| # | Change | Commit |
|---|--------|--------|

## Open Questions / Future Work

- None yet — this is the first pass through the diff.
