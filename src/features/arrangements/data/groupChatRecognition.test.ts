import { describe, expect, it } from "vitest";
import { recognizeGroupChatArrangement } from "./groupChatRecognition";

describe("recognizeGroupChatArrangement", () => {
  it("creates one pending candidate when a group request targets the current user and the user accepts", () => {
    const result = recognizeGroupChatArrangement({
      conversationId: "group-candidate-test",
      groupName: "候选测试群",
      identityName: "用户A",
      currentUserName: "李小溪",
      requestMessage: {
        id: "group-msg-documents",
        text: "@李小溪 明天下午3点帮我去公司拿资料",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-ok",
        text: "可以，我去拿",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });

    expect(result?.recognizedMessageId).toBe("group-msg-documents");
    expect(result?.candidate).toMatchObject({
      id: "cand_group_group-candidate-test_group-msg-documents",
      title: "明天下午3点帮用户A去公司拿资料",
      notes: "从群聊上下文识别，确认后才会创建正式安排。",
      people: ["用户A"],
      timeMode: "deadline",
      deadlineAt: "2026-05-18T07:00:00.000Z",
      sourceType: "groupChat",
      sourceSummary: "群聊：候选测试群 / 用户A 请求去公司拿资料",
      rawContext: ["候选测试群 / 用户A：@李小溪 明天下午3点帮我去公司拿资料", "我：可以，我去拿"],
      confidence: "high",
      status: "pending",
    });
  });

  it("does not create a candidate for group requests that do not target the current user", () => {
    const result = recognizeGroupChatArrangement({
      conversationId: "group-candidate-test",
      groupName: "候选测试群",
      identityName: "用户A",
      currentUserName: "李小溪",
      requestMessage: {
        id: "group-msg-other",
        text: "@王同学 明天下午3点帮我去公司拿资料",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-ok",
        text: "可以",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });

    expect(result).toBeNull();
  });

  it("creates a low-confidence candidate for an accepted group request without @ when the user clearly responds", () => {
    const result = recognizeGroupChatArrangement({
      conversationId: "group-candidate-test",
      groupName: "候选测试群",
      identityName: "用户A",
      currentUserName: "李小溪",
      requestMessage: {
        id: "group-msg-no-mention",
        text: "明天下午3点谁可以帮我去公司拿资料？",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-ok",
        text: "可以，我去拿",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });

    expect(result?.recognizedMessageId).toBe("group-msg-no-mention");
    expect(result?.candidate).toMatchObject({
      id: "cand_group_group-candidate-test_group-msg-no-mention",
      title: "明天下午3点帮用户A去公司拿资料",
      sourceType: "groupChat",
      confidence: "low",
      status: "pending",
    });
    expect(result?.candidate.sourceSummary).toContain("低置信");
  });

  it("uses the candidate name fallback when the demo profile has not been initialized", () => {
    const result = recognizeGroupChatArrangement({
      conversationId: "group-candidate-test",
      groupName: "候选测试群",
      identityName: "用户A",
      currentUserName: "",
      requestMessage: {
        id: "group-msg-documents",
        text: "@李小溪 明天下午3点帮我去公司拿资料",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-ok",
        text: "可以，我去拿",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });

    expect(result?.candidate).toMatchObject({
      title: "明天下午3点帮用户A去公司拿资料",
      sourceType: "groupChat",
      status: "pending",
    });
  });
});
