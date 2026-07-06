export function usePathname() {
  return "/";
}

export function useRouter() {
  return {
    push: () => undefined,
    replace: () => undefined,
    prefetch: () => undefined,
    refresh: () => undefined,
    back: () => undefined,
    forward: () => undefined,
  };
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function redirect() {
  return undefined;
}
