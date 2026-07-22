-- dp -> schema -> table -> rows

-- if not exists is going to prevent error if the schema is already created 
CREATE SCHEMA IF NOT EXISTS basics;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- query
SELECT schema_name
FROM information_schema.schemata
ORDER BY schema_name;

-- OUTPUT
-- -U postgres -d postgresql_part1 -f 02_schema.sql
-- psql:02_schema.sql:4: NOTICE:  schema "basics" already exists, skipping
-- CREATE SCHEMA
-- psql:02_schema.sql:6: NOTICE:  extension "pgcrypto" already exists, skipping
-- CREATE EXTENSION
--     schema_name
-- --------------------
--  basics
--  information_schema
--  pg_catalog
--  pg_toast
--  public
-- (5 rows)