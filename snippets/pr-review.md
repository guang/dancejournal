# PR Review: 22-whats-new-nav-link-and-changelog-backfill

> **Branch:** `22-whats-new-nav-link-and-changelog-backfill`
> **Last updated:** 2026-08-15
> **Reviewed through:** `91adaba` — the last commit this review covers
> **Status:** In review — 0 bugs open, 2 concerns open

## Overview

Adds a handwritten-style "What's New" link to the site nav (`index.html` and `changelog.html`), pointing at `changelog.html`, with a mobile behavior that hides it at the top of the page and slides it in once the nav is scrolled. Also backfills three changelog entries (v0.11.0, v0.12.0, v0.13.0) that were missing — `changelog.html` had been published on `main` covering only through v0.10.0, with no nav entry point at all. PR: [#23](https://github.com/guang/dancejournal/pull/23), issue [#22](https://github.com/guang/dancejournal/issues/22).

> Note: `snippets/pr-review.md` previously held the (fully resolved) review for the unrelated, already-merged PR #21. That content is superseded by this review and not reproduced here.

## Issues to Address

- [x] ~~**[bug] "What's New" link is invisible but still focusable on mobile before scrolling**~~ — `assets/landing.css:452-459` — Inside the `max-width: 768px` breakpoint, `.dz-nav-whatsnew` collapsed via `max-width: 0; opacity: 0` (revealed via `.dz-nav.scrolled .dz-nav-whatsnew`) but stayed `display: inline-block` with no `visibility: hidden`, `pointer-events: none`, or `tabindex="-1"` — a keyboard user tabbing through the nav at the top of a mobile-width page would land on a real, operable link with zero visible width. _Fix applied:_ added `visibility: hidden` to the collapsed state and `visibility: visible` to `.dz-nav.scrolled .dz-nav-whatsnew`, plus `visibility` to the transition list so it still animates in step with `opacity`/`max-width`. — fixed in `dc0fb9a`.

- [x] ~~**[bug] Nav briefly wraps to two rows on mobile scroll (user-reported)**~~ — `assets/landing.css:450-475` — This is exactly the risk flagged (but unverified) in the "Key Workflows to Verify" list below — the untested crossfade turned out to have a real bug. Root-caused via forced-layout measurement in a live browser: on mobile, the unscrolled nav (word + collapsed "What's New" + CTA) has only ~2-3px of horizontal slack before `flex-wrap: wrap` (set on `.dz-nav` for the ambiguous-platform two-pill fallback) kicks in. The word's collapse and "What's New"'s reveal are two independent `max-width`/`opacity` transitions running concurrently; their eased curves don't sum to a constant width, so mid-transition the combined width transiently exceeds that razor-thin slack and forces a one-frame wrap to two rows before settling back to one. Confirmed by slowing the transition 12x (`transition-duration`/`delay` overrides) and screenshotting through it — pre-fix showed the full wordmark and fully-revealed "What's New" simultaneously occupying width that doesn't fit on one line. _Fix applied:_ sequenced the two animations with `transition-delay: 200ms` so the word always finishes collapsing/re-expanding before "What's New" starts moving in the opposite direction — their widths never grow at the same time, so the combined width is monotonic and never overshoots either resting state. Verified in both directions (computed `transitionDelay` matches per-direction expectation) and visually via slow-motion screenshots — no wrap observed at any sampled point. — fixed in `91adaba`.

- [ ] **[concern] Backfilled changelog dates are git-tag dates, not confirmed store-release dates** — `changelog.html:141,157,173` (v0.13.0 Aug 7, v0.12.0 Jul 22, v0.11.0 Jun 30) — Existing entries (v0.8.2, v0.9.0) matched their tag date exactly, but v0.10.0 was 2 days after its tag (presumably App Store review lag). The three new dates are unverified against actual store release dates and could be off by a day or two. _Fix:_ spot-check against App Store Connect / Play Console release history before merging, or accept the tag-date approximation as good enough for a marketing changelog.

- [ ] **[concern] Backfilled copy is synthesized from commit messages, not reviewed release notes** — `changelog.html:139-182` — The v0.11.0–v0.13.0 blurbs were written by picking user-facing themes out of ~50-90 commit subjects per release (internal refactors and bugfixes vastly outnumber user-facing changes in the raw log). No existing source-of-truth release notes existed for these versions to check against. _Fix:_ a human pass (ideally whoever shipped each release) to confirm each entry's claims are accurate and nothing user-visible was missed.

## Key Workflows to Verify

- **Scroll the nav on desktop (index.html and changelog.html)** — Load each page ≥900px wide, scroll past the fold. **Watch:** "What's New" is visible left of the CTA at all times on desktop (no collapse rule applies above 768px), navigates to `changelog.html` from `index.html` and reloads-in-place from `changelog.html` itself.
- **Scroll the nav on mobile (≤768px)** — Load each page at a narrow width. **Watch:** "What's New" is absent at the top, slides in from the wordmark's vacated slot once `.dz-nav.scrolled` engages (~modest scroll distance), no layout jump or overlap with the CTA, and — per the two-row wrap bug found and fixed this session — the nav never briefly reflows to two rows mid-transition in either scroll direction.
- **Tab through the mobile nav before scrolling** — With a narrow viewport and no scroll, press Tab repeatedly from the top of the page. **Watch:** focus should skip straight from the wordmark to "Get the app" — confirms the `dc0fb9a` fix; a regression here would mean `visibility` isn't taking effect as expected.
- **Read the new changelog entries end-to-end** — Open `changelog.html` and read v0.13.0 → v0.11.0 against the actual dancenotes release history (`~/2dancenotes`, tags `v0_11_0`/`v0_12_0`/`v0_13_0`). **Watch:** no claimed feature is inaccurate, nothing major shipped in those cycles is missing.

## File Groups

### 1. Nav — "What's New" entry point — `index.html`, `changelog.html`, `assets/landing.css`
Both pages' nav CTA is now wrapped in a new `.dz-nav-right` flex div alongside a new `<a class="dz-nav-whatsnew">` link. `.dz-nav` itself is an unchanged 2-child `justify-content: space-between` flex row (wordmark + the new right-hand group), so no selector depending on direct-child position broke. `--font-hand` (Caveat, already imported at the top of `landing.css` via `@import url(fonts.googleapis.com/...)`, not newly added by this PR) drives the link's handwritten look. The mobile collapse/reveal transition (tricky bit — see Issues) mirrors the existing wordmark-collapse pattern in structure but not in visibility handling.

### 2. Changelog content — `changelog.html`
Three new `<article class="cl-entry">` blocks inserted directly below the `DJ_CHANGELOG_INSERT_BELOW` marker, above the existing v0.10.0 entry — correct newest-first ordering, matches the existing entries' markup/voice exactly (verified article-tag balance: 6 open/6 close). No template placeholders or malformed structure.

### 3. Cache-busting version bumps
`index.html` and `changelog.html` both bumped `landing.css?v=78→79` / `v=71→79` since `landing.css` changed. `privacy.html`/`terms.html`/`support.html`/`delete-account.html` remain at `v=71` — pre-existing inconsistency (they use a different, simpler nav with no wordmark/CTA-group markup this PR touches), not introduced by this change.

## Changes Made During Review

| # | Change | Commit |
|---|--------|--------|
| 1 | Hid the collapsed mobile "What's New" link from keyboard focus and screen readers via `visibility` toggle | `dc0fb9a` |
| 2 | Sequenced the mobile nav's word-collapse and "What's New"-reveal transitions (`transition-delay`) to stop a transient two-row wrap the user spotted while scrolling | `91adaba` |

## Open Questions / Future Work

- Should `privacy.html`/`terms.html`/`support.html`/`delete-account.html` also get a "What's New" nav link for consistency? Out of scope for this PR (their nav markup is structurally different and untouched), but worth a follow-up if the intent is site-wide discoverability.
- No repo-specific review checklist exists yet for `dancejournal`. The "collapsed-but-still-focusable interactive element" pattern found this session would make a good first entry in `~/.claude/skills/pr-review-live/checklists/dancejournal.md` if it recurs.
