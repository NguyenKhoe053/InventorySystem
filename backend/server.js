require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Phục vụ các file tĩnh (HTML, CSS, JS) từ thư mục cha
app.use(express.static(path.join(__dirname, '../')));

// Cấu hình kết nối MySQL
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'InventorySystem',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;
async function connectDB() {
    try {
        pool = mysql.createPool(dbConfig);
        const connection = await pool.getConnection();
        console.log('✅ Connected to MySQL Server successfully!');
        connection.release();
    } catch (err) {
        console.error('❌ Database connection failed! Vui lòng kiểm tra lại MySQL đã bật chưa và mật khẩu đúng chưa.', err.message);
    }
}
connectDB();

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

// ==========================================
// 4. UTILITIES (LOAD SAMPLE DATA)
// ==========================================
app.post('/api/load-sample', async (req, res) => {
    try {
        await pool.execute('DELETE FROM Transactions');
        await pool.execute('DELETE FROM Products');
        
        const sampleProducts = [
            { id: '1', code: 'SP001', name: 'Laptop Dell XPS 15', importPrice: 25000000, sellPrice: 28000000, quantity: 15 },
            { id: '2', code: 'SP002', name: 'Chuột Không Dây Logitech MX', importPrice: 1200000, sellPrice: 1800000, quantity: 50 },
            { id: '3', code: 'SP003', name: 'Bàn Phím Cơ Keychron', importPrice: 1500000, sellPrice: 2000000, quantity: 8 },
            { id: '4', code: 'SP004', name: 'Màn Hình LG 27 inch 4K', importPrice: 6000000, sellPrice: 7500000, quantity: 0 },
            { id: '5', code: 'SP005', name: 'Tai Nghe Sony WH-1000XM5', importPrice: 6500000, sellPrice: 7990000, quantity: 2 }
        ];
        
        for (let p of sampleProducts) {
            await pool.execute(
                `INSERT INTO Products (id, code, name, importPrice, sellPrice, quantity) VALUES (?, ?, ?, ?, ?, ?)`,
                [p.id, p.code, p.name, p.importPrice, p.sellPrice, p.quantity]
            );
        }
        
        const now = new Date();
        const transactions = [
            { id: 't1', date: new Date(now - 86400000*3), productId: '1', type: 'import', quantity: 20, note: 'Nhập lô hàng đầu tháng', user: 'admin' },
            { id: 't2', date: new Date(now - 86400000*2), productId: '1', type: 'export', quantity: 5, note: 'Xuất kho cho dự án A', user: 'manager' },
            { id: 't4', date: now, productId: '2', type: 'import', quantity: 50, note: 'Bổ sung tồn kho', user: 'admin' }
        ];

        for (let t of transactions) {
            await pool.execute(
                `INSERT INTO Transactions (id, date, productId, type, quantity, note, user_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [t.id, t.date, t.productId, t.type, t.quantity, t.note, t.user]
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
    console.log(`🌐 Bạn có thể truy cập hệ thống tại: http://localhost:${PORT}`);
});
