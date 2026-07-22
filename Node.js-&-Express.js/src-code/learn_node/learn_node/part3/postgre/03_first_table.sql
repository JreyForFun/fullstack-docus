DROP TABLE IF EXISTS basics.students;

CREATE TABLE basics.students (
    -- create an auto incrementing integer
    -- 1, -> 2 .... 7
    -- primary key simply means this col uniquely identifies each

    id SERIAL PRIMARY KEY,

    -- text - string data
    -- not null means col is required
    -- postgres is going to reject if this name value is not presented

    name TEXT NOT NULL,

    -- unique means - no 2 students is going to have same email
    email TEXT NOT NULL UNIQUE,

    age INTEGER CHECK (age >= 18),

    -- TIMESTAP -> store date and time format
    -- default means if u don't give any value it will take by default
    created_at TIMESTAMP DEFAULT NOW()
);

-- insert some data

INSERT INTO basics.students (name, email, age)
VALUES
    ('Snagam', 'sangma@gmail.com', 19),
    ('Snagams', 'sangsma@gmail.com', 21);

SELECT * FROM basics.students;