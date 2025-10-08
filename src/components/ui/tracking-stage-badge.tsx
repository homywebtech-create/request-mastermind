import { cn } from "@/lib/utils";
import { Car, MapPin, Wrench, CheckCircle2, FileText, DollarSign, XCircle } from "lucide-react";

interface TrackingStageBadgeProps {
  stage: string | null | undefined;
  className?: string;
}

const stageConfig = {
  moving: {
    label: 'Moving to Customer',
    icon: Car,
    className: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  },
  arrived: {
    label: 'Arrived at Location',
    icon: MapPin,
    className: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
  },
  working: {
    label: 'Working',
    icon: Wrench,
    className: 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
  },
  completed: {
    label: 'Work Completed',
    icon: CheckCircle2,
    className: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  },
  invoice_requested: {
    label: 'Invoice Requested',
    icon: FileText,
    className: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700',
  },
  payment_received: {
    label: 'Payment Received',
    icon: DollarSign,
    className: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    className: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
  },
};

export function TrackingStageBadge({ stage, className }: TrackingStageBadgeProps) {
  if (!stage) return null;
  
  const config = stageConfig[stage as keyof typeof stageConfig];
  if (!config) return null;
  
  const Icon = config.icon;
  
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-all hover:scale-105 shadow-sm",
        config.className,
        className
      )}
    >
      <Icon className="h-4 w-4" />
      {config.label}
    </span>
  );
}
