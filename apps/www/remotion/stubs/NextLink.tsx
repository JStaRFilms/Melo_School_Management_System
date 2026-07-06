import React, { type ReactNode } from "react";

export default function NextLink({
  children,
  className,
  href,
}: {
  children: ReactNode;
  className?: string;
  href?: string;
}) {
  return (
    <a className={className} href={typeof href === "string" ? href : "#"}>
      {children}
    </a>
  );
}
