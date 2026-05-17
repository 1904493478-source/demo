import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArrangementBottomSheet } from "./ArrangementBottomSheet";

describe("ArrangementBottomSheet", () => {
  it("keeps the sheet mounted briefly while closing so exit motion can play", () => {
    vi.useFakeTimers();

    const { rerender } = render(
      <ArrangementBottomSheet open title="安排详情" onClose={() => undefined}>
        <div>内容</div>
      </ArrangementBottomSheet>
    );

    expect(screen.getByRole("dialog", { name: "安排详情" })).toHaveAttribute(
      "data-motion-state",
      "open"
    );

    rerender(
      <ArrangementBottomSheet open={false} title="安排详情" onClose={() => undefined}>
        <div>内容</div>
      </ArrangementBottomSheet>
    );

    expect(screen.getByRole("dialog", { name: "安排详情" })).toHaveAttribute(
      "data-motion-state",
      "closing"
    );

    act(() => {
      vi.advanceTimersByTime(240);
    });

    expect(screen.queryByRole("dialog", { name: "安排详情" })).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
