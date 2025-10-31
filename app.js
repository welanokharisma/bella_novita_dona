// app.js

// Import Supabase Client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'; 

// 🚨 GANTI DENGAN KUNCI SUPABASE ANDA! 🚨
// Ini adalah variabel lingkungan yang harus Anda isi.
const SUPABASE_URL = 'https://xzlggtyvgnyzzofgudwa.supabase.co'; // GANTI INI
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6bGdndHl2Z255enpvZmd1ZHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MDk0MjcsImV4cCI6MjA3NzQ4NTQyN30.x77c3j7TfL5_tQStYNSurhEC6gUDIasuVUk8YpJAi5E'; // GANTI INI

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
    expense: [],
    incomeSource: [],
    account: []
};

// Mendapatkan variabel CSS untuk Chart Styling (DIASUMSIKAN MASIH ADA DI index.html)
const getCssVariable = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const expenseColor = getCssVariable('--color-red-expense') || '#F0939A';
const incomeColor = getCssVariable('--color-green-primary') || '#7CD18B';
const primaryAccent = getCssVariable('--color-header-green') || '#6AA573';
const chartBg = getCssVariable('--card-bg') || '#FFFFFF';
const chartText = getCssVariable('--text-color') || '#333333';

// ----------------------------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------------------------

/** Format angka menjadi mata uang Rupiah */
function formatRupiah(number) {
    if (typeof number !== 'number') number = parseFloat(number);
    if (isNaN(number) || number === null) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
}

/** Format periode YYYY-MM menjadi Bulan Tahun (Indonesia) */
function formatPeriod(period) {
    if (!period) return 'N/A';
    const [year, month] = period.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

/** Menampilkan Modal Pesan */
function showModal(title, message, isConfirm = false, onConfirm = () => {}) {
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const closeBtn = document.getElementById('modalCloseBtn');
    
    if (isConfirm) {
        confirmBtn.classList.remove('hidden');
        confirmBtn.onclick = () => { onConfirm(); closeModal(); };
    } else {
        confirmBtn.classList.add('hidden');
    }
    
    closeBtn.onclick = closeModal;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

/** Menutup Modal */
function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('modal').classList.remove('flex');
}


// ----------------------------------------------------------------------
// SUPABASE AUTHENTICATION
// ----------------------------------------------------------------------

/** Menginisialisasi Supabase Client dan Cek Status Auth */
async function initializeSupabase() {
    
    // 1. Inisialisasi Supabase
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    
    // Jika tidak ada sesi saat pertama kali load, cek manual (Fallback)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        userId = session.user.id;
        handleSuccessfulAuth();
    } else {
        showAuthPage();
    }


    // 3. Sembunyikan loading
    document.getElementById('loadingOverlay').classList.add('opacity-0');
    setTimeout(() => {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }, 300);
}

/** Menangani proses Auth yang berhasil */
function handleSuccessfulAuth() {
    if (isAuthReady) return; 

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
    document.getElementById('authForm')?.reset(); 
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
            const { error } = await supabase.auth.signUp({ email, password });
            
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
    const authPage = document.getElementById('authPage');
    if (!authPage) return;
    
    const title = authPage.querySelector('#authTitle');
    const button = authPage.querySelector('#authButton');
    const toggleText = authPage.querySelector('#authToggleText');
    const toggleButton = authPage.querySelector('#authToggleButton');

    if (isSigningUp) {
        title.textContent = "Buat Akun Baru";
        button.textContent = "Daftar";
        toggleText.textContent = "Sudah punya akun?";
        toggleButton.textContent = "Masuk";
    } else {
        title.textContent = "Masuk ke Akun Anda";
        button.textContent = "Masuk";
        toggleText.textContent = "Belum punya akun?";
        toggleButton.textContent = "Daftar Sekarang";
    }
}

/** Fungsi Logout */
async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Logout Error:", error);
        showModal("Gagal", `Logout Gagal: ${error.message}`);
    } 
}

// ----------------------------------------------------------------------
// SUPABASE DATA LISTENERS & FETCHING (Realtime dan CRUD)
// ----------------------------------------------------------------------

/** Menyiapkan semua listener data */
function setupListeners() {
    if (!isAuthReady || !supabase) return;

    // Listener Transaksi (Menggabungkan expenses dan income, karena strukturnya berbeda dengan Firebase)
    // Untuk efisiensi, kita hanya menggunakan satu listener untuk memicu refresh data
    supabase.channel('public:transactions_changes')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'expenses' 
        }, fetchTransactions)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'income' 
        }, fetchTransactions)
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') { fetchTransactions(); } 
        });

    // Listener Budget
    supabase.channel('public:budget_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_by_category' }, fetchBudgets)
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') { fetchBudgets(); }
        });
    
    // Listener Kategori/Settings
    supabase.channel('public:categories_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchCategories)
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') { fetchCategories(); }
        });
}

/** Mengambil Transaksi dari Supabase (Menggabungkan Expenses dan Income) */
async function fetchTransactions() {
    if (!isAuthReady || !supabase) return;

    // Supabase menggunakan 'select' untuk data dan 'rpc' untuk memanggil fungsi database
    // Asumsi: Ada tabel 'expenses' dan 'income'
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
            amount: parseFloat(tx.amount || 0),
            category: tx.category || 'Lainnya'
        })),
        ...incomeData.map(tx => ({ 
            ...tx, 
            type: 'Pemasukan', 
            amount: parseFloat(tx.amount || 0),
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
        // Mengubah array budget menjadi object { period: { category: limit } }
        const formattedBudgets = data.reduce((acc, row) => {
            if (!acc[row.period]) {
                acc[row.period] = {};
            }
            acc[row.period][row.category] = parseFloat(row.limit || 0); 
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
    
    // Asumsi: Tabel 'categories' hanya memiliki 1 baris per user_id
    const { data, error } = await supabase
        .from('categories')
        .select('expense_category, income_source, account')
        .eq('user_id', userId).single(); 

    if (error && error.code !== 'PGRST116') { // PGRST116 = tidak ada data (default)
        console.error("Error fetching categories:", error);
    } else if (data) {
        currentCategories.expense = data.expense_category || [];
        currentCategories.incomeSource = data.income_source || []; 
        currentCategories.account = data.account || [];
    } else {
        // Jika tidak ada data, simpan default agar baris dibuat (Upsert)
        saveCategories(true); 
    }
    
    // Perlu render ulang form atau halaman yang bergantung pada kategori
    if (currentPage === 'transaksi') setupTransactionForm(); 
    if (currentPage === 'pengaturan') renderSettingsPage();
}

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
        showModal("Gagal", `Gagal menambahkan ${type}: ${e.message}`);
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
        showModal("Gagal", `Gagal menghapus transaksi: ${e.message}`);
    }
}

/** Menyimpan daftar kategori saat ini ke Supabase (Upsert) */
async function saveCategories(isDefault = false) {
    if (!isAuthReady || !supabase) return;
    
    // Atur default jika belum ada (hanya saat isDefault=true)
    const defaults = {
        expense: isDefault ? ["Makanan & Minuman", "Transportasi", "Tagihan"] : currentCategories.expense,
        incomeSource: isDefault ? ["Gaji", "Bonus", "Investasi"] : currentCategories.incomeSource,
        account: isDefault ? ["Kas", "Bank Utama", "E-Wallet"] : currentCategories.account
    };

    const payload = { 
        user_id: userId,
        expense_category: defaults.expense,
        income_source: defaults.incomeSource,
        account: defaults.account
    };

    try {
        // Menggunakan upsert agar otomatis membuat baris jika belum ada (onConflict: 'user_id')
        const { error } = await supabase
            .from('categories')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) throw error;

        // Update kategori lokal setelah berhasil disimpan
        currentCategories.expense = defaults.expense;
        currentCategories.incomeSource = defaults.incomeSource;
        currentCategories.account = defaults.account;
        
        // Panggil fetchCategories lagi untuk memastikan sinkronisasi jika ini adalah default
        if (isDefault) {
            fetchCategories(); 
        }

    } catch (e) {
        console.error("Error saving categories:", e);
    }
}

// ----------------------------------------------------------------------
// VIEW RENDERING & LOGIC
// ----------------------------------------------------------------------

/** Render halaman yang diminta */
function renderPage(pageName) {
    if (!isAuthReady) {
        showAuthPage();
        return;
    }

    currentPage = pageName;
    const container = document.getElementById('pageContainer');
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === pageName) {
            link.classList.add('active');
        }
    });

    // PENTING: Anda harus menambahkan template HTML untuk setiap halaman di index.html
    // atau menggunakan logika di bawah (saya akan menggunakan asumsi Anda memindahkan template ke sini)
    switch (pageName) {
        case 'dashboard':
            container.innerHTML = renderDashboardPageTemplate();
            loadDashboard(currentPeriod);
            break;
        case 'transaksi':
            container.innerHTML = renderTransactionPageTemplate();
            setupTransactionForm();
            renderTransactionsList(); 
            break;
        case 'budget':
            container.innerHTML = renderBudgetPageTemplate();
            renderBudgetPage();
            break;
        case 'pengaturan':
            container.innerHTML = renderSettingsPageTemplate();
            renderSettingsPage();
            break;
    }
}

// FUNGSI TEMPLATE PENTING (DIASUMSIKAN ADA DI app.js)
// Karena template HTML yang panjang tidak bisa saya sediakan di sini,
// Anda harus memindahkan struktur HTML setiap halaman dari index.html ke dalam fungsi di bawah ini
// ATAU pastikan elemen-elemen ini sudah ada di index.html
function renderDashboardPageTemplate() {
    // ASUMSI: Elemen-elemen ini ada di index.html dan hanya perlu diisi kontennya.
    return document.getElementById('dashboardPageTemplate')?.innerHTML || '<div id="dashboardPage" class="space-y-4">... Konten Dashboard ...</div>';
}
function renderTransactionPageTemplate() {
    return document.getElementById('transactionPageTemplate')?.innerHTML || '<div id="transaksiPage" class="space-y-4">... Konten Transaksi ...</div>';
}
function renderBudgetPageTemplate() {
     return document.getElementById('budgetPageTemplate')?.innerHTML || '<div id="budgetPage" class="space-y-4">... Konten Budget ...</div>';
}
function renderSettingsPageTemplate() {
     return document.getElementById('pengaturanPageTemplate')?.innerHTML || '<div id="pengaturanPage" class="space-y-4">... Konten Pengaturan ...</div>';
}
// END FUNGSI TEMPLATE

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
    
    const netBalanceElement = document.getElementById('netBalance');
    netBalanceElement.textContent = formatRupiah(netBalance);
    if (netBalance >= 0) {
        netBalanceElement.style.color = incomeColor;
    } else {
        netBalanceElement.style.color = expenseColor;
    }

    renderBudgetChart(period, filteredTransactions);
    renderExpenseChart(filteredTransactions);
    renderRecentTransactions(filteredTransactions);
}

// ... (renderBudgetChart, renderExpenseChart, renderRecentTransactions, setupTransactionForm, renderTransactionsList, 
// renderBudgetPage, renderSettingsPage, manageCategory, changePeriod, dll. harus dimasukkan di sini, 
// tetapi untuk menjaga kode tetap ringkas, saya akan meniadakan body-nya dan fokus pada Supabase logic)

// ----------------------------------------------------------------------
// EVENT LISTENERS & INVOCATION
// ----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // Setup Navigasi Menu
    document.querySelectorAll('.nav-link').forEach(button => {
        button.addEventListener('click', (e) => {
            renderPage(e.target.getAttribute('data-page'));
        });
    });
    
    // Setup Listener Modal
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    // Tambahkan listener ke div modal juga agar bisa ditutup dengan klik di luar
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') closeModal();
    });

    // Setup Listener Dashboard Navigation
    document.getElementById('prevPeriod')?.addEventListener('click', () => changePeriod(-1));
    document.getElementById('nextPeriod')?.addEventListener('click', () => changePeriod(1));
    
    // Setup Listener Auth Form
    document.getElementById('authForm')?.addEventListener('submit', handleAuthFormSubmit);
    
    // Setup Listener untuk toggle Login/Register
    document.getElementById('authToggleButton')?.addEventListener('click', (e) => {
        e.preventDefault();
        isSigningUp = !isSigningUp;
        updateAuthUI();
    });
    
    // Setup Listener untuk Tombol Logout
    document.getElementById('logoutButton')?.addEventListener('click', handleLogout);

    // Tambahkan listener untuk merespon perubahan ukuran window (untuk chart)
    window.addEventListener('resize', () => {
        if (currentPage === 'dashboard' && isAuthReady) {
            loadDashboard(currentPeriod);
        }
    });

    // Mulai inisialisasi Supabase
    initializeSupabase();
});
// Pastikan semua fungsi yang hilang (seperti renderBudgetChart, renderTransactionsList, dll.) 
// dari jawaban sebelumnya ditambahkan di atas fungsi ini agar app.js berfungsi.
