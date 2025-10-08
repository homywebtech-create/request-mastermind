import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogOut, Package, Clock, CheckCircle, AlertCircle, Phone, MapPin, DollarSign, FileText, Sparkles, Tag, XCircle, Navigation, Map } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { differenceInMinutes, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface OrderSpecialist {
  id: string;
  quoted_price: string | null;
  quoted_at: string | null;
  quote_notes: string | null;
  is_accepted: boolean | null;
  rejected_at: string | null;
  rejection_reason: string | null;
}

interface Order {
  id: string;
  created_at: string;
  service_type: string;
  status: string;
  notes: string | null;
  booking_type: string | null;
  hours_count: string | null;
  booking_date: string | null;
  booking_date_type: string | null;
  selected_booking_type: string | null;
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
  order_specialist?: OrderSpecialist;
}

export default function SpecialistOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [specialistName, setSpecialistName] = useState('');
  const [specialistId, setSpecialistId] = useState('');
  const [quoteDialog, setQuoteDialog] = useState<{ open: boolean; orderId: string | null }>({ open: false, orderId: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLocationMap, setShowLocationMap] = useState<{ [orderId: string]: boolean }>({});
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  // Update current time every minute for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!specialistId) return;

    // Set up realtime subscription for new orders
    const channel = supabase
      .channel('specialist-orders-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_specialists',
          filter: `specialist_id=eq.${specialistId}`
        },
        (payload) => {
          console.log('New order detected:', payload);
          // Refresh orders when a new order is assigned to this specialist
          fetchOrders(specialistId);
          
          // Show notification
          toast({
            title: "New Order!",
            description: "A new order has been added for you",
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_specialists',
          filter: `specialist_id=eq.${specialistId}`
        },
        (payload) => {
          console.log('Order updated:', payload);
          // Refresh orders when an order is updated
          fetchOrders(specialistId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [specialistId]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/specialist-auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, company_id, phone')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setSpecialistName(profile.full_name);
        
        // Get specialist ID
        const { data: specialist } = await supabase
          .from('specialists')
          .select('id')
          .eq('phone', profile.phone)
          .single();

        if (specialist) {
          setSpecialistId(specialist.id);
          await fetchOrders(specialist.id);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/specialist-auth');
    }
  };

  const fetchOrders = async (specId: string) => {
    try {
      setIsLoading(true);

      // Get order_specialists records for this specialist
      const { data: orderSpecialists } = await supabase
        .from('order_specialists')
        .select('order_id, id, quoted_price, quoted_at, quote_notes, is_accepted, rejected_at, rejection_reason')
        .eq('specialist_id', specId);

      if (!orderSpecialists || orderSpecialists.length === 0) {
        setOrders([]);
        setIsLoading(false);
        return;
      }

      const orderIds = orderSpecialists.map(os => os.order_id);

      // Fetch orders with customer info
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          service_type,
          status,
          notes,
          booking_type,
          hours_count,
          booking_date,
          booking_date_type,
          selected_booking_type,
          gps_latitude,
          gps_longitude,
          building_info,
          customer:customers (
            name,
            whatsapp_number,
            area,
            budget,
            budget_type
          )
        `)
        .in('id', orderIds)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Merge order_specialist data with orders
      const ordersWithQuotes = ordersData?.map(order => {
        const orderSpec = orderSpecialists.find(os => os.order_id === order.id);
        return {
          ...order,
          order_specialist: orderSpec ? {
            id: orderSpec.id,
            quoted_price: orderSpec.quoted_price,
            quoted_at: orderSpec.quoted_at,
            quote_notes: orderSpec.quote_notes,
            is_accepted: orderSpec.is_accepted,
            rejected_at: orderSpec.rejected_at,
            rejection_reason: orderSpec.rejection_reason
          } : undefined
        };
      });

      console.log('📊 All orders with status:', ordersWithQuotes?.map(o => ({
        id: o.id,
        is_accepted: o.order_specialist?.is_accepted,
        quoted_price: o.order_specialist?.quoted_price
      })));
      
      setOrders(ordersWithQuotes || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitQuote = async (price: string) => {
    if (!quoteDialog.orderId) {
      toast({
        title: "Error",
        description: "Order ID not found",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Find the order_specialist record
      const order = orders.find(o => o.id === quoteDialog.orderId);
      if (!order?.order_specialist) {
        throw new Error('Order specialist not found');
      }

      // Update order_specialist with quote
      const { error } = await supabase
        .from('order_specialists')
        .update({
          quoted_price: price,
          quoted_at: new Date().toISOString(),
          quote_notes: null
        })
        .eq('id', order.order_specialist.id);

      if (error) throw error;

      toast({
        title: "Quote Submitted",
        description: "Your quote has been successfully sent to management",
      });

      // Refresh orders
      await fetchOrders(specialistId);
      
      // Close dialog
      setQuoteDialog({ open: false, orderId: null });
    } catch (error: any) {
      console.error('Error submitting quote:', error);
      toast({
        title: "Error",
        description: "Failed to submit quote",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipOrder = async () => {
    if (!quoteDialog.orderId) {
      return;
    }

    setIsSubmitting(true);
    try {
      const order = orders.find(o => o.id === quoteDialog.orderId);
      if (!order?.order_specialist) {
        throw new Error('Order specialist not found');
      }

      // Mark as rejected/skipped
      const { error } = await supabase
        .from('order_specialists')
        .update({
          is_accepted: false,
          rejected_at: new Date().toISOString(),
          rejection_reason: 'Skipped by specialist'
        })
        .eq('id', order.order_specialist.id);

      if (error) throw error;

      toast({
        title: "Order Skipped",
        description: "This order has been skipped",
      });

      // Refresh orders
      await fetchOrders(specialistId);
      
      // Close dialog
      setQuoteDialog({ open: false, orderId: null });
    } catch (error: any) {
      console.error('Error skipping order:', error);
      toast({
        title: "Error",
        description: "Failed to skip order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/specialist-auth');
  };

  const getStatusBadge = (status: string, hasQuote: boolean) => {
    if (hasQuote) {
      return <Badge variant="default" className="bg-green-600">Quote Submitted</Badge>;
    }

    const statusConfig = {
      pending: { label: 'New Order', variant: 'secondary' as const },
      in_progress: { label: 'In Progress', variant: 'default' as const },
      completed: { label: 'Completed', variant: 'default' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const openWhatsApp = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/\+/g, '')}`, '_blank');
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

  // New orders: no quote AND not skipped
  const newOrders = orders.filter(o => 
    !o.order_specialist?.quoted_price && 
    !o.order_specialist?.rejected_at
  );
  
  // Skipped orders: rejected by specialist (skipped)
  const skippedOrders = orders.filter(o => 
    o.order_specialist?.is_accepted === false && 
    o.order_specialist?.rejection_reason === 'Skipped by specialist'
  );
  
  const quotedOrders = orders.filter(o => 
    o.order_specialist?.quoted_price && 
    o.order_specialist?.is_accepted === null
  );
  const acceptedOrders = orders.filter(o => o.order_specialist?.is_accepted === true);
  
  // Rejected orders: rejected by admin (has quote and is_accepted = false)
  const rejectedOrders = orders.filter(o => 
    o.order_specialist?.is_accepted === false && 
    o.order_specialist?.quoted_price &&
    o.order_specialist?.rejection_reason !== 'Skipped by specialist'
  );
  
  console.log('🎯 Filtered orders:', {
    new: newOrders.length,
    quoted: quotedOrders.length,
    accepted: acceptedOrders.length,
    skipped: skippedOrders.length,
    rejected: rejectedOrders.length
  });

  const renderOrderCard = (order: Order, showQuoteButton: boolean = false) => {
    const hasQuote = !!order.order_specialist?.quoted_price;
    const isRejected = order.order_specialist?.is_accepted === false;
    const isAccepted = order.order_specialist?.is_accepted === true;
    
    // Calculate if specialist can move now (within 1 hour before booking time)
    const canMoveNow = () => {
      if (!isAccepted || !order.booking_date) return false;
      
      try {
        const bookingDateTime = parseISO(order.booking_date);
        const now = new Date();
        const minutesUntilBooking = differenceInMinutes(bookingDateTime, now);
        
        // Allow movement within 60 minutes before and after the booking time
        return minutesUntilBooking <= 60 && minutesUntilBooking >= -60;
      } catch (error) {
        console.error('Error parsing booking date:', error);
        return false;
      }
    };
    
    const getTimeUntilMovement = () => {
      if (!order.booking_date) return null;
      
      try {
        const bookingDateTime = parseISO(order.booking_date);
        const minutesUntilBooking = differenceInMinutes(bookingDateTime, currentTime);
        
        const totalHours = Math.floor(Math.abs(minutesUntilBooking) / 60);
        const days = Math.floor(totalHours / 24);
        const hours = totalHours % 24;
        const minutes = Math.abs(minutesUntilBooking) % 60;
        
        if (days > 0) {
          return { days, hours, minutes, text: `${days} يوم و ${hours} ساعة و ${minutes} دقيقة` };
        } else if (hours > 0) {
          return { days: 0, hours, minutes, text: `${hours} ساعة و ${minutes} دقيقة` };
        } else {
          return { days: 0, hours: 0, minutes, text: `${minutes} دقيقة` };
        }
      } catch (error) {
        return null;
      }
    };
    
    // Calculate price options based on customer budget
    // Extract numeric value from budget string
    const budgetStr = order.customer?.budget || '';
    const numericBudget = parseFloat(budgetStr.replace(/[^0-9.]/g, ''));
    const baseBudget = !isNaN(numericBudget) && numericBudget > 0 ? numericBudget : 0;
    
    const priceOptions = baseBudget > 0 ? [
      { label: `${baseBudget} QAR`, value: `${baseBudget} QAR` },
      { label: `${baseBudget + 3} QAR`, value: `${baseBudget + 3} QAR` },
      { label: `${baseBudget + 6} QAR`, value: `${baseBudget + 6} QAR` },
      { label: `${baseBudget + 9} QAR`, value: `${baseBudget + 9} QAR` },
    ] : [];
    
    return (
      <Card 
        key={order.id} 
        className={`p-6 space-y-4 transition-all hover:shadow-lg ${!hasQuote && showQuoteButton ? 'border-primary border-2 bg-primary/5' : ''}`}
      >
        {!hasQuote && showQuoteButton && (
          <div className="flex items-center gap-2 text-primary mb-2">
            <Sparkles className="h-4 w-4 animate-pulse" />
            <span className="text-sm font-semibold">New Order - Submit Your Quote</span>
          </div>
        )}
        
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold">{order.customer?.name}</h3>
              {getStatusBadge(order.status, hasQuote)}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {new Date(order.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Package className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">Service Type</p>
              <p className="font-semibold text-sm break-words">{order.service_type}</p>
            </div>
          </div>

          {order.customer?.area && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Area</p>
                <p className="font-semibold text-sm break-words">{order.customer.area}</p>
              </div>
            </div>
          )}

          {order.customer?.budget && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <DollarSign className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Customer Budget</p>
                <p className="font-semibold text-sm break-words">
                  {order.customer.budget} {order.customer.budget_type ? `(${order.customer.budget_type})` : ''}
                </p>
              </div>
            </div>
          )}

          {order.booking_type && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Package className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Booking Type</p>
                <p className="font-semibold text-sm break-words">{order.booking_type}</p>
              </div>
            </div>
          )}

          {order.hours_count && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Hours Count</p>
                <p className="font-semibold text-sm break-words">{order.hours_count} hours</p>
              </div>
            </div>
          )}

          {order.order_specialist?.is_accepted === true && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Phone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">WhatsApp Number</p>
                <p className="font-semibold text-sm break-words" dir="ltr">{order.customer?.whatsapp_number}</p>
              </div>
            </div>
          )}
        </div>

        {/* Show quote info if exists */}
        {hasQuote && !isRejected && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
            <Tag className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-green-600 mb-2 font-semibold">Your Submitted Quote</p>
              <div className="space-y-1">
                <p className="text-sm"><span className="text-muted-foreground">Price:</span> <span className="font-bold">{order.order_specialist?.quoted_price}</span></p>
                {order.order_specialist?.quote_notes && (
                  <p className="text-sm"><span className="text-muted-foreground">Notes:</span> {order.order_specialist.quote_notes}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Submitted: {order.order_specialist?.quoted_at && new Date(order.order_specialist.quoted_at).toLocaleDateString('en-US')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Show rejection info if rejected */}
        {isRejected && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-red-600 mb-2 font-semibold">Quote Rejected by Customer</p>
              <div className="space-y-1">
                <p className="text-sm"><span className="text-muted-foreground">Your quote:</span> <span className="font-bold">{order.order_specialist?.quoted_price}</span></p>
                {order.order_specialist?.rejection_reason && (
                  <div className="mt-2 p-3 bg-red-100 rounded-md">
                    <p className="text-xs text-red-700 mb-1 font-semibold">Customer's Reason:</p>
                    <p className="text-sm text-red-900">{order.order_specialist.rejection_reason}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Rejection Date: {order.order_specialist?.rejected_at && new Date(order.order_specialist.rejected_at).toLocaleDateString('en-US')}
                </p>
              </div>
            </div>
          </div>
        )}

        {order.notes && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-muted">
            <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-2">Admin Notes</p>
              <p className="text-sm leading-relaxed">{order.notes}</p>
            </div>
          </div>
        )}

        {showQuoteButton && !hasQuote && (
          <Dialog open={quoteDialog.open && quoteDialog.orderId === order.id} onOpenChange={(open) => {
            if (!open) {
              setQuoteDialog({ open: false, orderId: null });
            }
          }}>
            <DialogTrigger asChild>
              <Button
                onClick={() => setQuoteDialog({ open: true, orderId: order.id })}
                className="w-full gap-2"
                size="lg"
              >
                <Tag className="h-4 w-4" />
                Submit Quote
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Choose Your Price</DialogTitle>
                <DialogDescription>
                  {baseBudget > 0 
                    ? `Customer Budget: ${baseBudget} QAR - Choose the price that suits you`
                    : "Choose a price that suits you"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                {priceOptions.length > 0 ? (
                  <>
                    {/* Customer Price - First option */}
                    <Button
                      onClick={() => handleSubmitQuote(priceOptions[0].value)}
                      disabled={isSubmitting}
                      variant="default"
                      className="w-full h-auto py-4 flex flex-col gap-1"
                    >
                      <span className="text-lg font-bold">{priceOptions[0].label}</span>
                      <span className="text-xs opacity-80">Customer Price</span>
                    </Button>
                    
                    {/* Other price options in grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {priceOptions.slice(1).map((option, index) => (
                        <Button
                          key={index + 1}
                          onClick={() => handleSubmitQuote(option.value)}
                          disabled={isSubmitting}
                          variant="outline"
                          className="h-auto py-3 flex flex-col gap-1"
                        >
                          <span className="text-base font-bold">{option.label}</span>
                          <span className="text-xs opacity-80">+{(index + 1) * 3} QAR</span>
                        </Button>
                      ))}
                    </div>
                    <div className="pt-2 border-t">
                      <Button
                        onClick={handleSkipOrder}
                        disabled={isSubmitting}
                        variant="ghost"
                        className="w-full"
                      >
                        Skip This Order
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No budget specified by customer</p>
                    <Button
                      onClick={handleSkipOrder}
                      disabled={isSubmitting}
                      variant="outline"
                      className="w-full"
                    >
                      Skip This Order
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
        
        {order.order_specialist?.is_accepted === true && (
          <div className="space-y-3">
            {canMoveNow() ? (
              <div className="space-y-3">
                <Button
                  onClick={() => setShowLocationMap(prev => ({ ...prev, [order.id]: true }))}
                  className="w-full bg-green-600 hover:bg-green-700 h-auto py-4 px-6"
                  size="lg"
                >
                  <div className="flex items-center justify-between w-full gap-4">
                    <div className="flex items-center gap-2">
                      <Navigation className="h-5 w-5" />
                      <span className="text-base font-bold">Move Now - تحرك الآن</span>
                    </div>
                    {getTimeUntilMovement() && order.booking_date && (
                      <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full border border-white/30">
                        <Clock className="h-4 w-4" />
                        <span className="font-bold text-sm">
                          {getTimeUntilMovement()!.days > 0 && `${getTimeUntilMovement()!.days}d `}
                          {(getTimeUntilMovement()!.hours > 0 || getTimeUntilMovement()!.days > 0) && `${getTimeUntilMovement()!.hours}h `}
                          {getTimeUntilMovement()!.minutes}m
                        </span>
                      </div>
                    )}
                  </div>
                </Button>
                
                {/* Location Map - Show after clicking Move Now */}
                {showLocationMap[order.id] && order.gps_latitude && order.gps_longitude && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20">
                      <Map className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-xs text-primary mb-2 font-semibold">موقع العمل - Work Location</p>
                          {order.building_info && (
                            <p className="text-sm text-muted-foreground mb-2">{order.building_info}</p>
                          )}
                          <p className="text-xs font-mono text-muted-foreground" dir="ltr">
                            {order.gps_latitude.toFixed(6)}, {order.gps_longitude.toFixed(6)}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={() => {
                              const url = `https://www.google.com/maps/search/?api=1&query=${order.gps_latitude},${order.gps_longitude}`;
                              window.open(url, '_blank');
                            }}
                            variant="default"
                            size="sm"
                            className="gap-2"
                          >
                            <MapPin className="h-4 w-4" />
                            Google Maps
                          </Button>
                          <Button
                            onClick={() => {
                              const url = `https://maps.apple.com/?q=${order.gps_latitude},${order.gps_longitude}`;
                              window.open(url, '_blank');
                            }}
                            variant="default"
                            size="sm"
                            className="gap-2"
                          >
                            <MapPin className="h-4 w-4" />
                            Apple Maps
                          </Button>
                        </div>
                        <Button
                          onClick={() => order.customer && openWhatsApp(order.customer.whatsapp_number)}
                          className="w-full gap-2 bg-green-600 hover:bg-green-700"
                          size="sm"
                        >
                          <Phone className="h-4 w-4" />
                          تواصل مع العميل - Contact Customer
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button
                disabled
                className="w-full h-auto py-4 px-6"
                variant="outline"
                size="lg"
              >
                <div className="flex items-center justify-between w-full gap-4">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-5 w-5" />
                    <span className="font-semibold">Move Now - تحرك الآن</span>
                  </div>
                  {getTimeUntilMovement() && order.booking_date && (
                    <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-full border">
                      <Clock className="h-4 w-4" />
                      <span className="font-bold text-sm">
                        {getTimeUntilMovement()!.days > 0 && `${getTimeUntilMovement()!.days}d `}
                        {(getTimeUntilMovement()!.hours > 0 || getTimeUntilMovement()!.days > 0) && `${getTimeUntilMovement()!.hours}h `}
                        {getTimeUntilMovement()!.minutes}m
                      </span>
                    </div>
                  )}
                </div>
              </Button>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto p-4 space-y-6 max-w-6xl">
        {/* Header */}
        <Card className="p-6 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                My Orders
              </h1>
              <p className="text-muted-foreground">Welcome {specialistName}</p>
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">New Orders</p>
                <p className="text-3xl font-bold text-blue-600">{newOrders.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Under Review</p>
                <p className="text-3xl font-bold text-orange-600">{quotedOrders.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Tag className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Accepted</p>
                <p className="text-3xl font-bold text-green-600">{acceptedOrders.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-gray-500/10 to-gray-500/5 border-gray-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Skipped</p>
                <p className="text-3xl font-bold text-gray-600">{skippedOrders.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-gray-500/20 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Rejected by Customer</p>
                <p className="text-3xl font-bold text-red-600">{rejectedOrders.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Orders Tabs */}
        <Tabs defaultValue="new" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="new" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              New ({newOrders.length})
            </TabsTrigger>
            <TabsTrigger value="quoted" className="gap-2">
              <Tag className="h-4 w-4" />
              Under Review ({quotedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="accepted" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Accepted ({acceptedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="skipped" className="gap-2">
              <XCircle className="h-4 w-4" />
              Skipped ({skippedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              Rejected by Customer ({rejectedOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            {newOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No new orders</p>
              </Card>
            ) : (
              newOrders.map((order) => renderOrderCard(order, true))
            )}
          </TabsContent>

          <TabsContent value="quoted" className="space-y-4">
            {quotedOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <Tag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No submitted quotes</p>
                <p className="text-sm text-muted-foreground mt-2">Wait for management to review your quotes</p>
              </Card>
            ) : (
              quotedOrders.map((order) => renderOrderCard(order))
            )}
          </TabsContent>

          <TabsContent value="accepted" className="space-y-4">
            {acceptedOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No accepted orders</p>
              </Card>
            ) : (
              acceptedOrders.map((order) => renderOrderCard(order))
            )}
          </TabsContent>

          <TabsContent value="skipped" className="space-y-4">
            {skippedOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <XCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No skipped orders</p>
              </Card>
            ) : (
              skippedOrders.map((order) => renderOrderCard(order))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {rejectedOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <XCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No orders rejected by customers</p>
                <p className="text-sm text-muted-foreground mt-2">That's great! Your quotes are competitive</p>
              </Card>
            ) : (
              rejectedOrders.map((order) => renderOrderCard(order))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}