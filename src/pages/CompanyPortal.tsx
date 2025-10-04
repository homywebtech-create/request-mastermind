import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, LogOut, Package, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Company {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}

interface Order {
  id: string;
  customer_id: string;
  service_type: string;
  notes: string;
  status: string;
  created_at: string;
  customers: {
    name: string;
    whatsapp_number: string;
  };
}

export default function CompanyPortal() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/company-auth");
        return;
      }

      // الحصول على معلومات الشركة
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) {
        toast({
          title: "خطأ",
          description: "لم يتم العثور على شركة مرتبطة بهذا الحساب",
          variant: "destructive",
        });
        navigate("/company-auth");
        return;
      }

      // جلب معلومات الشركة
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile.company_id)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData);

      // جلب الطلبات
      fetchOrders(profile.company_id);
    } catch (error: any) {
      console.error("Error checking auth:", error);
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrders = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (
            name,
            whatsapp_number
          )
        `)
        .or(`company_id.eq.${companyId},send_to_all_companies.eq.true`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء جلب الطلبات",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/company-auth");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">{company.name}</h1>
                <p className="text-sm text-muted-foreground">{company.phone}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 ml-2" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              الطلبات
            </TabsTrigger>
            <TabsTrigger value="workers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              العاملات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>الطلبات الواردة</CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    لا توجد طلبات حالياً
                  </p>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <Card key={order.id}>
                        <CardContent className="pt-6">
                          <div className="grid gap-2">
                            <div className="flex justify-between">
                              <span className="font-semibold">العميل:</span>
                              <span>{order.customers.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-semibold">رقم الواتساب:</span>
                              <a
                                href={`https://wa.me/${order.customers.whatsapp_number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {order.customers.whatsapp_number}
                              </a>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-semibold">الخدمة:</span>
                              <span>{order.service_type}</span>
                            </div>
                            {order.notes && (
                              <div className="flex justify-between">
                                <span className="font-semibold">ملاحظات:</span>
                                <span className="text-right">{order.notes}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="font-semibold">الحالة:</span>
                              <span className={`font-medium ${
                                order.status === 'completed' ? 'text-green-600' :
                                order.status === 'in-progress' ? 'text-blue-600' :
                                'text-yellow-600'
                              }`}>
                                {order.status === 'completed' ? 'مكتمل' :
                                 order.status === 'in-progress' ? 'قيد التنفيذ' :
                                 'قيد الانتظار'}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground">
                              <span>تاريخ الطلب:</span>
                              <span>{new Date(order.created_at).toLocaleDateString('ar-QA')}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workers">
            <Card>
              <CardHeader>
                <CardTitle>إدارة العاملات</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  قريباً - سيتم إضافة نظام إدارة العاملات
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
