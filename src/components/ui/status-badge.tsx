import { cn } from "@/lib/utils";
import { Clock, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface StatusBadgeProps {
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  className?: string;
}

const statusConfig = {
  pending: {
    labelAr: 'قيد الانتظار',
    labelEn: 'Pending',
    icon: Clock,
    className: 'bg-pending-light text-pending border-pending/30 shadow-sm',
  },
  'in-progress': {
    labelAr: 'قيد التنفيذ',
    labelEn: 'In Progress',
    icon: AlertCircle,
    className: 'bg-warning-light text-warning border-warning/30 shadow-sm',
  },
  completed: {
    labelAr: 'مكتمل',
    labelEn: 'Completed',
    icon: CheckCircle2,
    className: 'bg-success-light text-success border-success/30 shadow-sm',
  },
  cancelled: {
    labelAr: 'ملغي',
    labelEn: 'Cancelled',
    icon: XCircle,
    className: 'bg-destructive/10 text-destructive border-destructive/30 shadow-sm',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { language } = useLanguage();
  const config = statusConfig[status];
  const Icon = config.icon;
  const label = language === 'ar' ? config.labelAr : config.labelEn;
  
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-semibold transition-all hover:scale-105",
        config.className,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}