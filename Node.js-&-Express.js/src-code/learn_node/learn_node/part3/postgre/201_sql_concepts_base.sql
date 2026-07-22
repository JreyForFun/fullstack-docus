CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS products;

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,

    category TEXT NOT NULL,

    price NUMERIC(10,2) NOT NULL CHECK (price>=0),

    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0 ),

    is_active BOOLEAN NOT NULL DEFAULT true,

    sku TEXT UNIQUE,

    description TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO products (name, category, price, stock, is_active, sku, description)
VALUES
    ('Laptop Pro 15', 'Electronics', 59999.99, 25, true, 'SKU-LAP-001', 'High-performance laptop with 15-inch display'),
    ('Wireless Mouse', 'Accessories', 799.50, 150, true, 'SKU-MOU-002', 'Ergonomic wireless mouse with long battery life'),
    ('Gaming Keyboard', 'Accessories', 2499.00, 75, true, 'SKU-KEY-003', 'Mechanical keyboard with RGB lighting'),
    ('Smartphone X', 'Electronics', 45999.00, 40, true, 'SKU-PHN-004', 'Latest smartphone with OLED display'),
    ('Noise Cancelling Headphones', 'Audio', 8999.99, 60, true, 'SKU-HDP-005', 'Over-ear headphones with active noise cancellation'),
    ('Office Chair Deluxe', 'Furniture', 5499.00, 20, true, 'SKU-CHR-006', 'Comfortable ergonomic office chair'),
    ('Coffee Maker 12-Cup', 'Appliances', 3499.00, 35, true, 'SKU-CFM-007', 'Programmable coffee maker with 12-cup capacity');

SELECT * FROM products;
