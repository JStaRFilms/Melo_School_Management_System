const c = require("./launch-common.cjs");
const crypto = require("node:crypto");
const operationsPath = c.path.join(__dirname, "upkeep-operations-ledger.json");
const operations = JSON.parse(c.fs.readFileSync(operationsPath, "utf8"));
const oldReview = JSON.parse(c.fs.readFileSync(c.path.join(__dirname, "review-ledger.json"), "utf8"));
const uploads = JSON.parse(c.fs.readFileSync(c.path.join(__dirname, "upload-ledger.json"), "utf8"));
const launch = c.loadLedger();
function data(table) {
  const response = c.productionCli(["data", table, "--limit", "512", "--format", "json"]);
  const rows = JSON.parse(response.stdout);
  if (rows.length >= 512) throw new Error(`Incomplete metadata inventory: ${table}`);
  return rows;
}
function assert(value, message) { if (!value) throw new Error(message); }
c.verifyProduction();
const evidence = data("schoolApprovalEvidence");
assert(operations.records.length === 64, "Missing replacement approvals");
assert(operations.records.every(record => evidence.some(row => row._id === record.evidenceId && row.schoolId === c.schoolId &&
  row.approvedByUserId === operations.reviewerId && row.validity === "until_revoked" && row.sourceKind === "owner_attestation" && row.expiresAt === undefined && !row.revokedAt)), "Replacement approval metadata mismatch");
assert(oldReview.records.every(record => evidence.some(row => row._id === record.evidenceId && row.schoolId === c.schoolId && row.expiresAt === oldReview.expiresAt && row.validity === undefined)), "Original dated approval history changed");
const revisions = data("schoolSiteRevisions");
const current = revisions.find(row => row._id === operations.publishedRevisionId && row.schoolId === c.schoolId && row.state === "published");
const previous = revisions.find(row => row._id === launch.publishedRevisionId && row.schoolId === c.schoolId && row.state === "published");
const newFields = operations.records.filter(record => record.key.startsWith("field:")).map(record => record.evidenceId);
const oldFields = oldReview.records.filter(record => record.key.startsWith("field:")).map(record => record.evidenceId);
assert(current && previous && current.contentDigest === operations.digest && current.contentDigest === previous.contentDigest, "Published content was changed");
assert(current.approvalEvidenceIds?.length === newFields.length && current.approvalEvidenceIds.every(id => newFields.includes(id)), "New publication did not record replacement field approvals");
assert(previous.approvalEvidenceIds?.length === oldFields.length && previous.approvalEvidenceIds.every(id => oldFields.includes(id)), "Previous publication approval history changed");
const assets = data("schoolSiteAssets");
assert(uploads.assets.every(original => {
  const asset = assets.find(row => row._id === original.assetId && row.schoolId === c.schoolId);
  const rights = operations.records.find(record => record.key === `rights:${original.fieldId}`);
  const consent = operations.records.find(record => record.key === `consent:${original.fieldId}`);
  return asset && rights && asset.checksum === original.checksum && asset.rightsStatus === "approved" && asset.rightsExpiresAt === undefined && asset.approvalEvidenceId === rights.evidenceId && (!consent || asset.childConsentEvidenceId === consent.evidenceId);
}), "Original asset/rights/consent pointer mismatch");
const domains = data("schoolDomains");
assert(launch.domains.every(original => {
  const domain = domains.find(row => row._id === original.domainId && row.schoolId === c.schoolId && row.hostname === original.hostname);
  return domain && domain.status === "active" && domain.ownershipProofPolicy === "persistent_authoritative_v1" && domain.verificationExpiresAt === undefined &&
    domain.verificationRecordName === original.recordName && domain.verificationRecordValue === original.recordValue && domain.verificationTokenHash === crypto.createHash("sha256").update(original.recordValue).digest("hex") && !domain.providerOperation;
}), "Persistent adoption changed ownership TXT or active host assignment");
const grants = data("schoolCapabilityGrants").filter(row => row.schoolId === c.schoolId && row.userId === c.leadId && !row.revokedAt && row.expiresAt > Date.now());
assert(grants.length === 4 && grants.every(row => row.siteAccessRole === "publisher" && row.provisioningSource === "site_operator" && row.expiresAt === launch.accessExpiresAt), "Lead role or finite access expiry changed");
const flags = c.flags();
assert(flags.SITES_ALLOW_ACCESS_PROVISIONING !== "enabled" && flags.SITES_ALLOW_PROVIDER_WRITES !== "enabled", "Operational window left enabled");
const result = { verifiedAt: new Date().toISOString(), replacementApprovals: 64, validity: "until_revoked", originalApprovalHistoryPreserved: true,
  publishedRevisionId: current._id, sameContentDigest: true, newFieldApprovalIdsVerified: newFields.length, originalPublicationHistoryPreserved: true,
  originalNineAssetsUnchanged: true, persistentDomains: 2, existingTxtValuesPreserved: true, leadPublisherAccessStillFinite: true, operationalFlagsOff: true };
c.fs.writeFileSync(c.path.join(__dirname, "upkeep-state-verification.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
