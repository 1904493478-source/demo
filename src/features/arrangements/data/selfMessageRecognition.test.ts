import { describe, expect, it } from "vitest";
import { recognizeSelfMessageArrangement } from "./selfMessageRecognition";

describe("recognizeSelfMessageArrangement", () => {
  it("turns a self message with a future date into a pending AI candidate", () => {
    const candidate = recognizeSelfMessageArrangement(
      "后天去一趟医院",
      new Date("2026-05-17T10:15:00+08:00")
    );

    expect(candidate).toMatchObject({
      id: "cand_self_hou-tian-qu-yi-tang-yi-yuan",
      title: "后天去一趟医院",
      notes: "从发给自己的消息识别，确认后才会创建正式安排。",
      people: ["自己"],
      place: "医院",
      timeMode: "deadline",
      sourceType: "selfMessage",
      sourceSummary: "发给自己：后天去一趟医院",
      rawContext: ["后天去一趟医院"],
      confidence: "high",
      status: "pending",
    });
    expect(candidate?.deadlineAt).toBe("2026-05-19T01:00:00.000Z");
  });

  it("keeps ambiguous symbolic messages out of AI candidates", () => {
    const candidate = recognizeSelfMessageArrangement("～～", new Date("2026-05-17T10:15:00+08:00"));

    expect(candidate).toBeNull();
  });

  it("returns a low-confidence candidate when action exists but time is missing", () => {
    const candidate = recognizeSelfMessageArrangement(
      "去医院拿报告",
      new Date("2026-05-17T10:15:00+08:00")
    );

    expect(candidate).toMatchObject({
      title: "去医院拿报告",
      place: "医院",
      timeMode: "none",
      deadlineAt: null,
      confidence: "low",
      status: "pending",
    });
  });
});
