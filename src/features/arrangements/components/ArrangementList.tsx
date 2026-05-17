import React from "react";
import { groupArrangements } from "../lib/arrangementGroups";
import type { Arrangement, ArrangementGroupId, ArrangementStatus } from "../types";

const LONG_PRESS_DURATION_MS = 400;
const SWIPE_INTENT_PX = 12;
const SWIPE_SETTLE_THRESHOLD_PX = 72;
const DELETE_READY_OFFSET_PX = 84;
const MAX_SWIPE_OFFSET_PX = 96;

type ArrangementListProps = {
  arrangements: Arrangement[];
  onSelect: (id: string) => void;
  onComplete: (id: string) => void;
  onPostpone: (id: string) => void;
  onRestoreSomeday: (id: string) => void;
  onReopenCompleted: (id: string) => void;
  onDelete?: (id: string) => void;
  resetSignal?: number;
};

export function ArrangementList({
  arrangements,
  onSelect,
  onComplete,
  onPostpone,
  onRestoreSomeday,
  onReopenCompleted,
  onDelete,
  resetSignal = 0,
}: ArrangementListProps) {
  const groups = groupArrangements(arrangements);
  const [revealedActionId, setRevealedActionId] = React.useState<string | null>(null);
  const [deleteReadyId, setDeleteReadyId] = React.useState<string | null>(null);
  const [isCompletedExpanded, setCompletedExpanded] = React.useState(false);

  React.useEffect(() => {
    setRevealedActionId(null);
    setDeleteReadyId(null);
  }, [resetSignal]);

  const activeActionTarget = groups
    .flatMap((group) =>
      group.items.map((arrangement) => ({
        arrangement,
        groupId: group.id,
      }))
    )
    .find((item) => item.arrangement.id === revealedActionId);

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isCompletedGroup = group.id === "completed";
        const sortedItems = isCompletedGroup
          ? [...group.items].sort(compareCompletedArrangements)
          : group.items;
        const visibleItems =
          isCompletedGroup && !isCompletedExpanded ? sortedItems.slice(0, 3) : sortedItems;
        const hiddenCompletedCount = sortedItems.length - visibleItems.length;

        return (
          <section
            key={group.id}
            id={`arrangements-group-${group.id}`}
            aria-label={group.label}
            data-testid={`arrangement-group-${group.id}`}
            className="rounded-[12px] border border-border bg-surface"
          >
            <div className="border-b border-border-light px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold leading-5 text-text">{group.label}</h2>
                  <p className="mt-1 text-xs leading-4 text-text-tertiary">{group.description}</p>
                </div>
                <span className="rounded-full bg-surface-muted px-2 py-1 text-xs font-medium text-text-muted">
                  {group.items.length}
                </span>
              </div>
            </div>
            <ul role="list" className="divide-y divide-border-light">
              {visibleItems.map((arrangement) => (
                <ArrangementListItem
                  key={arrangement.id}
                  arrangement={arrangement}
                  groupId={group.id}
                  onSelect={onSelect}
                  onComplete={onComplete}
                  onDelete={onDelete}
                  isActionRevealed={revealedActionId === arrangement.id}
                  onRevealAction={setRevealedActionId}
                  isDeleteReady={deleteReadyId === arrangement.id}
                  onDeleteReady={setDeleteReadyId}
                />
              ))}
            </ul>
            {isCompletedGroup && sortedItems.length > 3 ? (
              <div className="border-t border-border-light px-3 py-2">
                <button
                  type="button"
                  aria-label={isCompletedExpanded ? "收起已完成安排" : "展开更多已完成安排"}
                  className="flex w-full items-center justify-center rounded-[10px] bg-surface-muted px-3 py-2 text-xs font-semibold leading-4 text-text-muted transition duration-150 hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
                  onClick={() => {
                    setDeleteReadyId(null);
                    setRevealedActionId(null);
                    setCompletedExpanded((current) => !current);
                  }}
                >
                  {isCompletedExpanded ? "收起" : `展开更多 ${hiddenCompletedCount} 条`}
                </button>
              </div>
            ) : null}
          </section>
        );
      })}

      {activeActionTarget ? (
        <ArrangementStateActionDialog
          arrangement={activeActionTarget.arrangement}
          groupId={activeActionTarget.groupId}
          onClose={() => setRevealedActionId(null)}
          onPostpone={onPostpone}
          onRestoreSomeday={onRestoreSomeday}
          onReopenCompleted={onReopenCompleted}
        />
      ) : null}
    </div>
  );
}

function ArrangementListItem({
  arrangement,
  groupId,
  onSelect,
  onComplete,
  onDelete,
  isActionRevealed,
  onRevealAction,
  isDeleteReady,
  onDeleteReady,
}: {
  arrangement: Arrangement;
  groupId: ArrangementGroupId;
  onSelect: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete?: (id: string) => void;
  isActionRevealed: boolean;
  onRevealAction: (id: string | null) => void;
  isDeleteReady: boolean;
  onDeleteReady: (id: string | null) => void;
}) {
  const meta = formatArrangementMeta(arrangement);
  const stateLabel = getStateLabel(arrangement.status);
  const isCompleted = groupId === "completed";
  const isCompletionSuggested = arrangement.status === "maybeCompleted";
  const canRevealStateAction = groupId !== "noTime";

  const longPressTimerRef = React.useRef<number | null>(null);
  const didLongPressRef = React.useRef(false);
  const didSwipeRef = React.useRef(false);
  const activePointerIdRef = React.useRef<number | null>(null);
  const pointerOriginRef = React.useRef<{ x: number; y: number } | null>(null);
  const dragStartOffsetRef = React.useRef(0);
  const dragActiveRef = React.useRef(false);

  const [dragOffset, setDragOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  const clearLongPressTimer = React.useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const resetPointerSession = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const target = event.currentTarget as HTMLElement & {
        hasPointerCapture?: (pointerId: number) => boolean;
        releasePointerCapture?: (pointerId: number) => void;
      };

      if (target.hasPointerCapture?.(event.pointerId)) {
        target.releasePointerCapture?.(event.pointerId);
      }

      activePointerIdRef.current = null;
      pointerOriginRef.current = null;
      dragActiveRef.current = false;
      setIsDragging(false);
    },
    []
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    startPointerSession(event);
  };

  const handleSurfacePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest("button")) return;
    startPointerSession(event);
  };

  const startPointerSession = (event: React.PointerEvent<HTMLElement>) => {
    if (activePointerIdRef.current !== null) return;

    activePointerIdRef.current = event.pointerId;
    pointerOriginRef.current = { x: event.clientX, y: event.clientY };
    dragStartOffsetRef.current = isDeleteReady ? -DELETE_READY_OFFSET_PX : 0;
    didLongPressRef.current = false;
    didSwipeRef.current = false;
    dragActiveRef.current = false;
    setDragOffset(0);
    setIsDragging(false);
    (
      event.currentTarget as HTMLElement & {
        setPointerCapture?: (pointerId: number) => void;
      }
    ).setPointerCapture?.(event.pointerId);

    if (!canRevealStateAction) return;

    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      onDeleteReady(null);
      didLongPressRef.current = true;
      onRevealAction(arrangement.id);
      longPressTimerRef.current = null;
    }, LONG_PRESS_DURATION_MS);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerId !== activePointerIdRef.current || !pointerOriginRef.current) {
      return;
    }

    const deltaX = event.clientX - pointerOriginRef.current.x;
    const deltaY = event.clientY - pointerOriginRef.current.y;
    const hasHorizontalIntent = Math.abs(deltaX) >= SWIPE_INTENT_PX;
    const isMostlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

    if (!dragActiveRef.current) {
      if (!hasHorizontalIntent) return;

      clearLongPressTimer();

      if (!isMostlyHorizontal) return;

      const isOpeningSwipe = deltaX < 0;
      const isClosingReadySwipe = isDeleteReady && deltaX > 0;

      if (!isOpeningSwipe && !isClosingReadySwipe) return;

      dragActiveRef.current = true;
      didSwipeRef.current = true;
      setIsDragging(true);
      onRevealAction(null);
      onDeleteReady(null);
    }

    const nextOffset = Math.min(
      0,
      Math.max(-MAX_SWIPE_OFFSET_PX, dragStartOffsetRef.current + deltaX)
    );
    setDragOffset(nextOffset);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerId !== activePointerIdRef.current) {
      return;
    }

    clearLongPressTimer();

    if (dragActiveRef.current) {
      const releaseOffset = dragOffset;
      resetPointerSession(event);
      setDragOffset(0);

      if (Math.abs(releaseOffset) >= SWIPE_SETTLE_THRESHOLD_PX) {
        onRevealAction(null);
        onDeleteReady(arrangement.id);
      } else {
        onDeleteReady(null);
      }

      return;
    }

    resetPointerSession(event);
  };

  const handleSelect = () => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }

    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }

    if (isDeleteReady || isActionRevealed) return;
    onSelect(arrangement.id);
  };

  const translateX = isDragging ? dragOffset : isDeleteReady ? -DELETE_READY_OFFSET_PX : 0;
  const laneProgress = Math.min(1, Math.abs(translateX) / DELETE_READY_OFFSET_PX);

  return (
    <li className="px-3 py-3">
      <div className="relative overflow-hidden rounded-[12px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-12 right-0 rounded-[12px] transition-[opacity,background-color,transform] duration-[200ms] ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{
            opacity: laneProgress,
            transform: `translateX(${Math.max(0, 16 - laneProgress * 16)}px)`,
            backgroundColor: `rgba(244, 99, 99, ${0.08 + laneProgress * 0.12})`,
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-2 right-2 flex w-[76px] items-center justify-center rounded-[10px] border border-[color:rgba(244,99,99,0.14)] bg-[color:rgba(255,255,255,0.78)] backdrop-blur-[6px] transition-[opacity,transform] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          data-testid={`arrangement-delete-lane-${arrangement.id}`}
          style={{
            opacity: Math.min(1, 0.24 + laneProgress * 0.9),
            transform: `translateX(${Math.max(0, 10 - laneProgress * 10)}px) scale(${0.96 + laneProgress * 0.04})`,
          }}
        />

        <div
          data-testid={`arrangement-row-${arrangement.id}`}
          onPointerDown={handleSurfacePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          className={[
            "relative z-[1] flex items-start gap-3 rounded-[12px] bg-surface px-3 py-3 transition-[transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
            isActionRevealed ? "ring-2 ring-[color:rgba(99,102,241,0.18)]" : "",
            isDragging ? "shadow-[0_12px_26px_rgba(15,23,42,0.08)]" : "",
          ].join(" ")}
          style={{
            transform: `translateX(${translateX}px)`,
            transitionDuration: isDragging ? "0ms" : isDeleteReady ? "200ms" : "180ms",
          }}
        >
          <button
            type="button"
            onClick={handleSelect}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            aria-label={`查看 ${arrangement.title}`}
            data-testid={`arrangement-view-${arrangement.id}`}
            className="min-w-0 flex-1 rounded-[12px] text-left focus-visible:shadow-focus focus-visible:outline-none"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-medium leading-5 text-text">{arrangement.title}</h3>
              {stateLabel ? (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] leading-4 text-text-muted">
                  {stateLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-text-muted">{meta}</p>
            {arrangement.notes ? (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-tertiary">
                {arrangement.notes}
              </p>
            ) : null}
          </button>

          {!isCompleted ? (
            <button
              type="button"
              className={[
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:rgba(34,197,94,0.35)] bg-[color:rgba(34,197,94,0.08)] text-xs text-[color:rgb(22,101,52)] transition duration-150 hover:bg-[color:rgba(34,197,94,0.14)] focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.96]",
                isCompletionSuggested ? "arrangement-complete-suggested" : "",
              ].join(" ")}
              aria-label={`${isCompletionSuggested ? "建议确认完成" : "完成"} ${arrangement.title}`}
              data-testid={`arrangement-complete-${arrangement.id}`}
              onClick={() => onComplete(arrangement.id)}
            >
              <span aria-hidden="true">✓</span>
            </button>
          ) : null}
        </div>

        {onDelete && isDeleteReady ? (
          <button
            type="button"
            aria-label={`删除 ${arrangement.title}`}
            data-testid={`arrangement-delete-${arrangement.id}`}
            onClick={() => {
              onDelete(arrangement.id);
              onDeleteReady(null);
            }}
            className="absolute inset-y-2 right-2 z-[2] flex w-[76px] items-center justify-center rounded-[10px] bg-[color:rgba(244,99,99,0.16)] text-xs font-semibold text-[color:var(--danger)] transition duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[color:rgba(244,99,99,0.22)] focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
          >
            删除
          </button>
        ) : null}

        <div className="pointer-events-none absolute inset-0 rounded-[12px] ring-1 ring-inset ring-border-light" />
      </div>
    </li>
  );
}

function ArrangementStateActionDialog({
  arrangement,
  groupId,
  onClose,
  onPostpone,
  onRestoreSomeday,
  onReopenCompleted,
}: {
  arrangement: Arrangement;
  groupId: ArrangementGroupId;
  onClose: () => void;
  onPostpone: (id: string) => void;
  onRestoreSomeday: (id: string) => void;
  onReopenCompleted: (id: string) => void;
}) {
  const actionConfig = getStateActionConfig(groupId, arrangement);

  if (!actionConfig) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-6" aria-hidden="false">
      <button
        type="button"
        aria-label="关闭安排状态动作"
        data-testid="arrangement-state-dialog-backdrop"
        className="absolute inset-0 bg-[color:rgba(15,23,42,0.08)] transition-opacity duration-[140ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="安排状态动作"
        data-testid="arrangement-state-dialog"
        className="relative z-10 w-full max-w-[280px] rounded-[20px] border border-border-light bg-[color:rgba(255,255,255,0.97)] px-4 py-4 shadow-[0_20px_44px_rgba(15,23,42,0.18)] transition-[transform,opacity] duration-[200ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
      >
        <p className="text-center text-xs leading-4 text-text-tertiary">已选中这条安排</p>
        <p className="mt-2 text-center text-sm font-medium leading-5 text-text">{arrangement.title}</p>
        <button
          type="button"
          aria-label={`${actionConfig.label} ${arrangement.title}`}
          onClick={() => {
            actionConfig.onAction({
              onPostpone,
              onRestoreSomeday,
              onReopenCompleted,
            });
            onClose();
          }}
          className="mt-4 flex w-full items-center justify-center rounded-[14px] bg-primary px-3 py-3 text-sm font-semibold leading-5 text-on-primary transition duration-150 hover:opacity-95 focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
        >
          {actionConfig.label}
        </button>
      </section>
    </div>
  );
}

function getStateActionConfig(groupId: ArrangementGroupId, arrangement: Arrangement) {
  if (groupId === "noTime") return null;

  if (groupId === "someday") {
    return {
      label: "今天就说！",
      onAction: ({
        onRestoreSomeday,
      }: {
        onPostpone: (id: string) => void;
        onRestoreSomeday: (id: string) => void;
        onReopenCompleted: (id: string) => void;
      }) => onRestoreSomeday(arrangement.id),
    };
  }

  if (groupId === "completed") {
    return {
      label: "还没完",
      onAction: ({
        onReopenCompleted,
      }: {
        onPostpone: (id: string) => void;
        onRestoreSomeday: (id: string) => void;
        onReopenCompleted: (id: string) => void;
      }) => onReopenCompleted(arrangement.id),
    };
  }

  return {
    label: "以后再说",
    onAction: ({
      onPostpone,
    }: {
      onPostpone: (id: string) => void;
      onRestoreSomeday: (id: string) => void;
      onReopenCompleted: (id: string) => void;
    }) => onPostpone(arrangement.id),
  };
}

function getStateLabel(status: ArrangementStatus) {
  if (status === "timePassed") return "时间已过，也没关系";
  if (status === "maybeCompleted") return "";
  if (status === "someday") return "已放到以后";
  if (status === "noDate") return "待补时间";
  if (status === "completed") return "已完成";
  return "进行中";
}

function compareCompletedArrangements(left: Arrangement, right: Arrangement) {
  return getCompletedSortTime(right) - getCompletedSortTime(left);
}

function getCompletedSortTime(arrangement: Arrangement) {
  return new Date(arrangement.completedAt ?? arrangement.updatedAt ?? arrangement.createdAt).getTime();
}

function formatArrangementMeta(arrangement: Arrangement) {
  const parts: string[] = [];

  if (arrangement.deadlineAt) parts.push(`截止 ${formatDateTime(arrangement.deadlineAt)}`);
  if (arrangement.startAt) parts.push(`开始 ${formatDateTime(arrangement.startAt)}`);
  if (arrangement.people.length > 0) parts.push(arrangement.people.join("、"));
  if (arrangement.place) parts.push(arrangement.place);

  if (parts.length === 0) return "还没有具体时间";
  return parts.join(" · ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
