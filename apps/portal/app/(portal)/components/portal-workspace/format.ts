import {
  formatDateGBDay,
  formatMoneyMajor,
  formatScoreOrDash,
} from "@school/shared/format";

export function buildPortalHref(
  pathname: string,
  params: Record<string, string | null | undefined>
) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function formatScore(value: number | null) {
  return formatScoreOrDash(value);
}

export function formatDate(value: number) {
  return formatDateGBDay(value);
}

export function formatMoney(amount: number, currency: string) {
  return formatMoneyMajor(amount, currency);
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
