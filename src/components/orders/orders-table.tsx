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

interface Company {
  id: string;
  name: string;
}

interface Specialist {
  id: string;
  name: string;
  specialty: string | null;
}

interface OrdersTableProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: string) => void;
  onLinkCopied: (orderId: string) => void;
}

export function OrdersTable({ orders, onUpdateStatus, onLinkCopied }: OrdersTableProps) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>('all');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string>('');

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
        .select("id, name, specialty")
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
      setSelectedSpecialistId('');
    }
  }, [selectedCompanyId]);

  const handleSendToAll = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          send_to_all_companies: true,
          company_id: null,
          specialist_id: null,
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Order sent to all companies",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSendToCompany = async () => {
    if (!selectedOrder || !selectedCompanyId) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          send_to_all_companies: false,
          company_id: selectedCompanyId,
          specialist_id: selectedSpecialistId || null,
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      let description = "Order sent to company";
      if (selectedSpecialistId) {
        description = "Order sent to selected specialist";
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
      setSelectedSpecialistId('');
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
    setSelectedSpecialistId('');
    fetchCompanies();
    setSendDialogOpen(true);
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
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          {/* Show actions only for new requests (pending + not sent yet) */}
                          {order.status === 'pending' && !order.company_id && !order.send_to_all_companies && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleSendToAll(order.id)}
                                className="flex items-center gap-1"
                              >
                                <Send className="h-3 w-3" />
                                Send to All
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openSendDialog(order)}
                                className="flex items-center gap-1"
                              >
                                <Building2 className="h-3 w-3" />
                                Send to Company
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
              <div className="space-y-2">
                <Label htmlFor="specialist">Select Specialist (Optional)</Label>
                <Select value={selectedSpecialistId} onValueChange={setSelectedSpecialistId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Send to all company specialists" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        All Specialists ({specialists.length})
                      </div>
                    </SelectItem>
                    {specialists.map((specialist) => (
                      <SelectItem key={specialist.id} value={specialist.id}>
                        {specialist.name} {specialist.specialty && `- ${specialist.specialty}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
