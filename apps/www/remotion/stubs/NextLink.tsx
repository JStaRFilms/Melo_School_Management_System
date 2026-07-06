import React, { type AnchorHTMLAttributes, type ReactNode } from "react";

type NextLinkStubProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href?: string;
};

export default function NextLink({
  children,
  href,
  ...props
}: NextLinkStubProps) {
  return (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  );
}
