import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, ArrowDownCircle, Receipt, Calendar, Hash, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialNotificationsPanel } from "@/components/specialist/FinancialNotificationsPanel";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { ReadinessCheckDialog } from "@/components/specialist/ReadinessCheckDialog";
import BottomNavigation from "@/components/specialist/BottomNavigation";
import { useReadinessCheckMonitor } from "@/hooks/useReadinessCheckMonitor";

interface Transaction {
  id: string;
  amount: number;
  transaction_type: 'deduction' | 'topup' | 'refund';
  balance_after: number;
  description: string | null;
  invoice_details: any;
  created_at: string;
  order_id: string | null;
  orders: {
    order_number: string;
  } | null;
}

export default function SpecialistWallet() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [specialistId, setSpecialistId] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('ar');
  const [selectedInvoice, setSelectedInvoice] = useState<Transaction | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Monitor for pending readiness checks
  useReadinessCheckMonitor();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!specialistId) return;
    fetchWalletData();
    fetchNewOrdersCount();

    const channel = supabase
      .channel('wallet-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions',
          filter: `specialist_id=eq.${specialistId}`
        },
        () => {
          fetchWalletData();
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
        .select('phone')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        const { data: specialist } = await supabase
          .from('specialists')
          .select('id, preferred_language, is_active, suspension_type, wallet_balance')
          .eq('phone', profile.phone)
          .single();

        if (specialist) {
          if (!specialist.is_active && specialist.suspension_type === 'permanent') {
            await supabase.auth.signOut();
            toast({
              title: "حساب موقوف نهائياً 🚫",
              description: 'تم إيقاف حسابك بشكل نهائي.',
              variant: "destructive",
            });
            navigate('/specialist-auth');
            return;
          }

          setSpecialistId(specialist.id);
          setBalance(Number(specialist.wallet_balance || 0));
          setPreferredLanguage(specialist.preferred_language || 'ar');
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/specialist-auth');
    }
  };

  const fetchWalletData = async () => {
    try {
      setIsLoading(true);

      const { data: specialist } = await supabase
        .from('specialists')
        .select('wallet_balance')
        .eq('id', specialistId)
        .single();

      if (specialist) {
        setBalance(Number(specialist.wallet_balance || 0));
      }

      const { data: transactionsData } = await supabase
        .from('wallet_transactions')
        .select(`
          *,
          orders (
            order_number
          )
        `)
        .eq('specialist_id', specialistId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (transactionsData) {
        setTransactions(transactionsData as Transaction[]);
      }
    } catch (error: any) {
      console.error('Error fetching wallet data:', error);
      toast({
        title: "خطأ",
        description: "فشل تحميل بيانات المحفظة",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNewOrdersCount = async () => {
    try {
      const now = new Date().toISOString();
      
      const { data: orderSpecialists } = await supabase
        .from('order_specialists')
        .select(`
          *,
          orders!inner (
            expires_at
          )
        `)
        .eq('specialist_id', specialistId);

      if (orderSpecialists) {
        const newOrders = orderSpecialists.filter((os: any) => {
          if (os.quoted_price || os.rejected_at) return false;
          const expiresAt = os.orders?.expires_at;
          if (!expiresAt) return true;
          return new Date(expiresAt) > new Date(now);
        }).length;

        setNewOrdersCount(newOrders);
      }
    } catch (error) {
      console.error('Error fetching new orders count:', error);
    }
  };

  const handleTopUp = () => {
    toast({
      title: "قريباً",
      description: "ميزة شحن الرصيد ستكون متاحة قريباً",
    });
  };

  const handleViewInvoice = (transaction: Transaction) => {
    setSelectedInvoice(transaction);
    setShowInvoiceDialog(true);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deduction':
        return <ArrowDownCircle className="h-5 w-5 text-red-500" />;
      case 'topup':
        return <Plus className="h-5 w-5 text-green-500" />;
      case 'refund':
        return <Plus className="h-5 w-5 text-blue-500" />;
      default:
        return <Wallet className="h-5 w-5" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'deduction':
        return 'استقطاع';
      case 'topup':
        return 'شحن رصيد';
      case 'refund':
        return 'استرداد';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-foreground font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 text-white p-6 shadow-lg">
        <div className="max-w-screen-lg mx-auto">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/specialist/home')}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-2xl font-bold">المحفظة</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Balance Card */}
      <div className="max-w-screen-lg mx-auto p-4">
        <Card className="bg-gradient-to-br from-purple-500 to-pink-500 text-white border-none shadow-xl mb-6 animate-fade-in">
          <div className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                  <Wallet className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <p className="text-sm opacity-90">رصيدك الحالي</p>
                  <p className="text-4xl font-bold">{balance.toFixed(2)} ريال</p>
                </div>
              </div>
              <Button 
                onClick={handleTopUp}
                className="w-full bg-white text-purple-600 hover:bg-white/90 font-semibold py-6 text-lg"
              >
                <Plus className="h-5 w-5 ml-2" />
                شحن رصيد
              </Button>
            </div>
          </div>
        </Card>

        {/* Tabs for Transactions and Financial Notifications */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/20 backdrop-blur-sm">
            <TabsTrigger value="transactions" className="text-white data-[state=active]:bg-white/30">
              <Receipt className="h-4 w-4 ml-2" />
              آخر المعاملات
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-white data-[state=active]:bg-white/30">
              <Wallet className="h-4 w-4 ml-2" />
              الإشعارات المالية
            </TabsTrigger>
          </TabsList>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-3 mt-4">
            {transactions.length === 0 ? (
              <Card className="bg-white/90 backdrop-blur-sm p-8 text-center animate-fade-in">
                <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">لا توجد معاملات حتى الآن</p>
              </Card>
            ) : (
              transactions.map((transaction, index) => (
                <Card 
                  key={transaction.id}
                  className="bg-white/90 backdrop-blur-sm border-white/30 hover:shadow-lg transition-all cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => handleViewInvoice(transaction)}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded-full">
                          {getTransactionIcon(transaction.transaction_type)}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {getTransactionLabel(transaction.transaction_type)}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                            </span>
                            {transaction.orders?.order_number && (
                              <span className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                {transaction.orders.order_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className={`text-xl font-bold ${
                          transaction.transaction_type === 'deduction' 
                            ? 'text-red-500' 
                            : 'text-green-500'
                        }`}>
                          {transaction.transaction_type === 'deduction' ? '-' : '+'}
                          {Math.abs(transaction.amount).toFixed(2)} ريال
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          الرصيد: {transaction.balance_after.toFixed(2)} ريال
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Financial Notifications Tab */}
          <TabsContent value="notifications" className="mt-4">
            {specialistId && (
              <FinancialNotificationsPanel
                specialistId={specialistId}
                currency="ريال"
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Invoice Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              تفاصيل الفاتورة
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white p-4 rounded-lg">
                <p className="text-sm opacity-90 mb-1">المبلغ</p>
                <p className="text-3xl font-bold">
                  {Math.abs(selectedInvoice.amount).toFixed(2)} ريال
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">نوع المعاملة</span>
                  <span className="font-semibold">{getTransactionLabel(selectedInvoice.transaction_type)}</span>
                </div>

                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">التاريخ والوقت</span>
                  <span className="font-semibold">
                    {format(new Date(selectedInvoice.created_at), 'dd/MM/yyyy - HH:mm', { locale: ar })}
                  </span>
                </div>

                {selectedInvoice.orders?.order_number && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">رقم الطلب</span>
                    <span className="font-semibold">{selectedInvoice.orders.order_number}</span>
                  </div>
                )}

                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">الرصيد بعد المعاملة</span>
                  <span className="font-semibold">{selectedInvoice.balance_after.toFixed(2)} ريال</span>
                </div>

                {selectedInvoice.description && (
                  <div className="py-2">
                    <p className="text-muted-foreground mb-2">الوصف</p>
                    <p className="text-sm">{selectedInvoice.description}</p>
                  </div>
                )}

                {selectedInvoice.invoice_details && (
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-semibold mb-2">تفاصيل إضافية</p>
                    <pre className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(selectedInvoice.invoice_details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ReadinessCheckDialog />
    </div>
  );
}
