ALTER TABLE orders
ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;
