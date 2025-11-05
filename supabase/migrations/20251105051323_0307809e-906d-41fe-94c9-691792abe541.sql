-- Add preferred_language column to specialists table
ALTER TABLE specialists 
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'ar' CHECK (preferred_language IN ('ar', 'en'));

-- Add comment
COMMENT ON COLUMN specialists.preferred_language IS 'Preferred language for the specialist (ar or en). Defaults to device language or Arabic.';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_specialists_preferred_language ON specialists(preferred_language);