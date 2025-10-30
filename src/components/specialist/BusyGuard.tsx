import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpecialistBusyStatus } from '@/hooks/useSpecialistBusyStatus';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

interface BusyGuardProps {
  specialistId: string;
  allowWhenBusy?: boolean; // للصفحات التي يمكن الوصول لها أثناء الانشغال
  children: React.ReactNode;
}

export default function BusyGuard({ specialistId, allowWhenBusy = false, children }: BusyGuardProps) {
  const { isBusy, currentOrderId, isLoading } = useSpecialistBusyStatus(specialistId);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  useEffect(() => {
    // إذا كان المحترف مشغولاً ولا يسمح بالوصول لهذه الصفحة
    if (!isLoading && isBusy && !allowWhenBusy && currentOrderId) {
      // إعادة التوجيه لصفحة تتبع الطلب
      navigate(`/specialist-orders/tracking/${currentOrderId}`);
    }
  }, [isBusy, isLoading, allowWhenBusy, currentOrderId, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // إذا كان مشغولاً ولا يسمح بالوصول، لا نعرض المحتوى
  if (isBusy && !allowWhenBusy) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="text-4xl">⏳</div>
          <h3 className="text-xl font-bold">
            {isAr ? 'لديك طلب قيد التنفيذ' : 'You have an order in progress'}
          </h3>
          <p className="text-muted-foreground">
            {isAr ? 'يرجى إنهاء الطلب الحالي أولاً' : 'Please complete the current order first'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
