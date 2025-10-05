// OrdersTable Component - Version: 2025-01-05-08:46
// All null checks implemented with optional chaining
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
    area?: string;
    budget?: string;
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
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Orders List
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Customer</TableHead>
                <TableHead className="text-left">Area</TableHead>
                <TableHead className="text-left">Customer Budget</TableHead>
                <TableHead className="text-left">Service</TableHead>
                <TableHead className="text-left">Recommendations</TableHead>
                <TableHead className="text-left">Date</TableHead>
                <TableHead className="text-left">Status</TableHead>
                <TableHead className="text-left">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No orders available
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const customerName = order.customers?.name || 'غير متوفر';
                  const customerPhone = order.customers?.whatsapp_number || 'غير متوفر';
                  const customerArea = order.customers?.area || '-';
                  const customerBudget = order.customers?.budget || '-';
                  
                  return (
                    <TableRow key={order.id}>
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
                        <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                          <Calendar className="h-3 w-3" />
                          {formatDate(order.created_at)}
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={order.status} />
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
                                    {order.order_link && (
                                      <div className="pt-2">
                                        <span className="text-muted-foreground block mb-1">Order Link:</span>
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

                                <div className="flex gap-2 pt-4 border-t">
                                  {order.customers?.whatsapp_number && (
                                    <>
                                      <Button
                                        onClick={() => openWhatsApp(order.customers.whatsapp_number)}
                                        className="flex-1"
                                        variant="outline"
                                      >
                                        <Phone className="h-4 w-4 ml-2" />
                                        Contact via WhatsApp
                                      </Button>
                                      {order.status === 'pending' && (
                                        <Button
                                          onClick={() => sendOrderLinkViaWhatsApp(order)}
                                          className="flex-1 bg-green-600 hover:bg-green-700"
                                        >
                                          <Phone className="h-4 w-4 ml-2" />
                                          Send Order Link
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
                                Send Link
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopyOrderLink(order)}
                                className="flex items-center gap-1"
                              >
                                <Copy className="h-3 w-3" />
                                Copy
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
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onUpdateStatus(order.id, 'cancelled')}
                                className="flex items-center gap-1 text-red-600 border-red-600 hover:bg-red-50"
                              >
                                <X className="h-3 w-3" />
                                Cancel
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
                              WhatsApp
                            </Button>
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
    </Card>
  );
}
