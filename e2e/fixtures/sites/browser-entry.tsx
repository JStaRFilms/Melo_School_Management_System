// Test-only browser entry. Production pages are imported unchanged.
import React from "react";
import { createRoot } from "react-dom/client";
import AdminPage from "../../../apps/admin/app/admin/settings/site/page";
import PlatformPage from "../../../apps/platform/app/schools/[schoolId]/site/page";
import { admitSite } from "../../../apps/sites/core/public";
import { renderSite } from "../../../apps/sites/core/registry";

const root = createRoot(document.getElementById("root")!);
if (location.pathname === "/public") {
  fetch("/site-data").then(response => response.json()).then(value => {
    const result = admitSite(value, "home", "canonical.synthetic.edu");
    root.render(result.status === "available" ? renderSite(result.site, "home") : <p>Site unavailable</p>);
  });
} else root.render(location.pathname === "/platform" ? <PlatformPage /> : <AdminPage />);
