CREATE OR REPLACE FUNCTION finalize_stripe_payment(
  p_order_id INTEGER,
  p_session_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_item RECORD;
BEGIN
  -- Lås ordern så att parallella webhook-anrop
  -- inte kan behandla samma betalning samtidigt.
  SELECT *
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Kontrollera att Stripe-sessionen tillhör ordern.
  IF v_order.stripe_session_id IS DISTINCT FROM p_session_id THEN
    RAISE EXCEPTION 'Stripe session mismatch';
  END IF;

  -- Samma betalning får inte minska lagret två gånger.
  IF v_order.status = 'paid' THEN
    RETURN 'already_paid';
  END IF;

  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Order is not pending';
  END IF;

  -- Minska lagret för varje produkt.
  FOR v_item IN
    SELECT product_id, SUM(quantity)::INTEGER AS quantity
    FROM order_items
    WHERE order_id = p_order_id
    GROUP BY product_id
    ORDER BY product_id
  LOOP
    UPDATE products
    SET stock = stock - v_item.quantity
    WHERE id = v_item.product_id
      AND is_active = TRUE
      AND stock >= v_item.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Insufficient stock for product %',
        v_item.product_id;
    END IF;
  END LOOP;

  -- Markera ordern som betald först när alla
  -- lageruppdateringar lyckats.
  UPDATE orders
  SET status = 'paid',
      paid_at = NOW()
  WHERE id = p_order_id;

  RETURN 'paid';
END;
$$;

REVOKE ALL ON FUNCTION finalize_stripe_payment(INTEGER, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION finalize_stripe_payment(INTEGER, TEXT)
TO service_role;