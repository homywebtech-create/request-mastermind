import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, CheckCircle } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";

interface WalletPolicy {
  id: string;
  policy_key: string;
  policy_name_ar: string;
  policy_name_en: string;
  compensation_amount: number;
  description_ar: string;
  description_en: string;
  is_active: boolean;
  policy_type: 'specialist' | 'customer' | 'shared';
  implementation_status: 'pending' | 'in_development' | 'testing' | 'implemented' | 'verified';
  tested_at: string | null;
  tested_by: string | null;
  test_notes: string | null;
}

export default function WalletPolicies() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = useTranslation(language).specialist;
  const queryClient = useQueryClient();
  const [editingPolicy, setEditingPolicy] = useState<WalletPolicy | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    policy_key: '',
    policy_name_ar: '',
    policy_name_en: '',
    compensation_amount: 0,
    description_ar: '',
    description_en: '',
    policy_type: 'specialist' as const,
    implementation_status: 'pending' as const,
  });

  const { data: policies, isLoading } = useQuery({
    queryKey: ["wallet-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_policies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WalletPolicy[];
    },
  });

  const createPolicyMutation = useMutation({
    mutationFn: async (policy: typeof newPolicy) => {
      const { error } = await supabase
        .from("wallet_policies")
        .insert({
          policy_key: policy.policy_key,
          policy_name_ar: policy.policy_name_ar,
          policy_name_en: policy.policy_name_en,
          compensation_amount: policy.compensation_amount,
          description_ar: policy.description_ar,
          description_en: policy.description_en,
          policy_type: policy.policy_type,
          implementation_status: policy.implementation_status,
          is_active: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-policies"] });
      toast({
        title: language === "ar" ? "تم الإنشاء" : "Created",
        description: language === "ar" ? "تم إنشاء القانون بنجاح" : "Policy created successfully",
      });
      setShowCreateDialog(false);
      setNewPolicy({
        policy_key: '',
        policy_name_ar: '',
        policy_name_en: '',
        compensation_amount: 0,
        description_ar: '',
        description_en: '',
        policy_type: 'specialist',
        implementation_status: 'pending',
      });
    },
    onError: (error) => {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePolicyMutation = useMutation({
    mutationFn: async (policy: WalletPolicy) => {
      const { error } = await supabase
        .from("wallet_policies")
        .update({
          compensation_amount: policy.compensation_amount,
          description_ar: policy.description_ar,
          description_en: policy.description_en,
          is_active: policy.is_active,
          policy_type: policy.policy_type,
          implementation_status: policy.implementation_status,
        })
        .eq("id", policy.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-policies"] });
      toast({
        title: language === "ar" ? "تم التحديث" : "Updated",
        description: language === "ar" ? "تم تحديث القانون بنجاح" : "Policy updated successfully",
      });
      setEditingPolicy(null);
    },
    onError: (error) => {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyPolicyMutation = useMutation({
    mutationFn: async ({ policyId, notes }: { policyId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("wallet_policies")
        .update({
          implementation_status: 'verified',
          tested_at: new Date().toISOString(),
          tested_by: user?.id,
          test_notes: notes,
        })
        .eq("id", policyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-policies"] });
      toast({
        title: language === "ar" ? "تم التأكيد" : "Verified",
        description: language === "ar" ? "تم تأكيد القانون بنجاح" : "Policy verified successfully",
      });
    },
    onError: (error) => {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (editingPolicy) {
      updatePolicyMutation.mutate(editingPolicy);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t.walletPolicies}</h1>
          <p className="text-muted-foreground mt-2">
            {language === "ar"
              ? "إدارة قوانين التعويضات والمحفظة"
              : "Manage compensation and wallet policies"}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          {language === "ar" ? "إضافة قانون جديد" : "Add New Policy"}
        </Button>
      </div>

      {/* Create Policy Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "إضافة قانون جديد" : "Add New Policy"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === "ar" ? "مفتاح القانون" : "Policy Key"}</Label>
              <Input
                value={newPolicy.policy_key}
                onChange={(e) => setNewPolicy({ ...newPolicy, policy_key: e.target.value })}
                placeholder="customer_late_cancellation"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === "ar" ? "اسم القانون (عربي)" : "Policy Name (Arabic)"}</Label>
                <Input
                  value={newPolicy.policy_name_ar}
                  onChange={(e) => setNewPolicy({ ...newPolicy, policy_name_ar: e.target.value })}
                />
              </div>
              <div>
                <Label>{language === "ar" ? "اسم القانون (إنجليزي)" : "Policy Name (English)"}</Label>
                <Input
                  value={newPolicy.policy_name_en}
                  onChange={(e) => setNewPolicy({ ...newPolicy, policy_name_en: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>{t.compensationAmount}</Label>
              <Input
                type="number"
                value={newPolicy.compensation_amount}
                onChange={(e) => setNewPolicy({ ...newPolicy, compensation_amount: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "الوصف (عربي)" : "Description (Arabic)"}</Label>
              <Textarea
                value={newPolicy.description_ar}
                onChange={(e) => setNewPolicy({ ...newPolicy, description_ar: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "الوصف (إنجليزي)" : "Description (English)"}</Label>
              <Textarea
                value={newPolicy.description_en}
                onChange={(e) => setNewPolicy({ ...newPolicy, description_en: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === "ar" ? "نوع القانون" : "Policy Type"}</Label>
                <select
                  value={newPolicy.policy_type}
                  onChange={(e) => setNewPolicy({ ...newPolicy, policy_type: e.target.value as any })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                >
                  <option value="specialist">{language === "ar" ? "للمحترفين" : "For Specialists"}</option>
                  <option value="customer">{language === "ar" ? "للعملاء" : "For Customers"}</option>
                  <option value="shared">{language === "ar" ? "مشترك" : "Shared"}</option>
                </select>
              </div>
              <div>
                <Label>{language === "ar" ? "حالة التطبيق" : "Implementation Status"}</Label>
                <select
                  value={newPolicy.implementation_status}
                  onChange={(e) => setNewPolicy({ ...newPolicy, implementation_status: e.target.value as any })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                >
                  <option value="pending">{language === "ar" ? "قيد الانتظار" : "Pending"}</option>
                  <option value="in_development">{language === "ar" ? "قيد التطوير" : "In Development"}</option>
                  <option value="testing">{language === "ar" ? "قيد الاختبار" : "Testing"}</option>
                  <option value="implemented">{language === "ar" ? "تم التطبيق" : "Implemented"}</option>
                  <option value="verified">{language === "ar" ? "تم التأكيد" : "Verified"}</option>
                </select>
              </div>
            </div>
            
            <Button
              onClick={() => createPolicyMutation.mutate(newPolicy)}
              disabled={createPolicyMutation.isPending}
              className="w-full"
            >
              {createPolicyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                language === "ar" ? "حفظ" : "Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {policies?.map((policy) => (
          <Card key={policy.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {language === "ar" ? policy.policy_name_ar : policy.policy_name_en}
                  </CardTitle>
                  <CardDescription>
                    {language === "ar" ? policy.description_ar : policy.description_en}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setEditingPolicy(editingPolicy?.id === policy.id ? null : policy)}
                >
                  {editingPolicy?.id === policy.id 
                    ? (language === "ar" ? "إلغاء" : "Cancel")
                    : (language === "ar" ? "تعديل القانون" : "Edit Policy")
                  }
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {editingPolicy?.id === policy.id ? (
                <div className="space-y-4">
                  <div>
                    <Label>{t.compensationAmount}</Label>
                    <Input
                      type="number"
                      value={editingPolicy.compensation_amount}
                      onChange={(e) =>
                        setEditingPolicy({
                          ...editingPolicy,
                          compensation_amount: parseFloat(e.target.value),
                        })
                      }
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>{language === "ar" ? "الوصف بالعربية" : "Description (Arabic)"}</Label>
                    <Textarea
                      value={editingPolicy.description_ar}
                      onChange={(e) =>
                        setEditingPolicy({
                          ...editingPolicy,
                          description_ar: e.target.value,
                        })
                      }
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>{language === "ar" ? "الوصف بالإنجليزية" : "Description (English)"}</Label>
                    <Textarea
                      value={editingPolicy.description_en}
                      onChange={(e) =>
                        setEditingPolicy({
                          ...editingPolicy,
                          description_en: e.target.value,
                        })
                      }
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>{t.policyStatus}</Label>
                    <Switch
                      checked={editingPolicy.is_active}
                      onCheckedChange={(checked) =>
                        setEditingPolicy({
                          ...editingPolicy,
                          is_active: checked,
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{language === "ar" ? "نوع القانون" : "Policy Type"}</Label>
                      <select
                        value={editingPolicy.policy_type}
                        onChange={(e) => setEditingPolicy({ ...editingPolicy, policy_type: e.target.value as any })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background mt-1"
                      >
                        <option value="specialist">{language === "ar" ? "للمحترفين" : "For Specialists"}</option>
                        <option value="customer">{language === "ar" ? "للعملاء" : "For Customers"}</option>
                        <option value="shared">{language === "ar" ? "مشترك" : "Shared"}</option>
                      </select>
                    </div>
                    <div>
                      <Label>{language === "ar" ? "حالة التطبيق" : "Implementation Status"}</Label>
                      <select
                        value={editingPolicy.implementation_status}
                        onChange={(e) => setEditingPolicy({ ...editingPolicy, implementation_status: e.target.value as any })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background mt-1"
                      >
                        <option value="pending">{language === "ar" ? "قيد الانتظار" : "Pending"}</option>
                        <option value="in_development">{language === "ar" ? "قيد التطوير" : "In Development"}</option>
                        <option value="testing">{language === "ar" ? "قيد الاختبار" : "Testing"}</option>
                        <option value="implemented">{language === "ar" ? "تم التطبيق" : "Implemented"}</option>
                        <option value="verified">{language === "ar" ? "تم التأكيد" : "Verified"}</option>
                      </select>
                    </div>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={updatePolicyMutation.isPending}
                    className="w-full"
                  >
                    {updatePolicyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                        {language === "ar" ? "حفظ" : "Save"}
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.compensationAmount}:</span>
                    <span className="font-semibold">
                      {policy.compensation_amount} {language === "ar" ? "ريال" : "SAR"}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === "ar" ? "نوع القانون:" : "Policy Type:"}</span>
                    <span className="font-medium">
                      {policy.policy_type === 'specialist' 
                        ? (language === "ar" ? "للمحترفين" : "For Specialists")
                        : policy.policy_type === 'customer'
                        ? (language === "ar" ? "للعملاء" : "For Customers")
                        : (language === "ar" ? "مشترك" : "Shared")
                      }
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === "ar" ? "حالة التطبيق:" : "Implementation:"}</span>
                    <span className={`font-medium ${
                      policy.implementation_status === 'verified' ? 'text-green-600' :
                      policy.implementation_status === 'implemented' ? 'text-blue-600' :
                      policy.implementation_status === 'testing' ? 'text-yellow-600' :
                      policy.implementation_status === 'in_development' ? 'text-orange-600' :
                      'text-gray-600'
                    }`}>
                      {policy.implementation_status === 'verified' 
                        ? (language === "ar" ? "✓ تم التأكيد" : "✓ Verified")
                        : policy.implementation_status === 'implemented'
                        ? (language === "ar" ? "تم التطبيق" : "Implemented")
                        : policy.implementation_status === 'testing'
                        ? (language === "ar" ? "قيد الاختبار" : "Testing")
                        : policy.implementation_status === 'in_development'
                        ? (language === "ar" ? "قيد التطوير" : "In Development")
                        : (language === "ar" ? "قيد الانتظار" : "Pending")
                      }
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.policyStatus}:</span>
                    <span className={policy.is_active ? "text-green-600" : "text-red-600"}>
                      {policy.is_active 
                        ? (language === "ar" ? "نشط" : "Active") 
                        : (language === "ar" ? "غير نشط" : "Inactive")
                      }
                    </span>
                  </div>
                  
                  {policy.implementation_status === 'implemented' && (
                    <Button
                      onClick={() => verifyPolicyMutation.mutate({ policyId: policy.id })}
                      disabled={verifyPolicyMutation.isPending}
                      className="w-full mt-2 bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      {verifyPolicyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        language === "ar" ? "✓ تأكيد القانون" : "✓ Verify Policy"
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
