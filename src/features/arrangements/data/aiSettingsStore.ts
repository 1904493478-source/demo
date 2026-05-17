export type AiSettings = {
  apiBaseUrl: string;
  modelName: string;
  apiKey: string;
  recognitionEnabled: boolean;
  updatedAt: string | null;
};

const aiSettingsStorageKey = "arkme-demo.aiSettings";

export function getDefaultAiSettings(): AiSettings {
  return {
    apiBaseUrl: "",
    modelName: "",
    apiKey: "",
    recognitionEnabled: false,
    updatedAt: null,
  };
}

export function loadAiSettings(): AiSettings {
  if (typeof window === "undefined") return getDefaultAiSettings();

  try {
    const storedValue = window.localStorage.getItem(aiSettingsStorageKey);
    if (!storedValue) return getDefaultAiSettings();

    const parsedValue = JSON.parse(storedValue);
    return normalizeAiSettings(parsedValue) ?? getDefaultAiSettings();
  } catch {
    return getDefaultAiSettings();
  }
}

export function saveAiSettings(settings: AiSettings) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(aiSettingsStorageKey, JSON.stringify(settings));
}

export function hasConfiguredAiApi(settings: AiSettings) {
  return Boolean(
    settings.apiBaseUrl.trim() && settings.modelName.trim() && settings.apiKey.trim()
  );
}

export function isAiSettingsReady(settings: AiSettings) {
  return settings.recognitionEnabled && hasConfiguredAiApi(settings);
}

function normalizeAiSettings(value: unknown): AiSettings | null {
  if (!value || typeof value !== "object") return null;

  const settings = value as Partial<AiSettings>;
  if (
    typeof settings.apiBaseUrl !== "string" ||
    typeof settings.modelName !== "string" ||
    typeof settings.apiKey !== "string" ||
    typeof settings.recognitionEnabled !== "boolean" ||
    !(settings.updatedAt === null || typeof settings.updatedAt === "string")
  ) {
    return null;
  }

  return {
    apiBaseUrl: settings.apiBaseUrl,
    modelName: settings.modelName,
    apiKey: settings.apiKey,
    recognitionEnabled: settings.recognitionEnabled,
    updatedAt: settings.updatedAt,
  };
}
