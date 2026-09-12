import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./betterAuth";
import { handlePaymentWebhook } from "./functions/billingWebhooks";
import {
  knowledgeMaterialUploadOptions,
  uploadKnowledgeMaterial,
} from "./functions/academic/lessonKnowledgeUploadHttp";
import {
  admissionsDocumentUploadOptions,
  uploadAdmissionsDocument,
} from "./functions/admissions/uploadHttp";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);
http.route({
  path: "/webhooks/payment",
  method: "POST",
  handler: handlePaymentWebhook,
});
http.route({
  path: "/academic/knowledge-material-upload",
  method: "OPTIONS",
  handler: knowledgeMaterialUploadOptions,
});
http.route({
  path: "/academic/knowledge-material-upload",
  method: "POST",
  handler: uploadKnowledgeMaterial,
});
http.route({
  path: "/admissions/document-upload",
  method: "OPTIONS",
  handler: admissionsDocumentUploadOptions,
});
http.route({
  path: "/admissions/document-upload",
  method: "POST",
  handler: uploadAdmissionsDocument,
});

export default http;
