# 📚 考研学习助手

一款专为考研学子打造的桌面学习规划应用，帮助你高效备考，科学管理学习时间。

## ✨ 功能特性

### 🎯 核心功能

- **学习规划** - 每日任务管理，支持拖拽排序，AI 智能生成学习计划
- **番茄钟** - 专注计时器，支持白噪音（雨声、森林、海浪等），快捷键控制
- **考试倒计时** - 多个倒计时管理，支持子目标设置，自定义背景图
- **学习统计** - 可视化数据分析，学习目标设定，成就徽章系统
- **每日复盘** - 记录每天学习心得，回顾学习历程
- **错题本** - 记录错题，分类管理，复习追踪
- **AI 答疑** - 接入 AI 大模型，随时解答学习问题

### 🎨 界面特性

- 三种主题切换：深夜模式、白天模式、护眼模式
- 可折叠侧边栏导航
- 响应式布局设计
- 流畅的动画效果

### 🔧 其他功能

- 多用户管理（管理员/普通用户）
- 科目管理与颜色标记
- 学习数据导出（CSV 格式）
- 学习计划模板（基础/强化/冲刺阶段）
- 系统通知提醒

## 🛠️ 技术栈

- **前端**: React 18 + TypeScript + Vite + TailwindCSS
- **后端**: Tauri 2.0 + Rust
- **数据库**: MySQL
- **图表**: Recharts
- **拖拽**: @dnd-kit
- **AI**: 硅基流动 API (SiliconFlow)

## 📦 安装使用

### 方式一：下载安装包

从 [Releases](https://github.com/lsmx0/study-planner/releases) 下载最新版本的安装包：
- `考研学习助手_x.x.x_x64-setup.exe` - Windows 安装程序

### 方式二：从源码构建

```bash
# 克隆仓库
git clone https://github.com/lsmx0/study-planner.git
cd study-planner

# 安装依赖
npm install

# 开发模式运行
npm run tauri dev

# 构建安装包
npm run tauri build
```

## ⚙️ 数据库配置

应用需要连接 MySQL 数据库，请确保：

1. MySQL 服务已启动
2. 创建数据库并导入 `database/init.sql`
3. 在 `src-tauri/src/db/mod.rs` 中配置数据库连接信息

## 📸 功能截图

### 主页仪表盘
- 快捷操作入口
- 倒计时预览
- 番茄钟快速启动
- 励志语录

### 学习规划
- 日历选择
- 任务列表（支持拖拽排序）
- AI 智能规划
- 内容检查
- 学习偏好设置

### 番茄钟
- 可视化计时器
- 白噪音背景音
- 快捷键支持（空格开始/暂停，Esc取消）
- 历史记录

### 学习统计
- 学习时长分布
- 完成率趋势
- 成就徽章
- 数据导出

## 🎮 快捷键

| 快捷键 | 功能 |
|--------|------|
| `空格` | 开始/暂停番茄钟 |
| `Esc` | 取消当前计时 |

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 开源协议

MIT License

## 🙏 致谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [React](https://react.dev/) - 前端框架
- [TailwindCSS](https://tailwindcss.com/) - CSS 框架
- [硅基流动](https://siliconflow.cn/) - AI API 服务

---

**考研加油，你一定行！** 💪
