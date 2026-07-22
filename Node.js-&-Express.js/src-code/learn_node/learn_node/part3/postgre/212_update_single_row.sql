
SELECT sku
FROM products;

SELECT name, price, stock, sku
FROM products
WHERE sku = 'SKU-LAP-001';

UPDATE products
SET price = 70000.99,
    stock = 15
WHERE sku = 'SKU-LAP-001';

SELECT name, price, stock, sku
FROM products
WHERE sku = 'SKU-LAP-001';