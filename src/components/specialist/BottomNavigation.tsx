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
      icon: Package,
      label: isAr ? "طلبات مؤكدة" : "Confirmed",
      path: "/specialist-orders",
      isActive: location.pathname === "/specialist-orders",
      disabled: isBusy && !location.pathname.includes('/tracking/'),
      gradient: "from-green-500 to-emerald-600"
    },
    {
      icon: Home,
      label: isAr ? "عروض جديدة" : "New Offers",
      path: "/specialist-orders/new",
      isActive: location.pathname === "/specialist-orders/new",
      badge: isBusy ? 0 : newOrdersCount,
      disabled: isBusy,
      gradient: "from-blue-500 to-indigo-600"
    },
    {
      icon: Settings,
      label: isAr ? "الإعدادات" : "Settings",
      path: "/specialist-orders/profile",
      isActive: location.pathname === "/specialist-orders/profile",
      disabled: isBusy && !location.pathname.includes('/tracking/'),
      gradient: "from-purple-500 to-pink-600"
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-background/95 border-t-2 border-primary/20 shadow-2xl backdrop-blur-sm z-50">
      {/* رسالة تنبيه عند الانشغال */}
      {isBusy && currentOrderId && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 text-center text-sm font-bold shadow-lg animate-pulse">
          {isAr ? '🔒 لديك طلب قيد التنفيذ - العروض الجديدة متوقفة مؤقتاً' : '🔒 Order in progress - New offers paused'}
        </div>
      )}
      
      <div className="flex items-center justify-around h-24 px-3 max-w-screen-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isDisabled = item.disabled;
          
          return (
            <button
              key={item.path}
              onClick={() => {
                if (isDisabled) {
                  if (currentOrderId) {
                    navigate(`/specialist-orders/tracking/${currentOrderId}`);
                  }
                } else {
                  navigate(item.path);
                }
              }}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 px-5 py-3 rounded-2xl transition-all duration-300 flex-1 group",
                isDisabled && "opacity-40 cursor-not-allowed",
                item.isActive 
                  ? `bg-gradient-to-br ${item.gradient} text-white shadow-lg scale-105` 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:scale-105"
              )}
            >
              <div className="relative">
                {isDisabled ? (
                  <Lock className="h-6 w-6" />
                ) : (
                  <>
                    <Icon 
                      className={cn(
                        "h-7 w-7 transition-all duration-300",
                        item.isActive && "drop-shadow-lg animate-pulse"
                      )} 
                    />
                    {item.badge && item.badge > 0 && !isDisabled && (
                      <div className="absolute -top-3 -right-3 h-6 w-6 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center animate-bounce shadow-lg border-2 border-white">
                        <span className="text-[11px] font-extrabold text-white">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <span className={cn(
                "text-[11px] font-semibold transition-all duration-300 whitespace-nowrap",
                item.isActive && "font-extrabold drop-shadow-md"
              )}>
                {item.label}
              </span>
              {item.isActive && !isDisabled && (
                <div className={cn(
                  "absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-1.5 rounded-t-full",
                  `bg-gradient-to-r ${item.gradient}`,
                  "shadow-lg animate-pulse"
                )} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
