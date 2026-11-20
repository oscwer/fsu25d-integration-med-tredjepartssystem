
-- Kunder som loggar in med Google
CREATE TABLE customers (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Koppla ordrar till inloggade kunder
ALTER TABLE orders
ADD COLUMN customer_id INTEGER
REFERENCES customers(id);

-- Snabbare hämtning av en kunds ordrar
CREATE INDEX idx_orders_customer_id
ON orders(customer_id);
