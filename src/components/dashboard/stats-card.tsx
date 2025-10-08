import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'pending' | 'awaiting';
  className?: string;
  isActive?: boolean;
}

const variantStyles = {
  default: "border-border",
  success: "border-success/20 bg-success-light",
  warning: "border-warning/20 bg-warning-light",
  pending: "border-pending/20 bg-pending-light",
  awaiting: "border-awaiting/20 bg-awaiting-light",
};

const activeVariantStyles = {
  default: "border-primary border-4 shadow-lg",
  success: "border-success border-4 shadow-lg shadow-success/20",
  warning: "border-warning border-4 shadow-lg shadow-warning/20",
  pending: "border-pending border-4 shadow-lg shadow-pending/20",
  awaiting: "border-awaiting border-4 shadow-lg shadow-awaiting/20",
};

const activeIconColors = {
  default: "text-primary",
  success: "text-success",
  warning: "text-warning",
  pending: "text-pending",
  awaiting: "text-awaiting",
};

export function StatsCard({ title, value, icon, variant = 'default', className, isActive = false }: StatsCardProps) {
  return (
    <Card className={cn(
      variantStyles[variant],
      isActive && activeVariantStyles[variant],
      "transition-all duration-200",
      isActive && "scale-105",
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={cn(
          "text-sm font-medium",
          isActive ? "text-foreground font-bold" : "text-muted-foreground"
        )}>
          {title}
        </CardTitle>
        <div className={cn(
          isActive ? activeIconColors[variant] : "text-muted-foreground",
          "relative"
        )}>
          {icon}
          {isActive && (
            <CheckCircle2 className="absolute -top-2 -right-2 h-4 w-4 text-primary fill-primary-foreground" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "text-2xl font-bold font-cairo",
          isActive && activeIconColors[variant]
        )}>
          {value}
        </div>
        {isActive && (
          <div className={cn("text-xs font-medium mt-1", activeIconColors[variant])}>
            ● القسم النشط
          </div>
        )}
      </CardContent>
    </Card>
  );
}