"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { isConvexConfigured } from "@/convex-runtime";
import { mockClasses } from "@/mock-data";
import {
  LiveClassAssignmentPanel,
  StaticClassAssignmentPanel,
} from "./components/ClassAssignmentPanel";
import { ReportCardBundlesScreen } from "./components/ReportCardBundlesScreen";
import type {
  BundleDraft,
  BundleRecord,
  ClassAssignmentRecord,
  ClassSummary,
  ScaleTemplateDraft,
  ScaleTemplateRecord,
} from "./types";
import { buildAssignmentMap } from "./utils";

const mockScaleTemplates: ScaleTemplateRecord[] = [
  {
    _id: "scale-conduct",
    name: "Conduct scale",
    description: "Reusable behavior rubric",
    options: [
      { id: "excellent", label: "Excellent", shortLabel: "E", order: 0 },
      { id: "good", label: "Good", shortLabel: "G", order: 1 },
      { id: "fair", label: "Fair", shortLabel: "F", order: 2 },
    ],
  },
];

const mockBundles: BundleRecord[] = [
  {
    _id: "bundle-lower-primary",
    name: "Lower Primary Extras",
    description: "Conduct and narrative fields for lower primary.",
    sections: [
      {
        id: "remarks",
        label: "Remarks",
        order: 0,
        fields: [
          { id: "teacher-remark", label: "Class Teacher Remark", type: "text", scaleTemplateId: null, printable: true, order: 0 },
          { id: "conduct", label: "Conduct", type: "scale", scaleTemplateId: "scale-conduct", printable: true, order: 1 },
        ],
      },
      {
        id: "promotion",
        label: "Promotion",
        order: 1,
        fields: [
          { id: "promotion", label: "Eligible for Promotion", type: "boolean", scaleTemplateId: null, printable: false, order: 0 },
        ],
      },
    ],
  },
];

const mockAssignments = buildAssignmentMap([
  {
    classId: "class_primary_4a",
    bundleAssignments: [{ bundleId: "bundle-lower-primary", bundleName: "Lower Primary Extras", order: 0 }],
  },
  { classId: "class_primary_5a", bundleAssignments: [] },
  { classId: "class_primary_6a", bundleAssignments: [] },
]);

export default function ReportCardBundlesPage() {
  if (!isConvexConfigured()) {
    return <MockReportCardBundlesPage />;
  }

  return <LiveReportCardBundlesPage />;
}

function LiveReportCardBundlesPage() {
  const scaleTemplateQuery = useQuery(
    "functions/academic/reportCardExtras:listReportCardExtraScaleTemplates" as never
  ) as ScaleTemplateRecord[] | undefined;
  const bundleQuery = useQuery(
    "functions/academic/reportCardExtras:listReportCardExtraBundles" as never
  ) as BundleRecord[] | undefined;
  const classQuery = useQuery(
    "functions/academic/adminSelectors:getAllClasses" as never
  ) as ClassSummary[] | undefined;
  const assignmentQuery = useQuery(
    "functions/academic/reportCardExtras:listSchoolReportCardExtraBundleAssignments" as never
  ) as ClassAssignmentRecord[] | undefined;
  const scaleTemplates = useMemo(() => scaleTemplateQuery ?? [], [scaleTemplateQuery]);
  const bundles = useMemo(() => bundleQuery ?? [], [bundleQuery]);
  const classes = useMemo(() => classQuery ?? [], [classQuery]);
  const assignments = useMemo(() => assignmentQuery ?? [], [assignmentQuery]);
  const initialAssignments = useMemo(() => buildAssignmentMap(assignments), [assignments]);

  const saveScaleTemplate = useMutation(
    "functions/academic/reportCardExtras:saveReportCardExtraScaleTemplate" as never
  );
  const saveBundle = useMutation(
    "functions/academic/reportCardExtras:saveReportCardExtraBundle" as never
  );
  const setClassBundles = useMutation(
    "functions/academic/reportCardExtras:setClassReportCardExtraBundles" as never
  );

  return (
    <ReportCardBundlesScreen
      bundles={bundles}
      onSaveBundle={async (draft) =>
        (await saveBundle({
          bundleId: draft.bundleId,
          name: draft.name,
          description: draft.description || null,
          sections: draft.sections.map((section) => ({
            id: section.id,
            label: section.label,
            fields: section.fields.map((field) => ({
              id: field.id,
              label: field.label,
              type: field.type,
              scaleTemplateId: field.type === "scale" ? field.scaleTemplateId : null,
              printable: field.printable,
            })),
          })),
        } as never)) as string
      }
      onSaveScaleTemplate={async (draft) =>
        (await saveScaleTemplate({
          templateId: draft.templateId,
          name: draft.name,
          description: draft.description || null,
          options: draft.options.map((option) => ({
            id: option.id,
            label: option.label,
            shortLabel: option.shortLabel || null,
          })),
        } as never)) as string
      }
      renderAssignmentPanel={(selectedBundleId) => (
        <LiveClassAssignmentPanel
          bundles={bundles}
          classes={classes}
          initialAssignments={initialAssignments}
          onSetClassBundles={(classId, bundleIds) =>
            setClassBundles({ classId, bundleIds } as never)
          }
          selectedBundleId={selectedBundleId}
        />
      )}
      scaleTemplates={scaleTemplates}
    />
  );
}

function MockReportCardBundlesPage() {
  const classes = useMemo<ClassSummary[]>(() => mockClasses.map((entry) => ({ id: entry.id, name: entry.name })), []);
  const [scaleTemplates, setScaleTemplates] = useState<ScaleTemplateRecord[]>(mockScaleTemplates);
  const [bundles, setBundles] = useState<BundleRecord[]>(mockBundles);
  const [assignments, setAssignments] = useState<Record<string, ClassAssignmentRecord>>(mockAssignments);

  return (
    <ReportCardBundlesScreen
      bundles={bundles}
      onSaveBundle={async (draft: BundleDraft) => {
        const nextId = draft.bundleId ?? `bundle-${Date.now()}`;
        const nextBundle: BundleRecord = {
          _id: nextId,
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          sections: draft.sections.map((section, sectionIndex) => ({
            id: section.id ?? `section-${sectionIndex + 1}`,
            label: section.label.trim(),
            order: sectionIndex,
            fields: section.fields.map((field, fieldIndex) => ({
              id: field.id ?? `field-${sectionIndex + 1}-${fieldIndex + 1}`,
              label: field.label.trim(),
              type: field.type,
              scaleTemplateId: field.type === "scale" ? field.scaleTemplateId : null,
              printable: field.printable,
              order: fieldIndex,
            })),
          })),
        };
        setBundles((current) => [...current.filter((bundle) => bundle._id !== nextId), nextBundle]);
        return nextId;
      }}
      onSaveScaleTemplate={async (draft: ScaleTemplateDraft) => {
        const nextId = draft.templateId ?? `scale-${Date.now()}`;
        const nextTemplate: ScaleTemplateRecord = {
          _id: nextId,
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          options: draft.options.map((option, index) => ({
            id: option.id ?? `option-${index + 1}`,
            label: option.label.trim(),
            shortLabel: option.shortLabel.trim() || null,
            order: index,
          })),
        };
        setScaleTemplates((current) => [...current.filter((template) => template._id !== nextId), nextTemplate]);
        return nextId;
      }}
      renderAssignmentPanel={(selectedBundleId) => (
        <StaticClassAssignmentPanel
          bundles={bundles}
          classes={classes}
          initialAssignments={assignments}
          onSetClassBundles={async (classId, bundleIds) => {
            setAssignments((current) => ({
              ...current,
              [classId]: {
                classId,
                bundleAssignments: bundleIds.map((bundleId, index) => ({
                  bundleId,
                  bundleName: bundles.find((bundle) => bundle._id === bundleId)?.name ?? "Unknown bundle",
                  order: index,
                })),
              },
            }));
          }}
          selectedBundleId={selectedBundleId}
        />
      )}
      scaleTemplates={scaleTemplates}
    />
  );
}
