-- cleanup_test_data.sql
-- Wipe all test data. Keeps ONLY thitiwat.tan@tgm.co.th account.
-- Warehouse / zone / room / location rows are preserved (config, not test data).
-- Uses session_replication_role=replica to bypass FK constraints safely in one pass.

begin;

-- Disable FK triggers for this session so we can delete in any order.
set session_replication_role = replica;

-- ── Audit logs ─────────────────────────────────────────────────────────────────
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_audit_logs') then delete from public.tgd_audit_logs; end if; end $$;

-- ── Stock ──────────────────────────────────────────────────────────────────────
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_stock_balances')  then delete from public.tgd_stock_balances;  end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_stock_movements') then delete from public.tgd_stock_movements; end if; end $$;

-- ── Operations ─────────────────────────────────────────────────────────────────
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_receiving_lines')              then delete from public.tgd_receiving_lines;              end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_receiving_documents')          then delete from public.tgd_receiving_documents;          end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_putaway_lines')                then delete from public.tgd_putaway_lines;                end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_putaway_documents')            then delete from public.tgd_putaway_documents;            end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_outbound_reservations')        then delete from public.tgd_outbound_reservations;        end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_outbound_lines')               then delete from public.tgd_outbound_lines;               end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_outbound_documents')           then delete from public.tgd_outbound_documents;           end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_picking_lines')                then delete from public.tgd_picking_lines;                end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_picking_documents')            then delete from public.tgd_picking_documents;            end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_dispatch_lines')               then delete from public.tgd_dispatch_lines;               end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_dispatch_documents')           then delete from public.tgd_dispatch_documents;           end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_transfer_lines')               then delete from public.tgd_transfer_lines;               end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_transfer_documents')           then delete from public.tgd_transfer_documents;           end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_adjustment_lines')             then delete from public.tgd_adjustment_lines;             end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_adjustment_documents')         then delete from public.tgd_adjustment_documents;         end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_stock_count_lines')            then delete from public.tgd_stock_count_lines;            end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_stock_count_sessions')         then delete from public.tgd_stock_count_sessions;         end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_lots')                         then delete from public.tgd_lots;                         end if; end $$;

-- ── Billing ────────────────────────────────────────────────────────────────────
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_billing_invoice_draft_lines') then delete from public.tgd_billing_invoice_draft_lines; end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_billing_invoice_drafts')      then delete from public.tgd_billing_invoice_drafts;      end if; end $$;

-- ── Customer portal ────────────────────────────────────────────────────────────
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_customer_deposit_request_lines')     then delete from public.tgd_customer_deposit_request_lines;     end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_customer_withdrawal_request_lines')   then delete from public.tgd_customer_withdrawal_request_lines;  end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_customer_document_attachments')       then delete from public.tgd_customer_document_attachments;      end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_customer_document_timeline_events')   then delete from public.tgd_customer_document_timeline_events;  end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_customer_deposit_receiving_links')    then delete from public.tgd_customer_deposit_receiving_links;   end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_customer_withdrawal_execution_links') then delete from public.tgd_customer_withdrawal_execution_links; end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_customer_facility_usage_requests')    then delete from public.tgd_customer_facility_usage_requests;   end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_customer_request_email_queue')        then delete from public.tgd_customer_request_email_queue;       end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_customer_deposit_requests')           then delete from public.tgd_customer_deposit_requests;          end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_customer_withdrawal_requests')        then delete from public.tgd_customer_withdrawal_requests;       end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_customer_products')                   then delete from public.tgd_customer_products;                  end if; end $$;
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tgd_customer_storage_rate_rules')         then delete from public.tgd_customer_storage_rate_rules;        end if; end $$;

-- ── Master data ────────────────────────────────────────────────────────────────
delete from public.tgd_customers where true;
delete from public.tgd_products  where true;

-- ── User profiles — keep thitiwat only ────────────────────────────────────────
delete from public.tgd_user_profiles where email <> 'thitiwat.tan@tgm.co.th';
update public.tgd_user_profiles set customer_id = null where email = 'thitiwat.tan@tgm.co.th';

-- ── Auth users — keep thitiwat only ───────────────────────────────────────────
delete from auth.users where email <> 'thitiwat.tan@tgm.co.th';

-- Re-enable FK triggers.
set session_replication_role = default;

commit;
