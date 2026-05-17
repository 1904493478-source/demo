import { describe, expect, it } from "vitest";
import { recognizeArrangementCompletion } from "./arrangementCompletionRecognition";
import type { Arrangement } from "../types";

const hospitalArrangement: Arrangement = {
  id: "arr_hospital_followup",
  title: "明天去医院复诊",
  notes: "爸爸提醒过，记得带医保卡。",
  people: ["爸爸"],
  place: "市中心医院",
  timeMode: "deadline",
  deadlineAt: "2026-05-19T02:00:00.000Z",
  startAt: null,
  endAt: null,
  reminderAt: null,
  status: "active",
  createdAt: "2026-05-18T02:00:00.000Z",
  updatedAt: "2026-05-18T02:00:00.000Z",
  completedAt: null,
  snoozedAt: null,
  previousTime: null,
};

describe("recognizeArrangementCompletion", () => {
  it("suggests completion when a follow-up message clearly says the arrangement happened", () => {
    const result = recognizeArrangementCompletion({
      arrangements: [hospitalArrangement],
      messageText: "我今天上午已经去医院体检了，报告下午拿。",
    });

    expect(result).toMatchObject({
      arrangementId: "arr_hospital_followup",
      confidence: "medium",
      evidence: "我今天上午已经去医院体检了，报告下午拿。",
    });
  });

  it("suggests completion when a follow-up says requested materials were brought back", () => {
    const result = recognizeArrangementCompletion({
      arrangements: [
        {
          ...hospitalArrangement,
          id: "arr_documents_followup",
          title: "明天下午帮用户A去公司拿资料",
          notes: "从私聊候选确认。",
          people: ["用户A"],
          place: "公司",
        },
      ],
      messageText: "资料已经拿回来了。",
    });

    expect(result).toMatchObject({
      arrangementId: "arr_documents_followup",
      confidence: "medium",
      evidence: "资料已经拿回来了。",
    });
  });

  it("does not suggest completion for negative or postponed follow-up messages", () => {
    expect(
      recognizeArrangementCompletion({
        arrangements: [hospitalArrangement],
        messageText: "今天还没去医院，可能改天再说。",
      })
    ).toBeNull();
  });

  it("ignores arrangements that are already completed or parked for later", () => {
    expect(
      recognizeArrangementCompletion({
        arrangements: [
          { ...hospitalArrangement, id: "arr_done", status: "completed" },
          { ...hospitalArrangement, id: "arr_someday", status: "someday" },
        ],
        messageText: "我已经去医院了。",
      })
    ).toBeNull();
  });
});
