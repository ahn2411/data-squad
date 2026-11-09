import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Accept only same-origin app paths before passing database values to navigation. */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return null;
  }

  try {
    const url = new URL(value, "https://squad-hub.invalid");
    return url.origin === "https://squad-hub.invalid" ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}
