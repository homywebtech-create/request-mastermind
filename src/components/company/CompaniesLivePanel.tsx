import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, MessageSquare, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyChatDialog } from "./CompanyChatDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSoundNotification } from "@/lib/soundNotification";

interface CompanyStatus {
  id: string;
  name: string;
  logo_url?: string;
  phone?: string;
  is_active: boolean;
  specialists_count: number;
  active_specialists: number;
  pending_orders: number;
  unread_messages: number;
}

export function CompaniesLivePanel() {
  const { language } = useLanguage();
  const [companies, setCompanies] = useState<CompanyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<{ companyId: string; companyName: string; companyPhone?: string; companyLogo?: string } | null>(null);
  const [adminName, setAdminName] = useState<string>("");
  const previousUnreadCounts = useRef<Record<string, number>>({});

  useEffect(() => {
    fetchCompaniesStatus();
    fetchAdminName();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("companies-live-panel")
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

  const fetchAdminName = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .single();
        
        if (profile) {
          setAdminName(profile.full_name);
        }
      }
    } catch (error) {
      console.error("Error fetching admin name:", error);
    }
  };

  const fetchCompaniesStatus = async () => {
    try {
      setLoading(true);

      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("id, name, logo_url, is_active, phone")
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
        const currentUnreadCount = chat?.unread_count || 0;

        // Check if there are new unread messages
        const previousCount = previousUnreadCounts.current[company.id] || 0;
        if (currentUnreadCount > previousCount && previousCount > 0) {
          // Play notification sound for new messages
          getSoundNotification().playNewQuoteSound();
        }

        return {
          ...company,
          specialists_count: companySpecialists.length,
          active_specialists: activeSpecialists.length,
          pending_orders: pendingOrders,
          unread_messages: currentUnreadCount,
        };
      });

      // Update previous unread counts
      companiesStatus.forEach((company) => {
        previousUnreadCounts.current[company.id] = company.unread_messages;
      });

      setCompanies(companiesStatus);
    } catch (error) {
      console.error("Error fetching companies status:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {language === "ar" ? "الشركات" : "Companies"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-12rem)]">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "ar" ? "جاري التحميل..." : "Loading..."}
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "ar" ? "لا توجد شركات" : "No companies found"}
              </div>
            ) : (
              <div className="space-y-3">
                {companies.map((company) => (
                  <Card 
                    key={company.id} 
                    className={`relative transition-all ${
                      company.unread_messages > 0 
                        ? 'animate-pulse border-destructive border-2 shadow-lg shadow-destructive/20' 
                        : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        {company.logo_url && (
                          <img
                            src={company.logo_url}
                            alt={company.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium truncate">{company.name}</h3>
                            {company.unread_messages > 0 && (
                              <Badge variant="destructive" className="shrink-0">
                                {company.unread_messages}
                              </Badge>
                            )}
                          </div>
                          <Badge 
                            variant={company.is_active ? "default" : "secondary"} 
                            className="mt-1"
                          >
                            {company.is_active
                              ? language === "ar" ? "نشطة" : "Active"
                              : language === "ar" ? "غير نشطة" : "Inactive"}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {language === "ar" ? "المحترفات" : "Specialists"}:
                          </span>
                          <span className="font-medium">
                            {company.active_specialists} / {company.specialists_count}
                          </span>
                        </div>
                        {company.pending_orders > 0 && (
                          <div className="flex items-center justify-between text-orange-600">
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {language === "ar" ? "طلبات معلقة" : "Pending"}:
                            </span>
                            <span className="font-medium">{company.pending_orders}</span>
                          </div>
                        )}
                      </div>

                      <Button
                        size="sm"
                        className={`w-full ${
                          company.unread_messages > 0 
                            ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse' 
                            : ''
                        }`}
                        variant={company.unread_messages > 0 ? "default" : "outline"}
                        onClick={() =>
                          setSelectedChat({ 
                            companyId: company.id, 
                            companyName: company.name,
                            companyPhone: company.phone,
                            companyLogo: company.logo_url
                          })
                        }
                      >
                        <MessageSquare className="h-3 w-3 mr-2" />
                        {language === "ar" ? "المحادثة" : "Chat"}
                        {company.unread_messages > 0 && (
                          <Badge variant="secondary" className="mr-2">
                            {company.unread_messages}
                          </Badge>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {selectedChat && (
        <CompanyChatDialog
          open={!!selectedChat}
          onOpenChange={(open) => !open && setSelectedChat(null)}
          companyId={selectedChat.companyId}
          companyName={selectedChat.companyName}
          companyPhone={selectedChat.companyPhone}
          companyLogo={selectedChat.companyLogo}
          adminName={adminName}
          isAdminView={true}
        />
      )}
    </>
  );
}
