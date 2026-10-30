-- Lagersaldo för produkter
ALTER TABLE products
ADD COLUMN stock INTEGER NOT NULL DEFAULT 20
CHECK (stock >= 0);

-- Betalningsstatus för ordrar
ALTER TABLE orders
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
CHECK (status IN ('pending', 'paid', 'cancelled'));

-- Stripe Checkout-sessionens ID
ALTER TABLE orders
ADD COLUMN stripe_session_id TEXT UNIQUE;

-- Tidpunkter för betalning och avbrytning
ALTER TABLE orders
ADD COLUMN paid_at TIMESTAMPTZ,
ADD COLUMN cancelled_at TIMESTAMPTZ;