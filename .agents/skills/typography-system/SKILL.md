---
name: typography-system
description: Creates excellent web typography and consistent font systems. Use for selecting premium fonts, Google Fonts, font pairing, responsive heading scales, readability, editorial hierarchy, text spacing and brand identity.
---

# Typography System

## Goal
Turn ordinary typography into a strong visual identity with clear reading order and reliable responsiveness.

## Process
1. Audit existing typefaces, sizes, weights, variable fonts and the current stack.
2. Choose a display/body pairing intentionally. Prefer max 2 families in most sites; add a mono accent only where functional.
3. Match the design direction rather than defaulting to a universal font. Options to consider after testing availability: Space Grotesk + Inter; DM Sans + Fraunces; Manrope + Newsreader; Sora + Source Sans 3. Google Fonts availability and actual weights must be verified when integrating.
4. Create a fluid scale using CSS `clamp()`; define tokens for hero, h1–h4, body large, body and caption.
5. Adjust line height by role: tight for large display (~1.0–1.12), breathable for body (~1.45–1.7). Check language-specific accented characters.
6. Use letter spacing sparingly: slightly tighter large headings, neutral body, moderate tracking only for small uppercase labels.
7. Tune paragraph width (roughly 55–75 characters for reading text) and maintain obvious contrast and hierarchy.
8. Implement weights/subsets effectively; prefer loading only necessary font weights; use `font-display: swap` when applicable.
9. Test long Portuguese words, mobile wrapping, localization and buttons with large text settings.

## Stack recommendations
- Next.js: prefer `next/font/google` where supported by the installed Next.js version.
- Vite/static: use a properly encoded Google Fonts stylesheet URL or local font files with rights to use them; apply fallbacks.
- Existing design system: integrate tokens without forcing a rewrite.

## Anti-patterns
- Do not load 6 font families or every font weight.
- Avoid tiny text, low contrast and forced fixed heights that clip headings.
- Avoid exaggerated negative tracking on body text.
- Never claim a font is free/open-source without verifying its license.

## Template
See `examples/type-tokens.css`; adapt values to the actual project's needs rather than copying unchanged.
