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
      // Handle period-based times
      if (bookingTime === 'morning') {
        dateTime.setHours(8, 0, 0, 0);
      } else if (bookingTime === 'afternoon') {
        dateTime.setHours(14, 0, 0, 0);
      } else if (bookingTime === 'evening') {
        dateTime.setHours(18, 0, 0, 0);
      } else {
        // Parse time range like "8:00 AM-8:30 AM" or simple time like "08:00"
        // Extract the start time from the range
        const startTimeStr = bookingTime.split('-')[0].trim();
        
        // Try to parse time with AM/PM
        const timeMatch = startTimeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const period = timeMatch[3]?.toUpperCase();
          
          // Convert to 24-hour format if AM/PM is present
          if (period === 'PM' && hours < 12) {
            hours += 12;
          } else if (period === 'AM' && hours === 12) {
            hours = 0;
          }
          
          if (!isNaN(hours) && !isNaN(minutes)) {
            dateTime.setHours(hours, minutes, 0, 0);
          } else {
            dateTime.setHours(8, 0, 0, 0); // Default fallback
          }
        } else {
          dateTime.setHours(8, 0, 0, 0); // Default fallback
        }
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

    // Priority 1: Show readiness status if available
    if (specialistReadinessStatus === 'ready') {
      return language === 'ar' 
        ? '✅ جاهز - سيذهب'
        : '✅ Ready - will go';
    }

    if (specialistReadinessStatus === 'not_ready') {
      return language === 'ar' 
        ? '❌ غير جاهز - لن يذهب'
        : '❌ Not ready - cannot go';
    }

    // Priority 2: Show pending status if check was sent
    if (readinessCheckSentAt && specialistReadinessStatus === 'pending') {
      return language === 'ar' 
        ? '⏳ بانتظار رد المحترف'
        : '⏳ Awaiting specialist response';
    }

    // Priority 3: Show time status
    if (isPast) {
      return language === 'ar' ? '⏰ انتهى الموعد' : '⏰ Time passed';
    }

    if (!readinessCheckSentAt) {
      return language === 'ar' 
        ? `⏱️ باقي ${formatTimeRemaining(timeUntilBooking!)}`
        : `⏱️ ${formatTimeRemaining(timeUntilBooking!)} remaining`;
    }

    return language === 'ar' 
      ? '⏳ بانتظار رد المحترف'
      : '⏳ Awaiting specialist response';
  };

  return (
    <div className={`rounded-lg border-2 p-3 space-y-2 ${getStatusColor()}`}>
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>

      {/* Show notification sent info */}
      {readinessCheckSentAt && (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1.5 opacity-80">
            <Send className="h-3 w-3" />
            <span>
              {language === 'ar' ? 'إرسال التنبيه: ' : 'Notification sent: '}
              {new Date(readinessCheckSentAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      )}

      {/* Show response time for ready/not_ready status */}
      {specialistReadinessResponseAt && (specialistReadinessStatus === 'ready' || specialistReadinessStatus === 'not_ready') && (
        <div className="flex items-center gap-1.5 text-xs opacity-80">
          <CheckCircle className="h-3 w-3" />
          <span>
            {language === 'ar' ? 'وقت الرد: ' : 'Responded at: '}
            {new Date(specialistReadinessResponseAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}

      {/* Show not ready reason */}
      {specialistNotReadyReason && specialistReadinessStatus === 'not_ready' && (
        <div className="text-xs bg-white/50 dark:bg-black/20 p-2 rounded border">
          <div className="font-medium mb-1">{language === 'ar' ? '📝 سبب عدم الجاهزية:' : '📝 Reason for unavailability:'}</div>
          <div>{specialistNotReadyReason}</div>
        </div>
      )}

      {/* Show reassign button for not ready specialists */}
      {specialistReadinessStatus === 'not_ready' && canManage && onReassign && (
        <Button 
          onClick={onReassign}
          size="sm"
          variant="destructive"
          className="w-full mt-2"
        >
          <Send className="h-3 w-3 mr-2" />
          {language === 'ar' ? 'إعادة تعيين لمحترف آخر' : 'Reassign to Another Specialist'}
        </Button>
      )}

      {/* Show pending message with more details */}
      {readinessCheckSentAt && specialistReadinessStatus === 'pending' && (
        <div className="text-xs bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 dark:border-blue-800">
          <div className="font-medium text-blue-700 dark:text-blue-300">
            {language === 'ar' ? '⏳ لم يرد المحترف بعد' : '⏳ Specialist hasn\'t responded yet'}
          </div>
          <div className="text-blue-600 dark:text-blue-400 mt-1">
            {language === 'ar' 
              ? 'سيتم إرسال تذكيرات تلقائية (حتى 3 مرات)' 
              : 'Automatic reminders will be sent (up to 3 times)'}
          </div>
        </div>
      )}

      {!readinessCheckSentAt && isWithinOneHour && (
        <Badge variant="outline" className="text-xs">
          {language === 'ar' ? '⚠️ سيتم إرسال تنبيه قريباً' : '⚠️ Alert will be sent soon'}
        </Badge>
      )}
    </div>
  );
}
