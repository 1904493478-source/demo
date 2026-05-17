# Arrangements Gesture and Motion Implementation Plan

> For agentic workers: keep execution inside `src/features/arrangements/` and deliver only one stable interaction slice at a time.

**Goal:** Align the `安排` page with the latest confirmed interaction model: long press opens a centered single-action mini dialog, and left swipe remains the delete entry while gaining clearer motion and settle behavior.

**Architecture:** Keep the work inside `src/features/arrangements/` and stay close to the existing grouped list pattern. Deliver the redesign in two safe frontend slices: first replace the previous inline long-press reveal with the centered single-action dialog, then redesign left-swipe delete motion and collapse rules around it.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vite, Vitest, Testing Library, existing modal and bottom-sheet components.

---

## File Structure

- Modify: `src/features/arrangements/components/ArrangementList.tsx`
  - replace inline long-press actions with centered transient action dialog
  - redesign swipe state so it can coexist safely with the new dialog flow
- Modify: `src/features/arrangements/components/ArrangementsPage.test.tsx`
  - cover centered long-press dialog behavior
  - cover swipe follow-finger, snap-back, and delete-ready settle states
- Modify: `docs/development/2026-05-17-arrangements-gesture-and-motion-design.md`
  - design baseline already updated to the latest confirmed direction
- Modify: `docs/development/2026-05-17-arrangements-gesture-and-motion-implementation-plan.md`
  - keep execution progress current
- Modify: `development-logs/2026-05-17.md`
  - end-of-slice development snapshot

## Task 1: Replace Inline Long-Press Reveal with Centered Single-Action Dialog

**Files:**
- Modify: `src/features/arrangements/components/ArrangementsPage.test.tsx`
- Modify: `src/features/arrangements/components/ArrangementList.tsx`

- [x] **Step 1: Write the failing tests for the centered long-press dialog**
- [x] **Step 2: Run the page test file and confirm RED**
- [x] **Step 3: Implement the centered single-action dialog**
- [x] **Step 4: Run focused tests and confirm GREEN**

Delivered behavior:

- long press no longer reveals inline row buttons
- long press opens a centered mini dialog containing exactly one primary action
- action mapping stays:
  - `今天 / 近期 -> 以后再说`
  - `以后再说 -> 今天就说！`
  - `已完成 -> 还没完`
  - `没有时间 -> no long-press state action`

## Task 2: Redesign Left-Swipe Delete Motion

**Files:**
- Modify: `src/features/arrangements/components/ArrangementsPage.test.tsx`
- Modify: `src/features/arrangements/components/ArrangementList.tsx`

- [x] **Step 1: Add failing tests for swipe-state behavior under the new model**
- [x] **Step 2: Run the page test file and confirm RED**
- [x] **Step 3: Implement calmer left-swipe motion and settle behavior**
- [x] **Step 4: Run focused tests and confirm GREEN**

Delivered behavior:

- the arrangement card now follows the finger horizontally during a left swipe
- the delete lane reveals progressively underneath the card
- a short swipe snaps back and leaves no delete action behind
- a committed swipe settles into a delete-ready offset
- starting a swipe closes any open centered long-press dialog
- delete still requires the existing second confirmation modal

## Task 3: Final Verification and Logging

**Files:**
- Modify: `development-logs/2026-05-17.md`
- Modify: candidate log and `src/data/aiConversationLog.ts`

- [x] **Step 1: Run full project verification**
- [x] **Step 2: Verify the local demo still loads**
- [x] **Step 3: Append the iteration record**

Verification performed:

- `pnpm test src/features/arrangements/components/ArrangementsPage.test.tsx`
- `pnpm test`
- `pnpm verify:answer`
- HTTP `200` check for `http://127.0.0.1:5173/`

## Current Execution Choice

This slice is complete. The next session should stay incremental and focus on gesture polish already mentioned in the design notes, such as blank-space tap collapse and scroll-to-dismiss, without widening scope beyond the arrangements list.
