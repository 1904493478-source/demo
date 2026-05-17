import { beforeEach, describe, expect, it } from "vitest";
import {
  getDefaultAiSettings,
  hasConfiguredAiApi,
  isAiSettingsReady,
  loadAiSettings,
  saveAiSettings,
} from "./aiSettingsStore";

describe("aiSettingsStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads default disabled settings when nothing is stored", () => {
    expect(loadAiSettings()).toEqual(getDefaultAiSettings());
    expect(hasConfiguredAiApi(loadAiSettings())).toBe(false);
    expect(isAiSettingsReady(loadAiSettings())).toBe(false);
  });

  it("saves and loads user-owned AI API settings", () => {
    saveAiSettings({
      apiBaseUrl: "https://api.example.com/v1",
      modelName: "demo-model",
      apiKey: "sk-demo",
      recognitionEnabled: true,
      updatedAt: "2026-05-17T07:30:00.000Z",
    });

    const settings = loadAiSettings();
    expect(settings).toEqual({
      apiBaseUrl: "https://api.example.com/v1",
      modelName: "demo-model",
      apiKey: "sk-demo",
      recognitionEnabled: true,
      updatedAt: "2026-05-17T07:30:00.000Z",
    });
    expect(hasConfiguredAiApi(settings)).toBe(true);
    expect(isAiSettingsReady(settings)).toBe(true);
  });

  it("requires an enabled switch and complete API fields before AI is ready", () => {
    expect(
      isAiSettingsReady({
        apiBaseUrl: "https://api.example.com/v1",
        modelName: "demo-model",
        apiKey: "sk-demo",
        recognitionEnabled: false,
        updatedAt: null,
      })
    ).toBe(false);

    expect(
      isAiSettingsReady({
        apiBaseUrl: "https://api.example.com/v1",
        modelName: "",
        apiKey: "sk-demo",
        recognitionEnabled: true,
        updatedAt: null,
      })
    ).toBe(false);
  });

  it("falls back to defaults when stored settings are malformed", () => {
    window.localStorage.setItem("arkme-demo.aiSettings", "{bad json");

    expect(loadAiSettings()).toEqual(getDefaultAiSettings());
  });
});
