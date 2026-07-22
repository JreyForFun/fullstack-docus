

-- select * - return every cols
-- select specific cols is goingto return the cols that i want

-- SELECT * FROM products;
SELECT name, category FROM products;
SELECT sku FROM products;

-- AS creates an alias for the output of that column name
-- makes the col name easier to read
SELECT
    name AS product_name,
    price AS selling_price,
    stock AS availabale
FROM products;