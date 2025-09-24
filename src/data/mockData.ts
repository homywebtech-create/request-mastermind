import { Order, Customer, OrderStats } from '../types/order';

export const mockCustomers: Customer[] = [
  {
    id: '1',
    name: 'أحمد محمد',
    whatsappNumber: '+966501234567',
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'فاطمة العلي',
    whatsappNumber: '+966502345678',
    createdAt: new Date('2024-01-16'),
  },
  {
    id: '3',
    name: 'محمد الأحمد',
    whatsappNumber: '+966503456789',
    createdAt: new Date('2024-01-17'),
  },
  {
    id: '4',
    name: 'نورا سالم',
    whatsappNumber: '+966504567890',
    createdAt: new Date('2024-01-18'),
  },
];

export const serviceTypes = [
  'خدمة التوصيل',
  'خدمة الصيانة',
  'استشارة فنية',
  'تركيب المنتجات',
  'خدمة العملاء',
  'خدمة التنظيف',
];

export const mockOrders: Order[] = [
  {
    id: '1',
    customerId: '1',
    customer: mockCustomers[0],
    serviceType: 'خدمة التوصيل',
    status: 'pending',
    notes: 'يحتاج التوصيل في نفس اليوم',
    createdAt: new Date('2024-01-20T10:30:00'),
    updatedAt: new Date('2024-01-20T10:30:00'),
  },
  {
    id: '2',
    customerId: '2',
    customer: mockCustomers[1],
    serviceType: 'خدمة الصيانة',
    status: 'in-progress',
    notes: 'مشكلة في التكييف',
    createdAt: new Date('2024-01-20T09:15:00'),
    updatedAt: new Date('2024-01-20T11:00:00'),
  },
  {
    id: '3',
    customerId: '3',
    customer: mockCustomers[2],
    serviceType: 'استشارة فنية',
    status: 'completed',
    notes: 'تم الرد على جميع الاستفسارات',
    createdAt: new Date('2024-01-19T14:20:00'),
    updatedAt: new Date('2024-01-19T16:45:00'),
  },
  {
    id: '4',
    customerId: '4',
    customer: mockCustomers[3],
    serviceType: 'تركيب المنتجات',
    status: 'pending',
    notes: 'تركيب جهاز جديد',
    createdAt: new Date('2024-01-20T08:00:00'),
    updatedAt: new Date('2024-01-20T08:00:00'),
  },
  {
    id: '5',
    customerId: '1',
    customer: mockCustomers[0],
    serviceType: 'خدمة العملاء',
    status: 'completed',
    notes: 'تم حل المشكلة بنجاح',
    createdAt: new Date('2024-01-18T13:30:00'),
    updatedAt: new Date('2024-01-18T15:00:00'),
  },
];

export const mockStats: OrderStats = {
  total: mockOrders.length,
  pending: mockOrders.filter(order => order.status === 'pending').length,
  inProgress: mockOrders.filter(order => order.status === 'in-progress').length,
  completed: mockOrders.filter(order => order.status === 'completed').length,
  cancelled: mockOrders.filter(order => order.status === 'cancelled').length,
};