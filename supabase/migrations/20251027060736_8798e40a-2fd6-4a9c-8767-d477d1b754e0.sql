-- Delete all order specialists first
DELETE FROM order_specialists;

-- Delete all orders
DELETE FROM orders;

-- Reset sequences if needed
SELECT setval(pg_get_serial_sequence('orders', 'id'), 1, false);