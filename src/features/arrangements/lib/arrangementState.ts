import type { Arrangement, ArrangementStatus } from "../types";

export function deriveArrangementStatus(
  arrangement: Arrangement,
  now: Date = new Date()
): ArrangementStatus {
  if (arrangement.status === "completed") return "completed";
  if (arrangement.status === "maybeCompleted") return "maybeCompleted";
  if (arrangement.status === "someday") return "someday";
  if (arrangement.timeMode === "none") return "noDate";

  if (arrangement.timeMode === "deadline" && arrangement.deadlineAt) {
    return new Date(arrangement.deadlineAt).getTime() < now.getTime()
      ? "timePassed"
      : "active";
  }

  if (arrangement.timeMode === "range" && arrangement.endAt) {
    return new Date(arrangement.endAt).getTime() < now.getTime()
      ? "timePassed"
      : "active";
  }

  return "active";
}

export function completeArrangement(arrangement: Arrangement, completedAt: string): Arrangement {
  return {
    ...arrangement,
    status: "completed",
    completedAt,
    updatedAt: completedAt,
  };
}

export function markArrangementMaybeCompleted(
  arrangement: Arrangement,
  suggestedAt: string
): Arrangement {
  return {
    ...arrangement,
    status: "maybeCompleted",
    completedAt: null,
    updatedAt: suggestedAt,
  };
}

export function dismissArrangementCompletionSuggestion(
  arrangement: Arrangement,
  dismissedAt: string
): Arrangement {
  const next = {
    ...arrangement,
    status: "active" as const,
    completedAt: null,
    updatedAt: dismissedAt,
  };

  return {
    ...next,
    status: deriveArrangementStatus(next, new Date(dismissedAt)),
  };
}

export function postponeArrangement(arrangement: Arrangement, snoozedAt: string): Arrangement {
  return {
    ...arrangement,
    status: "someday",
    timeMode: "none",
    deadlineAt: null,
    startAt: null,
    endAt: null,
    snoozedAt,
    updatedAt: snoozedAt,
    previousTime: {
      timeMode: arrangement.timeMode,
      deadlineAt: arrangement.deadlineAt,
      startAt: arrangement.startAt,
      endAt: arrangement.endAt,
    },
  };
}

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
