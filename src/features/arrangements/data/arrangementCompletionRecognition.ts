import type { AiArrangementConfidence, Arrangement } from "../types";

export type ArrangementCompletionRecognitionInput = {
  arrangements: Arrangement[];
  messageText: string;
};

export type ArrangementCompletionRecognitionResult = {
  arrangementId: string;
  confidence: AiArrangementConfidence;
  evidence: string;
};

const completionPattern =
  /(已经|已|刚刚|刚|上午|下午|晚上|今天).*(去了|去过|体检了|复诊了|拿到|拿到了|拿回|拿回了|拿回来了|取到|取了|取回|取回了|取回来了|带回|带回了|带回来了|买好|买好了|办完|办好了|完成|弄完|处理完|送到|交了|提交了)/;
const negativePattern =
  /(还没|没去|没有去|没拿|没有拿|没买|没有买|没完成|没有完成|没办|没有办|改天|下次|再说|取消)/;

export function recognizeArrangementCompletion({
  arrangements,
  messageText,
}: ArrangementCompletionRecognitionInput): ArrangementCompletionRecognitionResult | null {
  const evidence = messageText.trim();
  if (!evidence || negativePattern.test(evidence) || !completionPattern.test(evidence)) {
    return null;
  }

  const target = arrangements.find(
    (arrangement) =>
      isCompletionEligible(arrangement) && getArrangementKeywords(arrangement).some((keyword) =>
        evidence.includes(keyword)
      )
  );

  if (!target) return null;

  return {
    arrangementId: target.id,
    confidence: target.place && evidence.includes(target.place) ? "high" : "medium",
    evidence,
  };
}

function isCompletionEligible(arrangement: Arrangement) {
  return !["completed", "maybeCompleted", "someday"].includes(arrangement.status);
}

function getArrangementKeywords(arrangement: Arrangement) {
  return uniqueStrings([
    ...getTopicKeywords([arrangement.title, arrangement.notes, arrangement.place].join(" ")),
    ...splitMeaningfulWords(arrangement.title),
    ...splitMeaningfulWords(arrangement.place),
    ...arrangement.people.flatMap(splitMeaningfulWords),
  ]).filter((keyword) => keyword.length >= 2);
}

function getTopicKeywords(text: string) {
  const keywords: string[] = [];
  if (/医院|体检|复诊|挂号/.test(text)) keywords.push("医院", "体检", "复诊");
  if (/资料|文件|报告/.test(text)) keywords.push("资料", "文件", "报告");
  if (/早餐|豆浆|包子|咖啡/.test(text)) keywords.push("早餐", "豆浆", "包子", "咖啡");
  return keywords;
}

function splitMeaningfulWords(text: string) {
  return text
    .replace(/(今天|明天|后天|上午|下午|晚上|早上|中午|\d{1,2}点|帮|我|去|给|和|的)/g, " ")
    .split(/[\s、，,。.!！?？：:；;]+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}
