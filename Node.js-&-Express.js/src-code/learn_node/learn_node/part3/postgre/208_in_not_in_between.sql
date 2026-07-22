-- IN -> value must match one item from the list
-- NOT IN -> value must not match any time from the list
-- BETWWEN -> value must be inside a range


SELECT name, category, price
FROM products
WHERE category IN ('Accessories', 'furniture');

SELECT name, category
FROM products
WHERE category NOT IN ('Accessories', 'Electronics');

SELECT name, price
FROM products
WHERE price BETWEEN 2000 AND 5000;