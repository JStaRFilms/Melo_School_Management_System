"use client";

import React, { createContext, useContext, useMemo } from "react";
import {
  deriveSchoolTheme,
  SchoolThemeDerivation,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_ACCENT_COLOR,
} from "./themeDerivation";

export interface SchoolThemeContextValue {
  primaryColor: string;
  accentColor: string;
  tokens: SchoolThemeDerivation;
}

export const SchoolThemeContext = createContext<SchoolThemeContextValue>({
  primaryColor: DEFAULT_PRIMARY_COLOR,
  accentColor: DEFAULT_ACCENT_COLOR,
  tokens: deriveSchoolTheme(DEFAULT_PRIMARY_COLOR, DEFAULT_ACCENT_COLOR),
});

export function useSchoolTheme(): SchoolThemeContextValue {
  return useContext(SchoolThemeContext);
}

export interface SchoolThemeProviderProps {
  primaryColor?: string | null;
  accentColor?: string | null;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
}

/**
 * SchoolThemeProvider applies derived, contrast-safe CSS custom properties to its wrapper container.
 * Also exposes the computed tokens via React context.
 */
export function SchoolThemeProvider({
  primaryColor,
  accentColor,
  children,
  className,
  style,
  as: Component = "div",
}: SchoolThemeProviderProps) {
  const effectivePrimary = primaryColor || DEFAULT_PRIMARY_COLOR;
  const effectiveAccent = accentColor || DEFAULT_ACCENT_COLOR;

  const tokens = useMemo(() => {
    return deriveSchoolTheme(effectivePrimary, effectiveAccent);
  }, [effectivePrimary, effectiveAccent]);

  const contextValue = useMemo(
    () => ({
      primaryColor: effectivePrimary,
      accentColor: effectiveAccent,
      tokens,
    }),
    [effectivePrimary, effectiveAccent, tokens]
  );

  return (
    <SchoolThemeContext.Provider value={contextValue}>
      <Component
        className={className}
        style={{
          ...style,
          ...(tokens as unknown as React.CSSProperties),
        }}
      >
        {children}
      </Component>
    </SchoolThemeContext.Provider>
  );
}
