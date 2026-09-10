import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ImportConfirmationModal } from "../Modals/ImportConfirmationModal";

describe("ImportConfirmationModal", () => {
  it("renders modal with title, description, stats, and reassurance note", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    const html = renderToStaticMarkup(
      <ImportConfirmationModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Prepare 25 Student Records"
        badge="Reviewed Import Plan"
        description="Create 25 separate student records in the import plan."
        stats={[
          { label: "Students Selected", value: "25 records", variant: "info" },
          { label: "ID Strategy", value: "Official Auto-ID", variant: "default" },
        ]}
        infoNotice="Nothing is committed to the live school roster yet."
        confirmLabel="Stage 25 in Plan"
      />
    );

    expect(html).toContain("Prepare 25 Student Records");
    expect(html).toContain("Reviewed Import Plan");
    expect(html).toContain("Create 25 separate student records in the import plan.");
    expect(html).toContain("Students Selected");
    expect(html).toContain("25 records");
    expect(html).toContain("Official Auto-ID");
    expect(html).toContain("Nothing is committed to the live school roster yet.");
    expect(html).toContain("Stage 25 in Plan");
  });

  it("does not render markup when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <ImportConfirmationModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Hidden Modal"
        description="Hidden description"
      />
    );

    expect(html).toBe("");
  });
});
