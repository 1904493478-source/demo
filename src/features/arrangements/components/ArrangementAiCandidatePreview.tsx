import type { AiArrangementCandidate } from "../types";

type ArrangementAiCandidatePreviewProps = {
  candidates: AiArrangementCandidate[];
  onConfirm: (id: string) => void;
  onEdit: (id: string) => void;
  onDismiss: (id: string) => void;
};

const sourceLabels: Record<AiArrangementCandidate["sourceType"], string> = {
  selfMessage: "发给自己",
  privateChat: "私聊",
  groupChat: "群聊",
};

const confidenceLabels: Record<AiArrangementCandidate["confidence"], string> = {
  high: "信息较完整",
  medium: "需要看一眼",
  low: "可能需要补充",
};

export function ArrangementAiCandidatePreview({
  candidates,
  onConfirm,
  onEdit,
  onDismiss,
}: ArrangementAiCandidatePreviewProps) {
  const pendingCandidates = candidates.filter((candidate) => candidate.status === "pending");

  if (pendingCandidates.length === 0) return null;

  return (
    <section
      aria-label="AI 候选安排"
      className="rounded-[12px] border border-border bg-surface px-3 py-3"
      data-testid="ai-candidate-preview"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-5 text-text">AI 候选安排</h2>
          <p className="mt-1 text-xs leading-5 text-text-tertiary">
            先预览，再确认。AI 不会直接替你创建正式安排。
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-muted px-2 py-1 text-xs leading-4 text-text-muted">
          {pendingCandidates.length}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {pendingCandidates.map((candidate) => (
          <article
            key={candidate.id}
            data-testid={`ai-candidate-card-${candidate.id}`}
            className="rounded-[10px] border border-border-light bg-surface-muted px-3 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] leading-4 text-text-muted">
                    {sourceLabels[candidate.sourceType]}
                  </span>
                  <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] leading-4 text-text-tertiary">
                    {confidenceLabels[candidate.confidence]}
                  </span>
                  {getCandidateSources(candidate).length > 1 && (
                    <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] leading-4 text-text-tertiary">
                      {getCandidateSources(candidate).length} 个来源
                    </span>
                  )}
                  {candidate.timeConflict && (
                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] leading-4 text-warning">
                      时间有出入
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-[15px] font-semibold leading-5 text-text">
                  {candidate.title}
                </h3>
              </div>
            </div>

            <dl className="mt-2 grid grid-cols-1 gap-1 text-xs leading-5 text-text-tertiary">
              <CandidateDetail label="时间" value={formatCandidateTime(candidate)} testId="ai-candidate-time" />
              <CandidateDetail label="人" value={candidate.people.join("、") || "未提取"} />
              <CandidateDetail label="地点" value={candidate.place || "未提取"} />
              <CandidateDetail label="来源" value={candidate.sourceSummary} />
            </dl>

            <CandidateSources candidate={candidate} />

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                data-testid={`ai-candidate-dismiss-${candidate.id}`}
                className="rounded-[10px] border border-border bg-surface px-3 py-2 text-sm font-semibold leading-5 text-text-muted transition duration-150 hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
                onClick={() => onDismiss(candidate.id)}
              >
                忽略
              </button>
              <button
                type="button"
                data-testid={`ai-candidate-edit-${candidate.id}`}
                className="rounded-[10px] border border-border bg-surface px-3 py-2 text-sm font-semibold leading-5 text-text-muted transition duration-150 hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
                onClick={() => onEdit(candidate.id)}
              >
                {needsTimeCompletion(candidate) ? "补时间" : "编辑"}
              </button>
              <button
                type="button"
                data-testid={`ai-candidate-confirm-${candidate.id}`}
                className="rounded-[10px] bg-primary px-3 py-2 text-sm font-semibold leading-5 text-on-primary transition duration-150 focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
                onClick={() => onConfirm(candidate.id)}
              >
                确认
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CandidateSources({ candidate }: { candidate: AiArrangementCandidate }) {
  const sources = getCandidateSources(candidate);
  if (sources.length <= 1) return null;

  return (
    <div className="mt-3 rounded-[10px] border border-border-light bg-bg/70 px-2.5 py-2">
      <p className="text-[11px] font-semibold leading-4 text-text-muted">来源上下文</p>
      <div className="mt-2 space-y-2">
        {sources.map((source) => (
          <div key={source.id} className="border-t border-border-light pt-2 first:border-t-0 first:pt-0">
            <p className="text-xs font-medium leading-5 text-text-muted">
              {source.sourceSummary}
            </p>
            <p className="text-[11px] leading-4 text-text-tertiary">
              {getSourcePerson(source.sourceSummary)} · {confidenceLabels[source.confidence]}
            </p>
            <div className="mt-1 space-y-0.5">
              {source.rawContext.map((context) => (
                <p key={context} className="break-words text-[11px] leading-4 text-text-tertiary">
                  {context}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidateDetail({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-2">
      <dt className="text-text-tertiary">{label}</dt>
      <dd data-testid={testId} className="min-w-0 break-words text-text-muted">
        {value}
      </dd>
    </div>
  );
}

function formatCandidateTime(candidate: AiArrangementCandidate) {
  if (candidate.deadlineAt) return `截止 ${formatDateTime(candidate.deadlineAt)}`;
  if (candidate.startAt && candidate.endAt) {
    return `${formatDateTime(candidate.startAt)} - ${formatDateTime(candidate.endAt)}`;
  }
  if (candidate.startAt) return `开始 ${formatDateTime(candidate.startAt)}`;
  return "待补时间";
}

function needsTimeCompletion(candidate: AiArrangementCandidate) {
  return !candidate.deadlineAt && !candidate.startAt && !candidate.endAt;
}

function getCandidateSources(candidate: AiArrangementCandidate) {
  return candidate.relatedSources && candidate.relatedSources.length > 0
    ? candidate.relatedSources
    : [
        {
          id: candidate.id,
          sourceType: candidate.sourceType,
          sourceSummary: candidate.sourceSummary,
          rawContext: candidate.rawContext,
          confidence: candidate.confidence,
          timeMode: candidate.timeMode,
          deadlineAt: candidate.deadlineAt,
          startAt: candidate.startAt,
          endAt: candidate.endAt,
          createdAt: candidate.createdAt,
        },
      ];
}

function getSourcePerson(sourceSummary: string) {
  const privateMatch = sourceSummary.match(/私聊：(.+?)\s/);
  if (privateMatch) return privateMatch[1];
  const groupMatch = sourceSummary.match(/群聊：.+?\/\s*(.+?)\s/);
  if (groupMatch) return groupMatch[1];
  if (sourceSummary.includes("发给自己")) return "自己";
  return "来源";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
