ALTER TABLE orders
ADD COLUMN IF NOT EXISTS confirmation_email_claimed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION claim_order_confirmation(
  p_order_id INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_claimed_id INTEGER;
BEGIN
  UPDATE orders
  SET confirmation_email_claimed_at = NOW()
  WHERE id = p_order_id
    AND status = 'paid'
    AND confirmation_email_sent_at IS NULL
    AND (
      confirmation_email_claimed_at IS NULL
      OR confirmation_email_claimed_at < NOW() - INTERVAL '10 minutes'
    )
  RETURNING id INTO v_claimed_id;

  RETURN v_claimed_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION claim_order_confirmation(INTEGER)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION claim_order_confirmation(INTEGER)
TO service_role;
