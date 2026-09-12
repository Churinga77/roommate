# 合租生活管家

面向合租室友的生活管理 MVP。把房租水电分摊、清洁值日、公共物品和宿舍公约收进同一个空间，并用「今日待办」提醒每个人当天该处理的事。

演示房屋：梧桐里 3 室  
演示室友：阿哲、小满、老K

## 功能

- 今日待办：待付账单、值日打卡、缺货物品、未确认公约
- 费用 AA：记一笔、按人分摊、付我这份、我已收齐、最小结清建议
- 清洁值日：厨房 / 卫生间 / 客厅按周轮转，倒垃圾按天轮转，支持打卡
- 公共物品：消耗品记余量，大件标记谁在用，补货自动生成 AA 账单
- 宿舍公约：发布条款、全员确认，未确认会回到今日

数据保存在浏览器 `localStorage`，不依赖后端。双击标题「梧桐里 3 室」可重置演示数据。

## 本地打开

1. 下载或克隆本仓库
2. 用浏览器打开 `index.html`

也可以在本目录启动本地服务：

```bash
python3 -m http.server 8788
```

然后访问 `http://127.0.0.1:8788/`

## 部署到 Vercel

这是静态页面，**仓库根目录必须能直接看到 `index.html`**。

1. [vercel.com](https://vercel.com) 导入 GitHub 仓库
2. 按下面填写，不要用 Next.js：
   - Framework Preset：`Other`
   - Root Directory：如果 `index.html` 就在仓库根目录，留空；如果多套了一层 `hezu-life-housekeeper/`，填 `hezu-life-housekeeper`
   - Build Command：留空
   - Output Directory：留空
3. Deploy 完成后打开 `https://你的项目.vercel.app/`

如果出现 `404 NOT_FOUND`，几乎都是根目录套了一层文件夹。到 Vercel → Project Settings → General → Root Directory，改到包含 `index.html` 的那一层，再 Redeploy。

也可以先试这个地址是否能打开：`https://你的项目.vercel.app/hezu-life-housekeeper/`

## 上传到 GitHub

1. 在 GitHub 新建空仓库，不要勾选自动添加 README
2. **把本文件夹里的文件放到仓库根目录**，不要连着外层目录一起传
3. 在本文件夹执行：

```bash
git init
git add .
git commit -m "Add roommate housekeeper MVP"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

## 目录

```text
.
├── index.html      # 页面入口
├── css/styles.css  # 样式
├── js/app.js       # 业务逻辑
├── vercel.json     # Vercel 静态站点配置
├── README.md
└── .gitignore
```

## 说明

这是考试 / 立项用的产品初版，优先完整跑通核心路径，不做登录、支付打通和多人实时同步。
