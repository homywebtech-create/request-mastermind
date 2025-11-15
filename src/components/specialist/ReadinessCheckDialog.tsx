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
  const [showPenaltyWarning, setShowPenaltyWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  
  // Debug logging for dialog state
  useEffect(() => {
    console.log('🎭 [ReadinessDialog] DIALOG STATE CHANGED:');
    console.log('  - open:', open);
    console.log('  - orders count:', orders.length);
    console.log('  - currentOrderIndex:', currentOrderIndex);
    console.log('  - currentOrder:', currentOrder?.order_number);
  }, [open, orders, currentOrderIndex]);

  // Mark notification as viewed when dialog opens
  useEffect(() => {
    if (open && orders.length > 0) {
      const currentOrder = orders[currentOrderIndex];
      if (currentOrder) {
        console.log('👁️ [ReadinessDialog] Dialog opened for order:', currentOrder.id, currentOrder.order_number);
        
        const markAsViewed = async () => {
          try {
            console.log('🔄 [ReadinessDialog] Attempting to mark notification as viewed...');
            console.log('🔍 [ReadinessDialog] Order ID:', currentOrder.id);
            
            // ALWAYS update, remove the null check condition
            const { data, error } = await supabase
              .from('orders')
              .update({ 
                readiness_notification_viewed_at: new Date().toISOString() 
              })
              .eq('id', currentOrder.id)
              .select('id, order_number, readiness_notification_viewed_at');
            
            if (error) {
              console.error('❌ [ReadinessDialog] Error marking notification as viewed:', error);
              console.error('Error details:', JSON.stringify(error));
            } else {
              console.log('✅ [ReadinessDialog] Notification marked as viewed successfully!');
              console.log('📊 [ReadinessDialog] Updated order data:', data);
              if (data && data.length > 0) {
                console.log('✓ viewed_at:', data[0].readiness_notification_viewed_at);
              }
            }
          } catch (err) {
            console.error('❌ [ReadinessDialog] Exception marking notification as viewed:', err);
          }
        };
        
        // Execute immediately
        markAsViewed();
      } else {
        console.log('⚠️ [ReadinessDialog] No current order found');
      }
    } else {
      console.log('ℹ️ [ReadinessDialog] Dialog not open or no orders. open:', open, 'orders:', orders.length);
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
      penaltyWarningTitle: '⚠️ تحذير: غرامة الإلغاء',
      penaltyWarningMessage: 'في حالة عدم الذهاب للطلب في هذا الوقت الحساس، سيتم فرض غرامة إلغاء عليك. هل أنتِ متأكدة من أنك لن تستطيعي الذهاب؟',
      confirmNotReady: 'نعم، متأكدة - لن أستطيع الذهاب',
      cancelNotReady: 'رجوع',
      cancel: 'إلغاء',
      successReady: '✅ تم تأكيد الجاهزية بنجاح',
      successNotReady: '❌ تم إبلاغ الإدارة بعدم القدرة على الحضور',
      error: 'حدث خطأ أثناء حفظ الرد',
      errorTitle: '❌ خطأ',
      errorReasonRequired: 'يرجى تقديم السبب',
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
      penaltyWarningTitle: '⚠️ Warning: Cancellation Penalty',
      penaltyWarningMessage: 'If you don\'t attend this order at this critical time, a cancellation penalty will be applied to you. Are you sure you cannot go?',
      confirmNotReady: 'Yes, I\'m sure - I cannot go',
      cancelNotReady: 'Go back',
      cancel: 'Cancel',
      successReady: '✅ Readiness confirmed successfully',
      successNotReady: '❌ Management notified of inability to attend',
      error: 'An error occurred while saving the response',
      errorTitle: '❌ Error',
      errorReasonRequired: 'Please provide a reason',
    },
  };

  const t = texts[language];

  // Fetch orders that need readiness confirmation
  useEffect(() => {
    const fetchPendingOrders = async () => {
      try {
        console.log('🔍 [ReadinessDialog] Starting fetchPendingOrders...');
        console.log('🕐 [ReadinessDialog] Current time:', new Date().toISOString());
        
        const { data: { user } } = await supabase.auth.getUser();
        console.log('👤 [ReadinessDialog] User:', user?.id);
        if (!user) {
          console.log('❌ [ReadinessDialog] No user found');
          return;
        }

        // Get user's phone from profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('phone')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('📋 [ReadinessDialog] Profile:', profile, 'Error:', profileError);

        if (!profile?.phone) {
          console.log('❌ [ReadinessDialog] No phone found in profile');
          return;
        }

        console.log('📱 [ReadinessDialog] User phone:', profile.phone);

        // Get specialist info by phone
        const { data: specialist, error: specialistError } = await supabase
          .from('specialists')
          .select('id')
          .eq('phone', profile.phone)
          .maybeSingle();

        console.log('🔍 [ReadinessDialog] Specialist lookup:', specialist, 'Error:', specialistError);

        if (!specialist) {
          console.log('❌ [ReadinessDialog] No specialist found for phone:', profile.phone);
          return;
        }

        console.log('✅ [ReadinessDialog] Specialist ID:', specialist.id);

        // Get orders assigned to this specialist that need readiness check
        const { data: orderSpecialists, error: osError } = await supabase
          .from('order_specialists')
          .select('order_id')
          .eq('specialist_id', specialist.id);
        
        console.log('📊 [ReadinessDialog] Raw order_specialists:', orderSpecialists);
        console.log('❓ [ReadinessDialog] Order specialists error:', osError);

        if (!orderSpecialists || orderSpecialists.length === 0) {
          console.log('📭 [ReadinessDialog] No orders found for specialist');
          return;
        }

        const orderIds = orderSpecialists.map((os) => os.order_id);
        console.log('📋 [ReadinessDialog] Checking orders:', orderIds);

        // Get orders that need readiness check
        const { data: ordersData, error } = await supabase
          .from('orders')
          .select('id, order_number, booking_date, booking_time, booking_date_type, specialist_readiness_status, readiness_penalty_percentage, readiness_check_sent_at')
          .in('id', orderIds)
          .eq('status', 'upcoming')
          .eq('specialist_readiness_status', 'pending')
          .not('readiness_check_sent_at', 'is', null);

        console.log('❓ [ReadinessDialog] Orders query error:', error);
        console.log('✅ [ReadinessDialog] Found orders needing readiness check:', ordersData?.length || 0);
        console.log('📋 [ReadinessDialog] Orders data FULL:', JSON.stringify(ordersData, null, 2));

        if (ordersData && ordersData.length > 0) {
          console.log('🔔 [ReadinessDialog] Opening dialog with orders:', ordersData.map(o => o.order_number));
          console.log('🚀 [ReadinessDialog] CALLING setOrders and setOpen(true)');
          
          // CRITICAL FIX: Update viewed_at for all pending orders immediately
          for (const order of ordersData) {
            console.log('📱 [ReadinessDialog] Marking order as viewed:', order.order_number);
            const { error: updateError } = await supabase
              .from('orders')
              .update({ 
                readiness_notification_viewed_at: new Date().toISOString() 
              })
              .eq('id', order.id);
            
            if (updateError) {
              console.error('❌ [ReadinessDialog] Error updating viewed_at:', updateError);
            } else {
              console.log('✅ [ReadinessDialog] Updated viewed_at for:', order.order_number);
            }
          }
          
          setOrders(ordersData as Order[]);
          setOpen(true);
          console.log('✅ [ReadinessDialog] State updated - dialog should open now!');
          
          // Play urgent sound for attention
          try {
            const { getSoundNotification } = await import('@/lib/soundNotification');
            const soundNotif = getSoundNotification();
            soundNotif.playNewOrderSound();
            console.log('🔊 [ReadinessDialog] Played alert sound');
          } catch (e) {
            console.log('⚠️ [ReadinessDialog] Could not play sound:', e);
          }
        } else {
          console.log('✓ [ReadinessDialog] No orders need readiness check at this time');
        }
      } catch (error) {
        console.error('❌ [ReadinessDialog] Exception in fetchPendingOrders:', error);
      }
    };

    // Fetch immediately on mount
    fetchPendingOrders();
    
    // Re-fetch every 3 seconds to catch any missed notifications - faster response
    const pollInterval = setInterval(fetchPendingOrders, 3000);

    // Set up realtime subscription for new readiness checks on orders table
    const ordersChannel = supabase
      .channel('readiness-checks-orders')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('🔄 [ReadinessDialog] Orders realtime update received:', payload);
          // Check if readiness_check_sent_at was just updated
          if (payload.new.readiness_check_sent_at && payload.new.specialist_readiness_status === 'pending') {
            console.log('⚡ [ReadinessDialog] New readiness check detected in orders!');
            fetchPendingOrders();
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [ReadinessDialog] Orders subscription status:', status);
      });

    // Also listen to order_specialists table for new assignments
    const specialistsChannel = supabase
      .channel('readiness-checks-specialists')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_specialists',
        },
        (payload) => {
          console.log('🔄 [ReadinessDialog] Order_specialists update received:', payload);
          console.log('⚡ [ReadinessDialog] New specialist assignment detected!');
          fetchPendingOrders();
        }
      )
      .subscribe((status) => {
        console.log('📡 [ReadinessDialog] Specialists subscription status:', status);
      });

    // Also listen for custom events from notification system
    const handleReadinessNotification = (event: CustomEvent) => {
      console.log('🔔 [ReadinessDialog] Custom event received:', event.detail);
      fetchPendingOrders();
    };

    window.addEventListener('readiness-check-received', handleReadinessNotification as EventListener);

    return () => {
      console.log('🧹 [ReadinessDialog] Cleaning up subscriptions');
      clearInterval(pollInterval);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(specialistsChannel);
      window.removeEventListener('readiness-check-received', handleReadinessNotification as EventListener);
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

  const handleNotReadyClick = () => {
    // First show reason input
    if (!showReasonInput) {
      setShowReasonInput(true);
      return;
    }

    // Validate reason
    if (!notReadyReason.trim()) {
      toast({
        title: t.errorTitle,
        description: t.errorReasonRequired,
        variant: 'destructive',
      });
      return;
    }
    
    // Show penalty warning dialog
    setShowPenaltyWarning(true);
  };

  const handleConfirmNotReady = async () => {
    setShowPenaltyWarning(false);
    
    if (!currentOrder || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // First, get the current specialist_id before removing it
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('specialist_id')
        .eq('id', currentOrder.id)
        .single();

      if (fetchError) throw fetchError;
      
      const currentSpecialistId = orderData?.specialist_id;

      // Update order_specialists table to record the rejection
      if (currentSpecialistId) {
        const { error: rejectionError } = await supabase
          .from('order_specialists')
          .update({
            is_accepted: false,
            rejected_at: new Date().toISOString(),
            rejection_reason: notReadyReason || 'Specialist not ready',
          })
          .eq('order_id', currentOrder.id)
          .eq('specialist_id', currentSpecialistId);

        if (rejectionError) {
          console.error('Error recording rejection:', rejectionError);
        }
      }

      // Now update the order to remove specialist and mark as not ready
      const { error } = await supabase
        .from('orders')
        .update({
          specialist_id: null, // Remove specialist assignment so order disappears from their view
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

  if (!currentOrder) {
    console.log('⚠️ [ReadinessDialog] Rendering NULL - no currentOrder');
    return null;
  }
  
  console.log('✅ [ReadinessDialog] Rendering dialog - open:', open, 'order:', currentOrder.order_number);

  return (
    <>
      {/* Main Readiness Dialog */}
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
                  onClick={handleNotReadyClick}
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
                  onClick={handleNotReadyClick}
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

      {/* Penalty Warning Dialog */}
      <AlertDialog open={showPenaltyWarning} onOpenChange={setShowPenaltyWarning}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl text-destructive">
              <XCircle className="h-6 w-6 animate-pulse" />
              {t.penaltyWarningTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium pt-2">
              {t.penaltyWarningMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-destructive/10 p-4 rounded-lg border-2 border-destructive/30 my-4">
            <p className="text-sm font-semibold text-destructive text-center">
              {language === 'ar' 
                ? '⚠️ سيتم خصم غرامة من محفظتك في حال الإلغاء' 
                : '⚠️ A penalty will be deducted from your wallet if you cancel'}
            </p>
          </div>

          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button
              onClick={handleConfirmNotReady}
              disabled={isSubmitting}
              variant="destructive"
              className="w-full"
              size="lg"
            >
              <XCircle className="h-5 w-5 mr-2" />
              {t.confirmNotReady}
            </Button>
            <Button
              onClick={() => setShowPenaltyWarning(false)}
              disabled={isSubmitting}
              variant="outline"
              className="w-full"
              size="lg"
            >
              {t.cancelNotReady}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
