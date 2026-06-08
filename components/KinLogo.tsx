"use client";

interface KinLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export function KinLogo({ size = 32, showWordmark = false, className = "" }: KinLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* K mark — geometric, minimal */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="40" height="40" rx="10" fill="#15c489" />
        {/* K letterform */}
        <path
          d="M12 10v20M12 20l10-10M12 20l10 10"
          stroke="#090907"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showWordmark && (
        <span
          style={{ fontSize: size * 0.6, letterSpacing: "-0.02em" }}
          className="font-bold text-text-primary"
        >
          Kin
        </span>
      )}
    </div>
  );
}
