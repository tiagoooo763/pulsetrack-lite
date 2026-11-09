---
name: premium-ui-direction
description: Creates a distinct, premium visual direction for websites, landing pages, SaaS dashboards and client projects. Use when asked to improve visual quality, layout, hierarchy, visual identity, UI design, hero sections, grids or overall aesthetics.
---

# Premium UI Direction

## Purpose
Design and implement modern web interfaces that feel intentional and distinctive instead of generic AI templates. Optimize visual quality while preserving business goals and existing functionality.

## Activation
Use when the request mentions a website redesign, visual polish, premium design, a landing page, portfolio, dashboard, hero, components, layout or UI improvement.

## Workflow
1. Inspect the existing framework, routes, components, styling strategy and brand assets. Respect the codebase and the user's language.
2. Identify audience, page purpose and primary action (CTA). For an existing project, infer what you can from code and copy before asking questions.
3. Propose or choose a coherent art direction. Prefer one strong concept over mixing random effects. Examples: bold editorial, understated luxury, modern product SaaS, warm tactile, precision-tech.
4. Define design tokens: background/surface, foreground/muted, accent, border, focus, spacing scale, radii and shadows. Make text contrast readable.
5. Choose one characterful display face and a legible body face. Delegate decisions to `typography-system` when available.
6. Plan page hierarchy: hero → proof → benefits/features → visual demo → social proof → CTA. For dashboards, prioritize scanability, tables, empty states and data legibility instead.
7. Implement layout with responsive grids, consistent alignment, strong whitespace rhythm, restrained border/shadow design and coherent imagery.
8. Add motion only to clarify hierarchy or feedback. Collaborate with `scroll-motion-gsap` and `ui-microinteractions` as needed.
9. Review the result at mobile, tablet and desktop; run the build/lint when the project provides them.

## Design standards
- Avoid copying competitor layouts/assets directly; create an original composition.
- Do not default to oversaturated gradients, endless glass cards, emoji icons or the same purple-on-black aesthetic.
- Prefer a 12-column desktop grid or a clear max-width content area; use adaptive rather than arbitrary breakpoints.
- Ensure every page has a clear primary action and understandable content hierarchy.
- Keep brand identity consistent. In dashboards, favor high information density with enough breathing room.
- No invented reviews, testimonials, client logos or unsupported revenue claims.
- Use real functioning components; don't leave buttons looking clickable if they are inert.
- Match existing framework and project dependencies unless there is a good reason to change them.

## Deliverables
Summarize design direction, tokens and actual files/components changed. Explain any added dependency. Show how to test the result and any remaining limitations.
