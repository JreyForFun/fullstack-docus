-- null - missing / unknown value
-- u, should not check null using = null
-- IS NULL
-- IS NOT NULL

SELECT name, category, description
FROM products
WHERE description IS NOT NULL;

SELECT name, category, description
FROM products
WHERE description IS NULL;

