import { describe, expect, it } from "vitest";
import { recognizePrivateChatArrangement } from "./privateChatRecognition";

describe("recognizePrivateChatArrangement", () => {
  it("turns a private breakfast request plus an acceptance reply into a pending AI candidate", () => {
    const result = recognizePrivateChatArrangement({
      conversationId: "private:identity-user-a",
      identityName: "用户A",
      requestMessage: {
        id: "msg-breakfast",
        text: "明天帮我带早餐",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-ok",
        text: "好的",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });

    expect(result?.recognizedMessageId).toBe("msg-breakfast");
    expect(result?.candidate).toMatchObject({
      id: "cand_private_private-identity-user-a_msg-breakfast",
      title: "明天帮用户A带早餐",
      notes: "从私聊上下文识别，确认后才会创建正式安排。",
      people: ["用户A"],
      timeMode: "deadline",
      deadlineAt: "2026-05-18T01:00:00.000Z",
      sourceType: "privateChat",
      sourceSummary: "私聊：用户A 请求带早餐",
      rawContext: ["用户A：明天帮我带早餐", "我：好的"],
      confidence: "high",
      status: "pending",
    });
  });

  it("does not create a candidate before the user accepts the request", () => {
    const result = recognizePrivateChatArrangement({
      conversationId: "private:identity-user-a",
      identityName: "用户A",
      requestMessage: {
        id: "msg-breakfast",
        text: "明天帮我带早餐",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-question",
        text: "你想吃什么？",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });

    expect(result).toBeNull();
  });

  it("merges multiple requested breakfast items into one pending AI candidate", () => {
    const result = recognizePrivateChatArrangement({
      conversationId: "private:identity-user-a",
      identityName: "用户A",
      requestMessage: {
        id: "msg-breakfast-items",
        text: "明天帮我带豆浆、包子和咖啡",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-ok",
        text: "好的",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });

    expect(result?.candidate).toMatchObject({
      id: "cand_private_private-identity-user-a_msg-breakfast-items",
      title: "明天帮用户A带豆浆、包子和咖啡",
      notes: "从私聊上下文识别，确认后才会创建正式安排。物品：豆浆、包子、咖啡。",
      rawContext: ["用户A：明天帮我带豆浆、包子和咖啡", "我：好的"],
    });
  });

  it("recognizes a general private-chat request with time, place, and a commitment reply", () => {
    const result = recognizePrivateChatArrangement({
      conversationId: "private:identity-user-a",
      identityName: "用户A",
      requestMessage: {
        id: "msg-documents",
        text: "明天下午3点帮我去公司拿资料",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-commit",
        text: "可以，我明天下午去拿",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });

    expect(result?.candidate).toMatchObject({
      title: "明天下午3点帮用户A去公司拿资料",
      timeMode: "deadline",
      deadlineAt: "2026-05-18T07:00:00.000Z",
      sourceSummary: "私聊：用户A 请求去公司拿资料",
    });
  });

  it("recognizes a reordered request without dropping the requested object", () => {
    const result = recognizePrivateChatArrangement({
      conversationId: "private:identity-user-a",
      identityName: "用户A",
      requestMessage: {
        id: "msg-reordered-documents",
        text: "资料明天下午3点能不能帮我去公司拿一下",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-no-problem",
        text: "没问题",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });

    expect(result?.candidate).toMatchObject({
      title: "明天下午3点帮用户A去公司拿资料",
      sourceSummary: "私聊：用户A 请求去公司拿资料",
    });
  });

  it("recognizes responsibility-transfer requests even when the request cue is in the middle of the sentence", () => {
    const result = recognizePrivateChatArrangement({
      conversationId: "private:identity-user-a",
      identityName: "用户A",
      requestMessage: {
        id: "msg-middle-cue",
        text: "你明天下午3点去公司帮我拿资料可以吗",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-commit",
        text: "行，我来安排",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });

    expect(result?.candidate).toMatchObject({
      title: "明天下午3点帮用户A去公司拿资料",
      sourceSummary: "私聊：用户A 请求去公司拿资料",
    });
  });

  it("merges multiple requested shopping items into one candidate instead of creating separate arrangements", () => {
    const result = recognizePrivateChatArrangement({
      conversationId: "private:identity-user-a",
      identityName: "用户A",
      requestMessage: {
        id: "msg-groceries",
        text: "后天帮我买牛奶、面包和鸡蛋",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-received",
        text: "收到",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });

    expect(result?.candidate).toMatchObject({
      title: "后天帮用户A买牛奶、面包和鸡蛋",
      notes: "从私聊上下文识别，确认后才会创建正式安排。物品：牛奶、面包、鸡蛋。",
    });
  });

  it("does not create a candidate for a statement that is not asking the current user to do something", () => {
    const result = recognizePrivateChatArrangement({
      conversationId: "private:identity-user-a",
      identityName: "用户A",
      requestMessage: {
        id: "msg-not-request",
        text: "我明天去公司拿资料",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-ok",
        text: "好的",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });

    expect(result).toBeNull();
  });

  it("does not create a candidate when the reply is a refusal or only a follow-up question", () => {
    const refused = recognizePrivateChatArrangement({
      conversationId: "private:identity-user-a",
      identityName: "用户A",
      requestMessage: {
        id: "msg-help",
        text: "明天帮我取快递",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-refuse",
        text: "不好意思，明天没空",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });
    const question = recognizePrivateChatArrangement({
      conversationId: "private:identity-user-a",
      identityName: "用户A",
      requestMessage: {
        id: "msg-help",
        text: "明天帮我取快递",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-question",
        text: "几点？",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
    });

    expect(refused).toBeNull();
    expect(question).toBeNull();
  });
});
