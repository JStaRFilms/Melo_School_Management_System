import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { useAction,useMutation } from "convex/react";

export function useBillingActions() {
  const saveBillingSettings = useMutation("functions/billing:upsertBillingSettings" as never);
  const saveSchoolPaystackGatewayConfig = useMutation("functions/billingProviders:saveSchoolPaystackGatewayConfig" as never);
  const validateSchoolPaystackGatewayConfig = useAction("functions/billingProviders:validateSchoolPaystackGatewayConfig" as never);
  const createFeePlan = useMutation("functions/billing:createFeePlan" as never);
  const archiveFeePlan = useMutation("functions/billing:archiveFeePlan" as never);
  const restoreFeePlan = useMutation("functions/billing:restoreFeePlan" as never);
  const deleteUnusedFeePlan = useMutation("functions/billing:deleteUnusedFeePlan" as never);
  const revokeFeePlanInvoices = useMutation("functions/billing:revokeFeePlanInvoices" as never);
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
      appToast.error(fallbackMessage || "Action Failed", {
        description: getUserFacingErrorMessage(error, fallbackMessage),
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
    archiveFeePlan,
    restoreFeePlan,
    deleteUnusedFeePlan,
    revokeFeePlanInvoices,
    createInvoice,
    applyFeePlanToClassStudents,
    recordPayment,
    createInvoicePaymentLink,
  };
}
