-- like - case sensitive pattern match
-- ilik - ase insensitive pattern match
-- % means any of chars 
-- exactly one char

-- the % after wireless means anything can come after it
SELECT name, price
FROM products
WHERE name LIKE 'Wireless%';


SELECT name, category, price
FROM products
WHERE name ILIKE '%wireless%';