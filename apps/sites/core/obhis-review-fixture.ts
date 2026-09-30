import { validatePrivateReviewFixture } from "./private-review";

export const obhisReviewFixture = validatePrivateReviewFixture({
  kind: "private-local-review",
  rendererKey: "obhis-v1",
  schemaVersion: 1,
  displayName: "Olive Blessed Crest Academy",
  publicationRights: "pending",
  brand: { primaryColor: "#176c49", accentColor: "#39bcd3" },
  application: null,
});
