import React from "react";
import Modal from "@/components/ui/modal";
import { ArrangementAiCandidatePreview } from "./ArrangementAiCandidatePreview";
import { ArrangementAiSettings } from "./ArrangementAiSettings";
import { ArrangementBottomSheet } from "./ArrangementBottomSheet";
import { ArrangementCalendar } from "./ArrangementCalendar";
import { ArrangementDetail } from "./ArrangementDetail";
import { ArrangementEditor, type ArrangementEditorDraft } from "./ArrangementEditor";
import { ArrangementList } from "./ArrangementList";
import { ArrangementSelfMessageRecognizer } from "./ArrangementSelfMessageRecognizer";
import {
  recognizeSelfMessageArrangementWithAi,
} from "../data/aiArrangementClient";
import {
  isAiSettingsReady,
  loadAiSettings,
  saveAiSettings,
  type AiSettings,
} from "../data/aiSettingsStore";
import {
  acceptAiCandidate,
  aiCandidateStorageEvent,
  aiCandidateStorageKey,
  dismissAiCandidate,
  loadAiCandidates,
  upsertAiCandidate,
} from "../data/aiCandidateStore";
import { recognizeSelfMessageArrangement } from "../data/selfMessageRecognition";
import {
  deduplicateArrangements,
  hasStoredArrangements,
  loadArrangements,
  saveArrangements,
} from "../data/arrangementStore";
import {
  completeArrangement,
  deriveArrangementStatus,
  dismissArrangementCompletionSuggestion,
  postponeArrangement,
  reopenCompletedArrangement,
  restoreSomedayArrangement,
} from "../lib/arrangementState";
import type { Arrangement } from "../types";
import type { AiArrangementCandidate } from "../types";

type UndoSnapshot = {
  message: string;
  arrangements: Arrangement[];
};

const demoArrangements: Arrangement[] = [
  {
    id: "arr_hospital",
    title: "今天上午去医院体检",
    notes: "爸爸和姐姐都提醒过，详情里后续会保留多条原始对话上下文。",
    people: ["爸爸", "姐姐"],
    place: "市中心医院",
    timeMode: "deadline",
    deadlineAt: "2026-05-16T03:30:00.000Z",
    startAt: null,
    endAt: null,
    reminderAt: "2026-05-16T01:00:00.000Z",
    status: "timePassed",
    createdAt: "2026-05-15T10:00:00.000Z",
    updatedAt: "2026-05-16T04:00:00.000Z",
    completedAt: null,
    snoozedAt: null,
    previousTime: null,
  },
  {
    id: "arr_breakfast",
    title: "明天帮同事带早餐",
    notes: "豆浆和包子，路上顺手带就好。",
    people: ["同事"],
    place: "公司",
    timeMode: "deadline",
    deadlineAt: "2026-05-17T01:00:00.000Z",
    startAt: null,
    endAt: null,
    reminderAt: "2026-05-16T23:30:00.000Z",
    status: "active",
    createdAt: "2026-05-16T09:00:00.000Z",
    updatedAt: "2026-05-16T09:00:00.000Z",
    completedAt: null,
    snoozedAt: null,
    previousTime: null,
  },
  {
    id: "arr_call_mom",
    title: "给妈妈回电话",
    notes: "不急，想起来时认真聊一会儿。",
    people: ["妈妈"],
    place: "",
    timeMode: "none",
    deadlineAt: null,
    startAt: null,
    endAt: null,
    reminderAt: null,
    status: "noDate",
    createdAt: "2026-05-16T08:00:00.000Z",
    updatedAt: "2026-05-16T08:00:00.000Z",
    completedAt: null,
    snoozedAt: null,
    previousTime: null,
  },
  {
    id: "arr_old_photos",
    title: "整理旧照片",
    notes: "已经放进以后再说，不占据今天的注意力。",
    people: [],
    place: "家里",
    timeMode: "none",
    deadlineAt: null,
    startAt: null,
    endAt: null,
    reminderAt: null,
    status: "someday",
    createdAt: "2026-05-12T08:00:00.000Z",
    updatedAt: "2026-05-16T08:00:00.000Z",
    completedAt: null,
    snoozedAt: "2026-05-16T08:00:00.000Z",
    previousTime: {
      timeMode: "deadline",
      deadlineAt: "2026-05-15T12:00:00.000Z",
      startAt: null,
      endAt: null,
    },
  },
];

const arrangementsGuideSeenStorageKey = "arkme-demo.arrangementsGuideSeen";

function toEditorDraft(candidate: AiArrangementCandidate): ArrangementEditorDraft {
  return {
    title: candidate.title,
    notes: candidate.notes,
    people: candidate.people,
    place: candidate.place,
    timeMode: candidate.timeMode,
    deadlineAt: candidate.deadlineAt,
    startAt: candidate.startAt,
    endAt: candidate.endAt,
    reminderAt: candidate.reminderAt,
  };
}

function buildCandidateArrangementNotes(candidate: AiArrangementCandidate) {
  const sources = candidate.relatedSources && candidate.relatedSources.length > 0
    ? candidate.relatedSources
    : [
        {
          id: candidate.id,
          sourceSummary: candidate.sourceSummary,
          rawContext: candidate.rawContext,
        },
      ];

  return [
    candidate.notes,
    candidate.timeConflict ? "注意：多个来源提到的时间不一致，请确认。" : "",
    ...sources.map((source) => `来源：${source.sourceSummary}`),
    ...sources.flatMap((source) => source.rawContext.map((context) => `原文：${context}`)),
  ]
    .filter(Boolean)
    .join("\n");
}

export default function ArrangementsPage() {
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const lastTriggerRef = React.useRef<HTMLElement | null>(null);
  const undoTimerRef = React.useRef<number | null>(null);
  const [arrangements, setArrangements] = React.useState<Arrangement[]>(() => {
    const storedArrangements = loadArrangements();
    return hasStoredArrangements() ? storedArrangements : demoArrangements;
  });
  const [isCreateSheetOpen, setCreateSheetOpen] = React.useState(false);
  const [isAiSettingsSheetOpen, setAiSettingsSheetOpen] = React.useState(false);
  const [aiSettings, setAiSettings] = React.useState<AiSettings>(() => loadAiSettings());
  const [aiCandidates, setAiCandidates] = React.useState<AiArrangementCandidate[]>(() =>
    loadAiCandidates()
  );
  const [detailArrangementId, setDetailArrangementId] = React.useState<string | null>(null);
  const [editingArrangementId, setEditingArrangementId] = React.useState<string | null>(null);
  const [editingCandidateId, setEditingCandidateId] = React.useState<string | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = React.useState<string | null>(null);
  const [gestureResetSignal, setGestureResetSignal] = React.useState(0);
  const [undoSnapshot, setUndoSnapshot] = React.useState<UndoSnapshot | null>(null);
  const [isGuideOpen, setGuideOpen] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(arrangementsGuideSeenStorageKey) !== "true";
  });

  const detailArrangement =
    arrangements.find((arrangement) => arrangement.id === detailArrangementId) ?? null;
  const editingArrangement =
    arrangements.find((arrangement) => arrangement.id === editingArrangementId) ?? null;
  const editingCandidate =
    aiCandidates.find(
      (candidate) => candidate.id === editingCandidateId && candidate.status === "pending"
    ) ?? null;

  const persistArrangements = React.useCallback((nextArrangements: Arrangement[]) => {
    const uniqueArrangements = deduplicateArrangements(nextArrangements);
    setArrangements(uniqueArrangements);
    saveArrangements(uniqueArrangements);
  }, []);

  const resetGestureLayers = React.useCallback(() => {
    setGestureResetSignal((signal) => signal + 1);
  }, []);

  const registerUndo = React.useCallback((message: string, previousArrangements: Arrangement[]) => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }

    setUndoSnapshot({ message, arrangements: previousArrangements });
    undoTimerRef.current = window.setTimeout(() => {
      setUndoSnapshot(null);
      undoTimerRef.current = null;
    }, 5000);
  }, []);

  const undoLastAction = React.useCallback(() => {
    if (!undoSnapshot) return;

    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    persistArrangements(undoSnapshot.arrangements);
    setUndoSnapshot(null);
    setDetailArrangementId(null);
    setEditingArrangementId(null);
    setEditingCandidateId(null);
    setCreateSheetOpen(false);
    resetGestureLayers();
  }, [persistArrangements, resetGestureLayers, undoSnapshot]);

  React.useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshAiCandidates = () => {
      setAiCandidates(loadAiCandidates());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === aiCandidateStorageKey) {
        refreshAiCandidates();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(aiCandidateStorageEvent, refreshAiCandidates);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(aiCandidateStorageEvent, refreshAiCandidates);
    };
  }, []);

  const scrollToOverview = React.useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const closeGuide = React.useCallback(() => {
    window.localStorage.setItem(arrangementsGuideSeenStorageKey, "true");
    setGuideOpen(false);
  }, []);

  const openCreateSheet = React.useCallback(() => {
    lastTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resetGestureLayers();
    setAiSettingsSheetOpen(false);
    setEditingArrangementId(null);
    setDetailArrangementId(null);
    setEditingCandidateId(null);
    setCreateSheetOpen(true);
  }, [resetGestureLayers]);

  const openAiSettingsSheet = React.useCallback(() => {
    lastTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resetGestureLayers();
    setCreateSheetOpen(false);
    setEditingArrangementId(null);
    setDetailArrangementId(null);
    setEditingCandidateId(null);
    setAiSettingsSheetOpen(true);
  }, [resetGestureLayers]);

  const handleCreate = React.useCallback(
    (draft: ArrangementEditorDraft) => {
      const now = new Date().toISOString();
      const arrangement: Arrangement = {
        id: `arr_${Date.now().toString(36)}`,
        title: draft.title,
        notes: draft.notes,
        people: draft.people,
        place: draft.place,
        timeMode: draft.timeMode,
        deadlineAt: draft.deadlineAt,
        startAt: draft.startAt,
        endAt: draft.endAt,
        reminderAt: draft.reminderAt,
        status: "active",
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        snoozedAt: null,
        previousTime: null,
      };
      const arrangementWithStatus = {
        ...arrangement,
        status: deriveArrangementStatus(arrangement),
      };
      persistArrangements([arrangementWithStatus, ...arrangements]);
      setCreateSheetOpen(false);
      setDetailArrangementId(arrangementWithStatus.id);
      setEditingArrangementId(null);
    },
    [arrangements, persistArrangements]
  );

  const saveCandidateAsArrangement = React.useCallback(
    (candidate: AiArrangementCandidate, draft?: ArrangementEditorDraft) => {
      const now = new Date().toISOString();
      const arrangement: Arrangement = {
        id: `arr_ai_${candidate.id}`,
        title: draft?.title ?? candidate.title,
        notes: draft?.notes ?? buildCandidateArrangementNotes(candidate),
        people: draft?.people ?? candidate.people,
        place: draft?.place ?? candidate.place,
        timeMode: draft?.timeMode ?? candidate.timeMode,
        deadlineAt: draft?.deadlineAt ?? candidate.deadlineAt,
        startAt: draft?.startAt ?? candidate.startAt,
        endAt: draft?.endAt ?? candidate.endAt,
        reminderAt: draft?.reminderAt ?? candidate.reminderAt,
        status: "active",
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        snoozedAt: null,
        previousTime: null,
      };
      const arrangementWithStatus = {
        ...arrangement,
        status: deriveArrangementStatus(arrangement),
      };

      persistArrangements([arrangementWithStatus, ...arrangements]);
      setAiCandidates(acceptAiCandidate(candidate.id, now));
      setEditingCandidateId(null);
      setCreateSheetOpen(false);
      setAiSettingsSheetOpen(false);
      setDetailArrangementId(arrangementWithStatus.id);
    },
    [arrangements, persistArrangements]
  );

  const handleUpdate = React.useCallback(
    (id: string, draft: ArrangementEditorDraft) => {
      const updatedAt = new Date().toISOString();
      const nextArrangements = arrangements.map((arrangement) => {
        if (arrangement.id !== id) return arrangement;

        const updatedArrangement: Arrangement = {
          ...arrangement,
          title: draft.title,
          notes: draft.notes,
          people: draft.people,
          place: draft.place,
          timeMode: draft.timeMode,
          deadlineAt: draft.deadlineAt,
          startAt: draft.startAt,
          endAt: draft.endAt,
          reminderAt: draft.reminderAt,
          status: arrangement.status === "completed" ? "completed" : "active",
          updatedAt,
          snoozedAt: null,
          previousTime: null,
        };

        return {
          ...updatedArrangement,
          status: deriveArrangementStatus(updatedArrangement),
        };
      });

      persistArrangements(nextArrangements);
      setEditingArrangementId(null);
      setDetailArrangementId(id);
      setEditingCandidateId(null);
      setCreateSheetOpen(false);
    },
    [arrangements, persistArrangements]
  );

  const handleComplete = React.useCallback(
    (id: string) => {
      const completedAt = new Date().toISOString();
      registerUndo("已完成", arrangements);
      persistArrangements(
        arrangements.map((arrangement) =>
          arrangement.id === id ? completeArrangement(arrangement, completedAt) : arrangement
        )
      );
      resetGestureLayers();
      setDetailArrangementId(null);
      setEditingArrangementId(null);
    },
    [arrangements, persistArrangements, registerUndo, resetGestureLayers]
  );

  const handlePostpone = React.useCallback(
    (id: string) => {
      const snoozedAt = new Date().toISOString();
      registerUndo("已放到以后再说", arrangements);
      persistArrangements(
        arrangements.map((arrangement) =>
          arrangement.id === id ? postponeArrangement(arrangement, snoozedAt) : arrangement
        )
      );
      resetGestureLayers();
      setDetailArrangementId(null);
      setEditingArrangementId(null);
    },
    [arrangements, persistArrangements, registerUndo, resetGestureLayers]
  );

  const handleRestoreSomeday = React.useCallback(
    (id: string) => {
      const restoredAt = new Date().toISOString();
      registerUndo("已放回今天和近期", arrangements);
      persistArrangements(
        arrangements.map((arrangement) =>
          arrangement.id === id ? restoreSomedayArrangement(arrangement, restoredAt) : arrangement
        )
      );
      resetGestureLayers();
    },
    [arrangements, persistArrangements, registerUndo, resetGestureLayers]
  );

  const handleReopenCompleted = React.useCallback(
    (id: string) => {
      const reopenedAt = new Date().toISOString();
      registerUndo("已标记为还没完", arrangements);
      persistArrangements(
        arrangements.map((arrangement) =>
          arrangement.id === id ? reopenCompletedArrangement(arrangement, reopenedAt) : arrangement
        )
      );
      resetGestureLayers();
    },
    [arrangements, persistArrangements, registerUndo, resetGestureLayers]
  );

  const handleDismissCompletionSuggestion = React.useCallback(
    (id: string) => {
      const dismissedAt = new Date().toISOString();
      registerUndo("已标记为还没完", arrangements);
      persistArrangements(
        arrangements.map((arrangement) =>
          arrangement.id === id
            ? dismissArrangementCompletionSuggestion(arrangement, dismissedAt)
            : arrangement
        )
      );
      resetGestureLayers();
      setDetailArrangementId(null);
    },
    [arrangements, persistArrangements, registerUndo, resetGestureLayers]
  );

  const handleEdit = React.useCallback((id: string) => {
    lastTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resetGestureLayers();
    setAiSettingsSheetOpen(false);
    setDetailArrangementId(null);
    setCreateSheetOpen(false);
    setEditingCandidateId(null);
    setEditingArrangementId(id);
  }, [resetGestureLayers]);

  const handleAddDemoAiCandidate = React.useCallback(() => {
    const recognizedCandidate = recognizeSelfMessageArrangement("后天去一趟医院");
    if (!recognizedCandidate) return;
    const candidate: AiArrangementCandidate = {
      ...recognizedCandidate,
      id: "cand_self_hospital",
      notes: "AI 从发给自己的消息里提取，等待你确认。",
      sourceSummary: "用户发给自己：后天去一趟医院",
    };

    setAiCandidates(upsertAiCandidate(candidate));
    setCreateSheetOpen(false);
    setAiSettingsSheetOpen(false);
    setDetailArrangementId(null);
    setEditingArrangementId(null);
    setEditingCandidateId(null);
    resetGestureLayers();
  }, [resetGestureLayers]);

  const handleRecognizeSelfMessage = React.useCallback(
    async (message: string) => {
      let candidate: AiArrangementCandidate | null = null;

      try {
        candidate = await recognizeSelfMessageArrangementWithAi({
          settings: aiSettings,
          message,
        });
      } catch {
        candidate = null;
      }

      candidate = candidate ?? recognizeSelfMessageArrangement(message);
      if (!candidate) return false;

      setAiCandidates(upsertAiCandidate(candidate));
      setCreateSheetOpen(false);
      setAiSettingsSheetOpen(false);
      setDetailArrangementId(null);
      setEditingArrangementId(null);
      setEditingCandidateId(null);
      resetGestureLayers();
      return true;
    },
    [aiSettings, resetGestureLayers]
  );

  const handleConfirmCandidate = React.useCallback(
    (id: string) => {
      const candidate = aiCandidates.find(
        (currentCandidate) => currentCandidate.id === id && currentCandidate.status === "pending"
      );
      if (!candidate) return;

      saveCandidateAsArrangement(candidate);
    },
    [aiCandidates, saveCandidateAsArrangement]
  );

  const handleEditCandidate = React.useCallback(
    (id: string) => {
      lastTriggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      resetGestureLayers();
      setCreateSheetOpen(false);
      setAiSettingsSheetOpen(false);
      setDetailArrangementId(null);
      setEditingArrangementId(null);
      setEditingCandidateId(id);
    },
    [resetGestureLayers]
  );

  const handleSubmitCandidate = React.useCallback(
    (draft: ArrangementEditorDraft) => {
      if (!editingCandidate) return;

      saveCandidateAsArrangement(editingCandidate, draft);
    },
    [editingCandidate, saveCandidateAsArrangement]
  );

  const handleDismissCandidate = React.useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      setAiCandidates(dismissAiCandidate(id, now));
      setEditingCandidateId((currentId) => (currentId === id ? null : currentId));
    },
    []
  );

  const handleDeleteArrangement = React.useCallback((id: string) => {
    lastTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resetGestureLayers();
    setDeleteCandidateId(id);
  }, [resetGestureLayers]);

  const confirmDeleteArrangement = React.useCallback(() => {
    if (!deleteCandidateId) return;

    const nextArrangements = arrangements.filter(
      (arrangement) => arrangement.id !== deleteCandidateId
    );
    persistArrangements(nextArrangements);
    resetGestureLayers();
    setDeleteCandidateId(null);
    setEditingArrangementId(null);
    setEditingCandidateId(null);
    setDetailArrangementId(null);
    setCreateSheetOpen(false);
  }, [arrangements, deleteCandidateId, persistArrangements, resetGestureLayers]);

  const closeCreateSheet = React.useCallback(() => {
    setCreateSheetOpen(false);
  }, []);

  const closeAiSettingsSheet = React.useCallback(() => {
    setAiSettingsSheetOpen(false);
  }, []);

  const closeDetailSheet = React.useCallback(() => {
    setDetailArrangementId(null);
  }, []);

  const handleConfirmArrangementDetail = React.useCallback(() => {
    setDetailArrangementId(null);
  }, []);

  const closeEditSheet = React.useCallback(() => {
    setEditingArrangementId(null);
  }, []);

  const closeCandidateEditSheet = React.useCallback(() => {
    setEditingCandidateId(null);
  }, []);

  const restoreLastTriggerFocus = React.useCallback(() => {
    lastTriggerRef.current?.focus();
  }, []);

  const handleSaveAiSettings = React.useCallback((settings: AiSettings) => {
    setAiSettings(settings);
    saveAiSettings(settings);
  }, []);

  const aiStatusLabel = isAiSettingsReady(aiSettings) ? "AI 已配置" : "AI 未配置";

  return (
    <main className="relative flex h-full min-h-0 flex-col bg-bg">
      <header className="shrink-0 border-b border-border-light bg-bg px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            className="min-w-0 text-left"
            onClick={scrollToOverview}
            aria-label="回到总览"
            data-testid="arrangements-overview-trigger"
          >
            <h1 className="text-xl font-semibold leading-7 text-text">安排</h1>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              把还没发生的事放在一个地方，提醒你，但不催促你。
            </p>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="rounded-[10px] border border-border bg-surface px-2.5 py-2 text-xs font-semibold leading-5 text-text-muted transition duration-150 hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
              onClick={openAiSettingsSheet}
              data-testid="arrangements-ai-settings-trigger"
              aria-label="打开 AI 设置"
            >
              AI
            </button>
            <button
              type="button"
              className="rounded-[10px] border border-border bg-surface px-2.5 py-2 text-xs font-semibold leading-5 text-text-muted transition duration-150 hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
              onClick={handleAddDemoAiCandidate}
              data-testid="arrangements-ai-demo-candidate"
            >
              试一条
            </button>
            <button
              type="button"
              className="rounded-[10px] bg-primary px-3 py-2 text-sm font-semibold leading-5 text-on-primary transition duration-150 focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
              onClick={openCreateSheet}
              data-testid="arrangements-create-trigger"
            >
              新建
            </button>
          </div>
        </div>
        <button
          type="button"
          className="mt-2 inline-flex rounded-full bg-surface-muted px-2 py-1 text-xs leading-4 text-text-tertiary transition duration-150 hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none"
          onClick={openAiSettingsSheet}
          data-testid="arrangements-ai-status"
          aria-label={`AI 设置状态：${aiStatusLabel}`}
        >
          {aiStatusLabel}
        </button>
      </header>

      <div
        ref={scrollContainerRef}
        data-testid="arrangements-scroll-container"
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3"
        onScroll={resetGestureLayers}
      >
        <ArrangementCalendar arrangements={arrangements} />
        <div className="mt-3">
          <ArrangementSelfMessageRecognizer onRecognize={handleRecognizeSelfMessage} />
        </div>
        <div className="mt-3">
          <ArrangementAiCandidatePreview
            candidates={aiCandidates}
            onConfirm={handleConfirmCandidate}
            onEdit={handleEditCandidate}
            onDismiss={handleDismissCandidate}
          />
        </div>
        <div
          data-testid="arrangements-workspace"
          className="mt-3 space-y-3"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              resetGestureLayers();
            }
          }}
        >
          <ArrangementList
            arrangements={arrangements}
            onSelect={(id) => setDetailArrangementId(id)}
            onComplete={handleComplete}
            onPostpone={handlePostpone}
            onRestoreSomeday={handleRestoreSomeday}
            onReopenCompleted={handleReopenCompleted}
            onDelete={handleDeleteArrangement}
            resetSignal={gestureResetSignal}
          />
        </div>
      </div>

      <ArrangementBottomSheet
        open={isCreateSheetOpen}
        title="创建安排"
        onClose={closeCreateSheet}
        onAfterClose={restoreLastTriggerFocus}
        testId="arrangement-create-sheet"
      >
        <ArrangementEditor
          onCreate={handleCreate}
          onCancelEdit={closeCreateSheet}
          titleInputRef={titleInputRef}
        />
      </ArrangementBottomSheet>

      <ArrangementBottomSheet
        open={isAiSettingsSheetOpen}
        title="AI 设置"
        onClose={closeAiSettingsSheet}
        onAfterClose={restoreLastTriggerFocus}
        testId="arrangement-ai-settings-sheet"
      >
        <ArrangementAiSettings settings={aiSettings} onSave={handleSaveAiSettings} />
      </ArrangementBottomSheet>

      <ArrangementBottomSheet
        open={Boolean(detailArrangement)}
        title="安排详情"
        onClose={closeDetailSheet}
        onAfterClose={restoreLastTriggerFocus}
        testId="arrangement-detail-sheet"
      >
        {detailArrangement ? (
          <ArrangementDetail
            arrangement={detailArrangement}
            onComplete={handleComplete}
            onConfirm={handleConfirmArrangementDetail}
            onPostpone={handlePostpone}
            onEdit={handleEdit}
            onDismissCompletionSuggestion={handleDismissCompletionSuggestion}
          />
        ) : null}
      </ArrangementBottomSheet>

      <ArrangementBottomSheet
        open={Boolean(editingArrangement)}
        title="编辑安排"
        onClose={closeEditSheet}
        onAfterClose={restoreLastTriggerFocus}
        testId="arrangement-edit-sheet"
      >
        {editingArrangement ? (
          <ArrangementEditor
            editingArrangement={editingArrangement}
            onCancelEdit={closeEditSheet}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            onDelete={handleDeleteArrangement}
            titleInputRef={titleInputRef}
          />
        ) : null}
      </ArrangementBottomSheet>

      <ArrangementBottomSheet
        open={Boolean(editingCandidate)}
        title="编辑候选安排"
        onClose={closeCandidateEditSheet}
        onAfterClose={restoreLastTriggerFocus}
        testId="arrangement-ai-candidate-edit-sheet"
      >
        {editingCandidate ? (
          <ArrangementEditor
            candidateDraft={toEditorDraft(editingCandidate)}
            onCancelEdit={closeCandidateEditSheet}
            onCreate={handleCreate}
            onSubmitCandidate={handleSubmitCandidate}
            titleInputRef={titleInputRef}
          />
        ) : null}
      </ArrangementBottomSheet>

      <Modal
        open={Boolean(deleteCandidateId)}
        title="确认删除安排"
        onClose={() => setDeleteCandidateId(null)}
        showCloseButton={false}
        contentTestId="arrangement-delete-confirmation"
      >
        <p className="text-sm leading-6 text-text-muted">删除后将从当前安排列表移除。</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-[10px] border border-border px-3 py-2 text-sm font-semibold leading-5 text-text-muted"
            onClick={() => setDeleteCandidateId(null)}
          >
            再想想
          </button>
          <button
            type="button"
            className="rounded-[10px] bg-[color:var(--danger)] px-3 py-2 text-sm font-semibold leading-5 text-white"
            onClick={confirmDeleteArrangement}
          >
            确认删除
          </button>
        </div>
      </Modal>

      <Modal
        open={isGuideOpen}
        title="安排是什么"
        onClose={closeGuide}
        closeLabel="跳过"
        contentTestId="arrangements-first-run-guide"
        className="w-[340px] max-w-[calc(100vw-32px)] rounded-[18px] p-4"
      >
        <ArrangementFirstRunGuide onDone={closeGuide} />
      </Modal>

      {undoSnapshot ? (
        <div
          role="status"
          data-testid="arrangement-undo-toast"
          className="absolute inset-x-3 bottom-4 z-40 flex items-center justify-between gap-3 rounded-[12px] border border-border-light bg-[color:rgba(255,255,255,0.96)] px-3 py-2 shadow-[0_10px_28px_rgba(15,23,42,0.16)] transition-[opacity,transform] duration-200"
        >
          <span className="min-w-0 text-sm leading-5 text-text-muted">{undoSnapshot.message}</span>
          <button
            type="button"
            aria-label="撤销上一步安排操作"
            className="shrink-0 rounded-[10px] bg-primary px-3 py-1.5 text-sm font-semibold leading-5 text-on-primary transition duration-150 active:scale-[0.98]"
            onClick={undoLastAction}
          >
            撤销
          </button>
        </div>
      ) : null}
    </main>
  );
}

function ArrangementFirstRunGuide({ onDone }: { onDone: () => void }) {
  const guideItems = [
    {
      title: "手动新建",
      description: "把待办、日程、提醒、项目任务都收成一条安排，时间不确定也可以先保存。",
    },
    {
      title: "AI 候选",
      description: "聊天里答应别人的事会先进入候选，你确认后才会变成正式安排。",
    },
    {
      title: "闪烁的完成按钮",
      description: "后续对话像“资料拿回来了”会让完成按钮轻轻闪烁，提醒你确认，不会自动完成。",
    },
    {
      title: "以后再说",
      description: "长按安排可以放到以后再说；这不是失败，只是先把注意力还给现在。",
    },
    {
      title: "AI 辅助",
      description: "部分安排可让 AI 准备材料、草拟回复或生成路线草稿，所有执行仍由你确认。",
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-text-muted">
        安排用来统一收纳所有还没发生、之后可能需要你处理的事。它提醒你，但不催促你。
      </p>
      <div className="space-y-2">
        {guideItems.map((item, index) => (
          <div
            key={item.title}
            className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-[12px] bg-surface-subtle px-3 py-2"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold leading-4 text-primary">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5 text-text">{item.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-text-muted">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-1 flex w-full items-center justify-center rounded-[12px] bg-primary px-3 py-2.5 text-sm font-semibold leading-5 text-on-primary transition duration-150 focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
        onClick={onDone}
      >
        知道了，开始使用安排
      </button>
    </div>
  );
}
