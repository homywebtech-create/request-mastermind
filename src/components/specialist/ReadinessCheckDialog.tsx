import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  booking_date: string;
  booking_time: string;
  booking_date_type: string;
  specialist_readiness_status: string | null;
  readiness_penalty_percentage: number | null;
}

export function ReadinessCheckDialog() {
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const [notReadyReason, setNotReadyReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();

  // Mark notification as viewed when dialog opens
  useEffect(() => {
    if (open && orders.length > 0) {
      const currentOrder = orders[currentOrderIndex];
      if (currentOrder) {
        console.log('📋 ReadinessCheckDialog opened for order:', currentOrder.id);
        
        const markAsViewed = async () => {
          try {
            const { error } = await supabase
              .from('orders')
              .update({ 
                readiness_notification_viewed_at: new Date().toISOString() 
              })
              .eq('id', currentOrder.id)
              .is('readiness_notification_viewed_at', null); // Only update if not already set
            
            if (error) {
              console.error('❌ Error marking notification as viewed:', error);
            } else {
              console.log('✅ Readiness notification marked as viewed');
            }
          } catch (err) {
            console.error('❌ Exception marking notification as viewed:', err);
          }
        };
        
        markAsViewed();
      }
    }
  }, [open, orders, currentOrderIndex]);

  const texts = {
    ar: {
      title: '⏰ تأكيد الجاهزية',
      descriptionOverdue: '⚠️ الطلب متأخر! يجب الإسراع في التحرك',
      descriptionUpcoming: 'لديك طلب قادم. هل أنتِ جاهزة؟',
      orderNumber: 'رقم الطلب',
      customer: 'العميل',
      area: 'المنطقة',
      bookingTime: 'الموعد',
      morning: 'صباحاً',
      afternoon: 'ظهراً',
      evening: 'مساءً',
      ready: 'نعم، أنا جاهزة',
      notReady: 'لا، لن أستطيع الذهاب',
      reasonLabel: 'يرجى ذكر السبب',
      reasonPlaceholder: 'اكتبي السبب...',
      submit: 'إرسال',
      cancel: 'إلغاء',
      successReady: '✅ تم تأكيد الجاهزية بنجاح',
      successNotReady: '❌ تم إبلاغ الإدارة بعدم القدرة على الحضور',
      error: 'حدث خطأ أثناء حفظ الرد',
    },
    en: {
      title: '⏰ Readiness Confirmation',
      descriptionOverdue: '⚠️ Order is overdue! You must hurry',
      descriptionUpcoming: 'You have an upcoming order. Are you ready?',
      orderNumber: 'Order Number',
      customer: 'Customer',
      area: 'Area',
      bookingTime: 'Appointment',
      morning: 'Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      ready: 'Yes, I am ready',
      notReady: 'No, I cannot attend',
      reasonLabel: 'Please state the reason',
      reasonPlaceholder: 'Enter reason...',
      submit: 'Submit',
      cancel: 'Cancel',
      successReady: '✅ Readiness confirmed successfully',
      successNotReady: '❌ Management notified of inability to attend',
      error: 'An error occurred while saving the response',
    },
  };

  const t = texts[language];

  // Fetch orders that need readiness confirmation
  useEffect(() => {
    const fetchPendingOrders = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's phone from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('user_id', user.id)
          .single();

        if (!profile?.phone) return;

        // Get specialist info by phone
        const { data: specialist } = await supabase
          .from('specialists')
          .select('id')
          .eq('phone', profile.phone)
          .single();

        if (!specialist) return;

        // Get orders assigned to this specialist that need readiness check
        const { data: orderSpecialists } = await supabase
          .from('order_specialists')
          .select('order_id')
          .eq('specialist_id', specialist.id)
          .eq('is_accepted', true);

        if (!orderSpecialists || orderSpecialists.length === 0) return;

        const orderIds = orderSpecialists.map((os) => os.order_id);

        // Get orders that need readiness check
        const { data: ordersData, error } = await supabase
          .from('orders')
          .select('id, order_number, booking_date, booking_time, booking_date_type, specialist_readiness_status, readiness_penalty_percentage')
          .in('id', orderIds)
          .eq('status', 'upcoming')
          .eq('specialist_readiness_status', 'pending')
          .not('readiness_check_sent_at', 'is', null);

        if (error) {
          console.error('Error fetching orders:', error);
          return;
        }

        if (ordersData && ordersData.length > 0) {
          setOrders(ordersData as Order[]);
          setOpen(true);
        }
      } catch (error) {
        console.error('Error in fetchPendingOrders:', error);
      }
    };

    fetchPendingOrders();

    // Set up realtime subscription for new readiness checks
    const channel = supabase
      .channel('readiness-checks')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: 'specialist_readiness_status=eq.pending',
        },
        () => {
          fetchPendingOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const currentOrder = orders[currentOrderIndex];

  const formatBookingTime = (time: string) => {
    if (time === 'morning') return t.morning;
    if (time === 'afternoon') return t.afternoon;
    if (time === 'evening') return t.evening;
    return time;
  };

  const getTimeDescription = () => {
    if (!currentOrder) return '';
    
    const now = new Date();
    const bookingDateTime = new Date(currentOrder.booking_date);
    
    // Parse booking time if it's a specific time
    if (currentOrder.booking_time && !['morning', 'afternoon', 'evening'].includes(currentOrder.booking_time)) {
      const [timeRange] = currentOrder.booking_time.split('-');
      if (timeRange) {
        const [hours, minutes] = timeRange.trim().split(':');
        if (hours && minutes) {
          bookingDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }
      }
    }
    
    const diffMs = bookingDateTime.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    
    // If order is overdue or very soon
    if (diffMinutes <= 0) {
      return language === 'ar' ? t.descriptionOverdue : t.descriptionOverdue;
    } else if (diffMinutes < 60) {
      return language === 'ar' 
        ? `⚠️ لديك طلب بعد ${diffMinutes} دقيقة. هل أنتِ جاهزة؟`
        : `⚠️ You have an order in ${diffMinutes} minutes. Are you ready?`;
    } else if (diffHours < 2) {
      return language === 'ar'
        ? `لديك طلب بعد حوالي ساعة. هل أنتِ جاهزة؟`
        : `You have an order in about 1 hour. Are you ready?`;
    } else {
      return language === 'ar'
        ? `لديك طلب بعد ${diffHours} ساعات. هل أنتِ جاهزة؟`
        : `You have an order in ${diffHours} hours. Are you ready?`;
    }
  };

  const handleReady = async () => {
    if (!currentOrder || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          specialist_readiness_status: 'ready',
          specialist_readiness_response_at: new Date().toISOString(),
          specialist_not_ready_reason: null,
        })
        .eq('id', currentOrder.id);

      if (error) throw error;

      toast({
        title: t.successReady,
        description: `${t.orderNumber}: ${currentOrder.order_number}`,
        className: 'bg-green-50 border-green-500',
      });

      moveToNextOrder();
    } catch (error) {
      console.error('Error updating readiness:', error);
      toast({
        title: t.error,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNotReady = async () => {
    if (!showReasonInput) {
      setShowReasonInput(true);
      return;
    }

    if (!currentOrder || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          specialist_readiness_status: 'not_ready',
          specialist_readiness_response_at: new Date().toISOString(),
          specialist_not_ready_reason: notReadyReason || null,
        })
        .eq('id', currentOrder.id);

      if (error) throw error;

      toast({
        title: t.successNotReady,
        description: `${t.orderNumber}: ${currentOrder.order_number}`,
        variant: 'destructive',
      });

      moveToNextOrder();
    } catch (error) {
      console.error('Error updating readiness:', error);
      toast({
        title: t.error,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const moveToNextOrder = () => {
    setShowReasonInput(false);
    setNotReadyReason('');

    if (currentOrderIndex < orders.length - 1) {
      setCurrentOrderIndex(currentOrderIndex + 1);
    } else {
      setOpen(false);
      setOrders([]);
      setCurrentOrderIndex(0);
    }
  };

  const handleClose = () => {
    if (showReasonInput) {
      setShowReasonInput(false);
      return;
    }
    setOpen(false);
  };

  if (!currentOrder) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-6 w-6 text-orange-500 animate-pulse" />
            {t.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base font-medium">
            {getTimeDescription()}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-4">
          <div className="bg-muted/50 p-3 rounded-lg space-y-2">
            <div>
              <span className="font-semibold">{t.orderNumber}:</span>{' '}
              <span className="text-primary">{currentOrder.order_number}</span>
            </div>
            <div>
              <span className="font-semibold">{t.bookingTime}:</span>{' '}
              {currentOrder.booking_date} - {formatBookingTime(currentOrder.booking_time)}
            </div>
            {currentOrder.readiness_penalty_percentage && currentOrder.readiness_penalty_percentage > 0 && (
              <div className="bg-destructive/10 p-2 rounded border border-destructive/20">
                <span className="text-destructive font-semibold">
                  {language === 'ar' ? '⚠️ في حال عدم الجاهزية سيتم خصم ' : '⚠️ Penalty if not ready: '}
                  {currentOrder.readiness_penalty_percentage}%
                  {language === 'ar' ? ' من محفظتك' : ' from your wallet'}
                </span>
              </div>
            )}
          </div>

          {showReasonInput && (
            <div className="space-y-2">
              <Label htmlFor="reason">{t.reasonLabel}</Label>
              <Textarea
                id="reason"
                value={notReadyReason}
                onChange={(e) => setNotReadyReason(e.target.value)}
                placeholder={t.reasonPlaceholder}
                rows={3}
                className="resize-none"
              />
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-col">
          {!showReasonInput ? (
            <>
              <Button
                onClick={handleReady}
                disabled={isSubmitting}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {t.ready}
              </Button>
              <Button
                onClick={handleNotReady}
                disabled={isSubmitting}
                variant="destructive"
                className="w-full"
                size="lg"
              >
                <XCircle className="h-5 w-5 mr-2" />
                {t.notReady}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleNotReady}
                disabled={isSubmitting}
                variant="destructive"
                className="w-full"
              >
                {t.submit}
              </Button>
              <Button
                onClick={handleClose}
                disabled={isSubmitting}
                variant="outline"
                className="w-full"
              >
                {t.cancel}
              </Button>
            </>
          )}

          {orders.length > 1 && (
            <div className="text-center text-sm text-muted-foreground mt-2">
              {currentOrderIndex + 1} / {orders.length}
            </div>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
