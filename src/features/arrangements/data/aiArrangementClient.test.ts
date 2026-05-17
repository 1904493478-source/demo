import { describe, expect, it, vi, type MockedFunction } from "vitest";
import type { AiSettings } from "./aiSettingsStore";
import {
  generateArrangementAssistDraft,
  recognizeArrangementCompletionWithAi,
  testAiArrangementConnection,
  recognizeGroupChatArrangementWithAi,
  recognizePrivateChatArrangementWithAi,
  recognizeSelfMessageArrangementWithAi,
} from "./aiArrangementClient";
import type { Arrangement } from "../types";

const readySettings: AiSettings = {
  apiBaseUrl: "https://api.example.com/v1",
  modelName: "demo-model",
  apiKey: "sk-demo",
  recognitionEnabled: true,
  updatedAt: "2026-05-18T00:00:00.000Z",
};

type FetchMock = MockedFunction<typeof fetch>;

function createFetchMock(content: unknown): FetchMock {
  return vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(content),
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  ) as FetchMock;
}

describe("aiArrangementClient", () => {
  it("tests an OpenAI-compatible chat completions connection without creating a candidate", async () => {
    const fetchMock = createFetchMock({ shouldCreate: false });

    await expect(
      testAiArrangementConnection({
        settings: readySettings,
        fetchImpl: fetchMock,
      })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      model: "demo-model",
      temperature: 0,
    });
    expect(body.messages.at(-1)).toMatchObject({
      role: "user",
      content: expect.stringContaining("连接测试"),
    });
  });

  it("fails the connection test when required settings are missing or the API rejects it", async () => {
    await expect(
      testAiArrangementConnection({
        settings: { ...readySettings, apiKey: "" },
        fetchImpl: createFetchMock({ shouldCreate: false }),
      })
    ).rejects.toThrow("AI settings are incomplete");

    await expect(
      testAiArrangementConnection({
        settings: readySettings,
        fetchImpl: vi.fn().mockResolvedValue(new Response("{}", { status: 401 })) as FetchMock,
      })
    ).rejects.toThrow("AI connection test failed: 401");
  });

  it("calls an OpenAI-compatible chat completions endpoint for self-message recognition", async () => {
    const fetchMock = createFetchMock({
      shouldCreate: true,
      title: "后天下午去医院复诊",
      notes: "模型从发给自己的消息识别。",
      people: ["自己"],
      place: "医院",
      timeMode: "deadline",
      deadlineAt: "2026-05-19T07:00:00.000Z",
      confidence: "high",
      sourceSummary: "发给自己：后天下午去医院复诊",
    });

    const candidate = await recognizeSelfMessageArrangementWithAi({
      settings: readySettings,
      message: "后天下午去医院复诊",
      now: new Date("2026-05-17T08:00:00+08:00"),
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-demo",
          "Content-Type": "application/json",
        }),
      })
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      model: "demo-model",
      temperature: 0.2,
    });
    expect(candidate).toMatchObject({
      id: "cand_ai_self_hou-tian-xia-wu-qu-yi-yuan-fu-zhen",
      title: "后天下午去医院复诊",
      notes: "模型从发给自己的消息识别。",
      people: ["自己"],
      place: "医院",
      timeMode: "deadline",
      deadlineAt: "2026-05-19T07:00:00.000Z",
      sourceType: "selfMessage",
      sourceSummary: "发给自己：后天下午去医院复诊",
      rawContext: ["后天下午去医院复诊"],
      confidence: "high",
      status: "pending",
    });
  });

  it("calls the model for private-chat recognition and keeps the stable source message id", async () => {
    const fetchMock = createFetchMock({
      shouldCreate: true,
      title: "明天帮用户A拿资料",
      notes: "模型从私聊上下文识别。",
      people: ["用户A"],
      place: "公司",
      timeMode: "deadline",
      deadlineAt: "2026-05-18T07:00:00.000Z",
      confidence: "high",
      sourceSummary: "私聊：用户A 请求拿资料",
    });

    const result = await recognizePrivateChatArrangementWithAi({
      settings: readySettings,
      conversationId: "private:identity-user-a",
      identityName: "用户A",
      requestMessage: {
        id: "msg-documents",
        text: "明天下午3点帮我去公司拿资料",
        sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      },
      replyMessage: {
        id: "reply-ok",
        text: "可以，我去拿",
        sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      },
      now: new Date("2026-05-17T08:05:00+08:00"),
      fetchImpl: fetchMock,
    });

    expect(result?.recognizedMessageId).toBe("msg-documents");
    expect(result?.candidate).toMatchObject({
      id: "cand_private_private-identity-user-a_msg-documents",
      title: "明天帮用户A拿资料",
      sourceType: "privateChat",
      rawContext: ["用户A：明天下午3点帮我去公司拿资料", "我：可以，我去拿"],
    });
  });

  it("calls the model for group-chat recognition and keeps the stable source message id", async () => {
    const fetchMock = createFetchMock({
      shouldCreate: true,
      title: "AI 群聊明天帮用户A拿资料",
      notes: "模型从群聊上下文识别。",
      people: ["用户A"],
      place: "公司",
      timeMode: "deadline",
      deadlineAt: "2026-05-18T07:00:00.000Z",
      confidence: "high",
      sourceSummary: "群聊：候选测试群 / 用户A 请求拿资料",
    });

    const result = await recognizeGroupChatArrangementWithAi({
      settings: readySettings,
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
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.messages.at(-1).content).toContain("场景：群聊中其他成员提出请求");
    expect(body.messages.at(-1).content).toContain("当前用户名称：李小溪");
    expect(result?.recognizedMessageId).toBe("group-msg-documents");
    expect(result?.candidate).toMatchObject({
      id: "cand_group_group-candidate-test_group-msg-documents",
      title: "AI 群聊明天帮用户A拿资料",
      sourceType: "groupChat",
      rawContext: ["候选测试群 / 用户A：@李小溪 明天下午3点帮我去公司拿资料", "我：可以，我去拿"],
    });
  });

  it("returns null when AI recognition is disabled or the model says no arrangement", async () => {
    const disabled = await recognizeSelfMessageArrangementWithAi({
      settings: { ...readySettings, recognitionEnabled: false },
      message: "后天去医院",
      fetchImpl: createFetchMock({ shouldCreate: true, title: "后天去医院" }),
    });
    const noArrangement = await recognizeSelfMessageArrangementWithAi({
      settings: readySettings,
      message: "今天好累",
      fetchImpl: createFetchMock({ shouldCreate: false }),
    });

    expect(disabled).toBeNull();
    expect(noArrangement).toBeNull();
  });

  it("uses the configured AI API only to suggest possible completion without completing", async () => {
    const fetchMock = createFetchMock({
      shouldSuggestCompletion: true,
      arrangementId: "arr_documents",
      confidence: "medium",
      evidence: "用户说资料已经取回。",
    });
    const arrangements: Arrangement[] = [
      {
        id: "arr_documents",
        title: "明天下午帮用户A去公司拿资料",
        notes: "",
        people: ["用户A"],
        place: "公司",
        timeMode: "deadline",
        deadlineAt: "2026-05-19T07:00:00.000Z",
        startAt: null,
        endAt: null,
        reminderAt: null,
        status: "active",
        createdAt: "2026-05-18T02:00:00.000Z",
        updatedAt: "2026-05-18T02:00:00.000Z",
        completedAt: null,
        snoozedAt: null,
        previousTime: null,
      },
    ];

    const result = await recognizeArrangementCompletionWithAi({
      settings: readySettings,
      arrangements,
      messageText: "资料取回来了，放前台了",
      now: new Date("2026-05-18T10:00:00+08:00"),
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.messages[0].content).toContain("只建议可能已完成");
    expect(body.messages.at(-1).content).toContain("明天下午帮用户A去公司拿资料");
    expect(result).toEqual({
      arrangementId: "arr_documents",
      confidence: "medium",
      evidence: "用户说资料已经取回。",
    });
  });

  it("generates an AI assist draft when settings are configured", async () => {
    const fetchMock = createFetchMock({
      content: "请带身份证、医保卡和体检单；提前 20 分钟出发。",
    });

    const result = await generateArrangementAssistDraft({
      settings: readySettings,
      arrangement: {
        id: "arr_hospital",
        title: "明天去医院复诊",
        notes: "带上报告。",
        people: ["自己"],
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
        executionCapability: "aiAssist",
        aiAssistActions: ["prepareMaterials"],
      },
      action: "prepareMaterials",
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.messages[0].content).toContain("只生成辅助草稿");
    expect(body.messages.at(-1).content).toContain("明天去医院复诊");
    expect(result).toEqual({
      source: "ai",
      title: "准备材料",
      content: "请带身份证、医保卡和体检单；提前 20 分钟出发。",
    });
  });

  it("falls back to a local assist draft when AI settings are unavailable", async () => {
    const result = await generateArrangementAssistDraft({
      settings: { ...readySettings, recognitionEnabled: false },
      arrangement: {
        id: "arr_reply",
        title: "回复用户A拿资料进度",
        notes: "",
        people: ["用户A"],
        place: "公司",
        timeMode: "none",
        deadlineAt: null,
        startAt: null,
        endAt: null,
        reminderAt: null,
        status: "active",
        createdAt: "2026-05-18T02:00:00.000Z",
        updatedAt: "2026-05-18T02:00:00.000Z",
        completedAt: null,
        snoozedAt: null,
        previousTime: null,
      },
      action: "draftReply",
      fetchImpl: vi.fn() as FetchMock,
    });

    expect(result.source).toBe("local");
    expect(result.title).toBe("草拟回复");
    expect(result.content).toContain("回复用户A拿资料进度");
    expect(result.content).toContain("你看这样可以吗");
  });

  it("falls back to a local assist draft when the AI assist request times out", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      () => new Promise<Response>(() => undefined)
    ) as FetchMock;
    const resultPromise = generateArrangementAssistDraft({
      settings: readySettings,
      arrangement: {
        id: "arr_slow_assist",
        title: "明天去公司拿资料",
        notes: "",
        people: ["用户A"],
        place: "公司",
        timeMode: "deadline",
        deadlineAt: "2026-05-19T07:00:00.000Z",
        startAt: null,
        endAt: null,
        reminderAt: null,
        status: "active",
        createdAt: "2026-05-18T02:00:00.000Z",
        updatedAt: "2026-05-18T02:00:00.000Z",
        completedAt: null,
        snoozedAt: null,
        previousTime: null,
      },
      action: "prepareMaterials",
      fetchImpl: fetchMock,
    });

    await vi.advanceTimersByTimeAsync(5200);
    const result = await resultPromise;

    expect(result.source).toBe("local");
    expect(result.title).toBe("准备材料");
    expect(result.content).toContain("明天去公司拿资料");
    vi.useRealTimers();
  });
});
