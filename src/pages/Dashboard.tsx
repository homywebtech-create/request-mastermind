import { useState } from "react";
import { OrderForm } from "@/components/orders/order-form";
import { OrdersTable } from "@/components/orders/orders-table";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { mockOrders, mockStats } from "@/data/mockData";
import { Order } from "@/types/order";
import { Plus, Package, Clock, CheckCircle, Users } from "lucide-react";

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stats, setStats] = useState(mockStats);

  const handleCreateOrder = (formData: any) => {
    const newOrder: Order = {
      id: Date.now().toString(),
      customerId: Date.now().toString(),
      customer: {
        id: Date.now().toString(),
        name: formData.customerName,
        whatsappNumber: formData.whatsappNumber,
        createdAt: new Date(),
      },
      serviceType: formData.serviceType,
      status: 'pending',
      notes: formData.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setOrders(prev => [newOrder, ...prev]);
    setStats(prev => ({
      ...prev,
      total: prev.total + 1,
      pending: prev.pending + 1,
    }));
    setIsFormOpen(false);
  };

  const handleUpdateStatus = (orderId: string, newStatus: Order['status']) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        return { ...order, status: newStatus, updatedAt: new Date() };
      }
      return order;
    }));

    // Update stats
    const updatedOrders = orders.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    );
    
    setStats({
      total: updatedOrders.length,
      pending: updatedOrders.filter(o => o.status === 'pending').length,
      inProgress: updatedOrders.filter(o => o.status === 'in-progress').length,
      completed: updatedOrders.filter(o => o.status === 'completed').length,
      cancelled: updatedOrders.filter(o => o.status === 'cancelled').length,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground font-cairo">
                لوحة إدارة الطلبات
              </h1>
              <p className="text-muted-foreground mt-1">
                إدارة شاملة لطلبات العملاء والخدمات
              </p>
            </div>
            
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  طلب جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <OrderForm 
                  onSubmit={handleCreateOrder}
                  onCancel={() => setIsFormOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="إجمالي الطلبات"
            value={stats.total}
            icon={<Package className="h-4 w-4" />}
          />
          <StatsCard
            title="قيد الانتظار"
            value={stats.pending}
            icon={<Clock className="h-4 w-4" />}
            variant="pending"
          />
          <StatsCard
            title="قيد التنفيذ"
            value={stats.inProgress}
            icon={<Users className="h-4 w-4" />}
            variant="warning"
          />
          <StatsCard
            title="مكتملة"
            value={stats.completed}
            icon={<CheckCircle className="h-4 w-4" />}
            variant="success"
          />
        </div>

        {/* Orders Table */}
        <OrdersTable 
          orders={orders}
          onUpdateStatus={handleUpdateStatus}
        />
      </main>
    </div>
  );
}