import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompanyUserForm } from "@/components/company/CompanyUserForm";
import { CompanyUsersTable } from "@/components/company/CompanyUsersTable";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

export interface CompanyUser {
  id: string;
  company_id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  is_owner: boolean;
  created_at: string;
  permissions: string[];
}

export default function CompanyTeam() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get("companyId");
  
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<CompanyUser | null>(null);
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    if (companyId) {
      fetchCompanyName();
      fetchUsers();
    } else {
      navigate("/companies");
    }
  }, [companyId]);

  const fetchCompanyName = async () => {
    if (!companyId) return;
    
    const { data, error } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .single();

    if (error) {
      console.error("Error fetching company:", error);
      return;
    }

    setCompanyName(data?.name || "");
  };

  const fetchUsers = async () => {
    if (!companyId) return;

    try {
      setLoading(true);

      const { data: usersData, error: usersError } = await supabase
        .from("company_users")
        .select("*")
        .eq("company_id", companyId)
        .order("is_owner", { ascending: false })
        .order("full_name");

      if (usersError) {
        console.error("Error fetching users:", usersError);
        toast.error(language === "ar" ? "حدث خطأ في تحميل المستخدمين" : "Error loading users");
        return;
      }

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
    } catch (error) {
      console.error("Error:", error);
      toast.error(language === "ar" ? "حدث خطأ غير متوقع" : "Unexpected error");
    } finally {
      setLoading(false);
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
    fetchUsers();
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
    fetchUsers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">
            {language === "ar" ? "إدارة الفريق" : "Team Management"}
          </h1>
          <p className="text-muted-foreground">
            {companyName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button
            variant="outline"
            onClick={() => navigate("/companies")}
          >
            {language === "ar" ? <ArrowRight className="ml-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
            {language === "ar" ? "العودة للشركات" : "Back to Companies"}
          </Button>
          <Button onClick={handleAddUser}>
            <UserPlus className={language === "ar" ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
            {language === "ar" ? "إضافة مستخدم" : "Add User"}
          </Button>
        </div>
      </div>

      <CompanyUsersTable
        users={users}
        onEdit={handleEditUser}
        onDelete={handleDeleteUser}
        onToggleActive={handleToggleActive}
      />

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
            companyId={companyId!}
            user={editingUser}
            onSuccess={() => {
              setDialogOpen(false);
              fetchUsers();
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}