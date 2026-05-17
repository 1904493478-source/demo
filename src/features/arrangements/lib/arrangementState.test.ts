import { describe, expect, it } from "vitest";
import {
  completeArrangement,
  deriveArrangementStatus,
  dismissArrangementCompletionSuggestion,
  markArrangementMaybeCompleted,
  reopenCompletedArrangement,
  postponeArrangement,
  restoreSomedayArrangement,
} from "./arrangementState";
import type { Arrangement } from "../types";

const baseArrangement: Arrangement = {
  id: "arr_1",
  title: "去医院体检",
  notes: "",
  people: [],
  place: "",
  timeMode: "deadline",
  deadlineAt: "2026-05-15T02:00:00.000Z",
  startAt: null,
  endAt: null,
  reminderAt: null,
  status: "active",
  createdAt: "2026-05-14T02:00:00.000Z",
  updatedAt: "2026-05-14T02:00:00.000Z",
  completedAt: null,
  snoozedAt: null,
  previousTime: null,
};

describe("deriveArrangementStatus", () => {
  it("marks an active deadline arrangement as timePassed after its deadline", () => {
    const status = deriveArrangementStatus(
      baseArrangement,
      new Date("2026-05-16T02:00:00.000Z")
    );

    expect(status).toBe("timePassed");
  });

  it("keeps an arrangement without time out of overdue logic", () => {
    const status = deriveArrangementStatus(
      {
        ...baseArrangement,
        timeMode: "none",
        deadlineAt: null,
      },
      new Date("2026-05-16T02:00:00.000Z")
    );

    expect(status).toBe("noDate");
  });
});

describe("completeArrangement", () => {
  it("completes an arrangement with completedAt", () => {
    const completed = completeArrangement(baseArrangement, "2026-05-16T03:00:00.000Z");

    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBe("2026-05-16T03:00:00.000Z");
    expect(completed.updatedAt).toBe("2026-05-16T03:00:00.000Z");
  });
});

describe("markArrangementMaybeCompleted", () => {
  it("marks an arrangement as maybe completed without setting completedAt", () => {
    const suggested = markArrangementMaybeCompleted(
      baseArrangement,
      "2026-05-16T03:00:00.000Z"
    );

    expect(suggested.status).toBe("maybeCompleted");
    expect(suggested.completedAt).toBeNull();
    expect(suggested.updatedAt).toBe("2026-05-16T03:00:00.000Z");
  });
});

describe("dismissArrangementCompletionSuggestion", () => {
  it("moves a maybe completed arrangement back into the active flow", () => {
    const suggested = markArrangementMaybeCompleted(
      baseArrangement,
      "2026-05-16T03:00:00.000Z"
    );

    const dismissed = dismissArrangementCompletionSuggestion(
      suggested,
      "2026-05-14T03:00:00.000Z"
    );

    expect(dismissed.status).toBe("active");
    expect(dismissed.completedAt).toBeNull();
    expect(dismissed.updatedAt).toBe("2026-05-14T03:00:00.000Z");
  });
});

describe("postponeArrangement", () => {
  it("moves an arrangement into someday while preserving previous time", () => {
    const postponed = postponeArrangement(baseArrangement, "2026-05-16T03:00:00.000Z");

    expect(postponed.status).toBe("someday");
    expect(postponed.timeMode).toBe("none");
    expect(postponed.deadlineAt).toBeNull();
    expect(postponed.startAt).toBeNull();
    expect(postponed.endAt).toBeNull();
    expect(postponed.snoozedAt).toBe("2026-05-16T03:00:00.000Z");
    expect(postponed.previousTime).toEqual({
      timeMode: "deadline",
      deadlineAt: "2026-05-15T02:00:00.000Z",
      startAt: null,
      endAt: null,
    });
  });
});

describe("restoreSomedayArrangement", () => {
  it("restores a someday arrangement back to its previous time and active flow", () => {
    const somedayArrangement = postponeArrangement(
      baseArrangement,
      "2026-05-16T03:00:00.000Z"
    );

    const restored = restoreSomedayArrangement(
      somedayArrangement,
      "2026-05-14T03:00:00.000Z"
    );

    expect(restored.status).toBe("active");
    expect(restored.timeMode).toBe("deadline");
    expect(restored.deadlineAt).toBe("2026-05-15T02:00:00.000Z");
    expect(restored.previousTime).toBeNull();
    expect(restored.snoozedAt).toBeNull();
    expect(restored.updatedAt).toBe("2026-05-14T03:00:00.000Z");
  });
});

describe("reopenCompletedArrangement", () => {
  it("moves a completed arrangement back into active flow", () => {
    const completed = completeArrangement(baseArrangement, "2026-05-16T03:00:00.000Z");

    const reopened = reopenCompletedArrangement(
      completed,
      "2026-05-14T03:00:00.000Z"
    );

    expect(reopened.status).toBe("active");
    expect(reopened.completedAt).toBeNull();
    expect(reopened.updatedAt).toBe("2026-05-14T03:00:00.000Z");
  });
});
