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

// --- تشغيل الدوال الأساسية عند تحميل الصفحة ---
document.addEventListener('DOMContentLoaded', () => {
  checkUser();
  
  document.querySelectorAll('.filter').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProducts(btn.dataset.cat);
    };
  });
});

// --- 1. التحقق من الحساب وعرض الاسم الحقيقي والشارة وزر لوحة التحكم للأدمن ---
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

      if (user.id === ADMIN_UID || currentProfile?.role === 'admin') {
        roleBadge = '👑 أدمن';
        adminDashboardBtn = `<a href="admin.html" style="background: #20a4ff; color: #fff; padding: 6px 12px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px; margin-left: 5px;">⚙️ لوحة التحكم</a>`;
      } else if (currentProfile?.role === 'moderator') {
        roleBadge = '🛡️ مشرف';
      } else if (currentProfile?.role === 'technician') {
        roleBadge = '🔧 مهندس';
      }

      const displayName = currentProfile?.full_name || user.user_metadata?.full_name || 'أحمد مصطفى';
      const authContainer = authBtn.parentElement;
      
      if (authContainer) {
        authContainer.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            ${adminDashboardBtn}
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
// --- 7. نظام الشات المطور ---
// ==========================================

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
    
    const pageTitleElem = document.getElementById('chatPageTitle');
    if (pageTitleElem) pageTitleElem.innerText = 'محادثات الدعم الفني (لوحة الإدارة والمشرفين والمهندسين)';

    await loadChatUsersList();
  } else {
    const chatUsersList = document.getElementById('chatUsersList');
    if (chatUsersList) chatUsersList.style.display = 'none';
    
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) chatContainer.style.gridTemplateColumns = '1fr';
    
    const pageTitleElem = document.getElementById('chatPageTitle');
    if (pageTitleElem) pageTitleElem.innerText = 'الدعم الفني المباشر (محادثتك مع الإدارة)';

    activeChatUserId = ADMIN_UID; 
    await loadChatMessages();
    listenToNewMessages();
  }
}

async function loadChatUsersList() {
  const container = document.getElementById('usersListContainer');
  if (!container) return;

  const { data: profiles, error } = await _supabase
    .from('profiles')
    .select('*')
    .neq('id', ADMIN_UID)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading profiles:', error);
    container.innerHTML = '<p style="color:#e63946; text-align:center; padding:10px;">خطأ في جلب العملاء</p>';
    return;
  }

  if (profiles && profiles.length > 0) {
    container.innerHTML = profiles.map(p => {
      let realName = (p.full_name && p.full_name.trim() !== '') ? p.full_name : 'مستخدم بدون اسم';
      let phoneNum = (p.phone && p.phone.trim() !== '') ? p.phone : 'رقم غير مسجل';

      return `
        <div class="user-item" id="user-item-${p.id}" onclick="selectChatUser('${p.id}', '${escapeHtml(realName)}')">
          <div style="font-weight: bold; font-size: 14px; color: #ffffff; margin-bottom: 3px;">👤 ${escapeHtml(realName)}</div>
          <div style="font-size: 12px; color: #20a4ff;">📞 ${escapeHtml(phoneNum)}</div>
        </div>
      `;
    }).join('');

    if (!activeChatUserId && profiles.length > 0) {
      selectChatUser(profiles[0].id, profiles[0].full_name);
    }
  } else {
    container.innerHTML = '<p style="color:#8fa7ba; text-align:center; padding:10px;">لا يوجد عملاء متاحين حالياً</p>';
  }
}

async function selectChatUser(userId, userName) {
  activeChatUserId = userId;
  document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
  const selectedItem = document.getElementById(`user-item-${userId}`);
  if (selectedItem) selectedItem.classList.add('active');

  await loadChatMessages();
  listenToNewMessages();
}

async function loadChatMessages() {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return;
  if (!activeChatUserId) return;

  const isStaff = currentUser.id === ADMIN_UID || currentProfile?.role === 'admin' || currentProfile?.role === 'moderator' || currentProfile?.role === 'technician';

  let query = _supabase.from('messages').select('*');
  
  if (isStaff) {
    query = query.or(`and(sender_id.eq.${activeChatUserId}),and(recipient_id.eq.${activeChatUserId})`);
  } else {
    query = query.or(`and(sender_id.eq.${currentUser.id}),and(recipient_id.eq.${currentUser.id})`);
  }

  const { data: messages, error } = await query.order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading messages:', error);
    messagesContainer.innerHTML = '<p style="text-align:center; color:#e63946; padding:20px;">خطأ في تحميل المحادثة.</p>';
    return;
  }

  if (!messages || messages.length === 0) {
    messagesContainer.innerHTML = '<p style="text-align:center; color:#8fa7ba; padding:20px;">لا توجد رسائل حتى الآن. أرسل رسالة للبدء.</p>';
    return;
  }

  const uniqueMessages = Array.from(new Map(messages.map(m => [m.id, m])).values());
  uniqueMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const { data: profiles } = await _supabase.from('profiles').select('id, full_name, role');
  const profileMap = {};
  if (profiles) {
    profiles.forEach(p => { profileMap[p.id] = p; });
  }

  messagesContainer.innerHTML = uniqueMessages.map(m => {
    let isMe = m.sender_id === currentUser.id;
    let senderProfile = profileMap[m.sender_id] || {};
    let senderRole = senderProfile.role;
    let senderName = senderProfile.full_name || 'مستخدم';

    let roleBadgeHtml = '';
    let displayTitle = isMe ? 'أنت' : senderName;

    let targetRole = senderRole;
    if (m.sender_id === ADMIN_UID) targetRole = 'admin';

    if (targetRole === 'admin') {
      roleBadgeHtml = '<span style="font-size: 11px; background: #e63946; color: #fff; padding: 2px 6px; border-radius: 4px; margin-right: 6px;">👑 أدمن</span>';
    } else if (targetRole === 'moderator') {
      roleBadgeHtml = '<span style="font-size: 11px; background: #2a9d8f; color: #fff; padding: 2px 6px; border-radius: 4px; margin-right: 6px;">🛡️ مشرف</span>';
    } else if (targetRole === 'technician') {
      roleBadgeHtml = '<span style="font-size: 11px; background: #168fe0; color: #fff; padding: 2px 6px; border-radius: 4px; margin-right: 6px;">🔧 مهندس</span>';
    } else {
      roleBadgeHtml = '<span style="font-size: 11px; background: #475569; color: #fff; padding: 2px 6px; border-radius: 4px; margin-right: 6px;">👤 مستخدم</span>';
    }

    const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="msg ${isMe ? 'me' : 'other'}" style="display: flex; flex-direction: column;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <strong style="font-size: 12px; color: ${isMe ? '#eef6ff' : '#20a4ff'};">
            ${escapeHtml(displayTitle)} ${roleBadgeHtml}
          </strong>
        </div>
        <div style="font-size: 14px; word-break: break-word;">${escapeHtml(m.content)}</div>
        <div style="font-size: 10px; opacity: 0.7; align-self: flex-end; margin-top: 4px;">${timeStr}</div>
      </div>
    `;
  }).join('');

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('msgInput');
  if (!input) return;

  const content = input.value.trim();
  if (!content) return showToast('⚠️ نص الرسالة فارغ');

  if (!currentUser) {
    showToast('⚠️ يجب تسجيل الدخول أولاً');
    return;
  }

  const isStaff = currentUser.id === ADMIN_UID || currentProfile?.role === 'admin' || currentProfile?.role === 'moderator' || currentProfile?.role === 'technician';
  let recipientId = ADMIN_UID;
  let senderId = currentUser.id;

  if (isStaff) {
    if (!activeChatUserId) {
      showToast('⚠️ يرجى اختيار عميل من القائمة أولاً');
      return;
    }
    recipientId = activeChatUserId;
    senderId = currentUser.id; 
  } else {
    recipientId = ADMIN_UID;
    senderId = currentUser.id;
  }

  const { error } = await _supabase.from('messages').insert([
    {
      sender_id: senderId,
      recipient_id: recipientId,
      content: content,
      created_at: new Date().toISOString()
    }
  ]);

  if (error) {
    console.error('Error sending message:', error);
    showToast('❌ فشل إرسال الرسالة: ' + error.message);
  } else {
    input.value = '';
    loadChatMessages();
  }
}

function listenToNewMessages() {
  if (messageSubscription) _supabase.removeChannel(messageSubscription);

  messageSubscription = _supabase.channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const newMsg = payload.new;
      const isStaff = currentUser.id === ADMIN_UID || currentProfile?.role === 'admin' || currentProfile?.role === 'moderator' || currentProfile?.role === 'technician';

      if (isStaff) {
        if (newMsg.sender_id === activeChatUserId || newMsg.recipient_id === activeChatUserId) {
          loadChatMessages();
        }
      } else {
        if (newMsg.sender_id === currentUser.id || newMsg.recipient_id === currentUser.id) {
          loadChatMessages();
        }
      }
    }).subscribe();
}

// ==========================================
// --- 8. قسم الشروحات والملفات والبرامج ---
// ==========================================

// دالة تحويل روابط يوتيوب العادية إلى روابط Embed لتعرض الفيديو مباشرة على المنصة
function getYoutubeEmbedUrl(url) {
  if (!url) return null;
  let videoId = '';
  if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0];
  } else if (url.includes('watch?v=')) {
    videoId = url.split('watch?v=')[1]?.split('&')[0];
  } else if (url.includes('embed/')) {
    videoId = url.split('embed/')[1]?.split('?')[0];
  }
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

// عرض صفحة الشروحات والملفات للزوار والمستخدمين
async function renderExplanationsPage() {
  const grid = document.getElementById('explanationsGrid');
  if (!grid) return;

  const { data: explanations, error } = await _supabase
    .from('explanations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching explanations:', error);
    grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: #e63946; padding: 20px;">خطأ في تحميل الشروحات والملفات.</p>';
    return;
  }

  const searchInput = document.getElementById('explanationSearchInput');
  let filtered = explanations || [];

  if (searchInput && searchInput.value.trim() !== '') {
    const term = searchInput.value.trim().toLowerCase();
    filtered = filtered.filter(item => {
      const titleMatch = item.title && item.title.toLowerCase().includes(term);
      const descMatch = item.description && item.description.toLowerCase().includes(term);
      return titleMatch || descMatch;
    });
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: #8fa7ba; padding: 20px;">لا توجد شروحات أو ملفات تطابق بحثك حالياً.</p>';
    return;
  }

  grid.innerHTML = filtered.map(item => {
    let embedUrl = getYoutubeEmbedUrl(item.youtube_url);
    
    return `
      <article class="card" style="background: #1c2541; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: 15px;">
        <div>
          ${embedUrl ? `
            <div style="position: relative; width: 100%; height: 200px; margin-bottom: 12px; border-radius: 8px; overflow: hidden;">
              <iframe src="${embedUrl}" style="width: 100%; height: 100%; border:0;" allowfullscreen></iframe>
            </div>
          ` : item.image_url ? `
            <div style="height: 160px; margin-bottom: 12px; border-radius: 8px; overflow: hidden; background: #071522;">
              <img src="${item.image_url}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
          ` : ''}

          <h3 style="color: #ffffff; font-size: 18px; margin-bottom: 10px; border-bottom: 2px solid #0077b6; padding-bottom: 6px;">${escapeHtml(item.title)}</h3>
          <p style="color: #c9d8e8; font-size: 14px; line-height: 1.6; margin-bottom: 15px; white-space: pre-line;">${escapeHtml(item.description || '')}</p>
        </div>

        <div>
          ${item.file_url ? `
            <a href="${item.file_url}" target="_blank" class="btn primary full" style="display: block; text-align: center; text-decoration: none; padding: 10px; background: #2a9d8f; color: #fff; border-radius: 8px; font-weight: bold; margin-top: 10px;">
              📥 تحميل الملف أو البرنامج المرتبط
            </a>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function filterExplanationsSearch() {
  renderExplanationsPage();
}

// حفظ أو تحديث شرح / ملف / فيديو في لوحة التحكم
async function saveExplanation() {
  const editId = document.getElementById('editExplanationId').value;
  const title = document.getElementById('eTitle').value.trim();
  const desc = document.getElementById('eDesc').value.trim();
  const youtubeUrl = document.getElementById('eYoutubeUrl').value.trim();
  const fileUrl = document.getElementById('eFileUrl').value.trim();
  const fileInput = document.getElementById('eImageFile');

  if (!title) {
    showToast('⚠️ يرجى إدخال عنوان الشرح أو الملف');
    return;
  }

  let imageUrl = null;
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    showToast('⏳ جاري رفع الصورة المصغرة...');
    imageUrl = await uploadImage(fileInput.files[0]);
  }

  const payload = {
    title: title,
    description: desc,
    youtube_url: youtubeUrl,
    file_url: fileUrl
  };
  if (imageUrl) payload.image_url = imageUrl;

  if (editId) {
    const { error } = await _supabase.from('explanations').update(payload).eq('id', editId);
    if (error) {
      showToast('❌ خطأ في التعديل: ' + error.message);
    } else {
      showToast('✅ تم تعديل الشرح بنجاح!');
      resetExplanationForm();
      loadAdminExplanations();
    }
  } else {
    const { error } = await _supabase.from('explanations').insert([payload]);
    if (error) {
      showToast('❌ خطأ في إضافة الشرح: ' + error.message);
    } else {
      showToast('✅ تم نشر الشرح / الملف بنجاح!');
      resetExplanationForm();
      loadAdminExplanations();
    }
  }
}

async function loadAdminExplanations() {
  const list = document.getElementById('adminExplanationsList');
  if (!list) return;

  const { data: explanations } = await _supabase.from('explanations').select('*').order('created_at', { ascending: false });

  if (!explanations || explanations.length === 0) {
    list.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#8fa7ba;">لا توجد شروحات مضافة حالياً.</td></tr>';
    return;
  }

  list.innerHTML = explanations.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.title)}</strong></td>
      <td>${item.youtube_url ? '<span style="color: #42d6a0;">✅ يتوفر فيديو</span>' : '<span style="color: #8fa7ba;">لا يوجد</span>'}</td>
      <td>${item.file_url ? '<a href="' + item.file_url + '" target="_blank" style="color: #20a4ff;">🔗 رابط الملف</a>' : '<span style="color: #8fa7ba;">لا يوجد</span>'}</td>
      <td>
        <button onclick="editExplanation('${item.id}', '${escapeHtml(item.title)}', '${escapeHtml(item.description || '')}', '${escapeHtml(item.youtube_url || '')}', '${escapeHtml(item.file_url || '')}')" style="background:#168fe0; color:#fff; border:none; padding:4px 8px; border-radius:6px; cursor:pointer;">✏️ تعديل</button>
        <button onclick="deleteExplanation('${item.id}')" style="background:#e63946; color:#fff; border:none; padding:4px 8px; border-radius:6px; cursor:pointer;">🗑️ حذف</button>
      </td>
    </tr>
  `).join('');
}

function editExplanation(id, title, desc, youtubeUrl, fileUrl) {
  document.getElementById('editExplanationId').value = id;
  document.getElementById('eTitle').value = title;
  document.getElementById('eDesc').value = desc;
  document.getElementById('eYoutubeUrl').value = youtubeUrl;
  document.getElementById('eFileUrl').value = fileUrl;
  document.getElementById('explanationFormTitle').innerText = '✏️ تعديل الشرح أو الملف';
  document.getElementById('cancelExplanationEditBtn').style.display = 'inline-block';
  window.scrollTo({ top: document.getElementById('explanationFormTitle').offsetTop - 100, behavior: 'smooth' });
}

function resetExplanationForm() {
  document.getElementById('editExplanationId').value = '';
  document.getElementById('eTitle').value = '';
  document.getElementById('eDesc').value = '';
  document.getElementById('eYoutubeUrl').value = '';
  document.getElementById('eFileUrl').value = '';
  document.getElementById('eImageFile').value = '';
  document.getElementById('explanationFormTitle').innerText = '💡 إضافة شرح أو ملف / برنامج جديد';
  document.getElementById('cancelExplanationEditBtn').style.display = 'none';
}

async function deleteExplanation(id) {
  if (!confirm('هل أنت متأكد من حذف هذا الشرح أو الملف؟')) return;
  const { error } = await _supabase.from('explanations').delete().eq('id', id);
  if (error) {
    showToast('❌ خطأ في الحذف: ' + error.message);
  } else {
    showToast('✅ تم حذف الشرح بنجاح');
    loadAdminExplanations();
  }
}

// --- 9. منشورات المنتدى والبحث فيها ---
async function submitPost() {
  if (!currentUser) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return showToast('⚠️ يجب تسجيل الدخول أولاً');
    currentUser = user;
  }

  if (!currentProfile && currentUser) {
    const { data: profile } = await _supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profile) currentProfile = profile;
  }

  if (currentProfile?.is_banned) return showToast('🚫 حسابك محظور من المشاركة');

  const textEl = document.getElementById('postText');
  if (!textEl) return showToast('⚠️ حقل النص غير موجود في الصفحة');
  
  const text = textEl.value.trim();
  const fileInput = document.getElementById('postImgFile');
  
  if (!text) return showToast('يرجى كتابة محتوى المنشور');

  let imageUrl = null;
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    showToast('⏳ جاري رفع الصورة...');
    imageUrl = await uploadImage(fileInput.files[0]);
  }

  const authorName = currentProfile?.full_name || currentUser.user_metadata?.full_name || 'أحمد مصطفى';
  
  showToast('⏳ جاري نشر المنشور...');
  const { error } = await _supabase.from('posts').insert([{
    user_id: currentUser.id, 
    author_name: authorName, 
    content: text, 
    image_url: imageUrl, 
    likes_count: 0,
    created_at: new Date()
  }]);

  if (error) {
    showToast('❌ خطأ أثناء النشر: ' + error.message);
  } else {
    showToast('✅ تم النشر بنجاح!');
    textEl.value = '';
    if (fileInput) fileInput.value = '';
    renderPublicPosts();
  }
}

async function renderPublicPosts() {
  const container = document.getElementById('publicPosts');
  if (!container) return;

  const { data: posts, error } = await _supabase.from('posts').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching posts:', error);
    return;
  }

  if (!posts || posts.length === 0) {
    container.innerHTML = '<p style="color:#8fa7ba; text-align:center; padding:20px;">لا توجد مشاركات حتى الآن.</p>';
    return;
  }

  const searchInput = document.getElementById('postSearchInput');
  let filteredPosts = posts;

  if (searchInput && searchInput.value.trim() !== '') {
    const searchTerm = searchInput.value.trim().toLowerCase();
    filteredPosts = posts.filter(p => {
      const authorMatch = p.author_name && p.author_name.toLowerCase().includes(searchTerm);
      const contentMatch = p.content && p.content.toLowerCase().includes(searchTerm);
      return authorMatch || contentMatch;
    });
  }

  if (filteredPosts.length === 0) {
    container.innerHTML = '<p style="color:#8fa7ba; text-align:center; padding:20px;">لا توجد منشورات تطابق بحثك.</p>';
    return;
  }

  const canDelete = currentUser && (currentUser.id === ADMIN_UID || currentProfile?.role === 'admin' || currentProfile?.role === 'moderator' || currentProfile?.role === 'technician');

  container.innerHTML = filteredPosts.map(p => `
    <div class="post" style="background: #0b192c; border: 1px solid #1e3a5f; border-radius: 14px; padding: 15px; margin-bottom: 25px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 10px;">
        <div style="color:#20a4ff; font-weight:bold; font-size:15px;">👤 ${escapeHtml(p.author_name || 'مستخدم')}</div>
        ${canDelete ? `<button onclick="deletePost('${p.id}')" style="background:#e63946; color:#fff; border:none; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:12px;">🗑️ حذف</button>` : ''}
      </div>
      <p style="margin:10px 0; color: #ffffff; font-size: 15px; line-height: 1.5;">${escapeHtml(p.content)}</p>
      ${p.image_url ? `<div style="text-align:center;"><img src="${p.image_url}" style="max-width:100%; max-height:400px; border-radius:10px; margin-top:10px; object-fit: contain;"></div>` : ''}
      
      <div style="display: flex; gap: 15px; margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05);">
        <button onclick="toggleLike('${p.id}')" style="background: rgba(32, 164, 255, 0.1); border: 1px solid rgba(32, 164, 255, 0.2); color: #20a4ff; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 13px; display: flex; align-items: center; gap: 5px;">
          ❤️ اعجاب (<span id="likes-count-${p.id}">${p.likes_count || 0}</span>)
        </button>
        <button onclick="toggleCommentsSection('${p.id}')" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #c9d8e8; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 13px; display: flex; align-items: center; gap: 5px;">
          💬 تعليق
        </button>
      </div>

      <div id="comments-section-${p.id}" style="display: none; margin-top: 12px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
        <div id="comments-list-${p.id}" style="margin-bottom: 10px; font-size: 13px; color: #cbd5e1;">جاري تحميل التعليقات...</div>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="comment-input-${p.id}" placeholder="اكتب تعليقاً..." style="flex: 1; background: #071522; border: 1px solid #1e3a5f; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 13px;">
          <button onclick="addComment('${p.id}')" style="background: #20a4ff; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;">إرسال</button>
        </div>
      </div>
    </div>
  `).join('');
}

function filterPostsSearch() {
  renderPublicPosts();
}

async function toggleLike(postId) {
  const countSpan = document.getElementById(`likes-count-${postId}`);
  if (!countSpan) return;
  let currentLikes = parseInt(countSpan.textContent) || 0;
  currentLikes += 1;
  countSpan.textContent = currentLikes;
  await _supabase.from('posts').update({ likes_count: currentLikes }).eq('id', postId);
}

async function toggleCommentsSection(postId) {
  const section = document.getElementById(`comments-section-${postId}`);
  if (!section) return;
  if (section.style.display === 'none') {
    section.style.display = 'block';
    loadComments(postId);
  } else {
    section.style.display = 'none';
  }
}

async function loadComments(postId) {
  const listContainer = document.getElementById(`comments-list-${postId}`);
  if (!listContainer) return;

  const { data: comments } = await _supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
  
  if (!comments || comments.length === 0) {
    listContainer.innerHTML = '<div style="color: #8fa7ba; font-size: 12px; text-align: center;">لا توجد تعليقات حتى الآن.</div>';
    return;
  }

  listContainer.innerHTML = comments.map(c => `
    <div style="background: rgba(255,255,255,0.03); padding: 6px 10px; border-radius: 6px; margin-bottom: 6px;">
      <strong style="color: #20a4ff; font-size: 12px;">${escapeHtml(c.author_name)}:</strong>
      <span style="font-size: 13px; color: #fff; margin-right: 5px;">${escapeHtml(c.content)}</span>
    </div>
  `).join('');
}

async function addComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input) return;
  const content = input.value.trim();
  if (!content) return showToast('⚠️ يرجى كتابة نص التعليق');

  if (!currentUser) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return showToast('⚠️ يجب تسجيل الدخول أولاً');
    currentUser = user;
  }

  if (!currentProfile && currentUser) {
    const { data: profile } = await _supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profile) currentProfile = profile;
  }

  const authorName = currentProfile?.full_name || currentUser.user_metadata?.full_name || 'أحمد مصطفى';

  const { error } = await _supabase.from('comments').insert([{
    post_id: postId,
    user_id: currentUser.id,
    author_name: authorName,
    content: content,
    created_at: new Date()
  }]);

  if (error) {
    showToast('❌ خطأ في إرسال التعليق');
  } else {
    input.value = '';
    loadComments(postId);
    showToast('✅ تم إضافة التعليق');
  }
}

async function deletePost(postId) {
  if (!confirm('هل تريد حذف المنشور؟')) return;
  await _supabase.from('posts').delete().eq('id', postId);
  showToast('✅ تم حذف المنشور');
  renderPublicPosts();
}

// --- 10. المنتجات والبحث فيها ---
async function renderProducts(cat = 'all') {
  if (cat !== undefined) currentCategory = cat;
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  let query = _supabase.from('products').select('*');
  if (currentCategory !== 'all') {
    query = query.eq('category', currentCategory);
  }
  
  const { data: products, error } = await query;
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }

  const searchInput = document.getElementById('productSearchInput');
  let filteredProducts = products || [];

  if (searchInput && searchInput.value.trim() !== '') {
    const searchTerm = searchInput.value.trim().toLowerCase();
    filteredProducts = filteredProducts.filter(p => {
      const nameMatch = p.name && p.name.toLowerCase().includes(searchTerm);
      const descMatch = p.description && p.description.toLowerCase().includes(searchTerm);
      const priceMatch = p.price && p.price.toLowerCase().includes(searchTerm);
      return nameMatch || descMatch || priceMatch;
    });
  }

  if (filteredProducts.length === 0) {
    grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: #8fa7ba; padding: 20px;">لا توجد منتجات تطابق بحثك.</p>';
    return;
  }

  grid.innerHTML = filteredProducts.map(p => `
    <article class="card">
      <div style="height:150px; display:grid; place-items:center; background:#071522; font-size:50px; border-radius:12px; overflow:hidden;">
        ${p.image_url ? `<img src="${p.image_url}" style="width:100%; height:100%; object-fit:cover;">` : (p.icon || '📦')}
      </div>
      <h3 style="margin:10px 0 5px;">${escapeHtml(p.name)}</h3>
      <p style="color:#42d6a0; font-weight:bold; margin-bottom:5px;">${escapeHtml(p.price)}</p>
      ${p.description ? `<p style="font-size:13px; color:#c9d8e8; margin-bottom:10px;">${escapeHtml(p.description)}</p>` : ''}
      <a class="btn primary full" href="chat.html">طلب / استفسار</a>
    </article>
  `).join('');
}

function filterProductsSearch() {
  renderProducts();
}

async function saveProduct() {
  const editId = document.getElementById('editProductId').value;
  const name = document.getElementById('pName').value.trim();
  const category = document.getElementById('pCategory').value;
  const price = document.getElementById('pPrice').value.trim();
  const desc = document.getElementById('pDesc').value.trim();
  const fileInput = document.getElementById('pImageFile');

  if (!name || !price) {
    showToast('⚠️ يرجى ملء اسم المنتج والسعر');
    return;
  }

  let imageUrl = null;
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    showToast('⏳ جاري رفع الصورة...');
    imageUrl = await uploadImage(fileInput.files[0]);
  }

  if (editId) {
    const updateData = { name, category, price, description: desc };
    if (imageUrl) updateData.image_url = imageUrl;
    
    const { error } = await _supabase.from('products').update(updateData).eq('id', editId);
    if (error) {
      showToast('❌ خطأ في التعديل: ' + error.message);
    } else {
      showToast('✅ تم التعديل بنجاح!');
      resetProductForm();
      loadAdminProducts();
    }
  } else {
    const { error } = await _supabase.from('products').insert([{ 
      name: name, category: category, price: price, description: desc, image_url: imageUrl 
    }]);

    if (error) {
      showToast('❌ خطأ في الإضافة: ' + error.message);
    } else {
      showToast('✅ تم إضافة المنتج بنجاح!');
      resetProductForm();
      loadAdminProducts();
    }
  }
}

async function loadAdminProducts() {
  const list = document.getElementById('adminProductsList');
  if (!list) return;

  const { data: products } = await _supabase.from('products').select('*').order('created_at', { ascending: false });

  list.innerHTML = (products || []).map(p => `
    <tr>
      <td>${p.image_url ? `<img src="${p.image_url}" style="width:40px; height:40px; object-fit:cover; border-radius:6px;">` : '📦'}</td>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${escapeHtml(p.category)}</td>
      <td>${escapeHtml(p.price)}</td>
      <td>
        <button onclick="editProduct('${p.id}', '${escapeHtml(p.name)}', '${p.category}', '${escapeHtml(p.price)}', '${escapeHtml(p.description || '')}')" style="background:#168fe0; color:#fff; border:none; padding:4px 8px; border-radius:6px; cursor:pointer;">✏️ تعديل</button>
        <button onclick="deleteProduct('${p.id}')" style="background:#e63946; color:#fff; border:none; padding:4px 8px; border-radius:6px; cursor:pointer;">🗑️ حذف</button>
      </td>
    </tr>
  `).join('');
}

function editProduct(id, name, cat, price, desc) {
  document.getElementById('editProductId').value = id;
  document.getElementById('pName').value = name;
  document.getElementById('pCategory').value = cat;
  document.getElementById('pPrice').value = price;
  document.getElementById('pDesc').value = desc;
  document.getElementById('productFormTitle').innerText = '✏️ تعديل المنتج';
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
}

function resetProductForm() {
  document.getElementById('editProductId').value = '';
  document.getElementById('pName').value = '';
  document.getElementById('pPrice').value = '';
  document.getElementById('pDesc').value = '';
  document.getElementById('pImageFile').value = '';
  document.getElementById('productFormTitle').innerText = '➕ إضافة منتج جديد';
  document.getElementById('cancelEditBtn').style.display = 'none';
}

async function deleteProduct(id) {
  if (!confirm('هل تريد حذف المنتج؟')) return;
  await _supabase.from('products').delete().eq('id', id);
  showToast('✅ تم حذف المنتج');
  loadAdminProducts();
}

async function loadAdminUsers() {
  const tableBody = document.getElementById('usersTableBody');
  if (!tableBody) return;

  const { data: profiles } = await _supabase.from('profiles').select('*').order('created_at', { ascending: false });

  tableBody.innerHTML = (profiles || []).map(u => {
    const isBanned = u.is_banned || false;
    const isMainAdmin = u.id === ADMIN_UID;

    return `
      <tr>
        <td><strong>${escapeHtml(u.full_name || 'بدون اسم')}</strong></td>
        <td>${escapeHtml(u.phone || 'غير مدخل')}</td>
        <td>
          <select class="select-role" onchange="updateUserRole('${u.id}', this.value)" ${isMainAdmin ? 'disabled' : ''}>
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>👤 مستخدم عادي</option>
            <option value="technician" ${u.role === 'technician' ? 'selected' : ''}>🔧 مهندس</option>
            <option value="moderator" ${u.role === 'moderator' ? 'selected' : ''}>🛡️ مشرف</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>👑 أدمن</option>
          </select>
        </td>
        <td><span style="color: ${isBanned ? '#e63946' : '#42d6a0'}; font-weight: bold;">${isBanned ? '🚫 محظور' : '✅ نشط'}</span></td>
        <td>
          ${isMainAdmin ? '<span style="color:#8fa7ba; font-size:12px;">الحساب الرئيسي</span>' : `
            <button class="${isBanned ? 'btn-unban' : 'btn-ban'}" onclick="toggleUserBan('${u.id}', ${isBanned})">
              ${isBanned ? 'إلغاء الحظر' : 'حظر الحساب'}
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

async function updateUserRole(userId, newRole) {
  showToast('⏳ جاري تحديث الرتبة...');
  const { data, error } = await _supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) {
    showToast('❌ فشل تغيير الرتبة: ' + error.message);
    console.error('Update Role Error:', error);
    loadAdminUsers();
  } else {
    showToast('✅ تم تغيير الرتبة بنجاح في قاعدة البيانات');
    loadAdminUsers();
  }
}

async function toggleUserBan(userId, currentBanState) {
  const { error } = await _supabase.from('profiles').update({ is_banned: !currentBanState }).eq('id', userId);
  
  if (error) {
    showToast('❌ خطأ في تنفيذ الحظر: ' + error.message);
  } else {
    showToast(!currentBanState ? '🚫 تم حظر الحساب' : '✅ تم إلغاء الحظر');
    loadAdminUsers();
  }
}

async function loadAdminData() {
  await loadAdminUsers();
  await loadAdminProducts();
  await loadAdminExplanations();
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
