---
name: ui-microinteractions
description: Improves premium website interactions including button hover, card hover, focus rings, field feedback, transitions, click states, loading states and subtle motion. Use when a UI feels static, plain or unresponsive.
---

# UI Microinteractions

## Aim
Provide immediate, cohesive feedback that makes the interface feel polished and reliable, not distracting.

## Process
1. Identify interactions in the current codebase: CTAs, navigation, accordions, menus, forms, cards, toggles, tabs and data states.
2. Prioritize functional feedback: hover, keyboard focus, pressed, loading, success/error and disabled states.
3. Define motion tokens: duration fast 120–180ms; medium 180–280ms; easing `cubic-bezier(0.2,0.8,0.2,1)` for subtle movement, adjusted to context.
4. Use CSS transitions for small effects, and React Motion or GSAP only for complex sequences requiring orchestration.
5. Ensure pointer-only interactions have keyboard equivalents. Never rely solely on hover to reveal essential information.
6. Avoid moving entire pages or animating content permanently in loops.
7. Make all buttons/actions actually work; do not decorate inert controls as if interactive.

## Recipes
- **Premium CTA**: subtle translateY(-2px) on hover, transform scale(.985) on active, clear focus-visible ring.
- **Cards**: restrained translateY(-4px) or border emphasis; do not make non-clickable cards look clickable.
- **Tabs**: animated active underline with focus-visible indicator and readable label.
- **Menus**: mild opacity/transform entry; ensure keyboard navigation and Escape closing.
- **Form fields**: label, visible focus, helpful error copy and `aria-describedby` when appropriate.
- **Loading**: show actual state; preserve layout and prevent duplicate requests.

## Performance/accessibility
- Prefer transform/opacity, not heavy filters/box-shadow tweens on large areas.
- Honor `prefers-reduced-motion`; remove unnecessary movement while retaining state communication.
- Never disable outlines without an accessible replacement.

## Example
See `examples/premium-interactions.css`, then adapt colors to project tokens.
