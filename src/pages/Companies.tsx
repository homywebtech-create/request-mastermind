import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Building2, ArrowRight, Settings, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { serviceTypes } from "@/data/serviceTypes";

interface Company {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  services?: string[];
}

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isServicesDialogOpen, setIsServicesDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  // جلب الشركات عند تحميل الصفحة
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    const { data: companiesData, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل الشركات",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // جلب الخدمات لكل شركة
    const { data: servicesData } = await supabase
      .from("company_services")
      .select("company_id, service_type");

    const companiesWithServices = (companiesData || []).map(company => ({
      ...company,
      services: (servicesData || [])
        .filter(s => s.company_id === company.id)
        .map(s => s.service_type)
    }));

    setCompanies(companiesWithServices);
    setLoading(false);
  };

  const handleManageServices = (company: Company) => {
    setSelectedCompany(company);
    setSelectedServices(company.services || []);
    setIsServicesDialogOpen(true);
  };

  const handleSaveServices = async () => {
    if (!selectedCompany) return;

    try {
      // حذف جميع الخدمات الحالية للشركة
      await supabase
        .from("company_services")
        .delete()
        .eq("company_id", selectedCompany.id);

      // إضافة الخدمات المحددة
      if (selectedServices.length > 0) {
        const servicesToInsert = selectedServices.map(service => ({
          company_id: selectedCompany.id,
          service_type: service
        }));

        const { error } = await supabase
          .from("company_services")
          .insert(servicesToInsert);

        if (error) throw error;
      }

      toast({
        title: "نجح",
        description: "تم تحديث الخدمات بنجاح",
      });

      setIsServicesDialogOpen(false);
      fetchCompanies();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleService = (service: string) => {
    setSelectedServices(prev =>
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("companies").insert([formData]);

    if (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "نجح",
        description: "تم إضافة الشركة بنجاح",
      });
      setIsFormOpen(false);
      setFormData({ name: "", phone: "", email: "", address: "" });
      fetchCompanies();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground font-cairo">
                إدارة الشركات
              </h1>
              <p className="text-muted-foreground mt-1">
                إدارة الشركات والمختصين
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/services")}
                className="flex items-center gap-2"
              >
                <Wrench className="h-4 w-4" />
                إدارة الخدمات
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                العودة للرئيسية
              </Button>

              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    شركة جديدة
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-cairo">إضافة شركة جديدة</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">اسم الشركة *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                        placeholder="أدخل اسم الشركة"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">رقم الهاتف</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder="أدخل رقم الهاتف"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">البريد الإلكتروني</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="example@email.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">العنوان</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        placeholder="أدخل العنوان"
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsFormOpen(false)}
                      >
                        إلغاء
                      </Button>
                      <Button type="submit">حفظ</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="font-cairo">{company.name}</CardTitle>
                      <CardDescription>
                        {company.is_active ? "نشط" : "غير نشط"}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleManageServices(company)}
                    title="إدارة الخدمات"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {company.phone && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">الهاتف:</span> {company.phone}
                  </p>
                )}
                {company.email && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">البريد:</span> {company.email}
                  </p>
                )}
                {company.address && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">العنوان:</span> {company.address}
                  </p>
                )}
                
                {company.services && company.services.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-2">الخدمات:</p>
                    <div className="flex flex-wrap gap-1">
                      {company.services.map((service) => (
                        <Badge key={service} variant="secondary" className="text-xs">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {(!company.services || company.services.length === 0) && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">لم يتم تحديد خدمات بعد</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {companies.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              لا توجد شركات بعد
            </h3>
            <p className="text-muted-foreground mb-4">
              ابدأ بإضافة أول شركة لك
            </p>
          </div>
        )}
      </main>

      {/* حوار إدارة الخدمات */}
      <Dialog open={isServicesDialogOpen} onOpenChange={setIsServicesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-cairo">
              إدارة خدمات {selectedCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              اختر الخدمات التي تقدمها هذه الشركة:
            </p>
            <div className="space-y-3">
              {serviceTypes.map((service) => (
                <div key={service} className="flex items-center gap-2">
                  <Checkbox
                    id={service}
                    checked={selectedServices.includes(service)}
                    onCheckedChange={() => toggleService(service)}
                  />
                  <Label htmlFor={service} className="cursor-pointer">
                    {service}
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsServicesDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button onClick={handleSaveServices}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
