---
name: PNPE Exam Reviewer
description: Incumbent native blue themes; Mock Exam composition documented from source.
colors:
  light-primary: '#245cbd'
  light-on-primary: '#ffffff'
  light-primary-container: '#e9f0ff'
  light-background: '#f6f8fc'
  light-surface: '#ffffff'
  light-border: '#dce3ed'
  light-text-primary: '#17283f'
  light-text-secondary: '#55647a'
  light-error: '#ad2525'
  dark-primary: '#a7c5ff'
  dark-on-primary: '#10294d'
  dark-primary-container: '#243c60'
  dark-background: '#101925'
  dark-surface: '#182535'
  dark-border: '#354356'
  dark-text-primary: '#eef3fc'
  dark-text-secondary: '#b2bed0'
  dark-error: '#ffaaaa'
typography:
  title:
    fontSize: '30px'
    lineHeight: 38
    fontWeight: 700
  heading:
    fontSize: '18px'
    lineHeight: 26
    fontWeight: 700
  body:
    fontSize: '16px'
    lineHeight: 24
    fontWeight: 400
  caption:
    fontSize: '14px'
    lineHeight: 22
    fontWeight: 400
  button:
    fontSize: '16px'
    lineHeight: 24
    fontWeight: 600
rounded:
  sm: '8px'
  md: '12px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '24px'
  xxl: '32px'
components:
  button-primary:
    backgroundColor: '{colors.light-primary}'
    textColor: '{colors.light-on-primary}'
    rounded: '{rounded.md}'
    padding: '12px 16px'
  button-secondary:
    backgroundColor: '{colors.light-primary-container}'
    textColor: '{colors.light-primary}'
    rounded: '{rounded.md}'
    padding: '12px 16px'
---

# Design System: PNPE Exam Reviewer

## Overview

**Creative North Star: "Focused preparation"**

The incumbent React Native system uses blue accents, restrained surfaces, and native scalable text for professional, distraction-free exam preparation. Light and Dark themes remain authoritative in `src/core/theme/tokens.ts`; this document records existing tokens rather than introducing a global redesign.

The completed Mock Exam composition is the documented surface. Its continuous briefing and action hierarchy are described in `.impeccable/surfaces/mock-exam.md`; they are not requirements for unrelated screens. Documentation is source-derived; native visual verification was unavailable.

**Key Characteristics:**

- Blue accents in both themes.
- Native scalable typography and accessible controls.
- Minimal visual clutter.

## Colors

The blue primary identifies actions and emphasis; the pale blue primary container separates supporting information. Each theme supplies background, surface, border, primary text, secondary text, and error roles. Use theme roles rather than hardcoded light colors. The frontmatter is a scoped extract; `tokens.ts` also retains surface-variant and semantic status colors.

## Typography

Use the native system font through `AppText`, which enables font scaling. The frontmatter records the shared scale; React Native measurements are logical units, with portable `px` notation in the frontmatter. Mock Exam locally uses a title (32/40), tabular summary numbers (36/44, weight 600), and subject counts (22/30, weight 600). Those overrides belong to this surface.

## Layout

Shared spacing runs from small text gaps to generous section gaps. Mock Exam uses a centered content width capped at 960 logical units and 24-unit horizontal padding. Its responsive decisions divide window width by font scale, allowing larger text to trigger the narrower composition. Detailed breakpoints and action-area constraints belong to the surface brief.

## Elevation & Depth

Mock Exam uses tonal separation and rules without shadows. The persistent action area has a surface background and a top border; the threshold inset uses the primary-container tone.

## Shapes

Existing radii provide softly rounded controls and insets. Mock Exam uses the medium radius for its threshold inset and action button; coverage rows remain open and separated by fine rules.

## Components

`AppButton` supplies primary, secondary, and text variants, a shared minimum touch target of 44 logical units, and pressed opacity of 0.75. Mock Exam uses primary for Start and secondary for Back, with a local minimum height of 52. Disabled actions use surface-variant and secondary text roles. The sidecar previews only the two variants used by this surface.

Summary statistics, ruled coverage rows, readiness guidance, and the persistent action area are surface compositions, not newly established global primitives. Sidecar HTML/CSS previews illustrate these patterns in Light mode; the application remains native and theme-driven.

## Do's and Don'ts

- Do preserve theme roles, native font scaling, safe areas, and accessible control labels.
- Do keep Mock Exam composition rules scoped to its surface brief.
- Don't infer verified native rendering from source-derived documentation or HTML previews.
- Don't imply that preflight starts an exam session or timer.
