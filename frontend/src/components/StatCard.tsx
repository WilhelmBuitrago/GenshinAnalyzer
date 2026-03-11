import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: ReactNode;
  subtitle?: string;
  variant?: "default" | "success" | "warning" | "info";
}

const badgeVariants: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "bg-white/5 text-text",
  success: "bg-green-500/20 text-green-200",
  warning: "bg-amber-500/20 text-amber-200",
  info: "bg-primary/20 text-primary"
};

export function StatCard({ title, value, subtitle, variant = "default" }: StatCardProps) {
  return (
    <div className="card card-hover p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{title}</p>
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeVariants[variant]}`}>
          {variant === "default" ? "Metric" : variant.toUpperCase()}
        </span>
      </div>
      <div className="text-2xl font-semibold text-text">{value}</div>
      {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
    </div>
  );
}
