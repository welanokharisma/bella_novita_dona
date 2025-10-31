// app.js

// Import Supabase Client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'; 

// [INTEGRASI SUPABASE] - GANTI DENGAN KUNCI ANDA!
// PASTIKAN ANDA MENGGANTI INI DENGAN URL DAN ANON KEY ASLI ANDA
const API_BASE_URL = 'https://xzlggtyvgnyzzofgudwa.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6bGdndHl2Z255enpvZmd1ZHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MDk0MjcsImV4cCI6MjA3NzQ4NTQyN30.x77c3j7TfL5_tQStYNSurhEC6gUDIasuVUk8YpJAi5E'; 
// END [INTEGRASI SUPABASE]

// Variabel Global
let userId = null; 
let supabase = null;
let currentPeriod = new Date().toISOString().substring(0, 7);
let currentPage = 'dashboard';
let isAuthReady = false;
let isSigningUp = false; 

let currentTransactions = []; 
let currentBudgets = {};    
let currentCategories = {
    expense: ["Makanan & Minuman", "Transportasi", "Tagihan"],
    incomeSource: ["Gaji", "Bonus", "Investasi"],
    account: ["Kas", "Bank Utama", "E-Wallet"]
};

// ----------------------------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------------------------

/** Format angka menjadi mata uang Rupiah */
function formatRupiah(number) {
    if (typeof number !== 'number') number = parseFloat(number);
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
}

/** Format periode YYYY-MM menjadi Bulan Tahun (Indonesia) */
function formatPeriod(period) {
    const [year, month] = period.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

/** Menampilkan Modal Pesan */
function showModal(title, message, isError = false) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    
    const modalButton = document.getElementById('modalCloseButton');
    if (isError) {
        modalButton.classList.remove('bg-green-500', 'hover:bg-green-600');
        modalButton.classList.add('bg-red-500', 'hover:bg-red-600');
    } else {
        modalButton.classList.remove('bg-red-500', 'hover:bg-red-600');
        modalButton.classList.add('bg-green-500', 'hover:bg-green-600');
    }
    
    document.getElementById('modal').classList.remove('hidden');
    document.getElementById('modal').classList.add('flex');
}

// ----------------------------------------------------------------------
// SUPABASE AUTHENTICATION
// ----------------------------------------------------------------------

/** Menginisialisasi Supabase Client dan Cek Status Auth */
async function initializeSupabase() {
    
    // 1. Inisialisasi Supabase
    supabase = createClient(API_BASE_URL, SUPABASE_ANON_KEY);

    // 2. Setup Listener Auth
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            // Pengguna LOGIN/SESSION DITEMUKAN
            userId = session.user.id;
            handleSuccessfulAuth();
        } else {
            // Pengguna LOGOUT/TIDAK ADA SESI
            userId = null;
            showAuthPage();
        }
    });

    // 3. Sembunyikan loading
    document.getElementById('loadingOverlay').classList.add('opacity-0');
    setTimeout(() => {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }, 300);
}

/** Menangani proses Auth yang berhasil */
function handleSuccessfulAuth() {
    isAuthReady = true;
    document.getElementById('authPage').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    document.getElementById('userIdDisplay').textContent = `${userId.substring(0, 8)}...`;
    
    setupListeners(); 
    renderPage('dashboard');
}

/** Menampilkan halaman Login/Register */
function showAuthPage() {
    isAuthReady = false;
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('authPage').classList.remove('hidden');
    
    isSigningUp = false;
    updateAuthUI();
    document.getElementById('authForm').reset(); 
}

/** Menangani submit form login/register */
async function handleAuthFormSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) return;

    try {
        if (isSigningUp) {
            // Proses DAFTAR (Register)
            const { data, error } = await supabase.auth.signUp({ email, password });
            
            if (error) throw error;

            showModal("Sukses", "Pendaftaran berhasil! Cek email Anda untuk konfirmasi.");
            isSigningUp = false;
            updateAuthUI();

        } else {
            // Proses MASUK (Login)
            const { error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) throw error;
        }
        document.getElementById('authForm').reset();

    } catch (error) {
        console.error("Authentication Error:", error);
        showModal("Gagal", `Autentikasi Gagal: ${error.message}`, true);
    }
}

/** Mengubah tampilan Auth (Login <=> Register) */
function updateAuthUI() {
    if (isSigningUp) {
        document.getElementById('authTitle').textContent = "Buat Akun Baru";
        document.getElementById('authButton').textContent = "Daftar";
        document.getElementById('authToggleText').textContent = "Sudah punya akun?";
        document.getElementById('authToggleButton').textContent = "Masuk";
    } else {
        document.getElementById('authTitle').textContent = "Masuk ke Akun Anda";
        document.getElementById('authButton').textContent = "Masuk";
        document.getElementById('authToggleText').textContent = "Belum punya akun?";
        document.getElementById('authToggleButton').textContent = "Daftar Sekarang";
    }
}

/** Fungsi Logout */
async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Logout Error:", error);
        showModal("Gagal", `Logout Gagal: ${error.message}`, true);
    } 
}

// ----------------------------------------------------------------------
// SUPABASE DATA LISTENERS & FETCHING
// ----------------------------------------------------------------------

/** Menyiapkan semua listener data */
function setupListeners() {
    if (!isAuthReady || !supabase) return;

    // Listener Expense
    supabase.from('expenses').on('*', fetchTransactions).subscribe((status) => {
        if (status === 'SUBSCRIBED') { fetchTransactions(); } 
    });

    // Listener Income
    supabase.from('income').on('*', fetchTransactions).subscribe();

    // Listener Budget
    supabase.from('budget_by_category').on('*', fetchBudgets).subscribe((status) => {
        if (status === 'SUBSCRIBED') { fetchBudgets(); }
    });
    
    // Listener Kategori/Settings
    supabase.from('categories').on('*', fetchCategories).subscribe((status) => {
        if (status === 'SUBSCRIBED') { fetchCategories(); }
    });
}

/** Mengambil Transaksi dari Supabase (Menggabungkan Expenses dan Income) */
async function fetchTransactions() {
    if (!isAuthReady || !supabase) return;

    const { data: expenseData, error: expenseError } = await supabase
        .from('expenses').select('*').eq('user_id', userId).eq('is_deleted', false).order('date', { ascending: false });
    
    const { data: incomeData, error: incomeError } = await supabase
        .from('income').select('*').eq('user_id', userId).eq('is_deleted', false).order('date', { ascending: false });

    if (expenseError || incomeError) {
        console.error("Error fetching transactions:", expenseError || incomeError);
        return;
    }

    const allTransactions = [
        ...expenseData.map(tx => ({ 
            ...tx, 
            type: 'Pengeluaran', 
            amount: parseFloat(tx.amount),
            category: tx.category || 'Lainnya'
        })),
        ...incomeData.map(tx => ({ 
            ...tx, 
            type: 'Pemasukan', 
            amount: parseFloat(tx.amount),
            category: tx.category || 'Lainnya'
        }))
    ];

    currentTransactions = allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (currentPage === 'dashboard') loadDashboard(currentPeriod);
    if (currentPage === 'transaksi') renderTransactionsList();
}

/** Mengambil Budget dari Supabase */
async function fetchBudgets() {
    if (!isAuthReady || !supabase) return;
    
    const { data, error } = await supabase
        .from('budget_by_category').select('*').eq('user_id', userId); 

    if (error) {
        console.error("Error fetching budgets:", error);
    } else {
        const formattedBudgets = data.reduce((acc, row) => {
            if (!acc[row.period]) {
                acc[row.period] = {};
            }
            acc[row.period][row.category] = parseFloat(row.limit); 
            return acc;
        }, {});
        
        currentBudgets = formattedBudgets; 

        if (currentPage === 'dashboard') loadDashboard(currentPeriod);
        if (currentPage === 'budget') renderBudgetPage();
    }
}

/** Mengambil Kategori dari Supabase */
async function fetchCategories() {
    if (!isAuthReady || !supabase) return;
    
    const { data, error } = await supabase
        .from('categories')
        .select('expense_category, income_source, account')
        .eq('user_id', userId).single(); 

    if (error && error.code !== 'PGRST116') { 
        console.error("Error fetching categories:", error);
    } else if (data) {
        currentCategories.expense = data.expense_category || [];
        currentCategories.incomeSource = data.income_source || []; 
        currentCategories.account = data.account || [];
    } else {
        saveCategories(); 
    }
    
    if (currentPage === 'transaksi') renderTransactionPageTemplate(); 
    if (currentPage === 'pengaturan') renderSettingsPage();
}


// ----------------------------------------------------------------------
// SUPABASE DATA CRUD (Create, Read, Update, Delete)
// ----------------------------------------------------------------------

/** Menyimpan transaksi baru (Pemasukan/Pengeluaran) */
async function saveTransaction(type, amount, dateStr, category, account, description) {
    if (!isAuthReady || !supabase) return;

    const targetTable = type === 'Pengeluaran' ? 'expenses' : 'income';
    const period = dateStr.substring(0, 7);
    
    try {
        const payload = {
            user_id: userId, 
            amount: parseFloat(amount),
            date: dateStr,
            period: period,
            category: category, 
            account: account, 
            description: description || '',
        };
        
        const { error } = await supabase
            .from(targetTable).insert([payload]);

        if (error) throw error;

        showModal("Sukses", `${type} baru berhasil ditambahkan!`);
        document.getElementById('transactionForm').reset(); 

    } catch (e) {
        console.error("Error adding document: ", e);
        showModal("Gagal", `Gagal menambahkan ${type}: ${e.message}`, true);
    }
}

/** Melakukan Soft Delete Transaksi */
async function deleteTransaction(txId, txType) {
    if (!isAuthReady || !supabase) return;
    
    const targetTable = txType === 'Pengeluaran' ? 'expenses' : 'income';
    
    try {
        const { error } = await supabase
            .from(targetTable)
            .update({ is_deleted: true }) 
            .eq('id', txId)
            .eq('user_id', userId);

        if (error) throw error;
        
        showModal("Sukses", "Transaksi berhasil dihapus.");
    } catch (e) {
        console.error("Error deleting transaction: ", e);
        showModal("Gagal", `Gagal menghapus transaksi: ${e.message}`, true);
    }
}

/** Menyimpan daftar kategori saat ini ke Supabase (Upsert) */
async function saveCategories() {
    if (!isAuthReady || !supabase) return;
    
    const payload = { 
        user_id: userId,
        expense_category: currentCategories.expense,
        income_source: currentCategories.incomeSource,
        account: currentCategories.account
    };

    try {
        const { error } = await supabase
            .from('categories')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) throw error;

    } catch (e) {
        console.error("Error saving categories:", e);
    }
}


// ----------------------------------------------------------------------
// VIEW RENDERING & CONTROLS (Fungsi-fungsi ini tetap sama seperti jawaban terakhir)
// ----------------------------------------------------------------------

/** Render halaman yang diminta */
function renderPage(pageName) {
    if (!isAuthReady) {
        showAuthPage();
        return;
    }

    currentPage = pageName;
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.add('hidden');
        page.classList.remove('block');
    });

    document.getElementById(`${pageName}Page`).classList.remove('hidden');
    document.getElementById(`${pageName}Page`).classList.add('block');
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === pageName) {
            link.classList.add('active');
        }
    });

    if (pageName === 'dashboard') {
        loadDashboard(currentPeriod);
    } else if (pageName === 'transaksi') {
        renderTransactionPageTemplate();
    } else if (pageName === 'budget') {
        renderBudgetPage();
    } else if (pageName === 'pengaturan') {
        renderSettingsPage();
    }
}

/** Menghitung data dan me-render Dashboard */
function loadDashboard(period) {
    document.getElementById('currentPeriodDisplay').textContent = formatPeriod(period);
    
    const filteredTransactions = currentTransactions.filter(tx => tx.period === period);
    
    const totalIncome = filteredTransactions
        .filter(tx => tx.type === 'Pemasukan')
        .reduce((sum, tx) => sum + tx.amount, 0);

    const totalExpense = filteredTransactions
        .filter(tx => tx.type === 'Pengeluaran')
        .reduce((sum, tx) => sum + tx.amount, 0);

    const netBalance = totalIncome - totalExpense;

    document.getElementById('totalIncome').textContent = formatRupiah(totalIncome);
    document.getElementById('totalExpense').textContent = formatRupiah(totalExpense);
    document.getElementById('netBalance').textContent = formatRupiah(netBalance);
    
    const netBalanceElement = document.getElementById('netBalance');
    if (netBalance >= 0) {
        netBalanceElement.classList.remove('text-red-500');
        netBalanceElement.classList.add('text-blue-600');
    } else {
        netBalanceElement.classList.remove('text-blue-600');
        netBalanceElement.classList.add('text-red-500');
    }

    renderBudgetChart(period, filteredTransactions);
    renderExpenseChart(filteredTransactions);
    renderRecentTransactions(filteredTransactions);
}

/** Render Chart Budget vs Aktual */
function renderBudgetChart(period, transactions) {
    const budgets = currentBudgets[period] || {};
    const expenseByCategory = transactions
        .filter(tx => tx.type === 'Pengeluaran')
        .reduce((acc, tx) => {
            acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
            return acc;
        }, {});

    const data = [
        ['Kategori', 'Budget', 'Aktual']
    ];

    const allCategories = new Set([
        ...Object.keys(budgets),
        ...Object.keys(expenseByCategory)
    ]);
    
    allCategories.forEach(category => {
        const budget = budgets[category] || 0;
        const actual = expenseByCategory[category] || 0;
        if (budget > 0 || actual > 0) {
            data.push([category, budget, actual]);
        }
    });

    if (data.length <= 1) {
        document.getElementById('budgetChart').innerHTML = '<p class="text-center text-gray-500 pt-16">Tidak ada budget atau pengeluaran untuk periode ini.</p>';
        return;
    }

    const chartData = google.visualization.arrayToDataTable(data);
    const options = {
        legend: { position: 'top' },
        isStacked: false,
        vAxis: { format: 'currency' },
        colors: ['#7CD18B', '#F0939A'],
        chartArea: { width: '85%', height: '75%' }
    };

    const chart = new google.visualization.ColumnChart(document.getElementById('budgetChart'));
    chart.draw(chartData, options);
}

/** Render Chart Porsi Pengeluaran */
function renderExpenseChart(transactions) {
    const expenseByCategory = transactions
        .filter(tx => tx.type === 'Pengeluaran')
        .reduce((acc, tx) => {
            acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
            return acc;
        }, {});

    const data = [
        ['Kategori', 'Jumlah']
    ];

    Object.entries(expenseByCategory).forEach(([category, amount]) => {
        if (amount > 0) {
            data.push([category, amount]);
        }
    });
    
    if (data.length <= 1) {
        document.getElementById('expenseChart').innerHTML = '<p class="text-center text-gray-500 pt-16">Tidak ada pengeluaran untuk periode ini.</p>';
        return;
    }

    const chartData = google.visualization.arrayToDataTable(data);
    const options = {
        legend: { position: 'right', alignment: 'center' },
        pieSliceText: 'percentage',
        chartArea: { width: '100%', height: '90%' }
    };

    const chart = new google.visualization.PieChart(document.getElementById('expenseChart'));
    chart.draw(chartData, options);
}

/** Render Transaksi Terbaru di Dashboard */
function renderRecentTransactions(transactions) {
    const listContainer = document.getElementById('recentTransactionsList');
    listContainer.innerHTML = '';
    
    if (transactions.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500 text-sm">Tidak ada transaksi di bulan ini.</p>';
        return;
    }

    transactions.slice(0, 5).forEach(tx => {
        const color = tx.type === 'Pemasukan' ? 'text-green-600' : 'text-red-500';
        const sign = tx.type === 'Pemasukan' ? '+' : '-';

        const txElement = `
            <div class="flex justify-between items-center border-b pb-2">
                <div>
                    <p class="font-medium text-sm">${tx.category}</p>
                    <p class="text-xs text-gray-500">${tx.date} - ${tx.account}</p>
                </div>
                <p class="font-bold text-sm ${color}">${sign} ${formatRupiah(tx.amount)}</p>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', txElement);
    });
}

/** Render Form Transaksi & Daftar Transaksi */
function renderTransactionPageTemplate() {
    const container = document.getElementById('transactionPageContent');
    
    const formHtml = `
        <div class="bg-white p-4 rounded-lg shadow">
            <h3 class="text-lg font-semibold mb-3">Tambah Transaksi Baru</h3>
            <form id="transactionForm" class="space-y-3">
                
                <div>
                    <label for="transactionType" class="block text-sm font-medium text-gray-700">Jenis Transaksi</label>
                    <select id="transactionType" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                        <option value="Pengeluaran">Pengeluaran</option>
                        <option value="Pemasukan">Pemasukan</option>
                    </select>
                </div>

                <div>
                    <label for="transactionAmount" class="block text-sm font-medium text-gray-700">Jumlah (Rp)</label>
                    <input type="number" id="transactionAmount" required min="1"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                </div>
                
                <div>
                    <label for="transactionDate" class="block text-sm font-medium text-gray-700">Tanggal</label>
                    <input type="date" id="transactionDate" required value="${new Date().toISOString().substring(0, 10)}"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                </div>

                <div id="categoryGroup">
                    <label for="transactionCategory" class="block text-sm font-medium text-gray-700">Kategori</label>
                    <select id="transactionCategory" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                        </select>
                </div>
                
                <div>
                    <label for="transactionAccount" class="block text-sm font-medium text-gray-700">Akun</label>
                    <select id="transactionAccount" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                        ${currentCategories.account.map(acc => `<option value="${acc}">${acc}</option>`).join('')}
                    </select>
                </div>
                
                <div>
                    <label for="transactionDescription" class="block text-sm font-medium text-gray-700">Deskripsi (Opsional)</label>
                    <input type="text" id="transactionDescription"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                </div>

                <button type="submit" class="w-full bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition">
                    Simpan Transaksi
                </button>
            </form>
        </div>
        
        <div class="bg-white p-4 rounded-lg shadow">
            <h3 class="text-lg font-semibold mb-3">Riwayat Transaksi</h3>
            <div id="transactionList" class="space-y-3">
            </div>
        </div>
    `;
    
    container.innerHTML = formHtml;
    
    document.getElementById('transactionForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('transactionType').value;
        const amount = document.getElementById('transactionAmount').value;
        const date = document.getElementById('transactionDate').value;
        const category = document.getElementById('transactionCategory').value;
        const account = document.getElementById('transactionAccount').value;
        const description = document.getElementById('transactionDescription').value;
        
        saveTransaction(type, amount, date, category, account, description);
    });
    
    document.getElementById('transactionType').addEventListener('change', renderCategoryOptions);
    
    renderCategoryOptions();
    renderTransactionsList();
}

/** Mengisi Opsi Kategori berdasarkan Tipe Transaksi */
function renderCategoryOptions() {
    const type = document.getElementById('transactionType').value;
    const select = document.getElementById('transactionCategory');
    
    const categories = type === 'Pengeluaran' ? currentCategories.expense : currentCategories.incomeSource;
    const label = type === 'Pengeluaran' ? 'Kategori Pengeluaran' : 'Sumber Pemasukan';
    
    document.querySelector('#categoryGroup label').textContent = label;
    select.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

/** Render Daftar Riwayat Transaksi */
function renderTransactionsList() {
    const listContainer = document.getElementById('transactionList');
    listContainer.innerHTML = '';
    
    if (currentTransactions.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500 text-sm text-center pt-8">Belum ada transaksi yang tercatat.</p>';
        return;
    }

    currentTransactions.forEach(tx => {
        const color = tx.type === 'Pemasukan' ? 'text-green-600' : 'text-red-500';
        const bgColor = tx.type === 'Pemasukan' ? 'bg-green-50' : 'bg-red-50';
        const sign = tx.type === 'Pemasukan' ? '+' : '-';
        const dateDisplay = new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

        const txElement = `
            <div class="flex justify-between items-center p-3 rounded-md ${bgColor} border border-gray-100">
                <div class="flex-grow">
                    <p class="font-semibold text-sm">${tx.category} <span class="text-xs font-normal text-gray-500 ml-1">(${tx.account})</span></p>
                    <p class="text-xs text-gray-600">${dateDisplay} - ${tx.description || '-'}</p>
                </div>
                <div class="text-right flex items-center space-x-2">
                    <p class="font-bold text-sm ${color} whitespace-nowrap">${sign} ${formatRupiah(tx.amount)}</p>
                    <button onclick="deleteTransaction('${tx.id}', '${tx.type}')" 
                            class="delete-btn text-red-400 hover:text-red-600 transition p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', txElement);
    });
    
    window.deleteTransaction = deleteTransaction;
}

/** Render Halaman Budget */
function renderBudgetPage() {
    const container = document.getElementById('budgetPageContent');
    const categories = currentCategories.expense; 
    const currentBudget = currentBudgets[currentPeriod] || {};

    const headerHtml = `
        <div class="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm mb-4">
            <button id="prevBudgetPeriod" class="text-gray-600 hover:text-green-600 transition">&lt;</button>
            <h2 id="currentBudgetPeriodDisplay" class="text-lg font-semibold text-gray-800">${formatPeriod(currentPeriod)}</h2>
            <button id="nextBudgetPeriod" class="text-gray-600 hover:text-green-600 transition">&gt;</button>
        </div>
        <div class="bg-white p-4 rounded-lg shadow">
            <h3 class="text-lg font-semibold mb-4">Atur Batas Budget Bulanan</h3>
            <form id="budgetForm" class="space-y-3">
    `;
    
    let formHtml = categories.map(category => `
        <div class="flex items-center space-x-3">
            <label for="budget-${category}" class="block text-sm font-medium text-gray-700 w-1/2">${category}</label>
            <input type="number" id="budget-${category}" name="${category}" min="0" placeholder="0" 
                   value="${currentBudget[category] || ''}"
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-right">
        </div>
    `).join('');

    const footerHtml = `
                <button type="submit" class="w-full bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition mt-4">
                    Simpan Budget
                </button>
            </form>
        </div>
    `;
    
    container.innerHTML = headerHtml + formHtml + footerHtml;
    
    document.getElementById('prevBudgetPeriod').onclick = () => updatePeriod(-1);
    document.getElementById('nextBudgetPeriod').onclick = () => updatePeriod(1);
    
    document.getElementById('budgetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedPeriod = currentPeriod;
        
        const newBudgets = {}; 
        document.getElementById('budgetForm').querySelectorAll('input[type="number"]').forEach(input => {
            const category = input.name;
            const limit = parseFloat(input.value) || 0;
            if (limit > 0) { 
                newBudgets[category] = limit;
            }
        });

        const budgetsToUpsert = Object.entries(newBudgets).map(([category, limit]) => ({
            user_id: userId,
            period: selectedPeriod,
            category: category,
            limit: limit
        }));

        try {
            await supabase
                .from('budget_by_category')
                .delete()
                .eq('user_id', userId)
                .eq('period', selectedPeriod);

            if (budgetsToUpsert.length > 0) {
                const { error } = await supabase
                    .from('budget_by_category')
                    .insert(budgetsToUpsert);
                
                if (error) throw error;
            }
            
            showModal("Sukses", `Budget untuk ${formatPeriod(selectedPeriod)} berhasil disimpan!`);
        } catch (error) {
            console.error("Error saving budget:", error);
            showModal("Gagal", `Gagal menyimpan budget: ${error.message}`, true);
        }
    });
}

/** Render Halaman Pengaturan */
function renderSettingsPage() {
    renderCategoryList('expenseCategoryList', currentCategories.expense, 'expense');
    renderCategoryList('incomeSourceList', currentCategories.incomeSource, 'incomeSource');
    renderCategoryList('accountList', currentCategories.account, 'account');
    
    document.getElementById('addExpenseCategoryForm').onsubmit = (e) => handleAddCategory(e, 'expense', 'newExpenseCategory');
    document.getElementById('addIncomeSourceForm').onsubmit = (e) => handleAddCategory(e, 'incomeSource', 'newIncomeSource');
    document.getElementById('addAccountForm').onsubmit = (e) => handleAddCategory(e, 'account', 'newAccount');
    
    window.deleteCategory = deleteCategory;
}

/** Helper untuk render daftar kategori */
function renderCategoryList(containerId, list, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    list.forEach(item => {
        const itemHtml = `
            <div class="flex justify-between items-center border-b pb-1 text-sm">
                <span>${item}</span>
                <button onclick="deleteCategory('${item}', '${type}')" class="text-red-400 hover:text-red-600 transition">Hapus</button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHtml);
    });
    if (list.length === 0) {
         container.innerHTML = '<p class="text-gray-500 text-sm">Belum ada item ditambahkan.</p>';
    }
}

/** Handler untuk menambahkan kategori baru */
function handleAddCategory(e, type, inputId) {
    e.preventDefault();
    const input = document.getElementById(inputId);
    const newItem = input.value.trim();
    
    if (newItem && !currentCategories[type].includes(newItem)) {
        currentCategories[type].push(newItem);
        saveCategories(); 
        renderSettingsPage(); 
        input.value = '';
    }
}

/** Handler untuk menghapus kategori */
function deleteCategory(item, type) {
    currentCategories[type] = currentCategories[type].filter(i => i !== item);
    saveCategories(); 
    renderSettingsPage(); 
}

/** Navigasi Periode */
function updatePeriod(offset) {
    const [year, month] = currentPeriod.split('-').map(Number);
    const date = new Date(year, month - 1);
    
    date.setMonth(date.getMonth() + offset);
    
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    
    currentPeriod = `${newYear}-${newMonth}`;
    
    if (currentPage === 'dashboard') {
        loadDashboard(currentPeriod);
    } else if (currentPage === 'budget') {
        renderBudgetPage();
    }
}


// ----------------------------------------------------------------------
// EVENT LISTENERS & INVOCATION
// ----------------------------------------------------------------------

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Setup Navigasi Menu
    document.querySelectorAll('.nav-link').forEach(button => {
        button.addEventListener('click', (e) => {
            renderPage(e.target.getAttribute('data-page'));
        });
    });
    
    // Setup Listener Modal
    document.getElementById('modalCloseButton').addEventListener('click', () => {
        document.getElementById('modal').classList.add('hidden');
        document.getElementById('modal').classList.remove('flex');
    });

    // Setup Listener Dashboard Navigation
    document.getElementById('prevPeriod').onclick = () => updatePeriod(-1);
    document.getElementById('nextPeriod').onclick = () => updatePeriod(1);
    
    // Setup Listener Auth Form
    document.getElementById('authForm').addEventListener('submit', handleAuthFormSubmit);
    
    // Setup Listener untuk toggle Login/Register
    document.getElementById('authToggleButton').addEventListener('click', (e) => {
        e.preventDefault();
        isSigningUp = !isSigningUp;
        updateAuthUI();
    });
    
    // Setup Listener untuk Tombol Logout
    document.getElementById('logoutButton').addEventListener('click', handleLogout);

    // Tambahkan listener untuk merespon perubahan ukuran window (untuk chart)
    window.addEventListener('resize', () => {
        if (currentPage === 'dashboard' && isAuthReady) {
            loadDashboard(currentPeriod);
        }
    });

    // Mulai inisialisasi Supabase
    initializeSupabase();
});
