import type {
  Arrangement,
  ArrangementAiAssistAction,
  ArrangementExecutionCapability,
  ArrangementPreviousTime,
  ArrangementStatus,
  ArrangementTimeMode,
} from "../types";

const arrangementsStorageKey = "arkme-demo.arrangements";
const arrangementStatuses = new Set<ArrangementStatus>([
  "active",
  "completed",
  "maybeCompleted",
  "timePassed",
  "someday",
  "noDate",
]);
const arrangementTimeModes = new Set<ArrangementTimeMode>(["none", "deadline", "range"]);
const arrangementExecutionCapabilities = new Set<ArrangementExecutionCapability>([
  "userOnly",
  "aiAssist",
  "aiAuto",
]);
const arrangementAiAssistActions = new Set<ArrangementAiAssistAction>([
  "prepareMaterials",
  "draftReply",
  "generateRoute",
]);

export function hasStoredArrangements() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(arrangementsStorageKey) !== null;
}

export function loadArrangements(): Arrangement[] {
  if (typeof window === "undefined") return [];

  try {
    const storedValue = window.localStorage.getItem(arrangementsStorageKey);
    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    return deduplicateArrangements(
      parsedValue
      .map(normalizeArrangement)
        .filter((arrangement): arrangement is Arrangement => Boolean(arrangement))
    );
  } catch {
    return [];
  }
}

export function saveArrangements(arrangements: Arrangement[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(arrangementsStorageKey, JSON.stringify(deduplicateArrangements(arrangements)));
}

export function deduplicateArrangements(arrangements: Arrangement[]) {
  const seenIds = new Set<string>();
  return arrangements.filter((arrangement) => {
    if (seenIds.has(arrangement.id)) return false;
    seenIds.add(arrangement.id);
    return true;
  });
}

function normalizeArrangement(value: unknown): Arrangement | null {
  if (!value || typeof value !== "object") return null;

  const arrangement = value as Partial<Arrangement>;
  if (
    typeof arrangement.id !== "string" ||
    typeof arrangement.title !== "string" ||
    typeof arrangement.notes !== "string" ||
    !Array.isArray(arrangement.people) ||
    !arrangement.people.every((person) => typeof person === "string") ||
    typeof arrangement.place !== "string" ||
    !isArrangementTimeMode(arrangement.timeMode) ||
    !isNullableString(arrangement.deadlineAt) ||
    !isNullableString(arrangement.startAt) ||
    !isNullableString(arrangement.endAt) ||
    !isNullableString(arrangement.reminderAt) ||
    !isArrangementStatus(arrangement.status) ||
    typeof arrangement.createdAt !== "string" ||
    typeof arrangement.updatedAt !== "string" ||
    !isNullableString(arrangement.completedAt) ||
    !isNullableString(arrangement.snoozedAt)
  ) {
    return null;
  }

  const previousTime = normalizePreviousTime(arrangement.previousTime);
  if (arrangement.previousTime !== null && previousTime === null) {
    return null;
  }

  return {
    id: arrangement.id,
    title: arrangement.title,
    notes: arrangement.notes,
    people: arrangement.people,
    place: arrangement.place,
    timeMode: arrangement.timeMode,
    deadlineAt: arrangement.deadlineAt,
    startAt: arrangement.startAt,
    endAt: arrangement.endAt,
    reminderAt: arrangement.reminderAt,
    status: arrangement.status,
    createdAt: arrangement.createdAt,
    updatedAt: arrangement.updatedAt,
    completedAt: arrangement.completedAt,
    snoozedAt: arrangement.snoozedAt,
    previousTime,
    ...(isArrangementExecutionCapability(arrangement.executionCapability)
      ? { executionCapability: arrangement.executionCapability }
      : {}),
    ...(isArrangementAiAssistActionArray(arrangement.aiAssistActions)
      ? { aiAssistActions: arrangement.aiAssistActions }
      : {}),
  };
}

function normalizePreviousTime(value: unknown): ArrangementPreviousTime | null {
  if (value === null) return null;
  if (!value || typeof value !== "object") return null;

  const previousTime = value as Partial<ArrangementPreviousTime>;
  if (
    !isArrangementTimeMode(previousTime.timeMode) ||
    !isNullableString(previousTime.deadlineAt) ||
    !isNullableString(previousTime.startAt) ||
    !isNullableString(previousTime.endAt)
  ) {
    return null;
  }

  return {
    timeMode: previousTime.timeMode,
    deadlineAt: previousTime.deadlineAt,
    startAt: previousTime.startAt,
    endAt: previousTime.endAt,
  };
}

function isArrangementStatus(value: unknown): value is ArrangementStatus {
  return typeof value === "string" && arrangementStatuses.has(value as ArrangementStatus);
}

function isArrangementTimeMode(value: unknown): value is ArrangementTimeMode {
  return typeof value === "string" && arrangementTimeModes.has(value as ArrangementTimeMode);
}

function isArrangementExecutionCapability(
  value: unknown
): value is ArrangementExecutionCapability {
  return (
    typeof value === "string" &&
    arrangementExecutionCapabilities.has(value as ArrangementExecutionCapability)
  );
}

function isArrangementAiAssistActionArray(value: unknown): value is ArrangementAiAssistAction[] {
  return (
    Array.isArray(value) &&
    value.every((item) => arrangementAiAssistActions.has(item as ArrangementAiAssistAction))
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
