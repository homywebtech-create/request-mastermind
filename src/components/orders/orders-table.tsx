import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Phone, User, Wrench, Copy, CheckCircle, X, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Order {
  id: string;
  customer_id: string;
  company_id: string;
  service_type: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
  order_link?: string;
  created_at: string;
  customers: {
    name: string;
    whatsapp_number: string;
  };
  companies: {
    name: string;
  };
}

interface OrdersTableProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: string) => void;
  onLinkCopied: (orderId: string) => void;
}

export function OrdersTable({ orders, onUpdateStatus, onLinkCopied }: OrdersTableProps) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>('all');

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const handleCopyOrderLink = async (order: Order) => {
    try {
      const orderLink = order.order_link || `${window.location.origin}/order/${order.id}`;
      await navigator.clipboard.writeText(orderLink);
      
      onLinkCopied(order.id);
      
      toast({
        title: "تم نسخ الرابط",
        description: "تم نسخ رابط الطلب ومشاركته مع الفريق",
      });
    } catch (error) {
      toast({
        title: "خطأ في النسخ",
        description: "حدث خطأ أثناء نسخ الرابط",
        variant: "destructive",
      });
    }
  };

  const openWhatsApp = (phoneNumber: string) => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanNumber}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            قائمة الطلبات
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الطلبات</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="in-progress">قيد التنفيذ</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="font-cairo">
              {filteredOrders.length} طلب
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">الشركة</TableHead>
                <TableHead className="text-right">الخدمة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">تاريخ الإنشاء</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    لا توجد طلبات متاحة
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{order.customers.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span dir="ltr">{order.customers.whatsapp_number}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{order.companies.name}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">{order.service_type}</Badge>
                        {order.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {order.notes}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(order.created_at)}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleCopyOrderLink(order)}
                            className="flex items-center gap-1"
                          >
                            <Copy className="h-3 w-3" />
                            نسخ الرابط
                          </Button>
                        )}
                        
                        {order.status === 'in-progress' && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => onUpdateStatus(order.id, 'completed')}
                              className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-3 w-3" />
                              إكمال
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onUpdateStatus(order.id, 'cancelled')}
                              className="flex items-center gap-1 text-red-600 border-red-600 hover:bg-red-50"
                            >
                              <X className="h-3 w-3" />
                              إلغاء
                            </Button>
                          </>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openWhatsApp(order.customers.whatsapp_number)}
                          className="flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          واتساب
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
