import { Home, Package, MessageSquare, Lock, Wallet } from "lucide-react";
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
      gradient: "from-emerald-400 to-green-500"
    },
    {
      icon: Home,
      label: isAr ? "عروض جديدة" : "New Offers",
      path: "/specialist-orders/new",
      isActive: location.pathname === "/specialist-orders/new",
      badge: isBusy ? 0 : newOrdersCount,
      disabled: isBusy,
      gradient: "from-blue-400 to-indigo-500"
    },
    {
      icon: Wallet,
      label: isAr ? "المحفظة" : "Wallet",
      path: "/specialist/wallet",
      isActive: location.pathname === "/specialist/wallet",
      disabled: isBusy && !location.pathname.includes('/tracking/'),
      gradient: "from-amber-400 to-orange-500"
    },
    {
      icon: MessageSquare,
      label: isAr ? "المحادثات" : "Messages",
      path: "/specialist/messages",
      isActive: location.pathname === "/specialist/messages",
      disabled: isBusy && !location.pathname.includes('/tracking/'),
      gradient: "from-purple-400 to-pink-500"
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-purple-600 via-pink-500 to-purple-600/95 border-t border-white/20 shadow-2xl backdrop-blur-sm z-50">
      {/* رسالة تنبيه عند الانشغال - Mobile Optimized */}
      {isBusy && currentOrderId && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-2 text-center text-xs sm:text-sm font-bold shadow-lg animate-pulse">
          {isAr ? '🔒 لديك طلب قيد التنفيذ' : '🔒 Order in progress'}
        </div>
      )}
      
      <div className="flex items-center justify-around h-16 sm:h-20 px-2 sm:px-3 max-w-screen-lg mx-auto">
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
                "relative flex flex-col items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl transition-all duration-300 flex-1 group",
                isDisabled && "opacity-40 cursor-not-allowed",
                item.isActive 
                  ? `bg-gradient-to-br ${item.gradient} text-white shadow-lg scale-105` 
                  : "text-white/70 hover:text-white hover:bg-white/10 hover:scale-105"
              )}
            >
              <div className="relative">
                {isDisabled ? (
                  <Lock className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : (
                  <>
                    <Icon 
                      className={cn(
                        "h-5 w-5 sm:h-6 sm:w-6 transition-all duration-300",
                        item.isActive && "drop-shadow-lg animate-pulse"
                      )} 
                    />
                    {item.badge !== undefined && item.badge > 0 && (
                      <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 min-w-[18px] sm:min-w-[20px] h-4 sm:h-5 px-1 sm:px-1.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg border border-white sm:border-2 z-10">
                        <span className="text-[9px] sm:text-[10px] font-extrabold text-white leading-none">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <span className={cn(
                "text-[9px] sm:text-[10px] font-semibold transition-all duration-300 whitespace-nowrap leading-tight",
                item.isActive && "font-extrabold drop-shadow-md"
              )}>
                {item.label}
              </span>
              {item.isActive && !isDisabled && (
                <div className={cn(
                  "absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 sm:w-14 h-1 sm:h-1.5 rounded-t-full",
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
