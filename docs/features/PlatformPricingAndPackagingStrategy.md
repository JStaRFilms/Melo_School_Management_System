# Platform Pricing and Packaging Strategy

## Goal

Define the platform's commercial packaging so the SaaS can be sold cleanly to schools without mixing platform subscription revenue with school fee billing.

## Scope Boundary

This feature covers **platform SaaS billing** only:

- setup fees for onboarding and launch work
- recurring platform access fees
- optional upgrades and add-ons
- tiered package entitlements for schools
- commercial segmentation guidance for school size and service level

It does **not** cover:

- school fee plans, student invoices, or parent payments
- Paystack routing for school collections
- public-web operating modes or website delivery policy
- tenancy, authentication, or academic workflows

## Commercial Model

The platform should use a **mixed pricing model**:

1. **Setup fee**
   - one-time onboarding charge
   - covers provisioning, first-school setup, branding kickoff, and launch assistance

2. **Recurring platform fee**
   - billed by contract cycle, typically term-based or annual for school buyers
   - covers continued access to the platform modules included in the package

3. **Optional upgrades**
   - separately priced add-ons for higher-touch services or expanded capability
   - can be attached to any plan without changing the base tier

This keeps the commercial model flexible enough for small private schools, mid-tier schools, and premium schools.

## Segmented Package Tiers

### 1. Basic

Best for smaller private schools that want the core operating system with minimal service overhead.

Includes:

- admin workspace
- teacher workspace
- academic setup and results workflow
- school provisioning and onboarding basics
- limited support tier

Typically paired with:

- lower setup fee
- lighter recurring fee
- fewer included services

### 2. Standard

Best for schools that want a more complete school operating package with stronger parent-facing value.

Includes everything in Basic, plus:

- parent/student portal access
- email and in-app notifications
- branded school website starter capability
- onboarding and training bundle
- moderate support tier

Typically paired with:

- medium setup fee
- stronger recurring fee
- broader adoption and launch support

### 3. Premium

Best for larger schools or schools that want a managed, higher-touch commercial relationship.

Includes everything in Standard, plus:

- customization allowances
- priority support
- premium service SLA
- finance and automation upgrades
- higher branding and domain flexibility

Typically paired with:

- custom setup fee
- higher recurring contract value
- optional service-level commitments

## Entitlement Categories

Package names should stay separate from entitlement rules. The platform should think in categories, not just plan names.

### Core Operations

- school admin access
- teacher access
- classes, subjects, sessions, terms
- results and report-card workflows

### Family Access

- parent portal
- student portal
- notifications
- receipt and status visibility

### Public Web

- school public website
- branded landing pages
- theme and content configuration
- custom-domain eligibility later

### Finance and Collections

- school billing dashboard
- invoices
- payment tracking
- payment-link generation
- reconciliation tools

### Support and Service

- onboarding assistance
- data migration support
- priority support
- service response tiers

### Limits and Capacity

- student caps
- staff/admin caps
- class or campus caps if needed later
- feature usage ceilings where appropriate

### Add-On Services

- custom branding work
- managed website rollout
- additional notifications
- advanced automation
- special integrations

## Pricing Segmentation Guidance

The pricing strategy should align to school segment and service appetite.

### Small Private Schools

- lower setup barrier
- simpler recurring fee
- smaller support footprint
- strongest emphasis on core operations

### Mid-Tier Schools

- higher setup fee than small schools
- recurring value based on broader adoption
- more complete family and public-web value

### Premium Schools

- custom commercial terms
- higher recurring value
- managed implementation and stronger service levels
- premium support and customization

## Separation From Public-Web Operating Mode

Package tier and public-web operating mode are **different decisions**.

A school can:

- keep its existing website and still buy Basic, Standard, or Premium
- move to a managed school website later without changing its commercial tier
- start in a higher tier while remaining in Mode B for public-web operations

This means:

- package tier controls commercial entitlement
- public-web mode controls how the school is onboarded and what website path it uses
- one must not silently determine the other

## Implementation-Ready Data Model Guidance

Future platform billing work should likely use separate records for:

- `platformPlanCatalog`
- `platformPlanEntitlements`
- `platformAddOns`
- `platformSubscriptions`
- `platformInvoices`
- `platformInvoiceItems`
- `platformBillingEvents`

Recommended shape:

- plan metadata stored separately from subscription instances
- entitlements stored in normalized categories
- add-ons modeled as attachable commercial items
- invoice history kept separate from the entitlement catalog

## Messaging Guidance For Future Marketing

The platform marketing site should be able to speak in plain commercial language:

- setup fee
- recurring fee
- optional upgrades
- Basic / Standard / Premium

It should not expose internal entitlement keys or implementation jargon.

The pricing story should also leave room for custom quotations when a school needs a premium service arrangement.

## Regression Checks

- Platform billing must stay separate from school fee billing.
- Commercial tiers must not overwrite or redefine public-web operating modes.
- Optional upgrades must remain attachable without changing the base tier.
- Entitlements must be usable later for platform billing enforcement.
- T17 messaging should be able to reference this strategy without inventing new commercial rules.

## Definition Of Done

- The pricing model is mixed, not single-metric.
- Tiers and entitlements are documented clearly.
- Optional upgrades are defined separately from base packages.
- Public-web mode remains a separate operational decision.
- Future platform billing and marketing can implement against this strategy without guessing.