import { cn } from "@/lib/utils";
import { Clock, AlertCircle, CheckCircle2, XCircle, MessageSquare, Calendar } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface StatusBadgeProps {
  status: 'pending' | 'awaiting-response' | 'waiting_quotes' | 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
  className?: string;
}

const statusConfig = {
  pending: {
    labelAr: 'قيد الانتظار',
    labelEn: 'Pending',
    icon: Clock,
    className: 'bg-pending-light text-pending border-pending/30 shadow-sm',
  },
  'awaiting-response': {
    labelAr: 'في انتظار الرد',
    labelEn: 'Awaiting Response',
    icon: MessageSquare,
    className: 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  },
  'waiting_quotes': {
    labelAr: 'بانتظار العروض',
    labelEn: 'Waiting Quotes',
    icon: MessageSquare,
    className: 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  },
  'upcoming': {
    labelAr: 'قادم',
    labelEn: 'Upcoming',
    icon: Calendar,
    className: 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800',
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