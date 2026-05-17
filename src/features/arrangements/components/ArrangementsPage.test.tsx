import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArrangementsPage from "./ArrangementsPage";
import { ArrangementDetail } from "./ArrangementDetail";
import { upsertAiCandidate } from "../data/aiCandidateStore";
import type { Arrangement } from "../types";
import type { AiArrangementCandidate } from "../types";

const detailArrangement: Arrangement = {
  id: "arr_detail",
  title: "明天帮同事带早餐",
  notes: "豆浆和包子，路上顺手带就好。",
  people: ["同事"],
  place: "公司",
  timeMode: "deadline",
  deadlineAt: "2026-05-22T01:00:00.000Z",
  startAt: null,
  endAt: null,
  reminderAt: "2026-05-21T23:30:00.000Z",
  status: "active",
  createdAt: "2026-05-16T09:00:00.000Z",
  updatedAt: "2026-05-16T09:00:00.000Z",
  completedAt: null,
  snoozedAt: null,
  previousTime: null,
};

const privateChatCandidate: AiArrangementCandidate = {
  id: "cand_private_private-identity-interviewer_msg-breakfast",
  title: "明天帮面试官带早餐",
  notes: "从私聊上下文识别，确认后才会创建正式安排。",
  people: ["面试官"],
  place: "",
  timeMode: "deadline",
  deadlineAt: "2026-05-18T01:00:00.000Z",
  startAt: null,
  endAt: null,
  reminderAt: null,
  sourceType: "privateChat",
  sourceSummary: "私聊：面试官 请求带早餐",
  rawContext: ["面试官：明天帮我带早餐", "我：好的"],
  confidence: "high",
  status: "pending",
  createdAt: "2026-05-17T08:05:00.000Z",
  updatedAt: "2026-05-17T08:05:00.000Z",
};

function makeArrangement(overrides: Partial<Arrangement> & Pick<Arrangement, "id" | "title">) {
  return {
    ...detailArrangement,
    notes: "",
    people: [],
    place: "",
    timeMode: "none",
    deadlineAt: null,
    startAt: null,
    endAt: null,
    reminderAt: null,
    status: "active",
    completedAt: null,
    snoozedAt: null,
    previousTime: null,
    ...overrides,
  } satisfies Arrangement;
}

describe("ArrangementsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps create and detail sheets hidden until requested", () => {
    render(<ArrangementsPage />);

    expect(screen.queryByTestId("arrangement-create-sheet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("arrangement-detail-sheet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("arrangement-edit-sheet")).not.toBeInTheDocument();
  });

  it("renders the fixed group order", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T12:00:00+08:00"));

    render(<ArrangementsPage />);

    const groups = [
      "arrangement-group-today",
      "arrangement-group-recent",
      "arrangement-group-noTime",
      "arrangement-group-someday",
      "arrangement-group-completed",
    ].map((testId) => screen.getByTestId(testId));

    expect(groups).toHaveLength(5);
    expect(groups[0]).toContainElement(screen.getByTestId("arrangement-view-arr_hospital"));
    expect(groups[1]).toContainElement(screen.getByTestId("arrangement-view-arr_breakfast"));
    expect(groups[2]).toContainElement(screen.getByTestId("arrangement-view-arr_call_mom"));
    expect(groups[3]).toContainElement(screen.getByTestId("arrangement-view-arr_old_photos"));

    vi.useRealTimers();
  });

  it("does not render a top quick-navigation strip", () => {
    render(<ArrangementsPage />);

    expect(screen.queryByRole("region", { name: "安排快速定位" })).not.toBeInTheDocument();
  });

  it("still allows tapping the title area to return to overview", () => {
    const scrollTo = vi.fn();

    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });

    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangements-overview-trigger"));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("defaults the calendar list to today and switches it when a day is selected", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T12:00:00+08:00"));

    render(<ArrangementsPage />);

    const calendar = screen.getByRole("region", { name: "日历总览" });
    expect(within(calendar).getByText("今天上午去医院体检")).toBeInTheDocument();
    expect(within(calendar).queryByText("明天帮同事带早餐")).not.toBeInTheDocument();
    expect(within(calendar).queryByText("给妈妈回电话")).not.toBeInTheDocument();
    expect(within(calendar).queryByText("整理旧照片")).not.toBeInTheDocument();

    fireEvent.click(within(calendar).getByRole("button", { name: "5月17日" }));

    expect(within(calendar).getByText("明天帮同事带早餐")).toBeInTheDocument();
    expect(within(calendar).queryByText("今天上午去医院体检")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("does not duplicate calendar list items when switching between dates repeatedly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T12:00:00+08:00"));

    render(<ArrangementsPage />);

    const calendar = screen.getByRole("region", { name: "日历总览" });
    fireEvent.click(within(calendar).getByRole("button", { name: "5月17日" }));
    fireEvent.click(within(calendar).getByRole("button", { name: "5月16日" }));
    fireEvent.click(within(calendar).getByRole("button", { name: "5月17日" }));
    fireEvent.click(within(calendar).getByRole("button", { name: "5月16日" }));
    fireEvent.click(within(calendar).getByRole("button", { name: "5月17日" }));

    expect(within(calendar).getAllByText("明天帮同事带早餐")).toHaveLength(1);
    expect(within(calendar).queryByText("今天上午去医院体检")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("deduplicates stored arrangements by id before rendering swipe rows and calendar items", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-19T12:00:00+08:00"));
    window.localStorage.setItem(
      "arkme-demo.arrangements",
      JSON.stringify([
        makeArrangement({
          id: "arr_duplicate",
          title: "Duplicate hospital",
          timeMode: "deadline",
          deadlineAt: "2026-05-19T08:52:00.000Z",
          status: "completed",
          completedAt: "2026-05-19T09:00:00.000Z",
        }),
        makeArrangement({
          id: "arr_duplicate",
          title: "Duplicate hospital",
          timeMode: "deadline",
          deadlineAt: "2026-05-19T08:52:00.000Z",
          status: "completed",
          completedAt: "2026-05-19T09:00:00.000Z",
        }),
        makeArrangement({
          id: "arr_unique",
          title: "Unique hospital",
          timeMode: "deadline",
          deadlineAt: "2026-05-19T10:00:00.000Z",
          status: "completed",
          completedAt: "2026-05-19T10:10:00.000Z",
        }),
      ])
    );

    render(<ArrangementsPage />);

    const calendar = screen.getByRole("region", { name: "日历总览" });
    expect(within(calendar).getAllByText("Duplicate hospital")).toHaveLength(1);
    expect(screen.getAllByTestId("arrangement-view-arr_duplicate")).toHaveLength(1);

    leftSwipe(screen.getByTestId("arrangement-view-arr_duplicate"));
    expect(screen.getByTestId("arrangement-delete-arr_duplicate")).toBeInTheDocument();
    expect(screen.getByTestId("arrangement-row-arr_unique")).toHaveStyle({
      transform: "translateX(0px)",
    });
    fireEvent.click(screen.getByTestId("arrangement-delete-arr_duplicate"));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    expect(screen.queryByTestId("arrangement-view-arr_duplicate")).not.toBeInTheDocument();
    expect(screen.getByTestId("arrangement-view-arr_unique")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("opens the create sheet from the create trigger and pre-fills time inputs with now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T10:15:00+08:00"));

    render(<ArrangementsPage />);
    fireEvent.click(screen.getByTestId("arrangements-create-trigger"));

    const form = screen.getByRole("form", { name: "创建安排" });
    expect(screen.getByTestId("arrangement-create-sheet")).toBeInTheDocument();
    expect(within(form).getByLabelText("截止时间")).toHaveValue("2026-05-17T10:15");

    vi.useRealTimers();
  });

  it("keeps manual creation available while AI settings are not configured", () => {
    render(<ArrangementsPage />);

    expect(screen.getByTestId("arrangements-ai-status")).toHaveTextContent("AI 未配置");

    fireEvent.click(screen.getByTestId("arrangements-create-trigger"));
    expect(screen.getByTestId("arrangement-create-sheet")).toBeInTheDocument();
  });

  it("opens AI settings, saves the API configuration, and persists its configured state", () => {
    const { unmount } = render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangements-ai-settings-trigger"));
    const sheet = screen.getByTestId("arrangement-ai-settings-sheet");
    expect(sheet).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("arrangement-ai-api-base"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.change(screen.getByTestId("arrangement-ai-model"), {
      target: { value: "demo-model" },
    });
    fireEvent.change(screen.getByTestId("arrangement-ai-key"), {
      target: { value: "sk-demo" },
    });
    fireEvent.click(screen.getByTestId("arrangement-ai-enable"));
    fireEvent.click(screen.getByTestId("arrangement-ai-save"));

    expect(screen.getByTestId("arrangements-ai-status")).toHaveTextContent("AI 已配置");
    expect(JSON.parse(window.localStorage.getItem("arkme-demo.aiSettings") ?? "{}")).toMatchObject({
      apiBaseUrl: "https://api.example.com/v1",
      modelName: "demo-model",
      apiKey: "sk-demo",
      recognitionEnabled: true,
    });

    unmount();
    render(<ArrangementsPage />);
    expect(screen.getByTestId("arrangements-ai-status")).toHaveTextContent("AI 已配置");
  });

  it("runs a real AI connection test without blocking manual creation", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ shouldCreate: false }) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangements-ai-settings-trigger"));
    fireEvent.click(screen.getByTestId("arrangement-ai-test"));
    await waitFor(() => {
      expect(screen.getByTestId("arrangement-ai-test-message")).toHaveTextContent(
        "请先补全 API 地址、模型名和 Key"
      );
    });

    fireEvent.change(screen.getByTestId("arrangement-ai-api-base"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.change(screen.getByTestId("arrangement-ai-model"), {
      target: { value: "demo-model" },
    });
    fireEvent.change(screen.getByTestId("arrangement-ai-key"), {
      target: { value: "sk-demo" },
    });
    fireEvent.click(screen.getByTestId("arrangement-ai-enable"));
    fireEvent.click(screen.getByTestId("arrangement-ai-test"));
    expect(screen.getByTestId("arrangement-ai-test")).toHaveTextContent("测试中");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/v1/chat/completions",
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(screen.getByTestId("arrangement-ai-test-message")).toHaveTextContent(
      "连接可用，AI 识别会先生成候选安排"
    );

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("arrangement-ai-settings-sheet")).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("arrangements-create-trigger"));
    expect(screen.getByTestId("arrangement-create-sheet")).toBeInTheDocument();
  });

  it("shows low-pressure feedback when the real AI connection test fails", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangements-ai-settings-trigger"));
    fireEvent.change(screen.getByTestId("arrangement-ai-api-base"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.change(screen.getByTestId("arrangement-ai-model"), {
      target: { value: "demo-model" },
    });
    fireEvent.change(screen.getByTestId("arrangement-ai-key"), {
      target: { value: "sk-demo" },
    });
    fireEvent.click(screen.getByTestId("arrangement-ai-enable"));
    fireEvent.click(screen.getByTestId("arrangement-ai-test"));

    await waitFor(() => {
      expect(screen.getByTestId("arrangement-ai-test-message")).toHaveTextContent(
        "连接失败，手动创建和本地识别仍可继续使用"
      );
    });
  });

  it("previews an AI candidate and saves it only after confirmation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T10:15:00+08:00"));

    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangements-ai-demo-candidate"));
    const candidate = screen.getByTestId("ai-candidate-card-cand_self_hospital");

    expect(candidate).toHaveTextContent("后天去一趟医院");
    expect(candidate).toHaveTextContent("发给自己");
    expect(screen.queryByTestId("arrangement-view-arr_ai_cand_self_hospital")).not.toBeInTheDocument();

    fireEvent.click(within(candidate).getByTestId("ai-candidate-confirm-cand_self_hospital"));

    expect(screen.queryByTestId("ai-candidate-card-cand_self_hospital")).not.toBeInTheDocument();
    expect(screen.getByTestId("arrangement-view-arr_ai_cand_self_hospital")).toHaveTextContent(
      "后天去一趟医院"
    );
    expect(JSON.parse(window.localStorage.getItem("arkme-demo.arrangements") ?? "[]")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "arr_ai_cand_self_hospital",
          title: "后天去一趟医院",
          notes: expect.stringContaining("用户发给自己"),
        }),
      ])
    );

    vi.useRealTimers();
  });

  it("uses confirm arrangement instead of complete for a newly confirmed AI candidate detail", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T10:15:00+08:00"));

    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangements-ai-demo-candidate"));
    fireEvent.click(screen.getByTestId("ai-candidate-confirm-cand_self_hospital"));

    const detailSheet = screen.getByTestId("arrangement-detail-sheet");
    expect(detailSheet).toHaveTextContent("确认安排");
    expect(detailSheet).not.toHaveTextContent("完成安排");

    fireEvent.click(screen.getByTestId("arrangement-detail-confirm"));
    act(() => {
      vi.advanceTimersByTime(240);
    });

    expect(screen.queryByTestId("arrangement-detail-sheet")).not.toBeInTheDocument();
    expect(screen.getByTestId("arrangement-view-arr_ai_cand_self_hospital")).toBeInTheDocument();
    expect(screen.getByTestId("arrangement-group-completed")).not.toHaveTextContent(
      "后天去一趟医院"
    );

    vi.useRealTimers();
  });

  it("refreshes the AI candidate preview when a chat recognition candidate is stored", () => {
    render(<ArrangementsPage />);

    expect(screen.queryByTestId("ai-candidate-preview")).not.toBeInTheDocument();

    act(() => {
      upsertAiCandidate(privateChatCandidate);
    });

    expect(screen.getByTestId("ai-candidate-preview")).toHaveTextContent(
      "明天帮面试官带早餐"
    );
  });

  it("shows extracted time on AI candidate cards before confirmation", () => {
    render(<ArrangementsPage />);

    act(() => {
      upsertAiCandidate(privateChatCandidate);
    });

    const candidate = screen.getByTestId(
      "ai-candidate-card-cand_private_private-identity-interviewer_msg-breakfast"
    );
    expect(within(candidate).getByTestId("ai-candidate-time")).toHaveTextContent("截止");
    expect(within(candidate).getByTestId("ai-candidate-time")).toHaveTextContent("5/18");
  });

  it("shows merged candidate sources, raw contexts, time conflicts, and source confidence", () => {
    const dadCandidate: AiArrangementCandidate = {
      ...privateChatCandidate,
      id: "cand_private_dad_hospital",
      title: "明天去医院复诊",
      people: ["爸爸"],
      sourceSummary: "私聊：爸爸 提醒去医院",
      rawContext: ["爸爸：明天别忘了去医院复诊", "我：好的"],
      deadlineAt: "2026-05-18T02:00:00.000Z",
      confidence: "high",
      createdAt: "2026-05-17T08:00:00.000Z",
      updatedAt: "2026-05-17T08:00:00.000Z",
    };
    const sisterCandidate: AiArrangementCandidate = {
      ...privateChatCandidate,
      id: "cand_private_sister_hospital",
      title: "后天去医院复诊",
      people: ["姐姐"],
      sourceSummary: "私聊：姐姐 提醒去医院",
      rawContext: ["姐姐：后天记得去医院复诊", "我：收到"],
      deadlineAt: "2026-05-19T02:00:00.000Z",
      confidence: "medium",
      createdAt: "2026-05-17T08:10:00.000Z",
      updatedAt: "2026-05-17T08:10:00.000Z",
    };

    render(<ArrangementsPage />);
    act(() => {
      upsertAiCandidate(dadCandidate);
      upsertAiCandidate(sisterCandidate);
    });

    const preview = screen.getByTestId("ai-candidate-preview");
    const card = screen.getByTestId("ai-candidate-card-cand_private_sister_hospital");
    expect(within(preview).getByText("1")).toBeInTheDocument();
    expect(card).toHaveTextContent("2 个来源");
    expect(card).toHaveTextContent("时间有出入");
    expect(card).toHaveTextContent("私聊：爸爸 提醒去医院");
    expect(card).toHaveTextContent("私聊：姐姐 提醒去医院");
    expect(card).toHaveTextContent("爸爸：明天别忘了去医院复诊");
    expect(card).toHaveTextContent("姐姐：后天记得去医院复诊");
    expect(card).toHaveTextContent("爸爸 · 信息较完整");
    expect(card).toHaveTextContent("姐姐 · 需要看一眼");
  });

  it("keeps merged raw conversation context after confirming a candidate", () => {
    const dadCandidate: AiArrangementCandidate = {
      ...privateChatCandidate,
      id: "cand_private_dad_hospital",
      title: "明天去医院复诊",
      people: ["爸爸"],
      sourceSummary: "私聊：爸爸 提醒去医院",
      rawContext: ["爸爸：明天别忘了去医院复诊", "我：好的"],
      deadlineAt: "2026-05-18T02:00:00.000Z",
      confidence: "high",
    };
    const sisterCandidate: AiArrangementCandidate = {
      ...privateChatCandidate,
      id: "cand_private_sister_hospital",
      title: "后天去医院复诊",
      people: ["姐姐"],
      sourceSummary: "私聊：姐姐 提醒去医院",
      rawContext: ["姐姐：后天记得去医院复诊", "我：收到"],
      deadlineAt: "2026-05-19T02:00:00.000Z",
      confidence: "medium",
    };

    render(<ArrangementsPage />);
    act(() => {
      upsertAiCandidate(dadCandidate);
      upsertAiCandidate(sisterCandidate);
    });
    fireEvent.click(screen.getByTestId("ai-candidate-confirm-cand_private_sister_hospital"));

    const stored = JSON.parse(window.localStorage.getItem("arkme-demo.arrangements") ?? "[]");
    expect(stored).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "arr_ai_cand_private_sister_hospital",
          title: "后天去医院复诊",
          notes: expect.stringContaining("私聊：爸爸 提醒去医院"),
        }),
      ])
    );
    expect(stored[0].notes).toContain("私聊：姐姐 提醒去医院");
    expect(stored[0].notes).toContain("原文：爸爸：明天别忘了去医院复诊");
    expect(stored[0].notes).toContain("原文：姐姐：后天记得去医院复诊");
    expect(stored[0].notes).toContain("注意：多个来源提到的时间不一致，请确认。");
  });

  it("marks AI candidates without extracted time as needing time completion", async () => {
    render(<ArrangementsPage />);

    fireEvent.change(screen.getByTestId("arrangements-self-message-input"), {
      target: { value: "去医院" },
    });
    fireEvent.click(screen.getByTestId("arrangements-self-message-recognize"));

    const candidate = await screen.findByTestId("ai-candidate-card-cand_self_qu-yi-yuan");
    expect(within(candidate).getByTestId("ai-candidate-time")).toHaveTextContent("待补时间");
  });

  it("labels the edit action as time completion when an AI candidate has no extracted time", async () => {
    render(<ArrangementsPage />);

    fireEvent.change(screen.getByTestId("arrangements-self-message-input"), {
      target: { value: "去医院" },
    });
    fireEvent.click(screen.getByTestId("arrangements-self-message-recognize"));

    const candidate = await screen.findByTestId("ai-candidate-card-cand_self_qu-yi-yuan");
    const editButton = within(candidate).getByTestId("ai-candidate-edit-cand_self_qu-yi-yuan");
    expect(editButton).toHaveTextContent("补时间");

    fireEvent.click(editButton);
    expect(screen.getByTestId("arrangement-ai-candidate-edit-sheet")).toBeInTheDocument();
  });

  it("recognizes a self message into an AI candidate without creating an arrangement directly", async () => {
    render(<ArrangementsPage />);

    fireEvent.change(screen.getByTestId("arrangements-self-message-input"), {
      target: { value: "后天去一趟医院" },
    });
    fireEvent.click(screen.getByTestId("arrangements-self-message-recognize"));

    const candidate = await screen.findByTestId(
      "ai-candidate-card-cand_self_hou-tian-qu-yi-tang-yi-yuan"
    );
    expect(candidate).toHaveTextContent("后天去一趟医院");
    expect(candidate).toHaveTextContent("发给自己");
    expect(screen.queryByTestId("arrangement-view-arr_ai_cand_self_hou-tian-qu-yi-tang-yi-yuan"))
      .not.toBeInTheDocument();

    fireEvent.click(
      within(candidate).getByTestId("ai-candidate-confirm-cand_self_hou-tian-qu-yi-tang-yi-yuan")
    );

    expect(screen.getByTestId("arrangement-view-arr_ai_cand_self_hou-tian-qu-yi-tang-yi-yuan"))
      .toHaveTextContent("后天去一趟医院");

  });

  it("uses the configured AI API for self-message recognition before falling back to local rules", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  shouldCreate: true,
                  title: "后天下午去医院复诊",
                  notes: "模型从发给自己的消息识别。",
                  people: ["自己"],
                  place: "医院",
                  timeMode: "deadline",
                  deadlineAt: "2026-05-19T07:00:00.000Z",
                  confidence: "high",
                  sourceSummary: "发给自己：后天下午去医院复诊",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

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

    render(<ArrangementsPage />);

    fireEvent.change(screen.getByTestId("arrangements-self-message-input"), {
      target: { value: "后天下午去医院复诊" },
    });
    fireEvent.click(screen.getByTestId("arrangements-self-message-recognize"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/v1/chat/completions",
        expect.objectContaining({ method: "POST" })
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("ai-candidate-preview")).toHaveTextContent(
        "后天下午去医院复诊"
      );
    });
    expect(screen.queryByTestId("arrangement-view-arr_ai_cand_ai_self_hou-tian-xia-wu-qu-yi-yuan-fu-zhen"))
      .not.toBeInTheDocument();
  });

  it("keeps manual creation available when a self message is too symbolic to recognize", async () => {
    render(<ArrangementsPage />);

    fireEvent.change(screen.getByTestId("arrangements-self-message-input"), {
      target: { value: "～～" },
    });
    fireEvent.click(screen.getByTestId("arrangements-self-message-recognize"));

    await waitFor(() => {
      expect(screen.getByTestId("arrangements-self-message-feedback")).toHaveTextContent(
        "没有生成候选，可以手动新建"
      );
    });
    expect(screen.queryByTestId("ai-candidate-preview")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("arrangements-create-trigger"));
    expect(screen.getByTestId("arrangement-create-sheet")).toBeInTheDocument();
  });

  it("opens an editable sheet for an AI candidate before saving it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T10:15:00+08:00"));

    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangements-ai-demo-candidate"));
    fireEvent.click(screen.getByTestId("ai-candidate-edit-cand_self_hospital"));

    const form = screen.getByRole("form", { name: "编辑候选安排" });
    expect(screen.getByTestId("arrangement-ai-candidate-edit-sheet")).toBeInTheDocument();
    expect(within(form).getByLabelText("标题")).toHaveValue("后天去一趟医院");

    fireEvent.change(within(form).getByLabelText("标题"), {
      target: { value: "后天下午去医院复诊" },
    });
    fireEvent.click(within(form).getByTestId("arrangement-editor-submit-candidate"));

    expect(screen.queryByTestId("ai-candidate-card-cand_self_hospital")).not.toBeInTheDocument();
    expect(screen.getByTestId("arrangement-view-arr_ai_cand_self_hospital")).toHaveTextContent(
      "后天下午去医院复诊"
    );

    vi.useRealTimers();
  });

  it("ignores an AI candidate without creating an arrangement", () => {
    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangements-ai-demo-candidate"));
    fireEvent.click(screen.getByTestId("ai-candidate-dismiss-cand_self_hospital"));

    expect(screen.queryByTestId("ai-candidate-card-cand_self_hospital")).not.toBeInTheDocument();
    expect(screen.queryByText("后天去一趟医院")).not.toBeInTheDocument();
  });

  it("shows only the time fields that match the selected time type", () => {
    render(<ArrangementsPage />);
    fireEvent.click(screen.getByTestId("arrangements-create-trigger"));

    const form = screen.getByRole("form", { name: "创建安排" });
    expect(within(form).getByTestId("arrangement-time-fields-deadline")).toBeInTheDocument();
    expect(within(form).queryByTestId("arrangement-time-fields-range")).not.toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText("时间类型"), { target: { value: "range" } });
    expect(within(form).queryByTestId("arrangement-time-fields-deadline")).not.toBeInTheDocument();
    expect(within(form).getByTestId("arrangement-time-fields-range")).toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText("时间类型"), { target: { value: "none" } });
    expect(within(form).queryByTestId("arrangement-time-fields-deadline")).not.toBeInTheDocument();
    expect(within(form).queryByTestId("arrangement-time-fields-range")).not.toBeInTheDocument();
    expect(within(form).getByTestId("arrangement-time-none-note")).toBeInTheDocument();
  });

  it("creates a manual arrangement, closes the create sheet, and persists it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T10:15:00+08:00"));

    const { unmount } = render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangements-create-trigger"));
    const form = screen.getByRole("form", { name: "创建安排" });
    fireEvent.change(within(form).getByLabelText("标题"), {
      target: { value: "周一预约牙医" },
    });
    fireEvent.change(within(form).getByLabelText("相关人"), {
      target: { value: "牙医、自己" },
    });
    fireEvent.change(within(form).getByLabelText("地点"), {
      target: { value: "口腔诊所" },
    });
    fireEvent.change(within(form).getByLabelText("截止时间"), {
      target: { value: "2026-05-18T10:00" },
    });
    fireEvent.change(within(form).getByLabelText("提醒时间"), {
      target: { value: "2026-05-18T09:30" },
    });
    fireEvent.change(within(form).getByLabelText("备注"), {
      target: { value: "先确认是否需要带医保卡。" },
    });
    fireEvent.click(screen.getByTestId("arrangement-editor-submit-create"));

    expect(screen.getByTestId("arrangement-create-sheet")).toHaveAttribute(
      "data-motion-state",
      "closing"
    );
    act(() => {
      vi.advanceTimersByTime(240);
    });
    expect(screen.queryByTestId("arrangement-create-sheet")).not.toBeInTheDocument();
    const recent = screen.getByTestId("arrangement-group-recent");
    expect(within(recent).getByText("周一预约牙医")).toBeInTheDocument();

    unmount();
    render(<ArrangementsPage />);
    expect(within(screen.getByTestId("arrangement-group-recent")).getByText("周一预约牙医"))
      .toBeInTheDocument();

    vi.useRealTimers();
  });

  it("opens detail in a bottom sheet when selecting an arrangement item", () => {
    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangement-view-arr_breakfast"));
    expect(screen.getByTestId("arrangement-detail-sheet")).toBeInTheDocument();
  });

  it("keeps possible completion lightweight with a pulsing complete button", () => {
    window.localStorage.setItem(
      "arkme-demo.arrangements",
      JSON.stringify([
        {
          ...detailArrangement,
          id: "arr_possible",
          status: "maybeCompleted",
          updatedAt: "2026-05-18T02:30:00.000Z",
          completedAt: null,
        },
      ])
    );

    render(<ArrangementsPage />);

    const recent = screen.getByTestId("arrangement-group-recent");
    const completed = screen.getByTestId("arrangement-group-completed");
    expect(within(recent).getByText("明天帮同事带早餐")).toBeInTheDocument();
    expect(screen.queryByText("可能已完成")).not.toBeInTheDocument();
    expect(screen.getByTestId("arrangement-complete-arr_possible")).toHaveClass(
      "arrangement-complete-suggested"
    );
    expect(screen.getByTestId("arrangement-complete-arr_possible")).toHaveAccessibleName(
      "建议确认完成 明天帮同事带早餐"
    );
    expect(within(completed).queryByText("明天帮同事带早餐")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("arrangement-view-arr_possible"));
    expect(screen.getByTestId("arrangement-detail-sheet")).not.toHaveTextContent("可能已完成");
    expect(screen.getByTestId("arrangement-detail-complete")).toHaveTextContent("确认完成");

    fireEvent.click(screen.getByTestId("arrangement-detail-complete"));

    expect(within(completed).getByText("明天帮同事带早餐")).toBeInTheDocument();
  });

  it("lets the user dismiss a possible completion suggestion from detail", () => {
    window.localStorage.setItem(
      "arkme-demo.arrangements",
      JSON.stringify([
        {
          ...detailArrangement,
          id: "arr_possible",
          status: "maybeCompleted",
          completedAt: null,
        },
      ])
    );

    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangement-view-arr_possible"));
    fireEvent.click(screen.getByTestId("arrangement-detail-dismiss-completion"));

    expect(screen.getByTestId("arrangement-group-recent")).toHaveTextContent(
      "明天帮同事带早餐"
    );
    expect(screen.queryByText("可能已完成")).not.toBeInTheDocument();
    expect(screen.getByTestId("arrangement-complete-arr_possible")).not.toHaveClass(
      "arrangement-complete-suggested"
    );
  });

  it("keeps no-time possible completion suggestions in the no-time group", () => {
    window.localStorage.setItem(
      "arkme-demo.arrangements",
      JSON.stringify([
        {
          ...detailArrangement,
          id: "arr_possible_no_time",
          timeMode: "none",
          deadlineAt: null,
          startAt: null,
          endAt: null,
          status: "maybeCompleted",
          completedAt: null,
        },
      ])
    );

    render(<ArrangementsPage />);

    expect(screen.getByTestId("arrangement-group-noTime")).toHaveTextContent(
      "明天帮同事带早餐"
    );
    expect(screen.queryByText("可能已完成")).not.toBeInTheDocument();
    expect(screen.getByTestId("arrangement-complete-arr_possible_no_time")).toHaveClass(
      "arrangement-complete-suggested"
    );
    expect(screen.getByTestId("arrangement-group-recent")).not.toHaveTextContent(
      "明天帮同事带早餐"
    );
  });

  it("opens edit from detail and persists the same item after update", () => {
    window.localStorage.setItem("arkme-demo.arrangements", JSON.stringify([detailArrangement]));

    const { unmount } = render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangement-view-arr_detail"));
    fireEvent.click(screen.getByTestId("arrangement-detail-edit"));

    const form = screen.getByRole("form", { name: "编辑安排" });
    expect(screen.getByTestId("arrangement-edit-sheet")).toBeInTheDocument();
    expect(within(form).getByLabelText("标题")).toHaveValue("明天帮同事带早餐");
    expect(within(form).getByLabelText("相关人")).toHaveValue("同事");
    expect(within(form).getByLabelText("地点")).toHaveValue("公司");
    expect(within(form).getByLabelText("截止时间")).toHaveValue(
      toDateTimeLocalValue(detailArrangement.deadlineAt)
    );
    expect(within(form).getByLabelText("提醒时间")).toHaveValue(
      toDateTimeLocalValue(detailArrangement.reminderAt)
    );

    fireEvent.change(within(form).getByLabelText("标题"), {
      target: { value: "明天帮同事带早餐和咖啡" },
    });
    fireEvent.change(within(form).getByLabelText("地点"), {
      target: { value: "楼下咖啡店" },
    });
    fireEvent.change(within(form).getByLabelText("截止时间"), {
      target: { value: "2026-05-23T08:30" },
    });
    fireEvent.change(within(form).getByLabelText("备注"), {
      target: { value: "顺手买无糖豆浆，咖啡要热的。" },
    });
    fireEvent.click(screen.getByTestId("arrangement-editor-submit-update"));

    const storedArrangements = JSON.parse(
      window.localStorage.getItem("arkme-demo.arrangements") ?? "[]"
    ) as Arrangement[];
    expect(storedArrangements).toHaveLength(1);
    expect(storedArrangements[0]).toMatchObject({
      id: detailArrangement.id,
      title: "明天帮同事带早餐和咖啡",
      place: "楼下咖啡店",
      deadlineAt: new Date("2026-05-23T08:30").toISOString(),
    });

    unmount();
    render(<ArrangementsPage />);
    expect(within(screen.getByTestId("arrangement-group-recent")).getByText("明天帮同事带早餐和咖啡"))
      .toBeInTheDocument();
  });

  it("shows delete only inside edit mode and requires confirmation", () => {
    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangement-view-arr_breakfast"));
    fireEvent.click(screen.getByTestId("arrangement-detail-edit"));

    expect(screen.getByTestId("arrangement-editor-delete")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("arrangement-editor-delete"));
    expect(screen.getByTestId("arrangement-delete-confirmation")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消删除" })).not.toBeInTheDocument();
  });

  it("deletes an arrangement only after explicit confirmation", () => {
    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangement-view-arr_breakfast"));
    fireEvent.click(screen.getByTestId("arrangement-detail-edit"));
    fireEvent.click(screen.getByTestId("arrangement-editor-delete"));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    expect(screen.queryByText("明天帮同事带早餐")).not.toBeInTheDocument();
  });

  it("keeps an explicitly emptied arrangement list empty after remount", () => {
    window.localStorage.setItem("arkme-demo.arrangements", JSON.stringify([detailArrangement]));

    const { unmount } = render(<ArrangementsPage />);
    fireEvent.click(screen.getByTestId("arrangement-view-arr_detail"));
    fireEvent.click(screen.getByTestId("arrangement-detail-edit"));
    fireEvent.click(screen.getByTestId("arrangement-editor-delete"));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    expect(screen.queryByText("明天帮同事带早餐")).not.toBeInTheDocument();

    unmount();
    render(<ArrangementsPage />);
    expect(screen.queryByTestId("arrangement-view-arr_hospital")).not.toBeInTheDocument();
    expect(screen.queryByText("今天上午去医院体检")).not.toBeInTheDocument();
  });

  it("reveals delete after a left swipe without deleting immediately", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T10:15:00+08:00"));

    render(<ArrangementsPage />);
    const row = screen.getByTestId("arrangement-row-arr_breakfast");

    expect(screen.queryByTestId("arrangement-delete-arr_breakfast")).not.toBeInTheDocument();

    leftSwipe(screen.getByTestId("arrangement-view-arr_breakfast"));

    expect(screen.getByTestId("arrangement-delete-arr_breakfast")).toBeInTheDocument();
    expect(row).toHaveStyle({
      transform: "translateX(-84px)",
    });
    expect(screen.queryByTestId("arrangement-delete-confirmation")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("arrangement-group-today")).getByText("明天帮同事带早餐"))
      .toBeInTheDocument();
    vi.useRealTimers();
  });

  it("reveals delete when swiping the whole completed card surface", () => {
    window.localStorage.setItem(
      "arkme-demo.arrangements",
      JSON.stringify([
        makeArrangement({
          id: "arr_completed_surface",
          title: "Completed surface swipe",
          timeMode: "deadline",
          deadlineAt: "2026-05-19T08:52:00.000Z",
          status: "completed",
          completedAt: "2026-05-19T09:00:00.000Z",
        }),
      ])
    );

    render(<ArrangementsPage />);

    leftSwipe(screen.getByTestId("arrangement-row-arr_completed_surface"));

    expect(screen.getByTestId("arrangement-delete-arr_completed_surface")).toBeInTheDocument();
    expect(screen.getByTestId("arrangement-row-arr_completed_surface")).toHaveStyle({
      transform: "translateX(-84px)",
    });
  });

  it("keeps only one delete control anchored in the right-side lane after swipe", () => {
    render(<ArrangementsPage />);

    const row = screen.getByTestId("arrangement-row-arr_breakfast");
    const item = row.closest("li");
    if (!item) throw new Error("Expected arrangement row to be inside a list item");

    leftSwipe(screen.getByTestId("arrangement-view-arr_breakfast"));

    expect(within(row).queryByTestId("arrangement-delete-arr_breakfast")).not.toBeInTheDocument();
    expect(within(item).getByTestId("arrangement-delete-arr_breakfast")).toBeInTheDocument();
    expect(within(item).getAllByText("删除")).toHaveLength(1);
  });

  it("follows the finger during a short left swipe and snaps back when released early", () => {
    render(<ArrangementsPage />);

    const row = screen.getByTestId("arrangement-row-arr_breakfast");
    const card = screen.getByTestId("arrangement-view-arr_breakfast");
    fireEvent.pointerDown(card, { pointerId: 2, clientX: 240, clientY: 20 });
    fireEvent.pointerMove(card, { pointerId: 2, clientX: 210, clientY: 20 });

    expect(row).toHaveStyle({ transform: "translateX(-30px)" });

    fireEvent.pointerUp(card, { pointerId: 2, clientX: 210, clientY: 20 });

    expect(row).toHaveStyle({ transform: "translateX(0px)" });
    expect(screen.queryByTestId("arrangement-delete-arr_breakfast")).not.toBeInTheDocument();
  });

  it("keeps the complete button at the trailing edge inside the same sliding row", () => {
    render(<ArrangementsPage />);

    const row = screen.getByTestId("arrangement-row-arr_breakfast");
    expect(within(row).getByTestId("arrangement-view-arr_breakfast")).toBeInTheDocument();
    expect(within(row).getByTestId("arrangement-complete-arr_breakfast")).toBeInTheDocument();
  });

  it("uses green styling for the complete action button", () => {
    render(<ArrangementsPage />);

    const completeButton = screen.getByTestId("arrangement-complete-arr_breakfast");
    expect(completeButton).toHaveClass("border-[color:rgba(34,197,94,0.35)]");
    expect(completeButton).toHaveClass("text-[color:rgb(22,101,52)]");
    expect(completeButton).toHaveClass("bg-[color:rgba(34,197,94,0.08)]");
  });

  it("keeps arrangement text inset from the clipped swipe container", () => {
    render(<ArrangementsPage />);

    const row = screen.getByTestId("arrangement-row-arr_breakfast");
    expect(row).toHaveClass("px-3");
    expect(row).toHaveClass("py-3");
  });

  it("still requires confirmation before deleting from the left-swipe action", () => {
    render(<ArrangementsPage />);

    leftSwipe(screen.getByTestId("arrangement-view-arr_breakfast"));
    fireEvent.click(screen.getByTestId("arrangement-delete-arr_breakfast"));

    expect(screen.getByTestId("arrangement-delete-confirmation")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消删除" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    expect(screen.queryByText("明天帮同事带早餐")).not.toBeInTheDocument();
  });

  it("supports the same left-swipe delete flow in every arrangement group", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T12:00:00+08:00"));
    window.localStorage.setItem(
      "arkme-demo.arrangements",
      JSON.stringify([
        makeArrangement({
          id: "arr_swipe_today",
          title: "Swipe today",
          deadlineAt: "2026-05-16T08:00:00.000Z",
          timeMode: "deadline",
        }),
        makeArrangement({
          id: "arr_swipe_recent",
          title: "Swipe recent",
          deadlineAt: "2026-05-18T08:00:00.000Z",
          timeMode: "deadline",
        }),
        makeArrangement({
          id: "arr_swipe_no_time",
          title: "Swipe no time",
          status: "noDate",
        }),
        makeArrangement({
          id: "arr_swipe_someday",
          title: "Swipe someday",
          status: "someday",
          snoozedAt: "2026-05-16T09:00:00.000Z",
        }),
        makeArrangement({
          id: "arr_swipe_completed",
          title: "Swipe completed",
          status: "completed",
          completedAt: "2026-05-16T10:00:00.000Z",
        }),
      ])
    );

    render(<ArrangementsPage />);

    [
      "arr_swipe_today",
      "arr_swipe_recent",
      "arr_swipe_no_time",
      "arr_swipe_someday",
      "arr_swipe_completed",
    ].forEach((id) => {
      leftSwipe(screen.getByTestId(`arrangement-view-${id}`));
      expect(screen.getByTestId(`arrangement-delete-${id}`)).toBeInTheDocument();
      fireEvent.click(screen.getByTestId(`arrangement-delete-${id}`));
      expect(screen.getByTestId("arrangement-delete-confirmation")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
      expect(screen.queryByTestId(`arrangement-view-${id}`)).not.toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it("shows only the latest three completed arrangements until expanded", () => {
    window.localStorage.setItem(
      "arkme-demo.arrangements",
      JSON.stringify([
        makeArrangement({
          id: "arr_done_1",
          title: "Done 1",
          status: "completed",
          completedAt: "2026-05-16T10:00:00.000Z",
        }),
        makeArrangement({
          id: "arr_done_2",
          title: "Done 2",
          status: "completed",
          completedAt: "2026-05-16T11:00:00.000Z",
        }),
        makeArrangement({
          id: "arr_done_3",
          title: "Done 3",
          status: "completed",
          completedAt: "2026-05-16T12:00:00.000Z",
        }),
        makeArrangement({
          id: "arr_done_4",
          title: "Done 4",
          status: "completed",
          completedAt: "2026-05-16T13:00:00.000Z",
        }),
      ])
    );

    render(<ArrangementsPage />);

    const completed = screen.getByTestId("arrangement-group-completed");
    expect(within(completed).getByText("Done 4")).toBeInTheDocument();
    expect(within(completed).getByText("Done 3")).toBeInTheDocument();
    expect(within(completed).getByText("Done 2")).toBeInTheDocument();
    expect(within(completed).queryByText("Done 1")).not.toBeInTheDocument();
    expect(within(completed).getByRole("button", { name: "展开更多已完成安排" })).toBeInTheDocument();

    fireEvent.click(within(completed).getByRole("button", { name: "展开更多已完成安排" }));

    expect(within(completed).getByText("Done 1")).toBeInTheDocument();
    expect(within(completed).getByRole("button", { name: "收起已完成安排" })).toBeInTheDocument();

    leftSwipe(screen.getByTestId("arrangement-view-arr_done_1"));
    fireEvent.click(screen.getByTestId("arrangement-delete-arr_done_1"));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    expect(within(completed).queryByText("Done 1")).not.toBeInTheDocument();
  });

  it("closes a revealed delete lane when the list scrolls or blank space is tapped", () => {
    render(<ArrangementsPage />);

    leftSwipe(screen.getByTestId("arrangement-view-arr_breakfast"));
    expect(screen.getByTestId("arrangement-delete-arr_breakfast")).toBeInTheDocument();

    fireEvent.scroll(screen.getByTestId("arrangements-scroll-container"));
    expect(screen.queryByTestId("arrangement-delete-arr_breakfast")).not.toBeInTheDocument();

    leftSwipe(screen.getByTestId("arrangement-view-arr_breakfast"));
    expect(screen.getByTestId("arrangement-delete-arr_breakfast")).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByTestId("arrangements-workspace"));
    expect(screen.queryByTestId("arrangement-delete-arr_breakfast")).not.toBeInTheDocument();
  });

  it("closes gesture overlays when another sheet is opened", () => {
    vi.useFakeTimers();
    render(<ArrangementsPage />);

    longPress(screen.getByTestId("arrangement-view-arr_breakfast"));
    expect(screen.getByTestId("arrangement-state-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("arrangements-create-trigger"));

    expect(screen.queryByTestId("arrangement-state-dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("arrangement-create-sheet")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("keeps state-shift actions hidden until a long press opens the centered mini dialog", () => {
    vi.useFakeTimers();
    render(<ArrangementsPage />);

    expect(screen.queryByTestId("arrangement-state-dialog")).not.toBeInTheDocument();

    longPress(screen.getByTestId("arrangement-view-arr_breakfast"));

    const dialog = screen.getByTestId("arrangement-state-dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("明天帮同事带早餐")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "以后再说 明天帮同事带早餐" }))
      .toBeInTheDocument();
    expect(screen.queryByTestId("arrangement-detail-sheet")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("closes the centered state dialog as soon as a left swipe begins", () => {
    vi.useFakeTimers();
    render(<ArrangementsPage />);

    const card = screen.getByTestId("arrangement-view-arr_breakfast");
    longPress(card);
    expect(screen.getByTestId("arrangement-state-dialog")).toBeInTheDocument();

    fireEvent.pointerDown(card, { pointerId: 3, clientX: 240, clientY: 20 });
    fireEvent.pointerMove(card, { pointerId: 3, clientX: 220, clientY: 20 });

    expect(screen.queryByTestId("arrangement-state-dialog")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("moves an arrangement to someday with the centered low-pressure action", () => {
    vi.useFakeTimers();
    render(<ArrangementsPage />);

    longPress(screen.getByTestId("arrangement-view-arr_breakfast"));
    fireEvent.click(screen.getByRole("button", { name: "以后再说 明天帮同事带早餐" }));

    const someday = screen.getByTestId("arrangement-group-someday");
    expect(within(someday).getByText("明天帮同事带早餐")).toBeInTheDocument();
    expect(screen.queryByTestId("arrangement-state-dialog")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("offers undo after a state action and restores the previous arrangement list", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T10:15:00+08:00"));
    render(<ArrangementsPage />);

    longPress(screen.getByTestId("arrangement-view-arr_breakfast"));
    fireEvent.click(screen.getByRole("button", { name: "以后再说 明天帮同事带早餐" }));

    expect(screen.getByTestId("arrangement-undo-toast")).toHaveTextContent("已放到以后再说");
    expect(within(screen.getByTestId("arrangement-group-someday")).getByText("明天帮同事带早餐"))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "撤销上一步安排操作" }));

    expect(screen.queryByTestId("arrangement-undo-toast")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("arrangement-group-today")).getByText("明天帮同事带早餐"))
      .toBeInTheDocument();
    vi.useRealTimers();
  });

  it("restores a someday item with the centered recovery action", () => {
    vi.useFakeTimers();
    render(<ArrangementsPage />);

    longPress(screen.getByTestId("arrangement-view-arr_old_photos"));
    expect(screen.getByTestId("arrangement-state-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "今天就说！ 整理旧照片" }));

    const recent = screen.getByTestId("arrangement-group-recent");
    expect(within(recent).getByText("整理旧照片")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("completes an arrangement and reopens it with the centered recovery action", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T10:15:00+08:00"));
    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangement-complete-arr_breakfast"));
    const completed = screen.getByTestId("arrangement-group-completed");
    expect(within(completed).getByText("明天帮同事带早餐")).toBeInTheDocument();
    expect(within(completed).queryByTestId("arrangement-complete-arr_breakfast")).not.toBeInTheDocument();

    longPress(screen.getByTestId("arrangement-view-arr_breakfast"));
    expect(screen.getByTestId("arrangement-state-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "还没完 明天帮同事带早餐" }));

    expect(within(screen.getByTestId("arrangement-group-today")).getByText("明天帮同事带早餐"))
      .toBeInTheDocument();
    vi.useRealTimers();
  });

  it("does not open a status-action dialog for no-time arrangements", () => {
    vi.useFakeTimers();
    render(<ArrangementsPage />);

    longPress(screen.getByTestId("arrangement-view-arr_call_mom"));

    expect(screen.queryByTestId("arrangement-state-dialog")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("wires detail actions without exposing destructive delete by default", () => {
    const onComplete = vi.fn();
    const onPostpone = vi.fn();
    const onEdit = vi.fn();

    render(
      <ArrangementDetail
        arrangement={detailArrangement}
        onComplete={onComplete}
        onPostpone={onPostpone}
        onEdit={onEdit}
      />
    );

    fireEvent.click(screen.getByTestId("arrangement-detail-complete"));
    fireEvent.click(screen.getByTestId("arrangement-detail-postpone"));
    fireEvent.click(screen.getByTestId("arrangement-detail-edit"));

    expect(onComplete).toHaveBeenCalledWith(detailArrangement.id);
    expect(onPostpone).toHaveBeenCalledWith(detailArrangement.id);
    expect(onEdit).toHaveBeenCalledWith(detailArrangement.id);
    expect(screen.queryByRole("button", { name: /删除/ })).not.toBeInTheDocument();
  });

  it("shows AI execution capability layers in arrangement details", () => {
    const onComplete = vi.fn();
    const onPostpone = vi.fn();
    const onEdit = vi.fn();

    const { rerender } = render(
      <ArrangementDetail
        arrangement={{
          ...detailArrangement,
          executionCapability: "userOnly",
          aiAssistActions: [],
        }}
        onComplete={onComplete}
        onPostpone={onPostpone}
        onEdit={onEdit}
      />
    );

    expect(screen.getByTestId("arrangement-execution-capability")).toHaveTextContent(
      "只能用户完成"
    );
    expect(screen.getByTestId("arrangement-execution-capability")).toHaveTextContent(
      "需要你实际处理或亲自确认"
    );

    rerender(
      <ArrangementDetail
        arrangement={{
          ...detailArrangement,
          executionCapability: "aiAssist",
          aiAssistActions: ["prepareMaterials", "draftReply", "generateRoute"],
        }}
        onComplete={onComplete}
        onPostpone={onPostpone}
        onEdit={onEdit}
      />
    );

    expect(screen.getByTestId("arrangement-execution-capability")).toHaveTextContent(
      "AI 可辅助"
    );
    expect(screen.getByTestId("arrangement-execution-capability")).toHaveTextContent("准备材料");
    expect(screen.getByTestId("arrangement-execution-capability")).toHaveTextContent("草拟回复");
    expect(screen.getByTestId("arrangement-execution-capability")).toHaveTextContent("生成路线");

    rerender(
      <ArrangementDetail
        arrangement={{
          ...detailArrangement,
          executionCapability: "aiAuto",
          aiAssistActions: ["draftReply"],
        }}
        onComplete={onComplete}
        onPostpone={onPostpone}
        onEdit={onEdit}
      />
    );

    expect(screen.getByTestId("arrangement-execution-capability")).toHaveTextContent(
      "AI 可自动执行"
    );
    expect(screen.getByTestId("arrangement-execution-capability")).toHaveTextContent("需要授权");
    expect(screen.getByTestId("arrangement-execution-capability")).toHaveTextContent("执行前确认");
    expect(screen.getByTestId("arrangement-execution-capability")).toHaveTextContent("可回滚记录");
  });

  it("generates local AI assist drafts inside detail without changing arrangement state", async () => {
    const onComplete = vi.fn();
    const onPostpone = vi.fn();
    const onEdit = vi.fn();

    render(
      <ArrangementDetail
        arrangement={{
          ...detailArrangement,
          executionCapability: "aiAssist",
          aiAssistActions: ["prepareMaterials", "draftReply", "generateRoute"],
        }}
        onComplete={onComplete}
        onPostpone={onPostpone}
        onEdit={onEdit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "准备材料" }));
    expect(await screen.findByTestId("arrangement-ai-assist-result")).toHaveTextContent(
      "准备材料"
    );
    expect(screen.getByTestId("arrangement-ai-assist-result")).toHaveTextContent(
      "明天帮同事带早餐"
    );
    expect(screen.getByTestId("arrangement-ai-assist-result")).toHaveTextContent(
      "只生成草稿，不会自动执行"
    );

    fireEvent.click(screen.getByRole("button", { name: "草拟回复" }));
    expect(await screen.findByTestId("arrangement-ai-assist-result")).toHaveTextContent(
      "草拟回复"
    );
    expect(screen.getByTestId("arrangement-ai-assist-result")).toHaveTextContent(
      "你看这样可以吗"
    );

    fireEvent.click(screen.getByRole("button", { name: "生成路线" }));
    expect(await screen.findByTestId("arrangement-ai-assist-result")).toHaveTextContent(
      "生成路线"
    );
    expect(screen.getByTestId("arrangement-ai-assist-result")).toHaveTextContent("公司");
    expect(onComplete).not.toHaveBeenCalled();
    expect(onPostpone).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("generates AI assist drafts from the real detail sheet buttons", async () => {
    window.localStorage.setItem(
      "arkme-demo.arrangements",
      JSON.stringify([
        {
          ...detailArrangement,
          id: "arr_detail_assist",
          title: "明天去公司拿资料",
          notes: "带上取件码。",
          place: "公司",
          executionCapability: "aiAssist",
          aiAssistActions: ["prepareMaterials", "draftReply"],
        },
      ])
    );

    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangement-view-arr_detail_assist"));
    const detailSheet = screen.getByTestId("arrangement-detail-sheet");
    fireEvent.click(within(detailSheet).getByRole("button", { name: "准备材料" }));

    expect(await within(detailSheet).findByTestId("arrangement-ai-assist-result"))
      .toHaveTextContent("明天去公司拿资料");
    expect(within(detailSheet).getByTestId("arrangement-ai-assist-result"))
      .toHaveTextContent("只生成草稿，不会自动执行");

    fireEvent.click(within(detailSheet).getByRole("button", { name: "草拟回复" }));
    expect(await within(detailSheet).findByTestId("arrangement-ai-assist-result"))
      .toHaveTextContent("你看这样可以吗");
  });

  it("shows immediate visible feedback while an AI assist draft is being generated", async () => {
    vi.spyOn(window, "fetch").mockImplementation(
      () => new Promise<Response>(() => undefined)
    );
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
    window.localStorage.setItem(
      "arkme-demo.arrangements",
      JSON.stringify([
        {
          ...detailArrangement,
          id: "arr_slow_assist",
          title: "明天去公司拿资料",
          notes: "带上取件码。",
          place: "公司",
          executionCapability: "aiAssist",
          aiAssistActions: ["prepareMaterials"],
        },
      ])
    );

    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangement-view-arr_slow_assist"));
    const detailSheet = screen.getByTestId("arrangement-detail-sheet");
    fireEvent.click(within(detailSheet).getByRole("button", { name: "准备材料" }));

    expect(await within(detailSheet).findByTestId("arrangement-ai-assist-result"))
      .toHaveTextContent("正在生成草稿");
    expect(within(detailSheet).getByTestId("arrangement-ai-assist-result"))
      .toHaveTextContent("只生成草稿，不会自动执行");
  });

  it("moves focus into a bottom sheet and restores focus when it closes", () => {
    vi.useFakeTimers();
    render(<ArrangementsPage />);

    const createTrigger = screen.getByTestId("arrangements-create-trigger");
    createTrigger.focus();
    fireEvent.click(createTrigger);

    expect(screen.getByLabelText("标题")).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "关闭抽屉" }));
    act(() => {
      vi.advanceTimersByTime(240);
    });

    expect(createTrigger).toHaveFocus();
    vi.useRealTimers();
  });

  it("closes sheets and delete confirmation with Escape", () => {
    vi.useFakeTimers();
    render(<ArrangementsPage />);

    fireEvent.click(screen.getByTestId("arrangements-create-trigger"));
    expect(screen.getByTestId("arrangement-create-sheet")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByTestId("arrangement-create-sheet")).toHaveAttribute(
      "data-motion-state",
      "closing"
    );
    act(() => {
      vi.advanceTimersByTime(240);
    });

    fireEvent.click(screen.getByTestId("arrangement-view-arr_breakfast"));
    fireEvent.click(screen.getByTestId("arrangement-detail-edit"));
    fireEvent.click(screen.getByTestId("arrangement-editor-delete"));
    expect(screen.getByTestId("arrangement-delete-confirmation")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("arrangement-delete-confirmation")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function longPress(element: HTMLElement, duration = 450) {
  fireEvent.pointerDown(element, { pointerId: 1 });
  act(() => {
    vi.advanceTimersByTime(duration);
  });
  fireEvent.pointerUp(element, { pointerId: 1 });
}

function leftSwipe(element: HTMLElement) {
  fireEvent.pointerDown(element, { pointerId: 2, clientX: 240, clientY: 20 });
  fireEvent.pointerMove(element, { pointerId: 2, clientX: 140, clientY: 20 });
  fireEvent.pointerUp(element, { pointerId: 2, clientX: 140, clientY: 20 });
}
