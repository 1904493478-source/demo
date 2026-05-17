import type { AiArrangementCandidate } from "../types";

export type ChatRecognitionMessage = {
  id: string;
  text: string;
  sentAt: number;
};

export type PrivateChatRecognitionInput = {
  conversationId: string;
  identityName: string;
  requestMessage: ChatRecognitionMessage;
  replyMessage: ChatRecognitionMessage;
  now?: Date;
};

export type PrivateChatRecognitionResult = {
  candidate: AiArrangementCandidate;
  recognizedMessageId: string;
};

const acceptanceStartPattern =
  /^(好|好的|好呀|好啊|可以|可以的|行|行的|没问题|沒問題|没事|ok|OK|收到|收到了|明白|明白了|知道了|成|妥|妥了|当然|当然可以|安排|安排上)([\s。！!,.，啊呀的了～~]|$)/;
const commitmentPattern =
  /(我.*(来|去|拿|取|买|带|做|办|预约|约|联系|回|交|发|看|整理|补|还|订|定|准备|提交|打印|寄|送|处理|安排)|交给我|包在我身上|放心|会的)/;
const refusalPattern = /(不行|不能|不可以|没空|没有空|沒空|抱歉|不好意思|算了|下次吧|改天吧|来不了|做不了|帮不了)/;
const taskVerbPattern = /(去|拿|取|买|带|做|办|预约|约|联系|回|交|发|看|整理|补|还|订|定|准备|提交|打印|寄|送|处理|安排|提醒|接|查|改|修|付|缴)/;
const taskVerbGlobalPattern = /(去|拿|取|买|带|做|办|预约|约|联系|回|交|发|看|整理|补|还|订|定|准备|提交|打印|寄|送|处理|安排|提醒|接|查|改|修|付|缴)/g;
const requestCuePattern = /(帮我|替我|给我|麻烦你|麻烦|拜托你|拜托|帮忙|能不能|可不可以|你能不能|你能|你可以|可以|记得|别忘了|请你|请)/;
const requestCues = [
  "你能不能",
  "可不可以",
  "麻烦你",
  "拜托你",
  "别忘了",
  "能不能",
  "你可以",
  "帮忙",
  "帮我",
  "替我",
  "给我",
  "麻烦",
  "拜托",
  "你能",
  "可以",
  "记得",
  "请你",
  "请",
];

export function buildPrivateChatCandidateId(conversationId: string, requestMessageId: string) {
  return `cand_private_${toStableSegment(conversationId)}_${toStableSegment(requestMessageId)}`;
}

export function recognizePrivateChatArrangement({
  conversationId,
  identityName,
  requestMessage,
  replyMessage,
  now = new Date(),
}: PrivateChatRecognitionInput): PrivateChatRecognitionResult | null {
  const requestText = requestMessage.text.trim();
  const replyText = replyMessage.text.trim();

  const objective = extractRequestObjective(requestText);
  const requestedItems = objective ? extractRequestedItems(objective) : [];

  if (!isAcceptanceReply(replyText) || !objective) {
    return null;
  }

  const createdAt = now.toISOString();
  const timeLabel = getRelativeDayLabel(requestText);
  const deadlineAt = buildDeadlineAt(requestText, now);
  const title = `${timeLabel}帮${identityName}${objective}`;

  return {
    recognizedMessageId: requestMessage.id,
    candidate: {
      id: buildPrivateChatCandidateId(conversationId, requestMessage.id),
      title,
      notes:
        requestedItems.length > 1
          ? `从私聊上下文识别，确认后才会创建正式安排。物品：${requestedItems.join("、")}。`
          : "从私聊上下文识别，确认后才会创建正式安排。",
      people: [identityName],
      place: "",
      timeMode: deadlineAt ? "deadline" : "none",
      deadlineAt,
      startAt: null,
      endAt: null,
      reminderAt: null,
      sourceType: "privateChat",
      sourceSummary: `私聊：${identityName} 请求${objective}`,
      rawContext: [`${identityName}：${requestText}`, `我：${replyText}`],
      confidence: deadlineAt ? "high" : "medium",
      status: "pending",
      createdAt,
      updatedAt: createdAt,
    },
  };
}

function extractRequestObjective(text: string) {
  if (!requestCuePattern.test(text)) return null;

  const withoutTime = removeTimeExpressions(text)
    .replace(/[。.!！?？]+$/g, "")
    .trim();

  const cue = findRequestCue(withoutTime);
  if (!cue) return null;

  const beforeCue = cleanupRequestFragment(withoutTime.slice(0, cue.index));
  const leadingObjective = extractLeadingObjective(beforeCue);
  const leadingObject = leadingObjective ? "" : extractLeadingObject(beforeCue);
  const payload = cleanupRequestFragment(withoutTime.slice(cue.index + cue.value.length));
  const objective = attachLeadingObject(joinObjectiveFragments(leadingObjective, payload), leadingObject);

  if (!taskVerbPattern.test(objective) || objective.length < 2) return null;
  return objective;
}

function extractRequestedItems(objective: string) {
  const actionMatch = objective.match(taskVerbPattern);
  if (!actionMatch || actionMatch.index === undefined) return [];

  const itemText = objective.slice(actionMatch.index + actionMatch[0].length).trim();
  if (!/[、，,和及还有跟与\s]/.test(itemText)) return [];

  return itemText
    .split(/(?:、|，|,|和|及|还有|跟|与|\s+)/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function removeTimeExpressions(text: string) {
  return text
    .replace(/(今天|明天|后天)?\s*(早上|上午|中午|下午|晚上)?\s*\d{1,2}\s*[点點](半)?/g, "")
    .replace(/(今天|明天|后天)(早上|上午|中午|下午|晚上)?/g, "")
    .replace(/(早上|上午|中午|下午|晚上)/g, "")
    .trim();
}

function isAcceptanceReply(text: string) {
  const reply = text.trim();
  if (!reply || refusalPattern.test(reply)) return false;
  if (/[?？]/.test(reply) && !acceptanceStartPattern.test(reply) && !commitmentPattern.test(reply)) return false;
  return acceptanceStartPattern.test(reply) || commitmentPattern.test(reply);
}

type RequestCueMatch = { index: number; value: string };

function findRequestCue(text: string): RequestCueMatch | null {
  let found: { index: number; value: string } | null = null;
  requestCues.forEach((cue) => {
    const index = text.indexOf(cue);
    if (index < 0) return;
    if (!found || index < found.index || (index === found.index && cue.length > found.value.length)) {
      found = { index, value: cue };
    }
  });
  return found;
}

function cleanupRequestFragment(text: string) {
  return text
    .replace(/^(能不能|可不可以|可以|你能不能|你能|你可以|请你|请|麻烦你|麻烦|拜托你|拜托|帮忙)/g, "")
    .replace(/(帮我|替我|给我|帮忙)/g, "")
    .replace(/(可以吗|行吗|好吗|好么|可以不|吗|么|吧|呢|呀)$/g, "")
    .replace(/(一下子|一下)$/g, "")
    .replace(/^[，,。；;：:\s]+|[，,。；;：:\s]+$/g, "")
    .trim();
}

function extractLeadingObject(text: string) {
  const leadingObject = text
    .replace(/^(这个|那个|这些|那些|这|那)/g, "")
    .trim();

  if (!leadingObject || leadingObject.length > 12) return "";
  if (requestCuePattern.test(leadingObject) || taskVerbPattern.test(leadingObject)) return "";
  return leadingObject;
}

function extractLeadingObjective(text: string) {
  const normalized = text.replace(/^你/g, "").trim();
  if (!normalized || !taskVerbPattern.test(normalized)) return "";
  return normalized;
}

function joinObjectiveFragments(beforeCue: string, afterCue: string) {
  const first = beforeCue.trim();
  const second = afterCue.trim();
  if (!first) return second;
  if (!second) return first;
  return `${first}${second}`;
}

function attachLeadingObject(objective: string, leadingObject: string) {
  if (!leadingObject || objective.includes(leadingObject)) return objective;

  const matches = Array.from(objective.matchAll(taskVerbGlobalPattern));
  const lastVerb = matches.at(-1);
  if (!lastVerb || lastVerb.index === undefined) return objective;

  const insertAt = lastVerb.index + lastVerb[0].length;
  return `${objective.slice(0, insertAt)}${leadingObject}${objective.slice(insertAt)}`;
}

function getRelativeDayLabel(text: string) {
  const dayLabel = text.includes("后天")
    ? "后天"
    : text.includes("明天")
      ? "明天"
      : text.includes("今天")
        ? "今天"
        : "";
  if (!dayLabel) return "";

  const explicitHourMatch = text.match(/(\d{1,2})\s*[点點]/);
  const periodMatch = text.match(/(早上|上午|中午|下午|晚上)/);
  if (explicitHourMatch) {
    return `${dayLabel}${periodMatch?.[1] ?? ""}${Number(explicitHourMatch[1])}点`;
  }
  if (periodMatch) return `${dayLabel}${periodMatch[1]}`;
  return dayLabel;
}

function buildDeadlineAt(text: string, now: Date) {
  const dayOffset = getRelativeDayOffset(text);
  if (dayOffset === null) return null;

  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + dayOffset);
  deadline.setHours(inferBreakfastHour(text), 0, 0, 0);
  return deadline.toISOString();
}

function getRelativeDayOffset(text: string) {
  if (text.includes("后天")) return 2;
  if (text.includes("明天")) return 1;
  if (text.includes("今天")) return 0;
  return null;
}

function inferBreakfastHour(text: string) {
  const explicitHourMatch = text.match(/(\d{1,2})\s*[点點]/);
  if (explicitHourMatch) {
    const hour = Number(explicitHourMatch[1]);
    if ((text.includes("下午") || text.includes("晚上")) && hour < 12) return hour + 12;
    return hour;
  }

  if (text.includes("下午")) return 15;
  if (text.includes("晚上")) return 19;
  if (text.includes("中午")) return 12;
  if (text.includes("早上") || text.includes("上午")) return 9;
  return 9;
}

function toStableSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "message";
}
