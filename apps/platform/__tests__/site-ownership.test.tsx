import {beforeEach, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {getFunctionName, type FunctionReference} from "convex/server";
import SchoolSiteOperationsPage from "../app/schools/[schoolId]/site/page";
const mocks = vi.hoisted(() => ({read:vi.fn(),adopt:vi.fn(),check:vi.fn(),provider:vi.fn()}));
vi.mock("next/navigation",() => ({useParams:() => ({schoolId:"schoolSynthetic01"})}));
vi.mock("next/link",() => ({default:({children,href}:{children:React.ReactNode;href:string}) => <a href={href}>{children}</a>}));
vi.mock("convex/react",() => ({
  useAction:(ref:FunctionReference<"action">) => {
    const name = getFunctionName(ref);
    return name.endsWith(":operatorView") ? mocks.read : name.endsWith(":checkReadiness") ? mocks.check : mocks.provider;
  },
  useMutation:(ref:FunctionReference<"mutation">) => getFunctionName(ref).endsWith(":adoptPersistentOwnership") ? mocks.adopt : vi.fn(),
}));
const domain = {id:"domainSynthetic01",hostname:"legacy.synthetic.edu",status:"active",canonicalIntent:"canonical",ownershipProofPolicy:null,expiresAt:1900000000000,renewalRequired:false,ownershipObservedAt:1800000000000,routingObservedAt:1800000000000,tlsObservedAt:1800000000000,observationFresh:true,providerOperation:null};
const view = {school:{name:"Synthetic school",status:"active"},profile:{rendererKey:"school-core-synthetic-v1",version:"1",status:"published",published:true},domains:[domain]};
beforeEach(() => { vi.clearAllMocks(); });
it("requires the exact-host confirmation and a separate deliberate adoption without auto provider calls", async () => {
  mocks.read.mockResolvedValue(view);
  const confirm = vi.spyOn(window,"confirm").mockReturnValue(false);
  try {
    render(<SchoolSiteOperationsPage />);
    const adopt = await screen.findByRole("button",{name:"Adopt persistent TXT proof"});
    expect(adopt).toBeDisabled();
    expect(mocks.check).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
    const input = screen.getByLabelText("Operation confirmation for legacy.synthetic.edu");
    fireEvent.change(input,{target:{value:"CONFIRM PERSISTENT other.synthetic.edu"}});
    expect(adopt).toBeDisabled();
    fireEvent.change(input,{target:{value:"CONFIRM PERSISTENT legacy.synthetic.edu"}});
    fireEvent.click(adopt);
    expect(mocks.adopt).not.toHaveBeenCalled();
    await waitFor(() => expect(adopt).not.toBeDisabled());
    confirm.mockReturnValue(true);
    fireEvent.click(adopt);
    await waitFor(() => expect(mocks.adopt).toHaveBeenCalledWith({domainId:"domainSynthetic01",confirmation:"CONFIRM PERSISTENT legacy.synthetic.edu"}));
    expect(mocks.provider).not.toHaveBeenCalled();
  } finally {confirm.mockRestore();}
});
it("keeps adoption blocked on stale observations and shows persistent proof without a fake deadline", async () => {
  mocks.read.mockResolvedValue({...view,domains:[{...domain,observationFresh:false}]});
  const rendered = render(<SchoolSiteOperationsPage />);
  fireEvent.change(await screen.findByLabelText("Operation confirmation for legacy.synthetic.edu"),{target:{value:"CONFIRM PERSISTENT legacy.synthetic.edu"}});
  expect(screen.getByRole("button",{name:"Adopt persistent TXT proof"})).toBeDisabled();
  rendered.unmount();
  mocks.read.mockResolvedValue({...view,domains:[{...domain,ownershipProofPolicy:"persistent_authoritative_v1",expiresAt:null}]});
  render(<SchoolSiteOperationsPage />);
  expect(await screen.findByText(/Persistent authoritative TXT proof/)).toBeInTheDocument();
  expect(screen.queryByRole("button",{name:"Adopt persistent TXT proof"})).not.toBeInTheDocument();
  expect(screen.queryByText(/TXT expires/)).not.toBeInTheDocument();
});
