-- AND -> every condition must be true
-- OR -> atleast one condition must be true
-- NOT reverse/exlcude a condition

-- products where it is electronics but price > 1000

SELECT name, category, price
FROM products
WHERE category = 'Electronics'
    AND price > 1000;