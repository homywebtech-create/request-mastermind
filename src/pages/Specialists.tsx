import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, LogOut, ArrowLeft } from "lucide-react";
import { SimplifiedSpecialistForm } from "@/components/specialists/SimplifiedSpecialistForm";
import { SpecialistsTable } from "@/components/specialists/specialists-table";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";

interface Company {
  id: string;
  name: string;
}

interface Specialist {
  id: string;
  name: string;
  phone: string;
  nationality?: string;
  image_url?: string;
  experience_years?: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  approval_status?: string;
  registration_token?: string;
  registration_completed_at?: string;
  suspension_type?: string;
  suspension_end_date?: string;
  suspension_reason?: string;
  specialist_specialties?: Array<{
    sub_service_id: string;
    sub_services: {
      id: string;
      name: string;
      name_en?: string;
      service_id: string;
      services?: {
        id: string;
        name: string;
        name_en?: string;
      };
    };
  }>;
}

export default function Specialists() {
  const { language } = useLanguage();
  const t = useTranslation(language).specialists;
  const tCommon = useTranslation(language).common;
  const { toast } = useToast();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'awaiting_registration' | 'pending_approval' | 'approved' | 'active' | 'suspended'>('all');

  useEffect(() => {
    checkAuth();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("specialists-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "specialists",
        },
        () => {
          if (company) {
            fetchSpecialists(company.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/company-auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) {
        toast({
          title: "Error",
          description: "No company found associated with this account",
          variant: "destructive",
        });
        navigate("/company-auth");
        return;
      }

      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", profile.company_id)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData);
      fetchSpecialists(profile.company_id);
    } catch (error: any) {
      console.error("Error checking auth:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSpecialists = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from("specialists")
        .select(`
          *,
          specialist_specialties (
            sub_service_id,
            sub_services (
              id,
              name,
              name_en,
              service_id,
              services (
                id,
                name,
                name_en
              )
            )
          )
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSpecialists(data || []);
    } catch (error: any) {
      console.error("Error fetching specialists:", error);
      toast({
        title: "Error",
        description: "Error loading data",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("specialists")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Specialist deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!company) return null;

  const awaitingRegistrationCount = specialists.filter(s => 
    !s.registration_completed_at && s.registration_token
  ).length;
  
  const pendingApprovalCount = specialists.filter(s => 
    s.registration_completed_at && s.approval_status === 'pending'
  ).length;
  
  const approvedCount = specialists.filter(s => 
    s.approval_status === 'approved'
  ).length;

  const filteredSpecialists = specialists.filter(specialist => {
    if (filterType === 'all') return true;
    if (filterType === 'awaiting_registration') return !specialist.registration_completed_at && specialist.registration_token;
    if (filterType === 'pending_approval') return specialist.registration_completed_at && specialist.approval_status === 'pending';
    if (filterType === 'approved') return specialist.approval_status === 'approved';
    if (filterType === 'active') return specialist.is_active && !specialist.suspension_type;
    if (filterType === 'suspended') return !specialist.is_active || !!specialist.suspension_type;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/company-portal")}
                title="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t.title}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {company.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              
              <Button
                variant="outline"
                size="icon"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">{t.title}</h2>
            <p className="text-muted-foreground mt-1">
              {t.subtitle}
            </p>
          </div>
          {company && (
            <SimplifiedSpecialistForm
              companyId={company.id}
              onSuccess={() => company && fetchSpecialists(company.id)}
            />
          )}
        </div>

        <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-6 max-w-4xl">
            <TabsTrigger value="all">
              {language === 'ar' ? 'الكل' : 'All'} ({specialists.length})
            </TabsTrigger>
            <TabsTrigger value="awaiting_registration">
              {language === 'ar' ? 'بانتظار التسجيل' : 'Awaiting Registration'} ({awaitingRegistrationCount})
            </TabsTrigger>
            <TabsTrigger value="pending_approval">
              {language === 'ar' ? 'بانتظار الموافقة' : 'Pending Approval'} ({pendingApprovalCount})
            </TabsTrigger>
            <TabsTrigger value="approved">
              {language === 'ar' ? 'معتمد' : 'Approved'} ({approvedCount})
            </TabsTrigger>
            <TabsTrigger value="active">
              {language === 'ar' ? 'نشط' : 'Active'} ({specialists.filter(s => s.is_active && !s.suspension_type).length})
            </TabsTrigger>
            <TabsTrigger value="suspended">
              {language === 'ar' ? 'موقوف' : 'Suspended'} ({specialists.filter(s => !s.is_active || !!s.suspension_type).length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value={filterType} className="mt-6">
            <SpecialistsTable
              specialists={filteredSpecialists}
              companyId={company?.id || ""}
              onDelete={handleDelete}
              onUpdate={() => company && fetchSpecialists(company.id)}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
