import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerHistory {
  customer: {
    id: string;
    name: string;
    whatsapp_number: string;
    area: string | null;
    preferred_language: string;
  } | null;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageRating: number | null;
  recentLocations: Array<{
    address: string;
    name: string;
    count: number;
  }>;
  recentOrders: Array<{
    id: string;
    order_number: string;
    service_type: string;
    status: string;
    booking_date: string | null;
    customer_rating: number | null;
    customer_review_notes: string | null;
    created_at: string;
  }>;
  specialistReviews: Array<{
    order_id: string;
    service_type: string;
    rating: number | null;
    review: string | null;
    booking_date: string | null;
  }>;
}

export const useCustomerHistory = (whatsappNumber: string) => {
  return useQuery({
    queryKey: ['customer-history', whatsappNumber],
    queryFn: async (): Promise<CustomerHistory> => {
      if (!whatsappNumber || whatsappNumber.length < 10) {
        return {
          customer: null,
          totalOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          averageRating: null,
          recentLocations: [],
          recentOrders: [],
          specialistReviews: [],
        };
      }

      // Fetch customer info
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, name, whatsapp_number, area, preferred_language')
        .eq('whatsapp_number', whatsappNumber)
        .single();

      if (customerError || !customer) {
        return {
          customer: null,
          totalOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          averageRating: null,
          recentLocations: [],
          recentOrders: [],
          specialistReviews: [],
        };
      }

      // Fetch all orders for this customer
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          service_type,
          status,
          booking_date,
          customer_rating,
          customer_review_notes,
          customer_location_address,
          customer_location_name,
          created_at
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
      }

      const allOrders = orders || [];
      const totalOrders = allOrders.length;
      const completedOrders = allOrders.filter(o => o.status === 'completed').length;
      const cancelledOrders = allOrders.filter(o => o.status === 'cancelled').length;

      // Calculate average rating
      const ratingsArray = allOrders
        .filter(o => o.customer_rating !== null)
        .map(o => o.customer_rating as number);
      const averageRating = ratingsArray.length > 0
        ? ratingsArray.reduce((sum, rating) => sum + rating, 0) / ratingsArray.length
        : null;

      // Get unique locations with count
      const locationMap = new Map<string, { address: string; name: string; count: number }>();
      allOrders.forEach(order => {
        if (order.customer_location_address) {
          const key = order.customer_location_address;
          const existing = locationMap.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            locationMap.set(key, {
              address: order.customer_location_address,
              name: order.customer_location_name || '',
              count: 1,
            });
          }
        }
      });

      const recentLocations = Array.from(locationMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Get recent orders with reviews
      const recentOrders = allOrders.slice(0, 10);

      // Extract specialist reviews (customer ratings and reviews)
      const specialistReviews = allOrders
        .filter(o => o.customer_rating !== null || o.customer_review_notes !== null)
        .map(o => ({
          order_id: o.id,
          service_type: o.service_type,
          rating: o.customer_rating,
          review: o.customer_review_notes,
          booking_date: o.booking_date,
        }))
        .slice(0, 10);

      return {
        customer,
        totalOrders,
        completedOrders,
        cancelledOrders,
        averageRating,
        recentLocations,
        recentOrders,
        specialistReviews,
      };
    },
    enabled: !!whatsappNumber && whatsappNumber.length >= 10,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
