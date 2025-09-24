import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  className?: string;
}

const statusConfig = {
  pending: {
    label: 'قيد الانتظار',
    className: 'bg-pending-light text-pending-foreground border-pending/20',
  },
  'in-progress': {
    label: 'قيد التنفيذ',
    className: 'bg-warning-light text-warning-foreground border-warning/20',
  },
  completed: {
    label: 'مكتمل',
    className: 'bg-success-light text-success-foreground border-success/20',
  },
  cancelled: {
    label: 'ملغي',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}