"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { isConvexConfigured } from "@/convex-runtime";
import { appToast, getErrorMessage } from "@school/shared/toast";
import { deriveSchoolTheme, normalizeThemeColor } from "@school/shared/theme";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import {
  Building2,
  Upload,
  Trash2,
  Save,
  Palette,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  Lock,
  Copy,
  Check,
  Loader2,
  LayoutGrid,
  FolderTree,
  Columns3,
  Compass,
} from "lucide-react";

interface SchoolBrandingData {
  schoolId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  motto?: string;
  theme: {
    primaryColor: string;
    accentColor: string;
  };
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  features: {
    billing: boolean;
    curriculum: boolean;
    knowledgeLibrary: boolean;
    admissions: boolean;
  };
}

const PRESET_PALETTES = [
  { name: "Slate Navy & Amber Gold", primary: "#0f172a", accent: "#d97706" },
  { name: "Royal Blue & Gold", primary: "#1e3a8a", accent: "#f59e0b" },
  { name: "Emerald & Gold", primary: "#064e3b", accent: "#eab308" },
  { name: "Burgundy & Rose", primary: "#881337", accent: "#f43f5e" },
  { name: "Classic Obsidian & Sky", primary: "#020617", accent: "#0284c7" },
  { name: "Deep Indigo & Violet", primary: "#312e81", accent: "#8b5cf6" },
];

export default function SchoolSettingsPage() {
  const isConfigured = isConvexConfigured();

  const branding = useQuery(
    "functions/academic/schoolBranding:getCurrentSchoolBranding" as never,
    isConfigured ? ({} as never) : ("skip" as never)
  ) as SchoolBrandingData | undefined;

  const updateProfile = useMutation(
    "functions/academic/schoolBranding:updateSchoolProfile" as never
  );
  const generateLogoUploadUrl = useMutation(
    "functions/academic/schoolBranding:generateSchoolLogoUploadUrl" as never
  );
  const saveSchoolLogo = useMutation(
    "functions/academic/schoolBranding:saveSchoolLogo" as never
  );
  const removeSchoolLogo = useMutation(
    "functions/academic/schoolBranding:removeSchoolLogo" as never
  );

  // Form states
  const [name, setName] = useState("");
  const [motto, setMotto] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0f172a");
  const [accentColor, setAccentColor] = useState("#d97706");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");

  // Logo upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isLogoRemovalOpen, setIsLogoRemovalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);

  // Navigation layout preference state (default: 'grouped')
  const [navLayout, setNavLayout] = useState<"grouped" | "accordion" | "domain_tabs">("grouped");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("melo_nav_layout");
      if (saved === "grouped" || saved === "accordion" || saved === "domain_tabs") {
        setNavLayout(saved);
      }
    }
  }, []);

  const handleNavLayoutChange = (layout: "grouped" | "accordion" | "domain_tabs") => {
    setNavLayout(layout);
    if (typeof window !== "undefined") {
      localStorage.setItem("melo_nav_layout", layout);
      window.dispatchEvent(new Event("melo-nav-layout-changed"));
      appToast.success("Navigation style updated", {
        description: `Workspace layout switched to ${
          layout === "grouped" ? "Straight Grouped List" : layout === "accordion" ? "Collapsible Accordions" : "Top Domain Switcher"
        }.`,
      });
    }
  };

  const brandingInitialized = useRef(false);

  useEffect(() => {
    if (brandingInitialized.current) return;
    if (branding) {
      setName(branding.name || "");
      setMotto(branding.motto || "");
      setPrimaryColor(branding.theme?.primaryColor || "#0f172a");
      setAccentColor(branding.theme?.accentColor || "#d97706");
      setContactEmail(branding.contactEmail || "");
      setContactPhone(branding.contactPhone || "");
      setAddress(branding.address || "");
      brandingInitialized.current = true;
    }
  }, [branding]);

  const normalizedPrimary = normalizeThemeColor(primaryColor);
  const normalizedAccent = normalizeThemeColor(accentColor);
  const previewTokens = useMemo(
    () => deriveSchoolTheme(normalizedPrimary, normalizedAccent),
    [normalizedPrimary, normalizedAccent],
  );
  const themeCanSave = Boolean(normalizedPrimary && normalizedAccent);

  const logoPreviewUrl = useMemo(() => {
    if (logoFile) {
      return URL.createObjectURL(logoFile);
    }
    return branding?.logoUrl ?? null;
  }, [logoFile, branding?.logoUrl]);

  useEffect(() => {
    return () => {
      if (logoFile && logoPreviewUrl && logoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoFile, logoPreviewUrl]);

  const handleCopySlug = () => {
    if (branding?.slug) {
      navigator.clipboard.writeText(branding.slug);
      setCopiedSlug(true);
      setTimeout(() => setCopiedSlug(false), 2000);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      appToast.warning("School name required", {
        description: "Please enter your official school name.",
      });
      return;
    }
    if (!normalizedPrimary || !normalizedAccent) {
      appToast.warning("Use a valid brand colour", {
        description: "Enter a 3- or 6-digit hex colour for both Primary and Accent so a safe theme can be derived.",
      });
      return;
    }

    setIsSaving(true);
    try {
      // 1. Upload logo if new file chosen
      if (logoFile) {
        const uploadUrl = (await generateLogoUploadUrl({} as never)) as string;
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": logoFile.type },
          body: logoFile,
        });

        if (!uploadResponse.ok) {
          throw new Error("Logo upload failed");
        }

        const payload = (await uploadResponse.json()) as { storageId: string };
        await saveSchoolLogo({
          logoStorageId: payload.storageId as never,
          logoFileName: logoFile.name,
          logoContentType: logoFile.type,
        } as never);
        setLogoFile(null);
      }

      // 2. Update profile details
      await updateProfile({
        name: name.trim(),
        motto: motto.trim() || undefined,
        theme: {
          primaryColor: normalizedPrimary,
          accentColor: normalizedAccent,
        },
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        address: address.trim() || undefined,
      } as never);

      appToast.success("Settings saved", {
        description: "School profile, branding, and contact info updated.",
      });
    } catch (err) {
      appToast.error("Failed to save settings", {
        description: getErrorMessage(err, "Could not update school profile."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveCurrentLogo = async () => {
    setIsSaving(true);
    try {
      await removeSchoolLogo({} as never);
      setIsLogoRemovalOpen(false);
      appToast.success("Logo removed");
    } catch (err) {
      appToast.error("Failed to remove logo", {
        description: getErrorMessage(err, "Could not delete logo."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!branding) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <p className="text-sm text-slate-500 font-medium">Loading school settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 pb-20 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">School Profile & Branding</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your official institution identity, crest logo, custom palette, and letterhead contact details.
          </p>
          <div className="flex flex-wrap gap-3">
            <a className="text-sm underline" href="/admin/settings/email-domains">Institutional email policy and review</a>
            <a className="text-sm underline" href="/admin/settings/group-defaults">Group default choices</a>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={isSaving || !themeCanSave}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving Profile...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save All Changes
            </>
          )}
        </button>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Section 1: Official Identity */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
            <Building2 className="h-4 w-4 text-slate-500" />
            <span>Institution Identity</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Official School Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Meridian Crest Academy"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400">
                Displayed on official transcripts, student portal navigation, and invoice letterheads.
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                School Motto / Tagline
              </label>
              <input
                type="text"
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                placeholder="e.g. Nurturing Intellectual Depth, Character, and Global Leadership."
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400">
                Printed beneath the school crest on official report cards, fee receipts, and portal headers.
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Tenant Slug Identifier (Immutable)
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={branding.slug}
                    readOnly
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono text-slate-500 cursor-not-allowed pr-8"
                  />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                </div>
                <button
                  type="button"
                  onClick={handleCopySlug}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {copiedSlug ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-400" />
                      Copy Slug
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Protected system identifier used for tenant isolation and subdomains. Managed by Super Admin.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Crest & Logo */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>School Crest & Logo</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Preview Box */}
            <div className="relative aspect-[4/3] rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center p-4">
              {logoPreviewUrl ? (
                <Image
                  src={logoPreviewUrl}
                  alt={name || "School Crest"}
                  fill
                  unoptimized
                  className="object-contain p-4"
                />
              ) : (
                <div className="text-center p-4">
                  <div
                    className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm mb-2"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 3)
                      .join("")
                      .toUpperCase() || "SCH"}
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    No Crest Uploaded
                  </p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="md:col-span-2 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Upload Institution Crest</h4>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  New crest uploads are unavailable until storage can prove tenant ownership, reserve purchased quota, and clean up abandoned uploads. Existing authorized crests remain visible and removable.
                </p>
              </div>

              <div className="flex flex-col items-stretch gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <label
                  aria-disabled="true"
                  className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white opacity-50 shadow-xs sm:w-auto"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Choose Image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    disabled
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      if (file) {
                        setLogoFile(file);
                      }
                    }}
                  />
                </label>

                {logoFile && (
                  <button
                    type="button"
                    onClick={() => setLogoFile(null)}
                    disabled={isSaving}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Discard selected image
                  </button>
                )}

                {branding.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setIsLogoRemovalOpen(true)}
                    disabled={isSaving}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove current logo
                  </button>
                )}
              </div>

              {logoFile && (
                <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  Ready to upload: {logoFile.name} (Click &quot;Save All Changes&quot; to confirm)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Brand Colors */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
            <Palette className="h-4 w-4 text-indigo-600" />
            <span>Brand Color Palette</span>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Primary Brand Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={normalizedPrimary ?? "#0f172a"}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-12 rounded-lg border border-slate-200 cursor-pointer p-1 bg-white"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-900 uppercase"
                  />
                </div>
                <p className="text-[11px] text-slate-400">Used on report card header banners and navbar branding.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Accent Brand Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={normalizedAccent ?? "#2563eb"}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 w-12 rounded-lg border border-slate-200 cursor-pointer p-1 bg-white"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-900 uppercase"
                  />
                </div>
                <p className="text-[11px] text-slate-400">Used for badges, highlights, and report card distinctions.</p>
              </div>
            </div>

            <div
              className="rounded-xl border p-4"
              style={{
                backgroundColor: previewTokens["--school-primary-surface"],
                borderColor: previewTokens["--school-primary-border"],
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Live school-facing preview</p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Primary and Accent derive interaction, focus, selection, and progress tokens. Status alerts and grade-band colours are not changed.
                  </p>
                </div>
                <span className={`text-[11px] font-semibold ${themeCanSave ? "text-emerald-700" : "text-rose-700"}`} role="status">
                  {themeCanSave ? "Contrast-safe tokens ready" : "Enter valid hex colours to save"}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-xs font-bold outline-none ring-offset-2 focus-visible:ring-2"
                  style={{
                    backgroundColor: previewTokens["--school-primary"],
                    color: previewTokens["--school-primary-contrast"],
                    outlineColor: previewTokens["--school-focus-ring"],
                  }}
                >
                  Primary action
                </button>
                <span
                  className="rounded-lg px-3 py-2 text-center text-xs font-bold"
                  style={{
                    backgroundColor: previewTokens["--school-accent"],
                    color: previewTokens["--school-accent-contrast"],
                  }}
                >
                  Accent highlight
                </span>
                <span
                  className="rounded-lg px-3 py-2 text-center text-xs font-bold"
                  style={{
                    backgroundColor: previewTokens["--school-progress"],
                    color: previewTokens["--school-progress-contrast"],
                  }}
                >
                  Progress
                </span>
              </div>
            </div>

            {/* Presets */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Curated Preset Palettes
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_PALETTES.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setPrimaryColor(preset.primary);
                      setAccentColor(preset.accent);
                    }}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                      primaryColor.toLowerCase() === preset.primary.toLowerCase() &&
                      accentColor.toLowerCase() === preset.accent.toLowerCase()
                        ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center -space-x-1">
                      <span
                        className="h-5 w-5 rounded-full border border-white shadow-xs"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <span
                        className="h-5 w-5 rounded-full border border-white shadow-xs"
                        style={{ backgroundColor: preset.accent }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Contact & Letterhead Details */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
            <Mail className="h-4 w-4 text-emerald-600" />
            <span>Official Contact & Letterhead Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                Official School Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="e.g. info@meridiancrest.org"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                Official Contact Phone
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="e.g. +234 803 123 4567"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                Physical Campus Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Plot 12, Heritage Way, Victoria Island, Lagos"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400">
                Printed in the header of invoice fee statements and the footer of term report cards.
              </p>
            </div>
          </div>
        </div>

        {/* Section 5: Navigation & Workspace Interface */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
              <Compass className="h-4 w-4 text-indigo-600" />
              <span>Workspace Navigation Style</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
              Live Preference
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Choose how your main navigation organizes modules and sub-pages. Changes apply immediately across your workspace.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Option 1: Straight Grouped List */}
            <button
              type="button"
              onClick={() => handleNavLayoutChange("grouped")}
              className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-150 relative cursor-pointer ${
                navLayout === "grouped"
                  ? "border-slate-950 bg-slate-50/80 ring-1 ring-slate-950 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className={`p-2 rounded-lg ${navLayout === "grouped" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>
                  <LayoutGrid className="h-4 w-4" />
                </div>
                {navLayout === "grouped" ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-950 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
                    <Check className="h-3 w-3 text-indigo-600" />
                    Default
                  </span>
                ) : null}
              </div>
              <h4 className="text-xs font-bold text-slate-950">Straight Grouped List</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                All 5 domains visible with 1-click speed across the entire workspace.
              </p>
            </button>

            {/* Option 2: Collapsible Accordions */}
            <button
              type="button"
              onClick={() => handleNavLayoutChange("accordion")}
              className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-150 relative cursor-pointer ${
                navLayout === "accordion"
                  ? "border-slate-950 bg-slate-50/80 ring-1 ring-slate-950 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className={`p-2 rounded-lg ${navLayout === "accordion" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>
                  <FolderTree className="h-4 w-4" />
                </div>
                {navLayout === "accordion" ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-950 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
                    <Check className="h-3 w-3 text-indigo-600" />
                    Active
                  </span>
                ) : null}
              </div>
              <h4 className="text-xs font-bold text-slate-950">Collapsible Accordions</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                2-tier expandable groups with item counts and focus guide lines.
              </p>
            </button>

            {/* Option 3: Top Domain Switcher */}
            <button
              type="button"
              onClick={() => handleNavLayoutChange("domain_tabs")}
              className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-150 relative cursor-pointer ${
                navLayout === "domain_tabs"
                  ? "border-slate-950 bg-slate-50/80 ring-1 ring-slate-950 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className={`p-2 rounded-lg ${navLayout === "domain_tabs" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>
                  <Columns3 className="h-4 w-4" />
                </div>
                {navLayout === "domain_tabs" ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-950 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
                    <Check className="h-3 w-3 text-indigo-600" />
                    Active
                  </span>
                ) : null}
              </div>
              <h4 className="text-xs font-bold text-slate-950">Top Domain Switcher</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Horizontal domain tabs in the header paired with a focused sidebar.
              </p>
            </button>
          </div>
        </div>
      </form>

      <ConfirmationModal
        isOpen={isLogoRemovalOpen}
        onClose={() => setIsLogoRemovalOpen(false)}
        onConfirm={handleRemoveCurrentLogo}
        title="Remove current logo?"
        description="This removes the saved school logo. A selected replacement image will remain available until you save or discard it."
        confirmLabel="Remove current logo"
        confirmVariant="danger"
        isLoading={isSaving}
      />
    </div>
  );
}
