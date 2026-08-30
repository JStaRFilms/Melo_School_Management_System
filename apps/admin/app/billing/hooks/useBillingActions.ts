import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { api } from "@school/convex/_generated/api";
import { useAction,useMutation } from "convex/react";

export function useBillingActions() {
  const saveBillingSettings = useMutation(api.functions.billing.upsertBillingSettings);
  const saveSchoolPaystackGatewayConfig = useMutation(api.functions.billingProviders.saveSchoolPaystackGatewayConfig);
  const validateSchoolPaystackGatewayConfig = useAction(api.functions.billingProviders.validateSchoolPaystackGatewayConfig);
  const createFeePlan = useMutation(api.functions.billing.createFeePlan);
  const createInvoice = useMutation(api.functions.billing.createInvoiceFromFeePlan);
  const applyFeePlanToClassStudents = useMutation(api.functions.billing.applyFeePlanToClassStudents);
  const recordPayment = useMutation(api.functions.billing.recordManualPayment);
  const createInvoicePaymentLink = useAction(api.functions.billing.initializeOnlinePayment);

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
