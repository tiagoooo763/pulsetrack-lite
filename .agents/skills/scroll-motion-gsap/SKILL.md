---
name: scroll-motion-gsap
description: Implements polished scroll-triggered animation, parallax, section reveals, page transitions and smooth scrolling for React, Next.js or HTML sites. Use for GSAP ScrollTrigger, Lenis, animation on scroll, scroll-linked storytelling and motion design.
---

# Scroll Motion with GSAP

## Objective
Create intentional scroll effects that enhance comprehension without hurting accessibility, usability or performance.

## Before coding
1. Detect framework: React/Vite, Next.js, vanilla HTML/JS or another stack.
2. Inspect existing animation dependencies. Reuse what is already installed; do not add GSAP, Lenis or Motion gratuitously.
3. Identify a small number of high-impact motion opportunities: hero entrance, section reveal, image motion, timelines or feature demos.
4. Review performance constraints, sticky elements and viewport behavior.

## Motion recipes
- **Hero entrance:** stagger over 0.55–0.9 s, opacity + translateY 12–28 px. Show important content even if animation fails.
- **Section reveal:** trigger on entrance, fade + slight upward translation, once when possible.
- **Feature cards:** gentle stagger; no constant looping.
- **Parallax:** subtle (<~12% relative movement), avoid on content-critical text; disable for reduced motion and narrow touch screens when needed.
- **Pinned narratives:** only when storytelling truly needs it; test on mobile and with anchors.
- **Navigation:** preserve native scrolling behavior, focus and deep links.

## Correct implementation
- Use GSAP `ScrollTrigger` registered explicitly: `gsap.registerPlugin(ScrollTrigger)`.
- For React, scope animations to a root ref and use `useGSAP` or `gsap.context`; clean up on unmount.
- For Next.js app router, put animation code inside client components and defer work until DOM is available.
- Recalculate ScrollTrigger after layout-changing assets where needed; avoid repeated refresh loops.
- Use opacity/transform as main animated properties and avoid layout-heavy animation (`top`, `left`, `width`) if possible.
- Prefer CSS-based hover/focus for simple interactions.
- Check `window.matchMedia('(prefers-reduced-motion: reduce)')` for JS motion. For reduced motion, avoid transforming/parallax and reveal all content statically.
- Never hide core content permanently before JavaScript initializes.

## Lenis policy
Use Lenis only if a smoother scroll feel clearly benefits the site. Do not replace normal navigation behaviors, interfere with modals, nested scroll areas or accessibility. If combined with GSAP, synchronize the ticker and ScrollTrigger updates following the **current** official Lenis documentation; stop/clean up on unmount.

## Examples
- Read `examples/RevealOnScroll.tsx` for React + GSAP with cleanup.
- Read `examples/vanilla-scroll-reveal.js` for plain HTML.

## Validation
Run build and check: first paint without JavaScript, touch scrolling, keyboard navigation, reduced motion, browser back, anchor links, resizing, responsive layouts, console warnings, smooth 60 fps-ish behavior where practical. Avoid unsupported performance claims.
