import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, CheckCircle2, XCircle, AlertCircle, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { fetchQuotesForOrder, sendWhatsAppCarouselToCustomer } from "@/lib/whatsappCarousel";

export default function WhatsAppCarouselTest() {
  const [phoneNumber, setPhoneNumber] = useState("+966");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
              اختر طلب يحتوي على عروض وأدخل رقم الهاتف للاختبار
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label htmlFor="phone">رقم الهاتف (مع كود الدولة)</Label>
              <Input
                id="phone"
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
