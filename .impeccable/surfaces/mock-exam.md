# Mock Exam

Direction mode: **operate**. Scope: `MockExamScreen.tsx`, including overview and preflight states. The incumbent global blue theme and shared components are retained.

## Composition

A continuous briefing leads with a title and short introduction, then a ruled question/time stat row. Coverage follows as four ruled subject rows with descriptions and right-aligned counts. Readiness guidance includes the configured duration and an inset practice threshold explicitly distinguished from an official requirement.

The separate, persistent action area sits below the main scroll view within the native safe area. It has its own scrolling, a maximum height of 45%, a top rule, and a surface background. Its bounded height preserves room for the briefing when text grows. Start has a 52-unit minimum height; blocking feedback remains adjacent to the action.

## Responsive behavior

- Effective width is window width divided by font scale.
- At effective widths of 760 or more, coverage and readiness use columns; the readiness column is 264 units wide with a left rule. Action copy and button share a row.
- Below 760, sections and actions stack.
- Below 340, question/time statistics stack and the separating rule becomes horizontal.
- Main content and actions cap their width at 960 units, with 24-unit horizontal padding.

## Typography and accessibility

Native scalable text provides semantic headings and grouped screen-reader summaries for statistics and subjects. Summary values and subject counts use tabular numerals. Keep safe areas, error announcements, button labels, accessibility hints, and the start focus target intact.

## States and boundaries

Start follows the existing authentication and preflight flow. Preflight reports that exam sessions are unavailable in this development build and offers Back. It creates no session and starts no timer. Configuration continues to supply question count, duration, distribution, and practice threshold.

## Verification status

Documented by reading the native source and theme tokens. Native screenshots and device visual verification were unavailable; HTML sidecar previews are illustrative only.
