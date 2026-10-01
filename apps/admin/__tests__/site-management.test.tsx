import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import SiteSettingsPage from "../app/admin/settings/site/page";
const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), publish: vi.fn(), preview: vi.fn(), candidate: vi.fn(), approve: vi.fn(), revert: vi.fn() }));
vi.mock("@/convex-runtime", () => ({isConvexConfigured: () => true}));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: {state:"ready",branch:{schoolId:"schoolSynthetic01"}} }) }));
vi.mock("../app/admin/settings/components/SettingsNavigationTabs", () => ({SettingsNavigationTabs: () => <nav>Settings navigation</nav>}));
vi.mock("convex/react", () => ({
  useAction: (ref: FunctionReference<"action">) => { const name = getFunctionName(ref); return name.endsWith(":schoolView") ? mocks.read : name.endsWith(":previewDraft") ? mocks.preview : name.endsWith(":getFieldCandidate") ? mocks.candidate : vi.fn(); },
  useMutation: (ref: FunctionReference<"mutation">) => getFunctionName(ref).endsWith(":saveDraft") ? mocks.save : getFunctionName(ref).endsWith(":publishDraft") ? mocks.publish : getFunctionName(ref).endsWith(":approveCandidate") ? mocks.approve : getFunctionName(ref).endsWith(":revertToDraft") ? mocks.revert : vi.fn(),
}));
const view = {canEdit:true,canRequestDomain:true,profile:{rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1",status:"draft"},draft:{version:1,content:{fields:[{fieldId:"school_name",value:{kind:"text",value:"Fictional School"}},{fieldId:"intro",value:{kind:"text",value:"Welcome"}}],routeSeo:[]}},assets:[],domains:[],publications:[]};
it("renders revert-only history without draft fields, private assets or unrelated domain controls", async () => {
  mocks.read.mockResolvedValue({...view,canEdit:false,canRequestDomain:false,draft:null,assets:[],domains:[],publications:[{id:"publishedSynthetic01",revisionNumber:1,current:true,publishedAt:Date.now()}]});
  mocks.revert.mockResolvedValue({draftId:"privateClone01"});
  const confirm = vi.spyOn(window,"confirm").mockReturnValue(true);
  render(<SiteSettingsPage />);
  fireEvent.click(await screen.findByRole("button",{name:"Clone as draft"}));
  await waitFor(() => expect(mocks.revert).toHaveBeenCalledWith({schoolId:"schoolSynthetic01",sourceRevisionId:"publishedSynthetic01"}));
  expect(screen.queryByRole("region",{name:"Draft fields"})).not.toBeInTheDocument();
  expect(screen.queryByText("Image upload and rights")).not.toBeInTheDocument();
  expect(screen.queryByText("Domain request")).not.toBeInTheDocument();
  expect(screen.queryByText("Fictional School")).not.toBeInTheDocument();
  confirm.mockRestore();
});
it("does not preselect a child's image classification or submit without one",async () => {
  mocks.read.mockResolvedValue({...view,assets:[{id:"assetSynthetic01",kind:"hero",fileName:"fictional.png",checksum:"a".repeat(64),status:"draft",rightsStatus:"pending",childApplicability:"unknown",decorative:false}],domains:[]});
  render(<SiteSettingsPage />);
  fireEvent.click(await screen.findByRole("button",{name:"asset child applicability"}));
  const select = screen.getByLabelText("Child classification");
  expect(select).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Independent source reference"),{target:{value:"Synthetic photo source record"}});
  fireEvent.change(screen.getByLabelText("Approval expires on"),{target:{value:"2030-01-01"}});
  fireEvent.click(screen.getByRole("checkbox",{name:/I inspected the independent source/}));
  expect(screen.getByRole("button",{name:"Record independent approval"})).toBeDisabled();
  expect(mocks.approve).not.toHaveBeenCalled();
});
it("uses the returned publish version for the next intentional save", async () => {
  mocks.read.mockResolvedValue(view);
  mocks.publish.mockResolvedValue({publishedId:"publishedSynthetic01",draftVersion:2});
  mocks.save.mockResolvedValue({draftId:"draftSynthetic01",draftVersion:3});
  const confirm = vi.spyOn(window,"confirm").mockReturnValue(true);
  render(<SiteSettingsPage />);
  fireEvent.click(await screen.findByRole("button",{name:"Publish saved draft"}));
  await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith({schoolId:"schoolSynthetic01",expectedDraftVersion:1}));
  expect(await screen.findByText(/Draft version: 2/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("intro (required)"),{target:{value:"Next fictional introduction"}});
  fireEvent.click(screen.getByRole("button",{name:"Save draft"}));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({expectedDraftVersion:2})));
  confirm.mockRestore();
});
it("keeps a typed synthetic draft on version conflict without silently publishing", async () => {
  mocks.read.mockResolvedValue(view);
  mocks.save.mockRejectedValue(new Error("DRAFT_VERSION_CONFLICT"));
  render(<SiteSettingsPage />);
  const intro = await screen.findByLabelText("intro (required)");
  fireEvent.change(intro,{target:{value:"New fictional introduction"}});
  fireEvent.click(screen.getByRole("button",{name:"Save draft"}));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({schoolId:"schoolSynthetic01",expectedDraftVersion:1,content:expect.objectContaining({fields:expect.arrayContaining([{fieldId:"intro",value:{kind:"text",value:"New fictional introduction"}}])})})));
  expect(await screen.findByRole("alert")).toHaveTextContent("DRAFT_VERSION_CONFLICT");
  expect(intro).toHaveValue("New fictional introduction");
  expect(screen.getByRole("button",{name:"Publish saved draft"})).toBeDisabled();
});
