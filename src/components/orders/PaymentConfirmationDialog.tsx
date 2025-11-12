import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, AlertCircle } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

interface PaymentConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  invoiceAmount: number;
  customerId: string;
  specialistId: string;
  currency: string;
  onSuccess: () => void;
}

type DialogStep = "initial" | "amount_input" | "processing";
type DifferenceCause = "tip" | "wallet" | "no_change" | "other" | "";

export function PaymentConfirmationDialog({
  open,
  onOpenChange,
  orderId,
  invoiceAmount,
  customerId,
  specialistId,
  currency,
  onSuccess,
}: PaymentConfirmationDialogProps) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = useTranslation(language);
  const isAr = language === "ar";

  const [step, setStep] = useState<DialogStep>("initial");
  const [amountReceived, setAmountReceived] = useState("");
  const [differenceCause, setDifferenceCause] = useState<DifferenceCause>("");
  const [otherReason, setOtherReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInitialResponse = (isMatching: boolean) => {
    if (isMatching) {
      // المبلغ مطابق - تسجيل مباشر
      handleConfirmPayment(invoiceAmount, "matching");
    } else {
      // المبلغ مختلف - الانتقال لإدخال المبلغ
      setStep("amount_input");
    }
  };

  const handleConfirmPayment = async (
    amount: number,
    cause: string,
    additionalNote?: string
  ) => {
    setIsSubmitting(true);
    setStep("processing");

    try {
      const difference = amount - invoiceAmount;

      // 1. إنشاء سجل تأكيد الدفع
      const { data: confirmationData, error: confirmationError } = await supabase
        .from("payment_confirmations")
        .insert({
          order_id: orderId,
          specialist_id: specialistId,
          customer_id: customerId,
          invoice_amount: invoiceAmount,
          amount_received: amount,
          difference_amount: difference,
          difference_cause: cause,
          notes: additionalNote || null,
        })
        .select()
        .single();

      if (confirmationError) throw confirmationError;

      // 2. تحديث حالة الطلب
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          payment_status: "received",
          payment_confirmed_at: new Date().toISOString(),
          payment_confirmation_id: confirmationData.id,
        })
        .eq("id", orderId);

      if (orderError) throw orderError;

      // 3. معالجة المحفظة حسب السبب
      if (cause === "tip" && difference > 0) {
        // إضافة الإكرامية لرصيد المحترف (منطق يمكن إضافته لاحقاً)
        toast({
          title: isAr ? "✅ تم تسجيل الإكرامية" : "✅ Tip Recorded",
          description: isAr
            ? `تم إضافة ${difference} ${currency} كإكرامية`
            : `${difference} ${currency} added as tip`,
        });
      } else if ((cause === "wallet" || cause === "no_change") && difference > 0) {
        // التحقق من وجود محفظة للعميل أو إنشاؤها
        const { data: existingWallet } = await supabase
          .from("customer_wallets")
          .select("id, balance")
          .eq("customer_id", customerId)
          .single();

        if (existingWallet) {
          // تحديث رصيد المحفظة
          const { error: walletError } = await supabase
            .from("customer_wallets")
            .update({
              balance: existingWallet.balance + difference,
            })
            .eq("id", existingWallet.id);

          if (walletError) throw walletError;
        } else {
          // إنشاء محفظة جديدة
          const { error: walletError } = await supabase
            .from("customer_wallets")
            .insert({
              customer_id: customerId,
              balance: difference,
            });

          if (walletError) throw walletError;
        }

        // تسجيل المعاملة
        const { error: transactionError } = await supabase
          .from("customer_wallet_transactions")
          .insert({
            customer_id: customerId,
            payment_confirmation_id: confirmationData.id,
            order_id: orderId,
            transaction_type: "credit",
            amount: difference,
            balance_after: (existingWallet?.balance || 0) + difference,
            description: isAr
              ? `فائض دفع من الطلب #${orderId.slice(-6)}`
              : `Payment surplus from order #${orderId.slice(-6)}`,
          });

        if (transactionError) throw transactionError;
      }

      // 4. إرسال رسالة واتساب للعميل
      await sendWhatsAppNotification(amount, difference, cause);

      // نجاح العملية
      toast({
        title: isAr ? "✅ تم تأكيد الدفع" : "✅ Payment Confirmed",
        description: isAr
          ? "تم تسجيل الدفع بنجاح"
          : "Payment recorded successfully",
      });

      // إعادة تعيين الحالة وإغلاق الdialog
      resetDialog();
      onSuccess();
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast({
        title: isAr ? "❌ خطأ" : "❌ Error",
        description: isAr
          ? "فشل تأكيد الدفع. حاول مرة أخرى"
          : "Failed to confirm payment. Try again",
        variant: "destructive",
      });
      setStep("initial");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendWhatsAppNotification = async (
    amount: number,
    difference: number,
    cause: string
  ) => {
    try {
      let message = "";
      
      if (cause === "matching") {
        message = isAr
          ? `✅ تم استلام دفعتك للطلب رقم #${orderId.slice(-6)} بنجاح.\n\nالمبلغ: ${amount} ${currency}\n\nشكراً لاستخدامك خدماتنا 🌟`
          : `✅ Your payment for order #${orderId.slice(-6)} has been received successfully.\n\nAmount: ${amount} ${currency}\n\nThank you for using our services 🌟`;
      } else if (cause === "tip") {
        message = isAr
          ? `✅ تم استلام دفعتك للطلب رقم #${orderId.slice(-6)}.\n\nالمبلغ المستلم: ${amount} ${currency}\nقيمة الفاتورة: ${invoiceAmount} ${currency}\n\n💰 هل تؤكد أن المبلغ الإضافي (${difference} ${currency}) هو إكرامية للمحترف؟\n\nفي حال لم يتم الرد خلال 24 ساعة، سيتم اعتبارها إكرامية تلقائياً.`
          : `✅ Payment received for order #${orderId.slice(-6)}.\n\nAmount received: ${amount} ${currency}\nInvoice amount: ${invoiceAmount} ${currency}\n\n💰 Do you confirm that the additional amount (${difference} ${currency}) is a tip for the specialist?\n\nIf no response within 24 hours, it will be automatically considered as a tip.`;
      } else if (cause === "wallet" || cause === "no_change") {
        message = isAr
          ? `✅ تم استلام دفعتك للطلب رقم #${orderId.slice(-6)}.\n\nالمبلغ المستلم: ${amount} ${currency}\nقيمة الفاتورة: ${invoiceAmount} ${currency}\n\n💳 تم حفظ المبلغ الإضافي (${difference} ${currency}) في محفظتك لاستخدامه في الطلبات المستقبلية.\n\n⚠️ المبلغ غير قابل للاسترجاع نقداً، لكنه متاح كرصيد في طلباتك القادمة.`
          : `✅ Payment received for order #${orderId.slice(-6)}.\n\nAmount received: ${amount} ${currency}\nInvoice amount: ${invoiceAmount} ${currency}\n\n💳 The additional amount (${difference} ${currency}) has been saved in your wallet for future orders.\n\n⚠️ This amount cannot be refunded in cash, but is available as credit for your next orders.`;
      } else if (cause === "other") {
        message = isAr
          ? `⚠️ تم استلام دفعتك للطلب رقم #${orderId.slice(-6)}.\n\nالمبلغ المستلم: ${amount} ${currency}\nقيمة الفاتورة: ${invoiceAmount} ${currency}\n\nتم تسجيل فارق في المبلغ وسيتم مراجعته من قبل الإدارة.`
          : `⚠️ Payment received for order #${orderId.slice(-6)}.\n\nAmount received: ${amount} ${currency}\nInvoice amount: ${invoiceAmount} ${currency}\n\nA payment difference has been recorded and will be reviewed by management.`;
      }

      // استدعاء دالة إرسال الواتساب
      const { data: orderData } = await supabase
        .from("orders")
        .select("customers(whatsapp_number)")
        .eq("id", orderId)
        .single();

      if (orderData && orderData.customers) {
        const whatsappNumber = (orderData.customers as any).whatsapp_number;
        
        await supabase.functions.invoke("send-whatsapp", {
          body: {
            to: whatsappNumber,
            message: message,
          },
        });
      }
    } catch (error) {
      console.error("Error sending WhatsApp notification:", error);
      // لا نريد إيقاف العملية بسبب فشل إرسال الرسالة
    }
  };

  const handleSubmitAmount = () => {
    const amount = parseFloat(amountReceived);

    if (isNaN(amount) || amount <= 0) {
      toast({
        title: isAr ? "❌ خطأ" : "❌ Error",
        description: isAr
          ? "الرجاء إدخال مبلغ صحيح"
          : "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (!differenceCause) {
      toast({
        title: isAr ? "❌ خطأ" : "❌ Error",
        description: isAr
          ? "الرجاء اختيار سبب الفارق"
          : "Please select a reason for the difference",
        variant: "destructive",
      });
      return;
    }

    if (differenceCause === "other" && !otherReason.trim()) {
      toast({
        title: isAr ? "❌ خطأ" : "❌ Error",
        description: isAr
          ? "الرجاء كتابة السبب"
          : "Please write the reason",
        variant: "destructive",
      });
      return;
    }

    handleConfirmPayment(amount, differenceCause, otherReason || undefined);
  };

  const resetDialog = () => {
    setStep("initial");
    setAmountReceived("");
    setDifferenceCause("");
    setOtherReason("");
    setIsSubmitting(false);
    onOpenChange(false);
  };

  const difference = amountReceived ? parseFloat(amountReceived) - invoiceAmount : 0;

  return (
    <Dialog open={open} onOpenChange={resetDialog}>
      <DialogContent className="max-w-md">
        {step === "initial" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {isAr ? "💰 تأكيد استلام الدفع" : "💰 Confirm Payment Receipt"}
              </DialogTitle>
              <DialogDescription className="text-base pt-2">
                {isAr
                  ? `هل المبلغ الذي دفعه العميل يطابق قيمة الفاتورة وقدرها ${invoiceAmount} ${currency}؟`
                  : `Does the amount paid by the customer match the invoice amount of ${invoiceAmount} ${currency}?`}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 pt-4">
              <Button
                onClick={() => handleInitialResponse(true)}
                className="h-14 text-base bg-green-600 hover:bg-green-700"
                disabled={isSubmitting}
              >
                <CheckCircle className="ml-2 h-5 w-5" />
                {isAr ? "✅ نعم، المبلغ مطابق" : "✅ Yes, Amount Matches"}
              </Button>

              <Button
                onClick={() => handleInitialResponse(false)}
                variant="outline"
                className="h-14 text-base border-amber-500 text-amber-600 hover:bg-amber-50"
                disabled={isSubmitting}
              >
                <AlertCircle className="ml-2 h-5 w-5" />
                {isAr ? "⚠️ لا، المبلغ مختلف" : "⚠️ No, Different Amount"}
              </Button>
            </div>
          </>
        )}

        {step === "amount_input" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {isAr ? "💵 إدخال المبلغ المستلم" : "💵 Enter Received Amount"}
              </DialogTitle>
              <DialogDescription>
                {isAr
                  ? `قيمة الفاتورة: ${invoiceAmount} ${currency}`
                  : `Invoice amount: ${invoiceAmount} ${currency}`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="amount">
                  {isAr ? "المبلغ المستلم فعلياً" : "Actual Amount Received"}
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  placeholder={isAr ? "أدخل المبلغ" : "Enter amount"}
                  className="text-lg h-12"
                />
                {amountReceived && difference !== 0 && (
                  <p
                    className={cn(
                      "text-sm font-medium",
                      difference > 0 ? "text-green-600" : "text-red-600"
                    )}
                  >
                    {difference > 0 ? "+" : ""}
                    {difference.toFixed(2)} {currency}
                  </p>
                )}
              </div>

              {amountReceived && difference !== 0 && (
                <div className="space-y-3">
                  <Label>
                    {isAr
                      ? "هل المبلغ الزائد كان بسبب أحد الأسباب التالية؟"
                      : "Was the extra amount due to one of the following reasons?"}
                  </Label>
                  <RadioGroup value={differenceCause} onValueChange={(value) => setDifferenceCause(value as DifferenceCause)}>
                    <div className="flex items-start space-x-2 space-x-reverse p-3 border rounded-lg hover:bg-accent">
                      <RadioGroupItem value="tip" id="tip" />
                      <Label htmlFor="tip" className="cursor-pointer flex-1">
                        <span className="font-medium">
                          {isAr ? "💰 إكرامية من العميل" : "💰 Tip from Customer"}
                        </span>
                      </Label>
                    </div>

                    <div className="flex items-start space-x-2 space-x-reverse p-3 border rounded-lg hover:bg-accent">
                      <RadioGroupItem value="wallet" id="wallet" />
                      <Label htmlFor="wallet" className="cursor-pointer flex-1">
                        <span className="font-medium">
                          {isAr
                            ? "💳 العميل يرغب في حفظها بمحفظته"
                            : "💳 Customer Wants to Save in Wallet"}
                        </span>
                      </Label>
                    </div>

                    <div className="flex items-start space-x-2 space-x-reverse p-3 border rounded-lg hover:bg-accent">
                      <RadioGroupItem value="no_change" id="no_change" />
                      <Label htmlFor="no_change" className="cursor-pointer flex-1">
                        <span className="font-medium">
                          {isAr
                            ? "💵 لا أملك الباقي لإرجاعه"
                            : "💵 Don't Have Change to Return"}
                        </span>
                      </Label>
                    </div>

                    <div className="flex items-start space-x-2 space-x-reverse p-3 border rounded-lg hover:bg-accent">
                      <RadioGroupItem value="other" id="other" />
                      <Label htmlFor="other" className="cursor-pointer flex-1">
                        <span className="font-medium">
                          {isAr ? "📝 سبب آخر" : "📝 Other Reason"}
                        </span>
                      </Label>
                    </div>
                  </RadioGroup>

                  {differenceCause === "other" && (
                    <div className="space-y-2">
                      <Label htmlFor="other-reason">
                        {isAr ? "اذكر السبب" : "Specify Reason"}
                      </Label>
                      <Textarea
                        id="other-reason"
                        value={otherReason}
                        onChange={(e) => setOtherReason(e.target.value)}
                        placeholder={isAr ? "اكتب السبب هنا..." : "Write reason here..."}
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetDialog} disabled={isSubmitting}>
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={handleSubmitAmount} disabled={isSubmitting}>
                {isSubmitting
                  ? isAr
                    ? "جاري التأكيد..."
                    : "Confirming..."
                  : isAr
                  ? "تأكيد الدفع"
                  : "Confirm Payment"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
            <p className="text-lg font-medium">
              {isAr ? "جاري تسجيل الدفع..." : "Processing payment..."}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
