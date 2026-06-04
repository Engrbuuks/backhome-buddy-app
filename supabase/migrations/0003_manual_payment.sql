-- 0003: allow recording offline/bank-transfer payments (run AFTER 0002)
alter type payment_provider add value if not exists 'manual';
