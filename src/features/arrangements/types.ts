export type ArrangementTimeMode = "none" | "deadline" | "range";

export type ArrangementStatus =
  | "active"
  | "completed"
  | "maybeCompleted"
  | "timePassed"
  | "someday"
  | "noDate";

export type AiArrangementSourceType = "selfMessage" | "privateChat" | "groupChat";

export type AiArrangementConfidence = "high" | "medium" | "low";

export type AiArrangementCandidateStatus = "pending" | "accepted" | "dismissed";

export type ArrangementExecutionCapability = "userOnly" | "aiAssist" | "aiAuto";

export type ArrangementAiAssistAction =
  | "prepareMaterials"
  | "draftReply"
  | "generateRoute";

export type AiArrangementCandidateSource = {
  id: string;
  sourceType: AiArrangementSourceType;
  sourceSummary: string;
  rawContext: string[];
  confidence: AiArrangementConfidence;
  timeMode: ArrangementTimeMode;
  deadlineAt: string | null;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
};

export type ArrangementGroupId =
  | "today"
  | "recent"
  | "noTime"
  | "someday"
  | "completed";

export type ArrangementPreviousTime = {
  timeMode: ArrangementTimeMode;
  deadlineAt: string | null;
  startAt: string | null;
  endAt: string | null;
};

export type Arrangement = {
  id: string;
  title: string;
  notes: string;
  people: string[];
  place: string;
  timeMode: ArrangementTimeMode;
  deadlineAt: string | null;
  startAt: string | null;
  endAt: string | null;
  reminderAt: string | null;
  status: ArrangementStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  snoozedAt: string | null;
  previousTime: ArrangementPreviousTime | null;
  executionCapability?: ArrangementExecutionCapability;
  aiAssistActions?: ArrangementAiAssistAction[];
};

export type AiArrangementCandidate = {
  id: string;
  title: string;
  notes: string;
  people: string[];
  place: string;
  timeMode: ArrangementTimeMode;
  deadlineAt: string | null;
  startAt: string | null;
  endAt: string | null;
  reminderAt: string | null;
  sourceType: AiArrangementSourceType;
  sourceSummary: string;
  rawContext: string[];
  relatedSources?: AiArrangementCandidateSource[];
  timeConflict?: boolean;
  confidence: AiArrangementConfidence;
  status: AiArrangementCandidateStatus;
  createdAt: string;
  updatedAt: string;
};
