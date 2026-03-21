-- ============================================
-- QueryMesh Demo Schema: E-Commerce Database
-- ============================================
-- This seed creates a realistic e-commerce schema with intentional
-- FK violations for demonstrating the violation detection pipeline.

-- Drop tables if they exist (for clean re-seeding)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS addresses CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- TABLE DEFINITIONS
-- ============================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    street VARCHAR(200) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'US'
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_category_id INTEGER REFERENCES categories(id)
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    category_id INTEGER REFERENCES categories(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    shipping_address_id INTEGER REFERENCES addresses(id),
    status VARCHAR(20) DEFAULT 'pending',
    total_amount DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL
);

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    transaction_id VARCHAR(100),
    processed_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES (for index introspection demo)
-- ============================================

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- ============================================
-- SEED DATA
-- ============================================

-- Users
INSERT INTO users (username, email, full_name) VALUES
    ('jdoe', 'john.doe@example.com', 'John Doe'),
    ('jsmith', 'jane.smith@example.com', 'Jane Smith'),
    ('mbrown', 'mike.brown@example.com', 'Mike Brown'),
    ('ewilson', 'emily.wilson@example.com', 'Emily Wilson'),
    ('rjohnson', 'robert.johnson@example.com', 'Robert Johnson');

-- Addresses
INSERT INTO addresses (user_id, street, city, state, zip_code) VALUES
    (1, '123 Main St', 'Memphis', 'TN', '38101'),
    (2, '456 Oak Ave', 'Nashville', 'TN', '37201'),
    (3, '789 Pine Rd', 'Dallas', 'TX', '75201'),
    (4, '321 Elm Blvd', 'Austin', 'TX', '73301'),
    (5, '654 Maple Dr', 'Chicago', 'IL', '60601');

-- Categories
INSERT INTO categories (name, description, parent_category_id) VALUES
    ('Electronics', 'Electronic devices and accessories', NULL),
    ('Clothing', 'Apparel and fashion', NULL),
    ('Books', 'Physical and digital books', NULL),
    ('Smartphones', 'Mobile phones', 1),
    ('Laptops', 'Portable computers', 1),
    ('Men''s Wear', 'Men''s clothing', 2),
    ('Women''s Wear', 'Women''s clothing', 2);

-- Products
INSERT INTO products (name, description, price, stock_quantity, category_id) VALUES
    ('iPhone 15 Pro', 'Latest Apple smartphone', 999.99, 50, 4),
    ('MacBook Pro 16"', 'Apple laptop with M3 chip', 2499.99, 30, 5),
    ('Samsung Galaxy S24', 'Samsung flagship phone', 899.99, 45, 4),
    ('Classic T-Shirt', '100% cotton basic tee', 29.99, 200, 6),
    ('Running Shoes', 'Lightweight athletic shoes', 89.99, 75, NULL),
    ('Clean Code', 'Robert C. Martin programming book', 39.99, 100, 3),
    ('Design Patterns', 'Gang of Four classic', 49.99, 60, 3),
    ('Wireless Earbuds', 'Noise-canceling Bluetooth earbuds', 149.99, 80, 1);

-- Orders
INSERT INTO orders (user_id, shipping_address_id, status, total_amount) VALUES
    (1, 1, 'completed', 1029.98),
    (2, 2, 'completed', 2499.99),
    (3, 3, 'processing', 929.98),
    (1, 1, 'pending', 89.98),
    (4, 4, 'completed', 149.99),
    (5, 5, 'shipped', 79.98);

-- Order Items
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1, 1, 1, 999.99),
    (1, 4, 1, 29.99),
    (2, 2, 1, 2499.99),
    (3, 3, 1, 899.99),
    (3, 4, 1, 29.99),
    (4, 6, 1, 39.99),
    (4, 7, 1, 49.99),
    (5, 8, 1, 149.99),
    (6, 6, 2, 39.99);

-- Reviews
INSERT INTO reviews (user_id, product_id, rating, comment) VALUES
    (1, 1, 5, 'Amazing phone, great camera!'),
    (2, 2, 4, 'Powerful laptop, runs everything smoothly'),
    (3, 3, 4, 'Great Android phone'),
    (1, 6, 5, 'Must-read for every developer'),
    (4, 8, 3, 'Good sound quality but battery could be better');

-- Payments
INSERT INTO payments (order_id, amount, payment_method, status, transaction_id) VALUES
    (1, 1029.98, 'credit_card', 'completed', 'TXN_001_CC'),
    (2, 2499.99, 'credit_card', 'completed', 'TXN_002_CC'),
    (3, 929.98, 'paypal', 'completed', 'TXN_003_PP'),
    (4, 89.98, 'debit_card', 'pending', 'TXN_004_DC'),
    (5, 149.99, 'credit_card', 'completed', 'TXN_005_CC'),
    (6, 79.98, 'paypal', 'processing', 'TXN_006_PP');

-- ============================================
-- INTENTIONAL FK VIOLATIONS (for demo)
-- ============================================
-- These bypass FK constraints to create orphaned rows
-- that QueryMesh's violation scanner will detect.

-- Temporarily disable FK checks to insert violations
ALTER TABLE order_items DISABLE TRIGGER ALL;
ALTER TABLE reviews DISABLE TRIGGER ALL;
ALTER TABLE payments DISABLE TRIGGER ALL;

-- Orphaned order_items: reference non-existent orders
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (999, 1, 2, 999.99),
    (998, 3, 1, 899.99),
    (997, 5, 3, 89.99);

-- Orphaned order_items: reference non-existent products
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1, 500, 1, 59.99),
    (2, 501, 2, 79.99);

-- Orphaned reviews: reference non-existent products
INSERT INTO reviews (user_id, product_id, rating, comment) VALUES
    (1, 100, 5, 'Great product - but it was deleted!'),
    (2, 101, 4, 'Loved this item before it was removed'),
    (3, 102, 3, 'This product no longer exists');

-- Orphaned reviews: reference non-existent users
INSERT INTO reviews (user_id, product_id, rating, comment) VALUES
    (50, 1, 1, 'Ghost reviewer'),
    (51, 2, 2, 'Another ghost reviewer');

-- Orphaned payments: reference non-existent orders
INSERT INTO payments (order_id, amount, payment_method, status, transaction_id) VALUES
    (888, 199.99, 'credit_card', 'completed', 'TXN_GHOST_001'),
    (889, 59.99, 'paypal', 'failed', 'TXN_GHOST_002');

-- Re-enable FK checks
ALTER TABLE order_items ENABLE TRIGGER ALL;
ALTER TABLE reviews ENABLE TRIGGER ALL;
ALTER TABLE payments ENABLE TRIGGER ALL;
