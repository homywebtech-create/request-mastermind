import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogOut, Package, Clock, CheckCircle, AlertCircle, Phone, MapPin, DollarSign, FileText, Sparkles, Tag, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  customer: {
    name: string;
    whatsapp_number: string;
    area: string | null;
    budget: string | null;
  } | null;
  order_specialist?: OrderSpecialist;
}

export default function SpecialistOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [specialistName, setSpecialistName] = useState('');
  const [specialistId, setSpecialistId] = useState('');
  const [quoteDialog, setQuoteDialog] = useState<{ open: boolean; orderId: string | null }>({ open: false, orderId: null });
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

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
          customer:customers (
            name,
            whatsapp_number,
            area,
            budget
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

      setOrders(ordersWithQuotes || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast({
        title: "خطأ",
        description: "فشل تحميل الطلبات",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitQuote = async () => {
    if (!quoteDialog.orderId || !quotePrice) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال السعر المقترح",
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
          quoted_price: quotePrice,
          quoted_at: new Date().toISOString(),
          quote_notes: quoteNotes || null
        })
        .eq('id', order.order_specialist.id);

      if (error) throw error;

      toast({
        title: "تم تقديم العرض",
        description: "تم إرسال عرض السعر للإدارة بنجاح",
      });

      // Refresh orders
      await fetchOrders(specialistId);
      
      // Close dialog and reset form
      setQuoteDialog({ open: false, orderId: null });
      setQuotePrice('');
      setQuoteNotes('');
    } catch (error: any) {
      console.error('Error submitting quote:', error);
      toast({
        title: "خطأ",
        description: "فشل تقديم العرض",
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
      return <Badge variant="default" className="bg-green-600">تم تقديم عرض</Badge>;
    }

    const statusConfig = {
      pending: { label: 'عرض جديد', variant: 'secondary' as const },
      in_progress: { label: 'جاري العمل', variant: 'default' as const },
      completed: { label: 'مكتمل', variant: 'default' as const },
      cancelled: { label: 'ملغي', variant: 'destructive' as const },
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
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const newOrders = orders.filter(o => !o.order_specialist?.quoted_price);
  const quotedOrders = orders.filter(o => 
    o.order_specialist?.quoted_price && 
    o.order_specialist?.is_accepted === null
  );
  const acceptedOrders = orders.filter(o => o.order_specialist?.is_accepted === true);
  const rejectedOrders = orders.filter(o => o.order_specialist?.is_accepted === false);

  const renderOrderCard = (order: Order, showQuoteButton: boolean = false) => {
    const hasQuote = !!order.order_specialist?.quoted_price;
    const isRejected = order.order_specialist?.is_accepted === false;
    
    return (
      <Card 
        key={order.id} 
        className={`p-6 space-y-4 transition-all hover:shadow-lg ${!hasQuote && showQuoteButton ? 'border-primary border-2 bg-primary/5' : ''}`}
      >
        {!hasQuote && showQuoteButton && (
          <div className="flex items-center gap-2 text-primary mb-2">
            <Sparkles className="h-4 w-4 animate-pulse" />
            <span className="text-sm font-semibold">عرض جديد - قدم سعرك</span>
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
              {new Date(order.created_at).toLocaleDateString('ar-SA', {
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
              <p className="text-xs text-muted-foreground mb-1">نوع الخدمة</p>
              <p className="font-semibold text-sm break-words">{order.service_type}</p>
            </div>
          </div>

          {order.customer?.area && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">المنطقة</p>
                <p className="font-semibold text-sm break-words">{order.customer.area}</p>
              </div>
            </div>
          )}

          {order.customer?.budget && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <DollarSign className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">ميزانية العميل</p>
                <p className="font-semibold text-sm break-words">{order.customer.budget}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Phone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">رقم الواتساب</p>
              <p className="font-semibold text-sm break-words" dir="ltr">{order.customer?.whatsapp_number}</p>
            </div>
          </div>
        </div>

        {/* Show quote info if exists */}
        {hasQuote && !isRejected && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
            <Tag className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-green-600 mb-2 font-semibold">عرضك المقدم</p>
              <div className="space-y-1">
                <p className="text-sm"><span className="text-muted-foreground">السعر:</span> <span className="font-bold">{order.order_specialist?.quoted_price}</span></p>
                {order.order_specialist?.quote_notes && (
                  <p className="text-sm"><span className="text-muted-foreground">ملاحظات:</span> {order.order_specialist.quote_notes}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  تم التقديم: {order.order_specialist?.quoted_at && new Date(order.order_specialist.quoted_at).toLocaleDateString('ar-SA')}
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
              <p className="text-xs text-red-600 mb-2 font-semibold">تم رفض العرض</p>
              <div className="space-y-1">
                <p className="text-sm"><span className="text-muted-foreground">عرضك:</span> <span className="font-bold">{order.order_specialist?.quoted_price}</span></p>
                {order.order_specialist?.rejection_reason && (
                  <div className="mt-2 p-3 bg-red-100 rounded-md">
                    <p className="text-xs text-red-700 mb-1 font-semibold">سبب الرفض:</p>
                    <p className="text-sm text-red-900">{order.order_specialist.rejection_reason}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  تاريخ الرفض: {order.order_specialist?.rejected_at && new Date(order.order_specialist.rejected_at).toLocaleDateString('ar-SA')}
                </p>
              </div>
            </div>
          </div>
        )}

        {order.notes && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-muted">
            <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-2">ملاحظات الإدارة</p>
              <p className="text-sm leading-relaxed">{order.notes}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {showQuoteButton && !hasQuote && (
            <Dialog open={quoteDialog.open && quoteDialog.orderId === order.id} onOpenChange={(open) => {
              if (!open) {
                setQuoteDialog({ open: false, orderId: null });
                setQuotePrice('');
                setQuoteNotes('');
              }
            }}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => setQuoteDialog({ open: true, orderId: order.id })}
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <Tag className="h-4 w-4" />
                  قدم عرض السعر
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>تقديم عرض السعر</DialogTitle>
                  <DialogDescription>
                    أدخل السعر المناسب لك مع أي ملاحظات إضافية
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">السعر المقترح *</Label>
                    <Input
                      id="price"
                      type="text"
                      placeholder="مثال: 500 ريال"
                      value={quotePrice}
                      onChange={(e) => setQuotePrice(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                    <Textarea
                      id="notes"
                      placeholder="أضف أي ملاحظات أو تفاصيل إضافية"
                      value={quoteNotes}
                      onChange={(e) => setQuoteNotes(e.target.value)}
                      rows={3}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSubmitQuote}
                    disabled={isSubmitting || !quotePrice}
                    className="flex-1"
                  >
                    {isSubmitting ? "جاري الإرسال..." : "تقديم العرض"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuoteDialog({ open: false, orderId: null });
                      setQuotePrice('');
                      setQuoteNotes('');
                    }}
                    disabled={isSubmitting}
                  >
                    إلغاء
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          
          <Button
            onClick={() => order.customer && openWhatsApp(order.customer.whatsapp_number)}
            className={`${showQuoteButton && !hasQuote ? 'flex-1' : 'w-full'} gap-2`}
            variant={showQuoteButton && !hasQuote ? "outline" : "default"}
            size="lg"
          >
            <Phone className="h-4 w-4" />
            تواصل عبر واتساب
          </Button>
        </div>
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
                عروضي
              </h1>
              <p className="text-muted-foreground">مرحباً {specialistName}</p>
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="ml-2 h-4 w-4" />
              تسجيل الخروج
            </Button>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">عروض جديدة</p>
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
                <p className="text-sm text-muted-foreground mb-1">قيد المراجعة</p>
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
                <p className="text-sm text-muted-foreground mb-1">مقبولة</p>
                <p className="text-3xl font-bold text-green-600">{acceptedOrders.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">مرفوضة</p>
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
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="new" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              جديدة ({newOrders.length})
            </TabsTrigger>
            <TabsTrigger value="quoted" className="gap-2">
              <Tag className="h-4 w-4" />
              قيد المراجعة ({quotedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="accepted" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              مقبولة ({acceptedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="h-4 w-4" />
              مرفوضة ({rejectedOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            {newOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">لا توجد عروض جديدة</p>
              </Card>
            ) : (
              newOrders.map((order) => renderOrderCard(order, true))
            )}
          </TabsContent>

          <TabsContent value="quoted" className="space-y-4">
            {quotedOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <Tag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">لا توجد عروض مقدمة</p>
                <p className="text-sm text-muted-foreground mt-2">انتظر قبول الإدارة لعروضك</p>
              </Card>
            ) : (
              quotedOrders.map((order) => renderOrderCard(order))
            )}
          </TabsContent>

          <TabsContent value="accepted" className="space-y-4">
            {acceptedOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">لا توجد عروض مقبولة</p>
              </Card>
            ) : (
              acceptedOrders.map((order) => renderOrderCard(order))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {rejectedOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <XCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">لا توجد عروض مرفوضة</p>
                <p className="text-sm text-muted-foreground mt-2">هذا شيء جيد! استمر في تقديم عروض تنافسية</p>
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