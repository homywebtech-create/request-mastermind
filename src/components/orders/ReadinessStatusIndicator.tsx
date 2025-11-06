import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle, AlertCircle, Send } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

interface ReadinessStatusIndicatorProps {
  bookingDate?: string | null;
  bookingTime?: string | null;
  readinessCheckSentAt?: string | null;
  specialistReadinessStatus?: string | null;
  specialistReadinessResponseAt?: string | null;
  specialistNotReadyReason?: string | null;
  onReassign?: () => void;
  canManage?: boolean;
}

export function ReadinessStatusIndicator({
  bookingDate,
  bookingTime,
  readinessCheckSentAt,
  specialistReadinessStatus,
  specialistReadinessResponseAt,
  specialistNotReadyReason,
  onReassign,
  canManage = false,
}: ReadinessStatusIndicatorProps) {
  const { language } = useLanguage();
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getBookingDateTime = () => {
    if (!bookingDate) return null;
    
    const dateTime = new Date(bookingDate);
    
    if (bookingTime) {
      if (bookingTime === 'morning') {
        dateTime.setHours(8, 0, 0, 0);
      } else if (bookingTime === 'afternoon') {
        dateTime.setHours(14, 0, 0, 0);
      } else if (bookingTime === 'evening') {
        dateTime.setHours(18, 0, 0, 0);
      } else {
        const [hours, minutes] = bookingTime.split(':').map(Number);
        dateTime.setHours(hours, minutes, 0, 0);
      }
    } else {
      dateTime.setHours(8, 0, 0, 0);
    }
    
    return dateTime;
  };

  const formatTimeRemaining = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return language === 'ar' ? `${days} يوم` : `${days} days`;
    }
    
    if (hours > 0) {
      return language === 'ar' 
        ? `${hours} ساعة ${minutes > 0 ? `و ${minutes} دقيقة` : ''}`
        : `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
    }
    
    return language === 'ar' ? `${minutes} دقيقة` : `${minutes}m`;
  };

  const bookingDateTime = getBookingDateTime();
  const timeUntilBooking = bookingDateTime ? bookingDateTime.getTime() - currentTime : null;
  const isPast = timeUntilBooking !== null && timeUntilBooking < 0;
  const isWithinOneHour = timeUntilBooking !== null && timeUntilBooking < 60 * 60 * 1000 && timeUntilBooking > 0;

  // Status color coding
  const getStatusColor = () => {
    if (!readinessCheckSentAt) {
      return 'bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300';
    }
    
    if (specialistReadinessStatus === 'ready') {
      return 'bg-yellow-100 border-yellow-400 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-300';
    }
    
    if (specialistReadinessStatus === 'not_ready') {
      return 'bg-red-100 border-red-400 text-red-800 dark:bg-red-900/30 dark:border-red-600 dark:text-red-300';
    }
    
    // Waiting for response
    return 'bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300';
  };

  const getStatusIcon = () => {
    if (specialistReadinessStatus === 'ready') {
      return <CheckCircle className="h-4 w-4" />;
    }
    
    if (specialistReadinessStatus === 'not_ready') {
      return <XCircle className="h-4 w-4" />;
    }
    
    if (readinessCheckSentAt) {
      return <AlertCircle className="h-4 w-4" />;
    }
    
    return <Clock className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (!bookingDateTime) {
      return language === 'ar' ? 'لا يوجد موعد محدد' : 'No booking time set';
    }

    if (isPast) {
      return language === 'ar' ? '⏰ انتهى الموعد' : '⏰ Time passed';
    }

    if (!readinessCheckSentAt) {
      return language === 'ar' 
        ? `⏱️ باقي ${formatTimeRemaining(timeUntilBooking!)}`
        : `⏱️ ${formatTimeRemaining(timeUntilBooking!)} remaining`;
    }

    if (specialistReadinessStatus === 'ready') {
      return language === 'ar' 
        ? '🟡 المحترفة جاهزة وستذهب'
        : '🟡 Specialist ready, will go';
    }

    if (specialistReadinessStatus === 'not_ready') {
      return language === 'ar' 
        ? '🔴 المحترفة لن تستطيع الذهاب'
        : '🔴 Specialist cannot go';
    }

    return language === 'ar' 
      ? '🔵 تم إرسال التنبيه، بانتظار الرد'
      : '🔵 Notification sent, awaiting response';
  };

  return (
    <div className={`rounded-lg border-2 p-3 space-y-2 ${getStatusColor()}`}>
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>

      {readinessCheckSentAt && (
        <div className="text-xs opacity-80">
          {language === 'ar' ? 'تم الإرسال: ' : 'Sent: '}
          {new Date(readinessCheckSentAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}

      {specialistReadinessResponseAt && (
        <div className="text-xs opacity-80">
          {language === 'ar' ? 'الرد: ' : 'Response: '}
          {new Date(specialistReadinessResponseAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}

      {specialistNotReadyReason && (
        <div className="text-xs bg-white/50 dark:bg-black/20 p-2 rounded border">
          <strong>{language === 'ar' ? 'السبب: ' : 'Reason: '}</strong>
          {specialistNotReadyReason}
        </div>
      )}

      {specialistReadinessStatus === 'not_ready' && canManage && onReassign && (
        <Button 
          onClick={onReassign}
          size="sm"
          variant="destructive"
          className="w-full mt-2"
        >
          <Send className="h-3 w-3 mr-2" />
          {language === 'ar' ? 'إعادة إرسال لمحترفات أخريات' : 'Reassign to Other Specialists'}
        </Button>
      )}

      {!readinessCheckSentAt && isWithinOneHour && (
        <Badge variant="outline" className="text-xs">
          {language === 'ar' ? '⚠️ سيتم إرسال تنبيه قريباً' : '⚠️ Alert will be sent soon'}
        </Badge>
      )}
    </div>
  );
}
