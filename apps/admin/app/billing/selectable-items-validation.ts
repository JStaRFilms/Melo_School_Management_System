import type { SelectableCollectionDraft } from "./types";

export type SelectableCollectionErrors = {
  name?: string;
  targetClassIds?: string;
  items?: string;
  itemLabels: Record<string, string>;
  itemAmounts: Record<string, string>;
};

export function validateSelectableCollection(
  draft: SelectableCollectionDraft,
): SelectableCollectionErrors {
  const errors: SelectableCollectionErrors = {
    itemLabels: {},
    itemAmounts: {},
  };

  if (!draft.name.trim()) errors.name = "Enter a collection name.";
  if (draft.targetClassIds.length === 0) {
    errors.targetClassIds = "Select at least one eligible class.";
  }
  if (draft.items.length === 0) errors.items = "Add at least one item.";

  const labels = new Map<string, string[]>();
  for (const item of draft.items) {
    const normalizedLabel = item.label.trim().toLocaleLowerCase();
    if (!normalizedLabel) {
      errors.itemLabels[item.draftId] = "Enter a name for this item.";
    } else {
      labels.set(normalizedLabel, [...(labels.get(normalizedLabel) ?? []), item.draftId]);
    }
    const amount = Number(item.unitAmount);
    if (!item.unitAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      errors.itemAmounts[item.draftId] = "Enter a unit price greater than 0.";
    }
  }

  for (const duplicateIds of labels.values()) {
    if (duplicateIds.length > 1) {
      for (const id of duplicateIds) {
        errors.itemLabels[id] = "Item names must be unique in this collection.";
      }
    }
  }
  return errors;
}

export function hasSelectableCollectionErrors(errors: SelectableCollectionErrors) {
  return Boolean(
    errors.name ||
      errors.targetClassIds ||
      errors.items ||
      Object.keys(errors.itemLabels).length ||
      Object.keys(errors.itemAmounts).length,
  );
}

export function isValidSelectableQuantity(value: string) {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 9999;
}
