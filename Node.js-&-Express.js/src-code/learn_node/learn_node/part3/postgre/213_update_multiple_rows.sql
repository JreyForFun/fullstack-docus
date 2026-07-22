
SELECT stock
FROM products
WHERE stock < 20;

SELECT name, price, stock, sku
FROM products
WHERE stock < 20;

UPDATE products
SET stock = 100
WHERE stock < 20;

SELECT *
FROM products
WHERE stock = 100;


-- UPDATE products
-- SET price = 70000.99,
--     stock = 15
-- WHERE sku = 'SKU-LAP-001';

-- SELECT name, price, stock, sku
-- FROM products
-- WHERE sku = 'SKU-LAP-001';