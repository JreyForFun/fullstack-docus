DROP TABLE IF EXISTS basics.sales;

CREATE TABLE basics.sales (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO basics.sales (title, price)
VALUES ('Pine', 10.20), ('Ging', 200.2);

SELECT * FROM basics.sales WHERE price <= 90;
SELECT * FROM basics.sales;