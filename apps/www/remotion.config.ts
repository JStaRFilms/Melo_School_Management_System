import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind";

Config.setVideoImageFormat("jpeg");
Config.overrideWebpackConfig((currentConfiguration) => {
  const config = enableTailwind(currentConfiguration);
  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...(config.resolve?.alias ?? {}),
        "next/link": path.resolve(process.cwd(), "remotion/stubs/NextLink.tsx"),
        "next/navigation": path.resolve(process.cwd(), "remotion/stubs/NextNavigation.ts"),
        "@": path.resolve(process.cwd(), "../portal/lib"),
        "/grid.svg": path.resolve(process.cwd(), "public/grid.svg"),
      },
    },
  };
});
Config.setEntryPoint("./remotion/Root.tsx");
