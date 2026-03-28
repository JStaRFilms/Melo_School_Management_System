export type SelectorOption = {
  id: string;
  name: string;
};

export type ExtrasSelection = {
  sessionId: string | null;
  termId: string | null;
  classId: string | null;
  studentId: string | null;
};

export type ExtrasField = {
  id: string;
  label: string;
  type: "text" | "number" | "boolean" | "scale";
  printable: boolean;
  scaleOptions: Array<{
    id: string;
    label: string;
    shortLabel: string | null;
  }>;
  value: {
    textValue: string | null;
    numberValue: number | null;
    booleanValue: boolean | null;
    scaleOptionId: string | null;
    printValue: string | null;
  };
};

export type ExtrasSection = {
  id: string;
  label: string;
  fields: ExtrasField[];
};

export type ExtrasBundle = {
  _id: string;
  name: string;
  description: string | null;
  sections: ExtrasSection[];
};

export type ExtrasEntry = {
  studentId: string;
  studentName: string;
  classId: string;
  sessionId: string;
  termId: string;
  canEdit: boolean;
  bundles: ExtrasBundle[];
};

export type ExtrasValueInput = {
  fieldId: string;
  textValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
  scaleOptionId: string | null;
};

export type ExtrasBundleValueInput = {
  bundleId: string;
  values: ExtrasValueInput[];
};
