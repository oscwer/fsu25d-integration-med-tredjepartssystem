create table orders (
  id integer generated always as identity primary key,
  customer_name text not null,
  customer_email text not null,
  created_at timestamptz not null default now()
);

create table order_items (
  id integer generated always as identity primary key,
  order_id integer not null references orders(id),
  product_id integer references products(id),
  product_name text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0)
);