import React from "react";
import type { Arrangement } from "../types";

type ArrangementCalendarProps = {
  arrangements: Arrangement[];
};

export function ArrangementCalendar({ arrangements }: ArrangementCalendarProps) {
  const todayKey = toLocalDateKey(new Date());
  const scheduledArrangements = arrangements.filter(
    (arrangement) => arrangement.deadlineAt || arrangement.startAt
  );
  const calendarDays = buildCalendarDays(todayKey, scheduledArrangements);
  const [selectedDateKey, setSelectedDateKey] = React.useState(todayKey);
  const selectedArrangements = scheduledArrangements.filter(
    (arrangement) => getArrangementDateKey(arrangement) === selectedDateKey
  );
  const selectedDateLabel = formatDateKeyLabel(selectedDateKey);

  React.useEffect(() => {
    setSelectedDateKey(todayKey);
  }, [todayKey]);

  return (
    <section
      aria-label="日历总览"
      className="rounded-[12px] border border-border bg-surface px-3 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold leading-5 text-text">日历总览</h2>
          <p className="mt-1 text-xs leading-4 text-text-tertiary">只展示已经有时间的安排。</p>
        </div>
        <span className="rounded-full bg-surface-muted px-2 py-1 text-xs text-text-muted">
          {scheduledArrangements.length}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
          <span
            key={day}
            className="flex h-7 items-center justify-center text-[11px] text-text-tertiary"
          >
            {day}
          </span>
        ))}
        {calendarDays.map((day) => {
          const selected = day.dateKey === selectedDateKey;
          const hasArrangements = day.count > 0;
          return (
            <button
              key={day.dateKey}
              type="button"
              aria-label={day.label}
              onClick={() => setSelectedDateKey(day.dateKey)}
              className={
                selected
                  ? "relative flex h-8 items-center justify-center rounded-[8px] bg-primary-soft text-xs font-semibold text-primary focus-visible:shadow-focus focus-visible:outline-none"
                  : "relative flex h-8 items-center justify-center rounded-[8px] bg-surface-subtle text-xs text-text-tertiary transition duration-150 hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none"
              }
            >
              {day.dayOfMonth}
              {hasArrangements ? (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-current opacity-70" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-[10px] bg-surface-subtle px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold leading-4 text-text-muted">{selectedDateLabel}</p>
          <span className="text-[11px] leading-4 text-text-tertiary">
            {selectedArrangements.length} 项
          </span>
        </div>
        {selectedArrangements.length > 0 ? (
          <ul role="list" className="mt-2 space-y-2">
            {selectedArrangements.map((arrangement) => (
              <li key={arrangement.id} className="rounded-[8px] bg-surface px-3 py-2">
                <p className="text-sm font-medium leading-5 text-text">{arrangement.title}</p>
                <p className="mt-0.5 text-xs leading-4 text-text-tertiary">
                  {formatCalendarTime(arrangement)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs leading-5 text-text-tertiary">这一天暂时没有安排。</p>
        )}
      </div>
    </section>
  );
}

function buildCalendarDays(todayKey: string, arrangements: Arrangement[]) {
  const today = parseDateKey(todayKey);
  const counts = new Map<string, number>();
  arrangements.forEach((arrangement) => {
    const dateKey = getArrangementDateKey(arrangement);
    if (!dateKey) return;
    counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
  });

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const dateKey = toLocalDateKey(date);
    return {
      dateKey,
      dayOfMonth: date.getDate(),
      label: formatDateKeyLabel(dateKey),
      count: counts.get(dateKey) ?? 0,
    };
  });
}

function getArrangementDateKey(arrangement: Arrangement) {
  const value = arrangement.startAt ?? arrangement.deadlineAt;
  return value ? toLocalDateKey(new Date(value)) : null;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKeyLabel(value: string) {
  const date = parseDateKey(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatCalendarTime(arrangement: Arrangement) {
  const value = arrangement.startAt ?? arrangement.deadlineAt;
  if (!value) return "未设时间";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
