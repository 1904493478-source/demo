import React from "react";
import type { Arrangement, ArrangementTimeMode } from "../types";

export type ArrangementEditorDraft = {
  title: string;
  notes: string;
  people: string[];
  place: string;
  timeMode: ArrangementTimeMode;
  deadlineAt: string | null;
  startAt: string | null;
  endAt: string | null;
  reminderAt: string | null;
};

type ArrangementEditorProps = {
  onCreate: (draft: ArrangementEditorDraft) => void;
  onUpdate?: (id: string, draft: ArrangementEditorDraft) => void;
  onSubmitCandidate?: (draft: ArrangementEditorDraft) => void;
  onCancelEdit?: () => void;
  onDelete?: (id: string) => void;
  editingArrangement?: Arrangement | null;
  candidateDraft?: ArrangementEditorDraft | null;
  titleInputRef?: React.Ref<HTMLInputElement>;
};

export function ArrangementEditor({
  onCreate,
  onUpdate,
  onSubmitCandidate,
  onCancelEdit,
  onDelete,
  editingArrangement,
  candidateDraft,
  titleInputRef,
}: ArrangementEditorProps) {
  const isEditing = Boolean(editingArrangement);
  const isEditingCandidate = Boolean(candidateDraft);
  const defaultNowValue = getDefaultDateTimeLocalValue();
  const [timeMode, setTimeMode] = React.useState<ArrangementTimeMode>(
    editingArrangement?.timeMode ?? candidateDraft?.timeMode ?? "deadline"
  );

  React.useEffect(() => {
    if (typeof titleInputRef === "function") return;
    titleInputRef?.current?.focus();
  }, [titleInputRef]);

  return (
    <form
      key={editingArrangement?.id ?? "new-arrangement"}
      aria-label={isEditingCandidate ? "编辑候选安排" : isEditing ? "编辑安排" : "创建安排"}
      className="rounded-[12px] border border-border bg-surface px-3 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const title = getFormValue(formData, "title").trim();
        if (!title) return;

        const draft = buildDraft(formData, title);
        if (isEditingCandidate && onSubmitCandidate) {
          onSubmitCandidate(draft);
          return;
        }

        if (editingArrangement && onUpdate) {
          onUpdate(editingArrangement.id, draft);
          return;
        }

        onCreate(draft);
        form.reset();
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-5 text-text">
            {isEditingCandidate ? "编辑候选" : isEditing ? "编辑安排" : "手动创建"}
          </h2>
          <p className="mt-1 text-xs leading-4 text-text-tertiary">
            {isEditingCandidate
              ? "先确认 AI 提取的内容，再把它变成正式安排。"
              : isEditing
              ? "调整时间、地点或细节，仍然只更新这一条安排。"
              : "AI 看不懂的暗号，也可以自己安静记下来。"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isEditing ? (
            <button
              type="button"
              data-testid="arrangement-editor-cancel"
              className="rounded-[10px] border border-border bg-surface px-3 py-2 text-sm font-semibold leading-5 text-text-muted transition duration-150 hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
              onClick={onCancelEdit}
            >
              取消
            </button>
          ) : null}

          <button
            type="submit"
            data-testid={
              isEditingCandidate
                ? "arrangement-editor-submit-candidate"
                : isEditing
                  ? "arrangement-editor-submit-update"
                  : "arrangement-editor-submit-create"
            }
            className="rounded-[10px] bg-primary px-3 py-2 text-sm font-semibold leading-5 text-on-primary transition duration-150 focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
          >
            {isEditingCandidate ? "确认保存" : isEditing ? "更新安排" : "保存安排"}
          </button>
        </div>
      </div>

      <div data-testid="arrangement-editor-fields" className="mt-3 grid grid-cols-1 gap-3">
        <ArrangementField
          id="arrangement-title"
          name="title"
          label="标题"
          placeholder="例如：后天去医院"
          inputRef={titleInputRef}
          defaultValue={editingArrangement?.title ?? candidateDraft?.title ?? ""}
        />
        <ArrangementField
          id="arrangement-people"
          name="people"
          label="相关人"
          placeholder="爸爸、同事"
          defaultValue={editingArrangement?.people.join("、") ?? candidateDraft?.people.join("、") ?? ""}
        />
        <ArrangementField
          id="arrangement-place"
          name="place"
          label="地点"
          placeholder="医院、公司"
          defaultValue={editingArrangement?.place ?? candidateDraft?.place ?? ""}
        />

        <label className="block">
          <span className="text-xs font-medium leading-5 text-text-muted">时间类型</span>
          <select
            id="arrangement-time-mode"
            name="timeMode"
            aria-label="时间类型"
            className="mt-1 h-10 w-full rounded-[10px] border border-border bg-input-bg px-3 text-sm text-text outline-none transition duration-150 focus:border-input-border-focus focus:shadow-focus"
            value={timeMode}
            onChange={(event) => setTimeMode(event.target.value as ArrangementTimeMode)}
          >
            <option value="none">暂不设置</option>
            <option value="deadline">截止时间</option>
            <option value="range">时间段</option>
          </select>
        </label>

        {timeMode === "deadline" ? (
          <div data-testid="arrangement-time-fields-deadline">
            <ArrangementField
              id="arrangement-deadline"
              name="deadlineAt"
              label="截止时间"
              type="datetime-local"
              defaultValue={
                editingArrangement?.deadlineAt
                  ? formatDateTimeLocalValue(editingArrangement.deadlineAt)
                  : candidateDraft?.deadlineAt
                    ? formatDateTimeLocalValue(candidateDraft.deadlineAt)
                  : defaultNowValue
              }
            />
          </div>
        ) : null}
        {timeMode === "range" ? (
          <div data-testid="arrangement-time-fields-range" className="grid grid-cols-1 gap-3">
            <ArrangementField
              id="arrangement-start"
              name="startAt"
              label="开始时间"
              type="datetime-local"
              defaultValue={
                editingArrangement?.startAt
                  ? formatDateTimeLocalValue(editingArrangement.startAt)
                  : candidateDraft?.startAt
                    ? formatDateTimeLocalValue(candidateDraft.startAt)
                  : defaultNowValue
              }
            />
            <ArrangementField
              id="arrangement-end"
              name="endAt"
              label="结束时间"
              type="datetime-local"
              defaultValue={
                editingArrangement?.endAt
                  ? formatDateTimeLocalValue(editingArrangement.endAt)
                  : candidateDraft?.endAt
                    ? formatDateTimeLocalValue(candidateDraft.endAt)
                  : defaultNowValue
              }
            />
          </div>
        ) : null}
        {timeMode === "none" ? (
          <p
            data-testid="arrangement-time-none-note"
            className="rounded-[10px] bg-surface-muted px-3 py-2 text-xs leading-5 text-text-tertiary"
          >
            暂时不放进日历，之后可以再补时间。
          </p>
        ) : null}
        <ArrangementField
          id="arrangement-reminder"
          name="reminderAt"
          label="提醒时间"
          type="datetime-local"
          defaultValue={
            editingArrangement?.reminderAt
              ? formatDateTimeLocalValue(editingArrangement.reminderAt)
              : candidateDraft?.reminderAt
                ? formatDateTimeLocalValue(candidateDraft.reminderAt)
              : defaultNowValue
          }
        />
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-medium leading-5 text-text-muted">备注</span>
        <textarea
          id="arrangement-notes"
          name="notes"
          aria-label="备注"
          className="mt-1 min-h-[84px] w-full resize-none rounded-[10px] border border-border bg-input-bg px-3 py-2 text-sm leading-5 text-text outline-none transition duration-150 placeholder:text-input-placeholder focus:border-input-border-focus focus:shadow-focus"
          placeholder="补充背景、原始对话或你希望自己记得的细节"
          defaultValue={editingArrangement?.notes ?? candidateDraft?.notes ?? ""}
        />
      </label>

      {isEditing && editingArrangement && onDelete ? (
        <button
          type="button"
          data-testid="arrangement-editor-delete"
          className="mt-4 w-full rounded-[10px] border border-[color:var(--danger)] px-3 py-2 text-sm font-semibold leading-5 text-[color:var(--danger)] transition duration-200 hover:bg-[color:rgba(244,99,99,0.08)] focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
          onClick={() => onDelete(editingArrangement.id)}
        >
          删除安排
        </button>
      ) : null}
    </form>
  );
}

function buildDraft(formData: FormData, title: string): ArrangementEditorDraft {
  const timeMode = parseTimeMode(getFormValue(formData, "timeMode"));

  return {
    title,
    notes: getFormValue(formData, "notes").trim(),
    people: splitPeople(getFormValue(formData, "people")),
    place: getFormValue(formData, "place").trim(),
    timeMode,
    deadlineAt:
      timeMode === "deadline" ? normalizeDateTimeLocal(getFormValue(formData, "deadlineAt")) : null,
    startAt:
      timeMode === "range" ? normalizeDateTimeLocal(getFormValue(formData, "startAt")) : null,
    endAt: timeMode === "range" ? normalizeDateTimeLocal(getFormValue(formData, "endAt")) : null,
    reminderAt: normalizeDateTimeLocal(getFormValue(formData, "reminderAt")),
  };
}

function ArrangementField({
  id,
  name,
  label,
  placeholder,
  inputRef,
  defaultValue,
  type = "text",
}: {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs font-medium leading-5 text-text-muted">{label}</span>
      <input
        id={id}
        name={name}
        ref={inputRef}
        aria-label={label}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 h-10 w-full rounded-[10px] border border-border bg-input-bg px-3 text-sm text-text outline-none transition duration-150 placeholder:text-input-placeholder focus:border-input-border-focus focus:shadow-focus"
      />
    </label>
  );
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseTimeMode(value: string): ArrangementTimeMode {
  if (value === "none" || value === "range") return value;
  return "deadline";
}

function splitPeople(value: string) {
  return value
    .split(/[、，,]/)
    .map((person) => person.trim())
    .filter(Boolean);
}

function normalizeDateTimeLocal(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function formatDateTimeLocalValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

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

function getDefaultDateTimeLocalValue(now: Date = new Date()) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    now.getFullYear(),
    "-",
    pad(now.getMonth() + 1),
    "-",
    pad(now.getDate()),
    "T",
    pad(now.getHours()),
    ":",
    pad(now.getMinutes()),
  ].join("");
}
