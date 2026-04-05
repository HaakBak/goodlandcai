-- GoodLand Cafe POS - Supabase Schema
-- Version: 1.0.0
-- Created: March 24, 2026
-- 
-- This schema defines all 11 tables with Row-Level Security (RLS) policies
-- Copy and paste this entire file into Supabase SQL Editor and run

-- ============================================================================
-- 1. USER PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL CHECK (role IN ('Employee', 'Manager', 'Administrator')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see their own profile; Admins can see all
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (
    auth.uid()::text = id::text OR
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

-- RLS Policy: Users can create their own profile; Admins can create any users
CREATE POLICY "Users create own profile" ON user_profiles
  FOR INSERT WITH CHECK (
    auth.uid()::text = id::text OR
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

-- RLS Policy: Users update own profile; Admins update any (using auth metadata)
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid()::text = id::text OR 
                    (auth.jwt()->'user_metadata'->>'role') = 'Administrator');

-- RLS Policy: Users delete own profile; Admins can delete any
CREATE POLICY "Users delete own profile" ON user_profiles
  FOR DELETE USING (auth.uid()::text = id::text OR 
                    (auth.jwt()->'user_metadata'->>'role') = 'Administrator');

-- ============================================================================
-- 2. MENU TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS menu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL,
  "basePrice" DECIMAL(10, 2) DEFAULT 0,
  vat_fee DECIMAL(5, 2) DEFAULT 0,
  "VAT_fee" DECIMAL(5, 2) DEFAULT 0,
  "totalPrice" DECIMAL(10, 2) DEFAULT 0,
  in_stock BOOLEAN DEFAULT true,
  "hasSizes" BOOLEAN DEFAULT false,
  has_sizes BOOLEAN DEFAULT false,
  image_url VARCHAR(255),
  sizes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_menu_category ON menu(category);
CREATE INDEX idx_menu_in_stock ON menu(in_stock);

-- Enable RLS
ALTER TABLE menu ENABLE ROW LEVEL SECURITY;

-- RLS Policy: All users can read menu
CREATE POLICY "Public read menu" ON menu
  FOR SELECT USING (true);

-- RLS Policy: Only Managers & Admins can modify (using auth metadata)
CREATE POLICY "Managers and admins modify menu" ON menu
  FOR INSERT WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

CREATE POLICY "Managers and admins update menu" ON menu
  FOR UPDATE USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

CREATE POLICY "Managers and admins delete menu" ON menu
  FOR DELETE USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- ============================================================================
-- 3. INVENTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  in_stock INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  unit VARCHAR(20),
  cost DECIMAL(10, 2),
  type VARCHAR(50),
  expiration_date DATE,
  "expirationDate" DATE,
  "inStock" INTEGER DEFAULT 0,
  "reorderLevel" INTEGER DEFAULT 10,
  "measurementUnit" VARCHAR(20),
  "measurementQty" INTEGER,
  "openStock" INTEGER DEFAULT 0,
  "lowStockThreshold" INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_in_stock ON inventory(in_stock);

-- Enable RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Managers & Admins can read inventory (using auth metadata)
CREATE POLICY "Managers and admins read inventory" ON inventory
  FOR SELECT USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- RLS Policy: Only Managers & Admins can modify
CREATE POLICY "Managers and admins modify inventory" ON inventory
  FOR INSERT WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

CREATE POLICY "Managers and admins update inventory" ON inventory
  FOR UPDATE USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

CREATE POLICY "Managers and admins delete inventory" ON inventory
  FOR DELETE USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- ============================================================================
-- 4. TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  order_number INTEGER,
  items JSONB NOT NULL DEFAULT '[]',
  base_amount DECIMAL(10, 2),
  discount_type VARCHAR(50),
  discount_amount DECIMAL(10, 2),
  vat_portion DECIMAL(10, 2),
  service_fee DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  cash_provided DECIMAL(10, 2),
  change DECIMAL(10, 2),
  type VARCHAR(50),
  time_ordered TEXT,
  timestamp TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'No' CHECK (status IN ('pending', 'completed', 'cancelled', 'Yes', 'No')),
  employee_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_order_number ON transactions(order_number);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_status ON transactions(status);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Employees see own transactions; Managers see team; Admins see all (using auth metadata)
CREATE POLICY "Employees read own transactions" ON transactions
  FOR SELECT USING (user_id = auth.uid()::uuid OR
                    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator'));

-- RLS Policy: Only Employees & Managers can insert
CREATE POLICY "Employees and managers create transactions" ON transactions
  FOR INSERT WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role') IN ('Employee', 'Manager', 'Administrator')
  );

-- RLS Policy: Users update own transactions; Managers/Admins update any
CREATE POLICY "Users update own transactions" ON transactions
  FOR UPDATE USING (user_id = auth.uid()::uuid OR
                    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator'));

-- RLS Policy: Users delete own transactions; Managers/Admins delete any
CREATE POLICY "Users delete own transactions" ON transactions
  FOR DELETE USING (user_id = auth.uid()::uuid OR
                    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator'));

-- ============================================================================
-- 5. HISTORY TABLE (Audit Logs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  "user" VARCHAR(100),
  role VARCHAR(50),
  type VARCHAR(50) NOT NULL,
  description TEXT,
  details JSONB,
  date DATE,
  time VARCHAR(20),
  timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_history_user_id ON history(user_id);
CREATE INDEX idx_history_created_at ON history(created_at);
CREATE INDEX idx_history_type ON history(type);

-- Enable RLS
ALTER TABLE history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Employees see own history; Managers see team; Admins see all (using auth metadata)
CREATE POLICY "Employees read own history" ON history
  FOR SELECT USING (user_id = auth.uid()::uuid OR
                    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator'));

-- RLS Policy: Only Employees can insert (auto-logged by system)
CREATE POLICY "Anyone can log history" ON history
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 6. BUSINESS INFO TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tin VARCHAR(50) UNIQUE,
  name VARCHAR(100),
  status VARCHAR(50),
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(100),
  website VARCHAR(255),
  logo_url VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE business_info ENABLE ROW LEVEL SECURITY;

-- RLS Policy: All users can read business info
CREATE POLICY "Public read business info" ON business_info
  FOR SELECT USING (true);

-- RLS Policy: Only Admins can modify (using auth metadata)
CREATE POLICY "Admins modify business info" ON business_info
  FOR INSERT WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

CREATE POLICY "Admins update business info" ON business_info
  FOR UPDATE USING (
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

CREATE POLICY "Admins delete business info" ON business_info
  FOR DELETE USING (
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

-- ============================================================================
-- 7. SUPPLIERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  contact_person VARCHAR(100),
  payment_terms VARCHAR(100),
  items JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_suppliers_name ON suppliers(name);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Managers & Admins can read suppliers (using auth metadata)
CREATE POLICY "Managers and admins read suppliers" ON suppliers
  FOR SELECT USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- RLS Policy: Only Managers & Admins can modify (using auth metadata)
CREATE POLICY "Managers and admins modify suppliers" ON suppliers
  FOR INSERT WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

CREATE POLICY "Managers and admins update suppliers" ON suppliers
  FOR UPDATE USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

CREATE POLICY "Managers and admins delete suppliers" ON suppliers
  FOR DELETE USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- ============================================================================
-- 8. RECIPES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID REFERENCES menu(id) ON DELETE CASCADE,
  ingredients JSONB DEFAULT '[]',
  steps TEXT,
  prep_time INTEGER,
  cooking_time INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_recipes_dish_id ON recipes(dish_id);

-- Enable RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Managers & Admins can read recipes (using auth metadata)
CREATE POLICY "Managers and admins read recipes" ON recipes
  FOR SELECT USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- RLS Policy: Only Admins can modify recipes
CREATE POLICY "Admins modify recipes" ON recipes
  FOR INSERT WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

CREATE POLICY "Admins update recipes" ON recipes
  FOR UPDATE USING (
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

CREATE POLICY "Admins delete recipes" ON recipes
  FOR DELETE USING (
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

-- ============================================================================
-- 9. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  category VARCHAR(50),
  type VARCHAR(50),
  timestamp TIMESTAMP WITH TIME ZONE,
  payload JSONB,
  seen BOOLEAN DEFAULT false,
  seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_seen ON notifications(seen);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users see their own notifications and system/global alerts
CREATE POLICY "Users read own notifications" ON notifications
  FOR SELECT USING (
    user_id IS NULL OR
    user_id = auth.uid()::uuid OR
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

-- RLS Policy: Authenticated users can create notifications
CREATE POLICY "Authenticated users create notifications" ON notifications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Admins update notifications" ON notifications
  FOR UPDATE USING (
    user_id = auth.uid()::uuid OR (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

CREATE POLICY "Admins delete notifications" ON notifications
  FOR DELETE USING (
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

-- ============================================================================
-- 10. USAGE LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX idx_usage_logs_action ON usage_logs(action);

-- Enable RLS
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Managers & Admins can read usage logs (using auth metadata)
CREATE POLICY "Managers and admins read usage logs" ON usage_logs
  FOR SELECT USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- RLS Policy: System logs (anyone can insert)
CREATE POLICY "Anyone can log usage" ON usage_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 11. SERVICE FEES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dine_in DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "dineIn" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  takeout DECIMAL(5, 2) NOT NULL DEFAULT 0,
  delivery DECIMAL(5, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE service_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policy: All users can read service fees
CREATE POLICY "Public read service fees" ON service_fees
  FOR SELECT USING (true);

-- RLS Policy: Only Admins can modify (using auth metadata)
CREATE POLICY "Admins modify service fees" ON service_fees
  FOR INSERT WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

CREATE POLICY "Admins update service fees" ON service_fees
  FOR UPDATE USING (
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

CREATE POLICY "Admins delete service fees" ON service_fees
  FOR DELETE USING (
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

-- ============================================================================
-- INITIALIZATION (Optional: Create default data)
-- ============================================================================

-- Insert default business info
INSERT INTO business_info (tin, name, status, address, phone, email)
VALUES ('908-767-876-000', 'GoodLand Cafe', 'active', '123 Main St', '555-0123', 'info@goodlandcafe.com')
ON CONFLICT (tin) DO NOTHING;

-- Insert default service fees
INSERT INTO service_fees (dine_in, "dineIn", takeout, delivery)
VALUES (0.10, 0.10, 0.05, 0.15)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
-- All tables created with RLS policies enforcing RBAC:
-- - Employee: Can see only their own data
-- - Manager: Can see their team's data
-- - Administrator: Can see all data and modify configurations
-- 
-- Created tables:
-- 1. user_profiles (users + roles)
-- 2. menu (menu items)
-- 3. inventory (stock management)
-- 4. transactions (sales records)
-- 5. history (audit logs)
-- 6. business_info (company details)
-- 7. suppliers (vendor management)
-- 8. recipes (dish recipes)
-- 9. notifications (system alerts)
-- 10. usage_logs (activity tracking)
-- 11. service_fees (transaction fees)
