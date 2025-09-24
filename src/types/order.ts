export interface Customer {
  id: string;
  name: string;
  whatsappNumber: string;
  createdAt: Date;
}

export interface Order {
  id: string;
  customerId: string;
  customer: Customer;
  serviceType: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}