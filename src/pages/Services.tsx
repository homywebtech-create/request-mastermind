import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Settings, Trash2, ArrowRight, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { translations } from "@/i18n/translations";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Service {
  id: string;
  name: string;
  name_en?: string;
  description?: string;
  price?: number;
  is_active: boolean;
  created_at: string;
  sub_services?: SubService[];
}

interface SubService {
  id: string;
  service_id: string;
  name: string;
  name_en?: string;
  description?: string;
  price?: number;
  is_active: boolean;
  created_at: string;
}

const t = translations.services;
const tCommon = translations.common;

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [isSubServiceFormOpen, setIsSubServiceFormOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedSubService, setSelectedSubService] = useState<SubService | null>(null);
  const [isEditingService, setIsEditingService] = useState(false);
  const [isEditingSubService, setIsEditingSubService] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [subServiceToDelete, setSubServiceToDelete] = useState<SubService | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteSubDialogOpen, setIsDeleteSubDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [serviceFormData, setServiceFormData] = useState({
    name: "",
    name_en: "",
    description: "",
    price: "",
  });
  const [subServiceFormData, setSubServiceFormData] = useState({
    name: "",
    name_en: "",
    description: "",
    price: "",
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    const { data: servicesData, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .order("created_at", { ascending: false });

    if (servicesError) {
      toast({
        title: tCommon.error,
        description: t.loadError,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { data: subServicesData } = await supabase
      .from("sub_services")
      .select("*");

    const servicesWithSubs = (servicesData || []).map(service => ({
      ...service,
      sub_services: (subServicesData || []).filter(sub => sub.service_id === service.id)
    }));

    setServices(servicesWithSubs);
    setLoading(false);
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      ...serviceFormData,
      price: serviceFormData.price ? parseFloat(serviceFormData.price) : null
    };

    if (isEditingService && selectedService) {
      // Update existing service
      const { error } = await supabase
        .from("services")
        .update(submitData)
        .eq("id", selectedService.id);

      if (error) {
        toast({
          title: tCommon.error,
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: tCommon.success,
          description: "Service updated successfully",
        });
        setIsServiceFormOpen(false);
        setServiceFormData({ name: "", name_en: "", description: "", price: "" });
        setIsEditingService(false);
        setSelectedService(null);
        fetchServices();
      }
    } else {
      // Create new service
      const { error } = await supabase.from("services").insert([submitData]);

      if (error) {
        toast({
          title: tCommon.error,
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: tCommon.success,
          description: t.serviceAdded,
        });
        setIsServiceFormOpen(false);
        setServiceFormData({ name: "", name_en: "", description: "", price: "" });
        fetchServices();
      }
    }
  };

  const handleCreateSubService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    const submitData = {
      ...subServiceFormData,
      price: subServiceFormData.price ? parseFloat(subServiceFormData.price) : null
    };

    if (isEditingSubService && selectedSubService) {
      // Update existing sub-service
      const { error } = await supabase
        .from("sub_services")
        .update(submitData)
        .eq("id", selectedSubService.id);

      if (error) {
        toast({
          title: tCommon.error,
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: tCommon.success,
          description: "Sub-service updated successfully",
        });
        setIsSubServiceFormOpen(false);
        setSubServiceFormData({ name: "", name_en: "", description: "", price: "" });
        setIsEditingSubService(false);
        setSelectedSubService(null);
        setSelectedService(null);
        fetchServices();
      }
    } else {
      // Create new sub-service
      const { error } = await supabase.from("sub_services").insert([{
        ...submitData,
        service_id: selectedService.id
      }]);

      if (error) {
        toast({
          title: tCommon.error,
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: tCommon.success,
          description: t.subServiceAdded,
        });
        setIsSubServiceFormOpen(false);
        setSubServiceFormData({ name: "", name_en: "", description: "", price: "" });
        setSelectedService(null);
        fetchServices();
      }
    }
  };

  const handleDeleteService = async () => {
    if (!serviceToDelete) return;

    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", serviceToDelete.id);

    if (error) {
      toast({
        title: tCommon.error,
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: tCommon.success,
        description: "Service deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setServiceToDelete(null);
      fetchServices();
    }
  };

  const handleDeleteSubService = async () => {
    if (!subServiceToDelete) return;

    const { error } = await supabase
      .from("sub_services")
      .delete()
      .eq("id", subServiceToDelete.id);

    if (error) {
      toast({
        title: tCommon.error,
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: tCommon.success,
        description: t.subServiceDeleted,
      });
      setIsDeleteSubDialogOpen(false);
      setSubServiceToDelete(null);
      fetchServices();
    }
  };

  const openSubServiceDialog = (service: Service) => {
    setSelectedService(service);
    setIsEditingSubService(false);
    setSubServiceFormData({ name: "", name_en: "", description: "", price: "" });
    setIsSubServiceFormOpen(true);
  };

  const openEditServiceDialog = (service: Service) => {
    setSelectedService(service);
    setIsEditingService(true);
    setServiceFormData({
      name: service.name,
      name_en: service.name_en || "",
      description: service.description || "",
      price: service.price?.toString() || "",
    });
    setIsServiceFormOpen(true);
  };

  const openEditSubServiceDialog = (service: Service, subService: SubService) => {
    setSelectedService(service);
    setSelectedSubService(subService);
    setIsEditingSubService(true);
    setSubServiceFormData({
      name: subService.name,
      name_en: subService.name_en || "",
      description: subService.description || "",
      price: subService.price?.toString() || "",
    });
    setIsSubServiceFormOpen(true);
  };

  const openDeleteServiceDialog = (service: Service) => {
    setServiceToDelete(service);
    setIsDeleteDialogOpen(true);
  };

  const openDeleteSubServiceDialog = (subService: SubService) => {
    setSubServiceToDelete(subService);
    setIsDeleteSubDialogOpen(true);
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
                {t.title}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t.subtitle}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/admin")}
                className="flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                {t.backToHome}
              </Button>

              <Dialog open={isServiceFormOpen} onOpenChange={(open) => {
                setIsServiceFormOpen(open);
                if (!open) {
                  setIsEditingService(false);
                  setServiceFormData({ name: "", name_en: "", description: "", price: "" });
                  setSelectedService(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    {t.newService}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-cairo">
                      {isEditingService ? tCommon.edit + " " + t.serviceName : t.addService}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateService} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t.serviceName} *</Label>
                      <Input
                        id="name"
                        value={serviceFormData.name}
                        onChange={(e) =>
                          setServiceFormData({ ...serviceFormData, name: e.target.value })
                        }
                        required
                        placeholder={t.enterServiceName}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name_en">{t.serviceNameEn}</Label>
                      <Input
                        id="name_en"
                        value={serviceFormData.name_en}
                        onChange={(e) =>
                          setServiceFormData({ ...serviceFormData, name_en: e.target.value })
                        }
                        placeholder={t.enterServiceNameEn}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">{t.description}</Label>
                      <Textarea
                        id="description"
                        value={serviceFormData.description}
                        onChange={(e) =>
                          setServiceFormData({ ...serviceFormData, description: e.target.value })
                        }
                        placeholder={t.enterDescription}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="price">السعر الثابت / Fixed Price</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={serviceFormData.price}
                        onChange={(e) =>
                          setServiceFormData({ ...serviceFormData, price: e.target.value })
                        }
                        placeholder="اترك فارغاً إذا كان السعر غير ثابت / Leave empty if not fixed"
                      />
                      <p className="text-xs text-muted-foreground">
                        السعر سيظهر بعملة الدولة المختارة / Price will display in selected country's currency
                      </p>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsServiceFormOpen(false)}
                      >
                        {tCommon.cancel}
                      </Button>
                      <Button type="submit">{tCommon.save}</Button>
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
          {services.map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="font-cairo">{service.name_en || service.name}</CardTitle>
                    {service.name_en && service.name !== service.name_en && (
                      <p className="text-sm text-muted-foreground mt-1">{service.name}</p>
                    )}
                    {service.price && (
                      <Badge variant="secondary" className="mt-2">
                        {service.price} (متعدد العملات / Multi-currency)
                      </Badge>
                    )}
                    <CardDescription>
                      {service.description || t.noDescription}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditServiceDialog(service)}
                      title={tCommon.edit}
                      className="h-8 w-8"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteServiceDialog(service)}
                      title={tCommon.delete}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openSubServiceDialog(service)}
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      {t.sub}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {service.sub_services && service.sub_services.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium mb-2">{t.subServices}:</p>
                    <div className="space-y-2">
                      {service.sub_services.map((subService) => (
                        <div
                          key={subService.id}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{subService.name_en || subService.name}</p>
                            {subService.name_en && subService.name !== subService.name_en && (
                              <p className="text-xs text-muted-foreground">{subService.name}</p>
                            )}
                            {subService.price && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {subService.price} (متعدد العملات)
                              </Badge>
                            )}
                            {subService.description && (
                              <p className="text-xs text-muted-foreground">
                                {subService.description}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditSubServiceDialog(service, subService)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => openDeleteSubServiceDialog(subService)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t.noSubServices}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {services.length === 0 && (
          <div className="text-center py-12">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {t.noServicesYet}
            </h3>
            <p className="text-muted-foreground mb-4">
              {t.startAdding}
            </p>
          </div>
        )}
      </main>

      {/* حوار إضافة خدمة فرعية */}
      <Dialog open={isSubServiceFormOpen} onOpenChange={(open) => {
        setIsSubServiceFormOpen(open);
        if (!open) {
          setIsEditingSubService(false);
          setSubServiceFormData({ name: "", name_en: "", description: "", price: "" });
          setSelectedService(null);
          setSelectedSubService(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-cairo">
              {isEditingSubService ? tCommon.edit + " " + t.subServiceName : t.addSubServiceFor + " " + selectedService?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubService} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sub-name">{t.subServiceName} *</Label>
              <Input
                id="sub-name"
                value={subServiceFormData.name}
                onChange={(e) =>
                  setSubServiceFormData({ ...subServiceFormData, name: e.target.value })
                }
                required
                placeholder={t.enterSubServiceName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-name-en">{t.subServiceNameEn}</Label>
              <Input
                id="sub-name-en"
                value={subServiceFormData.name_en}
                onChange={(e) =>
                  setSubServiceFormData({ ...subServiceFormData, name_en: e.target.value })
                }
                placeholder={t.enterSubServiceNameEn}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-description">{t.description}</Label>
              <Textarea
                id="sub-description"
                value={subServiceFormData.description}
                onChange={(e) =>
                  setSubServiceFormData({ ...subServiceFormData, description: e.target.value })
                }
                placeholder={t.enterSubServiceDescription}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-price">السعر الثابت / Fixed Price</Label>
              <Input
                id="sub-price"
                type="number"
                step="0.01"
                min="0"
                value={subServiceFormData.price}
                onChange={(e) =>
                  setSubServiceFormData({ ...subServiceFormData, price: e.target.value })
                }
                placeholder="اترك فارغاً إذا كان السعر غير ثابت / Leave empty if not fixed"
              />
              <p className="text-xs text-muted-foreground">
                السعر سيظهر بعملة الدولة المختارة / Price will display in selected country's currency
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsSubServiceFormOpen(false);
                  setSelectedService(null);
                }}
              >
                {tCommon.cancel}
              </Button>
              <Button type="submit">{tCommon.save}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* حوار تأكيد حذف خدمة رئيسية */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-cairo">{tCommon.delete} {t.serviceName}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? All sub-services will also be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setServiceToDelete(null)}>
              {tCommon.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteService} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {tCommon.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* حوار تأكيد حذف خدمة فرعية */}
      <AlertDialog open={isDeleteSubDialogOpen} onOpenChange={setIsDeleteSubDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-cairo">{tCommon.delete} {t.subServiceName}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.confirmDeleteSubService}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSubServiceToDelete(null)}>
              {tCommon.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSubService} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {tCommon.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
