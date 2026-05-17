import { useState } from "react";
import type {
  Arrangement,
  ArrangementAiAssistAction,
  ArrangementExecutionCapability,
} from "../types";
import type { AiAssistDraftResult } from "../data/aiArrangementClient";
import { generateArrangementAssistDraft } from "../data/aiArrangementClient";
import { loadAiSettings } from "../data/aiSettingsStore";

type ArrangementDetailProps = {
  arrangement: Arrangement;
  onComplete: (id: string) => void;
  onConfirm?: (id: string) => void;
  onPostpone: (id: string) => void;
  onEdit: (id: string) => void;
  onDismissCompletionSuggestion?: (id: string) => void;
};

export function ArrangementDetail({
  arrangement,
  onComplete,
  onConfirm,
  onPostpone,
  onEdit,
  onDismissCompletionSuggestion,
}: ArrangementDetailProps) {
  const isMaybeCompleted = arrangement.status === "maybeCompleted";
  const isAiConfirmedArrangement = arrangement.id.startsWith("arr_ai_");
  const primaryActionLabel = isMaybeCompleted
    ? "确认完成"
    : isAiConfirmedArrangement
      ? "确认安排"
      : "完成安排";
  const primaryActionTestId = isAiConfirmedArrangement
    ? "arrangement-detail-confirm"
    : "arrangement-detail-complete";

  return (
    <section className="px-1 pb-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium leading-4 text-primary">安排详情</p>
          <h2 className="mt-1 text-[16px] font-semibold leading-6 text-text">
            {arrangement.title}
          </h2>
        </div>
      </div>

      <dl className="mt-3 space-y-2 text-sm leading-5">
        <DetailRow label="相关人" value={arrangement.people.join("、") || "无"} />
        <DetailRow label="地点" value={arrangement.place || "未设置"} />
        <DetailRow label="时间" value={formatDetailTime(arrangement)} />
        <DetailRow label="提醒" value={arrangement.reminderAt ? "已设置" : "未设置"} />
      </dl>

      <p className="mt-3 whitespace-pre-line rounded-[10px] bg-surface-subtle px-3 py-2 text-xs leading-5 text-text-muted">
        {arrangement.notes || "还没有补充说明。"}
      </p>

      <ExecutionCapabilityPanel arrangement={arrangement} />

      <div className="mt-3 grid grid-cols-1 gap-2">
        <button
          type="button"
          data-testid={primaryActionTestId}
          className="rounded-[10px] bg-primary px-3 py-2 text-sm font-semibold leading-5 text-on-primary transition duration-150 focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
          onClick={() =>
            isAiConfirmedArrangement && onConfirm
              ? onConfirm(arrangement.id)
              : onComplete(arrangement.id)
          }
          aria-label={primaryActionLabel}
        >
          {primaryActionLabel}
        </button>
        {isMaybeCompleted && onDismissCompletionSuggestion ? (
          <button
            type="button"
            data-testid="arrangement-detail-dismiss-completion"
            className="rounded-[10px] border border-border bg-surface px-3 py-2 text-sm font-semibold leading-5 text-text transition duration-150 hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
            onClick={() => onDismissCompletionSuggestion(arrangement.id)}
            aria-label="还没完"
          >
            还没完
          </button>
        ) : null}
        <button
          type="button"
          data-testid="arrangement-detail-postpone"
          className="rounded-[10px] border border-border bg-surface px-3 py-2 text-sm font-semibold leading-5 text-text transition duration-150 hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
          onClick={() => onPostpone(arrangement.id)}
          aria-label="以后再说"
        >
          以后再说
        </button>
        <button
          type="button"
          data-testid="arrangement-detail-edit"
          className="rounded-[10px] border border-border bg-surface px-3 py-2 text-sm font-semibold leading-5 text-text-muted transition duration-150 hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
          onClick={() => onEdit(arrangement.id)}
          aria-label="编辑安排"
        >
          编辑安排
        </button>
      </div>
    </section>
  );
}

function ExecutionCapabilityPanel({ arrangement }: { arrangement: Arrangement }) {
  const capability = arrangement.executionCapability ?? inferExecutionCapability(arrangement);
  const assistActions =
    arrangement.aiAssistActions && arrangement.aiAssistActions.length > 0
      ? arrangement.aiAssistActions
      : getDefaultAssistActions(arrangement);
  const [assistDraft, setAssistDraft] = useState<AiAssistDraftResult | null>(null);
  const [generatingAction, setGeneratingAction] = useState<ArrangementAiAssistAction | null>(null);

  async function handleGenerateAssistDraft(action: ArrangementAiAssistAction) {
    setGeneratingAction(action);
    setAssistDraft(null);
    try {
      const result = await generateArrangementAssistDraft({
        settings: loadAiSettings(),
        arrangement,
        action,
      });
      setAssistDraft(result);
    } finally {
      setGeneratingAction(null);
    }
  }

  return (
    <section
      data-testid="arrangement-execution-capability"
      className="mt-3 rounded-[12px] border border-border-light bg-surface px-3 py-2"
      aria-label="AI 执行能力"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold leading-4 text-text">
          {executionCapabilityLabels[capability]}
        </p>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] leading-4 text-text-tertiary">
          AI 执行分层
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-text-muted">
        {executionCapabilityDescriptions[capability]}
      </p>
      {capability === "aiAssist" ? (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {assistActions.map((action) => (
              <button
                key={action}
                type="button"
                className="rounded-full bg-[color:rgba(34,197,94,0.08)] px-2 py-1 text-[11px] font-medium leading-4 text-[color:rgb(22,101,52)] transition duration-150 hover:bg-[color:rgba(34,197,94,0.14)] focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
                onClick={() => void handleGenerateAssistDraft(action)}
                disabled={generatingAction !== null}
                aria-label={aiAssistActionLabels[action]}
              >
                {generatingAction === action ? "生成中" : aiAssistActionLabels[action]}
              </button>
            ))}
          </div>
          {assistDraft || generatingAction ? (
            <div
              data-testid="arrangement-ai-assist-result"
              className="mt-2 rounded-[10px] border border-[color:rgba(34,197,94,0.18)] bg-[color:rgba(34,197,94,0.06)] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold leading-4 text-[color:rgb(22,101,52)]">
                  {assistDraft?.title ?? aiAssistActionLabels[generatingAction!]}
                </p>
                <span className="text-[11px] leading-4 text-text-tertiary">
                  {assistDraft
                    ? assistDraft.source === "ai"
                      ? "AI"
                      : "本地"
                    : "生成中"}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-xs leading-5 text-text-muted">
                {assistDraft?.content ?? "正在生成草稿。网络较慢时会自动使用本地模板兜底。"}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
                只生成草稿，不会自动执行
              </p>
            </div>
          ) : null}
        </>
      ) : null}
      {capability === "aiAuto" ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px] leading-4 text-text-muted">
          <span className="rounded-[8px] bg-surface-muted px-1.5 py-1">需要授权</span>
          <span className="rounded-[8px] bg-surface-muted px-1.5 py-1">执行前确认</span>
          <span className="rounded-[8px] bg-surface-muted px-1.5 py-1">可回滚记录</span>
        </div>
      ) : null}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-2">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="min-w-0 text-text">{value}</dd>
    </div>
  );
}

const executionCapabilityLabels: Record<ArrangementExecutionCapability, string> = {
  userOnly: "只能用户完成",
  aiAssist: "AI 可辅助",
  aiAuto: "AI 可自动执行",
};

const executionCapabilityDescriptions: Record<ArrangementExecutionCapability, string> = {
  userOnly: "需要你实际处理或亲自确认，AI 不会替你完成。",
  aiAssist: "AI 可以先帮你准备，但最终动作仍由你决定。",
  aiAuto: "自动执行必须先获得权限，并在执行前确认，保留可回滚记录。",
};

const aiAssistActionLabels: Record<ArrangementAiAssistAction, string> = {
  prepareMaterials: "准备材料",
  draftReply: "草拟回复",
  generateRoute: "生成路线",
};

function inferExecutionCapability(arrangement: Arrangement): ArrangementExecutionCapability {
  const text = [arrangement.title, arrangement.notes, arrangement.place].join(" ");
  if (/回复|消息|邮件|文案|通知/.test(text)) return "aiAssist";
  if (/路线|导航|地址|医院|公司|学校|机场|车站/.test(text)) return "aiAssist";
  return "userOnly";
}

function getDefaultAssistActions(arrangement: Arrangement): ArrangementAiAssistAction[] {
  const text = [arrangement.title, arrangement.notes, arrangement.place].join(" ");
  const actions: ArrangementAiAssistAction[] = [];
  if (/资料|材料|文件|报告|证件|医院|体检|复诊/.test(text)) {
    actions.push("prepareMaterials");
  }
  if (/回复|消息|邮件|文案|通知|确认/.test(text)) {
    actions.push("draftReply");
  }
  if (/去|路线|导航|地址|医院|公司|学校|机场|车站/.test(text)) {
    actions.push("generateRoute");
  }
  return actions.length > 0 ? actions : ["prepareMaterials"];
}

function formatDetailTime(arrangement: Arrangement) {
  if (arrangement.deadlineAt) return `截止 ${formatDateTime(arrangement.deadlineAt)}`;
  if (arrangement.startAt && arrangement.endAt) {
    return `${formatDateTime(arrangement.startAt)} - ${formatDateTime(arrangement.endAt)}`;
  }
  if (arrangement.startAt) return `开始 ${formatDateTime(arrangement.startAt)}`;
  return "未设置";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
