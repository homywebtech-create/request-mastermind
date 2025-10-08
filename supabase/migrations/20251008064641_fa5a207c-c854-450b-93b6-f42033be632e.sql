-- Add rating column to specialists table
ALTER TABLE public.specialists
ADD COLUMN IF NOT EXISTS rating numeric(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;

-- Create specialist_reviews table for customer reviews
CREATE TABLE IF NOT EXISTS public.specialist_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  specialist_id uuid NOT NULL REFERENCES public.specialists(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on specialist_reviews
ALTER TABLE public.specialist_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for specialist_reviews
CREATE POLICY "Everyone can view reviews"
ON public.specialist_reviews
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert reviews"
ON public.specialist_reviews
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own reviews"
ON public.specialist_reviews
FOR UPDATE
USING (true);

-- Create function to update specialist rating
CREATE OR REPLACE FUNCTION public.update_specialist_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.specialists
  SET 
    rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM public.specialist_reviews
      WHERE specialist_id = NEW.specialist_id
    ),
    reviews_count = (
      SELECT COUNT(*)
      FROM public.specialist_reviews
      WHERE specialist_id = NEW.specialist_id
    )
  WHERE id = NEW.specialist_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update rating on new review
DROP TRIGGER IF EXISTS update_rating_on_review ON public.specialist_reviews;
CREATE TRIGGER update_rating_on_review
AFTER INSERT OR UPDATE ON public.specialist_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_specialist_rating();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_specialist_reviews_specialist_id ON public.specialist_reviews(specialist_id);
CREATE INDEX IF NOT EXISTS idx_specialist_reviews_order_id ON public.specialist_reviews(order_id);