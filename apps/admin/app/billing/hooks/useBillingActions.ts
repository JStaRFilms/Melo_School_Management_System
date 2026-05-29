import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { useAction,useMutation } from "convex/react";

export function useBillingActions() {
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
    try {
      await action();
      appToast.success("Success", { description: successTitle });
      return true;
    } catch (error) {
      appToast.error(successTitle, { description: getUserFacingErrorMessage(error, fallbackMessage) });
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
