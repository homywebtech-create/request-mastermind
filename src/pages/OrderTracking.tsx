import { useEffect, useState } from "react";
import { useNavigate, useParams, useBlocker } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Navigation, Share2, CheckCircle, Play, Pause, AlertTriangle, Phone, XCircle, FileText, Clock, ArrowRight, Star, ChevronDown, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { openWhatsApp, openMaps as openMapsHelper } from "@/lib/externalLinks";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";
import { translateOrderDetails } from "@/lib/translateHelper";

type Stage = 'initial' | 'moving' | 'arrived' | 'working' | 'completed' | 'cancelled' | 'invoice_requested' | 'invoice_details' | 'customer_rating' | 'payment_received';

interface Order {
  id: string;
  order_number: string | null;
  service_type: string;
  notes: string | null;
  booking_date: string | null;
  hours_count: number | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  building_info: string | null;
  company_id: string | null;
  customer: {
    name: string;
    whatsapp_number: string;
    area: string | null;
    budget: string | null;
    budget_type: string | null;
  } | null;
  company: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
  order_specialists?: Array<{
    quoted_price: string | null;
    is_accepted: boolean | null;
  }>;
}

export default function OrderTracking() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [stage, setStage] = useState<Stage>('initial');
  const [movingTimer, setMovingTimer] = useState(60); // 60 seconds
  const [arrivedTimer, setArrivedTimer] = useState(60); // 60 seconds
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [workingTime, setWorkingTime] = useState(0);
  const [totalWorkSeconds, setTotalWorkSeconds] = useState(0);
  const [timeExpired, setTimeExpired] = useState(false);
  const [alertInterval, setAlertInterval] = useState<NodeJS.Timeout | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showEarlyFinishDialog, setShowEarlyFinishDialog] = useState(false);
  const [showExtendTimeDialog, setShowExtendTimeDialog] = useState(false);
  const [extensionHours, setExtensionHours] = useState(1);
  const [nextBookingTime, setNextBookingTime] = useState<string | null>(null);
  const [canExtend, setCanExtend] = useState(true);
  const [arrivedStartTime, setArrivedStartTime] = useState<Date | null>(null);
  const [customerRating, setCustomerRating] = useState(0);
  const [customerReviewNotes, setCustomerReviewNotes] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [isOrderInfoOpen, setIsOrderInfoOpen] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useTranslation(language).specialist;

  // Prevent back navigation during active tracking
  useEffect(() => {
    const preventBackNavigation = (e: PopStateEvent) => {
      // Only prevent if we're in an active tracking stage (not initial or completed)
      const activeStages: Stage[] = ['moving', 'arrived', 'working', 'invoice_requested', 'invoice_details'];
      
      if (activeStages.includes(stage)) {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
        
        toast({
          title: language === 'ar' ? 'تحذير' : 'Warning',
          description: language === 'ar' 
            ? 'لا يمكن الرجوع أثناء تتبع الطلب. يرجى إنهاء أو إلغاء الطلب أولاً.'
            : 'Cannot go back during active order tracking. Please finish or cancel the order first.',
          variant: 'destructive',
        });
      }
    };

    // Add state to history to enable detection
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', preventBackNavigation);

    return () => {
      window.removeEventListener('popstate', preventBackNavigation);
    };
  }, [stage, language, toast]);

  useEffect(() => {
    if (!orderId) return;

    // Fetch order data
    fetchOrder();

    // Check if order already has a tracking stage
    const checkAndSetStage = async () => {
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('tracking_stage')
        .eq('id', orderId)
        .single();

      if (currentOrder?.tracking_stage) {
        // Resume from existing stage
        if (currentOrder.tracking_stage === 'invoice_requested') {
          setStage('invoice_requested');
        } else if (currentOrder.tracking_stage === 'payment_received') {
          setStage('payment_received');
        } else if (currentOrder.tracking_stage === 'arrived') {
          setStage('arrived');
          setArrivedStartTime(new Date());
        } else if (currentOrder.tracking_stage === 'working') {
          setStage('working');
        } else {
          setStage(currentOrder.tracking_stage as Stage);
        }
      } else {
        // Start with 'initial' stage - just showing order info
        setStage('initial');
      }
    };

    checkAndSetStage();
  }, [orderId, language]); // Re-fetch when language changes

  // Timer for moving stage (60 seconds countdown)
  useEffect(() => {
    if (stage === 'moving' && movingTimer > 0) {
      const timer = setInterval(() => {
        setMovingTimer(prev => {
          if (prev === 1) {
            // When timer reaches 0, update database to mark as moving
            updateOrderStage('moving');
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [stage, movingTimer]);

  // Timer for arrived stage (60 seconds countdown)
  useEffect(() => {
    if (stage === 'arrived' && arrivedTimer > 0) {
      const timer = setInterval(() => {
        setArrivedTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [stage, arrivedTimer]);

  // Auto-start work after 5 minutes if specialist didn't start
  useEffect(() => {
    if (stage === 'arrived' && arrivedStartTime) {
      const checkAutoStart = setInterval(() => {
        const now = new Date();
        const minutesPassed = (now.getTime() - arrivedStartTime.getTime()) / 1000 / 60;
        
        if (minutesPassed >= 5) {
          handleStartWork();
          toast({
            title: "Auto-Started",
            description: "Work timer has been automatically started",
          });
          clearInterval(checkAutoStart);
        }
      }, 1000);

      return () => clearInterval(checkAutoStart);
    }
  }, [stage, arrivedStartTime]);

  // Timer for working stage (countdown from totalWorkSeconds to 0)
  useEffect(() => {
    if (stage === 'working' && !isPaused && workingTime < totalWorkSeconds) {
      const timer = setInterval(() => {
        setWorkingTime(prev => {
          const newTime = prev + 1;
          
          // Check if time has expired
          if (newTime >= totalWorkSeconds && !timeExpired) {
            setTimeExpired(true);
            // Start alert with sound and vibration
            startTimeExpiredAlert();
          }
          
          return newTime;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [stage, isPaused, workingTime, totalWorkSeconds, timeExpired]);

  // Calculate total work seconds from hours_count
  useEffect(() => {
    if (order?.hours_count) {
      setTotalWorkSeconds(order.hours_count * 3600); // Convert hours to seconds
    }
  }, [order]);

  const startTimeExpiredAlert = () => {
    // Play notification sound
    const audio = new Audio('/notification-sound.mp3');
    audio.loop = true;
    audio.play().catch(err => console.error('Audio play error:', err));

    // Vibrate (if supported)
    if (navigator.vibrate) {
      const vibratePattern = [500, 200, 500, 200, 500];
      const interval = setInterval(() => {
        navigator.vibrate(vibratePattern);
      }, 2000);
      setAlertInterval(interval);
    }

    toast({
      title: language === 'ar' ? "انتهى وقت العمل" : "Time Expired",
      description: language === 'ar' ? "الوقت المحدد للعمل قد انتهى. يرجى إنهاء العمل" : "The allotted work time has expired. Please finish the work",
      duration: 10000,
    });
  };

  const stopTimeExpiredAlert = () => {
    // Stop any playing audio
    const audios = document.querySelectorAll('audio');
    audios.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });

    // Stop vibration
    if (navigator.vibrate) {
      navigator.vibrate(0);
    }

    // Clear interval
    if (alertInterval) {
      clearInterval(alertInterval);
      setAlertInterval(null);
    }
  };

  const fetchOrder = async () => {
    if (!orderId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          service_type,
          notes,
          booking_date,
          hours_count,
          gps_latitude,
          gps_longitude,
          building_info,
          company_id,
          customer:customers (
            name,
            whatsapp_number,
            area,
            budget,
            budget_type
          ),
          company:companies (
            id,
            name,
            logo_url
          ),
          order_specialists (
            quoted_price,
            is_accepted
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      
      // Translate order data if not Arabic
      let orderData = data as Order;
      if (language !== 'ar' && orderData) {
        const translated = await translateOrderDetails({
          serviceType: orderData.service_type,
          notes: orderData.notes || undefined,
          area: orderData.customer?.area || undefined,
        }, language);
        
        orderData = {
          ...orderData,
          service_type: translated.serviceType || orderData.service_type,
          notes: translated.notes || orderData.notes,
          customer: orderData.customer ? {
            ...orderData.customer,
            area: translated.area || orderData.customer.area,
          } : null,
        };
      }
      
      setOrder(orderData);
      
      // Calculate invoice amount from accepted quote
      if (orderData?.order_specialists) {
        const acceptedQuote = orderData.order_specialists.find((os: any) => os.is_accepted === true);
        if (acceptedQuote?.quoted_price) {
          const priceMatch = acceptedQuote.quoted_price.match(/(\d+(\.\d+)?)/);
          if (priceMatch) {
            setInvoiceAmount(parseFloat(priceMatch[1]));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast({
        title: t.error,
        description: "Failed to load order data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openMaps = async () => {
    if (!order?.gps_latitude || !order?.gps_longitude) {
      toast({
        title: "Error",
        description: "Customer location not available",
        variant: "destructive",
      });
      return;
    }

    // Open maps with coordinates - will open in default map app on phone
    await openMapsHelper(order.gps_latitude, order.gps_longitude);
  };

  const handleStartMoving = async () => {
    setStage('moving');
    await updateOrderStage('moving');
    toast({
      title: "بدء التحرك",
      description: "تم تسجيل بدء التحرك نحو العميل",
    });
  };

  const updateOrderStage = async (newStage: Stage) => {
    if (!orderId) return;

    try {
      // Don't update DB for 'initial' stage
      if (newStage === 'initial') return;

      // Only update status to completed when payment is received
      const statusUpdate = newStage === 'payment_received' 
        ? 'completed' 
        : newStage === 'cancelled' 
          ? 'cancelled' 
          : 'in-progress'; // Keep as in-progress for all other tracking stages

      const { error } = await supabase
        .from('orders')
        .update({ 
          tracking_stage: newStage,
          status: statusUpdate
        })
        .eq('id', orderId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating order stage:', error);
    }
  };

  const shareLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "خطأ",
        description: "تحديد الموقع غير متاح على هذا الجهاز",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const locationUrl = `https://www.google.com/maps/search/?api=1&query=${position.coords.latitude},${position.coords.longitude}`;
        
        try {
          // Try Web Share API first (if available)
          if (navigator.share) {
            await navigator.share({
              title: 'موقعي الحالي',
              text: 'موقعي: ' + locationUrl,
            });
          } 
          // Fallback: Copy to clipboard
          else if (navigator.clipboard) {
            await navigator.clipboard.writeText(locationUrl);
            toast({
              title: "تم النسخ",
              description: "تم نسخ رابط الموقع، يمكنك مشاركته الآن",
            });
          } else {
            // Last fallback: open WhatsApp with location
            window.open(`https://wa.me/?text=${encodeURIComponent('موقعي: ' + locationUrl)}`, '_blank');
          }
        } catch (error) {
          console.error('Error sharing:', error);
          // If sharing fails, try clipboard as fallback
          try {
            if (navigator.clipboard) {
              await navigator.clipboard.writeText(locationUrl);
              toast({
                title: "تم النسخ",
                description: "تم نسخ رابط الموقع إلى الحافظة",
              });
            } else {
              toast({
                title: "رابط الموقع",
                description: locationUrl,
              });
            }
          } catch (clipError) {
            toast({
              title: "رابط موقعك",
              description: locationUrl,
              duration: 10000,
            });
          }
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast({
          title: "خطأ",
          description: "فشل الحصول على موقعك. تأكد من تفعيل خدمات الموقع",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleArrived = async () => {
    // First time tracking_stage is set - when specialist confirms arrival
    if (movingTimer > 0) {
      // If timer hasn't finished, set it now
      await updateOrderStage('moving');
    }
    
    setStage('arrived');
    setArrivedStartTime(new Date());
    await updateOrderStage('arrived');
    toast({
      title: "Confirmed",
      description: "Your arrival has been recorded",
    });
  };

  const handleStartWork = async () => {
    setStage('working');
    await updateOrderStage('working');
    toast({
      title: "Work Started",
      description: "Timer has been started",
    });
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    toast({
      title: isPaused ? "Work Resumed" : "Work Paused",
      description: isPaused ? "Work has been resumed" : "Work has been paused temporarily",
    });
  };

  const handleEmergency = () => {
    // Get company phone from order - in real app, this would come from order data
    toast({
      title: "Emergency Call",
      description: "Calling company now",
    });
    // In real implementation, call the company
  };

  const handleCancelWork = async () => {
    if (!cancelReason) {
      toast({
        title: "Error",
        description: "Please select a cancellation reason",
        variant: "destructive",
      });
      return;
    }

    if (cancelReason === 'other' && !otherReason.trim()) {
      toast({
        title: "Error",
        description: "Please write the reason",
        variant: "destructive",
      });
      return;
    }

    // Handle cancellation
    await updateOrderStage('cancelled');
    toast({
      title: "Work Cancelled",
      description: "Cancellation recorded successfully",
    });
    setShowCancelDialog(false);
    navigate(-1);
  };

  const handleEarlyFinish = () => {
    setShowEarlyFinishDialog(true);
  };

  const confirmEarlyFinish = async () => {
    setShowEarlyFinishDialog(false);
    // Request invoice directly without marking as completed first
    await handleRequestInvoice();
  };

  const handleRequestInvoice = async () => {
    // Stop alert when requesting invoice
    stopTimeExpiredAlert();
    setTimeExpired(false);
    
    await updateOrderStage('invoice_requested');
    setStage('invoice_details');
    toast({
      title: "Invoice Ready",
      description: "Please review the invoice details",
    });
    // Don't navigate away - stay on page to show invoice
  };

  const handlePaymentReceived = async () => {
    setStage('customer_rating');
    toast({
      title: "Payment Confirmed",
      description: "Please rate the customer",
    });
  };

  const handleCustomerRatingSubmit = async () => {
    if (customerRating === 0) {
      toast({
        title: "Error",
        description: "Please select a rating",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update order with customer rating
      const { error } = await supabase
        .from('orders')
        .update({
          customer_rating: customerRating,
          customer_review_notes: customerReviewNotes || null,
        } as any)
        .eq('id', orderId);

      if (error) throw error;

      await updateOrderStage('payment_received');
      
      toast({
        title: "Thank You!",
        description: "Order completed successfully",
      });
      
      // Navigate back after 1 second to show success message
      setTimeout(() => {
        navigate('/specialist-home');
      }, 1500);
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast({
        title: "Error",
        description: "Failed to submit rating",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getRemainingTime = () => {
    return Math.max(0, totalWorkSeconds - workingTime);
  };

  const checkNextBooking = async () => {
    if (!order || !orderId) return;

    try {
      // Get the specialist ID from order_specialists
      const { data: orderSpecialist } = await supabase
        .from('order_specialists')
        .select('specialist_id')
        .eq('order_id', orderId)
        .single();

      if (!orderSpecialist) return;

      // Get current order's booking time
      const currentBookingDate = new Date(order.booking_date || Date.now());

      // Check for next bookings for this specialist
      const { data: nextOrders } = await supabase
        .from('order_specialists')
        .select(`
          orders!inner(
            id,
            booking_date,
            hours_count,
            order_number
          )
        `)
        .eq('specialist_id', orderSpecialist.specialist_id)
        .neq('order_id', orderId)
        .gte('orders.booking_date', currentBookingDate.toISOString())
        .order('orders(booking_date)', { ascending: true })
        .limit(1);

      if (nextOrders && nextOrders.length > 0) {
        const nextOrder = nextOrders[0].orders as any;
        const nextBookingDate = new Date(nextOrder.booking_date);
        const timeDiff = (nextBookingDate.getTime() - Date.now()) / 1000 / 3600; // hours

        setNextBookingTime(nextBookingDate.toLocaleString('ar-SA'));
        
        // Can't extend if next booking is within 3 hours
        if (timeDiff < 3) {
          setCanExtend(false);
        } else {
          setCanExtend(true);
        }
      } else {
        setCanExtend(true);
        setNextBookingTime(null);
      }
    } catch (error) {
      console.error('Error checking next booking:', error);
      setCanExtend(true);
    }
  };

  const handleExtendTime = async (additionalHours: number) => {
    try {
      const additionalSeconds = additionalHours * 3600;
      setTotalWorkSeconds(prev => prev + additionalSeconds);
      setTimeExpired(false);
      stopTimeExpiredAlert();
      
      // Update order hours_count in database
      const newHoursCount = (order?.hours_count || 0) + additionalHours;
      await supabase
        .from('orders')
        .update({ hours_count: newHoursCount })
        .eq('id', orderId);

      toast({
        title: language === 'ar' ? "تم التمديد" : "Extended",
        description: language === 'ar' 
          ? `تم تمديد وقت العمل ${additionalHours} ساعة إضافية`
          : `Work time extended by ${additionalHours} additional hour(s)`,
      });

      setShowExtendTimeDialog(false);
    } catch (error) {
      console.error('Error extending time:', error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل تمديد الوقت" : "Failed to extend time",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{language === 'ar' ? 'الطلب غير موجود' : 'Order not found'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-6">
      <div className="max-w-2xl mx-auto space-y-6 p-4">
        {/* Order Info Card - Collapsible */}
        <Collapsible open={isOrderInfoOpen} onOpenChange={setIsOrderInfoOpen}>
          <Card className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border border-slate-200 dark:border-slate-700 shadow-md">
            {/* Order Number Badge and Customer Info - Always Visible */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 flex-1">
                {order.order_number && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-primary">
                      {language === 'ar' ? 'رقم الطلب:' : 'Order #:'} {order.order_number}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Collapse Toggle Button */}
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <ChevronDown 
                    className={`h-5 w-5 transition-transform ${isOrderInfoOpen ? 'rotate-180' : ''}`} 
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
            
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">👤</span>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground">{order.customer?.name}</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{order.customer?.area}</p>
                </div>
              </div>
            </div>
            
            {/* Collapsible Content - Service Type, Duration, Notes */}
            <CollapsibleContent>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-background/50 p-2.5 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-0.5">{t.serviceType}</p>
                  <p className="font-semibold text-sm leading-tight">{order.service_type}</p>
                </div>
                <div className="bg-background/50 p-2.5 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-0.5">{language === 'ar' ? 'المدة' : 'Duration'}</p>
                  <p className="font-semibold text-sm leading-tight">{order.hours_count} {language === 'ar' ? 'ساعات' : 'hours'}</p>
                </div>
              </div>
              
              {order.notes && (
                <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">{t.notes}</p>
                  <p className="text-xs text-foreground leading-relaxed">{order.notes}</p>
                </div>
              )}
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Initial Stage - New: Just order info with start button */}
        {stage === 'initial' && (
          <div className="space-y-4">
            {/* Map Location Button */}
            <Button 
              onClick={openMaps} 
              className="w-full h-14 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
              size="lg"
            >
              <MapPin className="h-6 w-6 ml-2" />
              <span>{language === 'ar' ? 'اضغط لموقع العميل' : 'Click Customer Location'}</span>
            </Button>

            {/* Spacer to push button down */}
            <div className="min-h-[200px]" />

            {/* Start Moving Button - Moved to bottom */}
            <Button 
              onClick={handleStartMoving} 
              className="w-full h-16 text-xl font-black shadow-xl hover:shadow-2xl transition-all bg-gradient-to-r from-green-500 to-green-600 hover:scale-[1.02]"
              size="lg"
            >
              <ArrowRight className="h-7 w-7 ml-2" />
              <span>{language === 'ar' ? 'ابدأ التحرك للعمل' : 'Start Moving to Work'}</span>
            </Button>
          </div>
        )}

        {/* Moving Stage - Compact */}
        {stage === 'moving' && (
          <div className="space-y-3 pb-24">
            {/* Primary Location Button - Large and Clear with Animations */}
            <Button
              onClick={openMaps}
              className="w-full min-h-[120px] bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-none shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] rounded-xl animate-pulse hover:animate-none relative overflow-hidden group"
            >
              {/* Animated Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[slide-in-right_2s_ease-in-out_infinite]" />
              
              <div className="flex flex-col items-center gap-3 py-2 relative z-10">
                <div className="flex items-center justify-center w-14 h-14 bg-white/20 rounded-full backdrop-blur-sm animate-[scale-in_1s_ease-in-out_infinite] group-hover:animate-none">
                  <MapPin className="h-7 w-7 animate-bounce" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-lg font-bold text-white leading-tight">
                    {language === 'ar' ? 'العميل بانتظارك، قم بالتحرك إليه لتكون هناك في الوقت' : 'Customer is waiting, move to them to be there on time'}
                  </p>
                  <p className="text-sm font-medium text-blue-100">
                    {language === 'ar' ? 'اضغط هنا لفتح خريطة الموقع' : 'Click here to open location map'}
                  </p>
                </div>
              </div>
            </Button>

            {/* Share Location Button - Secondary with Attention Effects */}
            <Button
              onClick={shareLocation}
              variant="outline"
              className="w-full h-14 border-2 hover:bg-accent transition-all hover:scale-105 hover:shadow-lg animate-fade-in"
            >
              <Share2 className="h-5 w-5 ml-2 animate-pulse" />
              <span className="font-semibold">{language === 'ar' ? 'مشاركة موقعي مع العميل' : 'Share My Location with Customer'}</span>
            </Button>

            {/* Fixed Arrival Button */}
            <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur-sm border-t z-50 space-y-2">
              {/* Timer Warning - Show when button is disabled */}
              {movingTimer > 0 && (
                <Card className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50 border-2 border-amber-300 dark:border-amber-700 shadow-md">
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-pulse" />
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                        الزر سيتم تفعيله بعد
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                        00:{movingTimer.toString().padStart(2, '0')}
                      </p>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-amber-200 dark:bg-amber-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-600 dark:bg-amber-400 h-1.5 rounded-full transition-all duration-1000"
                        style={{ width: `${((60 - movingTimer) / 60) * 100}%` }}
                      />
                    </div>
                  </div>
                </Card>
              )}
              
              <Button
                onClick={handleArrived}
                disabled={movingTimer > 0}
                className={`w-full h-12 text-base font-bold shadow-lg transition-all ${
                  movingTimer > 0 
                    ? 'opacity-50 cursor-not-allowed bg-gray-400' 
                    : 'bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:shadow-xl'
                }`}
                size="lg"
              >
                <CheckCircle className="h-5 w-5 ml-2" />
                <span>لقد وصلت إلى الموقع</span>
              </Button>
            </div>
          </div>
        )}

        {/* Arrived Stage - Simplified */}
        {stage === 'arrived' && (
          <Card className="overflow-hidden border-2 border-green-300 dark:border-green-700 shadow-2xl">
            {/* Stage Header - Compact */}
            <div className="bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 py-3 px-4">
              <div className="flex items-center justify-center gap-3">
                <div className="p-2 rounded-full bg-white/20 backdrop-blur-sm">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">{language === 'ar' ? 'وصلت إلى الموقع' : 'Arrived at Location'}</h3>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Customer Contact - Icon Only */}
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Button 
                    onClick={() => window.location.href = `tel:${order.customer?.whatsapp_number || ''}`}
                    size="icon"
                    className="h-14 w-14 bg-green-600 hover:bg-green-700 rounded-full shadow-lg"
                  >
                    <Phone className="h-6 w-6" />
                  </Button>
                  <span className="text-xs font-medium text-green-700">اتصال بالعميل</span>
                </div>
              </div>

              {/* Building Info - Compact */}
              {order.building_info && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">معلومات المبنى</p>
                      <p className="text-sm font-medium">
                        {order.building_info}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Timer Protection - Compact */}
              {arrivedTimer > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                  <div className="flex items-center gap-3 justify-center">
                    <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
                    <div className="text-center">
                      <p className="text-xs text-amber-700">سيتم تفعيل زر بدء العمل بعد</p>
                      <p className="text-lg font-bold text-amber-600 tabular-nums">
                        00:00:{arrivedTimer.toString().padStart(2, '0')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Start Work Button - Simplified */}
              <Button
                onClick={handleStartWork}
                disabled={arrivedTimer > 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="h-4 w-4 ml-2" />
                <span>بدء ساعة العمل</span>
              </Button>
            </div>
          </Card>
        )}

        {/* Working Stage */}
        {stage === 'working' && (
          <>
            <Card className="p-6 space-y-6 pb-32">
              <h3 className="text-xl font-bold text-center">{language === 'ar' ? 'العمل جارٍ' : 'Work in Progress'}</h3>
              
              {/* Work Timer - Countdown */}
              <div className="text-center space-y-2">
                <div className={`text-4xl font-bold tabular-nums ${
                  timeExpired ? 'text-red-600 animate-pulse' : 'text-primary'
                }`}>
                  {formatTime(getRemainingTime())}
                </div>
                <div className="text-sm text-muted-foreground">
                  من {formatTime(totalWorkSeconds)}
                </div>
                {timeExpired && (
                  <div className="text-base font-semibold text-red-600 animate-pulse">
                    ⏰ انتهى وقت العمل - يرجى إنهاء العمل
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    timeExpired ? 'bg-red-600' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min((workingTime / totalWorkSeconds) * 100, 100)}%` }}
                />
              </div>

              {/* Time Expired Alert Dialog */}
              {timeExpired && (
                <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 p-4 animate-pulse">
                  <div className="text-center space-y-3">
                    <div className="text-4xl">⏰</div>
                    <h4 className="text-lg font-bold text-red-800">انتهى وقت العمل المحدد</h4>
                    <p className="text-sm text-red-700">
                      الوقت المخصص للعمل قد انتهى. يرجى إنهاء العمل والانتقال للفاتورة
                    </p>
                  </div>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Only show pause button if time hasn't expired */}
                {!timeExpired && (
                  <Button
                    onClick={togglePause}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    {isPaused ? (
                      <>
                        <Play className="ml-2 h-5 w-5" />
                        استئناف العمل
                      </>
                    ) : (
                      <>
                        <Pause className="ml-2 h-5 w-5" />
                        إيقاف مؤقت
                      </>
                    )}
                  </Button>
                )}

                {/* Extend Time Button - Show when time expired */}
                {timeExpired && (
                  <Dialog open={showExtendTimeDialog} onOpenChange={(open) => {
                    if (open) checkNextBooking();
                    setShowExtendTimeDialog(open);
                  }}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline"
                        className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"
                        size="lg"
                      >
                        <Clock className="ml-2 h-5 w-5" />
                        تمديد وقت العمل
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>تمديد وقت العمل</DialogTitle>
                        <DialogDescription>
                          {canExtend 
                            ? 'اختر عدد الساعات الإضافية'
                            : 'لا يمكن التمديد بسبب وجود حجز آخر'}
                        </DialogDescription>
                      </DialogHeader>

                      {canExtend ? (
                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-3 gap-3">
                            <Button
                              variant={extensionHours === 1 ? "default" : "outline"}
                              onClick={() => setExtensionHours(1)}
                              className="h-20 flex flex-col items-center justify-center"
                            >
                              <Clock className="h-6 w-6 mb-1" />
                              <span className="text-sm">ساعة واحدة</span>
                            </Button>
                            <Button
                              variant={extensionHours === 2 ? "default" : "outline"}
                              onClick={() => setExtensionHours(2)}
                              className="h-20 flex flex-col items-center justify-center"
                            >
                              <Clock className="h-6 w-6 mb-1" />
                              <span className="text-sm">ساعتين</span>
                            </Button>
                            <Button
                              variant={extensionHours === 3 ? "default" : "outline"}
                              onClick={() => setExtensionHours(3)}
                              className="h-20 flex flex-col items-center justify-center"
                            >
                              <Clock className="h-6 w-6 mb-1" />
                              <span className="text-sm">3 ساعات</span>
                            </Button>
                          </div>
                          
                          <Button 
                            onClick={() => handleExtendTime(extensionHours)}
                            className="w-full"
                          >
                            تأكيد التمديد
                          </Button>
                        </div>
                      ) : (
                        <div className="py-4 space-y-4">
                          <Alert className="border-amber-500 bg-amber-50">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800">
                              <p className="font-semibold mb-2">يوجد حجز آخر قريب</p>
                              <p className="text-sm">
                                الحجز القادم في: {nextBookingTime}
                              </p>
                              <p className="text-sm mt-2">
                                لا يمكن تمديد وقت العمل لأن هناك مهمة أخرى في انتظارك قريباً
                              </p>
                            </AlertDescription>
                          </Alert>
                          
                          <Button 
                            onClick={() => setShowExtendTimeDialog(false)}
                            variant="outline"
                            className="w-full"
                          >
                            حسناً، فهمت
                          </Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                )}

                {/* Emergency Actions - Collapsible Section */}
                <Collapsible className="w-full border-t pt-4 mt-4">
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                    >
                      <AlertTriangle className="ml-2 h-3 w-3" />
                      حالات الطوارئ فقط
                      <ChevronDown className="mr-2 h-3 w-3" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-3">
                    <p className="text-xs text-center text-muted-foreground mb-3 px-4">
                      ⚠️ تحذير: هذه الأزرار للحالات الطارئة فقط
                    </p>
                    
                    <Button
                      onClick={handleEmergency}
                      variant="outline"
                      size="sm"
                      className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                    >
                      <AlertTriangle className="ml-2 h-3.5 w-3.5" />
                      اتصال طوارئ بالشركة
                    </Button>

                    <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="w-full text-destructive/70 hover:text-destructive hover:bg-destructive/5 text-xs"
                        >
                          <XCircle className="ml-2 h-3.5 w-3.5" />
                          إلغاء العمل
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Cancellation Reason</DialogTitle>
                          <DialogDescription>
                            Please select a reason for cancelling the work
                          </DialogDescription>
                        </DialogHeader>
                        <RadioGroup value={cancelReason} onValueChange={setCancelReason}>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="customer_requested" id="customer_requested" />
                            <Label htmlFor="customer_requested">Customer Requested Cancellation</Label>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="not_family" id="not_family" />
                            <Label htmlFor="not_family">Customer is Not Family</Label>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="other" id="other" />
                            <Label htmlFor="other">Other Reasons</Label>
                          </div>
                        </RadioGroup>
                        
                        {cancelReason === 'other' && (
                          <div className="space-y-2">
                            <Label htmlFor="other_reason">Write the Reason</Label>
                            <Textarea
                              id="other_reason"
                              value={otherReason}
                              onChange={(e) => setOtherReason(e.target.value)}
                              placeholder="Write cancellation reason here..."
                              rows={4}
                            />
                          </div>
                        )}
                        
                        <Button onClick={handleCancelWork} variant="destructive" className="w-full">
                          Confirm Cancellation
                        </Button>
                      </DialogContent>
                    </Dialog>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </Card>

            {/* Fixed Finish Work Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t z-50">
              <div className="max-w-2xl mx-auto space-y-2">
                {/* Extend Time Button - Show when time expired */}
                {timeExpired && (
                  <Dialog open={showExtendTimeDialog} onOpenChange={(open) => {
                    if (open) checkNextBooking();
                    setShowExtendTimeDialog(open);
                  }}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline"
                        className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"
                        size="lg"
                      >
                        <Clock className="ml-2 h-5 w-5" />
                        تمديد وقت العمل
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>تمديد وقت العمل</DialogTitle>
                        <DialogDescription>
                          {canExtend 
                            ? 'اختر عدد الساعات الإضافية'
                            : 'لا يمكن التمديد بسبب وجود حجز آخر'}
                        </DialogDescription>
                      </DialogHeader>

                      {canExtend ? (
                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-3 gap-3">
                            <Button
                              variant={extensionHours === 1 ? "default" : "outline"}
                              onClick={() => setExtensionHours(1)}
                              className="h-20 flex flex-col items-center justify-center"
                            >
                              <Clock className="h-6 w-6 mb-1" />
                              <span className="text-sm">ساعة واحدة</span>
                            </Button>
                            <Button
                              variant={extensionHours === 2 ? "default" : "outline"}
                              onClick={() => setExtensionHours(2)}
                              className="h-20 flex flex-col items-center justify-center"
                            >
                              <Clock className="h-6 w-6 mb-1" />
                              <span className="text-sm">ساعتين</span>
                            </Button>
                            <Button
                              variant={extensionHours === 3 ? "default" : "outline"}
                              onClick={() => setExtensionHours(3)}
                              className="h-20 flex flex-col items-center justify-center"
                            >
                              <Clock className="h-6 w-6 mb-1" />
                              <span className="text-sm">3 ساعات</span>
                            </Button>
                          </div>
                          
                          <Button 
                            onClick={() => handleExtendTime(extensionHours)}
                            className="w-full"
                          >
                            تأكيد التمديد
                          </Button>
                        </div>
                      ) : (
                        <div className="py-4 space-y-4">
                          <Alert className="border-amber-500 bg-amber-50">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800">
                              <p className="font-semibold mb-2">يوجد حجز آخر قريب</p>
                              <p className="text-sm">
                                الحجز القادم في: {nextBookingTime}
                              </p>
                              <p className="text-sm mt-2">
                                لا يمكن تمديد وقت العمل لأن هناك مهمة أخرى في انتظارك قريباً
                              </p>
                            </AlertDescription>
                          </Alert>
                          
                          <Button 
                            onClick={() => setShowExtendTimeDialog(false)}
                            variant="outline"
                            className="w-full"
                          >
                            حسناً، فهمت
                          </Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                )}

                {/* Finish Work Button - Always visible */}
                <Button 
                  onClick={() => {
                    stopTimeExpiredAlert();
                    setTimeExpired(false);
                    confirmEarlyFinish();
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 h-14 text-lg font-bold shadow-lg"
                >
                  <CheckCircle className="ml-2 h-6 w-6" />
                  إنهاء العمل الآن
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Invoice Details Stage */}
        {stage === 'invoice_details' && (
          <div className="fixed inset-0 flex flex-col bg-background">
            {/* Header - Fixed at top with Company Info */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 text-center shadow-lg">
              {order?.company?.logo_url ? (
                <img 
                  src={order.company.logo_url} 
                  alt={order.company.name}
                  className="h-16 w-auto mx-auto mb-2 object-contain"
                />
              ) : (
                <div className="text-4xl mb-2">💰</div>
              )}
              <h3 className="text-lg font-bold text-white">{language === 'ar' ? 'تفاصيل الفاتورة' : 'Invoice Details'}</h3>
              {order?.company && (
                <p className="text-sm text-white/90 mt-1">{order.company.name}</p>
              )}
            </div>

            {/* Invoice Content - Centered and Compact */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              <div className="w-full max-w-md space-y-4">
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-5 rounded-xl space-y-3 shadow-lg border-2 border-slate-200 dark:border-slate-700">
                  {/* Service Type */}
                  <div className="flex justify-between items-center pb-3 border-b border-slate-300 dark:border-slate-600">
                    <span className="text-sm text-muted-foreground">نوع الخدمة</span>
                    <span className="font-bold text-base">{order.service_type}</span>
                  </div>
                  
                  {/* Hours Count */}
                  <div className="flex justify-between items-center text-base">
                    <span className="text-muted-foreground">عدد الساعات</span>
                    <span className="font-bold text-lg">{order.hours_count} ساعة</span>
                  </div>
                  
                  {/* Price per Hour */}
                  <div className="flex justify-between items-center text-base">
                    <span className="text-muted-foreground">سعر الساعة</span>
                    <span className="font-bold text-lg">
                      {(invoiceAmount / (order.hours_count || 1)).toFixed(2)} ر.ق
                    </span>
                  </div>
                  
                  {/* Discount if any */}
                  {discount > 0 && (
                    <div className="flex justify-between items-center text-green-600 dark:text-green-400 text-base">
                      <span className="font-medium">الخصم</span>
                      <span className="font-bold">-{discount.toFixed(2)} ر.ق</span>
                    </div>
                  )}
                  
                  {/* Total Amount - Prominent */}
                  <div className="border-t-2 border-slate-400 dark:border-slate-500 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg">المبلغ الإجمالي</span>
                      <span className="font-black text-green-600 text-3xl">
                        {(invoiceAmount - discount).toFixed(2)} <span className="text-xl">ر.ق</span>
                      </span>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-center text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                  💵 الرجاء تحصيل هذا المبلغ من العميل
                </p>
              </div>
            </div>

            {/* Fixed Button at Bottom - Always Visible */}
            <div className="p-4 border-t-2 bg-background shadow-[0_-4px_12px_rgba(0,0,0,0.1)] sticky bottom-0">
              <Button
                onClick={handlePaymentReceived}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg animate-pulse"
                size="lg"
              >
                <CheckCircle className="ml-2 h-5 w-5" />
                تأكيد استلام الدفع
              </Button>
            </div>
          </div>
        )}

        {/* Customer Rating Stage */}
        {stage === 'customer_rating' && (
          <Card className="p-6 space-y-6">
            <h3 className="text-xl font-bold text-center">{language === 'ar' ? 'تقييم العميل' : 'Rate the Customer'}</h3>
            
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">How was your experience with this customer?</p>
                
                {/* Star Rating */}
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setCustomerRating(star)}
                      className="transition-all hover:scale-110"
                    >
                      <Star
                        className={`h-12 w-12 ${
                          star <= customerRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                
                {customerRating > 0 && (
                  <p className="text-sm font-semibold">
                    {customerRating === 5 && '⭐ Excellent Customer!'}
                    {customerRating === 4 && '👍 Good Customer'}
                    {customerRating === 3 && '😊 Average Customer'}
                    {customerRating === 2 && '🤔 Below Average'}
                    {customerRating === 1 && '😟 Poor Experience'}
                  </p>
                )}
              </div>
              
              {/* Review Notes */}
              <div className="space-y-2">
                <Label htmlFor="customer_notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="customer_notes"
                  value={customerReviewNotes}
                  onChange={(e) => setCustomerReviewNotes(e.target.value)}
                  placeholder="Share your experience with this customer..."
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  This will help us improve service quality
                </p>
              </div>
            </div>

            <Button
              onClick={handleCustomerRatingSubmit}
              className="w-full"
              size="lg"
              disabled={customerRating === 0}
            >
              <CheckCircle className="ml-2 h-5 w-5" />
              Submit Rating
            </Button>
          </Card>
        )}

        {/* Payment Received Stage */}
        {stage === 'payment_received' && (
          <Card className="p-6 space-y-6">
            <h3 className="text-xl font-bold text-center text-green-600">Work Completed!</h3>
            
            <div className="text-center space-y-4">
              <div className="text-6xl">✅</div>
              <p className="text-lg text-muted-foreground">
                Payment has been received and work is completed
              </p>
              <p className="text-sm text-muted-foreground animate-pulse">
                Redirecting to home...
              </p>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
