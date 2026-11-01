ALTER TABLE orders
ADD COLUMN delivery_method TEXT
  CHECK (delivery_method IN ('service_point', 'home_delivery')),
ADD COLUMN delivery_postal_code TEXT,
ADD COLUMN service_point_id TEXT,
ADD COLUMN service_point_name TEXT,
ADD COLUMN shipping_cost NUMERIC(10, 2)
  CHECK (shipping_cost >= 0);
  