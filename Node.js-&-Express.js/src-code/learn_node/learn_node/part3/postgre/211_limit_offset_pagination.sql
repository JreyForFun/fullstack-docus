-- limit -> how many rows you want to return
-- offset -> how many rows you want to skip

SELECT name, price
FROM products
ORDER BY name ASC
LIMIT 5;

SELECT name, price
FROM products
ORDER BY name ASC
LIMIT 5 OFFSET 0;

SELECT name, price
FROM products
ORDER BY name ASC
LIMIT 5 OFFSET 1;