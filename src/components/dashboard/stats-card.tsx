import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'pending' | 'awaiting';
  className?: string;
}

const variantStyles = {
  default: "border-border",
  success: "border-success/20 bg-success-light",
  warning: "border-warning/20 bg-warning-light",
  pending: "border-pending/20 bg-pending-light",
  awaiting: "border-awaiting/20 bg-awaiting-light",
};

export function StatsCard({ title, value, icon, variant = 'default', className }: StatsCardProps) {
  return (
    <Card className={cn(variantStyles[variant], className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-cairo">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}