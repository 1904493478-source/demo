# Arrangements Gesture and Motion Design (2026-05-17)

## Scope

This document refines the `安排` module interaction model after the earlier bottom-sheet and grouped-list restructure. It focuses on making gesture feedback easier to perceive, keeping each interaction meaning singular, and preserving the product's low-pressure tone.

This pass does not change the arrangement data model or AI scope.

## Confirmed Decisions

The user confirmed the following final directions:

- remove the top quick-navigation entry entirely
- keep `日历总览` at the top of page content and not sticky
- soften bottom-sheet motion so it no longer appears abruptly
- keep `点按 = 看详情`
- use `长按 = 状态迁移`
- after long press, show a **small action dialog in the middle of the page**
- the middle action dialog shows **only one primary action**
- keep `左滑 = 删除入口`
- redesign left-swipe feedback so the animation is clearer and calmer
- keep delete inside edit mode as well
- keep second confirmation before actual deletion

## Final Page Structure

The page now renders in this order:

1. title area with page title and `新建`
2. `日历总览`
3. grouped arrangement sections

Fixed section order remains:

1. `今天`
2. `近期`
3. `没有时间`
4. `以后再说`
5. `已完成`

There is no top quick-navigation strip in this version.

## Interaction Roles

Each high-frequency gesture must keep one meaning only.

### Tap

- tap arrangement card
- open detail bottom sheet

### Long Press

Long press is only for state movement.

- `今天 / 近期`
  - show `以后再说`
- `以后再说`
  - show `今天就说！`
- `已完成`
  - show `还没完`
- `没有时间`
  - no long-press state action in this iteration

Important rule:

- long press does not directly execute the action
- long press opens a transient middle action dialog
- the dialog contains only the single primary action for that card state
- the user still taps the action button to complete it

## Middle Action Dialog

This dialog replaces the earlier inline reveal idea.

### Purpose

- make the gesture result obvious enough to be seen immediately
- separate state movement from both detail viewing and deletion
- avoid stuffing temporary buttons back into the card row

### Content

The dialog stays intentionally small and focused:

- one short context line showing the selected arrangement title
- one large primary action button
- no secondary actions
- no delete action inside this dialog

Example mapping:

- `明天帮同事带早餐` -> `以后再说`
- `整理旧照片` -> `今天就说！`
- `明天帮同事带早餐` in completed -> `还没完`

### Layout

- position: centered in the visible page area
- width: compact, roughly `220px - 280px`
- shape: small floating panel, not a full dialog card
- hierarchy: above the list content, below any system-level modal
- backdrop: a very light page dimmer so the panel reads clearly without feeling heavy

### Motion

The panel should feel like it is being surfaced, not teleported.

Recommended entry:

- backdrop fade: `120ms - 160ms`
- panel enter: `180ms - 220ms`
- properties: `opacity + translateY + scale`
- start state: `opacity: 0`, `translateY(10px)`, `scale(0.94)`
- end state: `opacity: 1`, `translateY(0)`, `scale(1)`
- easing: `cubic-bezier(0.22, 1, 0.36, 1)`

Recommended exit:

- backdrop fade: `100ms - 140ms`
- panel exit: `140ms - 180ms`
- exit should be faster than entry

### Selected Card Feedback

When the dialog opens:

- the pressed card receives a soft highlight ring
- card content stays in place
- there is no inline button expansion inside the card itself

This makes the card feel selected without fighting the center dialog.

### Dismiss Rules

The middle action dialog closes when:

- the user taps the primary action
- the user taps blank space
- the user starts scrolling the list
- the user begins a left swipe on another card
- the user opens detail on another card

Because the state action is intentionally low-pressure and reversible, it does not require a second confirmation.

## Left Swipe Delete Motion

Left swipe remains only for deletion entry, but the motion should now feel like direct manipulation rather than a binary reveal.

### Gesture Behavior

- the card follows the finger while dragging left
- long-press detection must cancel as soon as horizontal drag is clearly established
- vertical scrolling should win when the movement is mostly vertical

Suggested gesture thresholds:

- start swipe intent after roughly `12px` horizontal movement
- only treat as swipe when horizontal intent exceeds vertical intent
- reveal threshold: about `56px`
- settle threshold: about `72px - 84px`

### Visual Reveal

As the card moves left:

- a right-side delete lane is gradually exposed underneath
- lane color should ramp from neutral-muted to soft danger
- delete icon/label fade in progressively instead of appearing all at once
- card shadow can lift slightly during drag to show separation from the lane below

The lane should not blast the whole row red immediately. The tone should stay calm until the delete state is actually ready.

### Release States

If released below threshold:

- the card snaps back to rest
- delete lane fades away
- duration: `160ms - 200ms`
- easing: move curve `cubic-bezier(0.25, 1, 0.5, 1)`

If released beyond threshold:

- the card settles into a delete-ready offset
- the delete button is fully readable and tappable
- a tiny overshoot of `4px - 6px` is acceptable before settling
- duration: `180ms - 220ms`

### Delete Confirmation Flow

Delete still remains intentionally two-step:

1. left swipe reveals delete-ready state
2. user taps `删除`
3. second confirmation modal appears
4. only then is the arrangement actually removed

This remains a deletion entry pattern, not swipe-to-delete.

## Bottom Sheet Motion

The sheet must still feel connected to the current page instead of suddenly appearing.

Desired behavior:

- overlay fades in quickly
- sheet enters from slightly below its resting position
- motion uses `transform + opacity`
- enter is smooth and slightly slower than exit
- no bounce, no exaggerated spring, no decorative overshoot

Recommended timing:

- overlay fade: `120ms - 180ms`
- sheet enter: `220ms - 260ms`
- sheet exit: `180ms - 220ms`

Recommended easing:

- `cubic-bezier(0.32, 0.72, 0, 1)` for drawer movement
- or a similarly restrained drawer curve

## Gesture Safety Rules

- only one transient gesture surface may exist at a time
- a center action dialog and a delete-ready row cannot coexist
- tapping blank space collapses the current gesture state
- scrolling the list collapses the current gesture state
- opening detail collapses the current gesture state
- long press and left swipe must not fight each other
- delete remains a high-risk action and must stay explicitly confirmed

## Why This Direction

This interaction model fits the product philosophy:

- less visual clutter inside the list
- more obvious motion feedback
- clearer separation between view, state change, and deletion
- lower emotional pressure
- reversible state movement
- safer destructive behavior

## Incremental Delivery Order

To keep the project stable, implementation should proceed in small slices:

1. replace inline long-press reveal with the centered single-action dialog
2. redesign left-swipe motion and delete-ready settle state
3. add collapse and gesture-safety behavior
4. run full verification and update logs
