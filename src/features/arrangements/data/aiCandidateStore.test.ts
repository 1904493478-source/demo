import { beforeEach, describe, expect, it } from "vitest";
import {
  acceptAiCandidate,
  dismissAiCandidate,
  loadAiCandidates,
  saveAiCandidates,
  upsertAiCandidate,
} from "./aiCandidateStore";
import type { AiArrangementCandidate } from "../types";

const candidate: AiArrangementCandidate = {
  id: "cand_hospital",
  title: "后天去一趟医院",
  notes: "来源：发给自己的消息",
  people: ["自己"],
  place: "医院",
  timeMode: "deadline",
  deadlineAt: "2026-05-19T02:00:00.000Z",
  startAt: null,
  endAt: null,
  reminderAt: null,
  sourceType: "selfMessage",
  sourceSummary: "用户发给自己：后天去一趟医院",
  rawContext: ["后天去一趟医院"],
  confidence: "high",
  status: "pending",
  createdAt: "2026-05-17T08:00:00.000Z",
  updatedAt: "2026-05-17T08:00:00.000Z",
};

describe("aiCandidateStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts with no AI candidates", () => {
    expect(loadAiCandidates()).toEqual([]);
  });

  it("saves and loads pending AI arrangement candidates", () => {
    saveAiCandidates([candidate]);

    expect(loadAiCandidates()).toEqual([candidate]);
  });

  it("upserts a candidate without duplicating the same id", () => {
    saveAiCandidates([candidate]);

    const updated = upsertAiCandidate({
      ...candidate,
      title: "后天下午去医院复诊",
      confidence: "medium",
      updatedAt: "2026-05-17T08:20:00.000Z",
    });

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      id: "cand_hospital",
      title: "后天下午去医院复诊",
      confidence: "medium",
    });
    expect(loadAiCandidates()).toEqual(updated);
  });

  it("marks an ignored candidate as dismissed instead of turning it into an arrangement", () => {
    saveAiCandidates([candidate]);

    const dismissed = dismissAiCandidate(candidate.id, "2026-05-17T08:30:00.000Z");

    expect(dismissed[0]).toMatchObject({
      id: candidate.id,
      status: "dismissed",
      updatedAt: "2026-05-17T08:30:00.000Z",
    });
  });

  it("does not revive a handled candidate when the same chat is recognized again", () => {
    saveAiCandidates([candidate]);
    acceptAiCandidate(candidate.id, "2026-05-17T08:40:00.000Z");

    const nextCandidates = upsertAiCandidate({
      ...candidate,
      title: "后天下午去医院复诊",
      updatedAt: "2026-05-17T08:45:00.000Z",
    });

    expect(nextCandidates[0]).toMatchObject({
      id: candidate.id,
      title: candidate.title,
      status: "accepted",
      updatedAt: "2026-05-17T08:40:00.000Z",
    });
  });

  it("merges pending candidates with the same topic and keeps all original contexts", () => {
    const dadCandidate: AiArrangementCandidate = {
      ...candidate,
      id: "cand_private_dad_hospital",
      title: "明天去医院复诊",
      people: ["爸爸"],
      sourceType: "privateChat",
      sourceSummary: "私聊：爸爸 提醒去医院",
      rawContext: ["爸爸：明天别忘了去医院复诊", "我：好的"],
      deadlineAt: "2026-05-18T02:00:00.000Z",
      createdAt: "2026-05-17T08:00:00.000Z",
      updatedAt: "2026-05-17T08:00:00.000Z",
    };
    const sisterCandidate: AiArrangementCandidate = {
      ...candidate,
      id: "cand_private_sister_hospital",
      title: "后天去医院复诊",
      people: ["姐姐"],
      sourceType: "privateChat",
      sourceSummary: "私聊：姐姐 提醒去医院",
      rawContext: ["姐姐：后天记得去医院复诊", "我：收到"],
      deadlineAt: "2026-05-19T02:00:00.000Z",
      confidence: "medium",
      createdAt: "2026-05-17T08:10:00.000Z",
      updatedAt: "2026-05-17T08:10:00.000Z",
    };

    upsertAiCandidate(dadCandidate);
    const merged = upsertAiCandidate(sisterCandidate);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "cand_private_sister_hospital",
      title: "后天去医院复诊",
      people: ["姐姐", "爸爸"],
      timeConflict: true,
      sourceSummary: "私聊：姐姐 提醒去医院",
      rawContext: ["姐姐：后天记得去医院复诊", "我：收到", "爸爸：明天别忘了去医院复诊", "我：好的"],
      relatedSources: [
        expect.objectContaining({
          id: "cand_private_sister_hospital",
          sourceSummary: "私聊：姐姐 提醒去医院",
          confidence: "medium",
        }),
        expect.objectContaining({
          id: "cand_private_dad_hospital",
          sourceSummary: "私聊：爸爸 提醒去医院",
          confidence: "high",
        }),
      ],
    });
    expect(loadAiCandidates()).toEqual(merged);
  });

  it("merges candidates in the same place when their times are close", () => {
    const registrationCandidate: AiArrangementCandidate = {
      ...candidate,
      id: "cand_registration",
      title: "明天上午去市中心医院挂号",
      notes: "从私聊上下文识别。",
      people: ["爸爸"],
      place: "市中心医院",
      deadlineAt: "2026-05-18T01:00:00.000Z",
      sourceSummary: "私聊：爸爸 提醒挂号",
      rawContext: ["爸爸：明天上午去市中心医院先挂号"],
    };
    const reportCandidate: AiArrangementCandidate = {
      ...candidate,
      id: "cand_report",
      title: "明天上午去市中心医院取报告",
      notes: "从私聊上下文识别。",
      people: ["姐姐"],
      place: "市中心医院",
      deadlineAt: "2026-05-18T02:30:00.000Z",
      sourceSummary: "私聊：姐姐 提醒取报告",
      rawContext: ["姐姐：明天上午去市中心医院顺便取报告"],
    };

    upsertAiCandidate(registrationCandidate);
    const merged = upsertAiCandidate(reportCandidate);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "cand_report",
      place: "市中心医院",
      people: ["姐姐", "爸爸"],
      relatedSources: [
        expect.objectContaining({ id: "cand_report" }),
        expect.objectContaining({ id: "cand_registration" }),
      ],
    });
  });

  it("keeps candidates separate when the same place is too far apart in time", () => {
    const morningCandidate: AiArrangementCandidate = {
      ...candidate,
      id: "cand_morning",
      title: "明天上午去市中心医院挂号",
      place: "市中心医院",
      deadlineAt: "2026-05-18T01:00:00.000Z",
      sourceSummary: "私聊：爸爸 提醒挂号",
    };
    const eveningCandidate: AiArrangementCandidate = {
      ...candidate,
      id: "cand_evening",
      title: "明天晚上去市中心医院送资料",
      place: "市中心医院",
      deadlineAt: "2026-05-18T12:30:00.000Z",
      sourceSummary: "私聊：姐姐 提醒送资料",
    };

    upsertAiCandidate(morningCandidate);
    const nextCandidates = upsertAiCandidate(eveningCandidate);

    expect(nextCandidates).toHaveLength(2);
  });

  it("drops malformed stored candidates", () => {
    window.localStorage.setItem("arkme-demo.aiArrangementCandidates", JSON.stringify([{ id: 1 }]));

    expect(loadAiCandidates()).toEqual([]);
  });
});
