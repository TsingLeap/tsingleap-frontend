# 📁 项目结构说明：TsingLeap 前端

本项目为 TsingLeap 前端部分，使用 [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) 构建，UI 框架采用 [Ant Design](https://ant.design/)，路由管理使用 [React Router v6](https://reactrouter.com/en/main)。

---

## 🗂️ 项目结构总览

├── index.html                 # HTML 模板
├── src/                       # 源码目录
│   ├── main.jsx               # React 项目入口（挂载 App）
│   ├── index.css              # 全局样式
│   ├── App.jsx                # 应用主组件，负责全局路由配置
│   ├── components/            # 通用组件目录（可复用 UI 组件）
│   │   └── NavBar.jsx         # 顶部导航栏，含登录状态判断与登出按钮
│   ├── features/              # 按功能划分模块
│   │   └── users/             # 用户模块
│   │      ├── Register.jsx    # 注册页面组件（含清华邮箱验证、验证码发送）
│   │      ├── Login.jsx       # 登录页面组件（表单校验 + 登录逻辑）
│   │      └── Dashboard.jsx   # 登录后首页（显示用户信息，支持登出）
│   ├── services/              # 与后端 API 通信的模块
│   │   └── api.js             # 登录、注册、发送验证码等接口封装（含 CSRF 处理）
│   └── utils/                 # 通用工具函数目录
│       └── auth.js            # 用户信息的本地存储与登出逻辑
│
├── Nginx/                     # Nginx 相关文件
│   └── default.conf           # Nginx 配置文件
├── Dockerfile                 # Docker 配置文件
├── docker-compose.yml         # 运行整个服务
├── .env                       # 环境变量配置（如 REACT_APP_API_URL）
├── .gitignore                 # Git 忽略文件列表
├── package.json               # 项目信息、依赖和启动脚本
├── vite.config.js             # Vite 构建配置

