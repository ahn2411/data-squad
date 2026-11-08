import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Show the wordmark next to the mark */
  showWordmark?: boolean;
}

/**
 * Brand mark — a compact square with a stylised "squad" cluster of nodes.
 * Pure SVG, no external assets.
 */
export function Logo({ className, showWordmark = false }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="4" cy="4" r="2" fill="currentColor" />
          <circle cx="12" cy="4" r="2" fill="currentColor" opacity="0.7" />
          <circle cx="4" cy="12" r="2" fill="currentColor" opacity="0.7" />
          <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.45" />
          <path
            d="M4 4 L12 4 M4 4 L4 12 M4 12 L12 12 M12 4 L12 12 M4 4 L12 12"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.35"
          />
        </svg>
      </span>
      {showWordmark ? (
        <span className="text-[13px] font-semibold tracking-tight text-foreground">
          Squad Hub
        </span>
      ) : null}
    </div>
  );
}
