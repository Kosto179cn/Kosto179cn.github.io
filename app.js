// 应用状态
const appState = {
    currentUser: null,
    currentPage: 'dashboard',
    users: [],
    onlineUsers: [],
    blacklist: [],
    whitelist: [],
    logs: [],
    pagination: {
        users: { current: 1, total: 1, perPage: 10 },
        blacklist: { current: 1, total: 1, perPage: 10 },
        whitelist: { current: 1, total: 1, perPage: 10 },
        logs: { current: 1, total: 1, perPage: 20 }
    },
    charts: {
        featureUsage: null
    }
};

// DOM元素引用
const domElements = {
    // 页面容器
    loginPage: document.getElementById('loginPage'),
    dashboardPage: document.getElementById('dashboardPage'),
    usersPage: document.getElementById('usersPage'),
    blacklistPage: document.getElementById('blacklistPage'),
    whitelistPage: document.getElementById('whitelistPage'),
    logsPage: document.getElementById('logsPage'),
    settingsPage: document.getElementById('settingsPage'),
    
    // 登录表单
    loginForm: document.getElementById('loginForm'),
    emailInput: document.getElementById('email'),
    passwordInput: document.getElementById('password'),
    loginError: document.getElementById('loginError'),
    
    // 仪表盘
    onlineUsersCount: document.getElementById('onlineUsersCount'),
    totalUsersCount: document.getElementById('totalUsersCount'),
    vipUsersCount: document.getElementById('vipUsersCount'),
    blacklistedUsersCount: document.getElementById('blacklistedUsersCount'),
    recentUsersTable: document.getElementById('recentUsersTable'),
    featureUsageChart: document.getElementById('featureUsageChart'),
    refreshDashboard: document.getElementById('refreshDashboard'),
    
    // 用户管理
    usersTable: document.getElementById('usersTable'),
    usersPagination: document.getElementById('usersPagination'),
    userSearchInput: document.getElementById('userSearchInput'),
    userSearchBtn: document.getElementById('userSearchBtn'),
    refreshUsers: document.getElementById('refreshUsers'),
    
    // 黑名单管理
    blacklistTable: document.getElementById('blacklistTable'),
    refreshBlacklist: document.getElementById('refreshBlacklist'),
    addBlacklistForm: document.getElementById('addBlacklistForm'),
    addBlacklistBtn: document.getElementById('addBlacklistBtn'),
    
    // 白名单管理
    whitelistTable: document.getElementById('whitelistTable'),
    refreshWhitelist: document.getElementById('refreshWhitelist'),
    addWhitelistForm: document.getElementById('addWhitelistForm'),
    addWhitelistBtn: document.getElementById('addWhitelistBtn'),
    
    // 日志查看
    logsTable: document.getElementById('logsTable'),
    logsPagination: document.getElementById('logsPagination'),
    logTypeFilter: document.getElementById('logTypeFilter'),
    applyLogFilter: document.getElementById('applyLogFilter'),
    refreshLogs: document.getElementById('refreshLogs'),
    
    // 系统设置
    scriptSettingsForm: document.getElementById('scriptSettingsForm'),
    adminSettingsForm: document.getElementById('adminSettingsForm'),
    saveSettings: document.getElementById('saveSettings'),
    changePasswordBtn: document.getElementById('changePasswordBtn'),
    
    // 命令模态框
    sendCommandModal: new bootstrap.Modal(document.getElementById('sendCommandModal')),
    sendCommandForm: document.getElementById('sendCommandForm'),
    sendCommandBtn: document.getElementById('sendCommandBtn'),
    commandType: document.getElementById('commandType'),
    commandMessage: document.getElementById('commandMessage'),
    messageDuration: document.getElementById('messageDuration'),
    commandBlacklistReason: document.getElementById('commandBlacklistReason'),
    messageField: document.getElementById('messageField'),
    durationField: document.getElementById('durationField'),
    reasonField: document.getElementById('reasonField'),
    
    // 侧边栏导航
    sidebarLinks: document.querySelectorAll('.nav-link'),
    logoutBtn: document.getElementById('logoutBtn')
};

// 初始化应用
function initApp() {
    // 监听认证状态变化
    auth.onAuthStateChanged(user => {
        if (user) {
            // 用户已登录
            appState.currentUser = user;
            checkAdminRole(user.uid);
        } else {
            // 用户已登出
            appState.currentUser = null;
            showLoginPage();
        }
    });
    
    // 设置事件监听器
    setupEventListeners();
    
    // 初始化图表
    initCharts();
}

// 检查用户是否为管理员
function checkAdminRole(uid) {
    database.ref('admins/' + uid).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                // 是管理员，显示主界面
                showMainContent();
                loadDashboardData();
            } else {
                // 不是管理员，登出
                auth.signOut();
                alert('您不是管理员，无法访问此系统');
            }
        })
        .catch(error => {
            console.error('检查管理员角色失败:', error);
            auth.signOut();
            alert('检查管理员角色失败: ' + error.message);
        });
}

// 设置事件监听器
function setupEventListeners() {
    // 登录表单提交
    domElements.loginForm.addEventListener('submit', e => {
        e.preventDefault();
        handleLogin();
    });
    
    // 侧边栏导航
    domElements.sidebarLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const page = e.target.getAttribute('data-page');
            showPage(page);
        });
    });
    
    // 登出按钮
    domElements.logoutBtn.addEventListener('click', () => {
        auth.signOut();
    });
    
    // 仪表盘刷新
    domElements.refreshDashboard.addEventListener('click', loadDashboardData);
    
    // 用户管理刷新
    domElements.refreshUsers.addEventListener('click', loadUsersData);
    
    // 用户搜索
    domElements.userSearchBtn.addEventListener('click', () => {
        appState.pagination.users.current = 1;
        loadUsersData();
    });
    
    // 黑名单管理刷新
    domElements.refreshBlacklist.addEventListener('click', loadBlacklistData);
    
    // 添加黑名单
    domElements.addBlacklistBtn.addEventListener('click', addToBlacklist);
    
    // 白名单管理刷新
    domElements.refreshWhitelist.addEventListener('click', loadWhitelistData);
    
    // 添加白名单
    domElements.addWhitelistBtn.addEventListener('click', addToWhitelist);
    
    // 日志筛选
    domElements.applyLogFilter.addEventListener('click', () => {
        appState.pagination.logs.current = 1;
        loadLogsData();
    });
    
    // 日志刷新
    domElements.refreshLogs.addEventListener('click', loadLogsData);
    
    // 保存设置
    domElements.saveSettings.addEventListener('click', saveSettings);
    
    // 修改密码
    domElements.changePasswordBtn.addEventListener('click', changePassword);
    
    // 命令类型变化
    domElements.commandType.addEventListener('change', updateCommandFields);
    
    // 发送命令
    domElements.sendCommandBtn.addEventListener('click', sendCommand);
}

// 初始化图表
function initCharts() {
    // 功能使用统计图表
    const ctx = domElements.featureUsageChart.getContext('2d');
    appState.charts.featureUsage = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '功能使用次数',
                data: [],
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 显示登录页面
function showLoginPage() {
    domElements.loginPage.classList.remove('d-none');
    document.querySelectorAll('.content-page').forEach(page => {
        page.classList.add('d-none');
    });
}

// 显示主内容
function showMainContent() {
    domElements.loginPage.classList.add('d-none');
    showPage('dashboard');
}

// 显示指定页面
function showPage(page) {
    // 更新当前页面
    appState.currentPage = page;
    
    // 更新活动导航项
    domElements.sidebarLinks.forEach(link => {
        if (link.getAttribute('data-page') === page) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    // 显示对应页面
    document.querySelectorAll('.content-page').forEach(pageEl => {
        pageEl.classList.add('d-none');
    });
    
    const pageToShow = document.getElementById(page + 'Page');
    if (pageToShow) {
        pageToShow.classList.remove('d-none');
    }
    
    // 加载页面数据
    switch (page) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsersData();
            break;
        case 'blacklist':
            loadBlacklistData();
            break;
        case 'whitelist':
            loadWhitelistData();
            break;
        case 'logs':
            loadLogsData();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// 处理登录
function handleLogin() {
    const email = domElements.emailInput.value;
    const password = domElements.passwordInput.value;
    
    // 显示加载状态
    domElements.loginError.classList.add('d-none');
    domElements.loginForm.querySelector('button[type="submit"]').disabled = true;
    domElements.loginForm.querySelector('button[type="submit"]').innerHTML = 
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 登录中...';
    
    auth.signInWithEmailAndPassword(email, password)
        .then(userCredential => {
            // 登录成功，检查管理员角色
            checkAdminRole(userCredential.user.uid);
        })
        .catch(error => {
            // 登录失败
            console.error('登录失败:', error);
            domElements.loginError.textContent = error.message;
            domElements.loginError.classList.remove('d-none');
            
            // 重置登录按钮
            domElements.loginForm.querySelector('button[type="submit"]').disabled = false;
            domElements.loginForm.querySelector('button[type="submit"]').innerHTML = '登录';
        });
}

// 加载仪表盘数据
function loadDashboardData() {
    // 显示加载状态
    domElements.refreshDashboard.disabled = true;
    domElements.refreshDashboard.innerHTML = 
        '<i class="bi bi-arrow-clockwise"></i> 加载中...';
    
    // 获取在线用户数
    const onlineUsersPromise = database.ref('status').once('value')
        .then(snapshot => {
            const onlineUsers = [];
            snapshot.forEach(childSnapshot => {
                const userStatus = childSnapshot.val();
                if (userStatus.status === 'active') {
                    onlineUsers.push({
                        userId: childSnapshot.key,
                        ...userStatus
                    });
                }
            });
            appState.onlineUsers = onlineUsers;
            domElements.onlineUsersCount.textContent = onlineUsers.length;
        });
    
    // 获取总用户数
    const totalUsersPromise = database.ref('users').once('value')
        .then(snapshot => {
            const users = [];
            snapshot.forEach(childSnapshot => {
                users.push({
                    userId: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            appState.users = users;
            domElements.totalUsersCount.textContent = users.length;
            
            // 计算VIP用户数
            const vipUsers = users.filter(user => user.isVip);
            domElements.vipUsersCount.textContent = vipUsers.length;
        });
    
    // 获取黑名单用户数
    const blacklistPromise = database.ref('blacklist/users').once('value')
        .then(snapshot => {
            const blacklist = [];
            snapshot.forEach(childSnapshot => {
                if (childSnapshot.val() === true) {
                    blacklist.push(childSnapshot.key);
                }
            });
            appState.blacklist = blacklist;
            domElements.blacklistedUsersCount.textContent = blacklist.length;
        });
    
    // 获取最近活跃用户
    const recentUsersPromise = database.ref('users').orderByChild('lastSeen').limitToLast(5).once('value')
        .then(snapshot => {
            const recentUsers = [];
            snapshot.forEach(childSnapshot => {
                recentUsers.push({
                    userId: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            // 按时间降序排序
            recentUsers.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
            
            // 更新表格
            updateRecentUsersTable(recentUsers);
        });
    
    // 获取功能使用统计
    const featureUsagePromise = database.ref('logs').orderByChild('type').equalTo('feature').limitToLast(100).once('value')
        .then(snapshot => {
            const featureCounts = {};
            snapshot.forEach(childSnapshot => {
                const log = childSnapshot.val();
                if (log.feature) {
                    featureCounts[log.feature] = (featureCounts[log.feature] || 0) + 1;
                }
            });
            
            // 更新图表
            updateFeatureUsageChart(featureCounts);
        });
    
    // 所有数据加载完成后
    Promise.all([onlineUsersPromise, totalUsersPromise, blacklistPromise, recentUsersPromise, featureUsagePromise])
        .then(() => {
            // 重置刷新按钮
            domElements.refreshDashboard.disabled = false;
            domElements.refreshDashboard.innerHTML = 
                '<i class="bi bi-arrow-clockwise"></i> 刷新';
        })
        .catch(error => {
            console.error('加载仪表盘数据失败:', error);
            alert('加载仪表盘数据失败: ' + error.message);
            
            // 重置刷新按钮
            domElements.refreshDashboard.disabled = false;
            domElements.refreshDashboard.innerHTML = 
                '<i class="bi bi-arrow-clockwise"></i> 刷新';
        });
}

// 更新最近用户表格
function updateRecentUsersTable(users) {
    const tbody = domElements.recentUsersTable;
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const tr = document.createElement('tr');
        
        // 用户ID
        const userIdTd = document.createElement('td');
        userIdTd.textContent = user.userId;
        tr.appendChild(userIdTd);
        
        // 最后活跃时间
        const lastSeenTd = document.createElement('td');
        lastSeenTd.textContent = formatDate(user.lastSeen);
        tr.appendChild(lastSeenTd);
        
        // 状态
        const statusTd = document.createElement('td');
        const isOnline = appState.onlineUsers.some(u => u.userId === user.userId);
        const statusBadge = document.createElement('span');
        statusBadge.className = 'status-badge ' + (isOnline ? 'status-online' : 'status-offline');
        statusBadge.textContent = isOnline ? '在线' : '离线';
        statusTd.appendChild(statusBadge);
        tr.appendChild(statusTd);
        
        // 操作
        const actionsTd = document.createElement('td');
        const sendCommandBtn = document.createElement('button');
        sendCommandBtn.className = 'btn btn-sm btn-outline-primary';
        sendCommandBtn.innerHTML = '<i class="bi bi-send"></i>';
        sendCommandBtn.title = '发送命令';
        sendCommandBtn.addEventListener('click', () => openSendCommandModal(user.userId));
        actionsTd.appendChild(sendCommandBtn);
        tr.appendChild(actionsTd);
        
        tbody.appendChild(tr);
    });
}

// 更新功能使用图表
function updateFeatureUsageChart(featureCounts) {
    const labels = Object.keys(featureCounts);
    const data = Object.values(featureCounts);
    
    appState.charts.featureUsage.data.labels = labels;
    appState.charts.featureUsage.data.datasets[0].data = data;
    appState.charts.featureUsage.update();
}

// 加载用户数据
function loadUsersData() {
    // 显示加载状态
    domElements.refreshUsers.disabled = true;
    domElements.refreshUsers.innerHTML = 
        '<i class="bi bi-arrow-clockwise"></i> 加载中...';
    
    // 获取搜索关键词
    const searchTerm = domElements.userSearchInput.value.trim().toLowerCase();
    
    database.ref('users').once('value')
        .then(snapshot => {
            const users = [];
            snapshot.forEach(childSnapshot => {
                const user = {
                    userId: childSnapshot.key,
                    ...childSnapshot.val()
                };
                
                // 如果有关键词，进行筛选
                if (!searchTerm || 
                    user.userId.toLowerCase().includes(searchTerm) || 
                    (user.vipName && user.vipName.toLowerCase().includes(searchTerm))) {
                    users.push(user);
                }
            });
            
            // 按最后活跃时间降序排序
            users.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
            
            // 更新应用状态
            appState.users = users;
            appState.pagination.users.total = Math.ceil(users.length / appState.pagination.users.perPage);
            
            // 更新表格和分页
            updateUsersTable();
            updateUsersPagination();
            
            // 重置刷新按钮
            domElements.refreshUsers.disabled = false;
            domElements.refreshUsers.innerHTML = 
                '<i class="bi bi-arrow-clockwise"></i> 刷新';
        });
}

// 更新用户表格
function updateUsersTable() {
    const tbody = domElements.usersTable;
    tbody.innerHTML = '';
    
    // 计算当前页的用户
    const startIndex = (appState.pagination.users.current - 1) * appState.pagination.users.perPage;
    const endIndex = startIndex + appState.pagination.users.perPage;
    const pageUsers = appState.users.slice(startIndex, endIndex);
    
    // 获取在线用户信息
    database.ref('status').once('value')
        .then(snapshot => {
            const onlineUsers = {};
            snapshot.forEach(childSnapshot => {
                const userStatus = childSnapshot.val();
                if (userStatus.status === 'active') {
                    onlineUsers[childSnapshot.key] = userStatus;
                }
            });
            
            // 获取黑名单信息
            database.ref('blacklist/users').once('value')
                .then(snapshot => {
                    const blacklist = {};
                    snapshot.forEach(childSnapshot => {
                        if (childSnapshot.val() === true) {
                            blacklist[childSnapshot.key] = true;
                        }
                    });
                    
                    // 渲染用户表格
                    pageUsers.forEach(user => {
                        const tr = document.createElement('tr');
                        
                        // 用户ID
                        const userIdTd = document.createElement('td');
                        userIdTd.textContent = user.userId;
                        tr.appendChild(userIdTd);
                        
                        // 指纹
                        const fingerprintTd = document.createElement('td');
                        fingerprintTd.textContent = user.fingerprint || '未知';
                        tr.appendChild(fingerprintTd);
                        
                        // VIP状态
                        const vipTd = document.createElement('td');
                        if (user.isVip) {
                            const vipBadge = document.createElement('span');
                            vipBadge.className = 'status-badge status-vip';
                            vipBadge.textContent = 'VIP';
                            vipTd.appendChild(vipBadge);
                            
                            if (user.vipName) {
                                vipTd.appendChild(document.createTextNode(' ' + user.vipName));
                            }
                        } else {
                            vipTd.textContent = '普通用户';
                        }
                        tr.appendChild(vipTd);
                        
                        // 最后活跃时间
                        const lastSeenTd = document.createElement('td');
                        lastSeenTd.textContent = formatDate(user.lastSeen);
                        tr.appendChild(lastSeenTd);
                        
                        // 状态
                        const statusTd = document.createElement('td');
                        if (blacklist[user.userId]) {
                            const blacklistBadge = document.createElement('span');
                            blacklistBadge.className = 'status-badge status-blacklisted';
                            blacklistBadge.textContent = '黑名单';
                            statusTd.appendChild(blacklistBadge);
                        } else if (onlineUsers[user.userId]) {
                            const onlineBadge = document.createElement('span');
                            onlineBadge.className = 'status-badge status-online';
                            onlineBadge.textContent = '在线';
                            statusTd.appendChild(onlineBadge);
                        } else {
                            const offlineBadge = document.createElement('span');
                            offlineBadge.className = 'status-badge status-offline';
                            offlineBadge.textContent = '离线';
                            statusTd.appendChild(offlineBadge);
                        }
                        tr.appendChild(statusTd);
                        
                        // 操作
                        const actionsTd = document.createElement('td');
                        
                        // 发送命令按钮
                        const sendCommandBtn = document.createElement('button');
                        sendCommandBtn.className = 'btn btn-sm btn-outline-primary me-1';
                        sendCommandBtn.innerHTML = '<i class="bi bi-send"></i>';
                        sendCommandBtn.title = '发送命令';
                        sendCommandBtn.addEventListener('click', () => openSendCommandModal(user.userId));
                        actionsTd.appendChild(sendCommandBtn);
                        
                        tr.appendChild(actionsTd);
                        tbody.appendChild(tr);
                    });
                });
        });
}

// 更新用户分页
function updateUsersPagination() {
    const pagination = domElements.usersPagination;
    pagination.innerHTML = '';
    
    if (appState.pagination.users.total <= 1) {
        return;
    }
    
    // 上一页
    const prevLi = document.createElement('li');
    prevLi.className = 'page-item' + (appState.pagination.users.current === 1 ? ' disabled' : '');
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.innerHTML = '&laquo;';
    prevLink.addEventListener('click', e => {
        e.preventDefault();
        if (appState.pagination.users.current > 1) {
            appState.pagination.users.current--;
            updateUsersTable();
            updateUsersPagination();
        }
    });
    prevLi.appendChild(prevLink);
    pagination.appendChild(prevLi);
    
    // 页码
    for (let i = 1; i <= appState.pagination.users.total; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = 'page-item' + (appState.pagination.users.current === i ? ' active' : '');
        const pageLink = document.createElement('a');
        pageLink.className = 'page-link';
        pageLink.href = '#';
        pageLink.textContent = i;
        pageLink.addEventListener('click', e => {
            e.preventDefault();
            appState.pagination.users.current = i;
            updateUsersTable();
            updateUsersPagination();
        });
        pageLi.appendChild(pageLink);
        pagination.appendChild(pageLi);
    }
    
    // 下一页
    const nextLi = document.createElement('li');
    nextLi.className = 'page-item' + (appState.pagination.users.current === appState.pagination.users.total ? ' disabled' : '');
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.innerHTML = '&raquo;';
    nextLink.addEventListener('click', e => {
        e.preventDefault();
        if (appState.pagination.users.current < appState.pagination.users.total) {
            appState.pagination.users.current++;
            updateUsersTable();
            updateUsersPagination();
        }
    });
    nextLi.appendChild(nextLink);
    pagination.appendChild(nextLi);
}

// 加载黑名单数据
function loadBlacklistData() {
    // 显示加载状态
    domElements.refreshBlacklist.disabled = true;
    domElements.refreshBlacklist.innerHTML = 
        '<i class="bi bi-arrow-clockwise"></i> 加载中...';
    
    // 获取用户黑名单
    const userBlacklistPromise = database.ref('blacklist/users').once('value')
        .then(snapshot => {
            const blacklist = [];
            snapshot.forEach(childSnapshot => {
                if (childSnapshot.val() === true) {
                    blacklist.push({
                        id: childSnapshot.key,
                        type: 'userId'
                    });
                }
            });
            return blacklist;
        });
    
    // 获取指纹黑名单
    const fingerprintBlacklistPromise = database.ref('blacklist/fingerprints').once('value')
        .then(snapshot => {
            const blacklist = [];
            snapshot.forEach(childSnapshot => {
                if (childSnapshot.val() === true) {
                    blacklist.push({
                        id: childSnapshot.key,
                        type: 'fingerprint'
                    });
                }
            });
            return blacklist;
        });
    
    // 获取黑名单原因
    const blacklistReasonsPromise = database.ref('blacklist/reasons').once('value')
        .then(snapshot => {
            const reasons = {};
            snapshot.forEach(childSnapshot => {
                reasons[childSnapshot.key] = childSnapshot.val();
            });
            return reasons;
        });
    
    // 所有数据加载完成后
    Promise.all([userBlacklistPromise, fingerprintBlacklistPromise, blacklistReasonsPromise])
        .then(([userBlacklist, fingerprintBlacklist, reasons]) => {
            // 合并黑名单
            const blacklist = [...userBlacklist, ...fingerprintBlacklist];
            
            // 添加原因
            blacklist.forEach(item => {
                item.reason = reasons[item.id] || '';
                item.addedAt = reasons[item.id + '_addedAt'] || '';
            });
            
            // 按添加时间降序排序
            blacklist.sort((a, b) => {
                if (!a.addedAt) return 1;
                if (!b.addedAt) return -1;
                return new Date(b.addedAt) - new Date(a.addedAt);
            });
            
            // 更新应用状态
            appState.blacklist = blacklist;
            
            // 更新表格
            updateBlacklistTable();
            
            // 重置刷新按钮
            domElements.refreshBlacklist.disabled = false;
            domElements.refreshBlacklist.innerHTML = 
                '<i class="bi bi-arrow-clockwise"></i> 刷新';
        })
        .catch(error => {
            console.error('加载黑名单数据失败:', error);
            alert('加载黑名单数据失败: ' + error.message);
            
            // 重置刷新按钮
            domElements.refreshBlacklist.disabled = false;
            domElements.refreshBlacklist.innerHTML = 
                '<i class="bi bi-arrow-clockwise"></i> 刷新';
        });
}

// 更新黑名单表格
function updateBlacklistTable() {
    const tbody = domElements.blacklistTable;
    tbody.innerHTML = '';
    
    appState.blacklist.forEach(item => {
        const tr = document.createElement('tr');
        
        // ID/指纹
        const idTd = document.createElement('td');
        idTd.textContent = item.id;
        tr.appendChild(idTd);
        
        // 类型
        const typeTd = document.createElement('td');
        typeTd.textContent = item.type === 'userId' ? '用户ID' : '指纹';
        tr.appendChild(typeTd);
        
        // 添加时间
        const addedAtTd = document.createElement('td');
        addedAtTd.textContent = item.addedAt ? formatDate(item.addedAt) : '未知';
        tr.appendChild(addedAtTd);
        
        // 原因
        const reasonTd = document.createElement('td');
        reasonTd.textContent = item.reason || '未指定';
        tr.appendChild(reasonTd);
        
        // 操作
        const actionsTd = document.createElement('td');
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-sm btn-outline-danger';
        removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
        removeBtn.title = '移出黑名单';
        removeBtn.addEventListener('click', () => {
            if (confirm(`确定将${item.type === 'userId' ? '用户ID' : '指纹'} ${item.id} 移出黑名单吗？`)) {
                removeFromBlacklist(item.id, item.type);
            }
        });
        actionsTd.appendChild(removeBtn);
        tr.appendChild(actionsTd);
        
        tbody.appendChild(tr);
    });
}

// 添加到黑名单
function addToBlacklist() {
    const type = document.getElementById('blacklistType').value;
    const value = document.getElementById('blacklistValue').value.trim();
    const reason = document.getElementById('blacklistReason').value.trim();
    
    if (!value) {
        alert('请输入有效的值');
        return;
    }
    
    // 显示加载状态
    domElements.addBlacklistBtn.disabled = true;
    domElements.addBlacklistBtn.innerHTML = 
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 添加中...';
    
    // 添加到黑名单
    const path = type === 'userId' ? 'blacklist/users/' : 'blacklist/fingerprints/';
    database.ref(path + value).set(true)
        .then(() => {
            // 添加原因
            if (reason) {
                return database.ref('blacklist/reasons/' + value).set(reason);
            }
        })
        .then(() => {
            // 添加时间
            return database.ref('blacklist/reasons/' + value + '_addedAt').set(new Date().toISOString());
        })
        .then(() => {
            // 如果是用户ID，发送黑名单命令
            if (type === 'userId') {
                return database.ref('commands/' + value).push({
                    type: 'blacklist',
                    reason: reason || '您已被管理员加入黑名单',
                    timestamp: new Date().toISOString()
                });
            }
        })
        .then(() => {
            alert('已成功添加到黑名单');
            
            // 重置表单
            document.getElementById('blacklistValue').value = '';
            document.getElementById('blacklistReason').value = '';
            
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('addBlacklistModal'));
            modal.hide();
            
            // 重新加载黑名单数据
            loadBlacklistData();
        })
        .catch(error => {
            console.error('添加黑名单失败:', error);
            alert('添加黑名单失败: ' + error.message);
        })
        .finally(() => {
            // 重置按钮
            domElements.addBlacklistBtn.disabled = false;
            domElements.addBlacklistBtn.innerHTML = '添加';
        });
}

// 从黑名单移除
function removeFromBlacklist(id, type) {
    // 显示加载状态
    const path = type === 'userId' ? 'blacklist/users/' : 'blacklist/fingerprints/';
    
    database.ref(path + id).remove()
        .then(() => {
            // 移除原因
            return database.ref('blacklist/reasons/' + id).remove();
        })
        .then(() => {
            // 移除时间
            return database.ref('blacklist/reasons/' + id + '_addedAt').remove();
        })
        .then(() => {
            alert('已成功从黑名单移除');
            
            // 重新加载黑名单数据
            loadBlacklistData();
        })
        .catch(error => {
            console.error('移除黑名单失败:', error);
            alert('移除黑名单失败: ' + error.message);
        });
}

// 加载白名单数据
function loadWhitelistData() {
    // 显示加载状态
    domElements.refreshWhitelist.disabled = true;
    domElements.refreshWhitelist.innerHTML = 
        '<i class="bi bi-arrow-clockwise"></i> 加载中...';
    
    database.ref('users').orderByChild('isVip').equalTo(true).once('value')
        .then(snapshot => {
            const whitelist = [];
            snapshot.forEach(childSnapshot => {
                whitelist.push({
                    userId: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            // 按添加时间降序排序
            whitelist.sort((a, b) => {
                if (!a.vipAddedAt) return 1;
                if (!b.vipAddedAt) return -1;
                return new Date(b.vipAddedAt) - new Date(a.vipAddedAt);
            });
            
            // 更新应用状态
            appState.whitelist = whitelist;
            
            // 更新表格
            updateWhitelistTable();
            
            // 重置刷新按钮
            domElements.refreshWhitelist.disabled = false;
            domElements.refreshWhitelist.innerHTML = 
                '<i class="bi bi-arrow-clockwise"></i> 刷新';
        })
        .catch(error => {
            console.error('加载白名单数据失败:', error);
            alert('加载白名单数据失败: ' + error.message);
            
            // 重置刷新按钮
            domElements.refreshWhitelist.disabled = false;
            domElements.refreshWhitelist.innerHTML = 
                '<i class="bi bi-arrow-clockwise"></i> 刷新';
        });
}

// 更新白名单表格
function updateWhitelistTable() {
    const tbody = domElements.whitelistTable;
    tbody.innerHTML = '';
    
    appState.whitelist.forEach(user => {
        const tr = document.createElement('tr');
        
        // 用户ID
        const userIdTd = document.createElement('td');
        userIdTd.textContent = user.userId;
        tr.appendChild(userIdTd);
        
        // VIP名称
        const vipNameTd = document.createElement('td');
        vipNameTd.textContent = user.vipName || '未命名';
        tr.appendChild(vipNameTd);
        
        // 添加时间
        const addedAtTd = document.createElement('td');
        addedAtTd.textContent = user.vipAddedAt ? formatDate(user.vipAddedAt) : '未知';
        tr.appendChild(addedAtTd);
        
        // 最后活跃时间
        const lastSeenTd = document.createElement('td');
        lastSeenTd.textContent = formatDate(user.lastSeen);
        tr.appendChild(lastSeenTd);
        
        // 操作
        const actionsTd = document.createElement('td');
        
        // 发送命令按钮
        const sendCommandBtn = document.createElement('button');
        sendCommandBtn.className = 'btn btn-sm btn-outline-primary me-1';
        sendCommandBtn.innerHTML = '<i class="bi bi-send"></i>';
        sendCommandBtn.title = '发送命令';
        sendCommandBtn.addEventListener('click', () => openSendCommandModal(user.userId));
        actionsTd.appendChild(sendCommandBtn);
        
        // 移出白名单按钮
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-sm btn-outline-danger';
        removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
        removeBtn.title = '移出白名单';
        removeBtn.addEventListener('click', () => {
            if (confirm(`确定将用户 ${user.userId} 移出白名单吗？`)) {
                removeUserFromWhitelist(user.userId);
            }
        });
        actionsTd.appendChild(removeBtn);
        
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
    });
}

// 添加到白名单
function addToWhitelist() {
    const userId = document.getElementById('whitelistUserId').value.trim();
    const vipName = document.getElementById('whitelistVipName').value.trim();
    
    if (!userId) {
        alert('请输入有效的用户ID');
        return;
    }
    
    // 显示加载状态
    domElements.addWhitelistBtn.disabled = true;
    domElements.addWhitelistBtn.innerHTML = 
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 添加中...';
    
    // 检查用户是否存在
    database.ref('users/' + userId).once('value')
        .then(snapshot => {
            if (!snapshot.exists()) {
                throw new Error('用户不存在');
            }
            
            const userData = snapshot.val();
            
            // 更新用户数据
            return database.ref('users/' + userId).update({
                isVip: true,
                vipName: vipName,
                vipAddedAt: new Date().toISOString()
            });
        })
        .then(() => {
            // 发送通知命令
            return database.ref('commands/' + userId).push({
                type: 'message',
                message: '恭喜！您已被添加为VIP用户',
                duration: 10000,
                timestamp: new Date().toISOString()
            });
        })
        .then(() => {
            alert('已成功添加到白名单');
            
            // 重置表单
            document.getElementById('whitelistUserId').value = '';
            document.getElementById('whitelistVipName').value = '';
            
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('addWhitelistModal'));
            modal.hide();
            
            // 重新加载白名单数据
            loadWhitelistData();
        })
        .catch(error => {
            console.error('添加白名单失败:', error);
            alert('添加白名单失败: ' + error.message);
        })
        .finally(() => {
            // 重置按钮
            domElements.addWhitelistBtn.disabled = false;
            domElements.addWhitelistBtn.innerHTML = '添加';
        });
}

// 从白名单移除
function removeUserFromWhitelist(userId) {
    // 更新用户数据
    database.ref('users/' + userId).update({
        isVip: false,
        vipName: null,
        vipAddedAt: null
    })
    .then(() => {
        // 发送通知命令
        return database.ref('commands/' + userId).push({
            type: 'message',
            message: '您的VIP权限已被移除',
            duration: 10000,
            timestamp: new Date().toISOString()
        });
    })
    .then(() => {
        alert('已成功从白名单移除');
        
        // 重新加载白名单数据
        loadWhitelistData();
    })
    .catch(error => {
        console.error('移除白名单失败:', error);
        alert('移除白名单失败: ' + error.message);
    });
}

// 加载日志数据
function loadLogsData() {
    // 显示加载状态
    domElements.refreshLogs.disabled = true;
    domElements.refreshLogs.innerHTML = 
        '<i class="bi bi-arrow-clockwise"></i> 加载中...';
    
    // 获取日志类型筛选
    const logType = domElements.logTypeFilter.value;
    
    // 构建查询
    let query = database.ref('logs').orderByChild('timestamp');
    
    // 如果有类型筛选
    if (logType && logType !== 'all') {
        query = database.ref('logs').orderByChild('type').equalTo(logType);
    }
    
    // 获取日志数据
    query.limitToLast(100).once('value')
        .then(snapshot => {
            const logs = [];
            snapshot.forEach(childSnapshot => {
                logs.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            // 按时间降序排序
            logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // 更新应用状态
            appState.logs = logs;
            appState.pagination.logs.total = Math.ceil(logs.length / appState.pagination.logs.perPage);
            appState.pagination.logs.current = 1;
            
            // 更新表格和分页
            updateLogsTable();
            updateLogsPagination();
            
            // 重置刷新按钮
            domElements.refreshLogs.disabled = false;
            domElements.refreshLogs.innerHTML = 
                '<i class="bi bi-arrow-clockwise"></i> 刷新';
        })
        .catch(error => {
            console.error('加载日志数据失败:', error);
            alert('加载日志数据失败: ' + error.message);
            
            // 重置刷新按钮
            domElements.refreshLogs.disabled = false;
            domElements.refreshLogs.innerHTML = 
                '<i class="bi bi-arrow-clockwise"></i> 刷新';
        });
}

// 更新日志表格
function updateLogsTable() {
    const tbody = domElements.logsTable;
    tbody.innerHTML = '';
    
    // 计算当前页的日志
    const startIndex = (appState.pagination.logs.current - 1) * appState.pagination.logs.perPage;
    const endIndex = startIndex + appState.pagination.logs.perPage;
    const pageLogs = appState.logs.slice(startIndex, endIndex);
    
    pageLogs.forEach(log => {
        const tr = document.createElement('tr');
        
        // 时间
        const timeTd = document.createElement('td');
        timeTd.textContent = formatDate(log.timestamp);
        tr.appendChild(timeTd);
        
        // 用户ID
        const userIdTd = document.createElement('td');
        userIdTd.textContent = log.userId || '-';
        tr.appendChild(userIdTd);
        
        // 类型
        const typeTd = document.createElement('td');
        const typeBadge = document.createElement('span');
        typeBadge.className = 'badge ' + getLogTypeBadgeClass(log.type);
        typeBadge.textContent = getLogTypeText(log.type);
        typeTd.appendChild(typeBadge);
        tr.appendChild(typeTd);
        
        // 详情
        const detailsTd = document.createElement('td');
        detailsTd.textContent = getLogDetails(log);
        tr.appendChild(detailsTd);
        
        tbody.appendChild(tr);
    });
}

// 更新日志分页
function updateLogsPagination() {
    const pagination = domElements.logsPagination;
    pagination.innerHTML = '';
    
    if (appState.pagination.logs.total <= 1) {
        return;
    }
    
    // 上一页
    const prevLi = document.createElement('li');
    prevLi.className = 'page-item' + (appState.pagination.logs.current === 1 ? ' disabled' : '');
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.innerHTML = '&laquo;';
    prevLink.addEventListener('click', e => {
        e.preventDefault();
        if (appState.pagination.logs.current > 1) {
            appState.pagination.logs.current--;
            updateLogsTable();
            updateLogsPagination();
        }
    });
    prevLi.appendChild(prevLink);
    pagination.appendChild(prevLi);
    
    // 页码
    for (let i = 1; i <= appState.pagination.logs.total; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = 'page-item' + (appState.pagination.logs.current === i ? ' active' : '');
        const pageLink = document.createElement('a');
        pageLink.className = 'page-link';
        pageLink.href = '#';
        pageLink.textContent = i;
        pageLink.addEventListener('click', e => {
            e.preventDefault();
            appState.pagination.logs.current = i;
            updateLogsTable();
            updateLogsPagination();
        });
        pageLi.appendChild(pageLink);
        pagination.appendChild(pageLi);
    }
    
    // 下一页
    const nextLi = document.createElement('li');
    nextLi.className = 'page-item' + (appState.pagination.logs.current === appState.pagination.logs.total ? ' disabled' : '');
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.innerHTML = '&raquo;';
    nextLink.addEventListener('click', e => {
        e.preventDefault();
        if (appState.pagination.logs.current < appState.pagination.logs.total) {
            appState.pagination.logs.current++;
            updateLogsTable();
            updateLogsPagination();
        }
    });
    nextLi.appendChild(nextLink);
    pagination.appendChild(nextLi);
}

// 获取日志类型徽章类
function getLogTypeBadgeClass(type) {
    switch (type) {
        case 'login':
            return 'bg-primary';
        case 'logout':
            return 'bg-secondary';
        case 'error':
            return 'bg-danger';
        case 'feature':
            return 'bg-success';
        case 'command':
            return 'bg-warning text-dark';
        default:
            return 'bg-info';
    }
}

// 获取日志类型文本
function getLogTypeText(type) {
    switch (type) {
        case 'login':
            return '登录';
        case 'logout':
            return '登出';
        case 'error':
            return '错误';
        case 'feature':
            return '功能使用';
        case 'command':
            return '命令';
        default:
            return type || '未知';
    }
}

// 获取日志详情
function getLogDetails(log) {
    switch (log.type) {
        case 'login':
            return `登录成功 (${log.device || '未知设备'})`;
        case 'logout':
            return `登出系统 (${log.reason || '正常登出'})`;
        case 'error':
            return log.message || '发生错误';
        case 'feature':
            return `使用功能: ${log.feature || '未知功能'}`;
        case 'command':
            return `执行命令: ${log.command || '未知命令'}`;
        default:
            return log.message || '无详情';
        }

        // 打开发送命令模态框
        function openSendCommandModal(userId) {
            // 设置用户ID
            document.getElementById('sendCommandModal').dataset.userId = userId;
    
            // 重置表单
            domElements.commandType.value = 'message';
            domElements.commandMessage.value = '';
            domElements.messageDuration.value = '5000';
            domElements.commandBlacklistReason.value = '';
    
            // 更新字段显示
            updateCommandFields();
    
            // 显示模态框
            domElements.sendCommandModal.show();
        }

        // 更新命令字段显示
        function updateCommandFields() {
            const commandType = domElements.commandType.value;
    
            // 显示/隐藏相关字段
            domElements.messageField.classList.toggle('d-none', commandType !== 'message');
            domElements.durationField.classList.toggle('d-none', commandType !== 'message');
            domElements.reasonField.classList.toggle('d-none', commandType !== 'blacklist');
        }

        // 发送命令
        function sendCommand() {
            const userId = document.getElementById('sendCommandModal').dataset.userId;
            const type = domElements.commandType.value;
    
            if (!userId) {
                alert('无效的用户ID');
                return;
            }
    
            // 显示加载状态
            domElements.sendCommandBtn.disabled = true;
            domElements.sendCommandBtn.innerHTML = 
                '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 发送中...';
    
            // 构建命令数据
            const commandData = {
                type: type,
                timestamp: new Date().toISOString()
            };
    
            // 根据命令类型添加额外数据
            switch (type) {
                case 'message':
                    const message = domElements.commandMessage.value.trim();
                    const duration = parseInt(domElements.messageDuration.value);
            
                    if (!message) {
                        alert('请输入消息内容');
                        domElements.sendCommandBtn.disabled = false;
                        domElements.sendCommandBtn.innerHTML = '发送';
                        return;
                    }
            
                    commandData.message = message;
                    commandData.duration = duration || 5000;
                    break;
            
                case 'blacklist':
                    const reason = domElements.commandBlacklistReason.value.trim();
            
                    commandData.reason = reason || '您已被管理员加入黑名单';
                    break;
            
                case 'restart':
                    commandData.delay = 3000; // 3秒后重启
                    break;
            }
    
            // 发送命令
            database.ref('commands/' + userId).push(commandData)
                .then(() => {
                    alert('命令已成功发送');
            
                    // 关闭模态框
                    domElements.sendCommandModal.hide();
            
                    // 记录日志
                    return database.ref('logs').push({
                        type: 'command',
                        userId: userId,
                        command: type,
                        timestamp: new Date().toISOString()
                    });
                })
                .then(() => {
                    // 重新加载日志数据
                    loadLogsData();
                })
                .catch(error => {
                    console.error('发送命令失败:', error);
                    alert('发送命令失败: ' + error.message);
                })
                .finally(() => {
                    // 重置按钮
                    domElements.sendCommandBtn.disabled = false;
                    domElements.sendCommandBtn.innerHTML = '发送';
                });
        }

        // 加载设置
        function loadSettings() {
            // 加载脚本设置
            database.ref('settings/script').once('value')
                .then(snapshot => {
                    const settings = snapshot.val() || {};
            
                    // 更新表单
                    document.getElementById('scriptVersion').value = settings.version || '';
                    document.getElementById('scriptAutoUpdate').checked = settings.autoUpdate || false;
                    document.getElementById('scriptMaintenanceMode').checked = settings.maintenanceMode || false;
                });
    
            // 加载管理员设置
            database.ref('settings/admin').once('value')
                .then(snapshot => {
                    const settings = snapshot.val() || {};
            
                    // 更新表单
                    document.getElementById('adminMaxLoginAttempts').value = settings.maxLoginAttempts || 5;
                    document.getElementById('adminSessionTimeout').value = settings.sessionTimeout || 3600;
                });
        }

        // 保存设置
        function saveSettings() {
            // 显示加载状态
            domElements.saveSettings.disabled = true;
            domElements.saveSettings.innerHTML = 
                '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 保存中...';
    
            // 构建设置数据
            const scriptSettings = {
                version: document.getElementById('scriptVersion').value.trim(),
                autoUpdate: document.getElementById('scriptAutoUpdate').checked,
                maintenanceMode: document.getElementById('scriptMaintenanceMode').checked
            };
    
            const adminSettings = {
                maxLoginAttempts: parseInt(document.getElementById('adminMaxLoginAttempts').value) || 5,
                sessionTimeout: parseInt(document.getElementById('adminSessionTimeout').value) || 3600
            };
    
            // 保存设置
            Promise.all([
                database.ref('settings/script').set(scriptSettings),
                database.ref('settings/admin').set(adminSettings)
            ])
            .then(() => {
                alert('设置已成功保存');
            })
            .catch(error => {
                console.error('保存设置失败:', error);
                alert('保存设置失败: ' + error.message);
            })
            .finally(() => {
                // 重置按钮
                domElements.saveSettings.disabled = false;
                domElements.saveSettings.innerHTML = '保存';
            });
        }

        // 修改密码
        function changePassword() {
            const oldPassword = prompt('请输入当前密码:');
            if (!oldPassword) return;
    
            const newPassword = prompt('请输入新密码:');
            if (!newPassword) return;
    
            const confirmPassword = prompt('请确认新密码:');
            if (newPassword !== confirmPassword) {
                alert('两次输入的密码不一致');
                return;
            }
    
            // 显示加载状态
            domElements.changePasswordBtn.disabled = true;
            domElements.changePasswordBtn.innerHTML = 
                '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 修改中...';
    
            // 重新认证用户
            const user = auth.currentUser;
            const credential = firebase.auth.EmailAuthProvider.credential(
                user.email,
                oldPassword
            );
    
            user.reauthenticateWithCredential(credential)
                .then(() => {
                    // 更新密码
                    return user.updatePassword(newPassword);
                })
                .then(() => {
                    alert('密码已成功修改');
                })
                .catch(error => {
                    console.error('修改密码失败:', error);
                    alert('修改密码失败: ' + error.message);
                })
                .finally(() => {
                    // 重置按钮
                    domElements.changePasswordBtn.disabled = false;
                    domElements.changePasswordBtn.innerHTML = '修改密码';
                });
        }

        // 格式化日期时间
        function formatDate(timestamp) {
            if (!timestamp) return '未知';
    
            const date = new Date(timestamp);
            return date.toLocaleString();
        }

        // 启动应用
        document.addEventListener('DOMContentLoaded', () => {
            initApp();
        });
}