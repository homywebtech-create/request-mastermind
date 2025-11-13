import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, PlayCircle, Loader2 } from "lucide-react";

interface TestOrder {
  id: string;
  order_number: string;
  status: string;
  tracking_stage: string | null;
  waiting_started_at: string | null;
  waiting_ends_at: string | null;
}

export default function WaitingWorkflowTest() {
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [orderBefore, setOrderBefore] = useState<TestOrder | null>(null);
  const [orderAfter, setOrderAfter] = useState<TestOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"initial" | "waiting" | "working">("initial");
  const { toast } = useToast();

  const fetchOrder = async (orderId: string) => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, status, tracking_stage, waiting_started_at, waiting_ends_at")
      .eq("id", orderId)
      .single();

    if (error) throw error;
    return data as TestOrder;
  };

  const startTest = async () => {
    if (!selectedOrderId) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال رقم الطلب",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const order = await fetchOrder(selectedOrderId);
      setOrderBefore(order);
      setOrderAfter(null);
      setStep("initial");
      
      toast({
        title: "تم",
        description: "تم تحميل بيانات الطلب",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const simulateWaiting = async () => {
    if (!orderBefore) return;

    setLoading(true);
    try {
      const now = new Date().toISOString();
      const endsAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from("orders")
        .update({
          tracking_stage: "waiting",
          waiting_started_at: now,
          waiting_ends_at: endsAt,
        })
        .eq("id", orderBefore.id);

      if (error) throw error;

      const updated = await fetchOrder(orderBefore.id);
      setOrderAfter(updated);
      setStep("waiting");

      toast({
        title: "✅ بدء الانتظار",
        description: "تم تعيين حالة الانتظار بنجاح",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const simulateWorking = async () => {
    if (!orderAfter) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          tracking_stage: "working",
        })
        .eq("id", orderAfter.id);

      if (error) throw error;

      const updated = await fetchOrder(orderAfter.id);
      setOrderAfter(updated);
      setStep("working");

      // التحقق من تصفير الأوقات
      const cleared = !updated.waiting_started_at && !updated.waiting_ends_at;

      toast({
        title: cleared ? "✅ نجح الاختبار!" : "⚠️ فشل الاختبار",
        description: cleared 
          ? "تم تصفير أوقات الانتظار تلقائياً بواسطة الـ Trigger"
          : "لم يتم تصفير أوقات الانتظار - هناك مشكلة!",
        variant: cleared ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const OrderDataCard = ({ title, order, highlight }: { title: string; order: TestOrder | null; highlight?: string[] }) => (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {order ? (
        <div className="space-y-3">
          <div>
            <span className="text-sm text-muted-foreground">رقم الطلب:</span>
            <p className="font-mono">{order.order_number}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">الحالة:</span>
            <Badge variant="outline" className="mr-2">{order.status}</Badge>
          </div>
          <div className={highlight?.includes("tracking_stage") ? "bg-yellow-100 dark:bg-yellow-900/20 p-2 rounded" : ""}>
            <span className="text-sm text-muted-foreground">مرحلة التتبع:</span>
            <p className="font-mono">{order.tracking_stage || "null"}</p>
          </div>
          <div className={highlight?.includes("waiting_started_at") ? "bg-yellow-100 dark:bg-yellow-900/20 p-2 rounded" : ""}>
            <span className="text-sm text-muted-foreground">بداية الانتظار:</span>
            <p className="font-mono text-sm">
              {order.waiting_started_at ? new Date(order.waiting_started_at).toLocaleString("ar-SA") : "null"}
            </p>
          </div>
          <div className={highlight?.includes("waiting_ends_at") ? "bg-yellow-100 dark:bg-yellow-900/20 p-2 rounded" : ""}>
            <span className="text-sm text-muted-foreground">نهاية الانتظار:</span>
            <p className="font-mono text-sm">
              {order.waiting_ends_at ? new Date(order.waiting_ends_at).toLocaleString("ar-SA") : "null"}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-8">لا توجد بيانات</p>
      )}
    </Card>
  );

  const getTestResult = () => {
    if (step !== "working" || !orderAfter) return null;

    const cleared = !orderAfter.waiting_started_at && !orderAfter.waiting_ends_at;
    const workingStage = orderAfter.tracking_stage === "working";

    return (
      <Card className={`p-6 ${cleared && workingStage ? "bg-green-50 dark:bg-green-900/20 border-green-500" : "bg-red-50 dark:bg-red-900/20 border-red-500"}`}>
        <div className="flex items-start gap-4">
          {cleared && workingStage ? (
            <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
          ) : (
            <XCircle className="w-8 h-8 text-red-600 flex-shrink-0" />
          )}
          <div>
            <h3 className="text-lg font-bold mb-2">
              {cleared && workingStage ? "✅ نجح الاختبار!" : "❌ فشل الاختبار"}
            </h3>
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2">
                {workingStage ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                tracking_stage = "working" ✓
              </p>
              <p className="flex items-center gap-2">
                {!orderAfter.waiting_started_at ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                waiting_started_at = null {!orderAfter.waiting_started_at ? "✓" : "✗"}
              </p>
              <p className="flex items-center gap-2">
                {!orderAfter.waiting_ends_at ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                waiting_ends_at = null {!orderAfter.waiting_ends_at ? "✓" : "✗"}
              </p>
            </div>
            {cleared && workingStage && (
              <p className="mt-3 text-sm font-medium">
                الـ Trigger يعمل بشكل صحيح! تم تصفير أوقات الانتظار تلقائياً عند الانتقال لمرحلة العمل.
              </p>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">اختبار سيناريو الانتظار والعمل</h1>
        <p className="text-muted-foreground">
          اختبار تلقائي للتحقق من تصفير أوقات الانتظار عند بدء العمل
        </p>
      </div>

      {/* Input Section */}
      <Card className="p-6 mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="أدخل ID الطلب للاختبار"
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-md"
            dir="ltr"
          />
          <Button onClick={startTest} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
            تحميل الطلب
          </Button>
        </div>
      </Card>

      {/* Test Steps */}
      {orderBefore && (
        <div className="space-y-6 mb-6">
          <Card className="p-6 bg-blue-50 dark:bg-blue-900/20">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              خطوات الاختبار
            </h3>
            <div className="space-y-3">
              <Button
                onClick={simulateWaiting}
                disabled={loading || step !== "initial"}
                className="w-full"
                variant={step === "waiting" || step === "working" ? "outline" : "default"}
              >
                <PlayCircle className="w-4 h-4 ml-2" />
                1. محاكاة بدء الانتظار
              </Button>
              <Button
                onClick={simulateWorking}
                disabled={loading || step !== "waiting"}
                className="w-full"
                variant={step === "working" ? "outline" : "default"}
              >
                <PlayCircle className="w-4 h-4 ml-2" />
                2. محاكاة بدء العمل (والتحقق من التصفير)
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Results */}
      {orderBefore && (
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <OrderDataCard title="📋 البيانات الأولية" order={orderBefore} />
          <OrderDataCard 
            title="📝 البيانات بعد التغيير" 
            order={orderAfter} 
            highlight={step === "working" ? ["waiting_started_at", "waiting_ends_at", "tracking_stage"] : step === "waiting" ? ["waiting_started_at", "waiting_ends_at", "tracking_stage"] : []}
          />
        </div>
      )}

      {/* Test Result */}
      {getTestResult()}
    </div>
  );
}
