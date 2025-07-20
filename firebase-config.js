// Firebase配置
// 注意：在实际部署时，您需要替换为自己的Firebase项目配置
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project-id.firebaseapp.com",
    databaseURL: "https://your-project-id.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// 初始化Firebase
firebase.initializeApp(firebaseConfig);

// 导出Firebase服务实例
const auth = firebase.auth();
const database = firebase.database();

// 默认管理员账户设置
// 注意：这只是一个示例，实际应用中应该通过Firebase控制台设置管理员账户
const DEFAULT_ADMIN_EMAIL = "admin@example.com";
const DEFAULT_ADMIN_PASSWORD = "admin123";

// 检查是否需要创建默认管理员账户
async function setupDefaultAdmin() {
    try {
        // 检查管理员配置是否存在
        const adminConfigRef = database.ref('config/admin');
        const snapshot = await adminConfigRef.once('value');
        
        if (!snapshot.exists()) {
            console.log("初始化管理员配置...");
            
            // 创建默认管理员账户
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(
                    DEFAULT_ADMIN_EMAIL, 
                    DEFAULT_ADMIN_PASSWORD
                );
                
                // 设置管理员角色
                await database.ref('admins/' + userCredential.user.uid).set({
                    email: DEFAULT_ADMIN_EMAIL,
                    role: 'admin',
                    createdAt: new Date().toISOString()
                });
                
                // 保存管理员配置
                await adminConfigRef.set({
                    initialized: true,
                    initializedAt: new Date().toISOString()
                });
                
                console.log("默认管理员账户已创建");
                alert("默认管理员账户已创建\n邮箱: " + DEFAULT_ADMIN_EMAIL + "\n密码: " + DEFAULT_ADMIN_PASSWORD + "\n请立即登录并修改密码！");
            } catch (error) {
                console.error("创建默认管理员账户失败:", error);
                
                // 如果是因为账户已存在，则不显示错误
                if (error.code !== 'auth/email-already-in-use') {
                    alert("创建默认管理员账户失败: " + error.message);
                }
            }
        }
    } catch (error) {
        console.error("检查管理员配置失败:", error);
    }
}

// 在页面加载时设置默认管理员账户
document.addEventListener('DOMContentLoaded', setupDefaultAdmin);