# Arrangements UI Refine Design (2026-05-17)

## Scope

This document defines the next UI refinement pass for the `安排` module on top of the existing V0.1 implementation. It focuses on page structure, interaction efficiency, low-pressure UX, and safer editing operations. It does not expand AI recognition scope or change the core arrangement data model beyond what is needed for the new UI behavior.

The user intent behind this refinement is explicit:

- reduce visual pressure
- remove redundant blocks
- improve human operation flow
- make each action more purposeful, efficient, and accurate
- keep the experience mobile-first and low-interruption

## Design Direction

The page should feel lighter and more deliberate than the current V0.1 page. The main screen should act as a quiet overview and launch surface, not a page that is permanently half editor and half detail panel.

Key design goals:

- default state stays clean
- actions open only when the user asks for them
- overview remains visible near the top
- navigation between groups is quick but non-disruptive
- no red overdue panic
- high-risk actions require explicit confirmation

## Recommended Path

Choose the "light refactor" path.

This means:

- keep the current feature boundary under `src/features/arrangements/`
- keep existing arrangement types and state logic where possible
- keep grouped list rendering as the main body
- replace always-visible editor/detail cards with bottom-sheet interactions
- reinterpret the top "summary" area as overview plus quick navigation

This path gives a meaningful UX improvement without turning the iteration into a full rewrite.

## Final Page Structure

The `安排` page should render in this order:

1. title area with page title and `新建`
2. `日历总览`
3. small quick-navigation strip
4. grouped arrangement sections

The fixed order of grouped sections should be:

1. `今天`
2. `近期`
3. `没有时间`
4. `以后再说`
5. `已完成`

This order must remain stable. Choosing a quick-navigation item does not reorder the page.

## Calendar Overview

`日历总览` stays at the top of the page content.

Behavior:

- not sticky
- scrolls away with the page
- visible before the grouped lists
- remains a true overview surface rather than an action panel

The calendar should continue to show only arrangements that already have concrete time information.

## Replace "Today Rhythm" With Quick Navigation

The current `今天的节奏` block should be removed.

It is replaced by a compact navigation strip, not a large card and not a true filter.

Navigation items:

- `今天`
- `近期`
- `以后再说`
- `已完成`

Rules:

- this strip is also not sticky
- tapping an item scrolls the page to the matching group section
- it does not hide other sections
- it does not mutate the page order
- it should be visually small and low-pressure

This is intentionally a "jump-to-section" control, because that matches the user's requirement better than actual filtering and better preserves context while browsing.

## Return to Overview

Primary approach:

- if practical, allow tapping the top page area to return to the overview region

Fallback approach:

- if top-tap behavior is not reliable or not intuitive enough in the real mobile shell, provide a very low-presence return-to-top affordance

Fallback affordance requirements:

- low opacity
- small size
- only appears after the user has scrolled down a meaningful distance
- should not visually compete with primary actions

The design preference is to avoid a constantly obvious floating arrow if a lighter solution works.

## Create Flow

The inline manual-create card should no longer be visible by default.

Behavior:

- user taps `新建`
- open a bottom sheet for manual creation
- closing the sheet returns the page to its clean overview state

Why:

- better mobile ergonomics
- avoids a permanently expanded form
- keeps the main page readable
- makes the creation action feel intentional

## Detail Flow

The current always-visible `当前选中` detail card should be removed from the default page layout.

Behavior:

- user taps an arrangement item
- open a bottom sheet showing arrangement detail
- detail is visible only on demand

This keeps the page body focused on scanning and selecting rather than forcing detail exposure all the time.

## Edit Flow

Editing should happen through the same bottom-sheet language.

Recommended behavior:

- tap arrangement item
- open detail bottom sheet
- tap `编辑安排`
- open edit bottom sheet

Alternative acceptable behavior:

- detail sheet itself can switch into edit mode if that is simpler to implement cleanly

Either way, edit must not expand inline inside the page body.

## Time Input Defaults

Time fields should default to the current local time when the user creates or edits an arrangement with time.

This applies to:

- deadline
- range start
- range end, if a default is needed
- reminder, when prefilled by the UI

Design rationale:

- reduces friction
- better matches real human input habits
- improves speed and accuracy over empty date-time fields

## Group Actions and State Movement

Actions for active arrangements:

- `完成`
- `以后再说`

Actions inside `以后再说`:

- `今天就说！`

Effect:

- move the arrangement back into the normal actionable flow

Actions inside `已完成`:

- `还没完`

Effect:

- move the arrangement back into the normal actionable flow

Rules:

- do not show `以后再说` inside the `以后再说` group
- do not show `以后再说` inside the `已完成` group
- every button should have one clear meaning

This is important for purposefulness and accuracy. The user should never have to mentally decode whether an action is archival, restorative, or postponing.

## Overdue Behavior

No red overdue treatment should be added.

If an arrangement time has passed:

- use calm language
- keep it informative, not accusatory
- avoid high-danger color treatment

This continues the module's core low-pressure philosophy.

## Delete Arrangement

Add a delete option inside the edit arrangement bottom sheet.

Rules:

- do not expose delete directly in the list
- delete appears only inside edit context
- delete is a secondary destructive action placed at the bottom
- tapping delete opens a second confirmation step
- only after explicit confirmation should the arrangement be removed

Chosen behavior:

- double-confirm then permanently delete

Not chosen:

- immediate delete
- list-level swipe delete
- toast-only undo pattern

Reason:

- the user explicitly prefers accuracy
- edit context is the safest place for destructive control

## Interaction Principles

These are hard constraints for implementation decisions:

1. Keep the default page light.
2. Do not make users fight persistent panels.
3. Prefer on-demand reveal over permanent exposure.
4. Prefer one-purpose actions over multi-meaning actions.
5. Preserve context when moving between overview, detail, and edit.
6. Reduce emotional pressure around unfinished items.
7. Treat destructive actions with explicit care.
8. Favor mobile reachability and clear tap targets.

## Suggested Component Responsibilities

Recommended UI responsibilities after refinement:

- `ArrangementsPage.tsx`
  - page composition
  - scroll targets
  - bottom-sheet open/close state
  - selected arrangement state

- `ArrangementCalendar.tsx`
  - overview rendering only

- `ArrangementList.tsx`
  - grouped sections
  - stable section anchors
  - item tap events
  - group-specific action labels

- `ArrangementDetail.tsx`
  - on-demand sheet content

- `ArrangementEditor.tsx`
  - create/edit sheet content
  - current-time defaults
  - delete entry in edit mode

Additional small utilities may be introduced if needed for:

- scroll-to-section behavior
- delete confirmation state
- current-time default generation

## Testing Expectations

The refinement should add or update tests for:

- create sheet hidden by default
- create sheet opens from `新建`
- detail sheet hidden by default
- detail sheet opens when selecting an arrangement
- quick-navigation tap scrolls to the correct section target
- group order remains fixed
- edit mode exposes delete
- delete requires second confirmation
- confirming delete removes the arrangement
- `今天就说！` restores a someday item
- `还没完` restores a completed item
- date-time inputs initialize from current time

## Out of Scope

This refinement does not add:

- AI extraction changes
- merge-across-conversations changes
- smart completion logic
- bulk-edit workflows
- new backend or sync behavior

## Implementation Notes

The final implementation should prefer the existing local patterns and remain focused. This iteration should improve structure and usability without introducing a broad architectural rewrite.
