/* TGD WMS - Delete all deposit and withdrawal data */
TRUNCATE TABLE tgd_customer_deposit_requests CASCADE;
TRUNCATE TABLE tgd_customer_deposit_request_lines CASCADE;
TRUNCATE TABLE tgd_customer_withdrawal_requests CASCADE;
TRUNCATE TABLE tgd_customer_withdrawal_request_lines CASCADE;
