// app.js - Full-stack Edition with Backend API Integration
const API_BASE_URL = (window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';

let products = [];
let transactions = [];
let currentPage = 1, itemsPerPage = 8;
let filteredProducts = [];
let filteredTransactions = [];
let stockChartInstance = null;
let statusChartInstance = null;
let currentRole = null, currentUser = null;

const roles = {
    admin: { canAdd: true, canEdit: true, canDelete: true, canTransaction: true, canLoadSample: true, canClearAll: true, canExport: true },
    manager: { canAdd: true, canEdit: true, canDelete: false, canTransaction: true, canLoadSample: false, canClearAll: false, canExport: true },
    viewer: { canAdd: false, canEdit: false, canDelete: false, canTransaction: false, canLoadSample: false, canClearAll: false, canExport: false }
};

function hasPermission(permission) {
    return roles[currentRole]?.[permission] || false;
}

const formatCurrency = (num) => new Intl.NumberFormat('vi-VN').format(num) + ' ₫';

const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const getStatusInfo = (qty) => {
    if (qty > 10) return { label: 'Đầy Đủ', class: 'badge-full' };
    if (qty > 0) return { label: 'Sắp Hết', class: 'badge-low' };
    return { label: 'Hết Hàng', class: 'badge-empty' };
};

const removeAccents = (str) => {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

// ==========================================
// 1. INITIALIZATION & AUTH
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setupAuthListeners();
    setupNavigation();
    
    const savedUser = localStorage.getItem('currentUser');
    const savedRole = localStorage.getItem('currentRole');
    
    if (savedUser && savedRole) {
        currentUser = savedUser;
        currentRole = savedRole;
        showMainApp();
    } else {
        document.getElementById('authScreen').style.display = 'flex';
    }
});

function setupAuthListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = document.getElementById('loginUsername').value.trim();
            const p = document.getElementById('loginPassword').value;
            
            try {
                const res = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: u, password: p })
                });
                const data = await res.json();
                
                if (data.success) {
                    currentUser = data.user.username;
                    currentRole = data.user.role;
                    localStorage.setItem('currentUser', currentUser);
                    localStorage.setItem('currentRole', currentRole);
                    loginForm.reset();
                    showMainApp();
                } else {
                    alert(data.message || 'Sai tên đăng nhập hoặc mật khẩu!');
                }
            } catch (err) {
                console.error(err);
                alert('Không thể kết nối đến máy chủ Backend!');
            }
        });
    }

    const regForm = document.getElementById('registerForm');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = document.getElementById('regUsername').value.trim();
            const p = document.getElementById('regPassword').value;
            const cp = document.getElementById('regConfirmPassword').value;

            if (p !== cp) return alert('Mật khẩu xác nhận không khớp!');
            
            try {
                const res = await fetch(`${API_BASE_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: u, password: p })
                });
                const data = await res.json();
                
                if (data.success) {
                    alert('Đăng ký thành công! Đăng nhập để tiếp tục.');
                    regForm.reset();
                    document.getElementById('login-tab').click();
                } else {
                    alert(data.message || 'Đăng ký thất bại!');
                }
            } catch (err) {
                alert('Lỗi kết nối Server!');
            }
        });
    }
}

function showMainApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    
    document.getElementById('displayUsername').textContent = currentUser;
    const roleBadge = document.getElementById('displayRole');
    roleBadge.textContent = currentRole;
    roleBadge.className = `role-badge role-${currentRole}`;
    
    applyPermissions();
    fetchDataFromServer();
}

function logout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentRole');
    currentUser = null;
    currentRole = null;
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
}

function applyPermissions() {
    const els = {
        'addProductBtn': 'canAdd',
        'importBtn': 'canTransaction',
        'exportBtn': 'canTransaction',
        'loadSampleBtn': 'canLoadSample',
        'clearAllBtn': 'canClearAll',
        'exportPDFBtn': 'canExport'
    };
    
    for (const [id, perm] of Object.entries(els)) {
        const el = document.getElementById(id);
        if (el) el.style.display = hasPermission(perm) ? 'inline-block' : 'none';
    }
}

// ==========================================
// 2. NAVIGATION & DATA LOADING
// ==========================================
function setupNavigation() {
    const links = document.querySelectorAll('.sidebar-nav .nav-link');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            const targetId = link.getAttribute('data-target');
            document.querySelectorAll('.page-tab').forEach(tab => tab.style.display = 'none');
            document.getElementById(targetId).style.display = 'block';
            
            document.getElementById('pageTitle').textContent = link.querySelector('span').textContent;
            
            if (targetId === 'dashboard-tab') updateDashboard();
            if (targetId === 'products-tab') renderProducts();
            if (targetId === 'transactions-tab') renderTransactions();
        });
    });
}

async function fetchDataFromServer() {
    try {
        const [prodRes, transRes] = await Promise.all([
            fetch(`${API_BASE_URL}/products`),
            fetch(`${API_BASE_URL}/transactions`)
        ]);
        
        products = await prodRes.json();
        transactions = await transRes.json();
        
        updateDashboard();
        renderProducts();
        renderTransactions();
    } catch (err) {
        console.error('Lỗi tải dữ liệu:', err);
    }
}

// ==========================================
// 3. DASHBOARD LOGIC
// ==========================================
function updateDashboard() {
    const totalQty = products.length;
    const totalVal = products.reduce((sum, p) => sum + (p.quantity * p.importPrice), 0);
    const lowCount = products.filter(p => p.quantity > 0 && p.quantity <= 10).length;
    const outCount = products.filter(p => p.quantity === 0).length;
    
    document.getElementById('totalProducts').textContent = totalQty;
    document.getElementById('totalValue').textContent = formatCurrency(totalVal);
    document.getElementById('lowStock').textContent = lowCount;
    document.getElementById('outOfStock').textContent = outCount;
    
    updateCharts();
}

function updateCharts() {
    const topProducts = [...products].sort((a,b) => (b.quantity*b.importPrice) - (a.quantity*a.importPrice)).slice(0, 10);
    const labels = topProducts.map(p => p.code);
    const values = topProducts.map(p => p.quantity * p.importPrice);
    
    const statusCounts = [
        products.filter(p => p.quantity > 10).length,
        products.filter(p => p.quantity > 0 && p.quantity <= 10).length,
        products.filter(p => p.quantity === 0).length
    ];

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#64748b';

    const ctxStock = document.getElementById('stockChart');
    if (stockChartInstance) stockChartInstance.destroy();
    
    if (ctxStock) {
        stockChartInstance = new Chart(ctxStock, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Giá trị tồn (VNĐ)',
                    data: values,
                    backgroundColor: '#3b82f6',
                    borderRadius: 6,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { border: { display: false }, grid: { color: '#f1f5f9' }, beginAtZero: true },
                    x: { border: { display: false }, grid: { display: false } }
                }
            }
        });
    }

    const ctxStatus = document.getElementById('statusChart');
    if (statusChartInstance) statusChartInstance.destroy();
    
    if (ctxStatus) {
        statusChartInstance = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['Đầy Đủ', 'Sắp Hết', 'Hết Hàng'],
                datasets: [{
                    data: statusCounts,
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } }
                }
            }
        });
    }
}

// ==========================================
// 4. PRODUCTS CRUD
// ==========================================
function renderProducts() {
    const q = removeAccents(document.getElementById('searchInput').value);
    const filter = document.getElementById('filterStatus').value;
    
    filteredProducts = products.filter(p => {
        const matchQ = removeAccents(p.code).includes(q) || removeAccents(p.name).includes(q);
        const st = getStatusInfo(p.quantity).label;
        const matchF = filter ? st === filter : true;
        return matchQ && matchF;
    });

    const total = filteredProducts.length;
    const start = (currentPage - 1) * itemsPerPage;
    const pageItems = filteredProducts.slice(start, start + itemsPerPage);
    
    const tbody = document.getElementById('productsBody');
    tbody.innerHTML = '';
    
    if (pageItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Không tìm thấy sản phẩm nào.</td></tr>`;
    } else {
        pageItems.forEach(p => {
            const st = getStatusInfo(p.quantity);
            const act = hasPermission('canEdit') ? `
                <button class="btn btn-sm btn-light text-primary me-1" onclick="editProduct('${p.id}')"><i class="fas fa-edit"></i></button>
                ${hasPermission('canDelete') ? `<button class="btn btn-sm btn-light text-danger" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash-alt"></i></button>` : ''}
            ` : '-';

            tbody.innerHTML += `
                <tr>
                    <td class="fw-medium text-slate-800 ps-4">${p.code}</td>
                    <td>${p.name}</td>
                    <td><span class="badge bg-slate-100 text-slate-700 fs-6 px-2 py-1">${p.quantity}</span></td>
                    <td>${formatCurrency(p.importPrice)}</td>
                    <td>${formatCurrency(p.sellPrice)}</td>
                    <td><span class="status-badge ${st.class}">${st.label}</span></td>
                    <td class="text-end pe-4">${act}</td>
                </tr>
            `;
        });
    }
    
    const totalPages = Math.ceil(total / itemsPerPage);
    document.getElementById('tableInfo').textContent = `Hiển thị ${total === 0 ? 0 : start + 1} - ${Math.min(start + itemsPerPage, total)} trong số ${total} sản phẩm`;
    
    const pag = document.getElementById('pagination');
    pag.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        pag.innerHTML += `<li class="page-item ${i === currentPage ? 'active' : ''}">
            <a class="page-link" href="#" onclick="changeProductPage(${i}); return false;">${i}</a>
        </li>`;
    }
}

function handleSearchInput() { currentPage = 1; renderProducts(); }
function filterProducts() { currentPage = 1; renderProducts(); }
function changeProductPage(p) { currentPage = p; renderProducts(); }

function resetProductForm() {
    document.getElementById('productForm').reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('productModalTitle').textContent = 'Thêm Sản Phẩm Mới';
}

function editProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('editProductId').value = p.id;
    document.getElementById('productCode').value = p.code;
    document.getElementById('productName').value = p.name;
    document.getElementById('productImportPrice').value = p.importPrice;
    document.getElementById('productSellPrice').value = p.sellPrice;
    document.getElementById('productModalTitle').textContent = 'Cập Nhật Sản Phẩm';
    new bootstrap.Modal(document.getElementById('productModal')).show();
}

async function saveProduct() {
    if (!hasPermission('canAdd')) return;
    
    const id = document.getElementById('editProductId').value;
    const code = document.getElementById('productCode').value.trim();
    const name = document.getElementById('productName').value.trim();
    const imp = parseFloat(document.getElementById('productImportPrice').value);
    const sel = parseFloat(document.getElementById('productSellPrice').value);
    
    if (!code || !name || isNaN(imp) || isNaN(sel)) {
        return alert('Vui lòng điền đầy đủ và đúng định dạng các trường bắt buộc!');
    }
    
    try {
        if (id) {
            await fetch(`${API_BASE_URL}/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, name, importPrice: imp, sellPrice: sel, quantity: products.find(x => x.id === id).quantity })
            });
        } else {
            await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: 'PROD_' + Date.now(),
                    code, name, importPrice: imp, sellPrice: sel, quantity: 0 
                })
            });
        }
        
        bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
        await fetchDataFromServer();
    } catch (err) {
        alert('Lỗi khi lưu sản phẩm!');
    }
}

async function deleteProduct(id) {
    if (!hasPermission('canDelete')) return;
    if (confirm('Bạn có chắc chắn muốn xóa sản phẩm này? Lịch sử giao dịch cũng sẽ bị xóa!')) {
        try {
            await fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' });
            await fetchDataFromServer();
        } catch (err) {
            alert('Lỗi khi xóa sản phẩm!');
        }
    }
}

// ==========================================
// 5. TRANSACTIONS
// ==========================================
function renderTransactions() {
    const dateF = document.getElementById('dateFilter').value;
    
    let list = transactions;
    if (dateF) {
        list = list.filter(t => t.date.startsWith(dateF));
    }
    
    const tbody = document.getElementById('transactionsBody');
    tbody.innerHTML = '';
    
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Chưa có giao dịch nào.</td></tr>`;
        return;
    }
    
    list.forEach(t => {
        const p = products.find(x => x.id === t.productId);
        const pCode = p ? p.code : 'N/A';
        const pName = p ? p.name : 'Sản phẩm đã xóa';
        
        const isImport = t.type === 'import';
        const typeHtml = isImport 
            ? `<span class="badge bg-success-subtle text-success"><i class="fas fa-arrow-down"></i> Nhập</span>`
            : `<span class="badge bg-danger-subtle text-danger"><i class="fas fa-arrow-up"></i> Xuất</span>`;
            
        tbody.innerHTML += `
            <tr>
                <td class="ps-4">${formatDate(t.date)}</td>
                <td class="fw-medium">${pCode}</td>
                <td>${pName}</td>
                <td>${typeHtml}</td>
                <td class="fw-bold ${isImport ? 'text-success' : 'text-danger'}">${isImport ? '+' : '-'}${t.quantity}</td>
                <td>${t.user_name || 'System'}</td>
                <td class="pe-4 text-muted">${t.note || ''}</td>
            </tr>
        `;
    });
}

function setTransactionType(type) {
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionType').value = type;
    document.getElementById('transactionModalTitle').textContent = type === 'import' ? 'Nhập Kho' : 'Xuất Kho';
    
    const sel = document.getElementById('transactionProduct');
    sel.innerHTML = '<option value="">-- Chọn Sản Phẩm --</option>';
    products.forEach(p => {
        sel.innerHTML += `<option value="${p.id}">[${p.code}] ${p.name} (Tồn: ${p.quantity})</option>`;
    });
    document.getElementById('quantityLimit').textContent = '';
}

function updateQuantityLimit() {
    const type = document.getElementById('transactionType').value;
    const pId = document.getElementById('transactionProduct').value;
    if (type === 'export' && pId) {
        const p = products.find(x => x.id === pId);
        document.getElementById('quantityLimit').textContent = `Tối đa có thể xuất: ${p.quantity}`;
        document.getElementById('transactionQuantity').max = p.quantity;
    } else {
        document.getElementById('quantityLimit').textContent = '';
        document.getElementById('transactionQuantity').removeAttribute('max');
    }
}

async function saveTransaction() {
    if (!hasPermission('canTransaction')) return;
    
    const type = document.getElementById('transactionType').value;
    const pId = document.getElementById('transactionProduct').value;
    const qty = parseInt(document.getElementById('transactionQuantity').value);
    const note = document.getElementById('transactionNote').value.trim();
    
    if (!pId || isNaN(qty) || qty <= 0) return alert('Vui lòng chọn sản phẩm và nhập số lượng hợp lệ!');
    
    const p = products.find(x => x.id === pId);
    if (!p) return;
    
    if (type === 'export' && p.quantity < qty) {
        return alert(`Kho không đủ hàng! Chỉ còn ${p.quantity} sản phẩm.`);
    }
    
    try {
        await fetch(`${API_BASE_URL}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: 'TXN_' + Date.now(),
                date: new Date().toISOString(),
                productId: pId,
                type: type,
                quantity: qty,
                note: note,
                user: currentUser
            })
        });
        
        bootstrap.Modal.getInstance(document.getElementById('transactionModal')).hide();
        await fetchDataFromServer();
    } catch (err) {
        alert('Lỗi khi lưu giao dịch!');
    }
}

function filterTransactions() { renderTransactions(); }

// ==========================================
// 6. UTILS & EXPORT
// ==========================================
async function syncOldData() {
    if (!hasPermission('canAdd')) return;
    try {
        const oldProducts = JSON.parse(localStorage.getItem('products') || '[]');
        const oldTrans = JSON.parse(localStorage.getItem('transactions') || '[]');
        
        if (oldProducts.length === 0 && oldTrans.length === 0) {
            return alert('Không tìm thấy dữ liệu cũ trong trình duyệt!');
        }
        
        if (!confirm(`Tìm thấy ${oldProducts.length} sản phẩm và ${oldTrans.length} giao dịch cũ. Bạn có muốn đồng bộ lên Database không?`)) return;

        await fetch(`${API_BASE_URL}/clear-all`, { method: 'POST' });

        for (let p of oldProducts) {
            await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: p.id,
                    code: p.code,
                    name: p.name,
                    importPrice: p.importPrice,
                    sellPrice: p.sellPrice,
                    quantity: p.quantity
                })
            });
        }
        
        alert('Đã khôi phục sản phẩm cũ thành công! (Lịch sử giao dịch cần được insert tay vào DB để không bị cộng dồn sai số lượng).');
        await fetchDataFromServer();
    } catch (err) {
        alert('Lỗi khi khôi phục dữ liệu!');
    }
}

async function loadSampleData() {
    if (!hasPermission('canLoadSample')) return;
    if(!confirm('Dữ liệu mẫu sẽ xóa trắng dữ liệu hiện tại trong Database. Tiếp tục?')) return;
    
    try {
        await fetch(`${API_BASE_URL}/load-sample`, { method: 'POST' });
        alert('Đã tải dữ liệu mẫu thành công!');
        await fetchDataFromServer();
    } catch (err) {
        alert('Lỗi khi tải dữ liệu mẫu!');
    }
}

async function clearAllData() {
    if (!hasPermission('canClearAll')) return;
    if(confirm('CẢNH BÁO: Xóa toàn bộ Sản phẩm và Giao dịch trong CSDL. Không thể khôi phục. Chắc chắn xóa?')) {
        try {
            await fetch(`${API_BASE_URL}/clear-all`, { method: 'POST' });
            alert('Đã xóa toàn bộ dữ liệu!');
            await fetchDataFromServer();
        } catch (err) {
            alert('Lỗi khi xóa dữ liệu!');
        }
    }
}

function exportToPDF() {
    if (!hasPermission('canExport')) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("BAO CAO TON KHO - L&F SYSTEM", 14, 22);
    
    doc.setFontSize(11);
    doc.text("Ngay tao: " + new Date().toLocaleString('vi-VN'), 14, 30);
    doc.text("Nguoi tao: " + currentUser, 14, 36);

    const bodyData = products.map((p, index) => [
        index + 1,
        p.code,
        removeAccents(p.name),
        p.quantity.toString(),
        new Intl.NumberFormat('en-US').format(p.importPrice),
        new Intl.NumberFormat('en-US').format(p.quantity * p.importPrice)
    ]);

    doc.autoTable({
        startY: 45,
        head: [['STT', 'Ma SP', 'Ten San Pham', 'Ton Kho', 'Gia Nhap (VND)', 'Tong Gia Tri (VND)']],
        body: bodyData,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] }
    });

    const totalVal = products.reduce((s, p) => s + (p.quantity * p.importPrice), 0);
    doc.text("Tong gia tri kho: " + new Intl.NumberFormat('en-US').format(totalVal) + " VND", 14, doc.autoTable.previous.finalY + 10);

    doc.save(`Bao_Cao_Kho_${new Date().getTime()}.pdf`);
}
