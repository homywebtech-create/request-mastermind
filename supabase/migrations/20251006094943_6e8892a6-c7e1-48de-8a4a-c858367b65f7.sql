-- Update English names for the existing service and sub-services
UPDATE public.services 
SET name_en = 'General Cleaning Service' 
WHERE name = 'خدمة النظافة العامة';

-- Update sub-services English names
UPDATE public.sub_services 
SET name_en = 'Hourly Cleaning Service' 
WHERE name = 'خدمة نظافة الساعات';

UPDATE public.sub_services 
SET name_en = 'Monthly Cleaning Contracts' 
WHERE name = 'عقود شهرية نظافة';

UPDATE public.sub_services 
SET name_en = 'Monthly Cooking Contracts' 
WHERE name = 'عقود شهرية طبخ';

UPDATE public.sub_services 
SET name_en = 'Monthly Babysitting Contracts' 
WHERE name = 'عقود شهرية جليسات اطفال';