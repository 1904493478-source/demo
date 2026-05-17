import type { ChatRecognitionMessage, PrivateChatRecognitionResult } from "./privateChatRecognition";
import { recognizePrivateChatArrangement } from "./privateChatRecognition";

export type GroupChatRecognitionInput = {
  conversationId: string;
  groupName: string;
  identityName: string;
  currentUserName: string;
  requestMessage: ChatRecognitionMessage;
  replyMessage: ChatRecognitionMessage;
  now?: Date;
};

export function buildGroupChatCandidateId(conversationId: string, requestMessageId: string) {
  return `cand_group_${toStableSegment(conversationId)}_${toStableSegment(requestMessageId)}`;
}

export function recognizeGroupChatArrangement({
  conversationId,
  groupName,
  identityName,
  currentUserName,
  requestMessage,
  replyMessage,
  now = new Date(),
}: GroupChatRecognitionInput): PrivateChatRecognitionResult | null {
  const requestText = requestMessage.text.trim();
  const targetsCurrentUser = isRequestForCurrentUser(requestText, currentUserName);
  if (!targetsCurrentUser && !isLowConfidenceGroupRequest(requestText, replyMessage.text)) {
    return null;
  }

  const cleanedRequestMessage = {
    ...requestMessage,
    text: targetsCurrentUser
      ? removeCurrentUserMention(requestText, currentUserName)
      : normalizeGroupRequestForPrivateRecognizer(requestText),
  };
  const recognition = recognizePrivateChatArrangement({
    conversationId,
    identityName,
    requestMessage: cleanedRequestMessage,
    replyMessage,
    now,
  });
  if (!recognition) return null;

  return {
    recognizedMessageId: requestMessage.id,
    candidate: {
      ...recognition.candidate,
      id: buildGroupChatCandidateId(conversationId, requestMessage.id),
      notes: rewriteContextLabel(recognition.candidate.notes),
      sourceType: "groupChat",
      sourceSummary: recognition.candidate.sourceSummary
        .replace(/^私聊：/, `群聊：${groupName} / `)
        .replace(" 请求", targetsCurrentUser ? " 请求" : " 低置信请求"),
      rawContext: [`${groupName} / ${identityName}：${requestText}`, `我：${replyMessage.text.trim()}`],
      confidence: targetsCurrentUser ? recognition.candidate.confidence : "low",
    },
  };
}

function isRequestForCurrentUser(text: string, currentUserName: string) {
  const normalizedName = getCurrentUserMentionName(currentUserName);
  if (!normalizedName) return false;
  return text.includes(`@${normalizedName}`);
}

function removeCurrentUserMention(text: string, currentUserName: string) {
  return text
    .replace(new RegExp(`@${escapeRegExp(getCurrentUserMentionName(currentUserName))}\\s*`, "g"), "")
    .trim();
}

function isLowConfidenceGroupRequest(requestText: string, replyText: string) {
  return (
    /(谁可以|谁能|有没有人|有人可以|哪位|哪位可以|谁有空)/.test(requestText) &&
    /(我.*(去|拿|取|买|带|做|办|处理|送|交|提交)|交给我|我来|我可以|可以，我|没问题，我)/.test(
      replyText.trim()
    )
  );
}

function normalizeGroupRequestForPrivateRecognizer(text: string) {
  return text
    .replace(/(谁可以|谁能|有没有人|有人可以|哪位可以|哪位|谁有空)/g, "可以")
    .replace(/[？?]+$/g, "")
    .trim();
}

function getCurrentUserMentionName(currentUserName: string) {
  return currentUserName.trim() || "李小溪";
}

function rewriteContextLabel(notes: string) {
  return notes.replace("从私聊上下文识别", "从群聊上下文识别");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toStableSegment(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "message"
  );
}
