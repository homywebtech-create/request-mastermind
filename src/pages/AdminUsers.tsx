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
import { Loader2, UserPlus, Shield, Eye, Settings, Edit, Trash2, Ban, CheckCircle, Mail, ArrowLeft } from "lucide-react";
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
        .select('id, user_id, full_name, phone, email, is_active, created_at')
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
      // Call edge function to create admin user (bypasses signup restrictions)
      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email: newAdmin.email,
          full_name: newAdmin.full_name,
          phone: newAdmin.phone,
          role: newAdmin.role
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data?.message || "Admin user created successfully and invitation email sent");
      setShowAddForm(false);
      setNewAdmin({
        email: "",
        full_name: "",
        phone: "",
        role: "admin_viewer"
      });
      fetchAdminUsers();
    } catch (error: any) {
      console.error('Create admin error:', error);
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

      toast.success(admin.is_active ? "Account deactivated" : "Account activated");
      fetchAdminUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to update account status");
    }
  };

  const handleResendPasswordEmail = async (admin: AdminUser) => {
    try {
  const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', admin.user_id)
        .single();

      if (profileError || !profileData?.email) {
        toast.error("User email not found. Please add email to the account first.");
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        profileData.email,
        {
          redirectTo: `${window.location.origin}/set-password`
        }
      );

      if (resetError) throw resetError;

      toast.success("Password setup link sent to email successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to send email");
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

      toast.success("Data updated successfully");
      setShowEditDialog(false);
      fetchAdminUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to update data");
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
      
      toast.success("Account deleted successfully");
      setShowDeleteDialog(false);
      fetchAdminUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete account");
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
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Button>
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Manage admin accounts and permissions</p>
          </div>
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
                  A password setup link will be sent to the new member's email
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
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
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={newAdmin.full_name}
                    onChange={(e) => setNewAdmin({ ...newAdmin, full_name: e.target.value })}
                    required
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={newAdmin.phone}
                    onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={newAdmin.role} onValueChange={(value) => setNewAdmin({ ...newAdmin, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin_viewer">Viewer (View Only)</SelectItem>
                      <SelectItem value="admin_manager">Manager (View & Edit)</SelectItem>
                      <SelectItem value="admin_full">Full Admin (All Permissions)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account & Send Link"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
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
              <TableHead>Created Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adminUsers.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className="font-medium">{admin.full_name}</TableCell>
                <TableCell>{admin.phone || "N/A"}</TableCell>
                <TableCell>{getRoleBadge(admin.role)}</TableCell>
                <TableCell>{new Date(admin.created_at).toLocaleDateString('en-US')}</TableCell>
                <TableCell>
                  <Badge variant={admin.is_active ? "default" : "secondary"}>
                    {admin.is_active ? "Active" : "Pending Activation"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2 justify-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditClick(admin)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResendPasswordEmail(admin)}
                      title="Resend Password Link"
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={admin.is_active ? "destructive" : "default"}
                      onClick={() => handleToggleActive(admin)}
                      title={admin.is_active ? "Deactivate" : "Activate"}
                    >
                      {admin.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteClick(admin)}
                      title="Delete"
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
            <DialogTitle>Edit User Data</DialogTitle>
            <DialogDescription>
              Edit basic user information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_full_name">Full Name</Label>
              <Input
                id="edit_full_name"
                value={editAdmin.full_name}
                onChange={(e) => setEditAdmin({ ...editAdmin, full_name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div>
              <Label htmlFor="edit_phone">Phone Number</Label>
              <Input
                id="edit_phone"
                value={editAdmin.phone}
                onChange={(e) => setEditAdmin({ ...editAdmin, phone: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="edit_role">Role</Label>
              <Select value={editAdmin.role} onValueChange={(value) => setEditAdmin({ ...editAdmin, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_viewer">Viewer (View Only)</SelectItem>
                  <SelectItem value="admin_manager">Manager (View & Edit)</SelectItem>
                  <SelectItem value="admin_full">Full Admin (All Permissions)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAdmin}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All data for user {selectedUser?.full_name} will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAdmin} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
