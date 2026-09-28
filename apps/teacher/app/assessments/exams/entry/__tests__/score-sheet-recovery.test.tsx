import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { scoreSheetDraftKey, useScoreSheetDraft } from "@school/shared/drafts";

function DraftProbe({ school, session = "s1" }: { school: string; session?: string }) {
  const key = scoreSheetDraftKey(school, session, "t1", "c1", "sub1");
  const [scores, setScores] = useScoreSheetDraft<string, "examRawScore">(key);
  return <><span>{scores.get("student1")?.examRawScore ?? "empty"}</span>
    <button onClick={() => setScores(previous => new Map(previous).set("student1", { examRawScore: 57 }))}>Edit</button>
    <button onClick={() => setScores(new Map())}>Discard</button></>;
}

beforeEach(() => window.sessionStorage.clear());
describe("score sheet recovery", () => {
  it("saves a partial student draft before a query failure unmounts the sheet, and restores it after unlock", () => {
    const view = render(<DraftProbe school="school1" />);
    act(() => screen.getByRole("button", { name: "Edit" }).click());
    expect(screen.getByText("57")).toBeTruthy();
    view.unmount(); // Error boundary remount while the backend guard blocks reads.
    const recovered = render(<DraftProbe school="school1" />);
    expect(screen.getByText("57")).toBeTruthy();
    recovered.rerender(<DraftProbe school="school2" />);
    expect(screen.getByText("empty")).toBeTruthy();
    recovered.rerender(<DraftProbe school="school1" session="s2" />);
    expect(screen.getByText("empty")).toBeTruthy();
    recovered.rerender(<DraftProbe school="school1" />);
    expect(screen.getByText("57")).toBeTruthy();
    act(() => screen.getByRole("button", { name: "Discard" }).click());
    recovered.unmount();
    render(<DraftProbe school="school1" />);
    expect(screen.getByText("empty")).toBeTruthy();
  });
});
