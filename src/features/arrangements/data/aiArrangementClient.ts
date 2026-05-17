import type { AiSettings } from "./aiSettingsStore";
import { isAiSettingsReady } from "./aiSettingsStore";
import { buildGroupChatCandidateId } from "./groupChatRecognition";
import type { ChatRecognitionMessage, PrivateChatRecognitionResult } from "./privateChatRecognition";
import { buildPrivateChatCandidateId } from "./privateChatRecognition";
import type {
  AiArrangementCandidate,
  AiArrangementConfidence,
  ArrangementAiAssistAction,
  Arrangement,
  ArrangementTimeMode,
} from "../types";

type FetchLike = typeof fetch;

type AiRecognitionResponse = {
  shouldCreate?: unknown;
  title?: unknown;
  notes?: unknown;
  people?: unknown;
  place?: unknown;
  timeMode?: unknown;
  deadlineAt?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  reminderAt?: unknown;
  confidence?: unknown;
  sourceSummary?: unknown;
};

type AiCompletionResponse = {
  shouldSuggestCompletion?: unknown;
  arrangementId?: unknown;
  confidence?: unknown;
  evidence?: unknown;
};

type AiAssistDraftResponse = {
  content?: unknown;
};

export type AiCompletionRecognitionResult = {
  arrangementId: string;
  confidence: AiArrangementConfidence;
  evidence: string;
};

export type AiAssistDraftResult = {
  source: "ai" | "local";
  title: string;
  content: string;
};

type SelfMessageAiInput = {
  settings: AiSettings;
  message: string;
  now?: Date;
  fetchImpl?: FetchLike;
};

type CompletionAiInput = {
  settings: AiSettings;
  arrangements: Arrangement[];
  messageText: string;
  now?: Date;
  fetchImpl?: FetchLike;
};

type AssistDraftAiInput = {
  settings: AiSettings;
  arrangement: Arrangement;
  action: ArrangementAiAssistAction;
  now?: Date;
  fetchImpl?: FetchLike;
};

type PrivateChatAiInput = {
  settings: AiSettings;
  conversationId: string;
  identityName: string;
  requestMessage: ChatRecognitionMessage;
  replyMessage: ChatRecognitionMessage;
  now?: Date;
  fetchImpl?: FetchLike;
};

type GroupChatAiInput = PrivateChatAiInput & {
  groupName: string;
  currentUserName: string;
};

type AiConnectionTestInput = {
  settings: AiSettings;
  fetchImpl?: FetchLike;
};

const arrangementTimeModes = new Set<ArrangementTimeMode>(["none", "deadline", "range"]);
const confidenceLevels = new Set<AiArrangementConfidence>(["high", "medium", "low"]);
const assistDraftTimeoutMs = 4800;

export async function testAiArrangementConnection({
  settings,
  fetchImpl = fetch,
}: AiConnectionTestInput): Promise<void> {
  if (!isAiSettingsReady(settings)) {
    throw new Error("AI settings are incomplete");
  }

  await requestAiArrangementRecognition({
    settings,
    fetchImpl,
    temperature: 0,
    errorPrefix: "AI connection test failed",
    userPrompt: [
      "连接测试：请只返回 JSON。",
      '不要创建安排，返回 {"shouldCreate":false}。',
    ].join("\n"),
  });
}

export async function recognizeSelfMessageArrangementWithAi({
  settings,
  message,
  now = new Date(),
  fetchImpl = fetch,
}: SelfMessageAiInput): Promise<AiArrangementCandidate | null> {
  if (!isAiSettingsReady(settings)) return null;

  const trimmedMessage = message.trim();
  if (!trimmedMessage) return null;

  const modelResult = await requestAiArrangementRecognition({
    settings,
    fetchImpl,
    userPrompt: [
      "场景：用户发给自己的一句话。",
      `当前时间：${now.toISOString()}`,
      `消息：${trimmedMessage}`,
    ].join("\n"),
  });
  if (!modelResult?.shouldCreate) return null;

  return normalizeModelCandidate({
    modelResult,
    id: `cand_ai_self_${toStableSlug(trimmedMessage)}`,
    sourceType: "selfMessage",
    rawContext: [trimmedMessage],
    fallbackTitle: trimmedMessage,
    fallbackPeople: ["自己"],
    fallbackSourceSummary: `发给自己：${trimmedMessage}`,
    now,
  });
}

export async function recognizePrivateChatArrangementWithAi({
  settings,
  conversationId,
  identityName,
  requestMessage,
  replyMessage,
  now = new Date(),
  fetchImpl = fetch,
}: PrivateChatAiInput): Promise<PrivateChatRecognitionResult | null> {
  if (!isAiSettingsReady(settings)) return null;

  const requestText = requestMessage.text.trim();
  const replyText = replyMessage.text.trim();
  if (!requestText || !replyText) return null;

  const modelResult = await requestAiArrangementRecognition({
    settings,
    fetchImpl,
    userPrompt: [
      "场景：私聊中对方提出请求，当前用户随后回复。",
      `当前时间：${now.toISOString()}`,
      `对方名称：${identityName}`,
      `对方消息：${requestText}`,
      `我的回复：${replyText}`,
      "只有当我的回复表示接受或承诺，且对方消息需要我后续执行时，才 shouldCreate=true。",
    ].join("\n"),
  });
  if (!modelResult?.shouldCreate) return null;

  const candidate = normalizeModelCandidate({
    modelResult,
    id: buildPrivateChatCandidateId(conversationId, requestMessage.id),
    sourceType: "privateChat",
    rawContext: [`${identityName}：${requestText}`, `我：${replyText}`],
    fallbackTitle: requestText,
    fallbackPeople: [identityName],
    fallbackSourceSummary: `私聊：${identityName} 请求`,
    now,
  });
  if (!candidate) return null;

  return {
    recognizedMessageId: requestMessage.id,
    candidate,
  };
}

export async function recognizeGroupChatArrangementWithAi({
  settings,
  conversationId,
  groupName,
  identityName,
  currentUserName,
  requestMessage,
  replyMessage,
  now = new Date(),
  fetchImpl = fetch,
}: GroupChatAiInput): Promise<PrivateChatRecognitionResult | null> {
  if (!isAiSettingsReady(settings)) return null;

  const requestText = requestMessage.text.trim();
  const replyText = replyMessage.text.trim();
  if (!requestText || !replyText) return null;

  const modelResult = await requestAiArrangementRecognition({
    settings,
    fetchImpl,
    userPrompt: [
      "场景：群聊中其他成员提出请求，当前用户随后回复。",
      `当前时间：${now.toISOString()}`,
      `群聊名称：${groupName}`,
      `当前用户名称：${currentUserName || "李小溪"}`,
      `请求成员名称：${identityName}`,
      `群聊消息：${requestText}`,
      `我的回复：${replyText}`,
      "只有当群聊消息明确指向当前用户，且我的回复表示接受或承诺，并且该事项需要当前用户后续执行时，才 shouldCreate=true。",
    ].join("\n"),
  });
  if (!modelResult?.shouldCreate) return null;

  const candidate = normalizeModelCandidate({
    modelResult,
    id: buildGroupChatCandidateId(conversationId, requestMessage.id),
    sourceType: "groupChat",
    rawContext: [`${groupName} / ${identityName}：${requestText}`, `我：${replyText}`],
    fallbackTitle: requestText,
    fallbackPeople: [identityName],
    fallbackSourceSummary: `群聊：${groupName} / ${identityName} 请求`,
    now,
  });
  if (!candidate) return null;

  return {
    recognizedMessageId: requestMessage.id,
    candidate,
  };
}

export async function recognizeArrangementCompletionWithAi({
  settings,
  arrangements,
  messageText,
  now = new Date(),
  fetchImpl = fetch,
}: CompletionAiInput): Promise<AiCompletionRecognitionResult | null> {
  if (!isAiSettingsReady(settings)) return null;

  const evidenceText = messageText.trim();
  const eligibleArrangements = arrangements.filter((arrangement) =>
    isCompletionSuggestionEligible(arrangement)
  );
  if (!evidenceText || eligibleArrangements.length === 0) return null;

  const modelResult = await requestAiCompletionRecognition({
    settings,
    fetchImpl,
    userPrompt: [
      "场景：用户发出一条后续聊天消息，需要判断是否可能表示某个安排已经完成。",
      `当前时间：${now.toISOString()}`,
      `后续消息：${evidenceText}`,
      "候选安排：",
      ...eligibleArrangements.map((arrangement) =>
        [
          `- id=${arrangement.id}`,
          `标题=${arrangement.title}`,
          `备注=${arrangement.notes || "无"}`,
          `地点=${arrangement.place || "无"}`,
          `相关人=${arrangement.people.join("、") || "无"}`,
        ].join("；")
      ),
      "只建议可能已完成，不要自动完成。只有消息明确表示已实际处理完某个候选安排时 shouldSuggestCompletion=true。",
      "返回 JSON：shouldSuggestCompletion,arrangementId,confidence,evidence。",
    ].join("\n"),
  });

  if (!modelResult?.shouldSuggestCompletion) return null;
  const arrangementId = toNonEmptyString(modelResult.arrangementId);
  if (!arrangementId || !eligibleArrangements.some((item) => item.id === arrangementId)) {
    return null;
  }

  return {
    arrangementId,
    confidence: toConfidence(modelResult.confidence),
    evidence: toNonEmptyString(modelResult.evidence) ?? evidenceText,
  };
}

export async function generateArrangementAssistDraft({
  settings,
  arrangement,
  action,
  now = new Date(),
  fetchImpl = fetch,
}: AssistDraftAiInput): Promise<AiAssistDraftResult> {
  const title = aiAssistActionLabels[action];

  if (isAiSettingsReady(settings)) {
    try {
      const content = await withTimeout(
        requestAiAssistDraft({
          settings,
          arrangement,
          action,
          now,
          fetchImpl,
        }),
        assistDraftTimeoutMs
      );
      if (content) {
        return {
          source: "ai",
          title,
          content,
        };
      }
    } catch {
      // Keep AI assistance low-pressure: if the model fails, return a local draft.
    }
  }

  return {
    source: "local",
    title,
    content: buildLocalAssistDraft(arrangement, action),
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("AI assist draft request timed out"));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

async function requestAiArrangementRecognition({
  settings,
  fetchImpl,
  userPrompt,
  temperature = 0.2,
  errorPrefix = "AI recognition request failed",
}: {
  settings: AiSettings;
  fetchImpl: FetchLike;
  userPrompt: string;
  temperature?: number;
  errorPrefix?: string;
}) {
  const response = await fetchImpl(toChatCompletionsUrl(settings.apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.modelName,
      temperature,
      messages: [
        {
          role: "system",
          content: [
            "你是安排识别器，只输出 JSON，不输出解释。",
            "识别尚未发生且需要用户后续执行的事项。",
            "提醒：只生成候选，不直接创建正式安排。",
            "JSON 字段：shouldCreate,title,notes,people,place,timeMode,deadlineAt,startAt,endAt,reminderAt,confidence,sourceSummary。",
            "timeMode 只能是 none、deadline 或 range。confidence 只能是 high、medium 或 low。",
            "无法确定时间时 timeMode=none，相关时间字段为 null。",
          ].join("\n"),
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`${errorPrefix}: ${response.status}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;

  return parseJsonObject(content);
}

async function requestAiCompletionRecognition({
  settings,
  fetchImpl,
  userPrompt,
}: {
  settings: AiSettings;
  fetchImpl: FetchLike;
  userPrompt: string;
}) {
  const response = await fetchImpl(toChatCompletionsUrl(settings.apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.modelName,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: [
            "你是安排完成状态判断器，只输出 JSON，不输出解释。",
            "你的任务是只建议可能已完成，不能自动完成安排。",
            "只有后续消息明确表示用户已经实际完成某个候选安排时才建议。",
            "JSON 字段：shouldSuggestCompletion,arrangementId,confidence,evidence。",
            "confidence 只能是 high、medium 或 low。",
          ].join("\n"),
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI completion recognition request failed: ${response.status}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;

  return parseCompletionJsonObject(content);
}

async function requestAiAssistDraft({
  settings,
  arrangement,
  action,
  now,
  fetchImpl,
}: {
  settings: AiSettings;
  arrangement: Arrangement;
  action: ArrangementAiAssistAction;
  now: Date;
  fetchImpl: FetchLike;
}) {
  const response = await fetchImpl(toChatCompletionsUrl(settings.apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.modelName,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "你是安排 AI 辅助助手，只生成辅助草稿，不执行外部动作。",
            "不要发送消息、不要导航、不要修改安排状态、不要代表用户确认完成。",
            "只输出 JSON，不输出解释。JSON 字段：content。",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `当前时间：${now.toISOString()}`,
            `辅助动作：${aiAssistActionLabels[action]}`,
            `安排标题：${arrangement.title}`,
            `备注：${arrangement.notes || "无"}`,
            `相关人：${arrangement.people.join("、") || "无"}`,
            `地点：${arrangement.place || "无"}`,
            `时间：${formatArrangementTimeForPrompt(arrangement)}`,
            "请生成一段可以直接参考的简短草稿。",
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI assist draft request failed: ${response.status}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;

  const parsed = parseAssistJsonObject(content);
  return toNonEmptyString(parsed?.content) ?? toNonEmptyString(content);
}

function normalizeModelCandidate({
  modelResult,
  id,
  sourceType,
  rawContext,
  fallbackTitle,
  fallbackPeople,
  fallbackSourceSummary,
  now,
}: {
  modelResult: AiRecognitionResponse;
  id: string;
  sourceType: AiArrangementCandidate["sourceType"];
  rawContext: string[];
  fallbackTitle: string;
  fallbackPeople: string[];
  fallbackSourceSummary: string;
  now: Date;
}): AiArrangementCandidate | null {
  const title = toNonEmptyString(modelResult.title) ?? fallbackTitle;
  const timeMode = toTimeMode(modelResult.timeMode);
  const createdAt = now.toISOString();

  return {
    id,
    title,
    notes: toNonEmptyString(modelResult.notes) ?? "AI 识别生成候选，确认后才会创建正式安排。",
    people: toStringArray(modelResult.people, fallbackPeople),
    place: typeof modelResult.place === "string" ? modelResult.place : "",
    timeMode,
    deadlineAt: timeMode === "deadline" ? toNullableString(modelResult.deadlineAt) : null,
    startAt: timeMode === "range" ? toNullableString(modelResult.startAt) : null,
    endAt: timeMode === "range" ? toNullableString(modelResult.endAt) : null,
    reminderAt: toNullableString(modelResult.reminderAt),
    sourceType,
    sourceSummary: toNonEmptyString(modelResult.sourceSummary) ?? fallbackSourceSummary,
    rawContext,
    confidence: toConfidence(modelResult.confidence),
    status: "pending",
    createdAt,
    updatedAt: createdAt,
  };
}

function toChatCompletionsUrl(apiBaseUrl: string) {
  const trimmedUrl = apiBaseUrl.trim().replace(/\/+$/g, "");
  return trimmedUrl.endsWith("/chat/completions")
    ? trimmedUrl
    : `${trimmedUrl}/chat/completions`;
}

function parseJsonObject(content: string): AiRecognitionResponse | null {
  const trimmed = content.trim();
  const jsonText = trimmed.startsWith("{")
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseCompletionJsonObject(content: string): AiCompletionResponse | null {
  const trimmed = content.trim();
  const jsonText = trimmed.startsWith("{")
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseAssistJsonObject(content: string): AiAssistDraftResponse | null {
  const trimmed = content.trim();
  const jsonText = trimmed.startsWith("{")
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function isCompletionSuggestionEligible(arrangement: Arrangement) {
  return !["completed", "maybeCompleted", "someday"].includes(arrangement.status);
}

function buildLocalAssistDraft(
  arrangement: Arrangement,
  action: ArrangementAiAssistAction
) {
  const people = arrangement.people.join("、") || "相关人";
  const place = arrangement.place || "目的地";
  const time = formatArrangementTimeForPrompt(arrangement);

  if (action === "draftReply") {
    return [
      `关于「${arrangement.title}」，我会按安排处理。`,
      arrangement.place ? `地点我记在 ${arrangement.place}。` : "如果地点有变化我会再确认。",
      `你看这样可以吗？`,
    ].join("\n");
  }

  if (action === "generateRoute") {
    return [
      `为「${arrangement.title}」先预留路线时间。`,
      `目的地：${place}。`,
      `建议出发前确认实时交通、入口位置和到达后的联系人；这只是路线准备草稿，不会自动导航。`,
    ].join("\n");
  }

  return [
    `为「${arrangement.title}」先准备这些材料：`,
    `- 相关人：${people}`,
    `- 地点：${place}`,
    `- 时间：${time}`,
    "- 核对证件、文件、沟通记录和可能需要提前发送的确认信息。",
  ].join("\n");
}

function formatArrangementTimeForPrompt(arrangement: Arrangement) {
  if (arrangement.deadlineAt) return `截止 ${arrangement.deadlineAt}`;
  if (arrangement.startAt && arrangement.endAt) {
    return `${arrangement.startAt} 至 ${arrangement.endAt}`;
  }
  if (arrangement.startAt) return `开始 ${arrangement.startAt}`;
  return "未设置";
}

function toNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
  return items.length > 0 ? items.map((item) => item.trim()) : fallback;
}

function toTimeMode(value: unknown): ArrangementTimeMode {
  return typeof value === "string" && arrangementTimeModes.has(value as ArrangementTimeMode)
    ? (value as ArrangementTimeMode)
    : "none";
}

function toConfidence(value: unknown): AiArrangementConfidence {
  return typeof value === "string" && confidenceLevels.has(value as AiArrangementConfidence)
    ? (value as AiArrangementConfidence)
    : "medium";
}

function toStableSlug(value: string) {
  const tokens = Array.from(value)
    .map((char) => {
      if (/^[a-z0-9]$/i.test(char)) return char.toLowerCase();
      if (slugTokens.has(char)) return slugTokens.get(char);
      if (/[\s_]+/.test(char)) return "-";
      return "";
    })
    .filter(Boolean);

  return tokens.join("-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "message";
}

const slugTokens = new Map<string, string>([
  ["今", "jin"],
  ["明", "ming"],
  ["后", "hou"],
  ["天", "tian"],
  ["上", "shang"],
  ["下", "xia"],
  ["午", "wu"],
  ["晚", "wan"],
  ["去", "qu"],
  ["一", "yi"],
  ["趟", "tang"],
  ["医", "yi"],
  ["院", "yuan"],
  ["复", "fu"],
  ["诊", "zhen"],
  ["拿", "na"],
  ["资", "zi"],
  ["料", "liao"],
]);

const aiAssistActionLabels: Record<ArrangementAiAssistAction, string> = {
  prepareMaterials: "准备材料",
  draftReply: "草拟回复",
  generateRoute: "生成路线",
};
