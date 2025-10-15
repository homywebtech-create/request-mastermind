import { Home, Package, BarChart3, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";

interface BottomNavigationProps {
  newOrdersCount?: number;
}

export default function BottomNavigation({ newOrdersCount = 0 }: BottomNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const navItems = [
    {
      icon: Home,
      label: isAr ? "الرئيسية" : "Home",
      path: "/specialist-orders",
      isActive: location.pathname === "/specialist-orders"
    },
    {
      icon: Package,
      label: isAr ? "عروض جديدة" : "New Orders",
      path: "/specialist-orders/new",
      isActive: location.pathname === "/specialist-orders/new",
      badge: newOrdersCount
    },
    {
      icon: BarChart3,
      label: isAr ? "الإحصائيات" : "Stats",
      path: "/specialist-orders/stats",
      isActive: location.pathname === "/specialist-orders/stats"
    },
    {
      icon: User,
      label: isAr ? "الحساب" : "Profile",
      path: "/specialist-orders/profile",
      isActive: location.pathname === "/specialist-orders/profile"
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50">
      <div className="flex items-center justify-around h-20 px-2 max-w-screen-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all flex-1",
                item.isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <div className="relative">
                <Icon 
                  className={cn(
                    "h-6 w-6 transition-transform",
                    item.isActive && "scale-110"
                  )} 
                />
                {item.badge && item.badge > 0 && (
                  <div className="absolute -top-2 -right-2 h-5 w-5 bg-destructive rounded-full flex items-center justify-center animate-pulse">
                    <span className="text-[10px] font-bold text-destructive-foreground">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  </div>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all",
                item.isActive && "font-bold"
              )}>
                {item.label}
              </span>
              {item.isActive && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-primary rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
