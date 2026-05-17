# Arrangements UI Refine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the `安排` module so the main page stays clean by default, creation/detail/editing move into bottom sheets, top navigation becomes jump-to-section navigation, group order becomes stable, and edit mode adds safe deletion.

**Architecture:** Keep the arrangements feature inside `src/features/arrangements/`. Add one small grouping helper, one bottom-sheet frame, and one compact quick-navigation component. Reuse the existing state/store modules, extend pure state transitions for restore actions, and drive all UX changes through focused integration tests in `ArrangementsPage.test.tsx`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vite, Vitest, Testing Library, existing app dialog/sheet patterns from `src/components/RecordDetailSheet.tsx` and `src/components/ui/modal.tsx`.

---

## File Structure

- Create: `src/features/arrangements/lib/arrangementGroups.ts`
  - owns stable group order, group labels, and arrangement-to-group mapping
- Create: `src/features/arrangements/components/ArrangementBottomSheet.tsx`
  - shared mobile bottom-sheet shell for create/detail/edit
- Create: `src/features/arrangements/components/ArrangementQuickNav.tsx`
  - compact jump-to-section strip for `今天 / 近期 / 以后再说 / 已完成`
- Modify: `src/features/arrangements/types.ts`
  - add `ArrangementGroupId`
- Modify: `src/features/arrangements/lib/arrangementState.ts`
  - add restore helpers for `今天就说！` and `还没完`
- Modify: `src/features/arrangements/components/ArrangementList.tsx`
  - render fixed group order, section anchors, item tap selection, and group-specific actions
- Modify: `src/features/arrangements/components/ArrangementEditor.tsx`
  - support current-time defaults and delete entry in edit mode
- Modify: `src/features/arrangements/components/ArrangementDetail.tsx`
  - focus on sheet content, not always-visible page card
- Modify: `src/features/arrangements/components/ArrangementCalendar.tsx`
  - stay a top overview-only surface
- Modify: `src/features/arrangements/components/ArrangementsPage.tsx`
  - compose new layout, scroll targets, sheet state, selection state, and delete confirmation state
- Modify: `src/features/arrangements/components/ArrangementsPage.test.tsx`
  - integration coverage for the refined UX

## Task 1: Lock the New Page Contract With Failing Integration Tests

**Files:**
- Modify: `src/features/arrangements/components/ArrangementsPage.test.tsx`

- [ ] **Step 1: Add failing tests for the clean default page and new group order**

Add these tests near the top of `ArrangementsPage.test.tsx`:

```tsx
it("keeps create and detail sheets hidden until requested", () => {
  render(<ArrangementsPage />);

  expect(screen.queryByRole("form", { name: "创建安排" })).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "安排详情" })).not.toBeInTheDocument();
});

it("renders the refined fixed group order", () => {
  render(<ArrangementsPage />);

  const regions = screen.getAllByRole("region");
  const labels = regions.map((region) => region.getAttribute("aria-label"));

  expect(labels).toEqual(
    expect.arrayContaining(["日历总览", "今天", "近期", "没有时间", "以后再说", "已完成"])
  );

  expect(labels.indexOf("今天")).toBeLessThan(labels.indexOf("近期"));
  expect(labels.indexOf("近期")).toBeLessThan(labels.indexOf("没有时间"));
  expect(labels.indexOf("没有时间")).toBeLessThan(labels.indexOf("以后再说"));
  expect(labels.indexOf("以后再说")).toBeLessThan(labels.indexOf("已完成"));
});
```

- [ ] **Step 2: Add failing tests for the quick-navigation strip and top return behavior**

Append these tests:

```tsx
it("shows compact quick navigation instead of the old rhythm summary", () => {
  render(<ArrangementsPage />);

  expect(screen.queryByText("今天的节奏")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "跳到 今天" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "跳到 近期" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "跳到 以后再说" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "跳到 已完成" })).toBeInTheDocument();
});

it("scrolls the list container when jumping to a section or returning to overview", () => {
  const scrollIntoView = vi.fn();
  const scrollTo = vi.fn();

  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(scrollIntoView);
  vi.spyOn(HTMLElement.prototype, "scrollTo").mockImplementation(scrollTo);

  render(<ArrangementsPage />);

  fireEvent.click(screen.getByRole("button", { name: "跳到 以后再说" }));
  expect(scrollIntoView).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "回到总览" }));
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
});
```

- [ ] **Step 3: Run the page test file and confirm RED**

Run:

```sh
pnpm test src/features/arrangements/components/ArrangementsPage.test.tsx
```

Expected:

- FAIL because the old inline editor/detail still render by default
- FAIL because `今天的节奏` still exists
- FAIL because there is no quick-navigation strip or `回到总览` trigger

- [ ] **Step 4: Commit the failing test snapshot**

```sh
git add src/features/arrangements/components/ArrangementsPage.test.tsx
git commit -m "test: define arrangements refined page shell"
```

## Task 2: Introduce Stable Grouping and Group-Specific Actions

**Files:**
- Create: `src/features/arrangements/lib/arrangementGroups.ts`
- Modify: `src/features/arrangements/types.ts`
- Modify: `src/features/arrangements/lib/arrangementState.ts`
- Modify: `src/features/arrangements/components/ArrangementList.tsx`

- [ ] **Step 1: Add the new group id type**

Update `src/features/arrangements/types.ts` with:

```ts
export type ArrangementGroupId =
  | "today"
  | "recent"
  | "noTime"
  | "someday"
  | "completed";
```

- [ ] **Step 2: Add a grouping helper with fixed order**

Create `src/features/arrangements/lib/arrangementGroups.ts`:

```ts
import type { Arrangement, ArrangementGroupId } from "../types";

export const arrangementGroupOrder: ArrangementGroupId[] = [
  "today",
  "recent",
  "noTime",
  "someday",
  "completed",
];

export const arrangementGroupMeta: Record<
  ArrangementGroupId,
  { label: string; description: string; quickNavLabel?: string }
> = {
  today: {
    label: "今天",
    description: "今天要处理，或今天刚刚错过的安排。",
    quickNavLabel: "今天",
  },
  recent: {
    label: "近期",
    description: "有明确时间，但不在今天。",
    quickNavLabel: "近期",
  },
  noTime: {
    label: "没有时间",
    description: "先收好，等你愿意时再补时间。",
  },
  someday: {
    label: "以后再说",
    description: "主动放轻，不继续占用今天。",
    quickNavLabel: "以后再说",
  },
  completed: {
    label: "已完成",
    description: "已经处理好的安排会安静收在这里。",
    quickNavLabel: "已完成",
  },
};

export function getArrangementGroupId(
  arrangement: Arrangement,
  now: Date = new Date()
): ArrangementGroupId {
  if (arrangement.status === "completed") return "completed";
  if (arrangement.status === "someday") return "someday";
  if (arrangement.status === "noDate") return "noTime";

  const anchor = arrangement.startAt ?? arrangement.deadlineAt ?? arrangement.endAt;
  if (anchor && isSameLocalDay(new Date(anchor), now)) return "today";
  return "recent";
}

export function groupArrangements(arrangements: Arrangement[], now: Date = new Date()) {
  return arrangementGroupOrder.map((id) => ({
    id,
    ...arrangementGroupMeta[id],
    items: arrangements.filter((arrangement) => getArrangementGroupId(arrangement, now) === id),
  }));
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}
```

- [ ] **Step 3: Add pure restore helpers for someday and completed**

Append to `src/features/arrangements/lib/arrangementState.ts`:

```ts
export function restoreSomedayArrangement(
  arrangement: Arrangement,
  restoredAt: string
): Arrangement {
  const restored = arrangement.previousTime
    ? {
        ...arrangement,
        timeMode: arrangement.previousTime.timeMode,
        deadlineAt: arrangement.previousTime.deadlineAt,
        startAt: arrangement.previousTime.startAt,
        endAt: arrangement.previousTime.endAt,
      }
    : arrangement;

  const next = {
    ...restored,
    status: "active" as const,
    snoozedAt: null,
    previousTime: null,
    updatedAt: restoredAt,
  };

  return {
    ...next,
    status: deriveArrangementStatus(next, new Date(restoredAt)),
  };
}

export function reopenCompletedArrangement(
  arrangement: Arrangement,
  reopenedAt: string
): Arrangement {
  const next = {
    ...arrangement,
    status: "active" as const,
    completedAt: null,
    updatedAt: reopenedAt,
  };

  return {
    ...next,
    status: deriveArrangementStatus(next, new Date(reopenedAt)),
  };
}
```

- [ ] **Step 4: Rewrite the list component around grouped metadata**

Replace the grouping portion of `src/features/arrangements/components/ArrangementList.tsx` with:

```tsx
import type { Arrangement, ArrangementGroupId, ArrangementStatus } from "../types";
import { groupArrangements } from "../lib/arrangementGroups";

type ArrangementListProps = {
  arrangements: Arrangement[];
  onSelect: (id: string) => void;
  onComplete: (id: string) => void;
  onPostpone: (id: string) => void;
  onRestoreSomeday: (id: string) => void;
  onReopenCompleted: (id: string) => void;
};

export function ArrangementList({
  arrangements,
  onSelect,
  onComplete,
  onPostpone,
  onRestoreSomeday,
  onReopenCompleted,
}: ArrangementListProps) {
  const groups = groupArrangements(arrangements);

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section
          key={group.id}
          id={`arrangements-group-${group.id}`}
          aria-label={group.label}
          className="rounded-[12px] border border-border bg-surface"
        >
          {/* existing header chrome stays here */}
          <ul role="list" className="divide-y divide-border-light">
            {group.items.map((arrangement) => (
              <ArrangementListItem
                key={arrangement.id}
                arrangement={arrangement}
                groupId={group.id}
                onSelect={onSelect}
                onComplete={onComplete}
                onPostpone={onPostpone}
                onRestoreSomeday={onRestoreSomeday}
                onReopenCompleted={onReopenCompleted}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Add group-specific secondary actions in each list item**

Use this action branch inside `ArrangementListItem`:

```tsx
function renderSecondaryAction(
  groupId: ArrangementGroupId,
  arrangement: Arrangement,
  onPostpone: (id: string) => void,
  onRestoreSomeday: (id: string) => void,
  onReopenCompleted: (id: string) => void
) {
  if (groupId === "someday") {
    return (
      <button
        type="button"
        aria-label={`今天就说！ ${arrangement.title}`}
        onClick={() => onRestoreSomeday(arrangement.id)}
        className="shrink-0 rounded-[8px] px-2 py-1 text-xs font-medium text-text-muted transition duration-[var(--duration-fast)] hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
      >
        今天就说！
      </button>
    );
  }

  if (groupId === "completed") {
    return (
      <button
        type="button"
        aria-label={`还没完 ${arrangement.title}`}
        onClick={() => onReopenCompleted(arrangement.id)}
        className="shrink-0 rounded-[8px] px-2 py-1 text-xs font-medium text-text-muted transition duration-[var(--duration-fast)] hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
      >
        还没完
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={`以后再说 ${arrangement.title}`}
      onClick={() => onPostpone(arrangement.id)}
      className="shrink-0 rounded-[8px] px-2 py-1 text-xs font-medium text-text-muted transition duration-[var(--duration-fast)] hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
    >
      以后再说
    </button>
  );
}
```

- [ ] **Step 6: Run the page tests to confirm the grouping-related failures move forward**

Run:

```sh
pnpm test src/features/arrangements/components/ArrangementsPage.test.tsx
```

Expected:

- some old grouping tests fail less
- sheet-related and top-navigation tests still fail

- [ ] **Step 7: Commit**

```sh
git add src/features/arrangements/types.ts src/features/arrangements/lib/arrangementGroups.ts src/features/arrangements/lib/arrangementState.ts src/features/arrangements/components/ArrangementList.tsx
git commit -m "refactor: align arrangements grouping and restore actions"
```

## Task 3: Add Bottom-Sheet Infrastructure and Quick Navigation

**Files:**
- Create: `src/features/arrangements/components/ArrangementBottomSheet.tsx`
- Create: `src/features/arrangements/components/ArrangementQuickNav.tsx`
- Modify: `src/features/arrangements/components/ArrangementsPage.tsx`

- [ ] **Step 1: Create a shared arrangements bottom-sheet shell**

Create `src/features/arrangements/components/ArrangementBottomSheet.tsx`:

```tsx
import type { ReactNode } from "react";

type ArrangementBottomSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function ArrangementBottomSheet({
  open,
  title,
  onClose,
  children,
}: ArrangementBottomSheetProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
        aria-label="关闭安排抽屉"
      />
      <section
        className="relative z-10 flex max-h-[86%] w-full flex-col overflow-hidden rounded-t-[16px] border border-border-light bg-[var(--dialog-bg)] shadow-[0_-12px_36px_rgba(0,0,0,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="shrink-0 border-b border-border-light px-4 pb-3 pt-2.5">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-fill-2" />
          <div className="flex items-center gap-3">
            <h2 className="min-w-0 flex-1 truncate text-[14px] leading-5 text-text">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-tertiary transition hover:bg-hover-overlay hover:text-text active:scale-[0.96]"
              aria-label="关闭安排抽屉"
            >
              ×
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">{children}</div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create the compact quick-navigation strip**

Create `src/features/arrangements/components/ArrangementQuickNav.tsx`:

```tsx
import type { ArrangementGroupId } from "../types";

type ArrangementQuickNavProps = {
  onJump: (groupId: ArrangementGroupId) => void;
};

const quickNavItems: Array<{ id: ArrangementGroupId; label: string }> = [
  { id: "today", label: "今天" },
  { id: "recent", label: "近期" },
  { id: "someday", label: "以后再说" },
  { id: "completed", label: "已完成" },
];

export function ArrangementQuickNav({ onJump }: ArrangementQuickNavProps) {
  return (
    <section
      aria-label="安排快速定位"
      className="rounded-[12px] border border-border bg-surface px-3 py-2"
    >
      <div className="flex flex-wrap gap-2">
        {quickNavItems.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={`跳到 ${item.label}`}
            onClick={() => onJump(item.id)}
            className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-medium text-text-muted transition duration-[var(--duration-fast)] hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Replace the old summary block and add scroll targets in the page**

In `src/features/arrangements/components/ArrangementsPage.tsx`, add these state hooks and refs:

```tsx
const scrollContainerRef = React.useRef<HTMLDivElement>(null);
const [isCreateSheetOpen, setCreateSheetOpen] = React.useState(false);
const [detailArrangementId, setDetailArrangementId] = React.useState<string | null>(null);
const [editingArrangementId, setEditingArrangementId] = React.useState<string | null>(null);

const jumpToGroup = React.useCallback((groupId: ArrangementGroupId) => {
  document.getElementById(`arrangements-group-${groupId}`)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}, []);

const scrollToOverview = React.useCallback(() => {
  scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
}, []);
```

- [ ] **Step 4: Make the title block the return-to-overview trigger**

Replace the current static title wrapper with:

```tsx
<button
  type="button"
  className="min-w-0 text-left"
  onClick={scrollToOverview}
  aria-label="回到总览"
>
  <h1 className="text-xl font-semibold leading-7 text-text">安排</h1>
  <p className="mt-1 text-xs leading-5 text-text-muted">
    把还没发生的事放在一个地方，提醒你，但不催促你。
  </p>
</button>
```

- [ ] **Step 5: Use the new top section order and hide inline editor/detail**

Replace the body composition with:

```tsx
<div
  ref={scrollContainerRef}
  data-testid="arrangements-scroll-container"
  className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3"
>
  <ArrangementCalendar arrangements={arrangements} />
  <div data-testid="arrangements-workspace" className="mt-3 space-y-3">
    <ArrangementQuickNav onJump={jumpToGroup} />
    <ArrangementList
      arrangements={arrangements}
      onSelect={(id) => setDetailArrangementId(id)}
      onComplete={handleComplete}
      onPostpone={handlePostpone}
      onRestoreSomeday={handleRestoreSomeday}
      onReopenCompleted={handleReopenCompleted}
    />
  </div>
</div>
```

- [ ] **Step 6: Run tests and confirm the page shell turns GREEN before sheet content wiring**

Run:

```sh
pnpm test src/features/arrangements/components/ArrangementsPage.test.tsx -t "keeps create and detail sheets hidden until requested"
pnpm test src/features/arrangements/components/ArrangementsPage.test.tsx -t "shows compact quick navigation instead of the old rhythm summary"
```

Expected:

- both targeted tests PASS
- create/detail opening tests still FAIL because sheets are not wired yet

- [ ] **Step 7: Commit**

```sh
git add src/features/arrangements/components/ArrangementBottomSheet.tsx src/features/arrangements/components/ArrangementQuickNav.tsx src/features/arrangements/components/ArrangementsPage.tsx
git commit -m "feat: add arrangements sheets and quick navigation shell"
```

## Task 4: Move Create Into a Bottom Sheet and Default Time Inputs to Now

**Files:**
- Modify: `src/features/arrangements/components/ArrangementEditor.tsx`
- Modify: `src/features/arrangements/components/ArrangementsPage.tsx`
- Modify: `src/features/arrangements/components/ArrangementsPage.test.tsx`

- [ ] **Step 1: Add failing tests for create-sheet behavior and current-time defaults**

Append these tests:

```tsx
it("opens the create sheet from 新建 and pre-fills time inputs with now", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-17T10:15:00+08:00"));

  render(<ArrangementsPage />);
  fireEvent.click(screen.getByRole("button", { name: "新建" }));

  const form = screen.getByRole("form", { name: "创建安排" });
  expect(form).toBeInTheDocument();
  expect(within(form).getByLabelText("截止时间")).toHaveValue("2026-05-17T10:15");
});

it("closes the create sheet after saving and shows the new arrangement in the right group", () => {
  render(<ArrangementsPage />);
  fireEvent.click(screen.getByRole("button", { name: "新建" }));

  const form = screen.getByRole("form", { name: "创建安排" });
  fireEvent.change(within(form).getByLabelText("标题"), {
    target: { value: "周一预约牙医" },
  });
  fireEvent.click(within(form).getByRole("button", { name: "保存安排" }));

  expect(screen.queryByRole("form", { name: "创建安排" })).not.toBeInTheDocument();
  expect(screen.getByText("周一预约牙医")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the targeted tests and confirm RED**

Run:

```sh
pnpm test src/features/arrangements/components/ArrangementsPage.test.tsx -t "opens the create sheet from 新建 and pre-fills time inputs with now"
```

Expected: FAIL because `新建` still only focuses the inline field and there is no hidden sheet.

- [ ] **Step 3: Add a helper for "current time as datetime-local"**

In `ArrangementEditor.tsx`, add:

```ts
function getDefaultDateTimeLocalValue(now: Date = new Date()) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    now.getFullYear(),
    "-",
    pad(now.getMonth() + 1),
    "-",
    pad(now.getDate()),
    "T",
    pad(now.getHours()),
    ":",
    pad(now.getMinutes()),
  ].join("");
}
```

- [ ] **Step 4: Use that helper for create-mode defaults**

Replace the relevant defaults in `ArrangementEditor.tsx` with:

```tsx
const defaultNowValue = getDefaultDateTimeLocalValue();

<ArrangementField
  id="arrangement-deadline"
  name="deadlineAt"
  label="截止时间"
  type="datetime-local"
  defaultValue={
    editingArrangement?.deadlineAt
      ? formatDateTimeLocalValue(editingArrangement.deadlineAt)
      : defaultNowValue
  }
/>
```

Repeat the same pattern for `startAt`, `endAt`, and `reminderAt`.

- [ ] **Step 5: Wire create-sheet open/close in `ArrangementsPage.tsx`**

Use:

```tsx
const openCreateSheet = () => {
  setEditingArrangementId(null);
  setDetailArrangementId(null);
  setCreateSheetOpen(true);
};

const handleCreate = React.useCallback(
  (draft: ArrangementEditorDraft) => {
    // existing create logic...
    setCreateSheetOpen(false);
  },
  [arrangements, persistArrangements]
);
```

Render the sheet:

```tsx
<ArrangementBottomSheet
  open={isCreateSheetOpen}
  title="创建安排"
  onClose={() => setCreateSheetOpen(false)}
>
  <ArrangementEditor
    onCreate={handleCreate}
    onCancelEdit={() => setCreateSheetOpen(false)}
    titleInputRef={titleInputRef}
  />
</ArrangementBottomSheet>
```

- [ ] **Step 6: Run create tests and the whole page file**

Run:

```sh
pnpm test src/features/arrangements/components/ArrangementsPage.test.tsx -t "opens the create sheet from 新建 and pre-fills time inputs with now"
pnpm test src/features/arrangements/components/ArrangementsPage.test.tsx
```

Expected:

- current-time default test PASS
- hidden-by-default and save-close tests PASS
- detail/edit/delete tests still FAIL

- [ ] **Step 7: Commit**

```sh
git add src/features/arrangements/components/ArrangementEditor.tsx src/features/arrangements/components/ArrangementsPage.tsx src/features/arrangements/components/ArrangementsPage.test.tsx
git commit -m "feat: move arrangements creation into bottom sheet"
```

## Task 5: Move Detail and Edit Into Bottom Sheets and Add Safe Delete

**Files:**
- Modify: `src/features/arrangements/components/ArrangementDetail.tsx`
- Modify: `src/features/arrangements/components/ArrangementEditor.tsx`
- Modify: `src/features/arrangements/components/ArrangementsPage.tsx`
- Modify: `src/features/arrangements/components/ArrangementsPage.test.tsx`
- Reuse: `src/components/ui/modal.tsx`

- [ ] **Step 1: Add failing tests for detail, edit, delete, and restore flows**

Append these tests:

```tsx
it("opens detail in a bottom sheet when selecting an arrangement item", () => {
  render(<ArrangementsPage />);

  fireEvent.click(screen.getByRole("button", { name: "查看 明天帮同事带早餐" }));
  expect(screen.getByRole("dialog", { name: "安排详情" })).toBeInTheDocument();
});

it("shows delete only inside edit mode and requires confirmation", () => {
  render(<ArrangementsPage />);

  fireEvent.click(screen.getByRole("button", { name: "查看 明天帮同事带早餐" }));
  fireEvent.click(screen.getByRole("button", { name: "编辑安排" }));

  expect(screen.getByRole("button", { name: "删除安排" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "删除安排" }));
  expect(screen.getByRole("dialog", { name: "确认删除安排" })).toBeInTheDocument();
});

it("deletes an arrangement only after explicit confirmation", () => {
  render(<ArrangementsPage />);

  fireEvent.click(screen.getByRole("button", { name: "查看 明天帮同事带早餐" }));
  fireEvent.click(screen.getByRole("button", { name: "编辑安排" }));
  fireEvent.click(screen.getByRole("button", { name: "删除安排" }));
  fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

  expect(screen.queryByText("明天帮同事带早餐")).not.toBeInTheDocument();
});

it("restores a someday item with 今天就说！", () => {
  render(<ArrangementsPage />);

  fireEvent.click(screen.getByRole("button", { name: "今天就说！ 整理旧照片" }));
  expect(screen.queryByText("整理旧照片")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "以后再说" })).toBeInTheDocument();
});

it("reopens a completed item with 还没完", () => {
  render(<ArrangementsPage />);

  fireEvent.click(screen.getByRole("button", { name: "完成 明天帮同事带早餐" }));
  fireEvent.click(screen.getByRole("button", { name: "还没完 明天帮同事带早餐" }));
  expect(screen.queryByRole("region", { name: "已完成" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the targeted tests and confirm RED**

Run:

```sh
pnpm test src/features/arrangements/components/ArrangementsPage.test.tsx -t "shows delete only inside edit mode and requires confirmation"
```

Expected: FAIL because there is no detail sheet, no edit sheet, and no delete flow.

- [ ] **Step 3: Make list items selectable and detail-driven**

Inside `ArrangementList.tsx`, update the title block to a button:

```tsx
<button
  type="button"
  onClick={() => onSelect(arrangement.id)}
  aria-label={`查看 ${arrangement.title}`}
  className="min-w-0 flex-1 text-left"
>
  <div className="flex flex-wrap items-center gap-2">
    <h3 className="text-[15px] font-medium leading-5 text-text">{arrangement.title}</h3>
    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] leading-4 text-text-muted">
      {stateLabel}
    </span>
  </div>
  <p className="mt-1 text-xs leading-5 text-text-muted">{meta}</p>
</button>
```

- [ ] **Step 4: Convert detail into sheet content with an explicit title**

Adjust `ArrangementDetail.tsx` so the top starts with:

```tsx
<div className="flex items-start justify-between gap-3">
  <div className="min-w-0">
    <p className="text-xs font-medium leading-4 text-primary">安排详情</p>
    <h2 className="mt-1 text-[16px] font-semibold leading-6 text-text">
      {arrangement.title}
    </h2>
  </div>
</div>
```

Then render it inside:

```tsx
<ArrangementBottomSheet
  open={Boolean(detailArrangement)}
  title="安排详情"
  onClose={() => setDetailArrangementId(null)}
>
  {detailArrangement && (
    <ArrangementDetail
      arrangement={detailArrangement}
      onComplete={handleComplete}
      onPostpone={handlePostpone}
      onEdit={handleEdit}
    />
  )}
</ArrangementBottomSheet>
```

- [ ] **Step 5: Add edit-mode delete and confirmation modal**

Extend `ArrangementEditorProps`:

```ts
type ArrangementEditorProps = {
  onCreate: (draft: ArrangementEditorDraft) => void;
  onUpdate?: (id: string, draft: ArrangementEditorDraft) => void;
  onCancelEdit?: () => void;
  onDelete?: (id: string) => void;
  editingArrangement?: Arrangement | null;
  titleInputRef?: React.Ref<HTMLInputElement>;
};
```

Add this footer block for edit mode:

```tsx
{isEditing && editingArrangement && onDelete && (
  <button
    type="button"
    className="mt-4 w-full rounded-[10px] border border-[color:var(--danger)] px-3 py-2 text-sm font-semibold leading-5 text-[color:var(--danger)] transition duration-[var(--duration-fast)] hover:bg-[color:rgba(244,99,99,0.08)] focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
    onClick={() => onDelete(editingArrangement.id)}
  >
    删除安排
  </button>
)}
```

Use `Modal` in `ArrangementsPage.tsx`:

```tsx
const [deleteCandidateId, setDeleteCandidateId] = React.useState<string | null>(null);

const handleDeleteArrangement = React.useCallback((id: string) => {
  setDeleteCandidateId(id);
}, []);

const confirmDeleteArrangement = React.useCallback(() => {
  if (!deleteCandidateId) return;
  const nextArrangements = arrangements.filter((arrangement) => arrangement.id !== deleteCandidateId);
  persistArrangements(nextArrangements);
  setDeleteCandidateId(null);
  setEditingArrangementId(null);
  setDetailArrangementId(null);
}, [arrangements, deleteCandidateId, persistArrangements]);
```

Render the modal:

```tsx
<Modal
  open={Boolean(deleteCandidateId)}
  title="确认删除安排"
  onClose={() => setDeleteCandidateId(null)}
  closeLabel="取消删除"
>
  <p className="text-sm leading-6 text-text-muted">
    删除后将从当前安排列表移除。
  </p>
  <div className="mt-4 flex justify-end gap-2">
    <button
      type="button"
      className="rounded-[10px] border border-border px-3 py-2 text-sm font-semibold leading-5 text-text-muted"
      onClick={() => setDeleteCandidateId(null)}
    >
      再想想
    </button>
    <button
      type="button"
      className="rounded-[10px] bg-[color:var(--danger)] px-3 py-2 text-sm font-semibold leading-5 text-white"
      onClick={confirmDeleteArrangement}
    >
      确认删除
    </button>
  </div>
</Modal>
```

- [ ] **Step 6: Add page handlers for restore actions**

Append these callbacks in `ArrangementsPage.tsx`:

```tsx
const handleRestoreSomeday = React.useCallback(
  (id: string) => {
    const restoredAt = new Date().toISOString();
    persistArrangements(
      arrangements.map((arrangement) =>
        arrangement.id === id ? restoreSomedayArrangement(arrangement, restoredAt) : arrangement
      )
    );
  },
  [arrangements, persistArrangements]
);

const handleReopenCompleted = React.useCallback(
  (id: string) => {
    const reopenedAt = new Date().toISOString();
    persistArrangements(
      arrangements.map((arrangement) =>
        arrangement.id === id ? reopenCompletedArrangement(arrangement, reopenedAt) : arrangement
      )
    );
  },
  [arrangements, persistArrangements]
);
```

- [ ] **Step 7: Run the page test suite and expect GREEN**

Run:

```sh
pnpm test src/features/arrangements/components/ArrangementsPage.test.tsx
```

Expected: all refined arrangement interaction tests pass.

- [ ] **Step 8: Commit**

```sh
git add src/features/arrangements/components/ArrangementDetail.tsx src/features/arrangements/components/ArrangementEditor.tsx src/features/arrangements/components/ArrangementsPage.tsx src/features/arrangements/components/ArrangementsPage.test.tsx
git commit -m "feat: move arrangements detail and edit into sheets"
```

## Task 6: Verify the Final UX and Record the Iteration

**Files:**
- Modify only files from previous tasks if fixes are needed
- Update: `development-logs/2026-05-17.md`

- [ ] **Step 1: Run the arrangement page tests**

Run:

```sh
pnpm test src/features/arrangements/components/ArrangementsPage.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run the full suite**

Run:

```sh
pnpm test
```

Expected: PASS for all current test files

- [ ] **Step 3: Run full repository verification**

Run:

```sh
pnpm verify:answer
```

Expected:

- lint passes
- build passes
- codex log check passes
- answer standard check passes

- [ ] **Step 4: Update the daily development log**

Run:

```sh
pnpm devlog:update
```

Expected: `development-logs/2026-05-17.md` includes updated completed items and pending follow-ups

- [ ] **Step 5: Manual UX pass in the local demo**

Run:

```sh
pnpm dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/
```

Check:

- `新建` opens a bottom sheet instead of an inline card
- tapping an arrangement opens detail in a bottom sheet
- tapping edit opens the edit sheet
- edit sheet shows `删除安排`
- delete requires explicit confirmation
- title block tap scrolls back to overview
- quick navigation jumps to the correct sections
- group order stays `今天 / 近期 / 没有时间 / 以后再说 / 已完成`
- no sticky calendar and no sticky quick-nav
- no red overdue pressure

- [ ] **Step 6: Commit the finished refinement**

```sh
git add src/features/arrangements docs/development/2026-05-17-arrangements-ui-refine-design.md development-logs/2026-05-17.md
git commit -m "feat: refine arrangements page sheets and navigation"
```

## Self-Review

### Spec Coverage

- clean default page: covered in Task 1 and Task 3
- top calendar and compact navigation: covered in Task 1 and Task 3
- no sticky behavior: covered in Task 3 and Task 6 manual pass
- create/detail/edit sheets: covered in Task 3, Task 4, and Task 5
- current-time defaults: covered in Task 4
- fixed group order with `没有时间`: covered in Task 2 and Task 6
- group restore actions: covered in Task 2 and Task 5
- delete with second confirmation: covered in Task 5
- return to overview with low-pressure behavior: covered in Task 1, Task 3, and Task 6

### Placeholder Scan

- no `TODO` or `TBD`
- every task names exact files
- every test step includes actual test code or concrete commands

### Type Consistency

- `ArrangementGroupId` is defined once in `types.ts`
- `groupArrangements()` is the single group ordering source
- restore actions use `restoreSomedayArrangement()` and `reopenCompletedArrangement()` consistently
