import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Shield, Eye, Settings } from "lucide-react";

interface AdminUser {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  role: string;
  created_at: string;
  is_active: boolean;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole(user?.id);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [newAdmin, setNewAdmin] = useState({
    email: "",
    full_name: "",
    phone: "",
    role: "admin_viewer"
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (!roleLoading && role !== 'admin' && role !== 'admin_full') {
      toast.error("Access denied");
      navigate("/");
      return;
    }

    if (user && (role === 'admin' || role === 'admin_full')) {
      fetchAdminUsers();
    }
  }, [user, role, authLoading, roleLoading, navigate]);

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          full_name,
          phone,
          is_active,
          created_at,
          user_roles!inner(role)
        `)
        .in('user_roles.role', ['admin', 'admin_full', 'admin_manager', 'admin_viewer'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = data.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        full_name: item.full_name,
        phone: item.phone,
        role: item.user_roles[0].role,
        created_at: item.created_at,
        is_active: item.is_active
      }));

      setAdminUsers(formattedData);
    } catch (error: any) {
      toast.error("Failed to load admin users");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create auth user with a temporary password
      // User will receive an email to set their own password
      const temporaryPassword = Math.random().toString(36).slice(-12) + "A1!";
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newAdmin.email,
        password: temporaryPassword,
        options: {
          data: {
            full_name: newAdmin.full_name,
            phone: newAdmin.phone
          },
          emailRedirectTo: `${window.location.origin}/auth`
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      // Assign role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([{
          user_id: authData.user.id,
          role: newAdmin.role as any
        }]);

      if (roleError) throw roleError;

      // Send password reset email so user can set their own password
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        newAdmin.email,
        {
          redirectTo: `${window.location.origin}/auth`
        }
      );

      if (resetError) {
        console.error("Password reset email error:", resetError);
      }

      toast.success("تم إنشاء حساب الأدمن وإرسال رابط تعيين كلمة المرور للبريد الإلكتروني");
      setShowAddForm(false);
      setNewAdmin({
        email: "",
        full_name: "",
        phone: "",
        role: "admin_viewer"
      });
      fetchAdminUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to create admin user");
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      admin: { label: "Super Admin", icon: Shield, variant: "destructive" as const },
      admin_full: { label: "Full Admin", icon: Shield, variant: "default" as const },
      admin_manager: { label: "Manager", icon: Settings, variant: "secondary" as const },
      admin_viewer: { label: "Viewer", icon: Eye, variant: "outline" as const }
    };

    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.admin_viewer;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (authLoading || roleLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Admin Users</h1>
          <p className="text-muted-foreground">Manage admin accounts and permissions</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Admin
        </Button>
      </div>

      {showAddForm && (
        <Card className="p-6">
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">
                  سيتم إرسال رابط تعيين كلمة المرور للبريد الإلكتروني للعضو الجديد
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                    required
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="full_name">الاسم الكامل</Label>
                  <Input
                    id="full_name"
                    value={newAdmin.full_name}
                    onChange={(e) => setNewAdmin({ ...newAdmin, full_name: e.target.value })}
                    required
                    placeholder="أدخل الاسم الكامل"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    value={newAdmin.phone}
                    onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                    placeholder="اختياري"
                  />
                </div>
                <div>
                  <Label htmlFor="role">الصلاحية</Label>
                  <Select value={newAdmin.role} onValueChange={(value) => setNewAdmin({ ...newAdmin, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin_viewer">مشاهد (يمكنه المشاهدة فقط)</SelectItem>
                      <SelectItem value="admin_manager">مدير (يمكنه المشاهدة والتعديل)</SelectItem>
                      <SelectItem value="admin_full">أدمن كامل (جميع الصلاحيات)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "إنشاء الحساب وإرسال الرابط"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                إلغاء
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adminUsers.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className="font-medium">{admin.full_name}</TableCell>
                <TableCell>{admin.phone || "N/A"}</TableCell>
                <TableCell>{getRoleBadge(admin.role)}</TableCell>
                <TableCell>{new Date(admin.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant={admin.is_active ? "default" : "secondary"}>
                    {admin.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
