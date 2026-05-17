import type {
  AiArrangementCandidate,
  AiArrangementCandidateSource,
  AiArrangementCandidateStatus,
  AiArrangementConfidence,
  AiArrangementSourceType,
  ArrangementTimeMode,
} from "../types";

export const aiCandidateStorageKey = "arkme-demo.aiArrangementCandidates";
export const aiCandidateStorageEvent = "arkme-demo:ai-arrangement-candidates-updated";
const sourceTypes = new Set<AiArrangementSourceType>([
  "selfMessage",
  "privateChat",
  "groupChat",
]);
const confidenceLevels = new Set<AiArrangementConfidence>(["high", "medium", "low"]);
const candidateStatuses = new Set<AiArrangementCandidateStatus>([
  "pending",
  "accepted",
  "dismissed",
]);
const arrangementTimeModes = new Set<ArrangementTimeMode>(["none", "deadline", "range"]);
const sceneTimeWindowMs = 3 * 60 * 60 * 1000;

export function loadAiCandidates(): AiArrangementCandidate[] {
  if (typeof window === "undefined") return [];

  try {
    const storedValue = window.localStorage.getItem(aiCandidateStorageKey);
    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .map(normalizeAiCandidate)
      .filter((candidate): candidate is AiArrangementCandidate => Boolean(candidate));
  } catch {
    return [];
  }
}

export function saveAiCandidates(candidates: AiArrangementCandidate[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(aiCandidateStorageKey, JSON.stringify(candidates));
  window.dispatchEvent(new Event(aiCandidateStorageEvent));
}

export function upsertAiCandidate(candidate: AiArrangementCandidate) {
  const currentCandidates = loadAiCandidates();
  const existingCandidate = currentCandidates.find(
    (currentCandidate) => currentCandidate.id === candidate.id
  );
  if (existingCandidate && existingCandidate.status !== "pending") {
    return currentCandidates;
  }

  const mergeTarget = currentCandidates.find(
    (currentCandidate) =>
      currentCandidate.id !== candidate.id &&
      currentCandidate.status === "pending" &&
      hasSameScene(currentCandidate, candidate)
  );
  if (mergeTarget) {
    const mergedCandidate = mergeCandidates(candidate, mergeTarget);
    const nextCandidates = [
      mergedCandidate,
      ...currentCandidates.filter(
        (currentCandidate) =>
          currentCandidate.id !== candidate.id && currentCandidate.id !== mergeTarget.id
      ),
    ];
    saveAiCandidates(nextCandidates);
    return nextCandidates;
  }

  const nextCandidates = [
    withDefaultMergeFields(candidate),
    ...currentCandidates.filter((currentCandidate) => currentCandidate.id !== candidate.id),
  ];
  saveAiCandidates(nextCandidates);
  return nextCandidates;
}

export function dismissAiCandidate(id: string, dismissedAt: string) {
  const nextCandidates = loadAiCandidates().map((candidate) =>
    candidate.id === id
      ? {
          ...candidate,
          status: "dismissed" as const,
          updatedAt: dismissedAt,
        }
      : candidate
  );
  saveAiCandidates(nextCandidates);
  return nextCandidates;
}

export function acceptAiCandidate(id: string, acceptedAt: string) {
  const nextCandidates = loadAiCandidates().map((candidate) =>
    candidate.id === id
      ? {
          ...candidate,
          status: "accepted" as const,
          updatedAt: acceptedAt,
        }
      : candidate
  );
  saveAiCandidates(nextCandidates);
  return nextCandidates;
}

function normalizeAiCandidate(value: unknown): AiArrangementCandidate | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<AiArrangementCandidate>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.notes !== "string" ||
    !Array.isArray(candidate.people) ||
    !candidate.people.every((person) => typeof person === "string") ||
    typeof candidate.place !== "string" ||
    !isArrangementTimeMode(candidate.timeMode) ||
    !isNullableString(candidate.deadlineAt) ||
    !isNullableString(candidate.startAt) ||
    !isNullableString(candidate.endAt) ||
    !isNullableString(candidate.reminderAt) ||
    !isSourceType(candidate.sourceType) ||
    typeof candidate.sourceSummary !== "string" ||
    !Array.isArray(candidate.rawContext) ||
    !candidate.rawContext.every((context) => typeof context === "string") ||
    !isConfidence(candidate.confidence) ||
    !isCandidateStatus(candidate.status) ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string"
  ) {
    return null;
  }

  const relatedSources = normalizeRelatedSources(candidate);

  return {
    id: candidate.id,
    title: candidate.title,
    notes: candidate.notes,
    people: candidate.people,
    place: candidate.place,
    timeMode: candidate.timeMode,
    deadlineAt: candidate.deadlineAt,
    startAt: candidate.startAt,
    endAt: candidate.endAt,
    reminderAt: candidate.reminderAt,
    sourceType: candidate.sourceType,
    sourceSummary: candidate.sourceSummary,
    rawContext: candidate.rawContext,
    ...(relatedSources.length > 0 ? { relatedSources } : {}),
    ...(typeof candidate.timeConflict === "boolean"
      ? { timeConflict: candidate.timeConflict }
      : {}),
    confidence: candidate.confidence,
    status: candidate.status,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

function withDefaultMergeFields(candidate: AiArrangementCandidate): AiArrangementCandidate {
  return {
    ...candidate,
    relatedSources:
      candidate.relatedSources && candidate.relatedSources.length > 0
        ? candidate.relatedSources
        : [toCandidateSource(candidate)],
    timeConflict: Boolean(candidate.timeConflict),
  };
}

function mergeCandidates(
  incomingCandidate: AiArrangementCandidate,
  existingCandidate: AiArrangementCandidate
): AiArrangementCandidate {
  const incoming = withDefaultMergeFields(incomingCandidate);
  const existing = withDefaultMergeFields(existingCandidate);
  const sources = uniqueSources([
    ...(incoming.relatedSources ?? []),
    ...(existing.relatedSources ?? []),
  ]);

  return {
    ...incoming,
    people: uniqueStrings([...incoming.people, ...existing.people]),
    rawContext: uniqueStrings([...incoming.rawContext, ...existing.rawContext]),
    relatedSources: sources,
    timeConflict: hasTimeConflict(sources),
  };
}

function toCandidateSource(candidate: AiArrangementCandidate): AiArrangementCandidateSource {
  return {
    id: candidate.id,
    sourceType: candidate.sourceType,
    sourceSummary: candidate.sourceSummary,
    rawContext: candidate.rawContext,
    confidence: candidate.confidence,
    timeMode: candidate.timeMode,
    deadlineAt: candidate.deadlineAt,
    startAt: candidate.startAt,
    endAt: candidate.endAt,
    createdAt: candidate.createdAt,
  };
}

function normalizeRelatedSources(candidate: Partial<AiArrangementCandidate>) {
  if (!Array.isArray(candidate.relatedSources)) return [];

  return candidate.relatedSources
    .map((source) => {
      if (!source || typeof source !== "object") return null;
      const value = source as Partial<AiArrangementCandidateSource>;
      if (
        typeof value.id !== "string" ||
        !isSourceType(value.sourceType) ||
        typeof value.sourceSummary !== "string" ||
        !Array.isArray(value.rawContext) ||
        !value.rawContext.every((context) => typeof context === "string") ||
        !isConfidence(value.confidence) ||
        !isArrangementTimeMode(value.timeMode) ||
        !isNullableString(value.deadlineAt) ||
        !isNullableString(value.startAt) ||
        !isNullableString(value.endAt) ||
        typeof value.createdAt !== "string"
      ) {
        return null;
      }

      return {
        id: value.id,
        sourceType: value.sourceType,
        sourceSummary: value.sourceSummary,
        rawContext: value.rawContext,
        confidence: value.confidence,
        timeMode: value.timeMode,
        deadlineAt: value.deadlineAt,
        startAt: value.startAt,
        endAt: value.endAt,
        createdAt: value.createdAt,
      };
    })
    .filter((source): source is AiArrangementCandidateSource => Boolean(source));
}

function uniqueSources(sources: AiArrangementCandidateSource[]) {
  const seenIds = new Set<string>();
  return sources.filter((source) => {
    if (seenIds.has(source.id)) return false;
    seenIds.add(source.id);
    return true;
  });
}

function hasSameScene(a: AiArrangementCandidate, b: AiArrangementCandidate) {
  return hasSameTopic(a, b) || hasSamePlaceAndCloseTime(a, b);
}

function hasSameTopic(a: AiArrangementCandidate, b: AiArrangementCandidate) {
  const aKeywords = getTopicKeywords(a);
  const bKeywords = getTopicKeywords(b);
  return aKeywords.some((keyword) => bKeywords.includes(keyword));
}

function getTopicKeywords(candidate: AiArrangementCandidate) {
  const text = [candidate.title, candidate.notes, candidate.sourceSummary, candidate.place]
    .join(" ")
    .toLowerCase();

  if (
    text.includes("复诊") ||
    text.includes("体检") ||
    text.includes("去医院") ||
    text.includes("去一趟医院")
  ) {
    return ["hospital-visit"];
  }
  if (text.includes("早餐") || text.includes("豆浆") || text.includes("包子")) return ["breakfast"];
  if (text.includes("资料") || text.includes("文件")) return ["documents"];
  return [];
}

function hasSamePlaceAndCloseTime(a: AiArrangementCandidate, b: AiArrangementCandidate) {
  const placeA = normalizePlace(a.place);
  const placeB = normalizePlace(b.place);
  if (!placeA || placeA !== placeB) return false;

  const timeA = getCandidatePrimaryTime(a);
  const timeB = getCandidatePrimaryTime(b);
  if (timeA === null || timeB === null) return false;

  return Math.abs(timeA - timeB) <= sceneTimeWindowMs;
}

function normalizePlace(place: string) {
  return place.trim().replace(/\s+/g, "").toLowerCase();
}

function getCandidatePrimaryTime(candidate: AiArrangementCandidate) {
  const value = candidate.deadlineAt ?? candidate.startAt ?? candidate.endAt;
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function hasTimeConflict(sources: AiArrangementCandidateSource[]) {
  const timeKeys = new Set(
    sources
      .map((source) => [source.timeMode, source.deadlineAt, source.startAt, source.endAt].join("|"))
      .filter((key) => !key.startsWith("none|"))
  );
  return timeKeys.size > 1;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isSourceType(value: unknown): value is AiArrangementSourceType {
  return typeof value === "string" && sourceTypes.has(value as AiArrangementSourceType);
}

function isConfidence(value: unknown): value is AiArrangementConfidence {
  return typeof value === "string" && confidenceLevels.has(value as AiArrangementConfidence);
}

function isCandidateStatus(value: unknown): value is AiArrangementCandidateStatus {
  return typeof value === "string" && candidateStatuses.has(value as AiArrangementCandidateStatus);
}

function isArrangementTimeMode(value: unknown): value is ArrangementTimeMode {
  return typeof value === "string" && arrangementTimeModes.has(value as ArrangementTimeMode);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
