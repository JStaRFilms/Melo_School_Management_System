"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { 
  Plus, 
  FolderPlus, 
  Trash2, 
  GripHorizontal, 
  Check, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Info,
  RefreshCw,
  Lock,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ChevronDown
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";

type BuilderCard = {
  id: string;
  type: "section" | "question";
  label: string;
  key: string;
  kind?: string;
  required?: boolean;
  isDefault?: boolean;
  isMandatory?: boolean;
  enabled?: boolean;
  dataClass?: "public" | "internal" | "personal" | "child_confidential" | "highly_sensitive" | "financial_security";
  purpose?: string;
  retentionPolicyKey?: string;
  audience?: string;
  approvalEvidenceId?: string;
  choices?: string[];
};

interface AdmissionsFormBuilderProps {
  schoolId: string;
  schoolSlug?: string;
  intakeId?: string;
  onCancel: () => void;
  onSuccess: () => void;
  publishAllowed: boolean;
}

export function AdmissionsFormBuilder({
  schoolId,
  schoolSlug,
  intakeId,
  onCancel,
  onSuccess,
  publishAllowed
}: AdmissionsFormBuilderProps) {
  // Convex mutations
  const updateIntakeDetails = useMutation("functions/admissions/settings:updateIntakeDetails" as never);
  const createMockApprovalEvidence = useMutation("functions/admissions/settings:createMockApprovalEvidence" as never);
  const retireForm = useMutation("functions/admissions/settings:retireForm" as never);
  const publishForm = useMutation("functions/admissions/settings:publishForm" as never);
  const setIntakeStatus = useMutation("functions/admissions/settings:setIntakeStatus" as never);
  // Convex mutations
  const createProgramme = useMutation("functions/admissions/settings:createProgramme" as never);
  const createIntake = useMutation("functions/admissions/settings:createIntake" as never);
  const createProduct = useMutation("functions/admissions/settings:createProduct" as never);
  const createForm = useMutation("functions/admissions/settings:createDraftForm" as never);
  const addField = useMutation("functions/admissions/settings:addDraftField" as never);
  const addRequirement = useMutation("functions/admissions/settings:addDraftDocumentRequirement" as never);
  const publishPrice = useMutation("functions/admissions/settings:publishPrice" as never);
  const createDeclaration = useMutation("functions/admissions/settings:createDeclaration" as never);
  const publishDeclaration = useMutation("functions/admissions/settings:publishDeclaration" as never);

  // Form setup states
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [academicCategory, setAcademicCategory] = useState("Primary School");
  const [formSlug, setFormSlug] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [targetStatus, setTargetStatus] = useState<"draft" | "published">("draft");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Document checkboxes
  const [reqPassport, setReqPassport] = useState(true);
  const [reqMedical, setReqMedical] = useState(true);
  const [reqTranscripts, setReqTranscripts] = useState(true);

  // Flat canvas of Google Form cards
  // AGENT PROMPT: SYSTEM FIELD CONTRACT FOR MUTATION LIFE CYCLES
  // These initial core parameters are backed by hardcoded layouts in apps/apply components.
  // Their keys/slugs are immutable and should never be saved to dynamic custom database queries
  // to avoid profile conversion mapping failures. Optional items are enabled by default
  // but can be toggled off to collapse in the UI and remain unsaved.
  const [cards, setCards] = useState<BuilderCard[]>([
    { id: "def-sec-1", type: "section", label: "Default Child Profile (Auto-Collected)", key: "child", isDefault: true, isMandatory: true, enabled: true },
    { id: "def-q-1", type: "question", label: "First Name", key: "first_name", kind: "text", required: true, isDefault: true, isMandatory: true, enabled: true },
    { id: "def-q-middle-name", type: "question", label: "Middle Name", key: "middle_name", kind: "text", required: false, isDefault: true, enabled: true },
    { id: "def-q-2", type: "question", label: "Last Name", key: "last_name", kind: "text", required: true, isDefault: true, isMandatory: true, enabled: true },
    { id: "def-q-preferred-name", type: "question", label: "Preferred Name", key: "preferred_name", kind: "text", required: false, isDefault: true, enabled: true },
    { id: "def-q-3", type: "question", label: "Date of Birth", key: "date_of_birth", kind: "date", required: true, isDefault: true, isMandatory: true, enabled: true },
    { id: "def-q-4", type: "question", label: "Gender", key: "gender", kind: "select", required: true, isDefault: true, enabled: true, choices: ["Male", "Female"] },
    { id: "def-q-nationality", type: "question", label: "Nationality", key: "nationality", kind: "text", required: false, isDefault: true, enabled: true },
    { id: "def-q-country-of-birth", type: "question", label: "Country of Birth", key: "country_of_birth", kind: "text", required: false, isDefault: true, enabled: true },
    { id: "def-q-address", type: "question", label: "Residential Address", key: "address", kind: "textarea", required: false, isDefault: true, enabled: true },
    { id: "def-sec-2", type: "section", label: "Default Guardian Contact (Auto-Collected)", key: "guardian", isDefault: true, isMandatory: true, enabled: true },
    { id: "def-q-guardian-name", type: "question", label: "Guardian Full Name", key: "guardian_full_name", kind: "text", required: true, isDefault: true, isMandatory: true, enabled: true },
    { id: "def-q-guardian-email", type: "question", label: "Guardian Email", key: "guardian_email", kind: "email", required: true, isDefault: true, isMandatory: true, enabled: true },
    { id: "def-q-guardian-phone", type: "question", label: "Guardian Phone Number", key: "guardian_phone", kind: "phone", required: true, isDefault: true, isMandatory: true, enabled: true },
    { id: "def-q-guardian-relationship", type: "question", label: "Guardian Relationship", key: "guardian_relationship", kind: "text", required: false, isDefault: true, enabled: true },
    // Custom cards editable by user:
    { id: "seed-sec-1", type: "section", label: "Personal & Siblings Data", key: "child_custom" },
    { id: "seed-q-1", type: "question", label: "Names of Siblings in School", key: "names_of_siblings_in_school", kind: "text", required: false },
    { id: "seed-sec-2", type: "section", label: "Support & Medical History", key: "support_custom" },
    { id: "seed-q-2", type: "question", label: "Any special medical conditions?", key: "any_special_medical_conditions", kind: "textarea", required: false }
  ]);

  const [focusedCardId, setFocusedCardId] = useState<string | null>("seed-sec-1");
  const [expandedPrivacyCardId, setExpandedPrivacyCardId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Catalogue loaders for editing existing intake
  const catalogue = useQuery("functions/admissions/settings:getCatalogue" as never, { schoolId } as never) as any;
  const evidence = useQuery("functions/admissions/settings:listApprovalEvidence" as never, schoolId ? { schoolId } as never : "skip" as never) as any[] | undefined;
  const intakeDoc = catalogue?.intakes?.find((i: any) => i.id === intakeId);
  const formVersionDoc = catalogue?.forms?.find((f: any) => f.intakeId === intakeId && f.status === "draft") || 
                        catalogue?.forms?.find((f: any) => f.intakeId === intakeId && f.status === "published") || 
                        catalogue?.forms?.find((f: any) => f.intakeId === intakeId);
  const productDoc = catalogue?.products?.find((p: any) => p.intakeId === intakeId);

  const formConfig = useQuery(
    "functions/admissions/settings:getFormConfiguration" as never,
    formVersionDoc?.id ? { formVersionId: formVersionDoc.id } as never : "skip" as never
  ) as any;

  const prices = useQuery(
    "functions/admissions/settings:listProductPrices" as never,
    productDoc?.id ? { productId: productDoc.id } as never : "skip" as never
  ) as any;

  const [hasInitializedEditMode, setHasInitializedEditMode] = useState(false);

  useEffect(() => {
    if (!intakeId || !catalogue || hasInitializedEditMode) return;
    if (!intakeDoc || !formConfig || !prices) return; // Wait for queries to resolve

    const programme = catalogue.programmes.find((p: any) => p.id === intakeDoc.programmeId);

    if (intakeDoc.name) setFormName(intakeDoc.name);
    if (intakeDoc.slug) setFormSlug(intakeDoc.slug);
    if (intakeDoc.cycleLabel) setAcademicCategory(intakeDoc.cycleLabel);
    if (programme?.description) setFormDescription(programme.description);

    const padZero = (n: number) => n.toString().padStart(2, '0');
    const formatEpochToDateTimeLocal = (epoch: number) => {
      const d = new Date(epoch);
      return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}T${padZero(d.getHours())}:${padZero(d.getMinutes())}`;
    };

    if (intakeDoc.opensAt) setOpensAt(formatEpochToDateTimeLocal(intakeDoc.opensAt));
    if (intakeDoc.closesAt) setClosesAt(formatEpochToDateTimeLocal(intakeDoc.closesAt));

    if (prices && prices.length > 0) {
      setFeeAmount(prices[0].amountMinor.toString());
      setFeeCurrency(prices[0].currency);
      setFeeRefundPolicy(prices[0].refundPolicyKey);
      setFeeDisclosure(prices[0].feeDisclosure);
    }

    const declarationDoc = catalogue?.declarations?.find((d: any) => d.programmeId === intakeDoc.programmeId && d.status === "published") ||
                           catalogue?.declarations?.find((d: any) => d.programmeId === intakeDoc.programmeId);

    if (declarationDoc) {
      if (declarationDoc.title) setDeclarationTitle(declarationDoc.title);
      if (declarationDoc.body) setDeclarationBody(declarationDoc.body);
    }

    // Default templates to update or construct
    const defaultTemplates = [
      { id: "def-q-1", type: "question", label: "First Name", key: "first_name", kind: "text", required: true, isDefault: true, isMandatory: true, enabled: true },
      { id: "def-q-middle-name", type: "question", label: "Middle Name", key: "middle_name", kind: "text", required: false, isDefault: true, enabled: true },
      { id: "def-q-2", type: "question", label: "Last Name", key: "last_name", kind: "text", required: true, isDefault: true, isMandatory: true, enabled: true },
      { id: "def-q-preferred-name", type: "question", label: "Preferred Name", key: "preferred_name", kind: "text", required: false, isDefault: true, enabled: true },
      { id: "def-q-3", type: "question", label: "Date of Birth", key: "date_of_birth", kind: "date", required: true, isDefault: true, isMandatory: true, enabled: true },
      { id: "def-q-4", type: "question", label: "Gender", key: "gender", kind: "select", required: true, isDefault: true, enabled: true, choices: ["Male", "Female"] },
      { id: "def-q-nationality", type: "question", label: "Nationality", key: "nationality", kind: "text", required: false, isDefault: true, enabled: true },
      { id: "def-q-country-of-birth", type: "question", label: "Country of Birth", key: "country_of_birth", kind: "text", required: false, isDefault: true, enabled: true },
      { id: "def-q-address", type: "question", label: "Residential Address", key: "address", kind: "textarea", required: false, isDefault: true, enabled: true },
      { id: "def-q-guardian-name", type: "question", label: "Guardian Full Name", key: "guardian_full_name", kind: "text", required: true, isDefault: true, isMandatory: true, enabled: true },
      { id: "def-q-guardian-email", type: "question", label: "Guardian Email", key: "guardian_email", kind: "email", required: true, isDefault: true, isMandatory: true, enabled: true },
      { id: "def-q-guardian-phone", type: "question", label: "Guardian Phone Number", key: "guardian_phone", kind: "phone", required: true, isDefault: true, isMandatory: true, enabled: true },
      { id: "def-q-guardian-relationship", type: "question", label: "Guardian Relationship", key: "guardian_relationship", kind: "text", required: false, isDefault: true, enabled: true }
    ];

    const resolvedCards: any[] = [];
    const sortedFields = [...formConfig.fields].sort((a: any, b: any) => a.order - b.order);

    // 1. Add Default Section 1 & its default questions (always enabled by default)
    resolvedCards.push({ id: "def-sec-1", type: "section", label: "Default Child Profile (Auto-Collected)", key: "child", isDefault: true, isMandatory: true, enabled: true });
    defaultTemplates.slice(0, 9).forEach((t: any) => {
      const fieldMatch = sortedFields.find((f: any) => f.key === t.key);
      let choicesList = t.choices || [];
      if (fieldMatch?.validationJson) {
        try {
          const parsedVal = JSON.parse(fieldMatch.validationJson);
          if (Array.isArray(parsedVal?.choices)) {
            choicesList = parsedVal.choices;
          }
        } catch (err) {
          console.error("Error parsing validationJson for default template", t.key, err);
        }
      }
      resolvedCards.push({
        ...t,
        label: fieldMatch?.label || t.label,
        required: fieldMatch ? fieldMatch.requiredMode === "required" : t.required,
        enabled: true,
        choices: choicesList
      });
    });

    // 2. Add Default Section 2 & its default questions (always enabled by default)
    resolvedCards.push({ id: "def-sec-2", type: "section", label: "Default Guardian Contact (Auto-Collected)", key: "guardian", isDefault: true, isMandatory: true, enabled: true });
    defaultTemplates.slice(9).forEach((t: any) => {
      const fieldMatch = sortedFields.find((f: any) => f.key === t.key);
      let choicesList = t.choices || [];
      if (fieldMatch?.validationJson) {
        try {
          const parsedVal = JSON.parse(fieldMatch.validationJson);
          if (Array.isArray(parsedVal?.choices)) {
            choicesList = parsedVal.choices;
          }
        } catch (err) {
          console.error("Error parsing validationJson for default template", t.key, err);
        }
      }
      resolvedCards.push({
        ...t,
        label: fieldMatch?.label || t.label,
        required: fieldMatch ? fieldMatch.requiredMode === "required" : t.required,
        enabled: true,
        choices: choicesList
      });
    });

    // 3. Filter custom fields only (those not belonging to default keys)
    const customFields = sortedFields.filter((f: any) => !defaultTemplates.some((t: any) => t.key === f.key));

    let currentSectionKey = "";
    customFields.forEach((field: any, idx: number) => {
      const sKey = field.sectionKey || "child_custom";
      if (sKey !== currentSectionKey) {
        if (sKey === "child_custom") {
          resolvedCards.push({ id: "seed-sec-1", type: "section", label: "Personal & Siblings Data", key: "child_custom" });
        } else if (sKey === "support_custom") {
          resolvedCards.push({ id: "seed-sec-2", type: "section", label: "Support & Medical History", key: "support_custom" });
        } else {
          // Custom section
          resolvedCards.push({
            id: `card-sec-${idx}-${Date.now()}`,
            type: "section",
            label: sKey.replace(/_+/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
            key: sKey
          });
        }
        currentSectionKey = sKey;
      }

      // Dynamic custom question card
      let choicesList: string[] = [];
      try {
        if (field.validationJson) {
          const parsedVal = JSON.parse(field.validationJson);
          if (Array.isArray(parsedVal?.choices)) {
            choicesList = parsedVal.choices;
          }
        }
      } catch (err) {
        console.error("Error parsing validationJson for field", field.key, err);
      }

      resolvedCards.push({
        id: `card-q-${idx}-${Date.now()}`,
        type: "question",
        label: field.label,
        key: field.key,
        kind: field.kind,
        required: field.requiredMode === "required",
        dataClass: field.dataClass || "personal",
        purpose: field.purpose || "",
        retentionPolicyKey: field.retentionPolicyKey || "",
        audience: field.audience || "",
        approvalEvidenceId: field.approvalEvidenceId || "",
        choices: choicesList
      });
    });

    // Requirements documents mapping
    const reqs = formConfig.requirements;
    setReqPassport(reqs.some((r: any) => r.key === "passport"));
    setReqMedical(reqs.some((r: any) => r.key === "medical_records"));
    setReqTranscripts(reqs.some((r: any) => r.key === "transcripts"));

    if (intakeDoc.status) {
      setTargetStatus(intakeDoc.status === "draft" ? "draft" : "published");
    }

    setCards(resolvedCards);
    setHasInitializedEditMode(true);
    setIsDraftDecisionMade(true); // Don't trigger draft recovery modal since we are editing a live campaign
  }, [intakeId, catalogue, formConfig, prices, hasInitializedEditMode, intakeDoc]);

  // Fees states
  const [feeAmount, setFeeAmount] = useState("15000");
  const [feeCurrency, setFeeCurrency] = useState("NGN");
  const [feeRefundPolicy, setFeeRefundPolicy] = useState("non_refundable");
  const [feeDisclosure, setFeeDisclosure] = useState("Application processing fee");

  // Legal Declaration states
  const [declarationTitle, setDeclarationTitle] = useState("Declaration of Guardians");
  const [declarationBody, setDeclarationBody] = useState("I hereby attest to the accuracy of the records provided and bind responsibility to school code frameworks.");

  // Removed scroll position trackers to optimize rendering performance and prevent scroll lag
  const canvasRef = useRef<HTMLDivElement>(null);

  // Autosave and duplicate keys verification states
  const [draftExists, setDraftExists] = useState(false);
  const [isDraftDecisionMade, setIsDraftDecisionMade] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const mountRef = useRef(false);

  useEffect(() => {
    if (schoolId && !intakeId) { // Skip local draft checks when editing a live database campaign
      const saved = localStorage.getItem(`admissions_form_draft_${schoolId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.formName || (parsed.cards && parsed.cards.length > 14)) {
            setDraftExists(true);
            return;
          }
        } catch (e) {}
      }
    }
    setIsDraftDecisionMade(true);
  }, [schoolId, intakeId]);

  // Dirty state tracking after initialization is complete
  useEffect(() => {
    if (!isDraftDecisionMade) return;
    if (intakeId && !hasInitializedEditMode) return;

    if (!mountRef.current) {
      mountRef.current = true;
      return;
    }

    setIsDirty(true);
  }, [formName, formDescription, academicCategory, feeAmount, opensAt, closesAt, cards, isDraftDecisionMade, hasInitializedEditMode, intakeId]);

  // Autosave draft to localStorage
  useEffect(() => {
    if (!schoolId || !isDraftDecisionMade || !isDirty) return;
    const draftData = {
      formName,
      formDescription,
      academicCategory,
      feeAmount,
      opensAt,
      closesAt,
      cards
    };
    localStorage.setItem(`admissions_form_draft_${schoolId}`, JSON.stringify(draftData));
  }, [formName, formDescription, academicCategory, feeAmount, opensAt, closesAt, cards, schoolId, isDraftDecisionMade, isDirty]);

  const handleLoadDraft = () => {
    const saved = localStorage.getItem(`admissions_form_draft_${schoolId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.formName) setFormName(parsed.formName);
        if (parsed.formDescription) setFormDescription(parsed.formDescription || "");
        if (parsed.academicCategory) setAcademicCategory(parsed.academicCategory);
        if (parsed.feeAmount) setFeeAmount(parsed.feeAmount);
        if (parsed.opensAt) setOpensAt(parsed.opensAt);
        if (parsed.closesAt) setClosesAt(parsed.closesAt);
        if (parsed.cards) setCards(parsed.cards);
        appToast.success("Draft loaded successfully!");
      } catch (e) {
        appToast.error("Failed to load draft.");
      }
    }
    setDraftExists(false);
    setIsDraftDecisionMade(true);
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(`admissions_form_draft_${schoolId}`);
    setDraftExists(false);
    setIsDraftDecisionMade(true);
    appToast.success("Draft discarded.");
  };

  const isDuplicateKey = (cardId: string, key: string) => {
    if (!key) return false;
    return cards.some(c => c.id !== cardId && c.key === key);
  };

  const getConflictingCardLabel = (cardId: string, key: string) => {
    if (!key) return null;
    const conflict = cards.find(c => c.id !== cardId && c.key === key);
    return conflict ? conflict.label || "Untitled" : null;
  };

  const isInvalidKeyFormat = (key: string) => {
    if (!key) return true;
    return !/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(key);
  };

  const handleUpdateCardKey = (id: string, rawKey: string) => {
    const sanitized = rawKey.toLowerCase().replace(/[^a-z0-9_-]+/g, "");
    setCards(prev => prev.map(c => (c.id === id ? { ...c, key: sanitized } : c)));
  };

  // Auto-slugify slug when name changes
  const handleNameChange = (val: string) => {
    setFormName(val);
    setFormSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  };

  // Drag-and-drop state trackers
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  const handleCardClick = (id: string) => {
    setFocusedCardId(id);
  };

  const handleUpdateCardLabel = (id: string, newLabel: string) => {
    setCards(prev => prev.map(c => {
      if (c.id === id) {
        if (c.isDefault) {
          // STANDARD OPERATION CONTRACT: For default parameters, we allow renaming the label text
          // to fit UI preferences, but we MUST keep the database key slug strictly untouched!
          return { ...c, label: newLabel };
        }
        const rawKey = newLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_+|_+$)/g, "");
        const generatedKey = c.type === "section" && rawKey ? `section_${rawKey}` : rawKey;
        return { ...c, label: newLabel, key: generatedKey };
      }
      return c;
    }));
  };

  const handleUpdateCardKind = (id: string, kind: string) => {
    setCards(prev => prev.map(c => (c.id === id ? { ...c, kind } : c)));
  };

  const handleUpdateCardRequired = (id: string, required: boolean) => {
    setCards(prev => prev.map(c => (c.id === id ? { ...c, required } : c)));
  };

  const handleToggleDefaultField = (id: string, enabled: boolean) => {
    setCards(prev => prev.map(c => (c.id === id ? { ...c, enabled } : c)));
  };

  const handleDeleteCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    if (focusedCardId === id) setFocusedCardId(null);
  };

  // Google Forms insert tools
  const insertQuestion = () => {
    if (!focusedCardId) return;
    const newId = `card-q-${Date.now()}`;
    const newCard: BuilderCard = {
      id: newId,
      type: "question",
      label: "",
      key: "",
      kind: "text",
      required: false,
      dataClass: "personal",
      purpose: "",
      retentionPolicyKey: "",
      audience: "",
      approvalEvidenceId: "",
      choices: []
    };

    setCards(prev => {
      const idx = prev.findIndex(c => c.id === focusedCardId);
      if (idx === -1) return [...prev, newCard];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newCard);
      return copy;
    });
    setFocusedCardId(newId);
  };

  const insertSection = () => {
    if (!focusedCardId) return;
    const newId = `card-sec-${Date.now()}`;
    const newCard: BuilderCard = {
      id: newId,
      type: "section",
      label: "",
      key: ""
    };

    setCards(prev => {
      const idx = prev.findIndex(c => c.id === focusedCardId);
      if (idx === -1) return [...prev, newCard];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newCard);
      return copy;
    });
    setFocusedCardId(newId);
  };

  // HTML5 drag events
  const handleDragStart = (id: string) => {
    setDraggingCardId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggingCardId || draggingCardId === targetId) return;

    setCards(prev => {
      const copy = [...prev];
      const dragIdx = copy.findIndex(c => c.id === draggingCardId);
      const targetIdx = copy.findIndex(c => c.id === targetId);
      if (dragIdx === -1 || targetIdx === -1) return prev;

      const [moved] = copy.splice(dragIdx, 1);
      copy.splice(targetIdx, 0, moved);
      return copy;
    });
  };

  // Convex setup submit sequence
  const handlePublish = async () => {
    if (!formName || !formSlug) {
      appToast.error("Form name and slug are required parameters.");
      return;
    }

    // Validate duplicate keys
    const keys = cards.map(c => c.key).filter(Boolean);
    const uniqueKeys = new Set(keys);
    if (uniqueKeys.size !== keys.length) {
      const duplicates = keys.filter((item, index) => keys.indexOf(item) !== index);
      appToast.error(`Form contains duplicate field keys: ${[...new Set(duplicates)].join(", ")}. Please resolve them before publishing.`);
      return;
    }

    // Validate invalid key formats
    const invalidKeys = cards.filter(c => !c.isDefault && isInvalidKeyFormat(c.key));
    if (invalidKeys.length > 0) {
      appToast.error(`Form contains invalid slugs/keys: ${invalidKeys.map(c => c.label || "Untitled").join(", ")}. Keys must only contain lowercase letters, numbers, hyphens, and underscores.`);
      return;
    }

    setSaving(true);
    try {
      if (intakeId) {
        // --- EDITING AN EXISTING INTAKE FORM ---
        const intake = catalogue?.intakes?.find((i: any) => i.id === intakeId);
        if (!intake) throw new Error("Intake not found in catalogue");
        const progId = intake.programmeId;
        const product = catalogue?.products?.find((p: any) => p.intakeId === intakeId);

        // 1. Update Intake and Programme details
        const opens = opensAt ? new Date(opensAt).getTime() : Date.now();
        const closes = closesAt ? new Date(closesAt).getTime() : Date.now() + 30 * 24 * 60 * 60 * 1000;
        
        await updateIntakeDetails({
          schoolId,
          intakeId: intakeId as any,
          name: formName,
          opensAt: opens,
          closesAt: closes,
          cycleLabel: academicCategory,
          description: formDescription || undefined
        } as never);

        // 2. Update Price if changed
        const amt = Number(feeAmount) || 0;
        const existingPrice = prices?.[0];
        const prodId = product?.id;
        
        if (prodId && (!existingPrice || existingPrice.amountMinor !== amt)) {
          const nextVersion = (existingPrice?.version || 0) + 1;
          const evidenceId = await createMockApprovalEvidence({
            schoolId,
            approvalClass: "finance",
            subjectType: "admissions_price",
            subjectKey: `${String(prodId)}:${nextVersion}`
          } as never);

          await publishPrice({
            productId: prodId as any,
            version: nextVersion,
            amountMinor: amt,
            currency: feeCurrency,
            refundPolicyKey: feeRefundPolicy,
            feeDisclosure: feeDisclosure || "Standard admissions process fee",
            effectiveFrom: Date.now(),
            approvalEvidenceId: evidenceId
          } as never);
        }

        // 2.5 Update/create legal declaration attestation
        const existingDeclaration = catalogue?.declarations?.find((d: any) => d.programmeId === intakeDoc.programmeId);
        const declId = await createDeclaration({
          schoolId,
          programmeId: intakeDoc.programmeId,
          version: existingDeclaration ? (existingDeclaration.version + 1) : 1,
          title: declarationTitle,
          body: declarationBody,
          purpose: "service"
        } as never) as string;
        await publishDeclaration({ declarationVersionId: declId } as never);

        // 3. Create Draft form version
        const fVersionId = await createForm({
          schoolId,
          programmeId: progId,
          intakeId: intakeId as any,
          schemaVersion: "1"
        } as never) as string;

        // 4. Loop over cards and append fields
        let currentSectionKey = "applicant";
        for (let i = 0; i < cards.length; i++) {
          const card = cards[i];
          if (card.isDefault) continue;
          if (card.type === "section") {
            currentSectionKey = card.key || "custom_section";
          } else {
            let fieldApprovalId = card.approvalEvidenceId || undefined;
            if ((card.dataClass === "highly_sensitive" || card.dataClass === "financial_security") && !fieldApprovalId) {
              fieldApprovalId = await createMockApprovalEvidence({
                schoolId,
                approvalClass: "privacy",
                subjectType: "admissions_field",
                subjectKey: card.key
              } as never);
            }

            let validationJsonVal = "{}";
            if (card.kind === "select" && Array.isArray(card.choices) && card.choices.length > 0) {
              validationJsonVal = JSON.stringify({ choices: card.choices });
            }

            await addField({
              formVersionId: fVersionId,
              fieldKey: card.key || `field_${i}`,
              sectionKey: currentSectionKey,
              kind: card.kind || "text",
              label: card.label || "Untitled Field",
              requiredMode: card.required ? "required" : "optional",
              dataClass: card.dataClass || "personal",
              purpose: (card.dataClass === "highly_sensitive" || card.dataClass === "financial_security") ? (card.purpose || "Required for admissions evaluation") : undefined,
              retentionPolicyKey: (card.dataClass === "highly_sensitive" || card.dataClass === "financial_security") ? (card.retentionPolicyKey || "duration_of_enrollment") : undefined,
              audience: (card.dataClass === "highly_sensitive" || card.dataClass === "financial_security") ? (card.audience || "school_admissions_staff") : undefined,
              approvalEvidenceId: fieldApprovalId,
              validationJson: validationJsonVal,
              order: i
            } as never);
          }
        }

        // 5. Add document checklist items
        await addRequirement({
          formVersionId: fVersionId,
          requirementKey: "birth_cert",
          category: "identity",
          label: "Birth Certificate",
          requiredMode: "required",
          acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
          maxBytes: 5 * 1024 * 1024,
          maxFiles: 1,
          sensitivity: "child_confidential",
          purpose: "Age and identity confirmation",
          order: 0
        } as never);

        if (reqPassport) {
          await addRequirement({
            formVersionId: fVersionId,
            requirementKey: "passport",
            category: "passport",
            label: "Passport Photograph (Clear headshot)",
            requiredMode: "required",
            acceptedMimeTypes: ["image/jpeg", "image/png"],
            maxBytes: 2 * 1024 * 1024,
            maxFiles: 1,
            sensitivity: "child_confidential",
            purpose: "Student profile photograph setup",
            order: 1
          } as never);
        }

        if (reqMedical) {
          const medicalApprovalId = await createMockApprovalEvidence({
            schoolId,
            approvalClass: "privacy",
            subjectType: "admissions_document_requirement",
            subjectKey: "medical_records"
          } as never);

          await addRequirement({
            formVersionId: fVersionId,
            requirementKey: "medical_records",
            category: "medical",
            label: "Recent Medical Reports (within past 6 months)",
            requiredMode: "optional",
            acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
            maxBytes: 5 * 1024 * 1024,
            maxFiles: 1,
            sensitivity: "highly_sensitive",
            purpose: "Health planning support",
            retentionPolicyKey: "duration_of_enrollment",
            audience: "school_medical_officers_and_management",
            approvalEvidenceId: medicalApprovalId,
            order: 2
          } as never);
        }

        if (reqTranscripts) {
          await addRequirement({
            formVersionId: fVersionId,
            requirementKey: "transcripts",
            category: "academic",
            label: "Previous School Transcripts",
            requiredMode: "optional",
            acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
            maxBytes: 5 * 1024 * 1024,
            maxFiles: 2,
            sensitivity: "child_confidential",
            purpose: "Academic history verification",
            order: 3
          } as never);
        }

        // 6. Conditional publication logic based on targetStatus selection
        if (targetStatus === "published") {
          const previousPublished = catalogue?.forms?.find((f: any) => f.intakeId === intakeId && f.status === "published");
          if (previousPublished) {
            await retireForm({ formVersionId: previousPublished.id } as never);
          }
          await publishForm({ formVersionId: fVersionId } as never);
          
          if (intakeDoc?.status === "draft") {
            await setIntakeStatus({ intakeId: intakeId as any, status: "open" } as never);
          }
          appToast.success("Admissions form and intake cycle updated live!");
        } else {
          appToast.success("Admissions form changes saved as draft!");
        }
      } else {
        // --- CREATING A NEW INTAKE FORM ---
        // 1. Create Programme offering
        const progId = await createProgramme({
          schoolId,
          name: formName,
          slug: formSlug,
          description: formDescription || undefined
        } as never) as string;

        // 2. Create Intake Cycle
        const opens = opensAt ? new Date(opensAt).getTime() : Date.now();
        const closes = closesAt ? new Date(closesAt).getTime() : Date.now() + 30 * 24 * 60 * 60 * 1000;
        const intId = await createIntake({
          schoolId,
          programmeId: progId,
          name: formName,
          slug: formSlug,
          cycleLabel: academicCategory,
          opensAt: opens,
          closesAt: closes
        } as never) as string;

        // 3. Create Fee product
        const prodId = await createProduct({
          schoolId,
          intakeId: intId,
          name: "Intake registration fee slot",
          slug: formSlug
        } as never) as string;

        // 4. Create Draft form version
        const fVersionId = await createForm({
          schoolId,
          programmeId: progId,
          intakeId: intId,
          schemaVersion: "1"
        } as never) as string;

        // 5. Publish Application fee
        const amt = Number(feeAmount) || 0;
        const evidenceId = await createMockApprovalEvidence({
          schoolId,
          approvalClass: "finance",
          subjectType: "admissions_price",
          subjectKey: `${String(prodId)}:1`
        } as never);

        await publishPrice({
          productId: prodId as any,
          version: 1,
          amountMinor: amt,
          currency: feeCurrency,
          refundPolicyKey: feeRefundPolicy,
          feeDisclosure: feeDisclosure || "Standard admissions process fee",
          effectiveFrom: Date.now(),
          approvalEvidenceId: evidenceId
        } as never);

        // 6. Create declaration Attestation default
        const declId = await createDeclaration({
          schoolId,
          programmeId: progId,
          version: 1,
          title: declarationTitle,
          body: declarationBody,
          purpose: "service"
        } as never) as string;
        await publishDeclaration({ declarationVersionId: declId } as never);

        // 7. Loop over cards and append fields
        let currentSectionKey = "applicant";
        for (let i = 0; i < cards.length; i++) {
          const card = cards[i];
          if (card.isDefault) continue;
          if (card.type === "section") {
            currentSectionKey = card.key || "custom_section";
          } else {
            let fieldApprovalId = card.approvalEvidenceId || undefined;
            if ((card.dataClass === "highly_sensitive" || card.dataClass === "financial_security") && !fieldApprovalId) {
              fieldApprovalId = await createMockApprovalEvidence({
                schoolId,
                approvalClass: "privacy",
                subjectType: "admissions_field",
                subjectKey: card.key
              } as never);
            }

            let validationJsonVal = "{}";
            if (card.kind === "select" && Array.isArray(card.choices) && card.choices.length > 0) {
              validationJsonVal = JSON.stringify({ choices: card.choices });
            }

            await addField({
              formVersionId: fVersionId,
              fieldKey: card.key || `field_${i}`,
              sectionKey: currentSectionKey,
              kind: card.kind || "text",
              label: card.label || "Untitled Field",
              requiredMode: card.required ? "required" : "optional",
              dataClass: card.dataClass || "personal",
              purpose: (card.dataClass === "highly_sensitive" || card.dataClass === "financial_security") ? (card.purpose || "Required for admissions evaluation") : undefined,
              retentionPolicyKey: (card.dataClass === "highly_sensitive" || card.dataClass === "financial_security") ? (card.retentionPolicyKey || "duration_of_enrollment") : undefined,
              audience: (card.dataClass === "highly_sensitive" || card.dataClass === "financial_security") ? (card.audience || "school_admissions_staff") : undefined,
              approvalEvidenceId: fieldApprovalId,
              validationJson: validationJsonVal,
              order: i
            } as never);
          }
        }

        // 8. Add document checklist items
        await addRequirement({
          formVersionId: fVersionId,
          requirementKey: "birth_cert",
          category: "identity",
          label: "Birth Certificate",
          requiredMode: "required",
          acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
          maxBytes: 5 * 1024 * 1024,
          maxFiles: 1,
          sensitivity: "child_confidential",
          purpose: "Age and identity confirmation",
          order: 0
        } as never);

        if (reqPassport) {
          await addRequirement({
            formVersionId: fVersionId,
            requirementKey: "passport",
            category: "passport",
            label: "Passport Photograph (Clear headshot)",
            requiredMode: "required",
            acceptedMimeTypes: ["image/jpeg", "image/png"],
            maxBytes: 2 * 1024 * 1024,
            maxFiles: 1,
            sensitivity: "child_confidential",
            purpose: "Student profile photograph setup",
            order: 1
          } as never);
        }

        if (reqMedical) {
          const medicalApprovalId = await createMockApprovalEvidence({
            schoolId,
            approvalClass: "privacy",
            subjectType: "admissions_document_requirement",
            subjectKey: "medical_records"
          } as never);

          await addRequirement({
            formVersionId: fVersionId,
            requirementKey: "medical_records",
            category: "medical",
            label: "Recent Medical Reports (within past 6 months)",
            requiredMode: "optional",
            acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
            maxBytes: 5 * 1024 * 1024,
            maxFiles: 1,
            sensitivity: "highly_sensitive",
            purpose: "Health planning support",
            retentionPolicyKey: "duration_of_enrollment",
            audience: "school_medical_officers_and_management",
            approvalEvidenceId: medicalApprovalId,
            order: 2
          } as never);
        }

        if (reqTranscripts) {
          await addRequirement({
            formVersionId: fVersionId,
            requirementKey: "transcripts",
            category: "academic",
            label: "Previous School Transcripts",
            requiredMode: "optional",
            acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
            maxBytes: 5 * 1024 * 1024,
            maxFiles: 2,
            sensitivity: "child_confidential",
            purpose: "Academic history verification",
            order: 3
          } as never);
        }

        // 9. Conditional publication logic based on targetStatus selection
        if (targetStatus === "published") {
          await publishForm({ formVersionId: fVersionId } as never);
          await setIntakeStatus({ intakeId: intId as any, status: "open" } as never);
          appToast.success("Admissions form and intake cycle published live!");
        } else {
          appToast.success("Admissions form created and saved as draft!");
        }
      }

      localStorage.removeItem(`admissions_form_draft_${schoolId}`);
      onSuccess();
    } catch (err) {
      appToast.error("Form publication failed", { description: getUserFacingErrorMessage(err, "An error occurred while publishing the form.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="flex-grow flex flex-col lg:flex-row h-full w-full overflow-hidden bg-slate-100"
    >
      {/* LEFT COLUMN: Scrollable visual builder canvas */}
      <div 
        ref={canvasRef}
        className="flex-1 h-full overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-6 pb-24 bg-slate-100"
      >
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Compact Back navigation button */}
          <button 
            onClick={onCancel}
            className="h-9 px-4 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all w-fit mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> Return to Admissions Panel
          </button>

          {draftExists && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center justify-between text-xs font-bold text-indigo-900 shadow-sm animate-in slide-in-from-top-4 duration-200">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                <span>We found an unsaved draft from a previous session. Would you like to load it?</span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleLoadDraft}
                  className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-all shadow-sm"
                >
                  Load Draft
                </button>
                <button 
                  onClick={handleDiscardDraft}
                  className="h-7 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-md transition-all shadow-sm"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Google Form Header Card */}
          <div className="bg-white border-t-[8px] border-indigo-600 border-x border-b border-slate-300 rounded-lg p-6 shadow-sm space-y-4">
            <div>
              <input 
                type="text" 
                value={formName}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="Admission Form Name (e.g. Primary School Intake 2026)" 
                className="w-full text-xl font-bold font-outfit text-slate-900 border-b border-transparent focus:border-slate-300 py-1 focus:outline-none transition-all"
              />
              <input 
                type="text" 
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Form Public Display Description (e.g. Please complete your registration details...)" 
                className="w-full text-xs text-slate-700 border-b border-transparent focus:border-slate-300 py-1 focus:outline-none transition-all mt-2 font-semibold"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 pt-3 border-t border-slate-200 text-xs font-semibold">
              <label className="block text-slate-650 uppercase tracking-wider">Category Academic Level
                <select 
                  value={academicCategory}
                  onChange={e => setAcademicCategory(e.target.value)}
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-300 bg-white px-2 focus:outline-none font-sans text-slate-900"
                >
                  <option value="Primary School">Primary School (Year 1-6)</option>
                  <option value="Junior Secondary">Junior Secondary School (JSS 1-3)</option>
                  <option value="Senior Secondary">Senior Secondary School (SSS 1-3)</option>
                </select>
              </label>
              <label className="block text-slate-650 uppercase tracking-wider">Form URL Slug
                <input 
                  type="text" 
                  value={formSlug}
                  onChange={e => {
                    const val = e.target.value;
                    const slugified = val.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-");
                    setFormSlug(slugified);
                  }}
                  placeholder="e.g. autumn-2026" 
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-3 focus:outline-none font-mono text-slate-900"
                />
                {schoolSlug && (
                  <p className="mt-1.5 text-[10px] text-slate-500 font-medium font-sans">
                    Apply Link Preview:{" "}
                    <span className="font-mono text-indigo-650 font-bold bg-indigo-50/50 px-1 py-0.5 rounded border border-indigo-100/50 break-all">
                      {typeof window !== "undefined" && window.location.origin.includes("localhost:3002")
                        ? `http://localhost:3006/s/${schoolSlug}/i/${formSlug || "[slug]"}`
                        : `${window.location.origin.replace("admin.", "apply.")}/s/${schoolSlug}/i/${formSlug || "[slug]"}`
                      }
                    </span>
                  </p>
                )}
              </label>
            </div>
          </div>

          {/* Verification Requirements Checkboxes */}
          <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-sm space-y-4">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Verification Document Requirements</h4>
            <div className="space-y-3 text-xs font-bold text-slate-800">
              <label className="flex items-center gap-2.5 cursor-not-allowed">
                <input type="checkbox" checked disabled className="rounded border-slate-350 text-indigo-650 focus:ring-0" />
                Birth Certificate (Mandatory Default)
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={reqPassport} 
                  onChange={e => setReqPassport(e.target.checked)}
                  className="rounded border-slate-350 text-indigo-655 focus:ring-0" 
                />
                Passport Photograph (Recommended Default for profile picture mapping)
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={reqMedical} 
                  onChange={e => setReqMedical(e.target.checked)}
                  className="rounded border-slate-350 text-indigo-655 focus:ring-0" 
                />
                Recent Medical Reports (within past 6 months)
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={reqTranscripts} 
                  onChange={e => setReqTranscripts(e.target.checked)}
                  className="rounded border-slate-350 text-indigo-655 focus:ring-0" 
                />
                Previous School Transcripts (optional)
              </label>
            </div>
          </div>

          {/* Google Forms Dynamic Cards canvas */}
          <div className="space-y-4" id="flat-builder-canvas">
            {cards.map((card) => {
              const isCollapsed = card.isDefault && !card.enabled;
              if (isCollapsed) {
                return (
                  <div 
                    key={card.id}
                    id={card.id}
                    onClick={() => handleCardClick(card.id)}
                    className={`bg-slate-200 border-2 border-slate-300 rounded-lg px-5 py-3.5 flex items-center justify-between text-xs font-semibold text-slate-800 hover:border-slate-400 transition-all select-none relative ${
                      focusedCardId === card.id ? "g-form-card-active border-indigo-500 shadow-sm" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Lock className="h-4 w-4 text-slate-700" />
                      <span className="font-bold text-slate-800 line-through text-sm">{card.label}</span>
                      <span className="text-[10px] bg-slate-300 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">fieldKey: {card.key}</span>
                    </div>
                    <div className="flex items-center gap-4 text-slate-800">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Hidden in Form</span>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={card.enabled} 
                          onChange={(e) => handleToggleDefaultField(card.id, e.target.checked)}
                          className="rounded border-slate-400 text-indigo-655 focus:ring-0" 
                        />
                        Include in Form
                      </label>
                    </div>

                    {/* Inline responsive floating insert toolbar on collapsed default cards */}
                    {focusedCardId === card.id && (
                      <>
                        {/* Desktop view floating on the right */}
                        <div 
                          className="absolute right-[-44px] top-1.5 hidden md:flex flex-col items-center gap-1.5 w-9 bg-white border border-slate-300 rounded-lg shadow-md p-1 z-10 select-none animate-in fade-in zoom-in-95 duration-150"
                        >
                          <button 
                            onClick={(e) => { e.stopPropagation(); insertQuestion(); }}
                            className="h-7 w-7 rounded-md hover:bg-slate-100 text-slate-750 hover:text-indigo-655 flex items-center justify-center transition-all"
                            title="Add Question"
                          >
                            <Plus className="h-4.5 w-4.5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); insertSection(); }}
                            className="h-7 w-7 rounded-md hover:bg-slate-100 text-slate-750 hover:text-indigo-655 flex items-center justify-center transition-all"
                            title="Add Section divider"
                          >
                            <FolderPlus className="h-4.5 w-4.5" />
                          </button>
                        </div>

                        {/* Mobile view embedded at the bottom right */}
                        <div 
                          className="absolute bottom-2 right-2 flex md:hidden flex-row items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg p-1 z-10 select-none"
                        >
                          <button 
                            onClick={(e) => { e.stopPropagation(); insertQuestion(); }}
                            className="h-7 w-7 rounded-md bg-white border border-slate-200 text-slate-750 hover:text-indigo-655 flex items-center justify-center shadow-sm"
                            title="Add Question"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); insertSection(); }}
                            className="h-7 w-7 rounded-md bg-white border border-slate-200 text-slate-750 hover:text-indigo-655 flex items-center justify-center shadow-sm"
                            title="Add Section divider"
                          >
                            <FolderPlus className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              }

              const hasCardError = !card.isDefault && (isDuplicateKey(card.id, card.key) || isInvalidKeyFormat(card.key));

              return (
                <div
                  key={card.id}
                  id={card.id}
                  onClick={() => handleCardClick(card.id)}
                  onDragOver={(e) => handleDragOver(e, card.id)}
                  className={`draggable-card border rounded-lg p-5 shadow-sm space-y-4 transition-all duration-200 relative ${
                    card.isDefault ? "bg-white border-2 border-slate-350" : "bg-white border border-slate-250"
                  } ${
                    hasCardError ? "border-rose-500 bg-rose-50/10 ring-1 ring-rose-500" : ""
                  } ${
                    focusedCardId === card.id && !hasCardError ? "g-form-card-active border-indigo-500 shadow-md" : ""
                  }`}
                >
                  {/* Drag Grip Handle or Lock status */}
                  <div 
                    draggable={!card.isDefault} 
                    onDragStart={() => handleDragStart(card.id)}
                    className={`flex justify-center py-0.5 absolute top-1 left-0 right-0 ${
                      card.isDefault ? "cursor-not-allowed text-slate-400 hover:text-slate-600" : "cursor-move text-slate-350 hover:text-slate-500"
                    }`}
                  >
                    {card.isDefault ? <Lock className="h-3 w-3" /> : <GripHorizontal className="h-4 w-4" />}
                  </div>

                  {card.type === "section" ? (
                    /* Section divider card UI */
                    <div className="flex items-center justify-between gap-4 pt-2">
                      <div className="flex items-center gap-2 flex-grow">
                        {!card.isDefault && (
                          <span className="bg-slate-900 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded">Section</span>
                        )}
                        <input 
                          type="text" 
                          value={card.label}
                          onChange={e => handleUpdateCardLabel(card.id, e.target.value)}
                          placeholder="Section Title (e.g. Guardian Contacts)" 
                          className="bg-transparent font-bold text-slate-900 text-sm border-b border-transparent focus:border-indigo-500 focus:outline-none w-full py-0.5 font-outfit"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-660 font-mono flex-shrink-0 font-bold">
                        <span>System ID:</span>
                        {!card.isDefault ? (
                          <div className="flex items-center gap-1">
                            <input 
                              type="text"
                              value={card.key}
                              onChange={e => handleUpdateCardKey(card.id, e.target.value)}
                              placeholder="section_slug"
                              className={`h-6 w-32 px-1.5 rounded border text-[10px] font-mono focus:outline-none focus:border-indigo-500 bg-slate-50 ${
                                isDuplicateKey(card.id, card.key) || isInvalidKeyFormat(card.key)
                                  ? "border-rose-500 bg-rose-50 text-rose-800 focus:border-rose-500" 
                                  : "border-slate-300"
                              }`}
                            />
                            {isDuplicateKey(card.id, card.key) && (
                              <span className="text-[9px] text-rose-600 font-bold ml-1">
                                ⚠️ Duplicate (used by "{getConflictingCardLabel(card.id, card.key)}")!
                              </span>
                            )}
                            {!isDuplicateKey(card.id, card.key) && isInvalidKeyFormat(card.key) && (
                              <span className="text-[9px] text-rose-600 font-bold ml-1">⚠️ Invalid slug!</span>
                            )}
                          </div>
                        ) : (
                          <span className="font-bold text-slate-800 w-24 truncate">{card.key || "auto_key"}</span>
                        )}
                        {!card.isDefault && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id); }}
                            className="text-slate-450 hover:text-rose-600 transition-colors ml-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Question card UI */
                    <div className="space-y-4 pt-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <input 
                            type="text" 
                            value={card.label}
                            onChange={e => handleUpdateCardLabel(card.id, e.target.value)}
                            placeholder="Question Label Text" 
                            className="w-full font-bold text-slate-900 border-b border-slate-200 hover:border-slate-350 focus:border-indigo-500 py-1.5 focus:outline-none transition-all text-sm font-outfit"
                          />
                        </div>
                        <div className="w-48 flex-shrink-0">
                          <select 
                            value={card.kind}
                            disabled={card.isDefault}
                            onChange={e => handleUpdateCardKind(card.id, e.target.value)}
                            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 focus:outline-none text-xs font-semibold text-slate-900 disabled:opacity-75 disabled:bg-slate-100"
                          >
                            <option value="text">Single Line Text</option>
                            <option value="textarea">Paragraph Text</option>
                            <option value="select">Multiple Choice Dropdown</option>
                            <option value="boolean">Yes / No Option</option>
                            <option value="date">Date picker</option>
                            <option value="email">Email input</option>
                            <option value="phone">Phone number</option>
                          </select>
                        </div>
                      </div>

                      {card.kind === "select" && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                            Dropdown Choices / Options
                          </span>
                          
                          {/* Option tags */}
                          <div className="flex flex-wrap gap-1.5">
                            {(!card.choices || card.choices.length === 0) ? (
                              <span className="text-xs text-slate-400 italic font-medium font-sans">No options added yet. Add at least one option below.</span>
                            ) : (
                              card.choices.map((choice, oIdx) => (
                                <span 
                                  key={oIdx} 
                                  className="inline-flex items-center gap-1.5 bg-white border border-slate-250 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm"
                                >
                                  {choice}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedChoices = card.choices?.filter((_, ci) => ci !== oIdx) || [];
                                      setCards(prev => prev.map(c => c.id === card.id ? { ...c, choices: updatedChoices } : c));
                                    }}
                                    className="text-slate-400 hover:text-rose-650 transition-colors ml-0.5 text-xs font-black"
                                    title="Remove option"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))
                            )}
                          </div>

                          {/* Add option control */}
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              placeholder="e.g. Option text (press Enter)"
                              id={`new-opt-input-${card.id}`}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const target = e.currentTarget;
                                  const val = target.value.trim();
                                  if (val) {
                                    const currentChoices = card.choices || [];
                                    if (!currentChoices.includes(val)) {
                                      setCards(prev => prev.map(c => c.id === card.id ? { ...c, choices: [...currentChoices, val] } : c));
                                    }
                                    target.value = "";
                                  }
                                }
                              }}
                              className="h-8 flex-1 rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500 font-sans"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const inputEl = document.getElementById(`new-opt-input-${card.id}`) as HTMLInputElement | null;
                                if (inputEl) {
                                  const val = inputEl.value.trim();
                                  if (val) {
                                    const currentChoices = card.choices || [];
                                    if (!currentChoices.includes(val)) {
                                      setCards(prev => prev.map(c => c.id === card.id ? { ...c, choices: [...currentChoices, val] } : c));
                                    }
                                    inputEl.value = "";
                                  }
                                }
                              }}
                              className="h-8 rounded bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 shadow-sm transition-all"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-655 font-bold">
                          <span>fieldKey:</span>
                          {!card.isDefault ? (
                            <div className="flex items-center gap-1.5">
                              <input 
                                type="text"
                                value={card.key}
                                onChange={e => handleUpdateCardKey(card.id, e.target.value)}
                                placeholder="field_slug"
                                className={`h-6 w-40 px-1.5 rounded border text-[10px] font-mono focus:outline-none focus:border-indigo-500 bg-slate-50 ${
                                  isDuplicateKey(card.id, card.key) || isInvalidKeyFormat(card.key)
                                    ? "border-rose-500 bg-rose-50 text-rose-800 focus:border-rose-500" 
                                    : "border-slate-300"
                                }`}
                              />
                              {isDuplicateKey(card.id, card.key) && (
                                <span className="text-[9px] text-rose-600 font-bold ml-1">
                                  ⚠️ Duplicate (used by "{getConflictingCardLabel(card.id, card.key)}")!
                                </span>
                              )}
                              {!isDuplicateKey(card.id, card.key) && isInvalidKeyFormat(card.key) && (
                                <span className="text-[9px] text-rose-600 font-bold ml-1">⚠️ Invalid slug!</span>
                              )}
                            </div>
                          ) : (
                            <span className="font-bold text-slate-800 w-32 truncate">{card.key || "auto_key"}</span>
                          )}
                          {card.isDefault && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[9px] bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded font-sans uppercase font-bold border border-indigo-200">
                              <Lock className="h-2 w-2" /> Locked System Field
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-slate-700 font-bold">
                          {card.isDefault && !card.isMandatory && (
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={card.enabled} 
                                onChange={(e) => handleToggleDefaultField(card.id, e.target.checked)}
                                className="rounded border-slate-350 text-indigo-650 focus:ring-0" 
                              />
                              Include in Form
                            </label>
                          )}
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={card.required}
                              disabled={card.isMandatory || (card.isDefault && !card.enabled)}
                              onChange={e => handleUpdateCardRequired(card.id, e.target.checked)}
                              className="rounded border-slate-350 text-indigo-655 focus:ring-0 disabled:opacity-50" 
                            />
                            Required
                          </label>
                          {!card.isDefault && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedPrivacyCardId(prev => prev === card.id ? null : card.id);
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold transition-all ${
                                expandedPrivacyCardId === card.id
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : (card.dataClass === "highly_sensitive" || card.dataClass === "financial_security")
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-slate-50 text-slate-655 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              <ShieldAlert className="h-3.5 w-3.5" /> Privacy Settings
                            </button>
                          )}
                          {!card.isDefault && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id); }}
                              className="text-slate-450 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {!card.isDefault && expandedPrivacyCardId === card.id && (
                        <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                          <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            Privacy & Sensitivity Settings
                          </h4>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Data Class / Sensitivity</label>
                              <select
                                value={card.dataClass || "personal"}
                                onChange={e => {
                                  const val = e.target.value as any;
                                  setCards(prev => prev.map(c => c.id === card.id ? { ...c, dataClass: val } : c));
                                }}
                                className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:border-indigo-500 font-semibold text-slate-900"
                              >
                                <option value="public">Public</option>
                                <option value="internal">Internal</option>
                                <option value="personal">Personal</option>
                                <option value="child_confidential">Child Confidential</option>
                                <option value="highly_sensitive">Highly Sensitive</option>
                                <option value="financial_security">Financial Security</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Approval Evidence</label>
                              <select
                                value={card.approvalEvidenceId || ""}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCards(prev => prev.map(c => c.id === card.id ? { ...c, approvalEvidenceId: val } : c));
                                }}
                                className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:border-indigo-500 font-semibold text-slate-900"
                              >
                                <option value="">Auto-Generate Mock Approval (Recommended)</option>
                                {evidence?.filter(ev => ev.active).map(ev => (
                                  <option key={ev.id} value={ev.id}>{ev.approvalClass} · {ev.subjectKey}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {(card.dataClass === "highly_sensitive" || card.dataClass === "financial_security") && (
                            <div className="space-y-2 pt-2 border-t border-slate-200">
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Purpose</label>
                                  <input
                                    type="text"
                                    value={card.purpose || ""}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setCards(prev => prev.map(c => c.id === card.id ? { ...c, purpose: val } : c));
                                    }}
                                    placeholder="e.g. Assessment support"
                                    className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-900 font-semibold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Retention Policy</label>
                                  <input
                                    type="text"
                                    value={card.retentionPolicyKey || ""}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setCards(prev => prev.map(c => c.id === card.id ? { ...c, retentionPolicyKey: val } : c));
                                    }}
                                    placeholder="e.g. duration_of_enrollment"
                                    className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-900 font-semibold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Audience</label>
                                  <input
                                    type="text"
                                    value={card.audience || ""}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setCards(prev => prev.map(c => c.id === card.id ? { ...c, audience: val } : c));
                                    }}
                                    placeholder="e.g. admissions_staff"
                                    className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-900 font-semibold"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline responsive floating insert toolbar on default or custom cards */}
                  {focusedCardId === card.id && (
                    <>
                      {/* Desktop view floating on the right */}
                      <div 
                        className="absolute right-[-44px] top-6 hidden md:flex flex-col items-center gap-1.5 w-9 bg-white border border-slate-300 rounded-lg shadow-md p-1 z-10 select-none animate-in fade-in zoom-in-95 duration-150"
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); insertQuestion(); }}
                          className="h-7 w-7 rounded-md hover:bg-slate-100 text-slate-750 hover:text-indigo-655 flex items-center justify-center transition-all"
                          title="Add Question"
                        >
                          <Plus className="h-4.5 w-4.5" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); insertSection(); }}
                          className="h-7 w-7 rounded-md hover:bg-slate-100 text-slate-750 hover:text-indigo-655 flex items-center justify-center transition-all"
                          title="Add Section divider"
                        >
                          <FolderPlus className="h-4.5 w-4.5" />
                        </button>
                      </div>

                      {/* Mobile view embedded at the bottom right */}
                      <div 
                        className="absolute bottom-2 right-2 flex md:hidden flex-row items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg p-1 z-10 select-none"
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); insertQuestion(); }}
                          className="h-7 w-7 rounded-md bg-white border border-slate-200 text-slate-755 hover:text-indigo-655 flex items-center justify-center shadow-sm"
                          title="Add Question"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); insertSection(); }}
                          className="h-7 w-7 rounded-md bg-white border border-slate-200 text-slate-755 hover:text-indigo-655 flex items-center justify-center shadow-sm"
                          title="Add Section divider"
                        >
                          <FolderPlus className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Pinned, independently scrolling advanced settings sidebar */}
      <aside 
        className="w-full lg:w-[340px] h-full overflow-y-auto border-l border-slate-200 bg-white/95 backdrop-blur-xl custom-scrollbar shrink-0 p-5 space-y-5"
      >
        
        {/* 1. Pre-flight Readiness Checklist */}
        <div className="space-y-3 pb-5 border-b border-slate-150">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-1.5 font-sans">
            <ShieldAlert className="h-3.5 w-3.5 text-indigo-650" />
            Pre-flight Readiness Audit
          </h4>
          <div className="space-y-2 text-[11px] font-bold text-slate-800">
            {/* Slugs check */}
            <div className="flex items-start gap-2">
              {cards.some(c => !c.isDefault && isInvalidKeyFormat(c.key)) || 
               (new Set(cards.map(c => c.key).filter(Boolean)).size !== cards.map(c => c.key).filter(Boolean).length) ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-500">Resolve duplicate or invalid slug keys.</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">All System IDs are valid and unique.</span>
                </>
              )}
            </div>

            {/* Price check */}
            <div className="flex items-start gap-2">
              {Number(feeAmount) <= 0 ? (
                <>
                  <Info className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-555">Form has no fee set (Free Enrollment).</span>
                </>
              ) : !feeDisclosure ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-500">Pricing needs a statement label.</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">Fee: {feeCurrency} {feeAmount}.</span>
                </>
              )}
            </div>

            {/* Attestation check */}
            <div className="flex items-start gap-2">
              {!declarationTitle || !declarationBody ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-500">Legal attestation terms are required.</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">Legal Declaration active.</span>
                </>
              )}
            </div>

            {/* Sensitive privacy check */}
            <div className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span className="text-slate-700 font-sans">Sensitive privacy rules auto-approved.</span>
            </div>
          </div>
        </div>

        {/* 2. Guardian Attestation Editor */}
        <div className="space-y-3 pb-5 border-b border-slate-150">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5 font-sans">
            Guardian Legal Declaration
          </h4>
          <div className="space-y-2.5 text-xs font-semibold">
            <label className="block text-slate-500 uppercase tracking-wider text-[9px] font-bold">Attestation Title
              <input 
                type="text"
                value={declarationTitle}
                onChange={e => setDeclarationTitle(e.target.value)}
                placeholder="e.g. Declaration of Guardians"
                className="mt-1 h-8 w-full rounded border border-slate-300 px-2.5 focus:outline-none text-slate-900 font-bold text-xs"
              />
            </label>
            <label className="block text-slate-500 uppercase tracking-wider text-[9px] font-bold">Attestation Terms
              <textarea
                rows={3}
                value={declarationBody}
                onChange={e => setDeclarationBody(e.target.value)}
                placeholder="Provide legal terms guardians must attest to..."
                className="mt-1 w-full rounded border border-slate-300 p-2 focus:outline-none text-slate-900 font-medium font-sans text-[11px] resize-none"
              />
            </label>
          </div>
        </div>

        {/* 3. Pricing & Fee details Card */}
        <div className="space-y-3 pb-5 border-b border-slate-150">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5 font-sans">
            Application Pricing & Payments
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <label className="block text-slate-500 uppercase tracking-wider text-[9px] font-bold">Currency
              <select 
                value={feeCurrency}
                onChange={e => setFeeCurrency(e.target.value)}
                className="mt-1 h-8 w-full rounded border border-slate-300 bg-white px-2 focus:outline-none text-slate-900 text-xs"
              >
                <option value="NGN">NGN (₦)</option>
                <option value="USD">USD ($)</option>
              </select>
            </label>
            <label className="block text-slate-500 uppercase tracking-wider text-[9px] font-bold">Fee Amount
              <input 
                type="number" 
                value={feeAmount}
                onChange={e => setFeeAmount(e.target.value)}
                placeholder="e.g. 15000" 
                className="mt-1 h-8 w-full rounded border border-slate-300 px-2.5 focus:outline-none font-sans font-bold text-slate-900 text-xs"
              />
            </label>
            <label className="block text-slate-500 uppercase tracking-wider text-[9px] font-bold col-span-2">Refund Policy
              <select 
                value={feeRefundPolicy}
                onChange={e => setFeeRefundPolicy(e.target.value)}
                className="mt-1 h-8 w-full rounded border border-slate-300 bg-white px-2 focus:outline-none text-slate-900 text-xs"
              >
                <option value="non_refundable">Strictly Non-Refundable</option>
                <option value="conditional">Refundable on rejection</option>
                <option value="free">No Fee / Free Enrollment</option>
              </select>
            </label>
            <label className="block text-slate-500 uppercase tracking-wider text-[9px] font-bold col-span-2">Payment Statement (feeDisclosure)
              <input 
                type="text" 
                value={feeDisclosure}
                onChange={e => setFeeDisclosure(e.target.value)}
                placeholder="e.g. JSS 1 Admissions Processing Fee" 
                className="mt-1 h-8 w-full rounded border border-slate-300 px-2.5 focus:outline-none font-sans font-bold text-slate-900 text-xs"
              />
            </label>
          </div>
        </div>

        {/* 4. Actions bar with Split Button Dropdown */}
        <div className="pt-2 flex flex-col gap-2 relative">
          <div className="relative flex items-stretch rounded-lg shadow-sm">
            {/* Main Action Button */}
            <button 
              onClick={() => void handlePublish()}
              disabled={saving}
              className="flex-grow h-9 bg-slate-900 hover:bg-slate-850 disabled:opacity-50 text-white font-bold px-4 rounded-l-lg text-xs transition-all flex items-center justify-center gap-1.5 border-r border-slate-800"
            >
              {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
              {targetStatus === "draft" ? "Save Campaign Draft" : "Publish Form Live"}
            </button>

            {/* Dropdown Toggle Trigger */}
            <button
              type="button"
              disabled={saving || (intakeDoc?.status && intakeDoc.status !== "draft")}
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(!dropdownOpen);
              }}
              className="h-9 w-9 bg-slate-900 hover:bg-slate-850 disabled:opacity-50 text-white flex items-center justify-center rounded-r-lg border-l border-slate-750 transition-all focus:outline-none"
              title="Change save target status"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown Menu (pops up above the button) */}
            {dropdownOpen && (
              <>
                {/* Backdrop overlay to close when clicking outside */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setDropdownOpen(false)}
                />
                
                <div className="absolute bottom-full right-0 mb-1.5 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-1 animate-in fade-in slide-in-from-bottom-2 duration-150 text-left">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetStatus("draft");
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs font-semibold flex flex-col gap-0.5 hover:bg-slate-50 transition-colors ${
                      targetStatus === "draft" ? "text-indigo-650 bg-indigo-50/50" : "text-slate-700"
                    }`}
                  >
                    <span>Save as Draft (Offline)</span>
                    <span className="text-[10px] text-slate-400 font-medium">Keep intake offline while editing form</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetStatus("published");
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs font-semibold flex flex-col gap-0.5 hover:bg-slate-50 transition-colors mt-0.5 ${
                      targetStatus === "published" ? "text-indigo-650 bg-indigo-50/50" : "text-slate-700"
                    }`}
                  >
                    <span>Publish Form Live (Open Campaign)</span>
                    <span className="text-[10px] text-slate-400 font-medium">Promote form and open the admissions intake</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {intakeDoc?.status && intakeDoc.status !== "draft" && (
            <p className="text-[9px] text-slate-400 font-medium font-sans text-center mt-0.5">
              * Campaign is already live and cannot be returned to draft state.
            </p>
          )}

          <button 
            onClick={onCancel}
            className="h-9 w-full border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold px-4 rounded-lg text-xs transition-all shadow-sm bg-white mt-1"
          >
            Cancel & Exit
          </button>
        </div>

      </aside>
    </div>
  );
}
