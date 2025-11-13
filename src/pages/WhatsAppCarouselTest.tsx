import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, CheckCircle2, XCircle, AlertCircle, ShoppingCart, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { fetchQuotesForOrder, sendWhatsAppCarouselToCustomer } from "@/lib/whatsappCarousel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface MockSpecialist {
  id: string;
  name: string;
  company: string;
  price: number;
  imageUrl: string;
}

interface SendStatus {
  index: number;
  status: 'pending' | 'sending' | 'success' | 'error';
  message?: string;
  timestamp?: number;
}

export default function WhatsAppCarouselTest() {
  const [phoneNumber, setPhoneNumber] = useState("+966");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Quick test mode
  const [quickTestMode, setQuickTestMode] = useState(false);
  const [specialistCount, setSpecialistCount] = useState<number>(2);
  const [messageInterval, setMessageInterval] = useState<number>(1); // seconds
  const [isSending, setIsSending] = useState(false);
  const [sendStatuses, setSendStatuses] = useState<SendStatus[]>([]);
  const [currentSendIndex, setCurrentSendIndex] = useState(0);
  
  // Mock specialists for quick testing
  const mockSpecialists: MockSpecialist[] = [
    { id: "1", name: "فاطمة أحمد", company: "شركة النظافة المتقدمة", price: 50, imageUrl: "https://i.pravatar.cc/150?img=1" },
    { id: "2", name: "مريم محمد", company: "خدمات المنزل الذكي", price: 55, imageUrl: "https://i.pravatar.cc/150?img=5" },
    { id: "3", name: "نورا عبدالله", company: "التنظيف الاحترافي", price: 48, imageUrl: "https://i.pravatar.cc/150?img=9" },
    { id: "4", name: "سارة علي", company: "العناية المنزلية", price: 52, imageUrl: "https://i.pravatar.cc/150?img=10" },
  ];

  // Fetch orders with quotes
  const { data: ordersWithQuotes, isLoading: loadingOrders } = useQuery({
    queryKey: ["orders-with-quotes"],
    queryFn: async () => {
      const { data: orderSpecialists, error } = await supabase
        .from("order_specialists")
        .select(`
          order_id,
          orders (
            id,
            order_number,
            service_type,
            customer_name,
            customer_phone
          )
        `)
        .not("quoted_price", "is", null)
        .or("is_accepted.is.null,is_accepted.eq.false");

      if (error) throw error;

      // Group by order and count quotes
      const ordersMap = new Map();
      orderSpecialists?.forEach((os: any) => {
        if (os.orders) {
          const orderId = os.order_id;
          if (!ordersMap.has(orderId)) {
            ordersMap.set(orderId, {
              ...os.orders,
              quotesCount: 1
            });
          } else {
            const existing = ordersMap.get(orderId);
            existing.quotesCount += 1;
          }
        }
      });

      return Array.from(ordersMap.values()).filter(order => order.quotesCount >= 2);
    }
  });

  const handleQuickTest = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error("يرجى إدخال رقم هاتف صحيح");
      return;
    }

    const selectedSpecialists = mockSpecialists.slice(0, specialistCount);
    const totalMessages = selectedSpecialists.length;
    
    // Initialize send statuses
    const initialStatuses: SendStatus[] = selectedSpecialists.map((_, index) => ({
      index,
      status: 'pending'
    }));
    setSendStatuses(initialStatuses);
    setIsSending(true);
    setCurrentSendIndex(0);

    // Send messages with interval
    for (let i = 0; i < totalMessages; i++) {
      setCurrentSendIndex(i);
      
      // Update status to sending
      setSendStatuses(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'sending', timestamp: Date.now() } : s
      ));

      try {
        const specialist = selectedSpecialists[i];
        
        // Prepare mock quote
        const mockQuote = {
          specialistId: specialist.id,
          specialistName: specialist.name,
          specialistNationality: "سعودية",
          specialistImageUrl: specialist.imageUrl,
          quotedPrice: specialist.price,
          companyId: "mock-company-id",
          companyName: specialist.company
        };

        console.log(`📤 Sending message ${i + 1}/${totalMessages} to ${phoneNumber}`);

        // Send carousel with single specialist
        await sendWhatsAppCarouselToCustomer({
          customerPhone: phoneNumber,
          customerName: "عميل تجريبي",
          orderNumber: `TEST-${Date.now()}`,
          serviceType: "خدمة تنظيف",
          quotes: [mockQuote]
        });

        // Update status to success
        setSendStatuses(prev => prev.map((s, idx) => 
          idx === i ? { ...s, status: 'success', message: 'تم الإرسال بنجاح' } : s
        ));

        toast.success(`تم إرسال الرسالة ${i + 1}/${totalMessages}`);

        // Wait for interval before next message (except last one)
        if (i < totalMessages - 1) {
          await new Promise(resolve => setTimeout(resolve, messageInterval * 1000));
        }

      } catch (err: any) {
        console.error(`❌ Error sending message ${i + 1}:`, err);
        
        // Update status to error
        setSendStatuses(prev => prev.map((s, idx) => 
          idx === i ? { ...s, status: 'error', message: err.message || 'فشل الإرسال' } : s
        ));

        toast.error(`فشل إرسال الرسالة ${i + 1}`, {
          description: err.message
        });
      }
    }

    setIsSending(false);
    toast.success("اكتمل الاختبار!", {
      description: `تم إرسال ${totalMessages} رسالة`
    });
  };

  const handleSendCarousel = async () => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      // Validate phone number
      if (!phoneNumber || phoneNumber.length < 10) {
        throw new Error("يرجى إدخال رقم هاتف صحيح");
      }

      // Validate order selection
      if (!selectedOrderId) {
        throw new Error("يرجى اختيار طلب من القائمة");
      }

      // Find the selected order
      const selectedOrder = ordersWithQuotes?.find(order => order.id === selectedOrderId);
      if (!selectedOrder) {
        throw new Error("الطلب المحدد غير موجود");
      }

      console.log("🚀 Starting carousel test...");
      console.log("📱 Phone:", phoneNumber);
      console.log("📋 Order:", selectedOrder.order_number);

      // Fetch quotes for the order
      const quotes = await fetchQuotesForOrder(selectedOrderId);
      
      if (quotes.length === 0) {
        throw new Error("لا توجد عروض متاحة لهذا الطلب");
      }

      console.log("💰 Found quotes:", quotes.length);

      // Send carousel
      const response = await sendWhatsAppCarouselToCustomer({
        customerPhone: phoneNumber,
        customerName: selectedOrder.customer_name || "العميل",
        orderNumber: selectedOrder.order_number,
        serviceType: selectedOrder.service_type,
        quotes
      });

      console.log("✅ Carousel sent successfully:", response);
      
      setResult({
        success: true,
        message: "تم إرسال Carousel بنجاح!",
        details: {
          order: selectedOrder.order_number,
          phone: phoneNumber,
          quotesCount: quotes.length,
          response: response
        }
      });

      toast.success("تم إرسال الرسالة بنجاح!", {
        description: `تم إرسال ${quotes.length} عروض إلى ${phoneNumber}`
      });

    } catch (err: any) {
      console.error("❌ Error sending carousel:", err);
      const errorMessage = err.message || "فشل إرسال Carousel";
      setError(errorMessage);
      
      setResult({
        success: false,
        message: errorMessage,
        details: err
      });

      toast.error("فشل إرسال الرسالة", {
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl" dir="rtl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-8 w-8 text-primary" />
            اختبار WhatsApp Carousel
          </h1>
          <p className="text-muted-foreground mt-2">
            إرسال رسائل carousel تجريبية مع عروض المحترفين
          </p>
        </div>

        {/* Setup Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>متطلبات الإعداد</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>قبل استخدام هذه الصفحة، تأكد من:</p>
            <ul className="list-disc list-inside space-y-1 mr-4">
              <li>إضافة <code className="bg-muted px-1 rounded">META_CATALOG_ID</code> في الإعدادات</li>
              <li>إضافة المحترفين كمنتجات في Meta Business Manager Catalog</li>
              <li>ربط الـ Catalog بحساب WhatsApp Business</li>
              <li>التأكد من وجود عروض أسعار (quotes) للطلبات</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Test Form */}
        <Card>
          <CardHeader>
            <CardTitle>إرسال Carousel تجريبي</CardTitle>
            <CardDescription>
              اختر طريقة الاختبار: سريع مع بيانات تجريبية أو من طلبات حقيقية
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="quick" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="quick">اختبار سريع</TabsTrigger>
                <TabsTrigger value="real">طلبات حقيقية</TabsTrigger>
              </TabsList>

              {/* Quick Test Tab */}
              <TabsContent value="quick" className="space-y-4 mt-4">
                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="quick-phone">رقم الهاتف (مع كود الدولة)</Label>
                  <Input
                    id="quick-phone"
                    type="tel"
                    placeholder="+966xxxxxxxxx"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    dir="ltr"
                  />
                </div>

                {/* Specialist Count */}
                <div className="space-y-2">
                  <Label htmlFor="specialist-count">عدد المحترفات (2-4)</Label>
                  <Select 
                    value={specialistCount.toString()} 
                    onValueChange={(v) => setSpecialistCount(parseInt(v))}
                  >
                    <SelectTrigger id="specialist-count">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 محترفات</SelectItem>
                      <SelectItem value="3">3 محترفات</SelectItem>
                      <SelectItem value="4">4 محترفات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Message Interval */}
                <div className="space-y-2">
                  <Label htmlFor="message-interval">الفترة الزمنية بين الرسائل (ثانية)</Label>
                  <Select 
                    value={messageInterval.toString()} 
                    onValueChange={(v) => setMessageInterval(parseInt(v))}
                  >
                    <SelectTrigger id="message-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">ثانية واحدة</SelectItem>
                      <SelectItem value="2">ثانيتان</SelectItem>
                      <SelectItem value="3">3 ثوانٍ</SelectItem>
                      <SelectItem value="5">5 ثوانٍ</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    سيتم إرسال {specialistCount} رسائل متتالية بفاصل {messageInterval} {messageInterval === 1 ? 'ثانية' : 'ثوانٍ'}
                  </p>
                </div>

                {/* Mock Specialists Preview */}
                <div className="space-y-2">
                  <Label>المحترفات التجريبية</Label>
                  <div className="grid gap-2">
                    {mockSpecialists.slice(0, specialistCount).map((specialist, idx) => (
                      <div key={specialist.id} className="flex items-center gap-3 p-2 border rounded-lg">
                        <img 
                          src={specialist.imageUrl} 
                          alt={specialist.name}
                          className="w-10 h-10 rounded-full"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{specialist.name}</p>
                          <p className="text-xs text-muted-foreground">{specialist.company}</p>
                        </div>
                        <Badge variant="secondary">{specialist.price} ر.س</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Send Status */}
                {sendStatuses.length > 0 && (
                  <div className="space-y-2">
                    <Label>حالة الإرسال</Label>
                    <div className="space-y-2">
                      {sendStatuses.map((status) => (
                        <div key={status.index} className="flex items-center gap-2 p-2 border rounded">
                          {status.status === 'pending' && <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                          {status.status === 'sending' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                          {status.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          {status.status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
                          
                          <span className="text-sm flex-1">
                            رسالة {status.index + 1}/{sendStatuses.length}
                            {status.message && ` - ${status.message}`}
                          </span>
                          
                          {status.timestamp && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(status.timestamp).toLocaleTimeString('ar-SA')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Send Button */}
                <Button
                  onClick={handleQuickTest}
                  disabled={isSending || !phoneNumber}
                  className="w-full"
                  size="lg"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الإرسال ({currentSendIndex + 1}/{specialistCount})...
                    </>
                  ) : (
                    <>
                      <Play className="ml-2 h-4 w-4" />
                      بدء الاختبار السريع
                    </>
                  )}
                </Button>
              </TabsContent>

              {/* Real Orders Tab */}
              <TabsContent value="real" className="space-y-4 mt-4">
                {/* Order Selection */}
                <div className="space-y-2">
                  <Label htmlFor="order-select">اختر الطلب</Label>
                  {loadingOrders ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>جاري تحميل الطلبات...</span>
                    </div>
                  ) : (
                    <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                      <SelectTrigger id="order-select">
                        <SelectValue placeholder="اختر طلب يحتوي على عروض" />
                      </SelectTrigger>
                      <SelectContent>
                        {ordersWithQuotes?.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            {order.order_number} - {order.service_type} ({order.quotesCount} عروض)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!loadingOrders && (!ordersWithQuotes || ordersWithQuotes.length === 0) && (
                    <p className="text-sm text-muted-foreground">
                      لا توجد طلبات تحتوي على عروض متعددة
                    </p>
                  )}
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="real-phone">رقم الهاتف (مع كود الدولة)</Label>
                  <Input
                    id="real-phone"
                    type="tel"
                    placeholder="+966xxxxxxxxx"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    مثال: +966501234567
                  </p>
                </div>

                {/* Send Button */}
                <Button
                  onClick={handleSendCarousel}
                  disabled={isLoading || !selectedOrderId || !phoneNumber}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    <>
                      <Send className="ml-2 h-4 w-4" />
                      إرسال Carousel
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Result Display */}
        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.success ? "نجح الإرسال!" : "فشل الإرسال"}
            </AlertTitle>
            <AlertDescription>
              <div className="space-y-2 mt-2">
                <p className="font-medium">{result.message}</p>
                {result.details && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      عرض التفاصيل
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-64">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">كيفية العمل</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <ol className="list-decimal list-inside space-y-2">
                <li>اختر طلب يحتوي على عروض أسعار من المحترفين</li>
                <li>أدخل رقم هاتف صحيح (يفضل رقمك الشخصي للاختبار)</li>
                <li>اضغط على "إرسال Carousel"</li>
                <li>ستصلك رسالة WhatsApp بها قائمة المحترفين</li>
                <li>كل محترف سيظهر ببطاقة تحتوي على صورته واسمه والسعر</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">استكشاف الأخطاء</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <ul className="list-disc list-inside space-y-2">
                <li>تأكد من إضافة META_CATALOG_ID في الأسرار</li>
                <li>تحقق من أن المحترفين موجودين في الـ Catalog</li>
                <li>تأكد من أن product_retailer_id يطابق specialist_id</li>
                <li>الصور يجب أن تكون متاحة عبر HTTPS</li>
                <li>الحد الأقصى 10 منتجات في الـ Carousel</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
