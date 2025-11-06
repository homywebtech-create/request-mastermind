import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';

interface TrackingTimeInfoProps {
  trackingStage: string;
  updatedAt: string;
  hoursCount?: number | null;
}

export function TrackingTimeInfo({ trackingStage, updatedAt, hoursCount }: TrackingTimeInfoProps) {
  const { language } = useLanguage();
  const [timeInfo, setTimeInfo] = useState<string>('');

  useEffect(() => {
    const updateTimeInfo = () => {
      const now = new Date();
      const updatedTime = new Date(updatedAt);
      const minutesPassed = Math.floor((now.getTime() - updatedTime.getTime()) / 1000 / 60);

      if (trackingStage === 'arrived') {
        // Auto-start after 5 minutes
        const remainingMinutes = Math.max(0, 5 - minutesPassed);
        if (remainingMinutes > 0) {
          setTimeInfo(
            language === 'ar'
              ? `بدء تلقائي بعد ${remainingMinutes} دقيقة`
              : `Auto-start in ${remainingMinutes} min`
          );
        } else {
          setTimeInfo(
            language === 'ar'
              ? 'تم البدء التلقائي'
              : 'Auto-started'
          );
        }
      } else if (trackingStage === 'working' && hoursCount) {
        // Calculate remaining work time
        const totalWorkMinutes = hoursCount * 60;
        const remainingMinutes = Math.max(0, totalWorkMinutes - minutesPassed);
        const remainingHours = Math.floor(remainingMinutes / 60);
        const remainingMins = remainingMinutes % 60;

        if (remainingMinutes > 0) {
          if (remainingHours > 0) {
            setTimeInfo(
              language === 'ar'
                ? `متبقي ${remainingHours} ساعة ${remainingMins} دقيقة`
                : `${remainingHours}h ${remainingMins}m left`
            );
          } else {
            setTimeInfo(
              language === 'ar'
                ? `متبقي ${remainingMins} دقيقة`
                : `${remainingMins} min left`
            );
          }
        } else {
          setTimeInfo(
            language === 'ar'
              ? 'انتهى الوقت'
              : 'Time expired'
          );
        }
      } else {
        setTimeInfo('');
      }
    };

    updateTimeInfo();
    const interval = setInterval(updateTimeInfo, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [trackingStage, updatedAt, hoursCount, language]);

  if (!timeInfo || !['arrived', 'working'].includes(trackingStage)) {
    return null;
  }

  return (
    <Badge 
      variant="outline" 
      className="flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
    >
      <Clock className="h-3 w-3" />
      {timeInfo}
    </Badge>
  );
}
