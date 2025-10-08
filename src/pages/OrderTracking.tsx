import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Navigation, Share2, CheckCircle, Play, Pause, AlertTriangle, Phone, XCircle, FileText, Clock, ArrowRight } from "lucide-react";
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

type Stage = 'moving' | 'arrived' | 'working' | 'completed' | 'cancelled' | 'invoice_requested';

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
  } | null;
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
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!orderId) return;

    // Fetch order data
    fetchOrder();

    // Set initial stage to moving when specialist starts tracking
    const initializeTracking = async () => {
      await updateOrderStage('moving');
    };

    initializeTracking();
  }, [orderId]);

  // Timer for moving stage (60 seconds countdown)
  useEffect(() => {
    if (stage === 'moving' && movingTimer > 0) {
      const timer = setInterval(() => {
        setMovingTimer(prev => prev - 1);
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
            area
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data);
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

  const openMaps = () => {
    if (!order?.gps_latitude || !order?.gps_longitude) {
      toast({
        title: "Error",
        description: "Customer location not available",
        variant: "destructive",
      });
      return;
    }

    // Open maps with coordinates - will open in default map app on phone
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${order.gps_latitude},${order.gps_longitude}`;
    window.open(mapsUrl, '_blank');
  };

  const updateOrderStage = async (newStage: Stage) => {
    if (!orderId) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          tracking_stage: newStage,
          status: newStage === 'moving' || newStage === 'arrived' ? 'in_progress' : 
                  newStage === 'completed' ? 'completed' : 'in_progress'
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
    await updateOrderStage('completed');
    setShowEarlyFinishDialog(false);
    toast({
      title: "Work Completed",
      description: "Work has been marked as completed early",
    });
    // Show invoice request immediately
    handleRequestInvoice();
  };

  const handleRequestInvoice = async () => {
    await updateOrderStage('invoice_requested');
    toast({
      title: "Invoice Requested",
      description: "Invoice request has been sent to management",
    });
    navigate(-1);
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
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold text-center mb-6">Moving to Customer</h3>
            
            <Button onClick={openMaps} className="w-full" size="lg">
              <Navigation className="ml-2 h-5 w-5" />
              Click to Navigate to Customer
            </Button>

            <Button onClick={shareLocation} variant="outline" className="w-full" size="lg">
              <Share2 className="ml-2 h-5 w-5" />
              Share My Location
            </Button>

            <div className="pt-4 border-t">
              <Button
                onClick={handleArrived}
                disabled={movingTimer > 0}
                className="w-full"
                size="lg"
                variant={movingTimer > 0 ? "secondary" : "default"}
              >
                <CheckCircle className="ml-2 h-5 w-5" />
                I Have Arrived
                {movingTimer > 0 && (
                  <span className="mr-2 text-sm">({movingTimer}s)</span>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Arrived Stage */}
        {stage === 'arrived' && (
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold text-center mb-6">Arrived at Location</h3>
            
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Customer Address:</p>
                  <p className="text-sm text-muted-foreground">{order.building_info || 'No details available'}</p>
                </div>
              </div>
            </div>

            <Button onClick={openMaps} variant="outline" className="w-full">
              <Navigation className="ml-2 h-5 w-5" />
              View Location on Map
            </Button>

            <div className="pt-4 border-t">
              <Button
                onClick={handleStartWork}
                disabled={arrivedTimer > 0}
                className="w-full"
                size="lg"
                variant={arrivedTimer > 0 ? "secondary" : "default"}
              >
                <Play className="ml-2 h-5 w-5" />
                Start Work
                {arrivedTimer > 0 && (
                  <span className="mr-2 text-sm">({arrivedTimer}s)</span>
                )}
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
                <Button
                  onClick={handleRequestInvoice}
                  className="w-full"
                  size="lg"
                >
                  <FileText className="ml-2 h-5 w-5" />
                  Request Invoice
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Back Button */}
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          className="w-full"
        >
          Back
        </Button>
      </div>
    </div>
  );
}
