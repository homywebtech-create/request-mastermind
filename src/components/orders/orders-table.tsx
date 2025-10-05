import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Phone, User, Wrench, Copy, CheckCircle, X, Building2, Eye, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

console.log("OrdersTable loaded - v2.0");

interface Order {
  id: string;
  customer_id: string;
  company_id: string | null;
  service_type: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
  order_link?: string;
  created_at: string;
  send_to_all_companies?: boolean;
  customers: {
    name: string;
    whatsapp_number: string;
  } | null;
  companies: {
    name: string;
  } | null;
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

  const sendOrderLinkViaWhatsApp = (order: Order) => {
    if (!order.customers?.whatsapp_number) return;
    
    const orderLink = order.order_link || `${window.location.origin}/order/${order.id}`;
    const cleanNumber = order.customers.whatsapp_number.replace(/\D/g, '');
    const companyName = order.companies?.name || 'غير محدد';
    const customerName = order.customers?.name || 'عزيزي العميل';
    
    const message = `مرحباً ${customerName}،

تم استلام طلبك بنجاح! ✅

📋 *تفاصيل الطلب:*
• الخدمة: ${order.service_type}
• الشركة: ${companyName}
${order.notes ? `• ملاحظات: ${order.notes}` : ''}

🔗 *رابط متابعة الطلب:*
${orderLink}

يمكنك استخدام هذا الرابط لمتابعة حالة طلبك في أي وقت.

شكراً لتواصلك معنا! 🌟`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    // Mark link as copied after sending
    onLinkCopied(order.id);
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
                          <span className="font-medium">{order.customers?.name || 'غير متوفر'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span dir="ltr">{order.customers?.whatsapp_number || 'غير متوفر'}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {order.send_to_all_companies ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            كل الشركات
                          </Badge>
                        ) : (
                          <span className="text-sm">{order.companies?.name || '-'}</span>
                        )}
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
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              التفاصيل
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="text-xl">تفاصيل الطلب</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6 py-4">
                              {/* Customer Info */}
                              <div className="space-y-3">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                  <User className="h-5 w-5" />
                                  معلومات العميل
                                </h3>
                                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">الاسم:</span>
                                    <span className="font-medium">{order.customers?.name || 'غير متوفر'}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">رقم الواتساب:</span>
                                    <span className="font-medium" dir="ltr">{order.customers?.whatsapp_number || 'غير متوفر'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Order Info */}
                              <div className="space-y-3">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                  <Wrench className="h-5 w-5" />
                                  تفاصيل الطلب
                                </h3>
                                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">الشركة:</span>
                                    {order.send_to_all_companies ? (
                                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                        كل الشركات
                                      </Badge>
                                    ) : (
                                      <span className="font-medium">{order.companies?.name || '-'}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">نوع الخدمة:</span>
                                    <Badge variant="outline">{order.service_type}</Badge>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">الحالة:</span>
                                    <StatusBadge status={order.status} />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">تاريخ الإنشاء:</span>
                                    <span className="font-medium">{formatDate(order.created_at)}</span>
                                  </div>
                                  {order.notes && (
                                    <div className="pt-2">
                                      <span className="text-muted-foreground block mb-1">الملاحظات:</span>
                                      <p className="text-sm bg-background rounded p-2">{order.notes}</p>
                                    </div>
                                  )}
                                  {order.order_link && (
                                    <div className="pt-2">
                                      <span className="text-muted-foreground block mb-1">رابط الطلب:</span>
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs bg-background rounded px-2 py-1 flex-1 truncate">
                                          {order.order_link}
                                        </code>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => window.open(order.order_link, '_blank')}
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2 pt-4 border-t">
                                {order.customers?.whatsapp_number && (
                                  <>
                                    <Button
                                      onClick={() => openWhatsApp(order.customers.whatsapp_number)}
                                      className="flex-1"
                                      variant="outline"
                                    >
                                      <Phone className="h-4 w-4 ml-2" />
                                      التواصل عبر واتساب
                                    </Button>
                                    {order.status === 'pending' && (
                                      <Button
                                        onClick={() => sendOrderLinkViaWhatsApp(order)}
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                      >
                                        <Phone className="h-4 w-4 ml-2" />
                                        إرسال رابط الطلب
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {order.status === 'pending' && order.customers?.whatsapp_number && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => sendOrderLinkViaWhatsApp(order)}
                              className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                            >
                              <Phone className="h-3 w-3" />
                              إرسال الرابط
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopyOrderLink(order)}
                              className="flex items-center gap-1"
                            >
                              <Copy className="h-3 w-3" />
                              نسخ
                            </Button>
                          </>
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
                        
                        {order.customers?.whatsapp_number && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openWhatsApp(order.customers.whatsapp_number)}
                            className="flex items-center gap-1"
                          >
                            <Phone className="h-3 w-3" />
                            واتساب
                          </Button>
                        )}
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
