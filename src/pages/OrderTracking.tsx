import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Navigation, Share2, CheckCircle, Play, Pause, AlertTriangle, Phone, XCircle, FileText, Clock, ArrowRight, Star } from "lucide-react";
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
import { openWhatsApp, openMaps as openMapsHelper } from "@/lib/externalLinks";

type Stage = 'initial' | 'moving' | 'arrived' | 'working' | 'completed' | 'cancelled' | 'invoice_requested' | 'invoice_details' | 'customer_rating' | 'payment_received';

interface Order {
  id: string;
  service_type: string;
  notes: string | null;
  booking_date: string | null;
  hours_count: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  building_info: string | null;
  customer: {
    name: string;
    whatsapp_number: string;
    area: string | null;
    budget: string | null;
    budget_type: string | null;
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
  const [cancelReason, setCancelReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showEarlyFinishDialog, setShowEarlyFinishDialog] = useState(false);
  const [arrivedStartTime, setArrivedStartTime] = useState<Date | null>(null);
  const [customerRating, setCustomerRating] = useState(0);
  const [customerReviewNotes, setCustomerReviewNotes] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

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
  }, [orderId]);

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

  // Timer for working stage (count up)
  useEffect(() => {
    if (stage === 'working' && !isPaused) {
      const timer = setInterval(() => {
        setWorkingTime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [stage, isPaused]);

  // Calculate total work seconds from hours_count
  useEffect(() => {
    if (order?.hours_count) {
      const hours = parseFloat(order.hours_count);
      setTotalWorkSeconds(hours * 3600); // Convert hours to seconds
    }
  }, [order]);

  const fetchOrder = async () => {
    if (!orderId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          service_type,
          notes,
          booking_date,
          hours_count,
          gps_latitude,
          gps_longitude,
          building_info,
          customer:customers (
            name,
            whatsapp_number,
            area,
            budget,
            budget_type
          ),
          order_specialists (
            quoted_price,
            is_accepted
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data as Order);
      
      // Calculate invoice amount from accepted quote
      if (data?.order_specialists) {
        const acceptedQuote = data.order_specialists.find((os: any) => os.is_accepted === true);
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
        title: "Error",
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
    if (navigator.share && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await navigator.share({
              title: 'My Current Location',
              text: `My location: https://www.google.com/maps/search/?api=1&query=${position.coords.latitude},${position.coords.longitude}`,
            });
          } catch (error) {
            console.error('Error sharing:', error);
          }
        },
        () => {
          toast({
            title: "Error",
            description: "Failed to get your location",
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: "Error",
        description: "Sharing not available on this device",
        variant: "destructive",
      });
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Order not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-6">
      <div className="max-w-2xl mx-auto space-y-6 p-4">
        {/* Order Info Card - Mobile Optimized */}
        <Card className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border border-slate-200 dark:border-slate-700 shadow-md">
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
          
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-background/50 p-2.5 rounded-lg">
              <p className="text-xs text-muted-foreground mb-0.5">الخدمة</p>
              <p className="font-semibold text-sm leading-tight">{order.service_type}</p>
            </div>
            <div className="bg-background/50 p-2.5 rounded-lg">
              <p className="text-xs text-muted-foreground mb-0.5">المدة</p>
              <p className="font-semibold text-sm leading-tight">{order.hours_count} ساعات</p>
            </div>
          </div>
          
          {order.notes && (
            <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">ملاحظات</p>
              <p className="text-xs text-foreground leading-relaxed">{order.notes}</p>
            </div>
          )}
        </Card>

        {/* Initial Stage - New: Just order info with start button */}
        {stage === 'initial' && (
          <div className="space-y-4">
            {/* Map Location Button */}
            <Button 
              onClick={openMaps} 
              className="w-full h-14 text-lg font-bold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-blue-500 to-blue-600"
              size="lg"
            >
              <MapPin className="h-6 w-6 ml-2" />
              <span>عرض موقع العميل على الخريطة</span>
            </Button>

            {/* Start Moving Button */}
            <Button 
              onClick={handleStartMoving} 
              className="w-full h-16 text-xl font-black shadow-xl hover:shadow-2xl transition-all bg-gradient-to-r from-green-500 to-green-600 hover:scale-[1.02]"
              size="lg"
            >
              <ArrowRight className="h-7 w-7 ml-2" />
              <span>ابدأ التحرك للعمل</span>
            </Button>

            {/* Back Button */}
            <Button 
              onClick={() => navigate(-1)} 
              variant="outline"
              className="w-full h-12 text-base font-semibold"
            >
              رجوع
            </Button>
          </div>
        )}

        {/* Moving Stage - Compact */}
        {stage === 'moving' && (
          <div className="space-y-4 pb-24">
            {/* Compact Status Card */}
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
              <div className="p-4 text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-full">
                  <Navigation className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-bold">في الطريق إلى العميل</h2>
                <p className="text-sm text-blue-50">العميل بانتظارك كن هناك في الوقت</p>
              </div>
            </Card>

            {/* Compact Navigation Icons */}
            <div className="flex gap-3 justify-center">
              <Button
                size="icon"
                className="h-14 w-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg"
                onClick={openMaps}
                title="موقع العميل"
              >
                <MapPin className="h-6 w-6" />
              </Button>

              <Button
                size="icon"
                variant="outline"
                className="h-14 w-14 rounded-full shadow-lg"
                onClick={shareLocation}
                title="شارك الموقع"
              >
                <Share2 className="h-6 w-6" />
              </Button>
            </div>

            {/* Fixed Arrival Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t z-50">
              <Button
                onClick={handleArrived}
                disabled={movingTimer > 0}
                className={`w-full h-14 text-lg font-bold shadow-lg transition-all ${
                  movingTimer > 0 
                    ? 'opacity-50 cursor-not-allowed bg-gray-400' 
                    : 'bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:shadow-xl'
                }`}
                size="lg"
              >
                <CheckCircle className="h-6 w-6 ml-2" />
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
                <h3 className="text-xl font-bold text-white">وصلت إلى الموقع</h3>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Customer Contact - Simplified */}
              <div className="bg-green-50 dark:from-green-950/40 border border-green-200 dark:border-green-700 p-3 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Phone className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-xs text-green-700 dark:text-green-300">رقم العميل</p>
                    <p className="text-sm font-semibold text-green-900 dark:text-green-100 font-mono">
                      {order.customer?.whatsapp_number}
                    </p>
                  </div>
                </div>
                
                <Button 
                  onClick={() => openWhatsApp(order.customer?.whatsapp_number || '')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Phone className="h-4 w-4 ml-2" />
                  <span>الاتصال بالعميل عبر واتساب</span>
                </Button>
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
              {arrivedTimer > 0 ? (
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
              ) : (
                <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2 justify-center">
                    <Play className="h-4 w-4 text-purple-600" />
                    <p className="text-sm font-medium text-purple-700">
                      يمكنك الآن بدء ساعة العمل
                    </p>
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
          <Card className="p-6 space-y-6">
            <h3 className="text-xl font-bold text-center">Working</h3>
            
            {/* Work Timer */}
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-primary">
                {formatTime(workingTime)}
              </div>
              <div className="text-sm text-muted-foreground">
                of {formatTime(totalWorkSeconds)}
              </div>
              {workingTime >= totalWorkSeconds && (
                <div className="text-sm font-semibold text-green-600">
                  ⏰ Time Limit Reached
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${Math.min((workingTime / totalWorkSeconds) * 100, 100)}%` }}
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={togglePause}
                variant="outline"
                className="w-full"
                size="lg"
              >
                {isPaused ? (
                  <>
                    <Play className="ml-2 h-5 w-5" />
                    Resume Work
                  </>
                ) : (
                  <>
                    <Pause className="ml-2 h-5 w-5" />
                    Pause
                  </>
                )}
              </Button>

              {/* Early Finish Button - only show if not at time limit yet */}
              {workingTime < totalWorkSeconds && (
                <Dialog open={showEarlyFinishDialog} onOpenChange={setShowEarlyFinishDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary hover:text-white">
                      <CheckCircle className="ml-2 h-5 w-5" />
                      Finish Work Early
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Finish Work Early?</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to finish the work before the scheduled time?
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <p className="text-sm text-muted-foreground">
                        By confirming, you will mark the work as completed and request the invoice.
                      </p>
                      <div className="flex gap-3">
                        <Button 
                          onClick={() => setShowEarlyFinishDialog(false)} 
                          variant="outline" 
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={confirmEarlyFinish} 
                          className="flex-1"
                        >
                          Yes, I'm Sure
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              <Button
                onClick={handleEmergency}
                variant="destructive"
                className="w-full"
              >
                <AlertTriangle className="ml-2 h-5 w-5" />
                Emergency - Call Company
              </Button>

              <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive hover:text-white">
                    <XCircle className="ml-2 h-5 w-5" />
                    Cancel Work
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

              {workingTime >= totalWorkSeconds && (
                <>
                  {stage === 'working' && (
                    <Button
                      onClick={handleRequestInvoice}
                      className="w-full"
                      size="lg"
                    >
                      <FileText className="ml-2 h-5 w-5" />
                      Request Invoice
                    </Button>
                  )}
                </>
              )}
            </div>
          </Card>
        )}

        {/* Invoice Details Stage */}
        {stage === 'invoice_details' && (
          <Card className="p-6 space-y-6">
            <h3 className="text-xl font-bold text-center">Invoice Details</h3>
            
            <div className="space-y-4">
              <div className="text-center text-6xl mb-4">💰</div>
              
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Service Type:</span>
                  <span className="font-semibold">{order.service_type}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Hours:</span>
                  <span className="font-semibold">{order.hours_count}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Customer Budget:</span>
                  <span className="font-semibold">
                    {order.customer?.budget || 'Not specified'} 
                    {order.customer?.budget_type && ` (${order.customer.budget_type})`}
                  </span>
                </div>
                
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Quoted Price:</span>
                    <span className="font-semibold">{invoiceAmount} KWD</span>
                  </div>
                  
                  {discount > 0 && (
                    <div className="flex justify-between items-center text-green-600 mt-2">
                      <span>Discount:</span>
                      <span className="font-semibold">-{discount} KWD</span>
                    </div>
                  )}
                </div>
                
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-bold">Total Amount:</span>
                    <span className="font-bold text-primary text-2xl">
                      {(invoiceAmount - discount).toFixed(2)} KWD
                    </span>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-center text-muted-foreground">
                Please collect this amount from the customer
              </p>
            </div>

            <Button
              onClick={handlePaymentReceived}
              className="w-full"
              size="lg"
            >
              <CheckCircle className="ml-2 h-5 w-5" />
              Confirm Payment Received
            </Button>
          </Card>
        )}

        {/* Customer Rating Stage */}
        {stage === 'customer_rating' && (
          <Card className="p-6 space-y-6">
            <h3 className="text-xl font-bold text-center">Rate the Customer</h3>
            
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

        {/* Back Button - Hide when payment is received or in initial stage */}
        {stage !== 'payment_received' && stage !== 'initial' && (
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="w-full"
          >
            Back
          </Button>
        )}
      </div>
    </div>
  );
}
