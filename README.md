# Todo App

基于 Vue 3 + Express + MongoDB 的全栈待办事项应用，支持用户注册/登录、邮箱验证、任务用户隔离。

## 功能

- 邮箱注册 + Resend 发送 6 位验证码
- JWT 登录认证（7 天有效期）
- 密码显示/隐藏切换
- 待办事项增删改查（用户隔离）
- 自适应 UI，登录/注册悬浮卡片

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite |
| 后端 | Express (Node.js ESM) |
| 数据库 | MongoDB |
| 认证 | JWT + bcryptjs |
| 邮件 | Resend |

## 效果截图

<table>
  <tr>
    <td align="center"><b>登录</b></td>
    <td align="center"><b>注册</b></td>
  </tr>
  <tr>
    <td><img src="assert/登录.png" width="400" /></td>
    <td><img src="assert/注册.png" width="400" /></td>
  </tr>
</table>

<table>
  <tr>
    <td align="center"><b>邮箱验证</b></td>
    <td align="center"><b>代办事项</b></td>
  </tr>
  <tr>
    <td><img src="assert/邮箱验证.png" width="400" /></td>
    <td><img src="assert/代办事项效果1.png" width="400" /></td>
  </tr>
</table>

<p align="center"><img src="assert/代办事项效果2.png" width="400" /></p>

## 快速开始

### 1. 环境变量

复制 `.env.example` 为 `.env`，填写以下配置：

```bash
VITE_API_BASE=          # 生产环境填实际域名，本地开发留空
JWT_SECRET=             # JWT 签名密钥，随机字符串
RESEND_API_KEY=         # Resend API Key (resend.com)
MONGO_URL=              # MongoDB 连接地址
DB_NAME=todo            # 数据库名
PORT=3000               # 服务端口
APP_URL=                # 应用地址
```

### 2. 本地开发

```bash
npm install
npm run dev     # 启动 Vite 前端 (localhost:5173)
npm run server  # 启动 Express 后端 (localhost:3000)
```

### 3. 生产部署

```bash
npm run start   # 构建前端 + 启动后端
```

或使用启动脚本：

```bash
./start.sh      # 自动安装依赖、构建、释放端口、启动
```

## Sealos 部署

### 1. 创建数据库

在 Sealos 应用市场中搜索 **MongoDB**，创建数据库实例。记录连接信息：

![DB数据库信息](assert/DB数据库信息.png)

### 2. 创建 Devbox

1. 在 Sealos 中创建 **Devbox** 项目
2. 选择 **Node.js** 运行环境
3. 关联 GitHub 仓库 `LLsetnow/TodoListWeb`
4. 配置环境变量（参考 `.env.example`）：
   - `JWT_SECRET` — 随机字符串
   - `RESEND_API_KEY` — Resend API Key
   - `MONGO_URL` — 步骤 1 中的 MongoDB 连接地址
   - `DB_NAME` — `todo`
   - `PORT` — `3000`
   - `APP_URL` — Devbox 分配的应用域名
5. 启动命令：`./start.sh` 或 `npm run start`
6. 对外暴露 `3000` 端口

### 3. 环境变量参考

部署到 Sealos 后，`APP_URL` 应设为 Devbox 分配的域名（如 `https://xxx.sealosbja.site`），`MONGO_URL` 使用 Sealos 内网地址（如 `mongodb://root:password@test-db-mongodb.ns-xxx.svc:27017`）。

## API 接口

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/register` | 否 | 注册（需验证码） |
| POST | `/login` | 否 | 登录 |
| POST | `/send-verify-code` | 否 | 发送邮箱验证码 |
| POST | `/delete-user` | 否 | 删除用户 |
| GET | `/fetch_tasks` | 是 | 获取任务列表 |
| POST | `/add_task` | 是 | 添加任务 |
| POST | `/delete_task` | 是 | 删除任务 |
| POST | `/toggle_complete` | 是 | 切换完成状态 |

## 项目结构

```
TodoListWeb/
├── server/
│   └── index.js      # Express 后端（含认证、API、静态文件服务）
├── src/
│   ├── App.vue       # Vue 3 单文件组件（前端全部逻辑）
│   ├── main.js       # Vue 入口
│   └── style.css     # 全局样式
├── assert/           # 效果截图
├── start.sh          # 部署启动脚本
├── .env.example      # 环境变量模板
└── vite.config.js    # Vite 配置
```
