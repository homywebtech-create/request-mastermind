-- Add device information columns to device_tokens table
ALTER TABLE device_tokens 
ADD COLUMN device_model text,
ADD COLUMN device_os text,
ADD COLUMN device_os_version text,
ADD COLUMN app_version text;