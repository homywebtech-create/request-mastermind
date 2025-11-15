import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle, AlertCircle, Send } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

interface ReadinessStatusIndicatorProps {
  bookingDate?: string | null;
  bookingTime?: string | null;
  readinessCheckSentAt?: string | null;
  readinessNotificationViewedAt?: string | null;
  specialistReadinessStatus?: string | null;
  specialistReadinessResponseAt?: string | null;
  specialistNotReadyReason?: string | null;
  readinessReminderCount?: number | null;
  onReassign?: () => void;
  canManage?: boolean;
}

export function ReadinessStatusIndicator({
  bookingDate,
  bookingTime,
  readinessCheckSentAt,
  readinessNotificationViewedAt,
  specialistReadinessStatus,
  specialistReadinessResponseAt,
  specialistNotReadyReason,
  readinessReminderCount,
  onReassign,
  canManage = false,
}: ReadinessStatusIndicatorProps) {
  const { language } = useLanguage();
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Debug logging - Log all incoming props
  useEffect(() => {
    console.log('🔍 [ReadinessStatusIndicator] Props received:', {
      bookingDate,
      bookingTime,
      readinessCheckSentAt,
      specialistReadinessStatus,
      readinessNotificationViewedAt,
      specialistReadinessResponseAt,
      readinessReminderCount,
    });
  }, [bookingDate, bookingTime, readinessCheckSentAt, specialistReadinessStatus, readinessNotificationViewedAt, specialistReadinessResponseAt, readinessReminderCount]);

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
      console.log('⚠️ [ReadinessStatusIndicator] No booking datetime');
      return language === 'ar' ? 'لا يوجد موعد محدد' : 'No booking time set';
    }

    console.log('🔍 [ReadinessStatusIndicator] Status logic:', {
      specialistReadinessStatus,
      readinessCheckSentAt: !!readinessCheckSentAt,
      isPast,
      bookingDateTime: bookingDateTime?.toISOString(),
      currentTime: new Date().toISOString()
    });

    // Priority 1: Show readiness status if available
    if (specialistReadinessStatus === 'ready') {
      console.log('✅ [ReadinessStatusIndicator] Showing READY status');
      return language === 'ar' 
        ? '✅ المحترف جاهز - سيذهب للموعد'
        : '✅ Specialist ready - will go';
    }

    if (specialistReadinessStatus === 'not_ready') {
      console.log('❌ [ReadinessStatusIndicator] Showing NOT READY status');
      return language === 'ar' 
        ? '❌ المحترف غير جاهز - لن يذهب'
        : '❌ Specialist not ready - cannot go';
    }

    // Priority 2: Show pending status if check was sent (regardless of time)
    if (readinessCheckSentAt && specialistReadinessStatus === 'pending') {
      if (isPast) {
        console.log('⏰ [ReadinessStatusIndicator] Showing TIME PASSED - NO RESPONSE');
        return language === 'ar' 
          ? '⏰ انتهى الموعد - لم يرد المحترف بعد'
          : '⏰ Time passed - specialist hasn\'t responded';
      }
      console.log('⏳ [ReadinessStatusIndicator] Showing AWAITING RESPONSE');
      return language === 'ar' 
        ? '⏳ تم إرسال التنبيه - بانتظار رد المحترف'
        : '⏳ Notification sent - awaiting response';
    }

    // Priority 3: Show time status when no notification sent
    if (isPast) {
      console.log('⏰ [ReadinessStatusIndicator] Showing TIME PASSED - NO NOTIFICATION');
      return language === 'ar' 
        ? '⏰ انتهى الموعد - لم يتم إرسال تنبيه' 
        : '⏰ Time passed - no notification sent';
    }

    if (!readinessCheckSentAt) {
      console.log('⏱️ [ReadinessStatusIndicator] Showing NO NOTIFICATION - TIME REMAINING');
      return language === 'ar' 
        ? `⏱️ لم يتم إرسال تنبيه - باقي ${formatTimeRemaining(timeUntilBooking!)}`
        : `⏱️ No notification sent - ${formatTimeRemaining(timeUntilBooking!)} remaining`;
    }

    console.log('⏳ [ReadinessStatusIndicator] Showing DEFAULT - AWAITING RESPONSE');
    return language === 'ar' 
      ? '⏳ تم إرسال التنبيه - بانتظار الرد'
      : '⏳ Notification sent - awaiting response';
  };

  return (
    <div className={`rounded-lg border-2 p-3 space-y-2 ${getStatusColor()}`}>
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>

      {/* Always show notification status */}
      <div className="space-y-1 text-xs border-t border-current/20 pt-2">
        <div className="flex items-center gap-1.5 opacity-80">
          <Send className="h-3 w-3" />
          <span className="font-semibold">
            {language === 'ar' ? 'إرسال التنبيه: ' : 'Notification: '}
          </span>
          <span>
            {readinessCheckSentAt ? (
              <>
                {language === 'ar' ? 'تم ✓ ' : 'Sent ✓ '}
                {new Date(readinessCheckSentAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {readinessReminderCount && readinessReminderCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 font-bold">
                    {language === 'ar' ? `${readinessReminderCount} مرة` : `${readinessReminderCount}x`}
                  </span>
                )}
              </>
            ) : (
              <span className="text-red-600 dark:text-red-400 font-medium">
                {language === 'ar' ? '✗ لم يتم' : '✗ Not sent'}
              </span>
            )}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 opacity-80">
          <AlertCircle className="h-3 w-3" />
          <span className="font-semibold">
            {language === 'ar' ? 'رد المحترف: ' : 'Response: '}
          </span>
          <span>
            {specialistReadinessStatus === 'ready' ? (
              <span className="text-green-700 dark:text-green-400 font-medium">
                {language === 'ar' ? '✓ جاهز' : '✓ Ready'}
              </span>
            ) : specialistReadinessStatus === 'not_ready' ? (
              <span className="text-red-700 dark:text-red-400 font-medium">
                {language === 'ar' ? '✗ غير جاهز' : '✗ Not ready'}
              </span>
            ) : specialistReadinessStatus === 'pending' && readinessCheckSentAt ? (
              <span className="text-orange-600 dark:text-orange-400">
                {language === 'ar' ? '⏳ لم يرد بعد' : '⏳ No response yet'}
              </span>
            ) : (
              <span className="opacity-60">
                {language === 'ar' ? '- لم يتم الإرسال' : '- Not sent'}
              </span>
            )}
          </span>
        </div>

        {/* Show viewed status - consider "viewed" if specialist responded OR explicitly viewed */}
        {readinessCheckSentAt && (
          <div className="flex items-center gap-1.5 text-xs">
            {/* If specialist responded, they definitely viewed it */}
            {specialistReadinessResponseAt || readinessNotificationViewedAt ? (
              <>
                <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-green-700 dark:text-green-400">
                  {language === 'ar' ? '✓ شاهد الإشعار' : '✓ Notification viewed'}
                </span>
              </>
            ) : specialistReadinessStatus === 'pending' ? (
              <>
                <Clock className="h-3 w-3 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  {language === 'ar' ? '📱 لم يشاهد الإشعار بعد' : '📱 Notification not viewed yet'}
                </span>
              </>
            ) : null}
          </div>
        )}
      </div>

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
