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

type Stage = 'moving' | 'arrived' | 'working' | 'completed' | 'cancelled' | 'invoice_requested' | 'invoice_details' | 'customer_rating' | 'payment_received';

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
  const [stage, setStage] = useState<Stage>('moving');
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
        // Start with 'moving' stage in UI only (not in DB yet)
        setStage('moving');
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

  const updateOrderStage = async (newStage: Stage) => {
    if (!orderId) return;

    try {
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Order Info Card */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">{order.customer?.name}</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">Service:</span> {order.service_type}</p>
            <p><span className="font-semibold">Area:</span> {order.customer?.area}</p>
            <p><span className="font-semibold">Hours:</span> {order.hours_count}</p>
          </div>
        </Card>

        {/* Moving Stage */}
        {stage === 'moving' && (
          <Card className="p-6 space-y-6">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
                <Navigation className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <h3 className="text-2xl font-bold">Moving to Customer</h3>
              <p className="text-sm text-muted-foreground mt-1">On my way to the location</p>
            </div>

            {/* Navigation Button - Primary Action */}
            <Button 
              onClick={openMaps} 
              className="w-full h-14 text-lg font-semibold shadow-lg"
              size="lg"
            >
              <Navigation className="ml-2 h-6 w-6" />
              Navigate to Customer Location
            </Button>

            {/* Share Location Button */}
            <Button 
              onClick={shareLocation} 
              variant="outline" 
              className="w-full h-12"
              size="lg"
            >
              <Share2 className="ml-2 h-5 w-5" />
              Share My Location with Customer
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  When you arrive
                </span>
              </div>
            </div>

            {/* Arrival Confirmation - Protected by Timer */}
            <div className="space-y-3">
              {movingTimer > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-amber-700 dark:text-amber-300">
                      Please wait <span className="font-bold">{movingTimer}s</span> before confirming arrival
                    </p>
                  </div>
                </div>
              )}
              
              <Button
                onClick={handleArrived}
                disabled={movingTimer > 0}
                className="w-full h-14 text-lg font-semibold"
                size="lg"
                variant={movingTimer > 0 ? "secondary" : "default"}
              >
                <CheckCircle className="ml-2 h-6 w-6" />
                I Have Arrived at Location
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                You will be able to contact the customer after confirming arrival
              </p>
            </div>
          </Card>
        )}

        {/* Arrived Stage */}
        {stage === 'arrived' && (
          <Card className="p-6 space-y-6">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/30 mb-3">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold">Arrived at Location</h3>
              <p className="text-sm text-muted-foreground mt-1">Contact customer if needed</p>
            </div>

            {/* Building Info */}
            {order.building_info && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">Building Information:</p>
                    <p className="text-sm text-foreground">{order.building_info}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Contact - Now Visible */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/10 border-2 border-green-300 dark:border-green-700 p-5 rounded-xl space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide">Customer Contact</p>
                  <p className="text-xl font-bold text-foreground mt-0.5 font-mono">
                    {order.customer?.whatsapp_number}
                  </p>
                </div>
              </div>
              
              <Button 
                onClick={() => openWhatsApp(order.customer?.whatsapp_number || '')}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold"
                size="lg"
              >
                <Phone className="ml-2 h-5 w-5" />
                Call Customer via WhatsApp
              </Button>
              
              <p className="text-xs text-center text-green-700 dark:text-green-300">
                Notify customer about your arrival or ask for directions
              </p>
            </div>

            {/* View Map Button */}
            <Button 
              onClick={openMaps} 
              variant="outline" 
              className="w-full h-11"
            >
              <MapPin className="ml-2 h-5 w-5" />
              View Location on Map
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Ready to start work?
                </span>
              </div>
            </div>

            {/* Start Work Button */}
            <div className="space-y-3">
              {arrivedTimer > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-amber-700 dark:text-amber-300">
                      Please wait <span className="font-bold">{arrivedTimer}s</span> before starting work
                    </p>
                  </div>
                </div>
              )}
              
              <Button
                onClick={handleStartWork}
                disabled={arrivedTimer > 0}
                className="w-full h-14 text-lg font-semibold"
                size="lg"
                variant={arrivedTimer > 0 ? "secondary" : "default"}
              >
                <Play className="ml-2 h-6 w-6" />
                Start Work Timer
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                Work timer will start automatically after 5 minutes
              </p>
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

        {/* Back Button - Hide when payment is received */}
        {stage !== 'payment_received' && (
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
