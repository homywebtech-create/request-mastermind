// OrdersTable Component - Version: 2025-01-05-08:46
// All null checks implemented with optional chaining
import { useState, useEffect } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar, Phone, User, Wrench, Building2, Eye, ExternalLink, Send, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Order {
  id: string;
  customer_id: string;
  company_id: string | null;
  service_type: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
  order_link?: string;
  created_at: string;
  last_sent_at?: string;
  send_to_all_companies?: boolean;
  customers: {
    name: string;
    whatsapp_number: string;
    area?: string;
    budget?: string;
  } | null;
  companies: {
    name: string;
  } | null;
  order_specialists?: Array<{
    id: string;
    quoted_price: string | null;
    quoted_at: string | null;
    is_accepted: boolean | null;
    specialists: {
      id: string;
      name: string;
      phone: string;
      nationality: string | null;
      image_url: string | null;
    };
  }>;
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

interface OrdersTableProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: string) => void;
  onLinkCopied: (orderId: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
}

export function OrdersTable({ orders, onUpdateStatus, onLinkCopied, filter, onFilterChange }: OrdersTableProps) {
  const { toast } = useToast();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedSpecialistIds, setSelectedSpecialistIds] = useState<string[]>([]);

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'new' || filter === 'pending') {
      // New orders: pending status with no quotes
      return order.status === 'pending' && 
             (order.company_id || order.send_to_all_companies) &&
             (!order.order_specialists || order.order_specialists.every(os => !os.quoted_price));
    }
    if (filter === 'awaiting-response') {
      // Awaiting response: has at least one quote, not accepted yet
      return order.order_specialists && 
             order.order_specialists.some(os => os.quoted_price && os.is_accepted === null);
    }
    return order.status === filter;
  });

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const getTimeSinceSent = (order: Order) => {
    const now = new Date();
    const sentTime = order.last_sent_at ? new Date(order.last_sent_at) : new Date(order.created_at);
    const diffInMinutes = Math.floor((now.getTime() - sentTime.getTime()) / (1000 * 60));
    return diffInMinutes;
  };

  const isOverThreeMinutes = (order: Order) => {
    return getTimeSinceSent(order) > 3;
  };

  const isWithinThreeMinutes = (order: Order) => {
    return getTimeSinceSent(order) <= 3;
  };

  const handleCopyOrderLink = async (order: Order) => {
    try {
      const orderLink = order.order_link || `${window.location.origin}/order/${order.id}`;
      await navigator.clipboard.writeText(orderLink);
      
      onLinkCopied(order.id);
      
      toast({
        title: "Link Copied",
        description: "Order link copied and shared with the team",
      });
    } catch (error) {
      toast({
        title: "Copy Error",
        description: "Error copying link",
        variant: "destructive",
      });
    }
  };

  const sendOrderLinkViaWhatsApp = (order: Order) => {
    if (!order.customers?.whatsapp_number) {
      toast({
        title: "Error",
        description: "WhatsApp number not available",
        variant: "destructive",
      });
      return;
    }
    
    const orderLink = order.order_link || `${window.location.origin}/order/${order.id}`;
    const cleanNumber = order.customers.whatsapp_number.replace(/\D/g, '');
    const companyName = order.companies?.name || 'Not specified';
    const customerName = order.customers?.name || 'Dear Customer';
    
    const message = `Hello ${customerName},

Your order has been successfully received! ✅

📋 *Order Details:*
• Service: ${order.service_type}
• Company: ${companyName}
${order.notes ? `• Notes: ${order.notes}` : ''}

🔗 *Order Tracking Link:*
${orderLink}

You can use this link to track your order status at any time.

Thank you for contacting us! 🌟`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    onLinkCopied(order.id);
  };

  const openWhatsApp = (phoneNumber: string) => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanNumber}`;
    window.open(whatsappUrl, '_blank');
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      });
    }
  };

  const fetchSpecialists = async (companyId: string) => {
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

  useEffect(() => {
    if (selectedCompanyId) {
      fetchSpecialists(selectedCompanyId);
    } else {
      setSpecialists([]);
      setSelectedSpecialistIds([]);
    }
  }, [selectedCompanyId]);

  const handleSendToAll = async (orderId: string) => {
    try {
      // Delete existing specialists assignments
      await supabase
        .from('order_specialists')
        .delete()
        .eq('order_id', orderId);

      const { error } = await supabase
        .from('orders')
        .update({
          send_to_all_companies: true,
          company_id: null,
          specialist_id: null,
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "تم الإرسال بنجاح",
        description: "تم إرسال الطلب لجميع الشركات",
      });
      
      setResendDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleResendToSameCompany = async (order: Order) => {
    try {
      if (!order.company_id) {
        toast({
          title: "خطأ",
          description: "لا توجد شركة محددة لهذا الطلب",
          variant: "destructive",
        });
        return;
      }

      // Delete existing specialists assignments
      await supabase
        .from('order_specialists')
        .delete()
        .eq('order_id', order.id);

      const { error } = await supabase
        .from('orders')
        .update({
          send_to_all_companies: false,
          company_id: order.company_id,
          specialist_id: null,
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: "تم الإرسال بنجاح",
        description: "تم إعادة إرسال الطلب لنفس الشركة",
      });
      
      setResendDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleResendToSameSpecialists = async (order: Order) => {
    try {
      // Get current specialists for this order
      const { data: currentSpecialists, error: fetchError } = await supabase
        .from('order_specialists')
        .select('specialist_id')
        .eq('order_id', order.id);

      if (fetchError) throw fetchError;

      if (!currentSpecialists || currentSpecialists.length === 0) {
        toast({
          title: "خطأ",
          description: "لا توجد عاملات محددة لهذا الطلب",
          variant: "destructive",
        });
        return;
      }

      // Update order timestamp to trigger notification (keeping same specialists)
      const { error } = await supabase
        .from('orders')
        .update({
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: "تم الإرسال بنجاح",
        description: `تم إعادة إرسال الطلب لـ ${currentSpecialists.length} عاملة/عاملات`,
      });
      
      setResendDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openResendDialog = async (order: Order) => {
    setSelectedOrder(order);
    
    // Fetch latest order data to ensure we have company info
    const { data: latestOrder, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name, whatsapp_number, area, budget),
        companies (name)
      `)
      .eq('id', order.id)
      .single();
    
    if (!error && latestOrder) {
      setSelectedOrder(latestOrder as any);
    }
    
    setResendDialogOpen(true);
  };

  const handleSendToCompany = async () => {
    if (!selectedOrder || !selectedCompanyId) return;

    try {
      // Create order with company assignment
      const { data: updatedOrder, error: orderError } = await supabase
        .from('orders')
        .update({
          send_to_all_companies: false,
          company_id: selectedCompanyId,
          specialist_id: null,
        })
        .eq('id', selectedOrder.id)
        .select('id')
        .single();

      if (orderError) throw orderError;

      // If specific specialists are selected, insert into junction table
      if (selectedSpecialistIds.length > 0) {
        // First, delete existing specialists for this order
        await supabase
          .from('order_specialists')
          .delete()
          .eq('order_id', selectedOrder.id);

        // Insert new specialists
        const orderSpecialists = selectedSpecialistIds.map(specialistId => ({
          order_id: updatedOrder.id,
          specialist_id: specialistId,
        }));

        const { error: junctionError } = await supabase
          .from('order_specialists')
          .insert(orderSpecialists);

        if (junctionError) throw junctionError;
      }

      let description = "Order sent to company";
      if (selectedSpecialistIds.length > 0) {
        description = `Order sent to ${selectedSpecialistIds.length} specialist(s)`;
      } else {
        description = "Order sent to all company specialists";
      }

      toast({
        title: "Success",
        description,
      });

      setSendDialogOpen(false);
      setSelectedOrder(null);
      setSelectedCompanyId('');
      setSelectedSpecialistIds([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openSendDialog = (order: Order) => {
    setSelectedOrder(order);
    setSelectedCompanyId('');
    setSelectedSpecialistIds([]);
    fetchCompanies();
    setSendDialogOpen(true);
  };

  const toggleSpecialist = (specialistId: string) => {
    setSelectedSpecialistIds(prev =>
      prev.includes(specialistId)
        ? prev.filter(id => id !== specialistId)
        : [...prev, specialistId]
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Orders List
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={onFilterChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="new">New Requests</SelectItem>
                <SelectItem value="awaiting-response">Awaiting Response</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary">
              {filteredOrders.length} orders
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto" dir="ltr">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Customer</TableHead>
                <TableHead className="text-left">Area</TableHead>
                <TableHead className="text-left">Customer Budget</TableHead>
                <TableHead className="text-left">Service</TableHead>
                <TableHead className="text-left">Recommendations</TableHead>
                <TableHead className="text-left">Date & Status</TableHead>
                <TableHead className="text-left">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No orders available
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const customerName = order.customers?.name || 'غير متوفر';
                  const customerPhone = order.customers?.whatsapp_number || 'غير متوفر';
                  const customerArea = order.customers?.area || '-';
                  const customerBudget = order.customers?.budget || '-';
                  const isPending = order.status === 'pending' && (order.company_id || order.send_to_all_companies);
                  const minutesSinceSent = getTimeSinceSent(order);
                  const isDelayed = isOverThreeMinutes(order) && isPending;
                  const isRecentlySent = isWithinThreeMinutes(order) && isPending;
                  
                  return (
                    <TableRow 
                      key={order.id}
                      className={isDelayed ? "bg-destructive/10 border-destructive/20" : isRecentlySent ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/30" : ""}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{customerName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span dir="ltr">{customerPhone}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-sm">{customerArea}</span>
                      </TableCell>

                      <TableCell>
                        <span className="text-sm">{customerBudget}</span>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="outline">{order.service_type}</Badge>
                      </TableCell>

                      <TableCell>
                        {order.notes ? (
                          <p className="text-sm max-w-xs line-clamp-2">{order.notes}</p>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                            <Calendar className="h-3 w-3" />
                            {formatDate(order.created_at)}
                          </div>
                          {isPending && (
                            <div className={`text-xs font-medium ${isDelayed ? 'text-destructive' : isRecentlySent ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                              {isDelayed 
                                ? `⚠️ لا يوجد رد منذ ${minutesSinceSent} دقيقة`
                                : isRecentlySent 
                                  ? `✓ تم الإرسال، بانتظار الرد (${minutesSinceSent} دقيقة)`
                                  : `✓ تم الإرسال، بانتظار الرد (${minutesSinceSent} دقيقة)`
                              }
                            </div>
                          )}
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
                                Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle className="text-xl">Order Details</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-6 py-4">
                                <div className="space-y-3">
                                  <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    Customer Information
                                  </h3>
                                   <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Name:</span>
                                      <span className="font-medium">{customerName}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">WhatsApp Number:</span>
                                      <span className="font-medium" dir="ltr">{customerPhone}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Area:</span>
                                      <span className="font-medium">{customerArea}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Budget:</span>
                                      <span className="font-medium">{customerBudget}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <Wrench className="h-5 w-5" />
                                    Order Details
                                  </h3>
                                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Service Type:</span>
                                      <Badge variant="outline">{order.service_type}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Status:</span>
                                      <StatusBadge status={order.status} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Created At:</span>
                                      <span className="font-medium">{formatDate(order.created_at)}</span>
                                    </div>
                                    {order.notes && (
                                      <div className="pt-2">
                                        <span className="text-muted-foreground block mb-1">Notes:</span>
                                        <p className="text-sm bg-background rounded p-2">{order.notes}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Specialist Quotes Section */}
                                {order.order_specialists && order.order_specialists.length > 0 && (
                                  <div className="space-y-3">
                                    <h3 className="font-semibold text-lg flex items-center gap-2">
                                      <Users className="h-5 w-5" />
                                      Specialist Quotes ({order.order_specialists.filter(os => os.quoted_price).length})
                                    </h3>
                                     <div className="space-y-3">
                                      {order.order_specialists
                                        .filter(os => os.quoted_price)
                                        .map((os) => (
                                          <div key={os.id} className="bg-muted/50 rounded-lg p-4 border border-border">
                                            <div className="flex gap-4">
                                              {/* Specialist Image */}
                                              <div className="flex-shrink-0">
                                                {os.specialists?.image_url ? (
                                                  <img 
                                                    src={os.specialists.image_url} 
                                                    alt={os.specialists.name}
                                                    className="w-20 h-20 rounded-lg object-cover border-2 border-border"
                                                  />
                                                ) : (
                                                  <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center border-2 border-border">
                                                    <User className="h-10 w-10 text-muted-foreground" />
                                                  </div>
                                                )}
                                              </div>

                                              {/* Specialist Info */}
                                              <div className="flex-1 space-y-2">
                                                <div className="flex items-start justify-between">
                                                  <div>
                                                    <h4 className="font-semibold text-lg">{os.specialists?.name || 'Unknown'}</h4>
                                                    {os.specialists?.nationality && (
                                                      <p className="text-sm text-muted-foreground">
                                                        {os.specialists.nationality}
                                                      </p>
                                                    )}
                                                  </div>
                                                  {os.is_accepted === true && (
                                                    <Badge className="bg-green-600">Accepted</Badge>
                                                  )}
                                                  {os.is_accepted === false && (
                                                    <Badge variant="destructive">Rejected</Badge>
                                                  )}
                                                  {os.is_accepted === null && (
                                                    <Badge variant="secondary">Pending Review</Badge>
                                                  )}
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 pt-2">
                                                  <div className="flex items-center gap-2">
                                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm">{os.specialists?.phone || 'N/A'}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-primary">
                                                      Quote: {os.quoted_price}
                                                    </span>
                                                  </div>
                                                </div>

                                                {os.quoted_at && (
                                                  <p className="text-xs text-muted-foreground pt-1">
                                                    Submitted: {formatDate(os.quoted_at)}
                                                  </p>
                                                )}

                                                {/* WhatsApp Button */}
                                                {os.specialists?.phone && (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openWhatsApp(os.specialists.phone)}
                                                    className="mt-2 flex items-center gap-2"
                                                  >
                                                    <Phone className="h-3 w-3" />
                                                    Contact on WhatsApp
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      {order.order_specialists.every(os => !os.quoted_price) && (
                                        <div className="bg-muted/30 rounded-lg p-4 text-center">
                                          <p className="text-sm text-muted-foreground">No quotes submitted yet</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>

                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                variant={isDelayed ? "destructive" : "outline"}
                                onClick={() => openResendDialog(order)}
                                disabled={!!isRecentlySent}
                                className="flex items-center gap-1"
                              >
                                <Send className="h-3 w-3" />
                                {isRecentlySent ? `Resend (${3 - minutesSinceSent}m)` : 'Resend'}
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openSendDialog(order)}
                                className="flex items-center gap-1"
                              >
                                <Building2 className="h-3 w-3" />
                                Change
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Resend Options Dialog */}
      <Dialog open={resendDialogOpen} onOpenChange={setResendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resend Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Choose how you want to resend this order:
            </p>

            {selectedOrder && (
              <div className="space-y-3">
                <Button
                  onClick={() => handleSendToAll(selectedOrder.id)}
                  variant="outline"
                  className="w-full justify-start h-auto py-4"
                >
                  <div className="flex flex-col items-start gap-1 text-left">
                    <div className="flex items-center gap-2 font-medium">
                      <Users className="h-4 w-4" />
                      Send to All Companies
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Broadcast this order to all available companies
                    </span>
                  </div>
                </Button>

                {selectedOrder.company_id && (
                  <>
                    <Button
                      onClick={() => handleResendToSameCompany(selectedOrder)}
                      variant="outline"
                      className="w-full justify-start h-auto py-4"
                    >
                      <div className="flex flex-col items-start gap-1 text-left">
                        <div className="flex items-center gap-2 font-medium">
                          <Building2 className="h-4 w-4" />
                          Resend to Same Company
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {selectedOrder.companies?.name ? `Send again to ${selectedOrder.companies.name}` : 'Send again to the same company'}
                        </span>
                      </div>
                    </Button>

                    <Button
                      onClick={() => handleResendToSameSpecialists(selectedOrder)}
                      variant="outline"
                      className="w-full justify-start h-auto py-4"
                    >
                      <div className="flex flex-col items-start gap-1 text-left">
                        <div className="flex items-center gap-2 font-medium">
                          <User className="h-4 w-4" />
                          Resend to Same Specialists
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Send again to the same specialists in the company
                        </span>
                      </div>
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Send to Company Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Order to Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company">Select Company *</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
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

            {selectedCompanyId && specialists.length > 0 && (
              <div className="space-y-3">
                <Label>Select Specialists (Optional)</Label>
                <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto space-y-3">
                  {specialists.map((specialist) => (
                    <label
                      key={specialist.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSpecialistIds.includes(specialist.id)}
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
                {selectedSpecialistIds.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {selectedSpecialistIds.length} specialist(s) selected
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Leave empty to send to all specialists in this company
                </p>
              </div>
            )}

            {selectedCompanyId && specialists.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No specialists available for this company
              </p>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSendToCompany}
                disabled={!selectedCompanyId}
                className="flex-1"
              >
                Send Order
              </Button>
              <Button
                variant="outline"
                onClick={() => setSendDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
