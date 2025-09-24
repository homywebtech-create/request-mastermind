import { useState } from "react";
import { Order } from "@/types/order";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Phone, User, Wrench, Copy, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OrdersTableProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
}

export function OrdersTable({ orders, onUpdateStatus }: OrdersTableProps) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>('all');

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const generateOrderLink = (order: Order) => {
    const baseUrl = window.location.origin;
    const orderDetails = encodeURIComponent(
      `طلب رقم: ${order.id}\nالعميل: ${order.customer.name}\nالخدمة: ${order.serviceType}\nالملاحظات: ${order.notes || 'لا توجد'}\nالتاريخ: ${formatDate(order.createdAt)}`
    );
    return `${baseUrl}/order/${order.id}?details=${orderDetails}`;
  };

  const handleCopyOrderLink = async (order: Order) => {
    try {
      const orderLink = generateOrderLink(order);
      await navigator.clipboard.writeText(orderLink);
      
      // تحديث الحالة إلى "قيد التنفيذ" عند نسخ الرابط
      if (order.status === 'pending') {
        onUpdateStatus(order.id, 'in-progress');
      }
      
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
                <TableHead className="text-right">الخدمة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">تاريخ الإنشاء</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
                          <span className="font-medium">{order.customer.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span dir="ltr">{order.customer.whatsappNumber}</span>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">{order.serviceType}</Badge>
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
                        {formatDate(order.createdAt)}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* زر نسخ الرابط للطلبات قيد الانتظار */}
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
                        
                        {/* أزرار الإكمال والإلغاء للطلبات قيد التنفيذ */}
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
                        
                        {/* زر الواتساب متاح دائماً */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openWhatsApp(order.customer.whatsappNumber)}
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