-- NOT NULL, UNIQUE, DEFAULT, CHECK
-- app, script, developer

DROP TABLE IF EXISTS basics.accounts;

CREATE TABLE basics.accounts (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    age INTEGER CHECK (age >= 18),
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO basics.accounts (full_name, email, age, is_active)
VALUES ('john rey quizon', 'jrq@gmail.com', 20, true), ('shedrealene astillero', 'sa@gmail.com', 21, false);

SELECT * FROM basics.accounts;
SELECT * FROM basics.accounts WHERE is_active = false;