import React from "react";
import { testAiArrangementConnection } from "../data/aiArrangementClient";
import {
  hasConfiguredAiApi,
  type AiSettings,
} from "../data/aiSettingsStore";

type ArrangementAiSettingsProps = {
  settings: AiSettings;
  onSave: (settings: AiSettings) => void;
};

type TestState = "idle" | "testing" | "success" | "error";

export function ArrangementAiSettings({ settings, onSave }: ArrangementAiSettingsProps) {
  const [apiBaseUrl, setApiBaseUrl] = React.useState(settings.apiBaseUrl);
  const [modelName, setModelName] = React.useState(settings.modelName);
  const [apiKey, setApiKey] = React.useState(settings.apiKey);
  const [recognitionEnabled, setRecognitionEnabled] = React.useState(
    settings.recognitionEnabled
  );
  const [testState, setTestState] = React.useState<TestState>("idle");
  const [testMessage, setTestMessage] = React.useState(
    "AI 会把相关消息发送到你配置的模型，只生成候选安排。"
  );

  const draftSettings: AiSettings = {
    apiBaseUrl,
    modelName,
    apiKey,
    recognitionEnabled,
    updatedAt: settings.updatedAt,
  };

  const runConnectionTest = async () => {
    setTestState("testing");
    setTestMessage("正在连接你配置的模型。");

    if (!hasConfiguredAiApi(draftSettings)) {
      setTestState("error");
      setTestMessage("请先补全 API 地址、模型名和 Key");
      return;
    }

    try {
      await testAiArrangementConnection({ settings: draftSettings });
      setTestState("success");
      setTestMessage("连接可用，AI 识别会先生成候选安排");
    } catch {
      setTestState("error");
      setTestMessage("连接失败，手动创建和本地识别仍可继续使用");
    }
  };

  return (
    <form
      aria-label="AI 设置"
      className="rounded-[12px] border border-border bg-surface px-3 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          apiBaseUrl: apiBaseUrl.trim(),
          modelName: modelName.trim(),
          apiKey: apiKey.trim(),
          recognitionEnabled,
          updatedAt: new Date().toISOString(),
        });
        setTestMessage("AI 设置已保存。");
        setTestState("success");
      }}
    >
      <div className="rounded-[10px] bg-surface-muted px-3 py-2">
        <h2 className="text-[15px] font-semibold leading-5 text-text">自备模型 API</h2>
        <p className="mt-1 text-xs leading-5 text-text-tertiary">
          V0.2 使用 OpenAI-compatible Chat Completions。Key 只保存在当前浏览器 Demo 中。
        </p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <ArrangementAiField
          id="arrangement-ai-api-base"
          label="API 地址"
          value={apiBaseUrl}
          placeholder="https://api.example.com/v1"
          onChange={setApiBaseUrl}
        />
        <ArrangementAiField
          id="arrangement-ai-model"
          label="模型名"
          value={modelName}
          placeholder="例如：gpt-4.1-mini 或你的模型名"
          onChange={setModelName}
        />
        <ArrangementAiField
          id="arrangement-ai-key"
          label="API Key"
          value={apiKey}
          placeholder="只保存在当前浏览器 Demo 中"
          type="password"
          onChange={setApiKey}
        />
      </div>

      <label className="mt-3 flex items-start gap-2 rounded-[10px] border border-border-light px-3 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
          checked={recognitionEnabled}
          onChange={(event) => setRecognitionEnabled(event.target.checked)}
          data-testid="arrangement-ai-enable"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-5 text-text">启用 AI 识别</span>
          <span className="mt-1 block text-xs leading-5 text-text-tertiary">
            启用后才会尝试识别候选安排，且会消耗你自己的 token。
          </span>
        </span>
      </label>

      <p
        role="status"
        data-testid="arrangement-ai-test-message"
        className={[
          "mt-3 rounded-[10px] px-3 py-2 text-xs leading-5",
          testState === "error"
            ? "bg-[color:rgba(244,99,99,0.08)] text-[color:var(--danger)]"
            : "bg-surface-muted text-text-tertiary",
        ].join(" ")}
      >
        {testMessage}
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          data-testid="arrangement-ai-test"
          className="rounded-[10px] border border-border bg-surface px-3 py-2 text-sm font-semibold leading-5 text-text-muted transition duration-150 hover:bg-hover-overlay focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
          onClick={runConnectionTest}
          disabled={testState === "testing"}
        >
          {testState === "testing" ? "测试中" : "测试连接"}
        </button>
        <button
          type="submit"
          data-testid="arrangement-ai-save"
          className="rounded-[10px] bg-primary px-3 py-2 text-sm font-semibold leading-5 text-on-primary transition duration-150 focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
        >
          保存设置
        </button>
      </div>
    </form>
  );
}

function ArrangementAiField({
  id,
  label,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs font-medium leading-5 text-text-muted">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        data-testid={id}
        className="mt-1 h-10 w-full rounded-[10px] border border-border bg-input-bg px-3 text-sm text-text outline-none transition duration-150 placeholder:text-input-placeholder focus:border-input-border-focus focus:shadow-focus"
      />
    </label>
  );
}
