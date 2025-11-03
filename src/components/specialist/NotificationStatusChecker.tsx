import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Bell, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { firebaseNotifications } from '@/lib/firebaseNotifications';
import { Capacitor } from '@capacitor/core';

interface NotificationStatusCheckerProps {
  specialistId: string;
}

export function NotificationStatusChecker({ specialistId }: NotificationStatusCheckerProps) {
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

  const checkTokenStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .select('id, last_used_at')
        .eq('specialist_id', specialistId)
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .limit(1);

      if (error) {
        console.error('Error checking token status:', error);
        setHasToken(false);
        return;
      }

      // Check if token exists and was used recently (within last 7 days)
      if (data && data.length > 0) {
        const lastUsed = new Date(data[0].last_used_at || 0);
        const daysSinceLastUse = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastUse <= 7) {
          setHasToken(true);
        } else {
          // Token exists but is stale
          setHasToken(false);
        }
      } else {
        setHasToken(false);
      }
    } catch (error) {
      console.error('Error checking token:', error);
      setHasToken(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleRetrySetup = async () => {
    setIsRetrying(true);
    try {
      console.log('🔄 [NOTIFICATION] Retrying Firebase setup...');
      await firebaseNotifications.cleanup();
      await firebaseNotifications.initialize(specialistId);
      
      // Wait a bit for token to register
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check again
      await checkTokenStatus();
    } catch (error) {
      console.error('❌ [NOTIFICATION] Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    // Only check on mobile platforms
    if (Capacitor.getPlatform() === 'web') {
      setIsChecking(false);
      return;
    }

    checkTokenStatus();

    // Recheck every 5 minutes
    const interval = setInterval(checkTokenStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [specialistId]);

  // Don't show anything on web
  if (Capacitor.getPlatform() === 'web') {
    return null;
  }

  // Still checking
  if (isChecking) {
    return null;
  }

  // Token is registered - show success briefly
  if (hasToken) {
    return (
      <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 mb-4">
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-900 dark:text-green-100">
          الإشعارات مفعلة ✓
        </AlertTitle>
        <AlertDescription className="text-green-800 dark:text-green-200">
          سوف تستقبل إشعارات العروض الجديدة
        </AlertDescription>
      </Alert>
    );
  }

  // Token is NOT registered - show warning
  return (
    <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 mb-4">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        تنبيه: الإشعارات غير مفعلة
      </AlertTitle>
      <AlertDescription className="text-amber-800 dark:text-amber-200 space-y-2">
        <p>لن تستقبل إشعارات العروض الجديدة. قد تفوتك فرص عمل!</p>
        
        <div className="space-y-1 text-sm mt-2">
          <p className="font-semibold">الحلول:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>تأكد من السماح بأذونات الإشعارات في إعدادات التطبيق</li>
            <li>تأكد من عدم تفعيل وضع "عدم الإزعاج" في هاتفك</li>
            <li>جرب الضغط على زر "إعادة المحاولة" أدناه</li>
            <li>إذا استمرت المشكلة، قم بإغلاق التطبيق وفتحه مرة أخرى</li>
          </ol>
        </div>

        <Button 
          onClick={handleRetrySetup}
          disabled={isRetrying}
          variant="outline"
          size="sm"
          className="mt-2"
        >
          {isRetrying ? (
            <>
              <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
              جاري المحاولة...
            </>
          ) : (
            <>
              <Bell className="ml-2 h-4 w-4" />
              إعادة المحاولة
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
