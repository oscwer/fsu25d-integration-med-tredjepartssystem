create table products (
  id integer generated always as identity primary key,
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0)
);