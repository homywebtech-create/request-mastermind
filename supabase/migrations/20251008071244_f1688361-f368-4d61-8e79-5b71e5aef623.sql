-- Clean all test data from the system

-- First, delete all order specialists (linked to orders)
DELETE FROM public.order_specialists;

-- Delete all specialist reviews
DELETE FROM public.specialist_reviews;

-- Delete all orders
DELETE FROM public.orders;

-- Delete all customers
DELETE FROM public.customers;