import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/constants";

interface LogoProps {
  className?: string;
  showText?: boolean;
  to?: string;
}

export function Logo({ className, showText = true, to = "/" }: LogoProps) {
  return (
    <Link to={to} className={cn("flex items-center gap-2.5 font-display", className)}>
      <img
        src={logo}
        alt={`${APP_NAME} logo`}
        width={36}
        height={36}
        className="h-9 w-9 drop-shadow-[0_0_12px_oklch(0.62_0.21_268/0.6)]"
      />
      {showText && (
        <span className="text-lg font-semibold leading-none tracking-tight">
          Roblox <span className="text-gradient">AI</span> Studio
        </span>
      )}
    </Link>
  );
}
