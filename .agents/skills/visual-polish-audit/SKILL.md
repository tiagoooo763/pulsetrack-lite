---
name: visual-polish-audit
description: Audits and improves the visual quality of a website or dashboard on mobile, tablet and desktop. Use for UI cleanup, polish, responsive bugs, spacing, accessibility, readability, animation performance and pre-launch review.
---

# Visual Polish Audit

## Goal
Find and fix visible design and interaction problems without changing core features or inventing content.

## Workflow
1. Explore existing routes/components and identify key user journeys.
2. Check layout at representative widths, e.g. 375px mobile, 768px tablet and 1440px desktop (adapt to product). Take screenshots with available project tooling when possible; don't claim to have tested without doing so.
3. Review typography hierarchy, whitespace cadence, alignments, image cropping, border radii, shadows, contrast, focus and loading/empty/error states.
4. Confirm navigation, buttons, forms and menu states on touch, keyboard and pointer.
5. Identify unnecessary animation, scroll-jank, layout shifts and excessive JS. Respect reduced motion.
6. Fix issues in order: broken interaction/overflow → illegible copy/contrast → inconsistent hierarchy → motion/polish.
7. Use existing testing tools/build/lint; capture actual results, not guessed scores.

## Checklist
- [ ] No unwanted horizontal overflow on mobile.
- [ ] CTA visible, labelled and functional.
- [ ] Text size and contrast adequate; headings wrap gracefully in Portuguese.
- [ ] Mouse, keyboard and touch flows work.
- [ ] Focus-visible styles present.
- [ ] Forms show validation and success/error states.
- [ ] Images specify sizing/aspect behavior; no distorted logos.
- [ ] Motion respects reduced motion and does not cause dizziness or delays.
- [ ] Dashboard tables and metrics are readable at different widths.
- [ ] Build passes and no obvious console errors introduced.

## Output format
Report: tested pages/widths, ranked issues found, files changed, verification performed, remaining risks. Avoid fabricating Lighthouse scores or claiming perfect accessibility.
