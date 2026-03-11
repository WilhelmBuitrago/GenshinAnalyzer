import { ReactNode } from "react";

interface ChartWrapperProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function ChartWrapper({ title, description, action, children }: ChartWrapperProps) {
  return (
    <div className="card card-hover p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="panel-title">{title}</h3>
          {description && <p className="text-sm text-muted mt-1">{description}</p>}
        </div>
        {action}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}
