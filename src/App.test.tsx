import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import {
  loadAiCandidates,
  saveAiCandidates,
} from "./features/arrangements/data/aiCandidateStore";
import type { AiArrangementCandidate, Arrangement } from "./features/arrangements/types";
import {
  getPrivateConversationId,
  testGroupsStorageKey,
  testIdentitiesStorageKey,
  testMessagesStorageKey,
} from "./data/testConversations";

function openUnreadPreview(title: string) {
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(`(新消息|New message).*${title}`) })
  );
}

function openConversationFromDrawer(conversationId: string) {
  fireEvent.click(screen.getByRole("button", { name: /打开侧边栏|Open sidebar/ }));
  fireEvent.click(screen.getByTestId(`test-conversation-drawer-item-${conversationId}`));
}

function openArrangementsTab() {
  fireEvent.click(screen.getByTestId("mobile-tab-arrangements"));
}

describe("App navigation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("opens the arrangements page from the bottom navigation", () => {
    render(<App />);

    openArrangementsTab();

    expect(screen.getByRole("heading", { name: "安排" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "以后再说" })).toBeInTheDocument();
  });

  it("shows a first-run arrangements guide and remembers dismissal", () => {
    render(<App />);

    openArrangementsTab();

    const guide = screen.getByTestId("arrangements-first-run-guide");
    expect(guide).toHaveTextContent("安排是什么");
    expect(guide).toHaveTextContent("手动新建");
    expect(guide).toHaveTextContent("AI 候选");
    expect(guide).toHaveTextContent("闪烁的完成按钮");
    expect(guide).toHaveTextContent("以后再说");
    expect(guide).toHaveTextContent("AI 辅助");

    fireEvent.click(screen.getByRole("button", { name: "知道了，开始使用安排" }));
    expect(screen.queryByTestId("arrangements-first-run-guide")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("arkme-demo.arrangementsGuideSeen")).toBe("true");

    fireEvent.click(screen.getByTestId("mobile-tab-records"));
    openArrangementsTab();
    expect(screen.queryByTestId("arrangements-first-run-guide")).not.toBeInTheDocument();
  });

  it("adds an implicit AI candidate from an accepted private chat request without showing explicit recognition copy", () => {
    vi.useFakeTimers();
    const identity = {
      id: "identity-user-a",
      name: "用户A",
      note: "早餐测试",
      avatarLabel: "A",
      color: "#0E9DEC",
      createdAt: 1760000001000,
    };
    const requestMessage = {
      id: "msg-breakfast",
      conversationId: getPrivateConversationId(identity.id),
      conversationType: "private" as const,
      identityId: identity.id,
      text: "明天帮我带早餐",
      sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      sender: "identity" as const,
    };

    window.localStorage.setItem(testIdentitiesStorageKey, JSON.stringify([identity]));
    window.localStorage.setItem(testMessagesStorageKey, JSON.stringify([requestMessage]));

    render(<App />);

    openUnreadPreview("用户A");

    const composer = screen.getByRole("textbox", {
      name: /单击文字，长按语音|Tap for text, hold for voice/,
    });
    fireEvent.click(composer);
    fireEvent.change(composer, { target: { value: "好的" } });
    fireEvent.click(screen.getByRole("button", { name: /发送|Send/ }));

    expect(loadAiCandidates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "明天帮用户A带早餐",
          sourceType: "privateChat",
          status: "pending",
        }),
      ])
    );
    expect(screen.queryByText(/已为您添加到候选|识别到.*安排/)).not.toBeInTheDocument();
    expect(
      screen.getByTestId("chat-ai-recognition-background-ripple-test-msg-breakfast")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("chat-ai-recognition-background-glow-test-msg-breakfast")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("chat-ai-recognition-feedback-bed-test-msg-breakfast")
    ).toBeInTheDocument();
    expect(screen.getByTestId("chat-message-bubble-test-msg-breakfast")).not.toHaveClass(
      "ai-recognition-bubble"
    );
    expect(screen.getByTestId("chat-message-bubble-test-msg-breakfast")).toHaveAttribute(
      "data-ai-recognition",
      "true"
    );

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(
      screen.queryByTestId("chat-ai-recognition-feedback-bed-test-msg-breakfast")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-message-bubble-test-msg-breakfast")).toHaveAttribute(
      "data-ai-recognition",
      "true"
    );
  });

  it("adds one AI candidate for a general multi-item private chat request after an accepted reply", () => {
    const identity = {
      id: "identity-user-a",
      name: "用户A",
      note: "通用安排测试",
      avatarLabel: "A",
      color: "#0E9DEC",
      createdAt: 1760000001000,
    };
    const requestMessage = {
      id: "msg-groceries",
      conversationId: getPrivateConversationId(identity.id),
      conversationType: "private" as const,
      identityId: identity.id,
      text: "后天帮我买牛奶、面包和鸡蛋",
      sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      sender: "identity" as const,
    };

    window.localStorage.setItem(testIdentitiesStorageKey, JSON.stringify([identity]));
    window.localStorage.setItem(testMessagesStorageKey, JSON.stringify([requestMessage]));

    render(<App />);
    openUnreadPreview("用户A");

    const composer = screen.getByRole("textbox", {
      name: /单击文字，长按语音|Tap for text, hold for voice/,
    });
    fireEvent.click(composer);
    fireEvent.change(composer, { target: { value: "收到，没问题" } });
    fireEvent.click(screen.getByRole("button", { name: /发送|Send/ }));
    fireEvent.click(screen.getByRole("button", { name: /Back|返回/ }));

    const candidates = loadAiCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      title: "后天帮用户A买牛奶、面包和鸡蛋",
      notes: "从私聊上下文识别，确认后才会创建正式安排。物品：牛奶、面包、鸡蛋。",
      sourceType: "privateChat",
      status: "pending",
    });

    openArrangementsTab();
    expect(screen.getByTestId("ai-candidate-preview")).toHaveTextContent(
      "后天帮用户A买牛奶、面包和鸡蛋"
    );
  });

  it("adds an implicit AI candidate from an accepted group chat request that targets the current user", () => {
    vi.useFakeTimers();
    const identity = {
      id: "identity-user-a",
      name: "用户A",
      note: "群聊安排测试",
      avatarLabel: "A",
      color: "#0E9DEC",
      createdAt: 1760000001000,
    };
    const group = {
      id: "group-candidate-test",
      name: "候选测试群",
      note: "群聊请求测试",
      avatarLabel: "群",
      color: "#8363FF",
      memberIdentityIds: [identity.id],
      createdAt: 1760000002000,
    };
    const requestMessage = {
      id: "group-msg-documents",
      conversationId: group.id,
      conversationType: "group" as const,
      identityId: identity.id,
      text: "@李小溪 明天下午3点帮我去公司拿资料",
      sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      sender: "identity" as const,
    };

    window.localStorage.setItem(testIdentitiesStorageKey, JSON.stringify([identity]));
    window.localStorage.setItem(testGroupsStorageKey, JSON.stringify([group]));
    window.localStorage.setItem(testMessagesStorageKey, JSON.stringify([requestMessage]));

    render(<App />);
    openUnreadPreview("候选测试群");

    const composer = screen.getByRole("textbox", {
      name: /单击文字，长按语音|Tap for text, hold for voice/,
    });
    fireEvent.click(composer);
    fireEvent.change(composer, { target: { value: "可以，我去拿" } });
    fireEvent.click(screen.getByRole("button", { name: /发送|Send/ }));

    expect(loadAiCandidates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "明天下午3点帮用户A去公司拿资料",
          sourceType: "groupChat",
          status: "pending",
        }),
      ])
    );
    expect(screen.queryByText(/已为您添加到候选|识别到.*安排/)).not.toBeInTheDocument();
    expect(
      screen.getByTestId("chat-ai-recognition-feedback-bed-test-group-msg-documents")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("chat-message-bubble-test-group-msg-documents").closest(".scroll-mt-4")
    ).toHaveClass("bg-primary-soft/70");

    fireEvent.click(screen.getByRole("button", { name: /Back|返回/ }));
    openArrangementsTab();
    expect(screen.getByTestId("ai-candidate-preview")).toHaveTextContent("群聊");
    expect(screen.getByTestId("ai-candidate-preview")).toHaveTextContent(
      "明天下午3点帮用户A去公司拿资料"
    );
  });

  it("adds only a low-confidence candidate for an accepted group request without @", () => {
    const identity = {
      id: "identity-user-a",
      name: "用户A",
      note: "群聊无 @ 测试",
      avatarLabel: "A",
      color: "#0E9DEC",
      createdAt: 1760000001000,
    };
    const group = {
      id: "group-no-mention-test",
      name: "无 @ 测试群",
      note: "群聊低置信测试",
      avatarLabel: "群",
      color: "#8363FF",
      memberIdentityIds: [identity.id],
      createdAt: 1760000002000,
    };
    const requestMessage = {
      id: "group-msg-no-mention",
      conversationId: group.id,
      conversationType: "group" as const,
      identityId: identity.id,
      text: "明天下午3点谁可以帮我去公司拿资料？",
      sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      sender: "identity" as const,
    };

    window.localStorage.setItem(testIdentitiesStorageKey, JSON.stringify([identity]));
    window.localStorage.setItem(testGroupsStorageKey, JSON.stringify([group]));
    window.localStorage.setItem(testMessagesStorageKey, JSON.stringify([requestMessage]));

    render(<App />);
    openUnreadPreview("无 @ 测试群");

    const composer = screen.getByRole("textbox", {
      name: /单击文字，长按语音|Tap for text, hold for voice/,
    });
    fireEvent.click(composer);
    fireEvent.change(composer, { target: { value: "可以，我去拿" } });
    fireEvent.click(screen.getByRole("button", { name: /发送|Send/ }));

    expect(loadAiCandidates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "明天下午3点帮用户A去公司拿资料",
          sourceType: "groupChat",
          confidence: "low",
          status: "pending",
        }),
      ])
    );
  });

  it("suggests possible completion from a follow-up chat message without auto-completing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T10:15:00+08:00"));
    const identity = {
      id: "identity-user-a",
      name: "用户A",
      note: "完成建议测试",
      avatarLabel: "A",
      color: "#0E9DEC",
      createdAt: 1760000001000,
    };
    const arrangement: Arrangement = {
      id: "arr_documents_followup",
      title: "明天下午帮用户A去公司拿资料",
      notes: "从群聊候选确认。",
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
    };
    const initialMessage = {
      id: "msg-documents-followup",
      conversationId: getPrivateConversationId(identity.id),
      conversationType: "private" as const,
      identityId: identity.id,
      text: "明天下午帮忙去公司拿资料",
      sentAt: new Date("2026-05-18T08:00:00+08:00").getTime(),
      sender: "identity" as const,
    };

    window.localStorage.setItem(testIdentitiesStorageKey, JSON.stringify([identity]));
    window.localStorage.setItem(testMessagesStorageKey, JSON.stringify([initialMessage]));
    window.localStorage.setItem("arkme-demo.arrangements", JSON.stringify([arrangement]));

    render(<App />);
    openConversationFromDrawer(getPrivateConversationId(identity.id));

    const composer = screen.getByRole("textbox", {
      name: /单击文字，长按语音|Tap for text, hold for voice/,
    });
    fireEvent.click(composer);
    fireEvent.change(composer, { target: { value: "我已经去公司拿到资料了" } });
    fireEvent.click(screen.getByRole("button", { name: /发送|Send/ }));

    const storedArrangements = JSON.parse(
      window.localStorage.getItem("arkme-demo.arrangements") ?? "[]"
    ) as Arrangement[];
    expect(storedArrangements[0]).toMatchObject({
      id: "arr_documents_followup",
      status: "maybeCompleted",
      completedAt: null,
    });

    fireEvent.click(screen.getByRole("button", { name: /Back|返回/ }));
    openArrangementsTab();

    expect(screen.queryByText("可能已完成")).not.toBeInTheDocument();
    expect(screen.getByTestId("arrangement-group-recent")).toHaveTextContent(
      "明天下午帮用户A去公司拿资料"
    );
    expect(screen.getByTestId("arrangement-complete-arr_documents_followup")).toHaveClass(
      "arrangement-complete-suggested"
    );
    expect(screen.getByTestId("arrangement-group-completed")).not.toHaveTextContent(
      "明天下午帮用户A去公司拿资料"
    );
    vi.useRealTimers();
  });

  it("suggests possible completion when a follow-up says materials were brought back", () => {
    const identity = {
      id: "identity-user-a",
      name: "用户A",
      note: "拿回资料测试",
      avatarLabel: "A",
      color: "#0E9DEC",
      createdAt: 1760000001000,
    };
    const arrangement: Arrangement = {
      id: "arr_documents_brought_back",
      title: "明天下午帮用户A去公司拿资料",
      notes: "从私聊候选确认。",
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
    };
    const initialMessage = {
      id: "msg-documents-brought-back",
      conversationId: getPrivateConversationId(identity.id),
      conversationType: "private" as const,
      identityId: identity.id,
      text: "明天下午帮忙去公司拿资料",
      sentAt: new Date("2026-05-18T08:00:00+08:00").getTime(),
      sender: "identity" as const,
    };

    window.localStorage.setItem(testIdentitiesStorageKey, JSON.stringify([identity]));
    window.localStorage.setItem(testMessagesStorageKey, JSON.stringify([initialMessage]));
    window.localStorage.setItem("arkme-demo.arrangements", JSON.stringify([arrangement]));

    render(<App />);
    openConversationFromDrawer(getPrivateConversationId(identity.id));

    const composer = screen.getByRole("textbox", {
      name: /单击文字，长按语音|Tap for text, hold for voice/,
    });
    fireEvent.click(composer);
    fireEvent.change(composer, { target: { value: "资料已经拿回来了" } });
    fireEvent.click(screen.getByRole("button", { name: /发送|Send/ }));

    const storedArrangements = JSON.parse(
      window.localStorage.getItem("arkme-demo.arrangements") ?? "[]"
    ) as Arrangement[];
    expect(storedArrangements[0]).toMatchObject({
      id: "arr_documents_brought_back",
      status: "maybeCompleted",
      completedAt: null,
    });

    fireEvent.click(screen.getByRole("button", { name: /Back|返回/ }));
    openArrangementsTab();

    expect(screen.queryByText("可能已完成")).not.toBeInTheDocument();
    expect(screen.getByTestId("arrangement-group-recent")).toHaveTextContent(
      "明天下午帮用户A去公司拿资料"
    );
    expect(screen.getByTestId("arrangement-complete-arr_documents_brought_back")).toHaveClass(
      "arrangement-complete-suggested"
    );
    expect(screen.getByTestId("arrangement-group-completed")).not.toHaveTextContent(
      "明天下午帮用户A去公司拿资料"
    );
  });

  it("uses the configured AI API to suggest possible completion when local matching is not enough", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  shouldSuggestCompletion: true,
                  arrangementId: "arr_ambiguous_followup",
                  confidence: "medium",
                  evidence: "模型判断“那件资料的事搞定了”对应拿资料安排。",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const identity = {
      id: "identity-user-a",
      name: "用户A",
      note: "模型完成建议测试",
      avatarLabel: "A",
      color: "#0E9DEC",
      createdAt: 1760000001000,
    };
    const arrangement: Arrangement = {
      id: "arr_ambiguous_followup",
      title: "明天下午帮用户A去公司拿资料",
      notes: "用于模型辅助完成匹配。",
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
    };
    const initialMessage = {
      id: "msg-ambiguous-followup",
      conversationId: getPrivateConversationId(identity.id),
      conversationType: "private" as const,
      identityId: identity.id,
      text: "明天下午帮忙去公司拿资料",
      sentAt: new Date("2026-05-18T08:00:00+08:00").getTime(),
      sender: "identity" as const,
    };

    window.localStorage.setItem(testIdentitiesStorageKey, JSON.stringify([identity]));
    window.localStorage.setItem(testMessagesStorageKey, JSON.stringify([initialMessage]));
    window.localStorage.setItem("arkme-demo.arrangements", JSON.stringify([arrangement]));
    window.localStorage.setItem(
      "arkme-demo.aiSettings",
      JSON.stringify({
        apiBaseUrl: "https://api.example.com/v1",
        modelName: "demo-model",
        apiKey: "sk-demo",
        recognitionEnabled: true,
        updatedAt: "2026-05-18T02:00:00.000Z",
      })
    );

    render(<App />);
    openConversationFromDrawer(getPrivateConversationId(identity.id));

    const composer = screen.getByRole("textbox", {
      name: /单击文字，长按语音|Tap for text, hold for voice/,
    });
    fireEvent.click(composer);
    fireEvent.change(composer, { target: { value: "那件资料的事搞定了" } });
    fireEvent.click(screen.getByRole("button", { name: /发送|Send/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/v1/chat/completions",
        expect.objectContaining({ method: "POST" })
      );
    });
    await waitFor(() => {
      const storedArrangements = JSON.parse(
        window.localStorage.getItem("arkme-demo.arrangements") ?? "[]"
      ) as Arrangement[];
      expect(storedArrangements[0]).toMatchObject({
        id: "arr_ambiguous_followup",
        status: "maybeCompleted",
        completedAt: null,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /Back|返回/ }));
    openArrangementsTab();

    expect(screen.queryByText("可能已完成")).not.toBeInTheDocument();
    expect(screen.getByTestId("arrangement-group-recent")).toHaveTextContent(
      "明天下午帮用户A去公司拿资料"
    );
    expect(screen.getByTestId("arrangement-complete-arr_ambiguous_followup")).toHaveClass(
      "arrangement-complete-suggested"
    );
    expect(screen.getByTestId("arrangement-group-completed")).not.toHaveTextContent(
      "明天下午帮用户A去公司拿资料"
    );
  });

  it("uses the configured AI API to refine an accepted private-chat request candidate", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  shouldCreate: true,
                  title: "AI 明天帮用户A拿资料",
                  notes: "模型从私聊上下文识别，确认后才会创建正式安排。",
                  people: ["用户A"],
                  place: "公司",
                  timeMode: "deadline",
                  deadlineAt: "2026-05-18T07:00:00.000Z",
                  confidence: "high",
                  sourceSummary: "私聊：用户A 请求拿资料",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const identity = {
      id: "identity-user-a",
      name: "用户A",
      note: "AI API 测试",
      avatarLabel: "A",
      color: "#0E9DEC",
      createdAt: 1760000001000,
    };
    const requestMessage = {
      id: "msg-documents",
      conversationId: getPrivateConversationId(identity.id),
      conversationType: "private" as const,
      identityId: identity.id,
      text: "明天下午3点帮我去公司拿资料",
      sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      sender: "identity" as const,
    };

    window.localStorage.setItem(
      "arkme-demo.aiSettings",
      JSON.stringify({
        apiBaseUrl: "https://api.example.com/v1",
        modelName: "demo-model",
        apiKey: "sk-demo",
        recognitionEnabled: true,
        updatedAt: "2026-05-18T00:00:00.000Z",
      })
    );
    window.localStorage.setItem(testIdentitiesStorageKey, JSON.stringify([identity]));
    window.localStorage.setItem(testMessagesStorageKey, JSON.stringify([requestMessage]));

    render(<App />);
    openUnreadPreview("用户A");

    const composer = screen.getByRole("textbox", {
      name: /单击文字，长按语音|Tap for text, hold for voice/,
    });
    fireEvent.click(composer);
    fireEvent.change(composer, { target: { value: "可以，我去拿" } });
    fireEvent.click(screen.getByRole("button", { name: /发送|Send/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/v1/chat/completions",
        expect.objectContaining({ method: "POST" })
      );
    });
    await waitFor(() => {
      expect(loadAiCandidates()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "AI 明天帮用户A拿资料",
            sourceType: "privateChat",
            status: "pending",
          }),
        ])
      );
    });
    expect(screen.queryByText(/已为您添加到候选|识别到.*安排/)).not.toBeInTheDocument();
  });

  it("uses the configured AI API to refine an accepted group-chat request candidate", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  shouldCreate: true,
                  title: "AI 群聊明天帮用户A拿资料",
                  notes: "模型从群聊上下文识别，确认后才会创建正式安排。",
                  people: ["用户A"],
                  place: "公司",
                  timeMode: "deadline",
                  deadlineAt: "2026-05-18T07:00:00.000Z",
                  confidence: "high",
                  sourceSummary: "群聊：候选测试群 / 用户A 请求拿资料",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const identity = {
      id: "identity-user-a",
      name: "用户A",
      note: "群聊 AI API 测试",
      avatarLabel: "A",
      color: "#0E9DEC",
      createdAt: 1760000001000,
    };
    const group = {
      id: "group-candidate-test",
      name: "候选测试群",
      note: "群聊请求测试",
      avatarLabel: "群",
      color: "#8363FF",
      memberIdentityIds: [identity.id],
      createdAt: 1760000002000,
    };
    const requestMessage = {
      id: "group-msg-documents",
      conversationId: group.id,
      conversationType: "group" as const,
      identityId: identity.id,
      text: "@李小溪 明天下午3点帮我去公司拿资料",
      sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      sender: "identity" as const,
    };

    window.localStorage.setItem(
      "arkme-demo.aiSettings",
      JSON.stringify({
        apiBaseUrl: "https://api.example.com/v1",
        modelName: "demo-model",
        apiKey: "sk-demo",
        recognitionEnabled: true,
        updatedAt: "2026-05-18T00:00:00.000Z",
      })
    );
    window.localStorage.setItem(testIdentitiesStorageKey, JSON.stringify([identity]));
    window.localStorage.setItem(testGroupsStorageKey, JSON.stringify([group]));
    window.localStorage.setItem(testMessagesStorageKey, JSON.stringify([requestMessage]));

    render(<App />);
    openUnreadPreview("候选测试群");

    const composer = screen.getByRole("textbox", {
      name: /单击文字，长按语音|Tap for text, hold for voice/,
    });
    fireEvent.click(composer);
    fireEvent.change(composer, { target: { value: "可以，我去拿" } });
    fireEvent.click(screen.getByRole("button", { name: /发送|Send/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/v1/chat/completions",
        expect.objectContaining({ method: "POST" })
      );
    });
    await waitFor(() => {
      expect(loadAiCandidates()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "AI 群聊明天帮用户A拿资料",
            sourceType: "groupChat",
            status: "pending",
          }),
        ])
      );
    });
    expect(screen.queryByText(/已为您添加到候选|识别到.*安排/)).not.toBeInTheDocument();
    expect(
      screen.getByTestId("chat-ai-recognition-feedback-bed-test-group-msg-documents")
    ).toBeInTheDocument();
  });

  it("keeps the subtle recognition feedback visible after returning to the chat", () => {
    const identity = {
      id: "identity-user-a",
      name: "用户A",
      note: "早餐测试",
      avatarLabel: "A",
      color: "#0E9DEC",
      createdAt: 1760000001000,
    };
    const requestMessage = {
      id: "msg-breakfast",
      conversationId: getPrivateConversationId(identity.id),
      conversationType: "private" as const,
      identityId: identity.id,
      text: "明天帮我带早餐",
      sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      sender: "identity" as const,
    };

    window.localStorage.setItem(testIdentitiesStorageKey, JSON.stringify([identity]));
    window.localStorage.setItem(testMessagesStorageKey, JSON.stringify([requestMessage]));

    const { unmount } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /用户A/ }));
    const composer = screen.getByRole("textbox", {
      name: /单击文字，长按语音|Tap for text, hold for voice/,
    });
    fireEvent.click(composer);
    fireEvent.change(composer, { target: { value: "好的" } });
    fireEvent.click(screen.getByRole("button", { name: /发送|Send/ }));
    unmount();

    cleanup();

    render(<App />);
    openConversationFromDrawer(getPrivateConversationId(identity.id));

    expect(
      screen.getByTestId("chat-ai-recognition-background-ripple-test-msg-breakfast")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("chat-ai-recognition-feedback-bed-test-msg-breakfast")
    ).toBeInTheDocument();
    expect(screen.getByTestId("chat-message-bubble-test-msg-breakfast")).not.toHaveClass(
      "ai-recognition-bubble"
    );
    expect(screen.getByTestId("chat-message-bubble-test-msg-breakfast")).toHaveAttribute(
      "data-ai-recognition",
      "true"
    );
  });

  it("shows a quiet pending candidate badge on the arrangements tab after private chat recognition", () => {
    const identity = {
      id: "identity-user-a",
      name: "用户A",
      note: "早餐测试",
      avatarLabel: "A",
      color: "#0E9DEC",
      createdAt: 1760000001000,
    };
    const requestMessage = {
      id: "msg-breakfast",
      conversationId: getPrivateConversationId(identity.id),
      conversationType: "private" as const,
      identityId: identity.id,
      text: "明天帮我带早餐",
      sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      sender: "identity" as const,
    };

    window.localStorage.setItem(testIdentitiesStorageKey, JSON.stringify([identity]));
    window.localStorage.setItem(testMessagesStorageKey, JSON.stringify([requestMessage]));

    render(<App />);
    openUnreadPreview("用户A");

    const composer = screen.getByRole("textbox", {
      name: /单击文字，长按语音|Tap for text, hold for voice/,
    });
    fireEvent.click(composer);
    fireEvent.change(composer, { target: { value: "好的" } });
    fireEvent.click(screen.getByRole("button", { name: /发送|Send/ }));
    fireEvent.click(screen.getByRole("button", { name: /Back|返回/ }));

    window.localStorage.removeItem("arkme-demo.arrangements");

    expect(screen.getByTestId("arrangements-tab-pending-candidate-badge")).toHaveTextContent(
      "1"
    );
  });

  it("shows recognition feedback when a private-chat AI candidate already exists", () => {
    const identity = {
      id: "identity-user-a",
      name: "用户A",
      note: "早餐测试",
      avatarLabel: "A",
      color: "#0E9DEC",
      createdAt: 1760000001000,
    };
    const requestMessage = {
      id: "msg-breakfast",
      conversationId: getPrivateConversationId(identity.id),
      conversationType: "private" as const,
      identityId: identity.id,
      text: "明天帮我带早餐",
      sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      sender: "identity" as const,
    };
    const candidate: AiArrangementCandidate = {
      id: "cand_private_private-identity-user-a_msg-breakfast",
      title: "明天帮用户A带早餐",
      notes: "从私聊上下文识别，确认后才会创建正式安排。",
      people: ["用户A"],
      place: "",
      timeMode: "deadline",
      deadlineAt: "2026-05-18T01:00:00.000Z",
      startAt: null,
      endAt: null,
      reminderAt: null,
      sourceType: "privateChat",
      sourceSummary: "私聊：用户A 请求带早餐",
      rawContext: ["用户A：明天帮我带早餐", "我：好的"],
      confidence: "high",
      status: "pending",
      createdAt: "2026-05-17T08:05:00.000Z",
      updatedAt: "2026-05-17T08:05:00.000Z",
    };

    window.localStorage.setItem(testIdentitiesStorageKey, JSON.stringify([identity]));
    window.localStorage.setItem(testMessagesStorageKey, JSON.stringify([requestMessage]));
    saveAiCandidates([candidate]);

    render(<App />);
    openUnreadPreview("用户A");

    expect(screen.getByTestId("chat-message-bubble-test-msg-breakfast")).toHaveAttribute(
      "data-ai-recognition",
      "true"
    );
    expect(
      screen.getByTestId("chat-ai-recognition-background-ripple-test-msg-breakfast")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("chat-ai-recognition-feedback-bed-test-msg-breakfast")
    ).toBeInTheDocument();
  });

  it("backfills a private-chat AI candidate from an existing accepted request", () => {
    const identity = {
      id: "identity-interviewer",
      name: "面试官",
      note: "用于模拟私聊追问和反馈",
      avatarLabel: "面",
      color: "#09B83E",
      createdAt: 1760000000000,
    };
    const conversationId = getPrivateConversationId(identity.id);
    const requestMessage = {
      id: "msg-existing-breakfast",
      conversationId,
      conversationType: "private" as const,
      identityId: identity.id,
      text: "明天帮我带早餐",
      sentAt: new Date("2026-05-17T08:00:00+08:00").getTime(),
      sender: "identity" as const,
    };
    const replyMessage = {
      id: "reply-existing-ok",
      conversationId,
      conversationType: "private" as const,
      identityId: "demo",
      text: "好的",
      sentAt: new Date("2026-05-17T08:05:00+08:00").getTime(),
      sender: "demo" as const,
    };

    window.localStorage.setItem(testIdentitiesStorageKey, JSON.stringify([identity]));
    window.localStorage.setItem(
      testMessagesStorageKey,
      JSON.stringify([requestMessage, replyMessage])
    );

    render(<App />);

    expect(loadAiCandidates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "明天帮面试官带早餐",
          sourceType: "privateChat",
          status: "pending",
        }),
      ])
    );

    openUnreadPreview("面试官");
    expect(
      screen.getByTestId("chat-ai-recognition-background-ripple-test-msg-existing-breakfast")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("chat-ai-recognition-feedback-bed-test-msg-existing-breakfast")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Back|返回/ }));

    openArrangementsTab();
    expect(screen.getByTestId("ai-candidate-preview")).toHaveTextContent(
      "明天帮面试官带早餐"
    );
  });
});
