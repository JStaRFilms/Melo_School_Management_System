"use client";

export type AvatarDensity = "sm" | "md" | "lg";

const DENSITY_CLASSES: Record<AvatarDensity, string> = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-11 w-11 text-xs",
};

/**
 * Initials for avatar fallbacks (consolidation P22). First letters of the
 * first two whitespace-separated parts, uppercased. Consolidates six
 * call-site variants (split(" ") vs split(/\s+/) agree except on exotic
 * tab/newline whitespace inside names).
 */
export function getInitials(name: string | null | undefined, fallback = "ST"): string {
  if (!name) return fallback;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || fallback;
}

export interface AvatarProps {
  name: string | null | undefined;
  src?: string | null;
  alt?: string;
  density?: AvatarDensity;
  fallback?: string;
  roundedClass?: string;
  className?: string;
  /** Photo-only classes (e.g. a different border than the initials fallback). */
  imgClassName?: string;
}

/**
 * Initials avatar with optional photo (consolidation P22). Sizing comes from
 * the density prop; colors and rounding stay with each caller through
 * className so card chrome never unifies into a mega component.
 */
export function Avatar({
  name,
  src,
  alt,
  density = "md",
  fallback = "ST",
  roundedClass = "rounded-xl",
  className = "",
  imgClassName,
}: AvatarProps) {
  const size = DENSITY_CLASSES[density];
  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? name ?? "Avatar"}
        className={`${size} ${roundedClass} object-cover ${imgClassName ?? className}`}
      />
    );
  }
  return (
    <div className={`${size} ${roundedClass} flex items-center justify-center font-bold ${className}`}>
      {getInitials(name, fallback)}
    </div>
  );
}
