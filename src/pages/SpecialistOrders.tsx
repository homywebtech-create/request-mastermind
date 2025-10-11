import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogOut, Package, Clock, CheckCircle, AlertCircle, Phone, MapPin, DollarSign, FileText, Sparkles, Tag, XCircle, Navigation, Map } from "lucide-react";
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Badge } from "@/components/ui/badge";
import { differenceInMinutes, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getSoundNotification } from "@/lib/soundNotification";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const [activeFilter, setActiveFilter] = useState<'new' | 'quoted' | 'accepted' | 'skipped' | 'rejected'>('new');
  const { toast } = useToast();
  const navigate = useNavigate();
  const soundNotification = useRef(getSoundNotification());
  const isMobile = useIsMobile();

  // Initialize audio context and notifications on first user interaction
  useEffect(() => {
    const initAudio = async () => {
      await soundNotification.current.initialize();
    };
    
    const setupNotifications = async () => {
      try {
        const permission = await LocalNotifications.requestPermissions();
        console.log('Notification permission:', permission);
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
      }
    };
    
    document.addEventListener('click', initAudio, { once: true });
    setupNotifications();
    
    return () => document.removeEventListener('click', initAudio);
  }, []);

  // Handle Android back button - prevent exit from specialist orders
  useEffect(() => {
    let backButtonListener: any;

    const setupBackButton = async () => {
      backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        // Prevent back button from exiting the app or going back
        // User must use logout button to exit
        if (!canGoBack) {
          // If at root of navigation, do nothing (don't exit app)
          return;
        }
        // If can go back, still prevent it on this page
        // User must use logout button
      });
    };

    setupBackButton();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  // Update current time every minute for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!specialistId) return;

    // Set up realtime subscription for new orders and updates
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
        async (payload) => {
          console.log('New order detected:', payload);
          
          // Refresh orders when a new order is assigned to this specialist
          fetchOrders(specialistId);
          
          // Play long ringtone sound notification for new order
          soundNotification.current.playNewOrderSound();
          
          // Send local push notification
          try {
            await LocalNotifications.schedule({
              notifications: [
                {
                  title: '🔔 عرض عمل جديد!',
                  body: 'لديك عرض عمل جديد متاح. اضغط للمشاهدة وتقديم سعرك الآن.',
                  id: Date.now(),
                  schedule: { at: new Date(Date.now() + 100) },
                  sound: undefined,
                  attachments: undefined,
                  actionTypeId: '',
                  extra: null
                }
              ]
            });
          } catch (error) {
            console.error('Error sending local notification:', error);
          }
          
          // Show in-app toast
          toast({
            title: "🔔 عرض عمل جديد!",
            description: "لديك عرض عمل جديد متاح في قسم العروض الجديدة",
          });
          
          // Switch to new orders filter
          setActiveFilter('new');
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
          console.log('Order specialist updated:', payload);
          // Refresh orders immediately when an order is updated
          fetchOrders(specialistId);
          
          // Show notification for accepted orders
          if (payload.new && (payload.new as any).is_accepted === true) {
            toast({
              title: "✅ Order Accepted!",
              description: "Your quote has been accepted by the company",
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order table updated:', payload);
          // Refresh orders when order details change
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
    
    // Calculate if specialist can move now (1 hour before booking time)
    const canMoveNow = () => {
      if (!isAccepted || !order.booking_date) return false;
      
      try {
        const bookingDateTime = parseISO(order.booking_date);
        // Subtract 1 hour (60 minutes) from booking time
        const moveTime = new Date(bookingDateTime.getTime() - 60 * 60 * 1000);
        const now = new Date();
        
        // Allow movement if current time is after or equal to move time
        return now >= moveTime;
      } catch (error) {
        console.error('Error parsing booking date:', error);
        return false;
      }
    };
    
    const getTimeUntilMovement = () => {
      if (!order.booking_date) return null;
      
      try {
        const bookingDateTime = parseISO(order.booking_date);
        // Subtract 1 hour from booking time to get the move time
        const moveTime = new Date(bookingDateTime.getTime() - 60 * 60 * 1000);
        const now = currentTime;
        const totalSeconds = Math.floor((moveTime.getTime() - now.getTime()) / 1000);
        
        // If time has passed, show 0
        if (totalSeconds <= 0) {
          return { days: 0, hours: 0, minutes: 0, seconds: 0 };
        }
        
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        return { days, hours, minutes, seconds };
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
        className={`overflow-hidden transition-all hover:shadow-xl ${!hasQuote && showQuoteButton ? 'border-primary border-2 shadow-lg' : 'border-border'}`}
      >
        {/* Header Section with Gradient */}
        <div className={`p-3 md:p-6 pb-2 md:pb-4 ${!hasQuote && showQuoteButton ? 'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent' : 'bg-gradient-to-r from-muted/50 to-transparent'}`}>
          <div className="flex items-start justify-between gap-2 md:gap-4">
            <div className="flex-1 space-y-2 md:space-y-3">
              {!hasQuote && showQuoteButton && (
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4 md:h-5 md:w-5 animate-pulse" />
                  <span className="text-sm font-bold">New Order - Submit Your Price</span>
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-2xl font-bold text-foreground">{order.customer?.name}</h3>
                {getStatusBadge(order.status, hasQuote)}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Order placed on {new Date(order.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Information Grid */}
        <div className="p-6 pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:shadow-md transition-all">
              <div className="p-2 rounded-lg bg-primary/20">
                <Package className="h-5 w-5 text-primary" />
              </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Service Type</p>
                  <p className="font-bold text-sm break-words text-foreground">{order.service_type}</p>
                </div>
              </div>

            {order.customer?.area && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/10 border border-blue-200 dark:border-blue-800 hover:shadow-md transition-all">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                  <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Area</p>
                  <p className="font-bold text-sm break-words text-foreground">{order.customer.area}</p>
                </div>
              </div>
            )}

            {order.booking_type && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-50/50 dark:from-purple-950/30 dark:to-purple-950/10 border border-purple-200 dark:border-purple-800 hover:shadow-md transition-all">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                  <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Booking Type</p>
                  <p className="font-bold text-sm break-words text-foreground">{order.booking_type}</p>
                </div>
              </div>
            )}

            {order.hours_count && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-orange-50 to-orange-50/50 dark:from-orange-950/30 dark:to-orange-950/10 border border-orange-200 dark:border-orange-800 hover:shadow-md transition-all">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50">
                  <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Duration</p>
                  <p className="font-bold text-sm break-words text-foreground">{order.hours_count} hours</p>
                </div>
              </div>
            )}

            {/* Show quote info if exists */}
            {hasQuote && !isRejected && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-50/50 dark:from-green-950/30 dark:to-green-950/10 border-2 border-green-200 dark:border-green-800 hover:shadow-md transition-all">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                  <Tag className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Your Quote</p>
                  <p className="font-bold text-sm break-words text-foreground">{order.order_specialist?.quoted_price}</p>
                </div>
              </div>
            )}
          </div>

          {/* Show rejection info if rejected */}
          {isRejected && (
            <div className="flex items-start gap-3 p-5 rounded-xl bg-gradient-to-br from-red-50 to-red-50/50 dark:from-red-950/30 dark:to-red-950/10 border-2 border-red-200 dark:border-red-800 shadow-sm">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-red-700 dark:text-red-300 mb-3 font-bold">✕ Quote Rejected by Customer</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Your quote:</span>
                    <span className="font-bold text-base text-foreground">{order.order_specialist?.quoted_price}</span>
                  </div>
                  {order.order_specialist?.rejection_reason && (
                    <div className="mt-3 p-4 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-xs text-red-700 dark:text-red-300 mb-1 font-bold">Customer's Reason:</p>
                      <p className="text-sm text-red-900 dark:text-red-200">{order.order_specialist.rejection_reason}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">
                    Rejected on: {order.order_specialist?.rejected_at && new Date(order.order_specialist.rejected_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {order.notes && (
            <div className="flex items-start gap-3 p-5 rounded-xl bg-gradient-to-br from-amber-50 to-amber-50/50 dark:from-amber-950/30 dark:to-amber-950/10 border border-amber-200 dark:border-amber-800 shadow-sm">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-2 font-bold">Admin Notes</p>
                <p className="text-sm leading-relaxed text-foreground">{order.notes}</p>
              </div>
            </div>
          )}
        </div>

        {showQuoteButton && !hasQuote && (
          <div className="px-6 pb-6">
            <Dialog open={quoteDialog.open && quoteDialog.orderId === order.id} onOpenChange={(open) => {
              if (!open) {
                setQuoteDialog({ open: false, orderId: null });
              }
            }}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => setQuoteDialog({ open: true, orderId: order.id })}
                  className="w-full gap-2 h-12 text-base font-bold shadow-lg hover:shadow-xl transition-all"
                  size="lg"
                >
                  <Tag className="h-5 w-5" />
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
          </div>
        )}
        
        {order.order_specialist?.is_accepted === true && (
          <div className="px-6 pb-6 space-y-4">
            {canMoveNow() ? (
              <div className="space-y-4">
                <Button
                  onClick={() => navigate(`/order-tracking/${order.id}`)}
                  className="w-full bg-green-600 hover:bg-green-700 h-auto py-5 px-6 shadow-lg hover:shadow-xl transition-all"
                  size="lg"
                >
                  <div className="flex items-center justify-between w-full gap-4">
                    <div className="flex items-center gap-3">
                      <Navigation className="h-6 w-6" />
                      <span className="text-lg font-bold">Move Now</span>
                    </div>
                    {getTimeUntilMovement() && order.booking_date && (
                      <div className="flex items-center gap-2 bg-blue-500/30 px-4 py-2 rounded-full border-2 border-blue-400/50 backdrop-blur-sm">
                        <Clock className="h-4 w-4 text-white" />
                        <span className="font-bold text-sm text-white font-mono">
                          {getTimeUntilMovement()!.days > 0 && `${getTimeUntilMovement()!.days}d `}
                          {(getTimeUntilMovement()!.hours > 0 || getTimeUntilMovement()!.days > 0) && `${String(getTimeUntilMovement()!.hours).padStart(2, '0')}:`}
                          {String(getTimeUntilMovement()!.minutes).padStart(2, '0')}:
                          {String(getTimeUntilMovement()!.seconds).padStart(2, '0')}
                        </span>
                      </div>
                    )}
                  </div>
                </Button>
              </div>
            ) : (
              <Button
                disabled
                className="w-full h-auto py-5 px-6 shadow-md"
                variant="outline"
                size="lg"
              >
                <div className="flex items-center justify-between w-full gap-4">
                  <div className="flex items-center gap-3">
                    <Navigation className="h-6 w-6" />
                    <span className="font-bold text-lg">Move Now</span>
                  </div>
                  {getTimeUntilMovement() && order.booking_date && (
                    <div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-full border-2 border-red-200">
                      <Clock className="h-4 w-4 text-red-600" />
                      <span className="font-bold text-sm text-red-600 font-mono">
                        {getTimeUntilMovement()!.days > 0 && `${getTimeUntilMovement()!.days}d `}
                        {(getTimeUntilMovement()!.hours > 0 || getTimeUntilMovement()!.days > 0) && `${String(getTimeUntilMovement()!.hours).padStart(2, '0')}:`}
                        {String(getTimeUntilMovement()!.minutes).padStart(2, '0')}:
                        {String(getTimeUntilMovement()!.seconds).padStart(2, '0')}
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

  const filterCards = [
    {
      id: 'new' as const,
      title: 'New Offers',
      count: newOrders.length,
      icon: AlertCircle,
      color: 'blue'
    },
    {
      id: 'accepted' as const,
      title: 'Accepted',
      count: acceptedOrders.length,
      icon: CheckCircle,
      color: 'green'
    },
    {
      id: 'quoted' as const,
      title: 'Under Review',
      count: quotedOrders.length,
      icon: Tag,
      color: 'orange'
    },
    {
      id: 'skipped' as const,
      title: 'Skipped',
      count: skippedOrders.length,
      icon: XCircle,
      color: 'gray'
    },
    {
      id: 'rejected' as const,
      title: 'Rejected',
      count: rejectedOrders.length,
      icon: XCircle,
      color: 'red'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto p-3 md:p-4 space-y-4 md:space-y-6 max-w-6xl">
        {/* Header */}
        <Card className="p-4 md:p-6 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                My Orders
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">Welcome {specialistName}</p>
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </Card>

        {/* Interactive Stats Cards - Carousel for Mobile */}
        {isMobile ? (
          <Carousel
            opts={{
              align: "start",
              direction: "rtl",
              loop: false,
            }}
            className="w-full"
          >
            <CarouselContent className="-mr-2">
              {filterCards.map((filter) => {
                const Icon = filter.icon;
                const isActive = activeFilter === filter.id;
                return (
                  <CarouselItem key={filter.id} className="pr-2 basis-[45%]">
                    <Card 
                      className={`p-3 cursor-pointer transition-all ${
                        isActive
                          ? `bg-gradient-to-br from-${filter.color}-500/20 to-${filter.color}-500/10 border-${filter.color}-500/50 border-2 shadow-lg` 
                          : `bg-gradient-to-br from-${filter.color}-500/10 to-${filter.color}-500/5 border-${filter.color}-500/20`
                      }`}
                      onClick={() => setActiveFilter(filter.id)}
                    >
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          isActive ? `bg-${filter.color}-500/40` : `bg-${filter.color}-500/20`
                        }`}>
                          <Icon className={`h-5 w-5 ${isActive ? `text-${filter.color}-700` : `text-${filter.color}-600`}`} />
                        </div>
                        <p className={`text-xl font-bold ${isActive ? `text-${filter.color}-700` : `text-${filter.color}-600`}`}>
                          {filter.count}
                        </p>
                        <p className={`text-xs font-semibold ${isActive ? `text-${filter.color}-700` : 'text-muted-foreground'}`}>
                          {filter.title}
                        </p>
                        {isActive && (
                          <div className={`text-[10px] font-bold text-${filter.color}-700`}>● Active</div>
                        )}
                      </div>
                    </Card>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {filterCards.map((filter) => {
              const Icon = filter.icon;
              const isActive = activeFilter === filter.id;
              return (
                <Card 
                  key={filter.id}
                  className={`p-6 cursor-pointer transition-all hover:scale-105 ${
                    isActive
                      ? `bg-gradient-to-br from-${filter.color}-500/20 to-${filter.color}-500/10 border-${filter.color}-500/50 border-4 shadow-xl scale-105` 
                      : `bg-gradient-to-br from-${filter.color}-500/10 to-${filter.color}-500/5 border-${filter.color}-500/20 hover:shadow-lg`
                  }`}
                  onClick={() => setActiveFilter(filter.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm mb-1 font-semibold ${isActive ? `text-${filter.color}-700` : 'text-muted-foreground'}`}>
                        {filter.title}
                      </p>
                      <p className={`text-3xl font-bold ${isActive ? `text-${filter.color}-700` : `text-${filter.color}-600`}`}>
                        {filter.count}
                      </p>
                    </div>
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                      isActive ? `bg-${filter.color}-500/40` : `bg-${filter.color}-500/20`
                    }`}>
                      <Icon className={`h-6 w-6 ${isActive ? `text-${filter.color}-700` : `text-${filter.color}-600`}`} />
                    </div>
                  </div>
                  {isActive && (
                    <div className={`text-xs font-bold text-${filter.color}-700 mt-2`}>● Active Section</div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Filtered Orders */}
        <div className="space-y-4 mt-6">
          {activeFilter === 'new' && (
            newOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No new orders</p>
              </Card>
            ) : (
              newOrders.map((order) => renderOrderCard(order, true))
            )
          )}

          {activeFilter === 'quoted' && (
            quotedOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <Tag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No submitted quotes</p>
                <p className="text-sm text-muted-foreground mt-2">Wait for management to review your quotes</p>
              </Card>
            ) : (
              quotedOrders.map((order) => renderOrderCard(order))
            )
          )}

          {activeFilter === 'accepted' && (
            acceptedOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No accepted orders</p>
              </Card>
            ) : (
              acceptedOrders.map((order) => renderOrderCard(order))
            )
          )}

          {activeFilter === 'skipped' && (
            skippedOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <XCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No skipped orders</p>
              </Card>
            ) : (
              skippedOrders.map((order) => renderOrderCard(order))
            )
          )}

          {activeFilter === 'rejected' && (
            rejectedOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <XCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No orders rejected by customers</p>
                <p className="text-sm text-muted-foreground mt-2">That's great! Your quotes are competitive</p>
              </Card>
            ) : (
              rejectedOrders.map((order) => renderOrderCard(order))
            )
          )}
        </div>
      </div>
    </div>
  );
}