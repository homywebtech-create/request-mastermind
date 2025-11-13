import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useBlocker } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Navigation, Share2, CheckCircle, Play, Pause, AlertTriangle, Phone, XCircle, FileText, Clock, ArrowRight, Star, ChevronDown, ArrowLeft, MessageSquare, AlertCircle } from "lucide-react";
import { SlideToComplete } from "@/components/ui/slide-to-complete";
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
import { TranslateButton } from "@/components/specialist/TranslateButton";
import { SpecialistMessagesButton } from "@/components/specialist/SpecialistMessagesButton";
import { Capacitor } from '@capacitor/core';
import { sendTemplateMessage } from "@/lib/whatsappTemplateHelper";
import { PaymentConfirmationDialog } from "@/components/orders/PaymentConfirmationDialog";

type Stage = 'initial' | 'moving' | 'arrived' | 'waiting_for_customer' | 'working' | 'completed' | 'cancelled' | 'invoice_requested' | 'invoice_details' | 'customer_rating' | 'payment_received';

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
  customer_id: string | null;
  hourly_rate: number | null;
  final_amount: number | null;
  payment_status: string | null;
  payment_not_received_reason: string | null;
  customer: {
    name: string;
    whatsapp_number: string;
    area: string | null;
    budget: string | null;
    budget_type: string | null;
    preferred_language?: string;
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
  const [waitingTimer, setWaitingTimer] = useState(15 * 60); // 15 minutes in seconds
  const [isLoading, setIsLoading] = useState(true);
  const [workingTime, setWorkingTime] = useState(0);
  const [totalWorkSeconds, setTotalWorkSeconds] = useState(0);
  const [timeExpired, setTimeExpired] = useState(false);
  const [alertInterval, setAlertInterval] = useState<NodeJS.Timeout | null>(null);
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);
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
  const [hourlyRate, setHourlyRate] = useState(0);
  const [originalHours, setOriginalHours] = useState(0);
  const [showCompensationDialog, setShowCompensationDialog] = useState(false);
  const [compensationAmount, setCompensationAmount] = useState(0);
  const [workStartTime, setWorkStartTime] = useState<Date | null>(null);
  const [workEndTime, setWorkEndTime] = useState<Date | null>(null);
  const [isOrderInfoOpen, setIsOrderInfoOpen] = useState(false);
  const [showPaymentNotReceivedDialog, setShowPaymentNotReceivedDialog] = useState(false);
  const [paymentNotReceivedReason, setPaymentNotReceivedReason] = useState('');
  const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false);
  const [showEarlyFinishReasonDialog, setShowEarlyFinishReasonDialog] = useState(false);
  const [earlyFinishReason, setEarlyFinishReason] = useState('');
  const [otherPaymentReason, setOtherPaymentReason] = useState('');
  const [translatedNotes, setTranslatedNotes] = useState<string | null>(null);
  const [translatedBuildingInfo, setTranslatedBuildingInfo] = useState<string | null>(null);
  const [specialistId, setSpecialistId] = useState<string>('');
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');
  const [showPaymentConfirmDialog, setShowPaymentConfirmDialog] = useState(false);
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
          title: t.warning,
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

    fetchOrder();

    // Check if order already has a tracking stage
    const checkAndSetStage = async () => {
      const currentOrderResult: any = await supabase
        .from('orders')
        .select('tracking_stage')
        .eq('id', orderId)
        .single();

      const currentOrder = currentOrderResult.data;

      if (currentOrder?.tracking_stage) {
        // Resume from existing stage
        if (currentOrder.tracking_stage === 'invoice_requested') {
          setStage('invoice_requested');
        } else if (currentOrder.tracking_stage === 'payment_received') {
          setStage('payment_received');
        } else if (currentOrder.tracking_stage === 'arrived') {
          setStage('arrived');
          setArrivedStartTime(new Date());
        } else if (currentOrder.tracking_stage === 'waiting_for_customer') {
          setStage('waiting_for_customer');
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

  // Fetch specialist ID and Google Maps API key
  useEffect(() => {
    const fetchSpecialistIdFromAuth = async () => {
      try {
        const userResponse = await supabase.auth.getUser();
        const user = userResponse.data?.user;
        if (user) {
          const supabaseAny: any = supabase;
          const specialistResponse = await supabaseAny
            .from('specialists')
            .select('id')
            .eq('user_id', user.id);
          
          if (specialistResponse.data && specialistResponse.data.length > 0) {
            setSpecialistId(specialistResponse.data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching specialist ID:', error);
      }
    };

    fetchSpecialistIdFromAuth();
  }, []);

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-google-maps-key');
        
        if (error) throw error;
        
        if (data?.apiKey) {
          setGoogleMapsApiKey(data.apiKey);
        }
      } catch (error) {
        console.error('Error fetching Google Maps API key:', error);
      }
    };

    fetchApiKey();
  }, []);

  // Monitor order status and redirect if cancelled
  useEffect(() => {
    if (!orderId) return;

    // Subscribe to order changes
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const updatedOrder = payload.new as { status?: string; tracking_stage?: string };
          
          // If order is cancelled, redirect specialist
          if (updatedOrder.status === 'cancelled' || updatedOrder.tracking_stage === 'cancelled') {
            stopTimeExpiredAlert();
            toast({
              title: language === 'ar' ? "تم إلغاء الطلب" : "Order Cancelled",
              description: language === 'ar' ? "تم إلغاء هذا الطلب" : "This order has been cancelled",
              variant: "destructive",
            });
            setTimeout(() => {
              navigate('/specialist/home');
            }, 1500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, language, navigate, toast]);

  // Check if order is already cancelled on mount
  useEffect(() => {
    if (order && (order.payment_status === 'cancelled' || stage === 'cancelled')) {
      stopTimeExpiredAlert();
      toast({
        title: language === 'ar' ? "طلب ملغي" : "Cancelled Order",
        description: language === 'ar' ? "هذا الطلب ملغي بالفعل" : "This order is already cancelled",
        variant: "destructive",
      });
      setTimeout(() => {
        navigate('/specialist/home');
      }, 1500);
    }
  }, [order, stage, language, navigate, toast]);

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

  // Timer for waiting_for_customer stage (15 minutes countdown)
  useEffect(() => {
    if (stage === 'waiting_for_customer' && waitingTimer > 0) {
      const timer = setInterval(() => {
        setWaitingTimer(prev => {
          const newTime = prev - 1;
          
          // Play sound and show notification when timer expires
          if (newTime === 0 && !timeExpired) {
            setTimeExpired(true);
            startWaitingAlert();
          }
          
          return newTime;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [stage, waitingTimer, timeExpired]);

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
    if (stage === 'working' && workingTime < totalWorkSeconds) {
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
  }, [stage, workingTime, totalWorkSeconds, timeExpired]);

  // Calculate total work seconds from hours_count
  useEffect(() => {
    if (order?.hours_count) {
      setTotalWorkSeconds(order.hours_count * 3600); // Convert hours to seconds
    }
  }, [order]);

  const startTimeExpiredAlert = () => {
    // Stop any existing audio first
    if (alertAudioRef.current) {
      alertAudioRef.current.pause();
      alertAudioRef.current.currentTime = 0;
    }

    // Play notification sound
    const audio = new Audio('/notification-sound.mp3');
    audio.loop = true;
    alertAudioRef.current = audio;
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
      title: t.timeExpired,
      description: t.timeExpiredDescription,
      duration: 10000,
    });
  };

  const startWaitingAlert = () => {
    // Stop any existing audio first
    if (alertAudioRef.current) {
      alertAudioRef.current.pause();
      alertAudioRef.current.currentTime = 0;
    }

    // Play notification sound
    const audio = new Audio('/notification-sound.mp3');
    audio.loop = true;
    alertAudioRef.current = audio;
    audio.play().catch(err => console.error('Audio play error:', err));

    // Vibrate (if supported)
    if (navigator.vibrate) {
      const vibratePattern = [500, 200, 500, 200, 500];
      const interval = setInterval(() => {
        navigator.vibrate(vibratePattern);
      }, 2000);
      setAlertInterval(interval);
    }

    // Show notification if page is not visible
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(language === 'ar' ? 'انتهى وقت الانتظار' : 'Waiting Time Expired', {
        body: language === 'ar' 
          ? 'انتهت مدة الانتظار 15 دقيقة. يمكنك الآن تأكيد عدم حضور العميل.'
          : 'The 15-minute waiting period has ended. You can now confirm customer no-show.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
      });
    }

    toast({
      title: language === 'ar' ? "انتهى وقت الانتظار" : "Waiting Time Expired",
      description: language === 'ar' 
        ? "انتهت مدة الانتظار 15 دقيقة. يمكنك الآن تأكيد عدم حضور العميل."
        : "The 15-minute waiting period has ended. You can now confirm customer no-show.",
      duration: 10000,
    });
  };

  const stopTimeExpiredAlert = () => {
    // Stop the alert audio if it exists
    if (alertAudioRef.current) {
      alertAudioRef.current.pause();
      alertAudioRef.current.currentTime = 0;
      alertAudioRef.current = null;
    }

    // Stop any other playing audio elements as fallback
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
          customer_id,
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
      
      // Calculate invoice amount from hourly_rate or quoted_price
      let calculatedAmount = 0;
      let rate = 0;
      
      // First priority: use hourly_rate if available
      if (orderData?.hourly_rate && orderData?.hours_count) {
        rate = Number(orderData.hourly_rate);
        calculatedAmount = rate * Number(orderData.hours_count);
        setHourlyRate(rate);
        setOriginalHours(Number(orderData.hours_count));
      }
      // Second priority: get quoted price from order_specialists
      else if (orderData?.order_specialists) {
        const acceptedQuote = orderData.order_specialists.find((os: any) => os.is_accepted === true);
        if (acceptedQuote?.quoted_price) {
          const priceMatch = acceptedQuote.quoted_price.match(/(\d+(\.\d+)?)/);
          if (priceMatch) {
            calculatedAmount = parseFloat(priceMatch[1]);
            // If we have hours_count, calculate the rate
            if (orderData?.hours_count) {
              rate = calculatedAmount / Number(orderData.hours_count);
              setHourlyRate(rate);
              setOriginalHours(Number(orderData.hours_count));
            }
          }
        }
      }
      // Fallback: try to use final_amount
      else if (orderData?.final_amount) {
        calculatedAmount = Number(orderData.final_amount);
      }
      
      setInvoiceAmount(calculatedAmount);
    } catch (error) {
      console.error('Error fetching order:', error);
      toast({
        title: t.error,
        description: "Failed to load order data",
        variant: "destructive",
      });
      // Navigate back if there's an error loading order
      setTimeout(() => {
        navigate('/specialist/home');
      }, 2000);
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
    try {
      // Get current user's profile to find their phone
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', user.id)
        .single();

      if (!profile?.phone) throw new Error('User phone not found');

      // Get specialist by phone
      const { data: specialistData } = await supabase
        .from('specialists')
        .select('id, company_id')
        .eq('phone', profile.phone)
        .single();

      if (!specialistData) {
        toast({
          title: language === 'ar' ? "خطأ" : "Error",
          description: language === 'ar' ? "لم يتم العثور على بيانات المحترف" : "Specialist data not found",
          variant: "destructive",
        });
        return;
      }

      // Update order with company_id and turn off send_to_all_companies
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          company_id: specialistData.company_id,
          send_to_all_companies: false, // Important: turn off to avoid constraint violation
          tracking_stage: 'moving',
          status: 'in-progress'
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Mark specialist as accepted in order_specialists
      const { error: acceptError } = await supabase
        .from('order_specialists')
        .update({ 
          is_accepted: true,
          quoted_at: new Date().toISOString()
        })
        .eq('order_id', orderId)
        .eq('specialist_id', specialistData.id);

      if (acceptError) throw acceptError;

      // Reload order data to reflect changes
      await fetchOrder();

      setStage('moving');
      toast({
        title: language === 'ar' ? "بدء التحرك" : "Started Moving",
        description: language === 'ar' ? "تم تسجيل بدء التحرك نحو العميل" : "Movement to customer recorded",
      });
    } catch (error) {
      console.error('Error starting movement:', error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "حدث خطأ أثناء بدء التحرك" : "Error starting movement",
        variant: "destructive",
      });
    }
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

  const viewCustomerLocation = () => {
    if (!order?.gps_latitude || !order?.gps_longitude) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "موقع العميل غير متوفر" : "Customer location not available",
        variant: "destructive",
      });
      return;
    }

    // Open Google Maps to view location only (without navigation)
    const viewUrl = `https://www.google.com/maps/@${order.gps_latitude},${order.gps_longitude},17z`;
    window.open(viewUrl, '_blank');
    
    // Show guidance message
    toast({
      title: language === 'ar' ? "عرض الموقع" : "View Location",
      description: language === 'ar' 
        ? "للحصول على خيار التوجه على الخريطة، اضغط على الزر الأخضر"
        : "To get navigation directions, click the green button",
      duration: 5000,
    });
  };

  const shareCustomerLocationViaWhatsApp = async () => {
    if (!order?.gps_latitude || !order?.gps_longitude) {
      toast({
        title: t.trackingError,
        description: t.customerLocationNotAvailable,
        variant: "destructive",
      });
      return;
    }

    const locationUrl = `https://www.google.com/maps/search/?api=1&query=${order.gps_latitude},${order.gps_longitude}`;
    const shareText = language === 'ar'
      ? `موقع العميل: ${order.customer?.name || ''}\n${locationUrl}`
      : `Customer Location: ${order.customer?.name || ''}\n${locationUrl}`;

    try {
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: t.customerLocation,
          text: shareText,
          dialogTitle: t.shareCustomerLocation,
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: t.customerLocation,
          text: shareText,
          url: locationUrl,
        });
        return;
      }

      // Web fallback: open WhatsApp with text
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    } catch (error) {
      console.error('Error sharing location:', error);
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(locationUrl);
          toast({
            title: t.copied,
            description: t.customerLocationLinkCopied,
          });
        } else {
          toast({
            title: t.customerLocationLink,
            description: locationUrl,
            duration: 10000,
          });
        }
      } catch {
        toast({
          title: t.customerLocationLink,
          description: locationUrl,
          duration: 10000,
        });
      }
    }
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

    // Send professional WhatsApp message to customer about arrival
    if (order?.customer?.whatsapp_number) {
      try {
        const customerLanguage = (order.customer.preferred_language || 'ar') as 'ar' | 'en';
        
        await sendTemplateMessage(
          order.customer.whatsapp_number,
          'specialist_arrived',
          customerLanguage,
          {
            customer_name: order.customer.name,
            specialist_name: 'المحترف' // You can get the actual specialist name if available
          }
        );
        
        console.log('✅ Arrival notification sent to customer');
      } catch (whatsappError) {
        console.error('❌ Failed to send arrival WhatsApp message:', whatsappError);
        // Don't block the flow if WhatsApp fails
      }
    }

    toast({
      title: "Confirmed",
      description: "Your arrival has been recorded",
    });
  };

  const handleStartWork = async () => {
    setWorkStartTime(new Date());
    setStage('working');
    await updateOrderStage('working');
    toast({
      title: "Work Started",
      description: "Timer has been started",
    });
  };

  const handleCustomerNotPresent = async () => {
    try {
      // Extract sub-service name from service_type
      const subServiceName = order?.service_type?.includes('-') 
        ? order.service_type.split('-')[1]?.trim() 
        : order?.service_type?.trim();

      // Fetch waiting time for this sub-service
      const { data: cancellationData } = await supabase
        .from('cancellation_settings')
        .select(`
          waiting_time_minutes,
          sub_services!inner (
            name,
            name_en
          )
        `)
        .or(`sub_services.name.eq.${subServiceName},sub_services.name_en.eq.${subServiceName}`)
        .single();

      // Default to 5 minutes if no setting found
      const waitingTimeMinutes = cancellationData?.waiting_time_minutes || 5;
      
      const now = new Date();
      const waitingEnds = new Date(now.getTime() + waitingTimeMinutes * 60 * 1000);
      
      // Start waiting stage and save timestamps
      setStage('waiting_for_customer');
      setWaitingTimer(waitingTimeMinutes * 60); // Convert to seconds
      setTimeExpired(false);

      // Update order with waiting timestamps
      const { error } = await supabase
        .from('orders')
        .update({ 
          tracking_stage: 'waiting_for_customer',
          waiting_started_at: now.toISOString(),
          waiting_ends_at: waitingEnds.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      
      // Request notification permission if not granted
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      // Send professional WhatsApp message to customer about waiting period
      if (order?.customer?.whatsapp_number) {
        try {
          const customerLanguage = (order.customer.preferred_language || 'ar') as 'ar' | 'en';
          
          await sendTemplateMessage(
            order.customer.whatsapp_number,
            'waiting_for_customer',
            customerLanguage,
            {
              customer_name: order.customer.name,
              specialist_name: 'المحترف' // You can get the actual specialist name if available
            }
          );
          
          console.log('✅ Waiting period notification sent to customer');
        } catch (whatsappError) {
          console.error('❌ Failed to send waiting WhatsApp message:', whatsappError);
          // Don't block the flow if WhatsApp fails
        }
      }
      
      toast({
        title: language === 'ar' ? "بدء الانتظار" : "Waiting Started",
        description: language === 'ar' 
          ? "بدأ عداد الانتظار 15 دقيقة"
          : "15-minute waiting period started",
      });
    } catch (error: any) {
      console.error('Error starting waiting period:', error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancelWaiting = async () => {
    try {
      // Customer arrived, cancel waiting and start work
      stopTimeExpiredAlert();
      setTimeExpired(false);

      // Clear waiting timestamps when customer arrives
      const { error } = await supabase
        .from('orders')
        .update({ 
          waiting_started_at: null,
          waiting_ends_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      await handleStartWork();
      toast({
        title: language === 'ar' ? "حضر العميل" : "Customer Arrived",
        description: language === 'ar' 
          ? "تم بدء العمل"
          : "Work has been started",
      });
    } catch (error: any) {
      console.error('Error cancelling waiting:', error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleConfirmNoShow = async () => {
    // Customer didn't show up, proceed with compensation
    stopTimeExpiredAlert();
    setTimeExpired(false);
    
    try {
      setIsLoading(true);
      
      // Extract sub-service name from service_type
      // service_type format: "الخدمة - الخدمة الفرعية"
      const subServiceName = order?.service_type?.includes('-') 
        ? order.service_type.split('-')[1]?.trim() 
        : order?.service_type?.trim();

      // Fetch cancellation percentage and waiting time for this sub-service
      const { data: cancellationData, error: cancellationError } = await supabase
        .from('cancellation_settings')
        .select(`
          cancellation_percentage,
          waiting_time_minutes,
          sub_services!inner (
            name,
            name_en
          )
        `)
        .or(`sub_services.name.eq.${subServiceName},sub_services.name_en.eq.${subServiceName}`)
        .single();

      // Default to 50% and 5 minutes if no setting found
      const cancellationPercentage = cancellationData?.cancellation_percentage || 50;
      const waitingTimeMinutes = cancellationData?.waiting_time_minutes || 5;
      
      // Calculate compensation amount based on invoice amount and percentage
      const compensationAmountValue = (invoiceAmount * cancellationPercentage) / 100;

      if (specialistId && compensationAmountValue > 0) {
        // Add compensation to specialist's wallet
        const { data: specialistData, error: specialistError } = await supabase
          .from('specialists')
          .select('wallet_balance')
          .eq('id', specialistId)
          .single();

        if (specialistError) {
          console.error('Specialist error:', specialistError);
          throw new Error('Failed to fetch specialist data');
        }

        const currentBalance = specialistData?.wallet_balance || 0;
        const newBalance = Number(currentBalance) + Number(compensationAmountValue);

        // Update specialist wallet balance
        const { error: updateError } = await supabase
          .from('specialists')
          .update({ wallet_balance: newBalance })
          .eq('id', specialistId);

        if (updateError) {
          console.error('Update error:', updateError);
          throw new Error('Failed to update wallet balance');
        }

        // Record transaction
        const { error: transactionError } = await supabase
          .from('wallet_transactions')
          .insert({
            specialist_id: specialistId,
            order_id: orderId,
            transaction_type: 'compensation',
            amount: compensationAmountValue,
            balance_after: newBalance,
            description: language === 'ar' 
              ? `تعويض عدم حضور العميل (${cancellationPercentage}% من ${invoiceAmount} ر.ق)` 
              : `Customer no-show compensation (${cancellationPercentage}% of ${invoiceAmount} QAR)`
          });

        if (transactionError) {
          console.error('Transaction error:', transactionError);
          throw new Error('Failed to record transaction');
        }

        // Mark order as cancelled with reason
        const { error: orderError } = await supabase
          .from('orders')
          .update({ 
            status: 'cancelled',
            tracking_stage: 'cancelled',
            early_finish_reason: language === 'ar' ? 'عدم حضور العميل' : 'Customer no-show'
          })
          .eq('id', orderId);

        if (orderError) {
          console.error('Order error:', orderError);
          throw new Error('Failed to update order');
        }

        setIsLoading(false);
        
        // Show compensation dialog
        setCompensationAmount(compensationAmountValue);
        setShowCompensationDialog(true);

        // Auto-close dialog after 7 seconds and navigate home
        setTimeout(() => {
          setShowCompensationDialog(false);
          navigate('/specialist/home');
        }, 7000);
      } else {
        setIsLoading(false);
        throw new Error('Missing specialist ID or invalid compensation amount');
      }
    } catch (error) {
      console.error('Error processing compensation:', error);
      setIsLoading(false);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' 
          ? "حدث خطأ أثناء معالجة التعويض"
          : "Error processing compensation",
        variant: "destructive",
      });
    }
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
    
    // Check if time has expired
    const remainingTime = getRemainingTime();
    const hasTimeRemaining = remainingTime > 0;
    
    // If time hasn't expired, show reason dialog
    if (hasTimeRemaining) {
      setShowEarlyFinishReasonDialog(true);
    } else {
      // Time expired, proceed normally
      await handleRequestInvoice();
    }
  };

  const handleEarlyFinishWithReason = async () => {
    if (!earlyFinishReason) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "يرجى اختيار السبب" : "Please select a reason",
        variant: "destructive",
      });
      return;
    }

    // Special handling for customer no-show
    if (earlyFinishReason === 'customer_no_show') {
      const elapsedMinutes = Math.floor(workingTime / 60);
      if (elapsedMinutes < 15) {
        toast({
          title: language === 'ar' ? "انتبه" : "Notice",
          description: t.minimumWaitTime,
          variant: "destructive",
        });
        return;
      }

      // Fetch compensation amount from wallet policies
      try {
        const { data: policyData } = await supabase
          .from('wallet_policies')
          .select('compensation_amount')
          .eq('policy_key', 'customer_no_show')
          .eq('is_active', true)
          .single();

        if (policyData && specialistId) {
          // Add compensation to specialist's wallet
          const { data: specialistData } = await supabase
            .from('specialists')
            .select('wallet_balance')
            .eq('id', specialistId)
            .single();

          const currentBalance = specialistData?.wallet_balance || 0;
          const compensationAmount = policyData.compensation_amount;
          const newBalance = Number(currentBalance) + Number(compensationAmount);

          // Update specialist wallet balance
          await supabase
            .from('specialists')
            .update({ wallet_balance: newBalance })
            .eq('id', specialistId);

          // Record transaction
          await supabase
            .from('wallet_transactions')
            .insert({
              specialist_id: specialistId,
              order_id: orderId,
              transaction_type: 'compensation',
              amount: compensationAmount,
              balance_after: newBalance,
              description: language === 'ar' 
                ? 'تعويض عدم حضور العميل' 
                : 'Customer no-show compensation'
            });

          toast({
            title: language === 'ar' ? "تم إضافة التعويض" : "Compensation Added",
            description: t.compensationAdded,
          });
        }
      } catch (error) {
        console.error('Error processing compensation:', error);
      }
    }

    // Save early finish reason to database
    try {
      const reasonText = earlyFinishReason === 'customer_no_show'
        ? t.customerNoShow
        : earlyFinishReason === 'finished_early' 
        ? (language === 'ar' ? 'انتهيت من العمل قبل الموعد' : 'Finished work early')
        : earlyFinishReason === 'customer_stopped'
        ? (language === 'ar' ? 'العميل لا يرغب في الاستمرار' : 'Customer does not want to continue')
        : earlyFinishReason === 'emergency'
        ? (language === 'ar' ? 'ظرف طارئ' : 'Emergency')
        : (language === 'ar' ? 'سبب آخر' : 'Other reason');

      await supabase
        .from('orders')
        .update({ 
          early_finish_reason: reasonText
        })
        .eq('id', orderId);

      setShowEarlyFinishReasonDialog(false);
      
      // Proceed with finishing work
      await handleRequestInvoice();
      
      toast({
        title: language === 'ar' ? "تم التسجيل" : "Recorded",
        description: language === 'ar' ? "تم تسجيل سبب الإنهاء المبكر" : "Early finish reason recorded",
      });
    } catch (error) {
      console.error('Error saving early finish reason:', error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل في حفظ السبب" : "Failed to save reason",
        variant: "destructive",
      });
    }
  };

  const handleRequestInvoice = async () => {
    // Stop alert when requesting invoice
    stopTimeExpiredAlert();
    setTimeExpired(false);
    setWorkEndTime(new Date());
    
    // Recalculate invoice amount based on actual hours
    const actualAmount = hourlyRate * (order?.hours_count || 1);
    const finalAmount = actualAmount - discount;
    
    await supabase
      .from('orders')
      .update({ 
        final_amount: finalAmount
      })
      .eq('id', orderId);
    
    setInvoiceAmount(actualAmount);
    await updateOrderStage('invoice_requested');
    setStage('invoice_details');
    toast({
      title: "Invoice Ready",
      description: "Please review the invoice details",
    });
    // Don't navigate away - stay on page to show invoice
  };

  const handlePaymentReceived = () => {
    // فتح دايلوج تأكيد الدفع بدلاً من التحديث المباشر
    setShowPaymentConfirmDialog(true);
  };

  const handlePaymentConfirmed = async () => {
    // بعد نجاح التأكيد، الانتقال لمرحلة التقييم
    setStage('customer_rating');
    toast({
      title: t.paymentConfirmedSuccess,
      description: t.paymentRecordedSuccess,
    });
  };

  const handlePaymentNotReceived = async () => {
    if (!paymentNotReceivedReason) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار سبب عدم الدفع",
        variant: "destructive",
      });
      return;
    }

    if (paymentNotReceivedReason === 'other' && !otherPaymentReason.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى كتابة السبب",
        variant: "destructive",
      });
      return;
    }

    const reason = paymentNotReceivedReason === 'other' 
      ? otherPaymentReason 
      : paymentNotReceivedReason;

    // Update payment status and reason
    await supabase
      .from('orders')
      .update({ 
        payment_status: 'not_received',
        payment_not_received_reason: reason
      })
      .eq('id', orderId);

    setShowPaymentNotReceivedDialog(false);
    setStage('customer_rating');
    
    toast({
      title: "تم التسجيل",
      description: "تم تسجيل عدم استلام الدفع",
    });
  };

  const handleCustomerRatingSubmit = async () => {
    if (customerRating === 0) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "يرجى اختيار تقييم" : "Please select a rating",
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
        title: language === 'ar' ? "شكراً لك!" : "Thank You!",
        description: language === 'ar' ? "تم إكمال الطلب بنجاح" : "Order completed successfully",
      });
      
      // Navigate back after 1 second to show success message
      setTimeout(() => {
        navigate('/specialist-orders');
      }, 1500);
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل في إرسال التقييم" : "Failed to submit rating",
        variant: "destructive",
      });
    }
  };

  const handleStarClick = async (star: number) => {
    setCustomerRating(star);
    
    // If 5 stars, submit immediately and navigate
    if (star === 5) {
      try {
        // Update order with 5-star rating
        const { error } = await supabase
          .from('orders')
          .update({
            customer_rating: 5,
            customer_review_notes: null,
          } as any)
          .eq('id', orderId);

        if (error) throw error;

        await updateOrderStage('payment_received');
        
        toast({
          title: language === 'ar' ? "شكراً لك!" : "Thank You!",
          description: language === 'ar' ? "تم إكمال الطلب بنجاح" : "Order completed successfully",
        });
        
        // Navigate immediately for 5-star rating
        setTimeout(() => {
          navigate('/specialist-orders');
        }, 1000);
      } catch (error) {
        console.error('Error submitting rating:', error);
        toast({
          title: language === 'ar' ? "خطأ" : "Error",
          description: language === 'ar' ? "فشل في إرسال التقييم" : "Failed to submit rating",
          variant: "destructive",
        });
      }
    }
    // For ratings 1-4, just set the rating and show the notes field
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
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

      // Recalculate invoice amount
      const newAmount = hourlyRate * newHoursCount;
      setInvoiceAmount(newAmount);
      
      // Update order state
      setOrder(prev => prev ? { ...prev, hours_count: newHoursCount } : null);

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
        <p className="text-muted-foreground">{t.orderNotFound}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-32">
      <div className="max-w-2xl mx-auto space-y-6 p-4">
        {/* Back Button */}
        <Button
          onClick={() => navigate('/specialist/home')}
          variant="ghost"
          size="sm"
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 ml-2" />
          {t.back}
        </Button>

        {/* Chat with Company Button - Always Available */}
        {specialistId && order?.company_id && (
          <div className="mb-4">
            <SpecialistMessagesButton
              specialistId={specialistId}
              companyId={order.company_id}
            />
          </div>
        )}

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
                      {t.orderNumber} {order.order_number}
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
                  <p className="text-xs text-muted-foreground mb-0.5">{t.duration}</p>
                  <p className="font-semibold text-sm leading-tight">{order.hours_count} {t.hours}</p>
                </div>
              </div>
              
              {order.notes && (
                <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{t.notes}</p>
                    <TranslateButton
                      text={order.notes}
                      onTranslated={setTranslatedNotes}
                      sourceLanguage="ar"
                    />
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">
                    {translatedNotes || order.notes}
                  </p>
                </div>
              )}
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Initial Stage - New: Just order info with start button */}
        {stage === 'initial' && (
          <div className="space-y-4">
            {/* Map Location - Static Display */}
            {order?.gps_latitude && order?.gps_longitude && googleMapsApiKey && (
              <div className="w-full rounded-lg overflow-hidden shadow-lg border-2 border-border">
                <img 
                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${order.gps_latitude},${order.gps_longitude}&zoom=15&size=600x300&scale=2&markers=color:red%7C${order.gps_latitude},${order.gps_longitude}&key=${googleMapsApiKey}`}
                  alt={t.customerLocation}
                  className="w-full h-64 object-cover"
                  onError={(e) => {
                    console.error('Error loading map image');
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="bg-muted p-3 text-center">
                  <p className="text-sm font-semibold flex items-center justify-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>{t.customerLocation}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Fixed Start Moving Button at Bottom */}
        {stage === 'initial' && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
            <div className="max-w-2xl mx-auto">
              <Button 
                onClick={handleStartMoving} 
                className="w-full h-16 text-xl font-black shadow-xl hover:shadow-2xl transition-all bg-gradient-to-r from-green-500 to-green-600 hover:scale-[1.02]"
                size="lg"
              >
                <ArrowRight className="h-7 w-7 ml-2" />
                <span>{t.startMovingToWork}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Moving Stage - Compact */}
        {stage === 'moving' && (
          <div className="space-y-3 pb-40">
            {/* Guidance Text Above Button */}
            <div className="text-center px-4 py-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {t.customerWaiting}
              </p>
            </div>

            {/* Open Map Button - Primary Action */}
            <Button
              onClick={openMaps}
              className="w-full h-20 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-2xl hover:shadow-3xl transition-all active:scale-[0.98] rounded-xl relative overflow-hidden group"
            >
              {/* Animated Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[slide-in-right_2s_ease-in-out_infinite]" />
              
              <div className="flex items-center justify-center gap-4 relative z-10">
                <div className="flex items-center justify-center w-14 h-14 bg-white/20 rounded-full backdrop-blur-sm">
                  <Navigation className="h-7 w-7" />
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-white">
                    {t.openLocationMap}
                  </p>
                  <p className="text-xs font-medium text-blue-50 mt-1">
                    {t.clickToNavigate}
                  </p>
                </div>
              </div>
            </Button>

            {/* Map Location - Static Display */}
            {order?.gps_latitude && order?.gps_longitude && googleMapsApiKey && (
              <div className="w-full rounded-lg overflow-hidden shadow-lg border-2 border-border">
                <img 
                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${order.gps_latitude},${order.gps_longitude}&zoom=15&size=600x300&scale=2&markers=color:red%7C${order.gps_latitude},${order.gps_longitude}&key=${googleMapsApiKey}`}
                  alt={t.customerLocation}
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    console.error('Error loading map image');
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="bg-muted p-2 text-center">
                  <p className="text-xs font-medium flex items-center justify-center gap-2">
                    <MapPin className="h-3 w-3 text-primary" />
                    <span>{t.customerLocation}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Fixed Arrival Button */}
            <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur-sm border-t z-50 space-y-2">
              {/* Timer Warning - Show when button is disabled */}
              {movingTimer > 0 && (
                <Card className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50 border-2 border-amber-300 dark:border-amber-700 shadow-md">
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-pulse" />
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                        {t.buttonWillActivateIn}
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
                <span>{t.iHaveArrivedAtLocation}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Arrived Stage - Simplified */}
        {stage === 'arrived' && (
          <div className="pb-24">
            <Card className="overflow-hidden border-2 border-green-300 dark:border-green-700 shadow-2xl">
              {/* Stage Header - Compact */}
              <div className="bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 py-3 px-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="p-2 rounded-full bg-white/20 backdrop-blur-sm">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">{t.arrivedAtLocation}</h3>
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
                    <span className="text-xs font-medium text-green-700">{t.callCustomer}</span>
                  </div>
                </div>

                {/* Building Info - Compact */}
                {order.building_info && (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          <p className="text-xs text-muted-foreground">{t.buildingInfo}</p>
                        </div>
                        <TranslateButton
                          text={order.building_info}
                          onTranslated={setTranslatedBuildingInfo}
                          sourceLanguage="ar"
                        />
                      </div>
                      <p className="text-sm font-medium">
                        {translatedBuildingInfo || order.building_info}
                      </p>
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
                
                {/* Auto-Start Warning */}
                <div className="bg-blue-50 border-2 border-blue-300 p-3 rounded-lg">
                  <div className="flex items-center gap-2 justify-center text-center">
                    <div className="p-1.5 rounded-full bg-blue-100">
                      <Clock className="h-4 w-4 text-blue-600" />
                    </div>
                    <p className="text-xs font-medium text-blue-800">
                      {t.autoStartWorkWarning}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Fixed Start Work Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t z-50 space-y-2">
              <Button
                onClick={handleStartWork}
                disabled={arrivedTimer > 0}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                size="lg"
              >
                <Play className="h-5 w-5 ml-2" />
                <span>{t.startWorkClock}</span>
              </Button>
              
              {/* Customer Not Present Button */}
              <Button
                onClick={handleCustomerNotPresent}
                disabled={arrivedTimer > 0}
                variant="outline"
                className="w-full h-12 text-base font-semibold border-2 border-amber-500 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <AlertCircle className="h-5 w-5 ml-2" />
                <span>{language === 'ar' ? 'العميل غير موجود - بدء الانتظار' : 'Customer Not Present - Start Waiting'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Waiting for Customer Stage */}
        {stage === 'waiting_for_customer' && (
          <div className="pb-24">
            <Card className="overflow-hidden border-2 border-amber-400 dark:border-amber-600 shadow-2xl">
              {/* Stage Header */}
              <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 py-4 px-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm animate-pulse">
                    <Clock className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white text-center">
                    {language === 'ar' ? 'في انتظار العميل' : 'Waiting for Customer'}
                  </h3>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Timer Display */}
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'الوقت المتبقي' : 'Time Remaining'}
                  </p>
                  <div className={`text-6xl font-bold tabular-nums ${
                    waitingTimer <= 60 ? 'text-red-600 animate-pulse' : 
                    waitingTimer <= 300 ? 'text-amber-600' : 'text-primary'
                  }`}>
                    {Math.floor(waitingTimer / 60).toString().padStart(2, '0')}:
                    {(waitingTimer % 60).toString().padStart(2, '0')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'من 15:00 دقيقة' : 'of 15:00 minutes'}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      waitingTimer <= 60 ? 'bg-red-600' :
                      waitingTimer <= 300 ? 'bg-amber-500' : 'bg-primary'
                    }`}
                    style={{ width: `${((15 * 60 - waitingTimer) / (15 * 60)) * 100}%` }}
                  />
                </div>

                {/* Info Message */}
                <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
                    {language === 'ar' 
                      ? 'يتم احتساب مدة الانتظار وفقاً لسياسة عدم حضور العميل. بعد انتهاء 15 دقيقة، يمكنك تأكيد عدم الحضور واستلام التعويض.'
                      : 'Waiting time is being counted according to customer no-show policy. After 15 minutes, you can confirm no-show and receive compensation.'}
                  </AlertDescription>
                </Alert>

                {/* Time Expired Alert */}
                {timeExpired && waitingTimer === 0 && (
                  <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-900/50 border-2 border-green-400 p-5 animate-pulse">
                    <div className="text-center space-y-3">
                      <div className="text-5xl">✅</div>
                      <h4 className="text-lg font-bold text-green-800 dark:text-green-200">
                        {language === 'ar' ? 'انتهى وقت الانتظار' : 'Waiting Time Completed'}
                      </h4>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {language === 'ar' 
                          ? 'يمكنك الآن تأكيد عدم حضور العميل واستلام التعويض'
                          : 'You can now confirm customer no-show and receive compensation'}
                      </p>
                    </div>
                  </Card>
                )}

                {/* Contact Customer Option */}
                <div className="flex justify-center">
                  <Button 
                    onClick={() => window.location.href = `tel:${order?.customer?.whatsapp_number || ''}`}
                    size="lg"
                    variant="outline"
                    className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
                  >
                    <Phone className="h-5 w-5 ml-2" />
                    <span>{language === 'ar' ? 'الاتصال بالعميل' : 'Call Customer'}</span>
                  </Button>
                </div>
              </div>
            </Card>

            {/* Fixed Action Buttons */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t z-50 space-y-2">
              {/* Start Work Button - If customer arrived */}
              <Button
                onClick={handleCancelWaiting}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg"
                size="lg"
              >
                <CheckCircle className="h-5 w-5 ml-2" />
                <span>{language === 'ar' ? 'حضر العميل - بدء العمل' : 'Customer Arrived - Start Work'}</span>
              </Button>
              
              {/* Confirm No-Show Button - Only after 15 minutes */}
              <Button
                onClick={handleConfirmNoShow}
                disabled={waitingTimer > 0}
                variant="destructive"
                className="w-full h-12 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="h-5 w-5 ml-2" />
                <span>{language === 'ar' ? 'تأكيد عدم الحضور' : 'Confirm No-Show'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Working Stage */}
        {stage === 'working' && (
          <>
            <Card className="p-6 space-y-6 pb-32">
              <h3 className="text-xl font-bold text-center">{t.workInProgress}</h3>
              
              {/* Work Timer - Countdown */}
              <div className="text-center space-y-2">
                <div className={`text-4xl font-bold tabular-nums ${
                  timeExpired ? 'text-red-600 animate-pulse' : 'text-primary'
                }`}>
                  {formatTime(getRemainingTime())}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t.remainingTime} {formatTime(totalWorkSeconds)}
                </div>
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
                    <h4 className="text-lg font-bold text-red-800">{t.workTimeExpiredTitle}</h4>
                    <p className="text-sm text-red-700">
                      {t.workTimeExpiredMessage}
                    </p>
                  </div>
                </Card>
              )}

              {/* Emergency Actions - Collapsible Section */}
              <div className="space-y-3">
                <Collapsible className="w-full border-t pt-4 mt-4">
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                    >
                      <AlertTriangle className="ml-2 h-3 w-3" />
                      {t.emergencyOnly}
                      <ChevronDown className="mr-2 h-3 w-3" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-3">
                    <p className="text-xs text-center text-muted-foreground mb-3 px-4">
                      {t.emergencyWarning}
                    </p>
                    
                    <Button
                      onClick={handleEmergency}
                      variant="outline"
                      size="sm"
                      className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                    >
                      <AlertTriangle className="ml-2 h-3.5 w-3.5" />
                      {t.emergencyContact}
                    </Button>
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
                        {t.extendWorkTime}
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

                {/* Finish Work Button - Slide to Complete */}
                <SlideToComplete
                  onComplete={() => {
                    stopTimeExpiredAlert();
                    setTimeExpired(false);
                    confirmEarlyFinish();
                  }}
                  text={t.finishWorkNow}
                  className="w-full"
                />
              </div>
            </div>
          </>
        )}

        {/* Early Finish Reason Dialog */}
        <Dialog open={showEarlyFinishReasonDialog} onOpenChange={setShowEarlyFinishReasonDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                {language === 'ar' ? 'الوقت لم ينتهي بعد' : 'Time Not Expired Yet'}
              </DialogTitle>
              <DialogDescription>
                {language === 'ar' 
                  ? 'لماذا تريد إنهاء العمل قبل الموعد المحدد؟' 
                  : 'Why do you want to finish work before scheduled time?'}
              </DialogDescription>
            </DialogHeader>
            
            <RadioGroup value={earlyFinishReason} onValueChange={setEarlyFinishReason}>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="customer_no_show" id="customer_no_show" />
                <Label htmlFor="customer_no_show" className="cursor-pointer">
                  {t.customerNoShow}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="finished_early" id="finished_early" />
                <Label htmlFor="finished_early" className="cursor-pointer">
                  {language === 'ar' ? 'انتهيت من العمل قبل الموعد' : 'Finished work early'}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="customer_stopped" id="customer_stopped" />
                <Label htmlFor="customer_stopped" className="cursor-pointer">
                  {language === 'ar' ? 'العميل لا يرغب في الاستمرار' : 'Customer does not want to continue'}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="emergency" id="emergency" />
                <Label htmlFor="emergency" className="cursor-pointer">
                  {language === 'ar' ? 'ظرف طارئ' : 'Emergency'}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="other" id="other_early" />
                <Label htmlFor="other_early" className="cursor-pointer">
                  {language === 'ar' ? 'سبب آخر' : 'Other reason'}
                </Label>
              </div>
            </RadioGroup>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={() => setShowEarlyFinishReasonDialog(false)}
                variant="outline"
                className="flex-1"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleEarlyFinishWithReason}
                className="flex-1"
              >
                {language === 'ar' ? 'تأكيد الإنهاء' : 'Confirm Finish'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
              <h3 className="text-lg font-bold text-white">{t.invoiceDetails}</h3>
              {order?.company && (
                <p className="text-sm text-white/90 mt-1">{order.company.name}</p>
              )}
            </div>

            {/* Invoice Content - Centered and Compact */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              <div className="w-full max-w-md space-y-4">
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-5 rounded-xl space-y-3 shadow-lg border-2 border-slate-200 dark:border-slate-700">
                  
                  {/* Total Amount - Prominent (Always Visible) */}
                  <div className="pb-4 mb-4 border-b-2 border-slate-400 dark:border-slate-500">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xl">{t.totalAmount}</span>
                      <span className="font-black text-green-600 text-3xl">
                        {(invoiceAmount - discount).toFixed(2)} <span className="text-xl">ر.ق</span>
                      </span>
                    </div>
                  </div>

                  {/* More Details Button */}
                  <Collapsible open={isInvoiceDetailsOpen} onOpenChange={setIsInvoiceDetailsOpen}>
                    <CollapsibleTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full mb-3 transition-all duration-300 hover:bg-accent hover:scale-[1.02]"
                      >
                        <ChevronDown className={`ml-2 h-4 w-4 transition-transform duration-300 ${isInvoiceDetailsOpen ? 'rotate-180' : ''}`} />
                        {language === 'ar' ? 'تفاصيل أكثر' : 'More Details'}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                      {/* Order Information */}
                      <div className="space-y-2 pb-3 border-b border-slate-300 dark:border-slate-600">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">{t.orderNumber}</span>
                          <span className="font-semibold text-base">{order.order_number}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">{t.bookingDate}</span>
                          <span className="font-semibold text-sm">{order.booking_date ? new Date(order.booking_date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '-'}</span>
                        </div>
                        {arrivedStartTime && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t.arrivalTime}</span>
                            <span className="font-semibold text-sm">{arrivedStartTime.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                        {workStartTime && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t.workStartTime}</span>
                            <span className="font-semibold text-sm">{workStartTime.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                        {workEndTime && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t.workEndTime}</span>
                            <span className="font-semibold text-sm">{workEndTime.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Service Type */}
                      <div className="flex justify-between items-center pb-3 border-b border-slate-300 dark:border-slate-600">
                        <span className="text-sm text-muted-foreground">{t.serviceType}</span>
                        <span className="font-bold text-base">{order.service_type}</span>
                      </div>
                      
                      {/* Hours Summary */}
                      <div className="flex justify-between items-center pb-3 border-b border-slate-300 dark:border-slate-600">
                        <span className="text-sm text-muted-foreground">{t.numberOfHours}</span>
                        <span className="font-bold text-lg text-primary">{order.hours_count} {t.hourLabel}</span>
                      </div>
                      
                      {/* Discount if any */}
                      {discount > 0 && (
                        <div className="flex justify-between items-center text-green-600 dark:text-green-400 text-base bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                          <span className="font-medium">{t.discount}</span>
                          <span className="font-bold text-lg">-{discount.toFixed(2)} ر.ق</span>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
                
                <p className="text-sm text-center text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                  {t.pleaseCollectAmount}
                </p>
              </div>
            </div>

            {/* Fixed Button at Bottom - Always Visible */}
            <div className="p-4 border-t-2 bg-background shadow-[0_-4px_12px_rgba(0,0,0,0.1)] sticky bottom-0 space-y-2">
              <Button
                onClick={handlePaymentReceived}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
                size="lg"
              >
                <CheckCircle className="ml-2 h-5 w-5" />
                تأكيد استلام الدفع
              </Button>
              
              <Dialog open={showPaymentNotReceivedDialog} onOpenChange={setShowPaymentNotReceivedDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-12 text-base border-red-500 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="ml-2 h-5 w-5" />
                    {t.paymentNotReceived}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t.paymentNotReceivedReason}</DialogTitle>
                    <DialogDescription>
                      {t.selectPaymentNotReceivedReason}
                    </DialogDescription>
                  </DialogHeader>
                  <RadioGroup value={paymentNotReceivedReason} onValueChange={setPaymentNotReceivedReason}>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="customer_refused" id="customer_refused" />
                      <Label htmlFor="customer_refused">{t.customerRefusedPayment}</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="no_cash" id="no_cash" />
                      <Label htmlFor="no_cash">{t.customerHasNoCash}</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="dispute" id="dispute" />
                      <Label htmlFor="dispute">{t.disputeOverAmount}</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="will_pay_later" id="will_pay_later" />
                      <Label htmlFor="will_pay_later">{t.promisedToPayLater}</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="other" id="other" />
                      <Label htmlFor="other">{t.otherReason}</Label>
                    </div>
                  </RadioGroup>
                  
                  {paymentNotReceivedReason === 'other' && (
                    <div className="space-y-2">
                      <Label htmlFor="other_payment_reason">{t.writeReason}</Label>
                      <Textarea
                        id="other_payment_reason"
                        value={otherPaymentReason}
                        onChange={(e) => setOtherPaymentReason(e.target.value)}
                        placeholder={t.writePaymentReasonPlaceholder}
                        rows={4}
                      />
                    </div>
                  )}
                  
                  <Button onClick={handlePaymentNotReceived} className="w-full">
                    {t.confirm}
                  </Button>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}

        {/* Payment Confirmation Dialog */}
        {order && (
          <PaymentConfirmationDialog
            open={showPaymentConfirmDialog}
            onOpenChange={setShowPaymentConfirmDialog}
            orderId={orderId!}
            invoiceAmount={invoiceAmount}
            customerId={order.customer_id || ''}
            specialistId={specialistId}
            currency="ر.ق"
            onSuccess={handlePaymentConfirmed}
          />
        )}

        {/* Customer Rating Stage */}
        {stage === 'customer_rating' && (
          <Card className="p-6 space-y-6">
            <h3 className="text-xl font-bold text-center">{t.rateCustomer}</h3>
            
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  {t.experienceQuestion}
                </p>
                
                {/* Star Rating */}
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleStarClick(star)}
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
                
                {customerRating > 0 && customerRating < 5 && (
                  <p className="text-sm font-semibold">
                    {customerRating === 4 && t.goodCustomer}
                    {customerRating === 3 && t.averageCustomer}
                    {customerRating === 2 && t.belowAverage}
                    {customerRating === 1 && t.poorExperience}
                  </p>
                )}
              </div>
              
              {/* Review Notes - Only show for ratings 1-4 */}
              {customerRating > 0 && customerRating < 5 && (
                <div className="space-y-2">
                  <Label htmlFor="customer_notes">
                    {t.additionalNotesOptional}
                  </Label>
                  <Textarea
                    id="customer_notes"
                    value={customerReviewNotes}
                    onChange={(e) => setCustomerReviewNotes(e.target.value)}
                    placeholder={language === 'ar' 
                      ? 'شارك تجربتك مع هذا العميل...' 
                      : 'Share your experience with this customer...'}
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' 
                      ? 'سيساعدنا هذا على تحسين جودة الخدمة' 
                      : 'This will help us improve service quality'}
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button - Only show for ratings 1-4 */}
            {customerRating > 0 && customerRating < 5 && (
              <Button
                onClick={handleCustomerRatingSubmit}
                className="w-full"
                size="lg"
              >
                <CheckCircle className="ml-2 h-5 w-5" />
                {t.submitRating}
              </Button>
            )}
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

        {/* Compensation Dialog */}
        <Dialog open={showCompensationDialog} onOpenChange={setShowCompensationDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 justify-center text-green-600">
                <CheckCircle className="h-6 w-6" />
                {language === 'ar' ? 'تم إضافة التعويض' : 'Compensation Added'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Success Icon */}
              <div className="flex justify-center">
                <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-6">
                  <div className="text-6xl">💰</div>
                </div>
              </div>

              {/* Compensation Details */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 p-6 rounded-xl space-y-4 border-2 border-green-200 dark:border-green-800">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'تم الغاء الطلب بسبب:' : 'Order cancelled due to:'}
                  </p>
                  <p className="font-bold text-lg">
                    {language === 'ar' ? 'عدم حضور العميل' : 'Customer No-Show'}
                  </p>
                </div>

                <div className="border-t-2 border-green-300 dark:border-green-700 pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">
                      {language === 'ar' ? 'مبلغ التعويض:' : 'Compensation Amount:'}
                    </span>
                    <span className="text-3xl font-black text-green-600">
                      {compensationAmount} <span className="text-lg">ر.ق</span>
                    </span>
                  </div>
                  <p className="text-xs text-center text-muted-foreground bg-white dark:bg-slate-900 p-2 rounded-lg">
                    {language === 'ar' 
                      ? 'تم إضافة المبلغ إلى محفظتك' 
                      : 'Amount has been added to your wallet'}
                  </p>
                </div>
              </div>

              {/* Auto-close notice */}
              <p className="text-xs text-center text-muted-foreground animate-pulse">
                {language === 'ar' 
                  ? 'سيتم الإغلاق تلقائياً بعد 7 ثوان...' 
                  : 'Auto-closing in 7 seconds...'}
              </p>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
