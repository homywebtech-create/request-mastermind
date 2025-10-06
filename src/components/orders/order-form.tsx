import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countries } from "@/data/countries";
import { qatarAreas } from "@/data/areas";
import { Plus, Phone, User, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Service {
  id: string;
  name: string;
  sub_services: SubService[];
}

interface SubService {
  id: string;
  name: string;
}

interface OrderFormData {
  customerName: string;
  countryCode: string;
  phoneNumber: string;
  area: string;
  budget: string;
  serviceId: string;
  subServiceId: string;
  sendToAll: boolean;
  companyId: string;
  specialistIds: string[];
  notes: string;
}

interface SubmittedOrderData {
  customerName: string;
  whatsappNumber: string;
  area: string;
  budget: string;
  serviceType: string;
  sendToAll: boolean;
  companyId?: string;
  specialistIds?: string[];
  notes: string;
}

interface Company {
  id: string;
  name: string;
}

interface Specialist {
  id: string;
  name: string;
  specialty: string | null;
  phone: string;
  image_url: string | null;
}

interface OrderFormProps {
  onSubmit: (data: SubmittedOrderData) => void;
  onCancel?: () => void;
}

export function OrderForm({ onSubmit, onCancel }: OrderFormProps) {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [formData, setFormData] = useState<OrderFormData>({
    customerName: '',
    countryCode: 'QA',
    phoneNumber: '',
    area: '',
    budget: '',
    serviceId: '',
    subServiceId: '',
    sendToAll: true,
    companyId: '',
    specialistIds: [],
    notes: '',
  });

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (formData.serviceId) {
      const service = services.find(s => s.id === formData.serviceId);
      setSelectedService(service || null);
      setFormData(prev => ({ ...prev, subServiceId: '' }));
    }
  }, [formData.serviceId, services]);

  useEffect(() => {
    if (formData.serviceId && !formData.sendToAll) {
      fetchCompaniesForService(formData.serviceId, formData.subServiceId);
    } else {
      setCompanies([]);
    }
  }, [formData.serviceId, formData.subServiceId, formData.sendToAll]);

  useEffect(() => {
    if (formData.companyId) {
      fetchSpecialistsForCompany(formData.companyId);
    } else {
      setSpecialists([]);
    }
  }, [formData.companyId]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select(`
          id,
          name,
          sub_services (
            id,
            name
          )
        `)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  const fetchCompaniesForService = async (serviceId: string, subServiceId?: string) => {
    try {
      let query = supabase
        .from("company_services")
        .select(`
          company_id,
          companies!inner (
            id,
            name,
            is_active
          )
        `)
        .eq("companies.is_active", true)
        .eq("service_id", serviceId);

      if (subServiceId) {
        query = query.eq("sub_service_id", subServiceId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const uniqueCompanies = Array.from(
        new Map(
          data?.map((cs: any) => [
            cs.companies.id,
            { id: cs.companies.id, name: cs.companies.name }
          ])
        ).values()
      );

      setCompanies(uniqueCompanies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      setCompanies([]);
    }
  };

  const fetchSpecialistsForCompany = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from("specialists")
        .select("id, name, specialty, phone, image_url")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setSpecialists(data || []);
    } catch (error) {
      console.error("Error fetching specialists:", error);
      setSpecialists([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.phoneNumber || !formData.serviceId) {
      toast({
        title: "Missing Data",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    // Verify sub-service selection if available
    if (selectedService && selectedService.sub_services.length > 0 && !formData.subServiceId) {
      toast({
        title: "Missing Data",
        description: "Please select a sub-service",
        variant: "destructive",
      });
      return;
    }

    // Verify company selection if not sending to all
    if (!formData.sendToAll && !formData.companyId) {
      toast({
        title: "Missing Data",
        description: "Please select a specific company or enable send to all companies",
        variant: "destructive",
      });
      return;
    }

    // دمج كود الدولة مع رقم الهاتف
    const selectedCountry = countries.find(c => c.code === formData.countryCode);
    const fullWhatsappNumber = `${selectedCountry?.dialCode}${formData.phoneNumber}`;
    
    // بناء serviceType من الأسماء
    const service = services.find(s => s.id === formData.serviceId);
    const subService = service?.sub_services.find(ss => ss.id === formData.subServiceId);
    const serviceType = subService ? `${service?.name} - ${subService.name}` : service?.name || "";
    
    const submittedData: SubmittedOrderData = {
      customerName: formData.customerName,
      whatsappNumber: fullWhatsappNumber,
      area: formData.area,
      budget: formData.budget,
      serviceType,
      sendToAll: formData.sendToAll,
      companyId: formData.sendToAll ? undefined : formData.companyId,
      specialistIds: formData.specialistIds.length > 0 ? formData.specialistIds : undefined,
      notes: formData.notes
    };
    
    onSubmit(submittedData);
    
    setFormData({
      customerName: '',
      countryCode: 'QA',
      phoneNumber: '',
      area: '',
      budget: '',
      serviceId: '',
      subServiceId: '',
      sendToAll: true,
      companyId: '',
      specialistIds: [],
      notes: '',
    });
    setSelectedService(null);
  };

  const handleInputChange = (field: keyof OrderFormData, value: string) => {
    setFormData(prev => {
      if (field === 'serviceId') {
        return { ...prev, serviceId: value, subServiceId: '', companyId: '', specialistIds: [] };
      }
      if (field === 'subServiceId') {
        return { ...prev, subServiceId: value, companyId: '', specialistIds: [] };
      }
      if (field === 'companyId') {
        return { ...prev, companyId: value, specialistIds: [] };
      }
      return { ...prev, [field]: value };
    });
  };

  const toggleSpecialist = (specialistId: string) => {
    setFormData(prev => ({
      ...prev,
      specialistIds: prev.specialistIds.includes(specialistId)
        ? prev.specialistIds.filter(id => id !== specialistId)
        : [...prev.specialistIds, specialistId]
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Create New Order
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Customer Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  placeholder="Enter customer name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">WhatsApp Number *</Label>
                <div className="flex gap-2">
                  <Select 
                    value={formData.countryCode} 
                    onValueChange={(value) => handleInputChange('countryCode', value)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue>
                        {(() => {
                          const country = countries.find(c => c.code === formData.countryCode);
                          return country ? (
                            <span className="flex items-center gap-2">
                              <span className="text-xl">{country.flag}</span>
                              <span className="text-sm">{country.dialCode}</span>
                            </span>
                          ) : 'Select';
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {countries.map((country) => (
                        <SelectItem 
                          key={country.code} 
                          value={country.code}
                          className="cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-xl">{country.flag}</span>
                            <span className="font-medium">{country.nameAr}</span>
                            <span className="text-muted-foreground text-sm">{country.dialCode}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    id="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={(e) => {
                      // Allow numbers only
                      const value = e.target.value.replace(/\D/g, '');
                      handleInputChange('phoneNumber', value);
                    }}
                    placeholder="501234567"
                    dir="ltr"
                    className="flex-1"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter number without country code
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="area">المنطقة / Area</Label>
                <Select value={formData.area} onValueChange={(value) => handleInputChange('area', value)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="اختر المنطقة / Select Area" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] bg-background z-50">
                    {qatarAreas.map((area) => (
                      <SelectItem key={area.id} value={area.name}>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{area.name}</span>
                          <span className="text-muted-foreground text-sm">({area.nameEn})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="budget">الميزانية / Budget</Label>
                <Input
                  id="budget"
                  value={formData.budget}
                  onChange={(e) => handleInputChange('budget', e.target.value)}
                  placeholder="مثال: 5000 ريال"
                  dir="rtl"
                />
              </div>
            </div>
          </div>

          {/* Service Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Service Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceId">Main Service *</Label>
                <Select value={formData.serviceId} onValueChange={(value) => handleInputChange('serviceId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose main service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedService && selectedService.sub_services.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="subServiceId">Sub-Service *</Label>
                  <Select value={formData.subServiceId} onValueChange={(value) => handleInputChange('subServiceId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose sub-service" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedService.sub_services.map((subService) => (
                        <SelectItem key={subService.id} value={subService.id}>
                          {subService.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Send Order To</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sendToAll"
                    checked={formData.sendToAll}
                    onChange={() => {
                      setFormData(prev => ({ ...prev, sendToAll: true, companyId: '', specialistIds: [] }));
                    }}
                    className="w-4 h-4 text-primary"
                    disabled={!formData.serviceId}
                  />
                  <span className={`text-sm ${!formData.serviceId ? 'text-muted-foreground' : ''}`}>
                    All Companies
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sendToAll"
                    checked={!formData.sendToAll}
                    onChange={() => {
                      setFormData(prev => ({ ...prev, sendToAll: false }));
                    }}
                    className="w-4 h-4 text-primary"
                    disabled={!formData.serviceId}
                  />
                  <span className={`text-sm ${!formData.serviceId ? 'text-muted-foreground' : ''}`}>
                    Specific Company {companies.length > 0 && `(${companies.length})`}
                  </span>
                </label>
              </div>
              {!formData.serviceId && (
                <p className="text-xs text-muted-foreground">
                  Choose service first
                </p>
              )}
              {formData.serviceId && !formData.sendToAll && companies.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No companies offer this service currently
                </p>
              )}
            </div>

            {!formData.sendToAll && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="companyId">Choose Company *</Label>
                  <Select value={formData.companyId} onValueChange={(value) => handleInputChange('companyId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.companyId && specialists.length > 0 && (
                  <div className="space-y-3">
                    <Label>Choose Specialists (Optional)</Label>
                    <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto space-y-3">
                      {specialists.map((specialist) => (
                        <label
                          key={specialist.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={formData.specialistIds.includes(specialist.id)}
                            onChange={() => toggleSpecialist(specialist.id)}
                            className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                          />
                          {specialist.image_url ? (
                            <img 
                              src={specialist.image_url} 
                              alt={specialist.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex flex-col flex-1">
                            <span className="font-medium">{specialist.name}</span>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span dir="ltr">{specialist.phone}</span>
                              {specialist.specialty && (
                                <>
                                  <span>•</span>
                                  <span>{specialist.specialty}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    {formData.specialistIds.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {formData.specialistIds.length} specialist(s) selected
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Leave empty to send to all specialists in this company
                    </p>
                  </div>
                )}
              </>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Enter any additional notes..."
                rows={3}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              Create Order
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}