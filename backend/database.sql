CREATE DATABASE IF NOT EXISTS InventorySystem;
USE InventorySystem;

CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'viewer'
);

CREATE TABLE Products (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    importPrice DECIMAL(18, 2) DEFAULT 0,
    sellPrice DECIMAL(18, 2) DEFAULT 0,
    quantity INT DEFAULT 0
);

CREATE TABLE Transactions (
    id VARCHAR(50) PRIMARY KEY,
    date DATETIME NOT NULL,
    productId VARCHAR(50),
    type VARCHAR(10) NOT NULL,
    quantity INT NOT NULL,
    note TEXT,
    user_name VARCHAR(50),
    FOREIGN KEY (productId) REFERENCES Products(id) ON DELETE CASCADE
);

INSERT INTO Users (username, password, role) VALUES ('admin', '123456', 'admin');
INSERT INTO Users (username, password, role) VALUES ('manager', 'manager123', 'manager');
