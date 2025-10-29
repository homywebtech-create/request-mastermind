-- Delete all order-related data to start fresh testing
-- First delete order_specialists (child table)
DELETE FROM order_specialists;

-- Then delete orders (parent table)
DELETE FROM orders;

-- Reset the order number sequence if needed
-- This ensures next order starts from ORD-0001 again