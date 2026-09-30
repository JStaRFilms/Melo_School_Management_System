import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { scoreSheetDraftKey, useScoreSheetDraft } from "@school/shared/drafts";

function DraftProbe({ school, session = "s1", score = 57 }: { school: string; session?: string; score?: number }) {
  const key = scoreSheetDraftKey(school, session, "t1", "c1", "sub1");
  const [scores, setScores, baselines, captureBaseline] = useScoreSheetDraft<string, "examRawScore">(key);
  return <><span>{scores.get("student1")?.examRawScore ?? "empty"}</span>
    <span data-testid="baseline">{baselines.has("student1") ? JSON.stringify(baselines.get("student1")) : "missing"}</span>
    <button onClick={() => {
      captureBaseline("student1", { id: "record1", updatedAt: 1, ca1: 10, ca2: 10, ca3: 10, examRawScore: 30 });
      setScores(previous => new Map(previous).set("student1", { examRawScore: score }));
    }}>Edit</button>
    <button onClick={() => setScores(new Map())}>Discard</button></>;
}

beforeEach(() => window.sessionStorage.clear());
describe("score sheet recovery", () => {
  it("saves a partial student draft and its baseline before a query failure unmounts the sheet", () => {
    const view = render(<DraftProbe school="school1" />);
    act(() => screen.getByRole("button", { name: "Edit" }).click());
    expect(screen.getByText("57")).toBeTruthy();
    expect(screen.getByTestId("baseline").textContent).toContain("record1");
    view.unmount();
    const recovered = render(<DraftProbe school="school1" />);
    expect(screen.getByText("57")).toBeTruthy();
    expect(screen.getByTestId("baseline").textContent).toContain("record1");
    recovered.rerender(<DraftProbe school="school2" score={31} />);
    expect(screen.getByText("empty")).toBeTruthy();
    act(() => screen.getByRole("button", { name: "Edit" }).click());
    expect(screen.getByText("31")).toBeTruthy();
    recovered.rerender(<DraftProbe school="school1" />);
    expect(screen.getByText("57")).toBeTruthy();
    recovered.rerender(<DraftProbe school="school2" />);
    recovered.rerender(<DraftProbe school="school1" session="s2" />);
    expect(screen.getByText("empty")).toBeTruthy();
    recovered.rerender(<DraftProbe school="school1" />);
    expect(screen.getByText("57")).toBeTruthy();
    act(() => screen.getByRole("button", { name: "Discard" }).click());
    recovered.unmount();
    render(<DraftProbe school="school1" />);
    expect(screen.getByText("empty")).toBeTruthy();
  });

  it("does not invent a baseline for an old-format draft", () => {
    const key = scoreSheetDraftKey("school1", "s1", "t1", "c1", "sub1")!;
    window.sessionStorage.setItem(key, JSON.stringify([["student1", { examRawScore: 57 }]]));
    render(<DraftProbe school="school1" />);
    expect(screen.getByText("57")).toBeTruthy();
    expect(screen.getByTestId("baseline").textContent).toBe("missing");
    act(() => screen.getByRole("button", { name: "Edit" }).click());
    expect(screen.getByTestId("baseline").textContent).toBe("missing");
  });
});
