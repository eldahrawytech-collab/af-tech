// بيانات الربط بـ Supabase
const SUPABASE_URL = 'https://kcwtnkibuebfzmhhzzly.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yfEafZ_h2inFrY_F6FZABg_VA4jp2oc';
const ADMIN_UID = '297a5cbc-a0b2-4ea3-a1c2-b998a56d7b44';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;
let activeChatUserId = null;
let messageSubscription = null;
let currentCategory = 'all';

// --- نظام سلة المشتريات العائمة ---
let cart = JSON.parse(localStorage.getItem('af_cart')) || [];

// --- تشغيل الدوال الأساسية عند تحميل الصفحة ---
document.addEventListener('DOMContentLoaded', () => {
  checkUser();
  updateCartUI();
  
  document.querySelectorAll('.filter').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProducts(btn.dataset.cat);
    };
  });
});

// --- 1. التحقق من الحساب وعرض الاسم الحقيقي والشارة وزر لوحة التحكم والطلبات ---
async function checkUser() {
  const { data: { user } } = await _supabase.auth.getUser();
  const authBtn = document.getElementById('authBtn');

  if (user) {
    currentUser = user;
    
    const { data: profile } = await _supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile) {
      if (profile.is_banned) {
        await _supabase.auth.signOut();
        showToast('🚫 تم حظر حسابك من قبل الإدارة.');
        setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        return;
      }
      currentProfile = profile;
    } else {
      const metaName = user.user_metadata?.full_name || 'أحمد مصطفى';
      const metaPhone = user.user_metadata?.phone || '';
      
      const newProfile = { id: user.id, full_name: metaName, phone: metaPhone, role: 'user' };
      await _supabase.from('profiles').upsert([newProfile]);
      currentProfile = newProfile;
    }

    if (authBtn) {
      let roleBadge = '👤 مستخدم';
      let adminDashboardBtn = '';
      let ordersPageBtn = '';

      // التحقق مما إذا كان المستخدم أدمن أو مشرف
      const isAdminOrMod = (user.id === ADMIN_UID || currentProfile?.role === 'admin' || currentProfile?.role === 'moderator');

      if (user.id === ADMIN_UID || currentProfile?.role === 'admin') {
        roleBadge = '👑 أدمن';
        adminDashboardBtn = `<a href="admin.html" style="background: #20a4ff; color: #fff; padding: 6px 12px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px; margin-left: 5px;">⚙️ لوحة التحكم</a>`;
      } else if (currentProfile?.role === 'moderator') {
        roleBadge = '🛡️ مشرف';
      } else if (currentProfile?.role === 'technician') {
        roleBadge = '🔧 مهندس';
      }

      // إظهار زر الطلبات للأدمن والمشرفين فقط
      if (isAdminOrMod) {
        ordersPageBtn = `<a href="orders.html" style="background: #42d6a0; color: #050c14; padding: 6px 12px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px; margin-left: 5px;">📋 الطلبات</a>`;
      }

      const displayName = currentProfile?.full_name || user.user_metadata?.full_name || 'أحمد مصطفى';
      const authContainer = authBtn.parentElement;
      
      if (authContainer) {
        authContainer.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            ${adminDashboardBtn}
            ${ordersPageBtn}
            <span style="color: #20a4ff; font-weight: bold; font-size: 14px; background: rgba(32, 164, 255, 0.1); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(32, 164, 255, 0.2);">
              ${roleBadge} | ${escapeHtml(displayName)}
            </span>
            <button onclick="handleLogout()" style="background: #e63946; color: #fff; border: none; padding: 6px 12px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: inherit; font-size: 13px;">
              تسجيل الخروج
            </button>
          </div>
        `;
      }
    }
  }
}

// --- 2. تسجيل الخروج ---
async function handleLogout() {
  await _supabase.auth.signOut();
  showToast('تم تسجيل الخروج بنجاح');
  setTimeout(() => { window.location.href = 'index.html'; }, 500);
}

// --- 3. إدارة التبويبات في صفحة التسجيل ---
function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');

  if (!loginForm || !registerForm) return;

  if (tab === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    if (tabLogin) tabLogin.classList.add('active');
    if (tabRegister) tabRegister.classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    if (tabRegister) tabRegister.classList.add('active');
    if (tabLogin) tabLogin.classList.remove('active');
  }
}

// --- 4. رفع الصور ---
async function uploadImage(file) {
  if (!file) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  const { data, error } = await _supabase.storage.from('uploads').upload(fileName, file);
  if (error) {
    console.error('Upload Error:', error);
    showToast('❌ فشل رفع الصورة: ' + error.message);
    return null;
  }
  
  const { data: publicUrlData } = _supabase.storage.from('uploads').getPublicUrl(fileName);
  return publicUrlData.publicUrl;
}

// --- 5. تسجيل حساب جديد ---
function isValidEgyptianPhone(phone) { return /^01[0125]\d{8}$/.test(phone); }
function phoneToEmail(phone) { return `${phone}@aftech.local`; }

async function handleSignUp(e) {
  if (e) e.preventDefault();

  const fullNameEl = document.getElementById('regFullName');
  const phoneEl = document.getElementById('regPhone');
  const passwordEl = document.getElementById('regPassword');

  if (!fullNameEl || !phoneEl || !passwordEl) return;

  const fullName = fullNameEl.value.trim();
  const phone = phoneEl.value.trim();
  const password = passwordEl.value;

  if (!fullName || !phone || !password) return showToast('⚠️ يرجى ملء الحقول المطلوبة');
  if (!isValidEgyptianPhone(phone)) return showToast('📱 أدخل رقم موبايل مصري صحيح');

  const generatedEmail = phoneToEmail(phone);
  const { data, error } = await _supabase.auth.signUp({
    email: generatedEmail, 
    password: password,
    options: { data: { full_name: fullName, phone: phone } }
  });

  if (error) {
    if (error.message.includes('rate limit')) {
      showToast('⚠️ تم تجاوز عدد المحاولات، يرجى الانتظار قليلاً');
    } else {
      showToast('خطأ: ' + error.message);
    }
  } else if (data.user) {
    await _supabase.from('profiles').upsert([{ id: data.user.id, full_name: fullName, phone: phone, role: 'user' }]);
    showToast('✅ تم إنشاء الحساب بنجاح!');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
  }
}

// --- 6. تسجيل الدخول ---
async function handleLogin(e) {
  if (e) e.preventDefault();

  const phoneEl = document.getElementById('loginPhone');
  const passwordEl = document.getElementById('loginPassword');

  if (!phoneEl || !passwordEl) return;

  const phone = phoneEl.value.trim();
  const password = passwordEl.value;

  if (!phone || !password) return showToast('يرجى إدخال رقم الموبايل وكلمة المرور');
  const generatedEmail = phoneToEmail(phone);

  showToast('⏳ جاري تسجيل الدخول...');

  const { data, error } = await _supabase.auth.signInWithPassword({ email: generatedEmail, password });
  
  if (error) {
    showToast('❌ رقم الموبايل أو كلمة المرور غير صحيحة');
  } else if (data.user) {
    const { data: profile } = await _supabase.from('profiles').select('is_banned').eq('id', data.user.id).single();
    
    if (profile && profile.is_banned) {
      await _supabase.auth.signOut();
      showToast('🚫 عذراً، هذا الحساب محظور من قبل الإدارة.');
      return;
    }

    showToast('✅ تم تسجيل الدخول بنجاح، جاري التحويل...');
    setTimeout(() => {
      window.location.replace('index.html');
    }, 500);
  }
}

// ==========================================
// --- نظام سلة المشتريات العائمة ---
// ==========================================

function addToCart(name, price) {
  let numericPrice = parseFloat(price.toString().replace(/[^\d.]/g, '')) || 0;
  
  let existingItem = cart.find(item => item.name === name);
  if (existingItem) {
    existingItem.qty += 1;
  } else {
    cart.push({ name: name, price: numericPrice, qty: 1 });
  }
  
  saveAndRefreshCart();
  showToast(`✅ تمت إضافة "${name}" إلى السلة`);
}

function saveAndRefreshCart() {
  localStorage.setItem('af_cart', JSON.stringify(cart));
  updateCartUI();
}

function updateCartUI() {
  const countSpan = document.getElementById('cartCount');
  const itemsContainer = document.getElementById('cartItemsContainer');
  const totalText = document.getElementById('cartTotalText');

  let totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0);
  if (countSpan) countSpan.textContent = totalItemsCount;

  if (!itemsContainer) return;

  if (cart.length === 0) {
    itemsContainer.innerHTML = '<p style="text-align:center; color:#8fa7ba; padding: 20px;">السلة فارغة حالياً</p>';
    if (totalText) totalText.textContent = 'إجمالي السعر: 0 جنيه';
    return;
  }

  let totalPrice = 0;

  itemsContainer.innerHTML = cart.map((item, index) => {
    let itemTotal = item.price * item.qty;
    totalPrice += itemTotal;

    return `
      <div class="cart-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #050c14; padding: 10px; border-radius: 8px; margin-bottom: 8px; font-size: 14px;">
        <div>
          <div style="font-weight: bold; color: #fff;">${escapeHtml(item.name)}</div>
          <div style="font-size: 12px; color: #42d6a0;">السعر: ${item.price} جنيه</div>
        </div>
        <div class="cart-actions-qty" style="display: flex; align-items: center; gap: 8px;">
          <button onclick="changeQty(${index}, -1)" style="background: #20a4ff; color: #fff; border: none; width: 25px; height: 25px; border-radius: 4px; cursor: pointer; font-weight: bold;">-</button>
          <span style="font-weight: bold; padding: 0 5px; color:#fff;">${item.qty}</span>
          <button onclick="changeQty(${index}, 1)" style="background: #20a4ff; color: #fff; border: none; width: 25px; height: 25px; border-radius: 4px; cursor: pointer; font-weight: bold;">+</button>
          <button class="danger" onclick="removeFromCart(${index})" title="حذف" style="background: #e63946; color: #fff; border: none; width: 25px; height: 25px; border-radius: 4px; cursor: pointer;">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  if (totalText) totalText.textContent = `إجمالي السعر: ${totalPrice} جنيه`;
}

function changeQty(index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }
  saveAndRefreshCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveAndRefreshCart();
}

function toggleCartModal() {
  const modal = document.getElementById('cartModal');
  if (modal) {
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
  }
}

function checkoutCart() {
  if (cart.length === 0) {
    showToast('⚠️ السلة فارغة!');
    return;
  }

  if (!currentUser) {
    showToast('⚠️ يجب تسجيل الدخول أولاً لإتمام الطلب');
    setTimeout(() => {
      window.location.href = 'auth.html';
    }, 1000);
    return;
  }

  toggleCartModal();
  openCheckoutModal();
}

function openCheckoutModal() {
  let existingModal = document.getElementById('checkoutDataModal');
  if (existingModal) {
    existingModal.remove();
  }

  const modalHtml = `
    <div class="cart-modal" id="checkoutDataModal" style="display: flex;">
      <div class="cart-content" style="max-width: 400px;">
        <div class="cart-header">
          <h3 style="margin:0; font-size:18px;">📍 بيانات الشحنة والتوصيل</h3>
          <button class="close-modal" onclick="document.getElementById('checkoutDataModal').remove()">✕</button>
        </div>
        <div style="padding: 10px 0; display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label style="font-size: 13px; color: #8fa7ba; display: block; margin-bottom: 5px;">رقم الموبايل للتواصل:</label>
            <input type="text" id="orderPhone" placeholder="01012345678" value="${currentProfile?.phone || ''}" style="width: 100%; padding: 10px; background: #050c14; border: 1px solid #1a2d42; color: #fff; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
          </div>
          <div>
            <label style="font-size: 13px; color: #8fa7ba; display: block; margin-bottom: 5px;">العنوان بالتفصيل (المحافظة، المجاورة، الشارع، الدور):</label>
            <textarea id="orderAddress" placeholder="اكتب عنوانك بالتفصيل هنا..." style="width: 100%; padding: 10px; background: #050c14; border: 1px solid #1a2d42; color: #fff; border-radius: 8px; font-size: 14px; height: 90px; box-sizing: border-box; font-family: inherit;"></textarea>
          </div>
        </div>
        <div class="cart-footer" style="margin-top: 15px;">
          <button class="btn ghost" onclick="document.getElementById('checkoutDataModal').remove()" style="padding: 6px 14px; font-size: 14px;">إلغاء</button>
          <button class="btn primary" onclick="submitFinalOrder()" style="padding: 6px 14px; font-size: 14px;">تأكيد وإرسال الطلب</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function submitFinalOrder() {
  const phoneInput = document.getElementById('orderPhone');
  const addressInput = document.getElementById('orderAddress');

  if (!phoneInput || !addressInput) return;

  const phone = phoneInput.value.trim();
  const address = addressInput.value.trim();

  if (!phone || !address) {
    showToast('⚠️ يرجى إدخال رقم الموبايل والعنوان بالتفصيل');
    return;
  }

  if (!isValidEgyptianPhone(phone)) {
    showToast('📱 يرجى إدخال رقم موبايل مصري صحيح');
    return;
  }

  showToast('⏳ جاري إرسال طلبك...');

  let totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let userName = currentProfile?.full_name || currentUser.user_metadata?.full_name || 'مستخدم';
  let accountPhone = currentProfile?.phone || currentUser.user_metadata?.phone || '';

  const orderData = {
    user_id: currentUser.id,
    user_name: userName,
    account_phone: accountPhone,
    phone: phone,
    address: address,
    items: cart,
    total: `${totalPrice} جنيه`,
    created_at: new Date().toISOString()
  };

  const { error } = await _supabase.from('orders').insert([orderData]);

  if (error) {
    console.error('Order Error:', error);
    showToast('❌ فشل إرسال الطلب: ' + error.message);
  } else {
    showToast('✅ تم إرسال طلبك بنجاح!');
    
    const modal = document.getElementById('checkoutDataModal');
    if (modal) modal.remove();
    
    cart = [];
    saveAndRefreshCart();

    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);
  }
}

async function loadAdminOrders() {
  const tableBody = document.getElementById('ordersTableBody');
  if (!tableBody) return;

  const { data: orders, error } = await _supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading orders:', error);
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#e63946; padding:20px;">خطأ في تحميل الطلبات</td></tr>';
    return;
  }

  if (!orders || orders.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#8fa7ba; padding:20px;">لا توجد طلبات مسجلة حتى الآن</td></tr>';
    return;
  }

  tableBody.innerHTML = orders.map(ord => {
    let itemsList = '';
    if (Array.isArray(ord.items)) {
      itemsList = ord.items.map(i => `• ${escapeHtml(i.name)} (${i.qty} قطعة) - ${i.price * i.qty} جنيه`).join('<br>');
    } else {
      itemsList = 'تفاصيل غير متوفرة';
    }

    const dateStr = new Date(ord.created_at).toLocaleString('ar-EG');

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px;">
        <td style="padding: 12px; color: #20a4ff; font-weight: bold;">👤 ${escapeHtml(ord.user_name)}</td>
        <td style="padding: 12px;">📞 ${escapeHtml(ord.account_phone || 'غير مسجل')}</td>
        <td style="padding: 12px; color: #42d6a0;">📱 ${escapeHtml(ord.phone)}</td>
        <td style="padding: 12px; line-height: 1.6;">${itemsList}<br><strong style="color: #20a4ff;">الإجمالي: ${escapeHtml(ord.total)}</strong></td>
        <td style="padding: 12px; max-width: 200px; word-break: break-word;">📍 ${escapeHtml(ord.address)}</td>
        <td style="padding: 12px; font-size: 12px; color: #8fa7ba;">${dateStr}</td>
        <td style="padding: 12px;">
          <button onclick="deleteOrder('${ord.id}')" style="background: #e63946; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;">🗑️ حذف</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteOrder(orderId) {
  if (!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
  const { error } = await _supabase.from('orders').delete().eq('id', orderId);
  if (error) {
    showToast('❌ فشل حذف الطلب');
  } else {
    showToast('✅ تم حذف الطلب بنجاح');
    loadAdminOrders();
  }
}

// --- نظام الشات والمحتوى والمنتجات وبقية الدوال الأخرى ---
async function initChatSystem() {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) {
    showToast('⚠️ يجب تسجيل الدخول أولاً');
    setTimeout(() => { window.location.href = 'auth.html'; }, 1000);
    return;
  }
  currentUser = user;
  const { data: profile } = await _supabase.from('profiles').select('*').eq('id', user.id).single();
  if (profile) currentProfile = profile;

  const isStaff = user.id === ADMIN_UID || currentProfile?.role === 'admin' || currentProfile?.role === 'moderator' || currentProfile?.role === 'technician';

  if (isStaff) {
    const chatUsersList = document.getElementById('chatUsersList');
    if (chatUsersList) chatUsersList.style.display = 'block';
    await loadChatUsersList();
  } else {
    const chatUsersList = document.getElementById('chatUsersList');
    if (chatUsersList) chatUsersList.style.display = 'none';
    activeChatUserId = ADMIN_UID; 
    await loadChatMessages();
    listenToNewMessages();
  }
}

async function loadChatUsersList() {
  const container = document.getElementById('usersListContainer');
  if (!container) return;
  const { data: profiles } = await _supabase.from('profiles').select('*').neq('id', ADMIN_UID).order('created_at', { ascending: false });
  if (profiles && profiles.length > 0) {
    container.innerHTML = profiles.map(p => `
      <div class="user-item" id="user-item-${p.id}" onclick="selectChatUser('${p.id}', '${escapeHtml(p.full_name || 'بدون اسم')}')">
        <div style="font-weight: bold; font-size: 14px; color: #ffffff;">👤 ${escapeHtml(p.full_name || 'بدون اسم')}</div>
        <div style="font-size: 12px; color: #20a4ff;">📞 ${escapeHtml(p.phone || 'غير مسجل')}</div>
      </div>
    `).join('');
    if (!activeChatUserId && profiles.length > 0) selectChatUser(profiles[0].id, profiles[0].full_name);
  }
}

async function selectChatUser(userId) {
  activeChatUserId = userId;
  document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
  const selectedItem = document.getElementById(`user-item-${userId}`);
  if (selectedItem) selectedItem.classList.add('active');
  await loadChatMessages();
  listenToNewMessages();
}

async function loadChatMessages() {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer || !activeChatUserId) return;
  const isStaff = currentUser.id === ADMIN_UID || currentProfile?.role === 'admin' || currentProfile?.role === 'moderator' || currentProfile?.role === 'technician';
  let query = _supabase.from('messages').select('*');
  if (isStaff) {
    query = query.or(`and(sender_id.eq.${activeChatUserId}),and(recipient_id.eq.${activeChatUserId})`);
  } else {
    query = query.or(`and(sender_id.eq.${currentUser.id}),and(recipient_id.eq.${currentUser.id})`);
  }
  const { data: messages } = await query.order('created_at', { ascending: true });
  if (!messages || messages.length === 0) {
    messagesContainer.innerHTML = '<p style="text-align:center; color:#8fa7ba; padding:20px;">لا توجد رسائل حتى الآن.</p>';
    return;
  }
  const { data: profiles } = await _supabase.from('profiles').select('id, full_name, role');
  const profileMap = {};
  if (profiles) profiles.forEach(p => { profileMap[p.id] = p; });

  messagesContainer.innerHTML = messages.map(m => {
    let isMe = m.sender_id === currentUser.id;
    let senderProfile = profileMap[m.sender_id] || {};
    return `
      <div class="msg ${isMe ? 'me' : 'other'}">
        <div style="font-size: 14px;">${escapeHtml(m.content)}</div>
      </div>
    `;
  }).join('');
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('msgInput');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  const isStaff = currentUser.id === ADMIN_UID || currentProfile?.role === 'admin' || currentProfile?.role === 'moderator' || currentProfile?.role === 'technician';
  let recipientId = isStaff ? activeChatUserId : ADMIN_UID;
  if (isStaff && !recipientId) return showToast('⚠️ اختر عميلاً');

  await _supabase.from('messages').insert([{ sender_id: currentUser.id, recipient_id: recipientId, content: content, created_at: new Date().toISOString() }]);
  input.value = '';
  loadChatMessages();
}

function listenToNewMessages() {
  if (messageSubscription) _supabase.removeChannel(messageSubscription);
  messageSubscription = _supabase.channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => { loadChatMessages(); })
    .subscribe();
}

async function renderProducts(cat = 'all') {
  if (cat !== undefined) currentCategory = cat;
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  let query = _supabase.from('products').select('*');
  if (currentCategory !== 'all') query = query.eq('category', currentCategory);
  const { data: products } = await query;
  if (!products || products.length === 0) {
    grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: #8fa7ba;">لا توجد منتجات.</p>';
    return;
  }
  grid.innerHTML = products.map(p => `
    <article class="card">
      <div style="height:150px; display:grid; place-items:center; background:#071522; font-size:50px; border-radius:12px;">${p.image_url ? `<img src="${p.image_url}" style="width:100%; height:100%; object-fit:cover;">` : (p.icon || '📦')}</div>
      <h3 style="margin:10px 0 5px;">${escapeHtml(p.name)}</h3>
      <p style="color:#42d6a0; font-weight:bold;">${escapeHtml(p.price)}</p>
      <button class="btn primary full" onclick="addToCart('${escapeHtml(p.name).replace(/'/g, "\\'")}', '${escapeHtml(p.price)}')">➕ اضف للسلة</button>
    </article>
  `).join('');
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])); }

function showToast(t) {
  const x = document.getElementById('toast');
  if (!x) return;
  x.textContent = t;
  x.style.display = 'block';
  clearTimeout(window.tt);
  window.tt = setTimeout(() => (x.style.display = 'none'), 3000);
}
