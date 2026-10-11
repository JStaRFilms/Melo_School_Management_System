export type PortalState = "not_provisioned" | "provisioning" | "resetting" | "provisioned" | "reconciliation_required";

const labels: Record<PortalState, string> = {
  not_provisioned: "Not provisioned", provisioning: "Provisioning...", resetting: "Resetting password...",
  provisioned: "Provisioned", reconciliation_required: "Needs reconciliation",
};

export function PortalStateLabel({ state }: { state: PortalState | undefined }) {
  return <span role="status">{state ? labels[state] : "Checking portal access..."}</span>;
}
