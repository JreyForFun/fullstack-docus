INSERT INTO products (
    name,
    category,
    price,
    stock,
    sku,
    description
)
VALUES
    (
        'Gaming Keyboard',
        'Accessories',
        2499.00,
        75,
        'SKU-KEY-003',
        'Mechanical keyboard with RGB lighting'
    ),
    (
        'Noise Cancelling Headphones',
        'Audio',
        8999.99,
        60,
        'SKU-HDP-005',
        'Over-ear headphones with active noise cancellation'
    );

SELECT * FROM products WHERE price >= 2000;