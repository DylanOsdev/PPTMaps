-- MoviMed - Esquema inicial PostGIS (Parte 2)
-- Generado desde la migracion Alembic verificada (0001_initial).
-- Fuente de verdad: alembic/versions/0001_initial.py. Si cambia el modelo,
-- regenerar con: alembic upgrade head --sql
--
-- Uso:
--   createdb movimed
--   psql -d movimed -f schema.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE user_role AS ENUM ('citizen', 'authority', 'admin');

CREATE TABLE users (
    id SERIAL NOT NULL,
    email VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TYPE report_type AS ENUM ('accident', 'flood', 'obstruction', 'other');

CREATE TABLE reports (
    id SERIAL NOT NULL,
    reporter_id INTEGER,
    report_type report_type NOT NULL,
    description TEXT,
    geom geometry(POINT,4326) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(reporter_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_reports_geom ON reports USING gist (geom);

CREATE TABLE accident_zones (
    id SERIAL NOT NULL,
    name VARCHAR(255),
    severity INTEGER NOT NULL,
    incident_count INTEGER NOT NULL,
    geom geometry(MULTIPOLYGON,4326) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX idx_accident_zones_geom ON accident_zones USING gist (geom);

CREATE TYPE flood_status AS ENUM ('dry', 'watch', 'flooded');

CREATE TABLE flood_hazards (
    id SERIAL NOT NULL,
    name VARCHAR(255) NOT NULL,
    siata_station_id VARCHAR(64),
    status flood_status NOT NULL,
    water_level_m FLOAT,
    geom geometry(POLYGON,4326) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX idx_flood_hazards_geom ON flood_hazards USING gist (geom);

CREATE INDEX ix_flood_hazards_siata_station_id ON flood_hazards (siata_station_id);

COMMIT;
