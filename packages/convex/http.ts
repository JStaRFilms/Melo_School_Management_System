import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./betterAuth";
import { handlePaymentWebhook } from "./functions/billingWebhooks";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);
http.route({
  path: "/webhooks/payment",
  method: "POST",
  handler: handlePaymentWebhook,
});

export default http;
