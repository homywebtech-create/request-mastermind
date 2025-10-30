-- First, drop the trigger
DROP TRIGGER IF EXISTS validate_hours_count_trigger ON orders;

-- Drop the validation function if it exists
DROP FUNCTION IF EXISTS validate_hours_count();

-- Change hours_count column type from text to numeric
ALTER TABLE orders 
ALTER COLUMN hours_count TYPE numeric USING CASE 
  WHEN hours_count IS NULL OR hours_count = '' THEN NULL
  ELSE hours_count::numeric 
END;

-- Recreate validation function for hours_count (if numeric validation is needed)
CREATE OR REPLACE FUNCTION validate_hours_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.hours_count IS NOT NULL AND NEW.hours_count <= 0 THEN
    RAISE EXCEPTION 'hours_count must be a positive number';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER validate_hours_count_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_hours_count();