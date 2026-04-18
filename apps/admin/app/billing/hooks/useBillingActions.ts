import { useAction, useMutation } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";
import type { 
  FeePlanDraft, 
  FeePlanApplicationDraft, 
  InvoiceDraft, 
  PaymentDraft, 
  BillingSettingsDraft, 
  PaystackGatewayConfigDraft,
  PaymentLinkDraft,
  PaymentLinkResult
} from "../types";

export function useBillingActions(setNotice: (n: any) => void) {
  const saveBillingSettings = useMutation("functions/billing:upsertBillingSettings" as never);
  const saveSchoolPaystackGatewayConfig = useMutation("functions/billingProviders:saveSchoolPaystackGatewayConfig" as never);
  const validateSchoolPaystackGatewayConfig = useAction("functions/billingProviders:validateSchoolPaystackGatewayConfig" as never);
  const createFeePlan = useMutation("functions/billing:createFeePlan" as never);
  const createInvoice = useMutation("functions/billing:createInvoiceFromFeePlan" as never);
  const applyFeePlanToClassStudents = useMutation("functions/billing:applyFeePlanToClassStudents" as never);
  const recordPayment = useMutation("functions/billing:recordManualPayment" as never);
  const createInvoicePaymentLink = useAction("functions/billing:initializeOnlinePayment" as never);

  const runAction = async (
    action: () => Promise<unknown>,
    successTitle: string,
    fallbackMessage: string
  ) => {
    setNotice(null);
    try {
      await action();
      setNotice({
        tone: "success",
        title: "Success",
        message: successTitle,
      });
      return true;
    } catch (error) {
      setNotice({
        tone: "error",
        title: successTitle,
        message: getUserFacingErrorMessage(error, fallbackMessage),
      });
      return false;
    }
  };

  return {
    runAction,
    saveBillingSettings,
    saveSchoolPaystackGatewayConfig,
    validateSchoolPaystackGatewayConfig,
    createFeePlan,
    createInvoice,
    applyFeePlanToClassStudents,
    recordPayment,
    createInvoicePaymentLink,
  };
}
