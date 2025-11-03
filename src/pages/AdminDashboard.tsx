import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2, Users, MessageSquare, AlertTriangle, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { CompanyChatDialog } from "@/components/company/CompanyChatDialog";
import { Badge } from "@/components/ui/badge";

interface CompanyStatus {
  id: string;
  name: string;
  logo_url?: string;
  is_active: boolean;
  specialists_count: number;
  active_specialists: number;
  pending_orders: number;
  unread_messages: number;
}

export default function AdminDashboard() {
  const { language } = useLanguage();
  const [companies, setCompanies] = useState<CompanyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<{ companyId: string; companyName: string } | null>(null);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCompaniesStatus();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("admin-dashboard")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "company_chats",
        },
        () => {
          fetchCompaniesStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCompaniesStatus = async () => {
    try {
      setLoading(true);

      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("id, name, logo_url, is_active")
        .order("name");

      if (companiesError) throw companiesError;

      // Fetch specialists count per company
      const { data: specialistsData } = await supabase
        .from("specialists")
        .select("company_id, is_active");

      // Fetch pending orders per company
      const { data: ordersData } = await supabase
        .from("orders")
        .select("company_id, status")
        .in("status", ["pending", "waiting_quotes"]);

      // Fetch unread messages per company
      const { data: chatsData } = await supabase
        .from("company_chats")
        .select("company_id, unread_count");

      const companiesStatus: CompanyStatus[] = (companiesData || []).map((company) => {
        const companySpecialists = (specialistsData || []).filter(
          (s) => s.company_id === company.id
        );
        const activeSpecialists = companySpecialists.filter((s) => s.is_active);
        const pendingOrders = (ordersData || []).filter(
          (o) => o.company_id === company.id
        ).length;
        const chat = chatsData?.find((c) => c.company_id === company.id);

        return {
          ...company,
          specialists_count: companySpecialists.length,
          active_specialists: activeSpecialists.length,
          pending_orders: pendingOrders,
          unread_messages: chat?.unread_count || 0,
        };
      });

      setCompanies(companiesStatus);
    } catch (error) {
      console.error("Error fetching companies status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {language === "ar" ? "لوحة تحكم المدير" : "Admin Dashboard"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {language === "ar" ? "إدارة الشركات والتواصل معها" : "Manage and communicate with companies"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                {language === "ar" ? "تسجيل الخروج" : "Logout"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "ar" ? "إجمالي الشركات" : "Total Companies"}
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companies.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "ar" ? "الشركات النشطة" : "Active Companies"}
              </CardTitle>
              <Building2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {companies.filter((c) => c.is_active).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "ar" ? "إجمالي المحترفات" : "Total Specialists"}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {companies.reduce((sum, c) => sum + c.specialists_count, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "ar" ? "رسائل غير مقروءة" : "Unread Messages"}
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {companies.reduce((sum, c) => sum + c.unread_messages, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Companies List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-8">
              {language === "ar" ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : companies.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              {language === "ar" ? "لا توجد شركات" : "No companies found"}
            </div>
          ) : (
            companies.map((company) => (
              <Card key={company.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {company.logo_url && (
                        <img
                          src={company.logo_url}
                          alt={company.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <CardTitle className="text-lg">{company.name}</CardTitle>
                        <Badge variant={company.is_active ? "default" : "secondary"} className="mt-1">
                          {company.is_active
                            ? language === "ar"
                              ? "نشطة"
                              : "Active"
                            : language === "ar"
                            ? "غير نشطة"
                            : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                    {company.unread_messages > 0 && (
                      <Badge variant="destructive" className="absolute top-4 right-4">
                        {company.unread_messages}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        <Users className="h-4 w-4 inline mr-1" />
                        {language === "ar" ? "المحترفات" : "Specialists"}:
                      </span>
                      <span className="font-medium">
                        {company.active_specialists} / {company.specialists_count}
                      </span>
                    </div>
                    {company.pending_orders > 0 && (
                      <div className="flex items-center justify-between text-orange-600">
                        <span>
                          <AlertTriangle className="h-4 w-4 inline mr-1" />
                          {language === "ar" ? "طلبات معلقة" : "Pending Orders"}:
                        </span>
                        <span className="font-medium">{company.pending_orders}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    className="w-full mt-4"
                    variant="outline"
                    onClick={() =>
                      setSelectedChat({ companyId: company.id, companyName: company.name })
                    }
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {language === "ar" ? "فتح المحادثة" : "Open Chat"}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Chat Dialog */}
      {selectedChat && (
        <CompanyChatDialog
          open={!!selectedChat}
          onOpenChange={(open) => !open && setSelectedChat(null)}
          companyId={selectedChat.companyId}
          companyName={selectedChat.companyName}
        />
      )}
    </div>
  );
}