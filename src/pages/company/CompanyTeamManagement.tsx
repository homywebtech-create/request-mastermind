import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyUserPermissions } from "@/hooks/useCompanyUserPermissions";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, UserPlus, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompanyUserForm } from "@/components/company/CompanyUserForm";
import { CompanyUsersTable } from "@/components/company/CompanyUsersTable";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { CompanyUser } from "@/types/company-team";

export default function CompanyTeamManagement() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission, loading: permissionsLoading } = useCompanyUserPermissions(user?.id);
  
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<CompanyUser | null>(null);
  const [companyId, setCompanyId] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  // Redirect if user doesn't have permission
  useEffect(() => {
    if (!permissionsLoading && !hasPermission('manage_team')) {
      toast.error(language === "ar" ? "ليس لديك صلاحية للوصول إلى هذه الصفحة" : "You don't have permission to access this page");
      navigate("/company-portal");
    }
  }, [permissionsLoading, hasPermission, navigate, language]);

  const checkAuthAndFetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/company-auth");
        return;
      }

      // Get company info from profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile?.company_id) {
        toast.error(language === "ar" ? "لم يتم العثور على شركة مرتبطة بهذا الحساب" : "No company found");
        navigate("/company-portal");
        return;
      }

      setCompanyId(profile.company_id);

      // Fetch company name
      const { data: companyData } = await supabase
        .from("companies")
        .select("name")
        .eq("id", profile.company_id)
        .single();

      setCompanyName(companyData?.name || "");

      // Fetch users
      await fetchUsers(profile.company_id);
    } catch (error) {
      console.error("Error:", error);
      toast.error(language === "ar" ? "حدث خطأ" : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (compId: string) => {
    try {
      const { data: usersData, error: usersError } = await supabase
        .from("company_users")
        .select("*")
        .eq("company_id", compId)
        .not("email", "like", "%@system.local")
        .not("email", "like", "%@company.local")
        .order("is_owner", { ascending: false })
        .order("full_name");

      if (usersError) throw usersError;

      const { data: permissionsData, error: permissionsError } = await supabase
        .from("company_user_permissions")
        .select("company_user_id, permission")
        .in("company_user_id", usersData?.map(u => u.id) || []);

      if (permissionsError) {
        console.error("Error fetching permissions:", permissionsError);
      }

      const usersWithPermissions = usersData?.map(user => ({
        ...user,
        permissions: permissionsData
          ?.filter(p => p.company_user_id === user.id)
          .map(p => p.permission) || []
      })) || [];

      setUsers(usersWithPermissions);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error(language === "ar" ? "حدث خطأ في تحميل المستخدمين" : "Error loading users");
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  const handleEditUser = (user: CompanyUser) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من حذف هذا المستخدم؟" : "Are you sure you want to delete this user?")) {
      return;
    }

    const { error } = await supabase
      .from("company_users")
      .delete()
      .eq("id", userId);

    if (error) {
      console.error("Error deleting user:", error);
      toast.error(language === "ar" ? "حدث خطأ في حذف المستخدم" : "Error deleting user");
      return;
    }

    toast.success(language === "ar" ? "تم حذف المستخدم بنجاح" : "User deleted successfully");
    fetchUsers(companyId);
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("company_users")
      .update({ is_active: !currentStatus })
      .eq("id", userId);

    if (error) {
      console.error("Error updating user status:", error);
      toast.error(language === "ar" ? "حدث خطأ في تحديث حالة المستخدم" : "Error updating user status");
      return;
    }

    toast.success(language === "ar" ? "تم تحديث حالة المستخدم" : "User status updated");
    fetchUsers(companyId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">
                  {language === "ar" ? "إدارة الفريق" : "Team Management"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {companyName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Button
                variant="outline"
                onClick={() => navigate("/company-portal")}
              >
                {language === "ar" ? <ArrowRight className="ml-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
                {language === "ar" ? "العودة" : "Back"}
              </Button>
              <Button onClick={handleAddUser}>
                <UserPlus className={language === "ar" ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
                {language === "ar" ? "إضافة مستخدم" : "Add User"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8" dir={language === "ar" ? "rtl" : "ltr"}>
        <CompanyUsersTable
          users={users}
          onEdit={handleEditUser}
          onDelete={handleDeleteUser}
          onToggleActive={handleToggleActive}
        />
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingUser
                ? (language === "ar" ? "تعديل مستخدم" : "Edit User")
                : (language === "ar" ? "إضافة مستخدم جديد" : "Add New User")}
            </DialogTitle>
          </DialogHeader>
          <CompanyUserForm
            companyId={companyId}
            user={editingUser}
            onSuccess={() => {
              setDialogOpen(false);
              fetchUsers(companyId);
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}