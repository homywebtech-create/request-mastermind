-- Add birth_date column to specialists table for birthday promotions
ALTER TABLE specialists 
ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN specialists.birth_date IS 'Specialist birth date for birthday promotions and offers';