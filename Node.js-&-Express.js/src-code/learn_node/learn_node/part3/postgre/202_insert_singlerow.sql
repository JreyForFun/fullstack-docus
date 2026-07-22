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
    );

SELECT * FROM products WHERE price >= 2000;