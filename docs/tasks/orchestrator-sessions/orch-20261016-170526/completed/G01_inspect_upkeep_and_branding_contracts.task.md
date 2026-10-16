# Inspect upkeep and branding contracts

## Objective
Choose the smallest safe implementation for optional approval expiry, automatic domain ownership rechecks, role-specific Admin controls and tenant website favicon. This initial discovery task precedes concrete design/build packets.

## Scope
Read Sites schema, evidence gates, publication validation, domain state/cron logic, school branding and Admin/Sites UI. Root checkout only. No remote mutations or source implementation in discovery. Preserve the existing access-provisioning implementation and launch artifacts.

## Definition of done
Document affected files, backward compatibility, handling of existing finite approvals, reviewer/publisher isolation, domain failure/recovery behaviour and published branding boundaries. Identify exact verification/release prerequisites. Do not substitute uninspected documents for the owner's actual attestation.

## Expected artifacts
A scoped implementation plan in this session and a feature-document update before source changes. Incorporate read-only delegated findings and track their task IDs in this record.
