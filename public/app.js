const SERVER_URL = "https://sumy.onrender.com";

const socket = io(SERVER_URL, {
    transports: ['websocket']
});

let currentUser = null;
let myGroups = [];
let currentGroupId = null;

window._joinOpen = {};
window._membersOpen = {};
window._searchResults = [];

socket.on('yeni-mesaj', (msg) => {
    console.log("Yeni mesaj alındı: ", msg);
    addMessage(msg);
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                window.sendMessage();
            }
        });
    }
});

window.loadUser = async function() {
    const res = await fetch(`${SERVER_URL}/me`);
    const data = await res.json();
    if (!data.basarili) { window.location.href = '/welcome'; return; }
    currentUser = data.kullanici;
};

window.addMessage = function(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    const isMe = msg.nickname === currentUser.nickname;
    div.style.cssText = 'padding:4px 0;';
    div.innerHTML = `
        <span style="font-size:13px;font-weight:bold;color:${isMe ? '#a855f7' : '#3b82f6'};">${msg.nickname}: </span>
        <span style="font-size:14px;color:white;">${msg.message}</span>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
};

window.loadGroups = async function() {
    const res = await fetch(`${SERVER_URL}/groups`);
    const all = await res.json();
    myGroups = all.filter(g => g.members.includes(currentUser.nickname));
    renderGroups();
};

window.renderGroups = function() {
    const container = document.getElementById('group-list');
    container.innerHTML = '';
    myGroups.forEach(group => renderGroupItem(group, container, true));
};

window.renderGroupItem = function(group, container, isMember) {
    const div = document.createElement('div');
    div.id = 'gi-' + group.id;
    div.style.width = '100%';

    const joinOpen = window._joinOpen[group.id];
    const membersOpen = window._membersOpen[group.id];

    let joinArea = '';
    if (joinOpen) {
        if (!isMember) {
            joinArea = `
                ${group.password ? `<input id="jp-${group.id}" type="password" placeholder="Şifre" style="width:100%;padding:6px;border-radius:6px;border:none;background:#ffffff20;color:white;margin-top:4px;" />` : ''}
                <button onclick="joinGroup('${group.id}')" style="width:100%;margin-top:4px;padding:6px;background:#ffffff20;border-radius:6px;font-size:13px;">Katıl</button>
            `;
        } else {
            joinArea = `<button onclick="openChat('${group.id}')" style="width:100%;margin-top:4px;padding:6px;background:#ffffff20;border-radius:6px;font-size:13px;">Sohbete Gir</button>`;
        }
    }

    let membersArea = '';
    if (membersOpen) {
        membersArea = `
            <div style="border-top:1px solid #ffffff30;margin:4px 0;"></div>
            ${group.members.map(m => `<div style="padding:4px 8px;font-size:13px;color:#ffffff80;">👤 ${m}</div>`).join('')}
        `;
    }

    div.innerHTML = `
        <div style="display:flex;align-items:center;padding:8px;border-radius:8px;gap:6px;" onmouseover="this.style.background='#ffffff10'" onmouseout="this.style.background='none'">
            <span style="flex:1;font-size:14px;cursor:pointer;" onclick="toggleJoin('${group.id}',${isMember})">${group.name}</span>
            <span style="font-size:11px;color:#ffffff60;">${group.id}</span>
            <span onclick="toggleMembersPanel('${group.id}',${isMember})" style="font-size:11px;color:#ffffff60;cursor:pointer;padding:2px 6px;">▼</span>
        </div>
        <div style="padding:0 8px;">${joinArea}</div>
        <div style="padding:0 8px;">${membersArea}</div>
    `;
    container.appendChild(div);
};

window.toggleJoin = function(groupId, isMember) {
    window._joinOpen[groupId] = !window._joinOpen[groupId];
    refreshItem(groupId, isMember);
};

window.toggleMembersPanel = function(groupId, isMember) {
    window._membersOpen[groupId] = !window._membersOpen[groupId];
    refreshItem(groupId, isMember);
};

window.refreshItem = function(groupId, isMember) {
    const allGroups = [...myGroups, ...window._searchResults];
    const group = allGroups.find(g => g.id === groupId);
    if (!group) return;
    const existing = document.getElementById('gi-' + groupId);
    if (!existing) return;
    const parent = existing.parentNode;
    existing.remove();
    renderGroupItem(group, parent, isMember);
};

document.getElementById('group-search').addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const val = e.target.value.trim().toUpperCase();
    const container = document.getElementById('search-results');
    container.innerHTML = '';
    if (!val) return;

    const res = await fetch(`${SERVER_URL}/groups`);
    const all = await res.json();
    window._searchResults = all.filter(g => g.id.includes(val) || g.name.toUpperCase().includes(val));
    window._searchResults.forEach(group => renderGroupItem(group, container, group.members.includes(currentUser.nickname)));
});

window.joinGroup = async function(groupId) {
    const passInput = document.getElementById('jp-' + groupId);
    const password = passInput ? passInput.value : null;
    const res = await fetch(`${SERVER_URL}/join-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, password, nickname: currentUser.nickname })
    });
    const data = await res.json();
    if (data.basarili) {
        window._joinOpen[groupId] = false;
        document.getElementById('group-search').value = '';
        document.getElementById('search-results').innerHTML = '';
        window._searchResults = [];
        loadGroups();
    } else {
        alert(data.hata);
    }
};

window.openChat = async function(groupId) {
    document.getElementById('left-menu').classList.add('hidden');
    currentGroupId = groupId;
    const group = myGroups.find(g => g.id === groupId);

    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    document.getElementById('chat-header').innerHTML = group 
        ? `${group.name} <span style="font-size: 13px; color: #ffffff50; margin-left: 8px; ">${group.id}</span>` 
        : groupId;
        
    const res = await fetch(`${SERVER_URL}/mesajlar/${encodeURIComponent(groupId)}`);
    const messages = await res.json();
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    messages.forEach(msg => addMessage(msg));

    socket.emit('join-group', groupId);
};

window.sendMessage = async function() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message || !currentGroupId) return;
    input.value = '';

    await fetch(`${SERVER_URL}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: currentGroupId, message })
    });
};

window.toggleLeft = function() { document.getElementById('left-menu').classList.toggle('hidden'); };
window.showCreateGroup = function() { document.getElementById('create-group-modal').style.display = 'flex'; };
window.hideCreateGroup = function() { document.getElementById('create-group-modal').style.display = 'none'; };

window.createGroup = async function() {
    const name = document.getElementById('group-name').value.trim();
    const password = document.getElementById('group-password').value.trim();
    if (!name) { alert('Grup adı boş olamaz'); return; }

    const res = await fetch(`${SERVER_URL}/create-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password: password || null })
    });

    const data = await res.json();
    if (data.basarili) {
        await fetch(`${SERVER_URL}/join-group`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId: data.group.id, nickname: currentUser.nickname })
        });
        hideCreateGroup();
        document.getElementById('group-name').value = '';
        document.getElementById('group-password').value = '';
        loadGroups();
    }
};

loadUser().then(() => loadGroups());