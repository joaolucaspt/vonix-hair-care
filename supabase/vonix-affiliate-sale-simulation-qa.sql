-- Synthetic disposable PostgreSQL QA. Never run against a production database.
begin;
set local role service_role;
do $qa$
declare
 r jsonb;
 summary jsonb;
begin
 r:=public.vonix_affiliate_sandbox_record('event-001','SANDBOX01','marina','pendente',19990);
 if r->>'ok' <> 'true' or r->>'duplicate'<>'false' then raise exception 'Initial event not accepted: %',r; end if;
 r:=public.vonix_affiliate_sandbox_record('event-001','SANDBOX01','marina','pendente',19990);
 if r->>'duplicate'<>'true' then raise exception 'Replay not idempotent: %',r; end if;

 r:=public.vonix_affiliate_sandbox_record('event-001','ORPHAN','outra','pendente',30000);
 if r->>'ok'<>'false' then raise exception 'Conflicting event accepted'; end if;
 if exists(select 1 from public.vonix_affiliate_sandbox_orders where source_order_id='ORPHAN')
   then raise exception 'Orphan created on conflicting event ID'; end if;
 r:=public.vonix_affiliate_sandbox_record('event-002','MISSING','marina','pago',19990);
 if r->>'reason'<>'unknown_order' then raise exception 'Missing initial order accepted'; end if;

 r:=public.vonix_affiliate_sandbox_record('event-003','SANDBOX01','outra','pago',19990);
 if r->>'reason'<>'attribution_mismatch' then raise exception 'Affiliate switch accepted'; end if;
 r:=public.vonix_affiliate_sandbox_record('event-004','SANDBOX01','marina','pago',1);
 if r->>'reason'<>'attribution_mismatch' then raise exception 'Amount change accepted'; end if;

 r:=public.vonix_affiliate_sandbox_record('event-005','SANDBOX01','marina','pago',null);
 if r->>'status'<>'pago' then raise exception 'Paid transition failed'; end if;
 r:=public.vonix_affiliate_sandbox_record('event-006','SANDBOX01','marina','pago',null);
 if r->>'duplicate'<>'true' then raise exception 'Duplicate paid state counted'; end if;
 r:=public.vonix_affiliate_sandbox_record('event-007','SANDBOX01','marina','estornado',null);
 if r->>'status'<>'estornado' then raise exception 'Refund transition failed'; end if;
 r:=public.vonix_affiliate_sandbox_record('event-008','SANDBOX01','marina','pago',null);
 if r->>'reason'<>'invalid_transition' then raise exception 'Refund-to-paid accepted'; end if;

 r:=public.vonix_affiliate_sandbox_record('event-009','SANDBOX02','ana','pendente',50000);
 r:=public.vonix_affiliate_sandbox_record('event-010','SANDBOX02','ana','pago',null);
 summary:=public.vonix_affiliate_sandbox_report();
 if summary->>'paid'<>'1' or summary->>'reversed'<>'1' or
    summary->>'paid_gross_cents'<>'50000' or summary->>'simulated_only'<>'true' then
   raise exception 'Reconciliation report incorrect: %',summary;
 end if;
 if (select count(*) from public.vonix_affiliate_sandbox_events)<>5 then
   raise exception 'Expected exactly five accepted transition events';
 end if;
 raise notice 'SANDBOX LEDGER PASS: replay, attribution, amounts, paid, refund and report';
end;
$qa$;
reset role;
do $qa$
begin
 if has_table_privilege('anon','public.vonix_affiliate_sandbox_orders','SELECT') or
    has_table_privilege('authenticated','public.vonix_affiliate_sandbox_events','INSERT') or
    has_function_privilege('anon','public.vonix_affiliate_sandbox_record(text,text,text,text,bigint)','EXECUTE') or
    has_function_privilege('authenticated','public.vonix_affiliate_sandbox_report()','EXECUTE') then
    raise exception 'Public permissions on simulated ledger';
 end if;
 if not exists (
 select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname='vonix_affiliate_sandbox_orders'
   and c.relrowsecurity
 ) then raise exception 'RLS missing'; end if;
 raise notice 'SANDBOX LEDGER PASS: RLS and service-only RPC grants';
end;
$qa$;
rollback;
