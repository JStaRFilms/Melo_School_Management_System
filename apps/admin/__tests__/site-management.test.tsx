import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import SiteSettingsPage from "../app/admin/settings/site/page";
const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), publish: vi.fn(), preview: vi.fn(), candidate: vi.fn(), approve: vi.fn(), revert: vi.fn(), query: vi.fn(), validate: vi.fn() }));
vi.mock("@/convex-runtime", () => ({isConvexConfigured: () => true}));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: {state:"ready",branch:{schoolId:"schoolSynthetic01"}} }) }));
vi.mock("../app/admin/settings/components/SettingsNavigationTabs", () => ({SettingsNavigationTabs: () => <nav>Settings navigation</nav>}));
vi.mock("convex/react", () => ({
  useConvex: () => ({query:mocks.query}),
  useAction: (ref: FunctionReference<"action">) => { const name = getFunctionName(ref); return name.endsWith(":schoolView") ? mocks.read : name.endsWith(":previewDraft") ? mocks.preview : name.endsWith(":getFieldCandidate") ? mocks.candidate : name.endsWith(":validateDraft") ? mocks.validate : vi.fn(); },
  useMutation: (ref: FunctionReference<"mutation">) => getFunctionName(ref).endsWith(":saveDraft") ? mocks.save : getFunctionName(ref).endsWith(":publishDraft") ? mocks.publish : getFunctionName(ref).endsWith(":approveCandidate") ? mocks.approve : getFunctionName(ref).endsWith(":revertToDraft") ? mocks.revert : vi.fn(),
}));
beforeEach(() => { vi.clearAllMocks(); });
const view = {canEdit:true,canReview:true,canPublish:true,canPublishSensitive:true,canPreview:true,canRevert:true,canRequestDomain:true,profile:{rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1",status:"draft"},draft:{version:1,content:{fields:[{fieldId:"school_name",value:{kind:"text",value:"Fictional School"}},{fieldId:"intro",value:{kind:"text",value:"Welcome"}}],routeSeo:[]}},assets:[],domains:[],publications:[]};
it("renders revert-only history without draft fields, private assets or unrelated domain controls", async () => {
  mocks.read.mockResolvedValue({...view,canEdit:false,canReview:false,canPublish:false,canPreview:false,canRequestDomain:false,draft:null,assets:[],domains:[],publications:[{id:"publishedSynthetic01",revisionNumber:1,current:true,publishedAt:Date.now()}]});
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
it("lets a reviewer record truthful until-revoked approval without editor or publisher controls", async () => {
  mocks.read.mockResolvedValue({...view,canEdit:false,canPublish:false,canPreview:false,canRevert:false,canRequestDomain:false});
  mocks.candidate.mockResolvedValue({fieldId:"school_name",value:{kind:"text",value:"Fictional School"},evidenceClass:"identity",digest:"a".repeat(64)});
  render(<SiteSettingsPage />);
  fireEvent.click(await screen.findByRole("button",{name:"Review school_name"}));
  fireEvent.change(await screen.findByLabelText("Independent source reference"),{target:{value:"Owner authorization recorded for this exact school name"}});
  fireEvent.change(screen.getByLabelText("Authorization source"),{target:{value:"owner_attestation"}});
  fireEvent.change(screen.getByLabelText("Approval lifetime"),{target:{value:"until_revoked"}});
  expect(screen.queryByLabelText("Approval expires on")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox",{name:/I record the owner's authorization/}));
  fireEvent.click(screen.getByRole("button",{name:"Record independent approval"}));
  await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith(expect.objectContaining({validity:"until_revoked",sourceKind:"owner_attestation",expiresAt:undefined,confirmed:true,candidate:{kind:"field",fieldId:"school_name",expectedDigest:"a".repeat(64)}})));
  for (const name of ["Save draft","Publish saved draft","Preview authorized draft","Upload privately","Clone as draft","Copy Admin logo privately","Request hostname"]) expect(screen.queryByRole("button",{name})).not.toBeInTheDocument();
});
it("lets a publisher check and publish the saved draft without editing or review", async () => {
  mocks.read.mockResolvedValue({...view,canEdit:false,canReview:false,canPreview:false,canRevert:false,canRequestDomain:false});
  mocks.validate.mockResolvedValue({valid:true,draftVersion:1});
  mocks.publish.mockResolvedValue({publishedId:"publishedSynthetic01",draftVersion:2});
  const confirm = vi.spyOn(window,"confirm").mockReturnValue(true);
  try {
    render(<SiteSettingsPage />);
    fireEvent.click(await screen.findByRole("button",{name:"Check publication gates"}));
    await waitFor(() => expect(mocks.validate).toHaveBeenCalledWith({schoolId:"schoolSynthetic01"}));
    fireEvent.click(screen.getByRole("button",{name:"Publish saved draft"}));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith({schoolId:"schoolSynthetic01",expectedDraftVersion:1}));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    for (const name of ["Save draft","Review school_name","Preview authorized draft","Clone as draft","Upload privately"]) expect(screen.queryByRole("button",{name})).not.toBeInTheDocument();
  } finally {confirm.mockRestore();}
});
it("does not fetch an Admin logo on view or copy a different school's branding", async () => {
  mocks.read.mockResolvedValue(view);
  mocks.query.mockResolvedValue({schoolId:"differentSchool01",logoUrl:"https://private.example.test/logo.png"});
  const fetcher = vi.spyOn(globalThis,"fetch");
  const confirm = vi.spyOn(window,"confirm").mockReturnValue(true);
  try {
    render(<SiteSettingsPage />);
    const button = await screen.findByRole("button",{name:"Copy Admin logo privately"});
    expect(mocks.query).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("No accessible Admin logo for this school");
    expect(fetcher).not.toHaveBeenCalled();
  } finally {fetcher.mockRestore();confirm.mockRestore();}
});
it("copies only an explicitly requested same-school logo through the authenticated website byte upload", async () => {
  mocks.read.mockResolvedValue(view);
  mocks.query.mockResolvedValue({schoolId:"schoolSynthetic01",logoUrl:"https://private-storage.test/selected-logo"});
  const fetcher = vi.spyOn(globalThis,"fetch")
    .mockResolvedValueOnce(new Response(new Uint8Array(20),{headers:{"Content-Type":"image/png"}}))
    .mockResolvedValueOnce(Response.json({assetId:"copiedWebsiteLogo01"},{status:201}));
  const confirm = vi.spyOn(window,"confirm").mockReturnValue(true);
  try {
    render(<SiteSettingsPage />);
    fireEvent.change(await screen.findByLabelText("Alternative text"),{target:{value:"School crest"}});
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Copy Admin logo privately"}));
    expect(await screen.findByRole("status")).toHaveTextContent("Admin logo copied privately as copiedWebsiteLogo01");
    expect(mocks.query).toHaveBeenCalledWith(expect.anything(),{schoolId:"schoolSynthetic01"});
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe("/api/site-assets/upload");
    const upload = fetcher.mock.calls[1][1];
    expect(upload?.headers).toMatchObject({"X-Site-School":"schoolSynthetic01","X-Site-Kind":"logo","Content-Type":"image/png"});
    expect(upload?.body).toBeInstanceOf(File);
    expect(JSON.stringify(upload?.headers)).not.toContain("private-storage");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  } finally {fetcher.mockRestore();confirm.mockRestore();}
});
it("shows the separate sensitive publication requirement without granting edit access",async () => {
  mocks.read.mockResolvedValue({...view,canEdit:false,canReview:false,canPublishSensitive:false,canPreview:false,draft:{...view.draft,content:{...view.draft.content,fields:[...view.draft.content.fields,{fieldId:"site_favicon",value:{kind:"asset_ref",assetId:"assetSynthetic01"}}]}}});
  render(<SiteSettingsPage />);
  expect(await screen.findByRole("button",{name:"Publish saved draft"})).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("site.publish.sensitive");
  expect(screen.queryByRole("button",{name:"Save draft"})).not.toBeInTheDocument();
});
it("sends Unicode upload metadata as versioned ASCII headers",async () => {
  mocks.read.mockResolvedValue(view);
  const fetcher = vi.spyOn(globalThis,"fetch").mockResolvedValue(Response.json({assetId:"assetSynthetic01"},{status:201}));
  try {
    render(<SiteSettingsPage />);
    const file = new File([new Uint8Array(16)],"学校-Àwọn-صورة.png",{type:"image/png"});
    fireEvent.change(await screen.findByLabelText("Image file"),{target:{files:[file]}});
    fireEvent.change(screen.getByLabelText("Alternative text"),{target:{value:"学校 Àwọn صورة"}});
    fireEvent.click(screen.getByRole("button",{name:"Upload privately"}));
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    const headers = fetcher.mock.calls[0][1]?.headers as Record<string,string>;
    expect(headers["x-site-filename-uri-v1"]).toBe(encodeURIComponent(file.name));
    expect(headers["x-site-alt-uri-v1"]).toBe(encodeURIComponent("学校 Àwọn صورة"));
    expect(headers["X-Site-Filename"]).toBeUndefined();
  } finally {fetcher.mockRestore();}
});
it("does not preselect a child's image classification or submit without one",async () => {
  mocks.read.mockResolvedValue({...view,assets:[{id:"assetSynthetic01",kind:"hero",fileName:"fictional.png",checksum:"a".repeat(64),status:"draft",rightsStatus:"pending",childApplicability:"unknown",decorative:false}],domains:[]});
  render(<SiteSettingsPage />);
  fireEvent.click(await screen.findByRole("button",{name:"asset child applicability"}));
  const select = screen.getByLabelText("Child classification");
  expect(select).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Independent source reference"),{target:{value:"Synthetic photo source record"}});
  fireEvent.change(screen.getByLabelText("Approval expires on"),{target:{value:"2030-01-01"}});
  fireEvent.change(screen.getByLabelText("Authorization source"),{target:{value:"document_review"}});
  fireEvent.click(screen.getByRole("checkbox",{name:/I inspected the referenced documentation/}));
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
