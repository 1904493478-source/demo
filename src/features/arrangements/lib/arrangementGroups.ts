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
    description: "今天要处理，或者今天刚刚错过的安排。",
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
  if (arrangement.status === "noDate" || arrangement.timeMode === "none") return "noTime";

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
