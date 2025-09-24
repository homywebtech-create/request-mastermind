import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { serviceTypes } from "@/data/mockData";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OrderFormData {
  customerName: string;
  whatsappNumber: string;
  serviceType: string;
  notes: string;
}

interface OrderFormProps {
  onSubmit: (data: OrderFormData) => void;
  onCancel?: () => void;
}

export function OrderForm({ onSubmit, onCancel }: OrderFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<OrderFormData>({
    customerName: '',
    whatsappNumber: '',
    serviceType: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.whatsappNumber || !formData.serviceType) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    onSubmit(formData);
    setFormData({
      customerName: '',
      whatsappNumber: '',
      serviceType: '',
      notes: '',
    });
    
    toast({
      title: "تم إنشاء الطلب بنجاح",
      description: "تم إضافة الطلب الجديد إلى النظام",
    });
  };

  const handleInputChange = (field: keyof OrderFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          إنشاء طلب جديد
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">معلومات العميل</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">اسم العميل *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  placeholder="أدخل اسم العميل"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="whatsappNumber">رقم الواتساب *</Label>
                <Input
                  id="whatsappNumber"
                  value={formData.whatsappNumber}
                  onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                  placeholder="+966501234567"
                  dir="ltr"
                  required
                />
              </div>
            </div>
          </div>

          {/* Service Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">تفاصيل الخدمة</h3>
            
            <div className="space-y-2">
              <Label htmlFor="serviceType">نوع الخدمة *</Label>
              <Select value={formData.serviceType} onValueChange={(value) => handleInputChange('serviceType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع الخدمة" />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((service) => (
                    <SelectItem key={service} value={service}>
                      {service}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="أدخل أي ملاحظات إضافية..."
                rows={3}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              إنشاء الطلب
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                إلغاء
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}