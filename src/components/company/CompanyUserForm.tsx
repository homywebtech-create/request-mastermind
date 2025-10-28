import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { CompanyUser } from "@/types/company-team";
import { CompanyPermissionsSelector } from "./CompanyPermissionsSelector";
import { DialogDescription } from "@/components/ui/dialog";

interface CompanyUserFormProps {
  companyId: string;
  user: CompanyUser | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CompanyUserForm({ companyId, user, onSuccess, onCancel }: CompanyUserFormProps) {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name,
        email: user.email,
        phone: user.phone || "",
        password: "",
      });
      setSelectedPermissions(user.permissions || []);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (user) {
        // Update existing user using edge function
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error(language === "ar" ? "الجلسة غير صالحة" : "Invalid session");
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-company-user`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              companyId,
              userData: {
                ...formData,
                isUpdate: true,
                userId: user.user_id,
                companyUserId: user.id,
              },
              permissions: selectedPermissions,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update user');
        }

        toast.success(language === "ar" ? "تم تحديث المستخدم بنجاح" : "User updated successfully");
      } else {
        // Create new user using edge function
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error(language === "ar" ? "الجلسة غير صالحة" : "Invalid session");
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-company-user`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              companyId,
              userData: formData,
              permissions: selectedPermissions,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create user');
        }

        toast.success(language === "ar" ? "تم إضافة المستخدم بنجاح" : "User added successfully");
      }

      onSuccess();
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast.error(error.message || (language === "ar" ? "حدث خطأ في حفظ المستخدم" : "Error saving user"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir={language === "ar" ? "rtl" : "ltr"}>
      <DialogDescription className="sr-only">
        {user
          ? (language === "ar" ? "قم بتعديل بيانات المستخدم" : "Edit user information")
          : (language === "ar" ? "قم بإضافة مستخدم جديد للفريق" : "Add a new user to the team")}
      </DialogDescription>
      
      <div className="space-y-2">
        <Label htmlFor="full_name">
          {language === "ar" ? "الاسم الكامل" : "Full Name"}
        </Label>
        <Input
          id="full_name"
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">
          {language === "ar" ? "البريد الإلكتروني" : "Email"}
        </Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          disabled={!!user}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">
          {language === "ar" ? "رقم الهاتف" : "Phone"}
        </Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>

      {!user && (
        <div className="space-y-2">
          <Label htmlFor="password">
            {language === "ar" ? "كلمة المرور" : "Password"}
          </Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            minLength={6}
          />
        </div>
      )}

      <CompanyPermissionsSelector
        selectedPermissions={selectedPermissions}
        onPermissionsChange={setSelectedPermissions}
      />

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {language === "ar" ? "إلغاء" : "Cancel"}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          {user
            ? (language === "ar" ? "تحديث" : "Update")
            : (language === "ar" ? "إضافة" : "Add")}
        </Button>
      </div>
    </form>
  );
}