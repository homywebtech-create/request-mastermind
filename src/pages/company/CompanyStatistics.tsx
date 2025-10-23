import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, UserCheck, ClipboardList, Users, Star, TrendingUp } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { useToast } from "@/hooks/use-toast";

interface CompanyStats {
  totalSpecialists: number;
  activeSpecialists: number;
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalCustomers: number;
  averageRating: number;
  totalReviews: number;
}

export default function CompanyStatistics() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (user) {
      fetchCompanyStats();
    }
  }, [user]);

  const fetchCompanyStats = async () => {
    try {
      setLoading(true);

      // Get user's company
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, companies(name)")
        .eq("user_id", user?.id)
        .single();

      if (!profile?.company_id) {
        toast({
          title: language === "ar" ? "خطأ" : "Error",
          description: language === "ar" ? "لم يتم العثور على شركة مرتبطة بحسابك" : "No company found for your account",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const companyId = profile.company_id;
      setCompanyName(profile.companies?.name || "");

      // Fetch specialists stats for this company
      const { data: specialists } = await supabase
        .from("specialists")
        .select("id, is_active, rating, reviews_count")
        .eq("company_id", companyId);

      // Fetch orders stats for this company
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, customer_id")
        .eq("company_id", companyId);

      // Get unique customers
      const uniqueCustomers = new Set(orders?.map((o) => o.customer_id) || []);

      const activeSpecialists = specialists?.filter((s) => s.is_active).length || 0;
      const pendingOrders = orders?.filter((o) => o.status === "pending").length || 0;
      const inProgressOrders = orders?.filter((o) => o.status === "in_progress").length || 0;
      const completedOrders = orders?.filter((o) => o.status === "completed").length || 0;
      const cancelledOrders = orders?.filter((o) => o.status === "cancelled").length || 0;

      const totalRating = specialists?.reduce((sum, s) => sum + (Number(s.rating) || 0), 0) || 0;
      const totalReviews = specialists?.reduce((sum, s) => sum + (Number(s.reviews_count) || 0), 0) || 0;
      const averageRating = specialists?.length && totalRating > 0 ? totalRating / specialists.length : 0;

      setStats({
        totalSpecialists: specialists?.length || 0,
        activeSpecialists,
        totalOrders: orders?.length || 0,
        pendingOrders,
        inProgressOrders,
        completedOrders,
        cancelledOrders,
        totalCustomers: uniqueCustomers.size,
        averageRating,
        totalReviews,
      });
    } catch (error) {
      console.error("Error fetching company stats:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في تحميل الإحصائيات" : "Failed to load statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {language === "ar" ? "إحصائيات الشركة" : "Company Statistics"}
        </h1>
        <p className="text-muted-foreground">
          {companyName && `${companyName} - `}
          {language === "ar"
            ? "نظرة شاملة على أداء شركتك"
            : "Complete overview of your company performance"}
        </p>
      </div>

      {/* Specialists Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {language === "ar" ? "المحترفات" : "Specialists"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatsCard
              title={language === "ar" ? "إجمالي المحترفات" : "Total Specialists"}
              value={stats?.totalSpecialists || 0}
              icon={<UserCheck />}
              variant="default"
            />
            <StatsCard
              title={language === "ar" ? "المحترفات النشطة" : "Active Specialists"}
              value={stats?.activeSpecialists || 0}
              icon={<UserCheck />}
              variant="success"
            />
          </div>
        </CardContent>
      </Card>

      {/* Performance Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            {language === "ar" ? "الأداء والتقييمات" : "Performance & Ratings"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatsCard
              title={language === "ar" ? "متوسط التقييم" : "Average Rating"}
              value={Number(stats?.averageRating.toFixed(1)) || 0}
              icon={<Star />}
              variant="warning"
            />
            <StatsCard
              title={language === "ar" ? "إجمالي التقييمات" : "Total Reviews"}
              value={stats?.totalReviews || 0}
              icon={<TrendingUp />}
              variant="awaiting"
            />
          </div>
        </CardContent>
      </Card>

      {/* Orders Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {language === "ar" ? "الطلبات" : "Orders"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatsCard
              title={language === "ar" ? "إجمالي الطلبات" : "Total Orders"}
              value={stats?.totalOrders || 0}
              icon={<ClipboardList />}
              variant="default"
            />
            <StatsCard
              title={language === "ar" ? "قيد الانتظار" : "Pending"}
              value={stats?.pendingOrders || 0}
              icon={<ClipboardList />}
              variant="pending"
            />
            <StatsCard
              title={language === "ar" ? "قيد التنفيذ" : "In Progress"}
              value={stats?.inProgressOrders || 0}
              icon={<ClipboardList />}
              variant="awaiting"
            />
            <StatsCard
              title={language === "ar" ? "مكتملة" : "Completed"}
              value={stats?.completedOrders || 0}
              icon={<ClipboardList />}
              variant="success"
            />
            <StatsCard
              title={language === "ar" ? "ملغاة" : "Cancelled"}
              value={stats?.cancelledOrders || 0}
              icon={<ClipboardList />}
              variant="warning"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {language === "ar" ? "العملاء" : "Customers"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StatsCard
            title={language === "ar" ? "إجمالي العملاء" : "Total Customers"}
            value={stats?.totalCustomers || 0}
            icon={<Users />}
            variant="default"
          />
        </CardContent>
      </Card>
    </div>
  );
}
