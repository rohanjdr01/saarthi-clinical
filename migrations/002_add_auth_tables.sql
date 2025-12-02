-- Users table (for authentication)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    firebase_uid TEXT UNIQUE NOT NULL,
    phone TEXT,
    email TEXT,
    name TEXT,
    role TEXT DEFAULT 'user',  -- user, doctor, admin
    is_verified BOOLEAN DEFAULT false,
    profile_completed BOOLEAN DEFAULT false,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Doctors table (extends users)
CREATE TABLE doctors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,  -- FK to users
    specialization TEXT,
    specializations TEXT,  -- JSON array of specializations
    degree TEXT,
    qualifications TEXT,  -- JSON array
    experience TEXT,
    license_number TEXT UNIQUE,
    hospital TEXT,
    contact_number TEXT,
    consultation_fee INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    reviews INTEGER DEFAULT 0,
    availability TEXT,  -- JSON object
    languages TEXT,  -- JSON array
    about TEXT,
    calendly_link TEXT,
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Admins (just use users table with role='admin', or separate if needed)
-- We'll use users table with role='admin'

-- Link patients to users (for authenticated patients)
ALTER TABLE patients ADD COLUMN user_id TEXT;
CREATE INDEX idx_patients_user_id ON patients(user_id);

-- Indexes
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_doctors_user_id ON doctors(user_id);
CREATE INDEX idx_doctors_specialization ON doctors(specialization);
CREATE INDEX idx_doctors_verified ON doctors(is_verified);

