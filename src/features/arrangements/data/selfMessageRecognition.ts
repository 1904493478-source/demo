import type { AiArrangementCandidate } from "../types";

const actionPattern = /(去|拿|取|买|带|做|办|预约|联系|回|交|发|看|整理|补|还)/;
const symbolicOnlyPattern = /^[\s~～。！？!?.,，、…-]+$/;

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
  ["拿", "na"],
  ["报", "bao"],
  ["告", "gao"],
  ["公", "gong"],
  ["司", "si"],
  ["资", "zi"],
  ["料", "liao"],
  ["带", "dai"],
  ["早", "zao"],
  ["餐", "can"],
  ["回", "hui"],
  ["电", "dian"],
  ["话", "hua"],
]);

export function recognizeSelfMessageArrangement(
  message: string,
  now: Date = new Date()
): AiArrangementCandidate | null {
  const normalizedMessage = message.trim().replace(/\s+/g, " ");

  if (
    normalizedMessage.length < 2 ||
    symbolicOnlyPattern.test(normalizedMessage) ||
    !actionPattern.test(normalizedMessage)
  ) {
    return null;
  }

  const createdAt = now.toISOString();
  const deadlineAt = parseRelativeDeadline(normalizedMessage, now);
  const hasRelativeTime = Boolean(deadlineAt);

  return {
    id: `cand_self_${toStableSlug(normalizedMessage)}`,
    title: normalizedMessage,
    notes: hasRelativeTime
      ? "从发给自己的消息识别，确认后才会创建正式安排。"
      : "识别到行动，但时间不完整；确认前可以先补充时间。",
    people: ["自己"],
    place: inferPlace(normalizedMessage),
    timeMode: hasRelativeTime ? "deadline" : "none",
    deadlineAt,
    startAt: null,
    endAt: null,
    reminderAt: null,
    sourceType: "selfMessage",
    sourceSummary: `发给自己：${normalizedMessage}`,
    rawContext: [normalizedMessage],
    confidence: hasRelativeTime ? "high" : "low",
    status: "pending",
    createdAt,
    updatedAt: createdAt,
  };
}

function parseRelativeDeadline(message: string, now: Date) {
  const dayOffset = getRelativeDayOffset(message);
  if (dayOffset === null) return null;

  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + dayOffset);
  deadline.setHours(inferHour(message), 0, 0, 0);
  return deadline.toISOString();
}

function getRelativeDayOffset(message: string) {
  if (message.includes("后天")) return 2;
  if (message.includes("明天")) return 1;
  if (message.includes("今天")) return 0;
  return null;
}

function inferHour(message: string) {
  const explicitHourMatch = message.match(/(\d{1,2})\s*[点點]/);
  if (explicitHourMatch) {
    const hour = Number(explicitHourMatch[1]);
    if (message.includes("下午") && hour < 12) return hour + 12;
    if (message.includes("晚上") && hour < 12) return hour + 12;
    return hour;
  }

  if (message.includes("下午")) return 15;
  if (message.includes("晚上")) return 19;
  if (message.includes("上午")) return 9;
  return 9;
}

function inferPlace(message: string) {
  if (message.includes("医院")) return "医院";
  if (message.includes("公司")) return "公司";
  if (message.includes("学校")) return "学校";
  if (message.includes("家")) return "家";
  return "";
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
