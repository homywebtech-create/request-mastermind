import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function WhatsAppTest() {
  const [phoneNumber, setPhoneNumber] = useState("+974");
  const [message, setMessage] = useState("مرحباً! هذه رسالة اختبار من نظام النمليات للتنظيف.");
  const [useTemplate, setUseTemplate] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const handleSendMessage = async () => {
    // Validate phone number
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال رقم هاتف صحيح",
        variant: "destructive",
      });
      return;
    }

    if (!useTemplate && !message.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال نص الرسالة",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      console.log('📱 Sending WhatsApp test message...');
      console.log('📱 To:', phoneNumber);
      console.log('📱 Use Template:', useTemplate);

      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: useTemplate ? {
          to: phoneNumber,
          useTemplate: true,
          templateName: 'hello_world',
          templateLanguage: 'en_US',
        } : {
          to: phoneNumber,
          message: message,
        },
      });

      if (error) {
        console.error('❌ Error sending WhatsApp:', error);
        setResult({
          success: false,
          message: 'فشل إرسال الرسالة',
          details: error,
        });
        toast({
          title: "❌ فشل الإرسال",
          description: error.message || "حدث خطأ أثناء إرسال الرسالة",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ WhatsApp message sent:', data);
      setResult({
        success: true,
        message: 'تم إرسال الرسالة بنجاح!',
        details: data,
      });
      
      toast({
        title: "✅ تم الإرسال بنجاح",
        description: `تم إرسال الرسالة إلى ${phoneNumber}`,
      });

    } catch (err: any) {
      console.error('❌ Unexpected error:', err);
      setResult({
        success: false,
        message: 'حدث خطأ غير متوقع',
        details: err,
      });
      toast({
        title: "❌ خطأ",
        description: err.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">اختبار إرسال واتساب</h1>
          <p className="text-muted-foreground">
            اختبر إرسال رسالة واتساب من خلال Twilio WhatsApp Sender
          </p>
        </div>

        {/* Test Form */}
        <Card>
          <CardHeader>
            <CardTitle>إرسال رسالة اختبار</CardTitle>
            <CardDescription>
              أدخل رقم الهاتف ونص الرسالة لإرسال رسالة اختبار
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف (بصيغة دولية)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+974XXXXXXXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                dir="ltr"
                className="text-left"
              />
              <p className="text-xs text-muted-foreground">
                مثال: +97431260001 (يجب أن يبدأ بـ +)
              </p>
            </div>

            {/* Template Toggle */}
            <div className="flex items-center space-x-2 space-x-reverse p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <input
                type="checkbox"
                id="useTemplate"
                checked={useTemplate}
                onChange={(e) => setUseTemplate(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="useTemplate" className="cursor-pointer">
                استخدام قالب "hello_world" (معتمد مسبقاً من Meta)
              </Label>
            </div>

            {/* Message - only show if not using template */}
            {!useTemplate && (
              <div className="space-y-2">
                <Label htmlFor="message">نص الرسالة</Label>
                <Textarea
                  id="message"
                  placeholder="أدخل نص الرسالة..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  عدد الأحرف: {message.length}
                </p>
              </div>
            )}

            {/* Send Button */}
            <Button
              onClick={handleSendMessage}
              disabled={isLoading}
              className="w-full h-12 text-base"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  إرسال الرسالة
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <Alert
            variant={result.success ? "default" : "destructive"}
            className={result.success ? "border-green-500 bg-green-50 dark:bg-green-950/30" : ""}
          >
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 mt-0.5" />
              )}
              <div className="flex-1 space-y-2">
                <AlertDescription className="font-medium text-base">
                  {result.message}
                </AlertDescription>
                
                {result.details && (
                  <div className="mt-3 p-3 bg-black/5 dark:bg-white/5 rounded-md">
                    <p className="text-xs font-mono mb-2 font-semibold">تفاصيل الاستجابة:</p>
                    <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </Alert>
        )}

        {/* Info Card */}
        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100">📋 معلومات مهمة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-900 dark:text-blue-100">
            <p>• يجب أن يكون رقم الهاتف بالصيغة الدولية بدون مسافات (+رمز الدولة + الرقم)</p>
            <p>• الرسائل تُرسل من خلال Twilio WhatsApp Sender (+97431260001)</p>
            <p>• تحقق من سجلات Twilio في حالة فشل الإرسال</p>
          </CardContent>
        </Card>

        {/* Warning Card */}
        <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950/30">
          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertTitle className="text-orange-900 dark:text-orange-100">
            ⚠️ السبب الأكثر احتمالاً: Display Name قيد المراجعة
          </AlertTitle>
          <AlertDescription className="space-y-2 text-orange-900 dark:text-orange-100">
            <p className="font-semibold mt-2">✅ إذا ظهرت رسالة "queued" ولم تصل الرسالة:</p>
            <div className="space-y-2 mr-4 mt-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-md">
                <p className="font-semibold text-base">🔴 المشكلة الرئيسية:</p>
                <p className="text-sm mt-1">اسم العرض "alnamilat general services" قيد المراجعة من Meta/WhatsApp</p>
                <p className="text-sm mt-1">حتى تتم الموافقة، لن تُرسل الرسائل للمستخدمين</p>
              </div>
              
              <p className="font-semibold mt-4">أسباب إضافية محتملة:</p>
              <p>1️⃣ <span className="font-semibold">حساب Trial:</span> الرقم المستلم يجب تسجيله في Twilio WhatsApp Sandbox</p>
              <p>2️⃣ <span className="font-semibold">Message Templates:</span> يجب استخدام قوالب معتمدة من Meta (ليس رسائل حرة)</p>
              <p>3️⃣ <span className="font-semibold">Business Profile:</span> يحتاج إكمال معلومات الـ Business Profile في Meta</p>
              <p>4️⃣ <span className="font-semibold">رقم خاطئ:</span> الرقم المستلم ليس لديه واتساب أو غير صحيح</p>
            </div>
            <div className="mt-3 p-3 bg-green-100 dark:bg-green-900/30 rounded-md border border-green-300 dark:border-green-700">
              <p className="font-semibold text-green-900 dark:text-green-100">💡 الحل الموصى به:</p>
              <p className="text-sm text-green-900 dark:text-green-100 mt-1">• تحقق من Twilio Console → Messaging → Senders</p>
              <p className="text-sm text-green-900 dark:text-green-100">• تأكد من اكتمال مراجعة Display Name من Meta</p>
              <p className="text-sm text-green-900 dark:text-green-100">• أو استخدم Twilio Sandbox للاختبار مع أرقام مسجلة</p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
