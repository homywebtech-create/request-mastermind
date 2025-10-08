-- Add customer rating columns to orders table
ALTER TABLE public.orders 
ADD COLUMN customer_rating INTEGER,
ADD COLUMN customer_review_notes TEXT;

-- Add check constraint to ensure rating is between 1 and 5
ALTER TABLE public.orders 
ADD CONSTRAINT customer_rating_range 
CHECK (customer_rating IS NULL OR (customer_rating >= 1 AND customer_rating <= 5));

-- Add comment to describe the columns
COMMENT ON COLUMN public.orders.customer_rating IS 'Rating given by specialist for the customer (1-5 stars)';
COMMENT ON COLUMN public.orders.customer_review_notes IS 'Review notes from specialist about the customer';