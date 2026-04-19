import { paymentMethods } from "./constants";

export type DashboardFilters = {
  classId: string;
  sessionId: string;
  termId: string;
  status: string;
  search: string;
};

export type SortDirection = "asc" | "desc";

export type InvoiceSortKey = "date" | "reference" | "recipient" | "amount" | "status";
export type PaymentSortKey = "date" | "reference" | "identifier" | "recipient" | "settlement";
export type FeePlanSortKey = "date" | "name" | "amount" | "status";

export type BillingSortPreferences = {
  invoices: {
    key: InvoiceSortKey;
    direction: SortDirection;
  };
  payments: {
    key: PaymentSortKey;
    direction: SortDirection;
  };
  plans: {
    key: FeePlanSortKey;
    direction: SortDirection;
  };
};

export type FeePlanDraftItem = {
  draftId: string;
  label: string;
  amount: string;
  category: "tuition" | "boarding" | "transport" | "exam" | "activity" | "other";
};

export type FeePlanDraft = {
  name: string;
  description: string;
  currency: string;
  billingMode: "class_default" | "manual_extra";
  targetClassIds: string[];
  installmentEnabled: boolean;
  installmentCount: string;
  intervalDays: string;
  firstDueDays: string;
  lineItems: FeePlanDraftItem[];
};

export type FeePlanApplicationDraft = {
  feePlanId: string;
  classId: string;
  sessionId: string;
  termId: string;
  notes: string;
};

export type InvoiceDraft = {
  feePlanId: string;
  classId: string;
  sessionId: string;
  termId: string;
  studentId: string;
  waiverAmount: string;
  discountAmount: string;
  dueDate: string;
  notes: string;
};

export type PaymentDraft = {
  invoiceId: string;
  reference: string;
  amountReceived: string;
  paymentMethod: (typeof paymentMethods)[number]["value"];
  payerName: string;
  payerEmail: string;
  notes: string;
};

export type BillingSettingsDraft = {
  invoicePrefix: string;
  defaultCurrency: string;
  defaultDueDays: string;
  paymentProviderMode: "test" | "live";
  allowManualPayments: boolean;
  allowOnlinePayments: boolean;
};

export type PaystackProviderModeState = {
  provider: "paystack";
  mode: "test" | "live";
  isEnabled: boolean;
  status: "not_configured" | "invalid" | "ready" | "disabled" | "rotation_pending";
  publicKeyMasked: string | null;
  activeSecretMasked: string | null;
  pendingSecretMasked: string | null;
  publicKeyFingerprint: string | null;
  activeSecretFingerprint: string | null;
  pendingSecretFingerprint: string | null;
  lastValidatedAt: number | null;
  lastValidationMessage: string | null;
  hasActiveSecret: boolean;
  hasPendingSecret: boolean;
  readyForPayments: boolean;
  readyForWebhookVerification: boolean;
};

export type PaystackProviderOverview = {
  provider: "paystack";
  activeMode: "test" | "live";
  allowOnlinePayments: boolean;
  readyForPayments: boolean;
  modes: {
    test: PaystackProviderModeState;
    live: PaystackProviderModeState;
  };
};

export type PaystackGatewayConfigDraft = {
  publicKey: string;
  secretKey: string;
};

export type PaymentLinkDraft = {
  invoiceId: string;
  amount: string;
  email: string;
  description: string;
  callbackUrl: string;
};

export type PaymentLinkResult = {
  provider: string;
  reference: string;
  authorizationUrl: string | null;
  accessCode: string | null;
  checkoutPayload: Record<string, unknown>;
};

export type ClassOption = {
  _id: string;
  name: string;
};

export type SessionOption = {
  _id: string;
  name: string;
};

export type TermOption = {
  _id: string;
  name: string;
};

export type StudentOption = {
  _id: string;
  studentName: string;
  admissionNumber: string;
};

export type BillingDashboardData = {
  school: {
    id: string;
    name: string;
    slug: string;
  };
  settings: {
    _id: string;
    invoicePrefix: string;
    defaultCurrency: string;
    defaultDueDays: number;
    preferredProvider: string;
    paymentProviderMode: "test" | "live";
    allowManualPayments: boolean;
    allowOnlinePayments: boolean;
  } | null;
  paymentGateway: PaystackProviderOverview;
  summary: {
    totalInvoiceAmount: number;
    amountCollected: number;
    outstandingBalance: number;
    overdueInvoices: number;
    paidInvoices: number;
    unreconciledPayments: number;
    manualPayments: number;
    gatewayPayments: number;
    invoiceCount: number;
    paymentCount: number;
    paymentAttemptCount: number;
    pendingPaymentAttempts: number;
    manualAttentionPaymentAttempts: number;
    feePlanCount: number;
    feePlanApplicationCount: number;
    gatewayEventCount: number;
  };
  feePlans: Array<{
    _id: string;
    name: string;
    currency: string;
    billingMode: "class_default" | "manual_extra";
    targetClassIds: string[];
    lineItems: Array<{ id: string; label: string; amount: number; category: string; order: number }>;
    installmentPolicy: {
      enabled: boolean;
      installmentCount: number;
      intervalDays: number;
      firstDueDays: number;
    };
    isActive: boolean;
    description: string | null;
    createdAt: number;
    updatedAt: number;
    createdBy: string;
    updatedBy: string;
  }>;
  applications: Array<{
    application: {
      _id: string;
      feePlanId: string;
      classId: string;
      sessionId: string;
      termId: string;
      studentCount: number;
      createdInvoiceCount: number;
      skippedInvoiceCount: number;
      notes: string | null;
      createdAt: number;
      updatedAt: number;
      createdBy: string;
    };
    feePlanName: string;
    className: string;
    sessionName: string;
    termName: string;
  }>;
  invoices: Array<{
    invoice: {
      _id: string;
      invoiceNumber: string;
      feePlanNameSnapshot: string;
      feePlanApplicationId: string | null;
      currency: string;
      totalAmount: number;
      amountPaid: number;
      balanceDue: number;
      status: string;
      dueDate: number;
      issuedAt: number;
      notes: string | null;
    };
    studentName: string;
    className: string;
    sessionName: string;
    termName: string;
  }>;
  payments: Array<{
    payment: {
      _id: string;
      invoiceId: string;
      reference: string;
      gatewayReference: string | null;
      provider: string | null;
      paymentMethod: string;
      amountReceived: number;
      amountApplied: number;
      unappliedAmount: number;
      applicationStatus: string;
      status: string;
      payerName: string | null;
      payerEmail: string | null;
      receivedAt: number;
      reconciliationStatus: string;
      reconciledAt: number | null;
      notes: string | null;
    };
    invoiceNumber: string;
    studentName: string;
    className: string;
    sessionName: string;
    termName: string;
  }>;
  paymentAttempts: Array<{
    attempt: {
      _id: string;
      invoiceId: string;
      provider: string;
      reference: string;
      gatewayReference: string | null;
      authorizationUrl: string | null;
      accessCode: string | null;
      amount: number;
      currency: string;
      status:
        | "link_generated"
        | "awaiting_payer_return"
        | "verified"
        | "webhook_reconciled"
        | "manual_attention_needed";
      reconciliationSource: "return_page" | "webhook" | "admin_poll" | null;
      checkoutPayload: Record<string, unknown>;
      callbackUrl: string | null;
      paymentId: string | null;
      gatewayEventId: string | null;
      lastCheckedAt: number | null;
      resolvedAt: number | null;
      resolutionMessage: string | null;
      createdAt: number;
      updatedAt: number;
    };
    invoiceNumber: string;
    studentName: string;
    className: string;
    sessionName: string;
    termName: string;
  }>;
  gatewayEvents: Array<{
    _id: string;
    provider: string;
    eventId: string;
    eventType: string;
    reference: string;
    invoiceNumber: string | null;
    paymentId: string | null;
    signatureValid: boolean;
    verificationStatus: string;
    processedAt: number | null;
    verificationMessage: string | null;
    receivedAt: number;
  }>;
};
