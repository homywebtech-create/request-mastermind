import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { Loader2, Users, Building2, ClipboardList, UserCheck, Star } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";

interface SystemStats {
  totalCompanies: number;
  activeCompanies: number;
  totalSpecialists: number;
  activeSpecialists: number;
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  totalCustomers: number;
  totalUsers: number;
  averageRating: number;
}

export default function AdminStatistics() {
  const { language } = useLanguage();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemStats();
  }, []);

  const fetchSystemStats = async () => {
    try {
      setLoading(true);

      // Fetch companies stats
      const { data: companies } = await supabase
        .from("companies")
        .select("id, is_active");

      // Fetch specialists stats
      const { data: specialists } = await supabase
        .from("specialists")
        .select("id, is_active, rating");

      // Fetch orders stats
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status");

      // Fetch customers stats
      const { data: customers } = await supabase
        .from("customers")
        .select("id");

      // Fetch users stats
      const { data: users } = await supabase
        .from("profiles")
        .select("id");

      const activeCompanies = companies?.filter((c) => c.is_active).length || 0;
      const activeSpecialists = specialists?.filter((s) => s.is_active).length || 0;
      const pendingOrders = orders?.filter((o) => o.status === "pending").length || 0;
      const inProgressOrders = orders?.filter((o) => o.status === "in_progress").length || 0;
      const completedOrders = orders?.filter((o) => o.status === "completed").length || 0;
      
      const totalRating = specialists?.reduce((sum, s) => sum + (Number(s.rating) || 0), 0) || 0;
      const averageRating = specialists?.length ? totalRating / specialists.length : 0;

      setStats({
        totalCompanies: companies?.length || 0,
        activeCompanies,
        totalSpecialists: specialists?.length || 0,
        activeSpecialists,
        totalOrders: orders?.length || 0,
        pendingOrders,
        inProgressOrders,
        completedOrders,
        totalCustomers: customers?.length || 0,
        totalUsers: users?.length || 0,
        averageRating,
      });
    } catch (error) {
      console.error("Error fetching system stats:", error);
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
    <PermissionGuard permission="view_admin_statistics">
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            {language === "ar" ? "إحصائيات النظام" : "System Statistics"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar"
              ? "نظرة شاملة على أداء النظام"
              : "Complete overview of system performance"}
          </p>
        </div>

        {/* Companies Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {language === "ar" ? "الشركات" : "Companies"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatsCard
                title={language === "ar" ? "إجمالي الشركات" : "Total Companies"}
                value={stats?.totalCompanies || 0}
                icon={<Building2 />}
                variant="default"
              />
              <StatsCard
                title={language === "ar" ? "الشركات النشطة" : "Active Companies"}
                value={stats?.activeCompanies || 0}
                icon={<Building2 />}
                variant="success"
              />
            </div>
          </CardContent>
        </Card>

        {/* Specialists Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              {language === "ar" ? "المحترفات" : "Specialists"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <StatsCard
                title={language === "ar" ? "متوسط التقييم" : "Average Rating"}
                value={Number(stats?.averageRating.toFixed(1)) || 0}
                icon={<Star />}
                variant="warning"
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatsCard
                title={language === "ar" ? "إجمالي الطلبات" : "Total Orders"}
                value={stats?.totalOrders || 0}
                icon={<ClipboardList />}
                variant="default"
              />
              <StatsCard
                title={language === "ar" ? "طلبات قيد الانتظار" : "Pending Orders"}
                value={stats?.pendingOrders || 0}
                icon={<ClipboardList />}
                variant="pending"
              />
              <StatsCard
                title={language === "ar" ? "طلبات قيد التنفيذ" : "In Progress"}
                value={stats?.inProgressOrders || 0}
                icon={<ClipboardList />}
                variant="awaiting"
              />
              <StatsCard
                title={language === "ar" ? "طلبات مكتملة" : "Completed"}
                value={stats?.completedOrders || 0}
                icon={<ClipboardList />}
                variant="success"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users & Customers Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {language === "ar" ? "المستخدمون والعملاء" : "Users & Customers"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatsCard
                title={language === "ar" ? "إجمالي المستخدمين" : "Total Users"}
                value={stats?.totalUsers || 0}
                icon={<Users />}
                variant="default"
              />
              <StatsCard
                title={language === "ar" ? "إجمالي العملاء" : "Total Customers"}
                value={stats?.totalCustomers || 0}
                icon={<Users />}
                variant="awaiting"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}
