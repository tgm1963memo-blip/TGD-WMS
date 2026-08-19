-- This script removes the fixed check constraint on service types so you can enter custom service names
ALTER TABLE tgd_customer_product_service_rates 
DROP CONSTRAINT IF EXISTS tgd_product_service_rates_type_check;
