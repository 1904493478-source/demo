import { beforeEach, describe, expect, it } from "vitest";
import { hasStoredArrangements, loadArrangements, saveArrangements } from "./arrangementStore";
import type { Arrangement } from "../types";

const sampleArrangement: Arrangement = {
  id: "arr_1",
  title: "明天帮同事带早餐",
  notes: "豆浆和包子",
  people: ["同事"],
  place: "公司",
  timeMode: "deadline",
  deadlineAt: "2026-05-17T01:00:00.000Z",
  startAt: null,
  endAt: null,
  reminderAt: "2026-05-16T23:30:00.000Z",
  status: "active",
  createdAt: "2026-05-16T09:00:00.000Z",
  updatedAt: "2026-05-16T09:00:00.000Z",
  completedAt: null,
  snoozedAt: null,
  previousTime: null,
};

describe("arrangementStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads an empty list when no arrangements are stored", () => {
    expect(loadArrangements()).toEqual([]);
  });

  it("distinguishes an explicitly saved empty list from a missing store", () => {
    expect(hasStoredArrangements()).toBe(false);

    saveArrangements([]);

    expect(hasStoredArrangements()).toBe(true);
    expect(loadArrangements()).toEqual([]);
  });

  it("saves and loads arrangements from localStorage", () => {
    saveArrangements([sampleArrangement]);

    expect(loadArrangements()).toEqual([sampleArrangement]);
  });

  it("preserves optional AI execution capability fields", () => {
    const arrangement: Arrangement = {
      ...sampleArrangement,
      executionCapability: "aiAssist",
      aiAssistActions: ["prepareMaterials", "draftReply", "generateRoute"],
    };

    saveArrangements([arrangement]);

    expect(loadArrangements()).toEqual([arrangement]);
  });

  it("keeps old arrangements valid when AI execution fields are missing", () => {
    window.localStorage.setItem("arkme-demo.arrangements", JSON.stringify([sampleArrangement]));

    expect(loadArrangements()).toEqual([sampleArrangement]);
  });

  it("returns an empty list when stored JSON is malformed", () => {
    window.localStorage.setItem("arkme-demo.arrangements", "{bad json");

    expect(loadArrangements()).toEqual([]);
  });

  it("filters out malformed arrangement entries", () => {
    window.localStorage.setItem(
      "arkme-demo.arrangements",
      JSON.stringify([
        sampleArrangement,
        {
          id: "bad",
          title: "missing fields",
        },
      ])
    );

    expect(loadArrangements()).toEqual([sampleArrangement]);
  });
});
