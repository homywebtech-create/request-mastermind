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
import { Loader2, UserPlus, Shield, Eye, Settings, Edit, Trash2, Ban, CheckCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  
  const [newAdmin, setNewAdmin] = useState({
    email: "",
    full_name: "",
    phone: "",
    role: "admin_viewer"
  });

  const [editAdmin, setEditAdmin] = useState({
    full_name: "",
    phone: "",
    role: ""
  });

  useEffect(() => {
    console.log('AdminUsers - Auth State:', { user: user?.id, role, authLoading, roleLoading });
    
    // If no auth loading and no user, redirect to login
    if (!authLoading && !user) {
      console.log('AdminUsers - No user, redirecting to auth');
      navigate("/auth");
      return;
    }

    // Wait for auth to complete
    if (authLoading) {
      console.log('AdminUsers - Auth loading...');
      return;
    }

    // CRITICAL: If user exists but role is null and not loading, still wait
    // This handles React batching delays
    if (user && role === null && !roleLoading) {
      console.log('AdminUsers - User exists but role not loaded yet, waiting...');
      // Give it one render cycle for roleLoading to update
      return;
    }

    // Wait for role loading
    if (roleLoading) {
      console.log('AdminUsers - Role loading...');
      return;
    }

    // Now we have both user and role loaded
    // Check if user has admin access
    if (role !== 'admin' && role !== 'admin_full') {
      console.log('AdminUsers - Access denied, role:', role);
      toast.error("Access denied - Admin role required");
      navigate("/");
      return;
    }

    // User is authenticated and has correct role
    console.log('AdminUsers - Access granted, fetching users');
    fetchAdminUsers();
  }, [user, role, authLoading, roleLoading, navigate]);

  const fetchAdminUsers = async () => {
    try {
      // First, get all admin user_ids from user_roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'admin_full', 'admin_manager', 'admin_viewer']);

      if (rolesError) throw rolesError;

      if (!rolesData || rolesData.length === 0) {
        setAdminUsers([]);
        return;
      }

      // Extract user_ids and create a map of user_id -> role
      const userIds = rolesData.map(r => r.user_id);
      const roleMap = new Map(rolesData.map(r => [r.user_id, r.role]));

      // Then get profiles for those users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, phone, is_active, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const formattedData = profilesData.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        full_name: item.full_name,
        phone: item.phone,
        role: roleMap.get(item.user_id),
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

  const handleToggleActive = async (admin: AdminUser) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !admin.is_active })
        .eq('user_id', admin.user_id);

      if (error) throw error;

      toast.success(admin.is_active ? "تم إيقاف الحساب" : "تم تفعيل الحساب");
      fetchAdminUsers();
    } catch (error: any) {
      toast.error(error.message || "فشل تحديث حالة الحساب");
    }
  };

  const handleEditClick = (admin: AdminUser) => {
    setSelectedUser(admin);
    setEditAdmin({
      full_name: admin.full_name,
      phone: admin.phone || "",
      role: admin.role
    });
    setShowEditDialog(true);
  };

  const handleUpdateAdmin = async () => {
    if (!selectedUser) return;
    
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editAdmin.full_name,
          phone: editAdmin.phone || null
        })
        .eq('user_id', selectedUser.user_id);

      if (profileError) throw profileError;

      // Update role if changed
      if (editAdmin.role !== selectedUser.role) {
        // Delete old role
        const { error: deleteError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', selectedUser.user_id);

        if (deleteError) throw deleteError;

        // Insert new role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{
            user_id: selectedUser.user_id,
            role: editAdmin.role as any
          }]);

        if (roleError) throw roleError;
      }

      toast.success("تم تحديث البيانات بنجاح");
      setShowEditDialog(false);
      fetchAdminUsers();
    } catch (error: any) {
      toast.error(error.message || "فشل تحديث البيانات");
    }
  };

  const handleDeleteClick = (admin: AdminUser) => {
    setSelectedUser(admin);
    setShowDeleteDialog(true);
  };

  const handleDeleteAdmin = async () => {
    if (!selectedUser) return;

    try {
      // Delete user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUser.user_id);

      if (roleError) throw roleError;

      // Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', selectedUser.user_id);

      if (profileError) throw profileError;

      // Note: Auth user deletion requires admin API or service role
      // For now, we just remove from profiles and roles tables
      
      toast.success("تم حذف الحساب بنجاح");
      setShowDeleteDialog(false);
      fetchAdminUsers();
    } catch (error: any) {
      toast.error(error.message || "فشل حذف الحساب");
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
              <TableHead>الاسم</TableHead>
              <TableHead>الهاتف</TableHead>
              <TableHead>الصلاحية</TableHead>
              <TableHead>تاريخ الإنشاء</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="text-center">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adminUsers.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className="font-medium">{admin.full_name}</TableCell>
                <TableCell>{admin.phone || "غير متوفر"}</TableCell>
                <TableCell>{getRoleBadge(admin.role)}</TableCell>
                <TableCell>{new Date(admin.created_at).toLocaleDateString('ar-SA')}</TableCell>
                <TableCell>
                  <Badge variant={admin.is_active ? "default" : "secondary"}>
                    {admin.is_active ? "نشط" : "موقوف"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2 justify-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditClick(admin)}
                      title="تعديل"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={admin.is_active ? "destructive" : "default"}
                      onClick={() => handleToggleActive(admin)}
                      title={admin.is_active ? "إيقاف" : "تفعيل"}
                    >
                      {admin.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteClick(admin)}
                      title="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
            <DialogDescription>
              قم بتعديل البيانات الأساسية للمستخدم
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_full_name">الاسم الكامل</Label>
              <Input
                id="edit_full_name"
                value={editAdmin.full_name}
                onChange={(e) => setEditAdmin({ ...editAdmin, full_name: e.target.value })}
                placeholder="أدخل الاسم الكامل"
              />
            </div>
            <div>
              <Label htmlFor="edit_phone">رقم الهاتف</Label>
              <Input
                id="edit_phone"
                value={editAdmin.phone}
                onChange={(e) => setEditAdmin({ ...editAdmin, phone: e.target.value })}
                placeholder="اختياري"
              />
            </div>
            <div>
              <Label htmlFor="edit_role">الصلاحية</Label>
              <Select value={editAdmin.role} onValueChange={(value) => setEditAdmin({ ...editAdmin, role: value })}>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleUpdateAdmin}>
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف هذا الحساب؟</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع بيانات المستخدم {selectedUser?.full_name} نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAdmin} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
