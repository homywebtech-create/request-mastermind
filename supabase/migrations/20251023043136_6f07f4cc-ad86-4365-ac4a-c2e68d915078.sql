-- Add preferred_language column to specialists table
ALTER TABLE specialists 
ADD COLUMN preferred_language text DEFAULT 'ar' CHECK (preferred_language IN (
  'ar',      -- Arabic
  'en',      -- English
  'tl',      -- Tagalog (Philippines)
  'hi',      -- Hindi (India)
  'si',      -- Sinhala (Sri Lanka)
  'bn',      -- Bengali (Bangladesh)
  'sw',      -- Swahili (Kenya, Uganda, Tanzania)
  'am',      -- Amharic (Ethiopia)
  'ti',      -- Tigrinya (Eritrea)
  'fa'       -- Farsi/Persian
));

-- Add comment to explain the column
COMMENT ON COLUMN specialists.preferred_language IS 'Preferred language for receiving order notifications and viewing order details';