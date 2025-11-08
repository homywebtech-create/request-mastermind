import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { sendInteractiveWhatsAppMessage } from "@/lib/whatsappInteractiveHelper";
import { MessageSquare, Send, Plus, X } from "lucide-react";

interface ButtonData {
  id: string;
  name: string;
  price: string;
}

export default function WhatsAppInteractiveTest() {
  const [phoneNumber, setPhoneNumber] = useState("+966");
  const [message, setMessage] = useState("مرحباً! هذه رسالة تجريبية مع أزرار تفاعلية");
  const [buttons, setButtons] = useState<ButtonData[]>([
    { id: "1", name: "محترف 1", price: "25 ر.س/ساعة" },
    { id: "2", name: "محترف 2", price: "30 ر.س/ساعة" },
  ]);
  const [orderNumber, setOrderNumber] = useState("ORD-0001");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const addButton = () => {
    if (buttons.length >= 3) {
      toast({
        title: "الحد الأقصى للأزرار",
        description: "يمكنك إضافة 3 أزرار كحد أقصى",
        variant: "destructive",
      });
      return;
    }
    setButtons([...buttons, { id: `${buttons.length + 1}`, name: "", price: "" }]);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, field: 'name' | 'price', value: string) => {
    const newButtons = [...buttons];
    newButtons[index][field] = value;
    setButtons(newButtons);
  };

  const handleSend = async () => {
    if (!phoneNumber || phoneNumber === "+966") {
      toast({
        title: "خطأ",
        description: "يرجى إدخال رقم هاتف صحيح",
        variant: "destructive",
      });
      return;
    }

    if (!message) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال نص الرسالة",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const buttonData = buttons
        .filter(btn => btn.name && btn.price)
        .map(btn => ({
          specialistId: btn.id,
          name: btn.name,
          price: btn.price
        }));

      await sendInteractiveWhatsAppMessage({
        to: phoneNumber,
        message: message,
        buttons: buttonData.length > 0 ? buttonData : undefined,
        orderDetails: orderNumber ? {
          orderNumber: orderNumber,
          serviceType: "تنظيف"
        } : undefined
      });

      toast({
        title: "✅ تم الإرسال بنجاح",
        description: "تم إرسال رسالة WhatsApp التفاعلية بنجاح",
      });
    } catch (error: any) {
      console.error("Error sending WhatsApp:", error);
      toast({
        title: "خطأ في الإرسال",
        description: error.message || "فشل إرسال الرسالة",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4">
      <div className="max-w-3xl mx-auto space-y-6 py-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <MessageSquare className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">اختبار WhatsApp التفاعلي</h1>
          </div>
          <p className="text-muted-foreground">
            اختبر إرسال رسائل WhatsApp مع أزرار تفاعلية أفقية
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>معلومات الرسالة</CardTitle>
            <CardDescription>
              أدخل رقم الهاتف ونص الرسالة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف (مع رمز الدولة)</Label>
              <Input
                id="phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+966XXXXXXXXX"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                مثال: +966501234567
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderNumber">رقم الطلب (اختياري)</Label>
              <Input
                id="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="ORD-0001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">نص الرسالة</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="أدخل نص الرسالة..."
                rows={4}
                className="resize-none"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>الأزرار التفاعلية</CardTitle>
                <CardDescription>
                  يمكنك إضافة حتى 3 أزرار (اختياري)
                </CardDescription>
              </div>
              <Button
                onClick={addButton}
                disabled={buttons.length >= 3}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4 ml-2" />
                إضافة زر
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {buttons.map((button, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`button-name-${index}`} className="text-xs">
                      اسم الزر
                    </Label>
                    <Input
                      id={`button-name-${index}`}
                      value={button.name}
                      onChange={(e) => updateButton(index, 'name', e.target.value)}
                      placeholder="اسم المحترف"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`button-price-${index}`} className="text-xs">
                      السعر
                    </Label>
                    <Input
                      id={`button-price-${index}`}
                      value={button.price}
                      onChange={(e) => updateButton(index, 'price', e.target.value)}
                      placeholder="25 ر.س/ساعة"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => removeButton(index)}
                  variant="ghost"
                  size="icon"
                  className="mt-6 shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {buttons.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>لا توجد أزرار. اضغط "إضافة زر" لإضافة أزرار تفاعلية</p>
                <p className="text-xs mt-1">
                  سيتم إرسال رسالة نصية عادية بدون أزرار
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">معاينة الرسالة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
              <div className="text-sm font-semibold mb-2">
                📋 {orderNumber || "طلب جديد"}
              </div>
              <p className="text-sm whitespace-pre-wrap">{message || "لا يوجد نص"}</p>
            </div>
            {buttons.filter(btn => btn.name && btn.price).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {buttons
                  .filter(btn => btn.name && btn.price)
                  .map((btn, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="flex-1 min-w-0"
                      disabled
                    >
                      {btn.name} - {btn.price}
                    </Button>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          onClick={handleSend}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          <Send className="h-5 w-5 ml-2" />
          {isLoading ? "جاري الإرسال..." : "إرسال الرسالة"}
        </Button>

        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>ملاحظة:</strong> تأكد من تكوين معلومات WhatsApp Business API 
              في الإعدادات قبل إرسال الرسائل.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
