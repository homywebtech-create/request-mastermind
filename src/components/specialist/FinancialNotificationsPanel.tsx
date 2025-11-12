import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Wallet,
  Gift,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface PaymentConfirmation {
  id: string;
  order_id: string;
  invoice_amount: number;
  amount_received: number;
  difference_amount: number;
  difference_reason: string;
  status: string;
  customer_confirmed_at: string | null;
  created_at: string;
  orders?: {
    order_number: string | null;
  };
}

interface WalletTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  order_id: string | null;
}

interface FinancialNotificationsPanelProps {
  specialistId: string;
  currency?: string;
}

export function FinancialNotificationsPanel({
  specialistId,
  currency = "ر.ق",
}: FinancialNotificationsPanelProps) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = useTranslation(language);
  const isAr = language === "ar";

  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentConfirmations, setPaymentConfirmations] = useState<PaymentConfirmation[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFinancialData();
    setupRealtimeSubscriptions();
  }, [specialistId]);

  const fetchFinancialData = async () => {
    try {
      setIsLoading(true);

      // Fetch wallet balance
      const { data: specialist } = await supabase
        .from("specialists")
        .select("wallet_balance")
        .eq("id", specialistId)
        .single();

      if (specialist) {
        setWalletBalance(Number(specialist.wallet_balance) || 0);
      }

      // Fetch payment confirmations (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: confirmations } = await supabase
        .from("payment_confirmations")
        .select(
          `
          id,
          order_id,
          invoice_amount,
          amount_received,
          difference_amount,
          difference_reason,
          status,
          customer_confirmed_at,
          created_at,
          orders (
            order_number
          )
        `
        )
        .eq("specialist_id", specialistId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (confirmations) {
        setPaymentConfirmations(confirmations);
      }

      // Fetch wallet transactions (last 30 days)
      const { data: transactions } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("specialist_id", specialistId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (transactions) {
        setWalletTransactions(transactions);
      }
    } catch (error) {
      console.error("Error fetching financial data:", error);
      toast({
        title: isAr ? "خطأ" : "Error",
        description: isAr
          ? "فشل تحميل البيانات المالية"
          : "Failed to load financial data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Subscribe to payment confirmations changes
    const confirmationsChannel = supabase
      .channel("payment-confirmations-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payment_confirmations",
          filter: `specialist_id=eq.${specialistId}`,
        },
        () => {
          fetchFinancialData();
        }
      )
      .subscribe();

    // Subscribe to wallet transactions changes
    const transactionsChannel = supabase
      .channel("wallet-transactions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallet_transactions",
          filter: `specialist_id=eq.${specialistId}`,
        },
        () => {
          fetchFinancialData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(confirmationsChannel);
      supabase.removeChannel(transactionsChannel);
    };
  };

  const getStatusBadge = (confirmation: PaymentConfirmation) => {
    if (confirmation.difference_reason !== "tip") {
      return null;
    }

    if (confirmation.status === "confirmed") {
      return (
        <Badge className="bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          {isAr ? "مؤكدة" : "Confirmed"}
        </Badge>
      );
    } else if (confirmation.status === "rejected") {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          {isAr ? "مرفوضة" : "Rejected"}
        </Badge>
      );
    } else if (!confirmation.customer_confirmed_at) {
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-600">
          <Clock className="h-3 w-3 mr-1" />
          {isAr ? "معلقة" : "Pending"}
        </Badge>
      );
    }

    return null;
  };

  const getDifferenceCauseLabel = (cause: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      tip: { ar: "إكرامية", en: "Tip" },
      wallet: { ar: "محفظة العميل", en: "Customer Wallet" },
      no_change: { ar: "لا يوجد باقي", en: "No Change" },
      matching: { ar: "مطابق", en: "Matching" },
      other: { ar: "سبب آخر", en: "Other" },
    };

    return labels[cause]?.[isAr ? "ar" : "en"] || cause;
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      tip: { ar: "إكرامية", en: "Tip" },
      compensation: { ar: "تعويض", en: "Compensation" },
      payment: { ar: "دفع", en: "Payment" },
      deduction: { ar: "خصم", en: "Deduction" },
      adjustment: { ar: "تعديل", en: "Adjustment" },
    };

    return labels[type]?.[isAr ? "ar" : "en"] || type;
  };

  const pendingTips = paymentConfirmations.filter(
    (c) => c.difference_reason === "tip" && !c.customer_confirmed_at
  );
  const confirmedTips = paymentConfirmations.filter(
    (c) => c.difference_reason === "tip" && c.status === "confirmed"
  );
  const rejectedTips = paymentConfirmations.filter(
    (c) => c.difference_reason === "tip" && c.status === "rejected"
  );

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Wallet Balance Summary */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              {isAr ? "رصيد المحفظة" : "Wallet Balance"}
            </p>
            <p className="text-3xl font-bold">
              {walletBalance.toFixed(2)} {currency}
            </p>
          </div>
          <div className="p-4 bg-primary/20 rounded-full">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center text-amber-600 mb-1">
              <Clock className="h-4 w-4 mr-1" />
            </div>
            <p className="text-xs text-muted-foreground">
              {isAr ? "إكراميات معلقة" : "Pending Tips"}
            </p>
            <p className="font-bold">{pendingTips.length}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center text-green-600 mb-1">
              <CheckCircle className="h-4 w-4 mr-1" />
            </div>
            <p className="text-xs text-muted-foreground">
              {isAr ? "إكراميات مؤكدة" : "Confirmed Tips"}
            </p>
            <p className="font-bold">{confirmedTips.length}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center text-red-600 mb-1">
              <XCircle className="h-4 w-4 mr-1" />
            </div>
            <p className="text-xs text-muted-foreground">
              {isAr ? "إكراميات مرفوضة" : "Rejected Tips"}
            </p>
            <p className="font-bold">{rejectedTips.length}</p>
          </div>
        </div>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="confirmations" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="confirmations">
            <Gift className="h-4 w-4 mr-2" />
            {isAr ? "تأكيدات الدفع" : "Payment Confirmations"}
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <TrendingUp className="h-4 w-4 mr-2" />
            {isAr ? "المعاملات" : "Transactions"}
          </TabsTrigger>
        </TabsList>

        {/* Payment Confirmations Tab */}
        <TabsContent value="confirmations">
          <Card>
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-3">
                {paymentConfirmations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {isAr ? "لا توجد عمليات دفع" : "No payment confirmations"}
                  </div>
                ) : (
                  paymentConfirmations.map((confirmation) => (
                    <Card key={confirmation.id} className="p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {isAr ? "طلب" : "Order"} #
                              {confirmation.orders?.order_number || confirmation.order_id.slice(-6)}
                            </span>
                            {getStatusBadge(confirmation)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {getDifferenceCauseLabel(confirmation.difference_reason)}
                          </p>
                        </div>
                        <div className="text-right">
                          {confirmation.difference_amount > 0 && (
                            <p className="text-lg font-bold text-green-600">
                              +{confirmation.difference_amount.toFixed(2)} {currency}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t">
                        <span>
                          {isAr ? "الفاتورة:" : "Invoice:"} {confirmation.invoice_amount.toFixed(2)}{" "}
                          {currency}
                        </span>
                        <span>
                          {format(new Date(confirmation.created_at), "dd MMM yyyy, HH:mm", {
                            locale: isAr ? ar : undefined,
                          })}
                        </span>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* Wallet Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-3">
                {walletTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {isAr ? "لا توجد معاملات" : "No transactions"}
                  </div>
                ) : (
                  walletTransactions.map((transaction) => (
                    <Card key={transaction.id} className="p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="h-4 w-4 text-primary" />
                            <span className="font-medium">
                              {getTransactionTypeLabel(transaction.transaction_type)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {transaction.description}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p
                            className={`text-lg font-bold ${
                              transaction.amount >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {transaction.amount >= 0 ? "+" : ""}
                            {transaction.amount.toFixed(2)} {currency}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isAr ? "الرصيد:" : "Balance:"} {transaction.balance_after.toFixed(2)}{" "}
                            {currency}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground pt-2 border-t mt-2">
                        {format(new Date(transaction.created_at), "dd MMM yyyy, HH:mm", {
                          locale: isAr ? ar : undefined,
                        })}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
