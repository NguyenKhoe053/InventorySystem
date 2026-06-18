require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Phục vụ giao diện Frontend
app.use(express.static(path.join(__dirname, '../')));

const isAiven = (process.env.DB_HOST || '').includes('aivencloud');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'InventorySystem',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: isAiven ? { rejectUnauthorized: false } : undefined
};

let pool;
async function connectDB() {
    try {
        pool = mysql.createPool(dbConfig);
        const connection = await pool.getConnection();
        console.log('✅ Connected to MySQL Server successfully!');
        connection.release();
    } catch (err) {
        console.error('❌ Database connection failed!', err.message);
    }
}
connectDB();

// ==========================================
// 0. KHỞI TẠO DATABASE TỰ ĐỘNG CHO CLOUD
// ==========================================
app.get('/api/init-db', async (req, res) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'viewer'
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Products (
                id VARCHAR(50) PRIMARY KEY,
                code VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                importPrice DECIMAL(18, 2) DEFAULT 0,
                sellPrice DECIMAL(18, 2) DEFAULT 0,
                quantity INT DEFAULT 0
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Transactions (
                id VARCHAR(50) PRIMARY KEY,
                date DATETIME NOT NULL,
                productId VARCHAR(50),
                type VARCHAR(10) NOT NULL,
                quantity INT NOT NULL,
                note TEXT,
                user_name VARCHAR(50),
                FOREIGN KEY (productId) REFERENCES Products(id) ON DELETE CASCADE
            )
        `);
        
        try {
            await pool.query("INSERT INTO Users (username, password, role) VALUES ('admin', '123456', 'admin')");
            await pool.query("INSERT INTO Users (username, password, role) VALUES ('manager', 'manager123', 'manager')");
        } catch(e) {
            // Đã có user
        }
        
        res.send("<h1>✅ Khởi tạo Database thành công!</h1><p>Bạn có thể quay lại trang chủ để Đăng nhập bằng tài khoản admin - 123456</p>");
    } catch (err) {
        res.status(500).send("Lỗi khởi tạo DB: " + err.message);
    }
});

// ==========================================
// 1. AUTHENTICATION API
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.execute(
            'SELECT username, role FROM Users WHERE username = ? AND password = ?',
            [username, password]
        );
        
        if (rows.length > 0) {
            res.json({ success: true, user: rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        await pool.execute(
            "INSERT INTO Users (username, password, role) VALUES (?, ?, 'viewer')",
            [username, password]
        );
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// ==========================================
// 2. PRODUCTS API
// ==========================================
app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM Products');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', async (req, res) => {
    const { id, code, name, importPrice, sellPrice, quantity } = req.body;
    try {
        await pool.execute(
            `INSERT INTO Products (id, code, name, importPrice, sellPrice, quantity) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, code, name, importPrice, sellPrice, quantity]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { code, name, importPrice, sellPrice, quantity } = req.body;
    try {
        await pool.execute(
            `UPDATE Products SET code=?, name=?, importPrice=?, sellPrice=?, quantity=? WHERE id=?`,
            [code, name, importPrice, sellPrice, quantity, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM Transactions WHERE productId = ?', [id]);
        await pool.execute('DELETE FROM Products WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. TRANSACTIONS API
// ==========================================
app.get('/api/transactions', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM Transactions ORDER BY date DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions', async (req, res) => {
    const { id, date, productId, type, quantity, note, user } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        await connection.execute(
            `INSERT INTO Transactions (id, date, productId, type, quantity, note, user_name)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, new Date(date), productId, type, quantity, note || '', user]
        );
        
        const qtyChange = type === 'import' ? quantity : -quantity;
        await connection.execute(
            `UPDATE Products SET quantity = quantity + ? WHERE id = ?`,
            [qtyChange, productId]
        );
            
        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/load-sample', async (req, res) => {
    try {
        await pool.execute('DELETE FROM Transactions');
        await pool.execute('DELETE FROM Products');
        
        const sampleProducts = [
            { id: '1', code: 'SP001', name: 'Laptop Dell XPS 15', importPrice: 25000000, sellPrice: 28000000, quantity: 15 },
            { id: '2', code: 'SP002', name: 'Chuột Không Dây Logitech MX', importPrice: 1200000, sellPrice: 1800000, quantity: 50 },
            { id: '3', code: 'SP003', name: 'Bàn Phím Cơ Keychron', importPrice: 1500000, sellPrice: 2000000, quantity: 8 }
        ];
        
        for (let p of sampleProducts) {
            await pool.execute(
                `INSERT INTO Products (id, code, name, importPrice, sellPrice, quantity) VALUES (?, ?, ?, ?, ?, ?)`,
                [p.id, p.code, p.name, p.importPrice, p.sellPrice, p.quantity]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/clear-all', async (req, res) => {
    try {
        await pool.execute('DELETE FROM Transactions');
        await pool.execute('DELETE FROM Products');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
