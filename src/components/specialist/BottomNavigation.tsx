import { Home, Package, Settings, Lock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";
import { useSpecialistBusyStatus } from "@/hooks/useSpecialistBusyStatus";

interface BottomNavigationProps {
  newOrdersCount?: number;
  specialistId?: string;
}

export default function BottomNavigation({ newOrdersCount = 0, specialistId }: BottomNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { isBusy, currentOrderId } = useSpecialistBusyStatus(specialistId || null);

  const navItems = [
    {
      icon: Home,
      label: isAr ? "الرئيسية" : "Home",
      path: "/specialist-orders",
      isActive: location.pathname === "/specialist-orders",
      disabled: isBusy && !location.pathname.includes('/tracking/')
    },
    {
      icon: Package,
      label: isAr ? "عروض جديدة" : "New Orders",
      path: "/specialist-orders/new",
      isActive: location.pathname === "/specialist-orders/new",
      badge: isBusy ? 0 : newOrdersCount, // إخفاء العداد عند الانشغال
      disabled: isBusy
    },
    {
      icon: Settings,
      label: isAr ? "الإعدادات" : "Settings",
      path: "/specialist-orders/profile",
      isActive: location.pathname === "/specialist-orders/profile",
      disabled: isBusy && !location.pathname.includes('/tracking/')
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50">
      {/* رسالة تنبيه عند الانشغال */}
      {isBusy && currentOrderId && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium">
          {isAr ? '🔒 لديك طلب قيد التنفيذ - العروض الجديدة متوقفة مؤقتاً' : '🔒 Order in progress - New offers paused'}
        </div>
      )}
      
      <div className="flex items-center justify-around h-20 px-2 max-w-screen-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isDisabled = item.disabled;
          
          return (
            <button
              key={item.path}
              onClick={() => {
                if (isDisabled) {
                  // إذا كان مشغولاً، توجيه للطلب الحالي
                  if (currentOrderId) {
                    navigate(`/specialist-orders/tracking/${currentOrderId}`);
                  }
                } else {
                  navigate(item.path);
                }
              }}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all flex-1",
                isDisabled && "opacity-40 cursor-not-allowed",
                item.isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <div className="relative">
                {isDisabled ? (
                  <Lock className="h-5 w-5" />
                ) : (
                  <Icon 
                    className={cn(
                      "h-6 w-6 transition-transform",
                      item.isActive && "scale-110"
                    )} 
                  />
                )}
                {item.badge && item.badge > 0 && !isDisabled && (
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
              {item.isActive && !isDisabled && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-primary rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
