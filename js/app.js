const KEY = "roommate-housekeeper-mvp-v3";
const LEGACY_KEY = "roommate-housekeeper-mvp-v1";
const TABS = [
  { id: "home", ico: "⌂", lab: "首页" },
  { id: "money", ico: "¥", lab: "账单" },
  { id: "chore", ico: "◇", lab: "值日" },
  { id: "item", ico: "▢", lab: "物品" },
  { id: "mine", ico: "◉", lab: "我的" }
];
const CATS = ["房租", "水电", "餐饮", "日用", "其他"];
const REPORT_COLORS = ["#c45c26", "#2f6a58", "#d49a34", "#637f9a", "#9a6d86"];
const STATUS = { ok: ["充足", ""], low: ["不多了", "gold"], empty: ["用完了", "warn"] };
const GUIDE_STEPS = [
  { tab: "home", target: '[data-guide="home-expense"]', title: "从快速记账开始", body: "点击这里新增一笔开销，填写金额、谁先付和 AA 成员，系统会自动算出待支付和待收款。" },
  { tab: "money", target: '[data-guide="money-expense"]', title: "在账单页管理每笔支出", body: "这里可以新增账单、确认付款，并查看本月总支出、我已支付、待支付和待收款。" },
  { tab: "chore", target: '[data-guide="chore-add"]', title: "先新增一项值日任务", body: "设置清洁事项、频率、日期和参与成员；保存后会自动生成日历排班，完成时上传照片打卡。" },
  { tab: "item", target: '[data-guide="item-add"]', title: "把公共物品先登记进来", body: "添加时选择电器或消耗品：电器记录使用与归还，消耗品记录库存和补货提醒。" },
  { tab: "mine", target: '[data-guide="room-manage"]', title: "房间资料和成员在这里管理", body: "点击“我的房间”补全地址和邀请码；房间成员也在这里添加、编辑或移除。" },
  { tab: "mine", target: '[data-guide="room-rules"]', title: "用房间公约提前说清规则", body: "点击这里发布公约，例如清洁边界、公共区域使用规则；室友可逐条阅读并确认。" }
];
let state = load() || emptyState();
let tab = "home";
let moneyView = "bills";
let reportMonth = month();
let guideStep = 0;
let itemView = "list";
let mineView = "overview";
let homeView = "main";
let choreView = "main";
let calendarCursor = new Date(`${today()}T12:00:00`);
let selectedChoreDate = today();
let selectedItemId = "";

function uid(prefix) { return `${prefix}${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`; }
function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function month() { return today().slice(0, 7); }
function shiftMonth(value, offset) {
  const date = new Date(`${value}-01T12:00:00`);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(value) {
  const [year, currentMonth] = value.split("-");
  return `${year} 年 ${Number(currentMonth)} 月`;
}
function monday(iso) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() || 7) - 1));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function money(value) { return `¥${Number(value).toFixed(2).replace(/\.00$/, "")}`; }
function member(id) { return state.members.find(person => person.id === id); }
function memberFrom(data, id) { return data.members.find(person => person.id === id); }
function activeMembers() { return state.members.filter(person => person.active !== false); }
function me() { return member(state.currentUserId); }
function names(ids) { return ids.map(id => member(id)?.name || "已退出成员").join("、"); }
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
function load() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "");
    if (stored) {
      stored.notifications ||= [];
      stored.roomJoined ??= true;
      stored.onboardingCompleted ??= true;
      stored.roomInfo ||= {
        address: "",
        layout: "",
        moveInDate: "",
        inviteCode: "ROOM2026",
        note: ""
      };
      stored.members.forEach(person => {
        person.active ??= true;
        person.joinedAt ||= "2026-08-01";
        person.gender ||= "未设置";
      });
      stored.items.forEach(item => {
        if (item.kind === "durable") item.kind = "appliance";
        item.logs ||= [];
        item.category = item.kind === "consumable" ? "消耗品" : "电器";
        item.ownerType ||= "公共购买";
        item.purchasedBy ||= stored.currentUserId;
        item.quantity ??= item.kind === "consumable" ? (item.status === "empty" ? 0 : item.status === "low" ? 1 : 3) : 1;
        item.unit ||= item.kind === "consumable" ? "个" : "件";
        item.threshold ??= item.kind === "consumable" ? 1 : 0;
        item.location ||= "";
        item.purchasedAt ||= "";
        item.price ??= "";
        item.usingBy ||= "";
        item.borrowedAt ||= "";
        item.dueAt ||= "";
        item.condition ||= "ok";
      });
      stored.chores.forEach((chore, index) => {
        chore.frequency ||= "weekly";
        chore.weekday ??= [5, 6, 5, 2][index] ?? 5;
        chore.intervalWeeks ||= chore.area === "客厅" ? 2 : 1;
        chore.memberIds = chore.memberIds.filter(id => memberFrom(stored, id)?.active !== false);
        if (!chore.memberIds.length) chore.memberIds = stored.members.filter(person => person.active !== false).map(person => person.id);
        if (chore.cycle === "daily") chore.cycle = "weekly";
      });
    }
    return stored;
  } catch { return null; }
}
function toast(text) {
  const node = document.getElementById("toast");
  node.textContent = text;
  node.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.style.display = "none"; }, 1600);
}

function seed() {
  const members = [
    { id: "u1", name: "阿哲", color: "#2f6a58", room: "主卧", gender: "男", joinedAt: "2026-08-01", active: true },
    { id: "u2", name: "小满", color: "#c45c26", room: "次卧 A", gender: "女", joinedAt: "2026-08-01", active: true },
    { id: "u3", name: "老K", color: "#3d5a80", room: "次卧 B", gender: "男", joinedAt: "2026-08-01", active: true }
  ];
  const all = members.map(person => person.id);
  return {
    house: "梧桐里 3 室",
    roomJoined: true,
    onboardingCompleted: true,
    roomInfo: {
      address: "杭州市西湖区梧桐里 8 幢 302",
      layout: "3 室 1 厅 1 卫",
      moveInDate: "2026-08-01",
      inviteCode: "WTL302",
      note: "快递放门口需在群里提醒；门禁卡放玄关抽屉。"
    },
    currentUserId: "u1",
    members,
    expenses: [
      { id: "e1", title: "9月房租", amount: 4500, category: "房租", payerId: "u1", splitIds: all, paidIds: ["u1"], note: "转给房东截止5号", createdAt: "2026-09-01" },
      { id: "e2", title: "8月电费", amount: 186, category: "水电", payerId: "u2", splitIds: all, paidIds: ["u2"], note: "峰谷电合计", createdAt: "2026-09-08" },
      { id: "e3", title: "空气炸锅纸盘", amount: 29.9, category: "日用", payerId: "u3", splitIds: all, paidIds: all, note: "", createdAt: "2026-09-06" }
    ],
    chores: [
      { id: "c1", area: "厨房清洁", cycle: "weekly", frequency: "weekly", weekday: 5, intervalWeeks: 1, memberIds: all, offset: 0, donePeriod: "" },
      { id: "c2", area: "卫生间清洁", cycle: "weekly", frequency: "weekly", weekday: 6, intervalWeeks: 1, memberIds: all, offset: 1, donePeriod: "" },
      { id: "c3", area: "客厅整理", cycle: "weekly", frequency: "biweekly", weekday: 5, intervalWeeks: 2, memberIds: all, offset: 2, donePeriod: "" },
      { id: "c4", area: "垃圾清运", cycle: "weekly", frequency: "weekly", weekday: 2, intervalWeeks: 1, memberIds: all, offset: 1, donePeriod: "" }
    ],
    items: [
      { id: "i1", name: "抽纸", kind: "consumable", category: "消耗品", ownerType: "公共购买", purchasedBy: "u1", purchasedAt: "2026-09-01", price: 24, quantity: 1, unit: "提", threshold: 2, location: "客厅柜", note: "客厅备用", usingBy: "", condition: "ok", logs: [{ at: "2026-09-10", userId: "u2", text: "使用 1 提" }] },
      { id: "i2", name: "洗洁精", kind: "consumable", category: "消耗品", ownerType: "公共购买", purchasedBy: "u2", purchasedAt: "2026-09-05", price: 15, quantity: 2, unit: "瓶", threshold: 1, location: "水槽下方", note: "", usingBy: "", condition: "ok", logs: [] },
      { id: "i3", name: "垃圾袋", kind: "consumable", category: "消耗品", ownerType: "公共购买", purchasedBy: "u3", purchasedAt: "2026-09-01", price: 18, quantity: 0, unit: "卷", threshold: 1, location: "阳台柜", note: "需要补大号", usingBy: "", condition: "ok", logs: [{ at: "2026-09-12", userId: "u3", text: "用完最后 1 卷" }] },
      { id: "i4", name: "洗衣机", kind: "appliance", category: "电器", ownerType: "公共购买", purchasedBy: "u1", purchasedAt: "2026-08-01", price: 1899, quantity: 1, unit: "台", threshold: 0, location: "阳台", note: "滚筒洗衣机", usingBy: "", condition: "ok", logs: [] },
      { id: "i5", name: "空气炸锅", kind: "appliance", category: "电器", ownerType: "个人贡献", purchasedBy: "u2", purchasedAt: "2026-08-12", price: 299, quantity: 1, unit: "台", threshold: 0, location: "厨房台面", note: "", usingBy: "u2", borrowedAt: "2026-09-12", dueAt: "2026-09-14", condition: "ok", logs: [{ at: "2026-09-12", userId: "u2", text: "开始使用，预计 2026-09-14 归还" }] }
    ],
    rules: [
      { id: "r1", title: "23:30 后客厅小声", body: "戴耳机、关门说话，不在客厅打电话。临时加班提前群里说一声。", createdBy: "u1", createdAt: "2026-08-20", readIds: ["u2", "u3"] },
      { id: "r2", title: "公共食物要写名字", body: "没写名字默认可共享。个人饮料放第一层，过期当天晚上处理。", createdBy: "u2", createdAt: "2026-08-20", readIds: all },
      { id: "r3", title: "客人过夜提前说", body: "提前一天告知。公共区域不堆行李，卫生间不超过 20 分钟。", createdBy: "u3", createdAt: "2026-09-01", readIds: all }
    ],
    notifications: [
      { id: "n1", title: "小满新增了一笔 8月电费", createdAt: "2026-09-08", read: false },
      { id: "n2", title: "本周卫生间值日已完成", createdAt: "2026-09-10", read: true },
      { id: "n3", title: "老K标记垃圾袋已用完", createdAt: "2026-09-11", read: false },
      { id: "n4", title: "阿哲新增了 9月房租账单", createdAt: "2026-09-12", read: false }
    ]
  };
}
function emptyState() {
  const currentUser = { id: "u1", name: "我", color: "#2f6a58", room: "", gender: "未设置", joinedAt: today(), active: true };
  return {
    house: "",
    roomJoined: false,
    onboardingCompleted: false,
    roomInfo: {
      address: "",
      layout: "",
      moveInDate: "",
      inviteCode: "",
      note: ""
    },
    currentUserId: currentUser.id,
    members: [currentUser],
    expenses: [],
    chores: [],
    items: [],
    rules: [],
    notifications: []
  };
}

function weekdayIndex(iso) { return (new Date(`${iso}T12:00:00`).getDay() + 6) % 7; }
function taskWeekIndex(iso) {
  const anchor = new Date("2026-01-05T12:00:00");
  const current = new Date(`${monday(iso)}T12:00:00`);
  return Math.floor((current - anchor) / 604800000);
}
function isScheduledFor(chore, iso) {
  if (weekdayIndex(iso) !== chore.weekday) return false;
  return taskWeekIndex(iso) % (chore.intervalWeeks || 1) === 0;
}
function periodKeyFor(chore, iso) { return iso; }
function periodIndexFor(chore, iso) {
  return Math.floor(taskWeekIndex(iso) / (chore.intervalWeeks || 1));
}
function assigneeFor(chore, iso, shift = 0) {
  return chore.memberIds[Math.abs(periodIndexFor(chore, iso) + chore.offset + shift) % chore.memberIds.length];
}
function periodKey(chore) { return periodKeyFor(chore, today()); }
function periodIndex(chore) { return periodIndexFor(chore, today()); }
function assignee(chore, shift = 0) { return assigneeFor(chore, today(), shift); }
function done(chore) { return chore.donePeriod === periodKey(chore); }
function share(expense) { return expense.amount / expense.splitIds.length; }
function settled(expense) { return expense.splitIds.every(id => id === expense.payerId || expense.paidIds.includes(id)); }
function owes(expense, userId) { return expense.splitIds.includes(userId) && userId !== expense.payerId && !expense.paidIds.includes(userId); }
function netMap() {
  const net = Object.fromEntries(state.members.map(person => [person.id, 0]));
  state.expenses.filter(expense => !settled(expense)).forEach(expense => {
    expense.splitIds.forEach(id => {
      if (id === expense.payerId || expense.paidIds.includes(id)) return;
      net[id] -= share(expense);
      net[expense.payerId] += share(expense);
    });
  });
  return net;
}
function transfers() {
  const debtors = [];
  const creditors = [];
  Object.entries(netMap()).forEach(([id, value]) => {
    if (value < -0.009) debtors.push({ id, amount: -value });
    if (value > 0.009) creditors.push({ id, amount: value });
  });
  const output = [];
  let debtor = 0;
  let creditor = 0;
  while (debtor < debtors.length && creditor < creditors.length) {
    const amount = Math.min(debtors[debtor].amount, creditors[creditor].amount);
    output.push({ from: debtors[debtor].id, to: creditors[creditor].id, amount });
    debtors[debtor].amount -= amount;
    creditors[creditor].amount -= amount;
    if (debtors[debtor].amount < 0.01) debtor++;
    if (creditors[creditor].amount < 0.01) creditor++;
  }
  return output;
}
function moneySummary(userId = state.currentUserId, period = month()) {
  return state.expenses
    .filter(expense => expense.createdAt.startsWith(period))
    .reduce((total, expense) => {
      const splitAmount = share(expense);
      total.total += expense.amount;

      if (expense.payerId === userId) {
        total.advanced += expense.amount;
        total.received += expense.paidIds.filter(id => id !== userId).length * splitAmount;
      } else if (expense.splitIds.includes(userId) && expense.paidIds.includes(userId)) {
        total.paidForOthers += splitAmount;
      }

      if (owes(expense, userId)) total.pay += splitAmount;
      if (expense.payerId === userId && !settled(expense)) {
        total.receive += expense.splitIds.filter(id => id !== userId && !expense.paidIds.includes(id)).length * splitAmount;
      }
      return total;
    }, { total: 0, advanced: 0, received: 0, paidForOthers: 0, pay: 0, receive: 0 });
}
function summary(userId = state.currentUserId) {
  const total = moneySummary(userId);
  return {
    spent: total.advanced - total.received + total.paidForOthers,
    pay: total.pay,
    receive: total.receive
  };
}
function todos() {
  const userId = state.currentUserId;
  return [
    ...state.chores.filter(chore => isScheduledFor(chore, today()) && assignee(chore) === userId && !done(chore)).map(chore => ({ type: "chore", id: chore.id, title: `值日 · ${chore.area}`, meta: "轮到你了，完成后点击右侧按钮" })),
    ...state.items.filter(item => item.kind === "appliance" && item.usingBy === userId).map(item => ({ type: "item", id: item.id, title: `归还电器 · ${item.name}`, meta: "使用结束后，请及时归还给房间成员" })),
    ...state.rules.filter(rule => !rule.readIds.includes(userId)).map(rule => ({ type: "rule", id: rule.id, title: "待确认公约", meta: `请阅读并确认：${rule.title}`, warn: true }))
  ];
}
function roomNotifications() {
  return [...state.notifications].sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

function render() {
  if (!state.roomJoined) tab = "home";
  document.getElementById("houseName").textContent = state.roomJoined ? state.house : "合租生活管家";
  document.getElementById("meAvatar").style.background = me().color;
  document.getElementById("meAvatar").textContent = me().name.slice(-1);
  document.getElementById("userSwitch").innerHTML = activeMembers().map(person => `<option value="${person.id}" ${person.id === me().id ? "selected" : ""}>${person.name}</option>`).join("");
  document.getElementById("tabs").innerHTML = TABS.map(item => `<button data-tab="${item.id}" class="${item.id === tab ? "active" : ""}" ${!state.roomJoined && item.id !== "home" ? "disabled" : ""}><span class="ico">${item.ico}</span><span class="lab">${item.lab}</span></button>`).join("");
  document.getElementById("view").innerHTML = ({ home: viewHome, money: viewMoney, chore: viewChore, item: viewItem, mine: viewMine })[tab]();
  save();
}

function viewHome() {
  if (!state.roomJoined) {
    return `<section class="empty-room"><span class="empty-room-mark">⌂</span><h1>你还未加入任何房间</h1><p>创建房间或输入邀请码加入，即可开始使用账单、值日、物品和房间公约。</p><button class="btn block" data-act="open-create-room">创建房间</button><button class="btn ghost block" data-act="open-join-room">加入房间</button><button class="demo-entry" data-act="load-demo">先体验演示数据</button></section>`;
  }
  if (homeView === "notifications") return viewAllNotifications();
  const tasks = todos();
  const notifications = roomNotifications();
  const previewNotifications = notifications.slice(0, 3);
  return `
    <section class="home-hero">
      <div class="house-kicker">HOME · ${today()}</div>
      <div class="home-heading"><div><b>你好，${me().name}</b><p>把这间屋子的事，今天处理清楚。</p></div><button class="member-shortcut" data-act="goto" data-tab="mine" data-mine="members" title="查看房间成员"><span>♙</span><b>${activeMembers().length}</b><small>成员</small></button></div>
    </section>
    <div class="quick-grid">
      <button class="quick-action" data-act="open-expense" data-guide="home-expense"><span>＋</span><b>快速记账</b></button>
      <button class="quick-action" data-act="goto" data-tab="chore"><span>◇</span><b>值日打卡</b></button>
      <button class="quick-action" data-act="goto" data-tab="item"><span>▢</span><b>物品使用</b></button>
      <button class="quick-action" data-act="goto" data-tab="mine" data-mine="rules"><span>§</span><b>查看公约</b></button>
    </div>
    <div class="section-title"><h2>当前待办</h2><span>${tasks.length} 项</span></div>
    ${tasks.length ? tasks.map(todoCard).join("") : `<div class="card empty">当前没有待处理事项。</div>`}
    <div class="section-title"><h2>通知提醒</h2><button class="text-button" data-act="read-notifications">全部已读</button></div>
    ${previewNotifications.length ? previewNotifications.map(notificationCard).join("") : `<div class="card empty">暂无新的房间通知</div>`}
    ${notifications.length > 3 ? `<button class="view-more" data-act="home-view" data-view="notifications">查看全部通知（共 ${notifications.length} 条）</button>` : ""}
  `;
}
function notificationCard(note) {
  return `<article class="card notification-row ${note.read ? "done" : ""}"><span class="notice-dot ${note.read ? "read" : ""}"></span><div><div class="title">${note.title}</div><div class="meta">${note.createdAt}</div></div></article>`;
}
function viewAllNotifications() {
  const notifications = roomNotifications();
  return `<div class="detail-heading"><button class="back-button" data-act="home-back" title="返回">‹</button><div class="grow"><h1>通知提醒</h1><p>共 ${notifications.length} 条房间动态</p></div><button class="text-button" data-act="read-notifications">全部已读</button></div>${notifications.map(notificationCard).join("") || `<div class="card empty">暂无新的房间通知</div>`}`;
}
function todoCard(task) {
  const action = task.type === "chore" ? "done-chore" : task.type === "rule" ? "read-rule" : "quick-return";
  const icon = { chore: "◇", item: "▢", rule: "§" }[task.type];
  const label = { chore: "完成", item: "归还", rule: "确认" }[task.type];
  return `<article class="card todo-card"><div class="todo-icon ${task.warn ? "warn" : ""}">${icon}</div><div class="grow"><div class="title">${task.title}</div><div class="meta">${task.meta}</div></div><button class="btn quick-done" data-act="${action}" data-id="${task.id}">${label}</button></article>`;
}
function subnav(items, active, action) {
  return `<div class="subnav">${items.map(item => `<button data-act="${action}" data-view="${item.id}" class="${item.id === active ? "active" : ""}">${item.label}</button>`).join("")}</div>`;
}

function viewMoney() {
  const views = { bills: moneyBills, report: moneyReport };
  if (!views[moneyView]) moneyView = "bills";
  return `<div class="page-heading"><div><h1>账单</h1><p>先看待处理，再看每笔明细。</p></div><button class="btn" data-act="open-expense" data-guide="money-expense">新增账单</button></div>${subnav([{ id: "bills", label: "账单明细" }, { id: "report", label: "统计" }], moneyView, "money-view")}${views[moneyView]()}`;
}
function moneyBills() {
  const monthlyExpenses = state.expenses.filter(expense => expense.createdAt.startsWith(month())).sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  const historyExpenses = state.expenses.filter(expense => !expense.createdAt.startsWith(month())).sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  const pending = monthlyExpenses.filter(expense => !settled(expense) && (owes(expense, me().id) || expense.payerId === me().id));
  const pendingIds = new Set(pending.map(expense => expense.id));
  const orderedExpenses = [...pending, ...monthlyExpenses.filter(expense => !pendingIds.has(expense.id))];
  const totals = moneySummary(me().id);
  const monthlyPaid = totals.advanced - totals.received + totals.paidForOthers;
  return `<section class="money-action-card"><div><span>总支出</span><b>${money(totals.total)}</b></div><div><span>我已支付</span><b>${money(monthlyPaid)}</b></div><div><span>我待支付</span><b>${money(totals.pay)}</b></div><div><span>待收款</span><b>${money(totals.receive)}</b></div></section><div class="money-overview-note">“我已支付”按真实付款记录计算：垫付会增加，收到室友转账会扣回。</div><div class="section-title"><h2>账单明细</h2><span>待处理优先 · ${monthlyExpenses.length} 笔</span></div>${orderedExpenses.length ? orderedExpenses.map(expenseCard).join("") : `<div class="card empty">本月还没有账单，点击右上角新增一笔吧。</div>`}<div class="section-title"><h2>历史账单</h2><span>${historyExpenses.length} 笔</span></div>${historyExpenses.length ? historyExpenses.map(expenseCard).join("") : `<div class="card empty compact-empty">暂无历史账单。</div>`}`;
}
function reportExpenseGroups(period) {
  return CATS.map((category, index) => ({
    category,
    amount: state.expenses.filter(expense => expense.createdAt.startsWith(period) && expense.category === category).reduce((sum, expense) => sum + expense.amount, 0),
    color: REPORT_COLORS[index]
  })).filter(item => item.amount);
}
function moneyReport() {
  const months = [...new Set([
    ...state.expenses.map(expense => expense.createdAt.slice(0, 7)),
    shiftMonth(month(), -2),
    shiftMonth(month(), -1),
    month()
  ])].sort((first, second) => second.localeCompare(first));
  if (!months.includes(reportMonth)) reportMonth = months[0] || month();
  const expenses = state.expenses.filter(expense => expense.createdAt.startsWith(reportMonth)).sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const memberGroups = activeMembers().map(person => ({ name: person.name, amount: expenses.filter(expense => expense.splitIds.includes(person.id)).reduce((sum, expense) => sum + share(expense), 0) })).filter(item => item.amount);
  const memberMax = Math.max(...memberGroups.map(item => item.amount), 1);
  return `<div class="report-month-filter"><span>统计周期</span><div class="report-month-select"><b>${monthLabel(reportMonth)}</b><i>⌄</i><select id="report-month-select" aria-label="选择统计月份">${months.map(value => `<option value="${value}" ${value === reportMonth ? "selected" : ""}>${monthLabel(value)}</option>`).join("")}</select></div></div><div class="report-total"><button class="report-stats-trigger" data-act="open-report-stats" title="查看分类支出统计" aria-label="查看分类支出统计">◔</button><span>${reportMonth} 全屋支出</span><b>${money(total)}</b><p>${expenses.length} 笔账单 · 点击右上角查看分类统计</p></div><div class="section-title"><h2>分类支出</h2><span>${expenses.length} 笔</span></div><div class="card ledger-list">${expenses.length ? expenses.map(expense => `<div class="ledger-row"><time>${expense.createdAt.slice(5).replace("-", "/")}</time><div><b>${expense.title}</b><small>${expense.category}</small></div><strong>${money(expense.amount)}</strong></div>`).join("") : `<div class="empty">该月还没有账单</div>`}</div><div class="section-title"><h2>成员分摊</h2><span>按参与账单计算</span></div><div class="card report-list">${memberGroups.map(item => `<div class="report-row"><div class="report-label"><span>${item.name}</span><b>${money(item.amount)}</b></div><div class="bar"><i style="width:${Math.round(item.amount / memberMax * 100)}%"></i></div></div>`).join("") || `<div class="empty">该月还没有分摊记录</div>`}</div>`;
}
function expenseCard(expense) {
  const isSettled = settled(expense);
  const waiting = expense.splitIds.filter(id => id !== expense.payerId && !expense.paidIds.includes(id));
  const myPay = owes(expense, me().id) ? share(expense) : 0;
  const myReceive = expense.payerId === me().id ? waiting.length * share(expense) : 0;
  const primary = isSettled
    ? { label: "已结清", value: expense.amount, note: "总额" }
    : myPay
      ? { label: "我待支付", value: myPay, note: `付给 ${member(expense.payerId).name}` }
      : waiting.length
        ? { label: `待${names(waiting)}支付`, value: expense.payerId === me().id ? myReceive : waiting.length * share(expense), note: expense.payerId === me().id ? "我待收款" : "账单未结清" }
        : { label: "已结清", value: expense.amount, note: "总额" };
  const action = isSettled
    ? `<button class="btn ghost" disabled>${expense.payerId === me().id ? "已收款" : "已结清"}</button>`
    : owes(expense, me().id)
      ? `<button class="btn" data-act="pay" data-id="${expense.id}">付款</button>`
      : expense.payerId === me().id
        ? `<button class="btn ghost" data-act="collect" data-id="${expense.id}">确认收款</button>`
        : "";
  return `<article class="card bill-card ${isSettled ? "done" : ""}"><div class="bill-main"><div class="grow"><div class="title">${expense.title} <small>${expense.category}</small></div><div class="meta">${expense.createdAt} · ${member(expense.payerId).name}先付 · 总额 ${money(expense.amount)} · ${expense.splitIds.length} 人 AA</div><div class="meta bill-people">${primary.note}</div></div><div class="bill-card-side"><span class="bill-primary-label">${primary.label}</span><b>${money(primary.value)}</b></div>${action}</div></article>`;
}

function viewChore() {
  if (choreView === "tasks") return viewChoreTasks();
  const todayChores = state.chores.filter(chore => isScheduledFor(chore, today()));
  const complete = todayChores.filter(done);
  const completion = todayChores.length ? Math.round(complete.length / todayChores.length * 100) : 0;
  return `
    <div class="page-heading"><div><h1>值日</h1><p>按实际频率排班，日历自动生成。</p></div><div class="chore-page-actions"><button class="text-button" data-act="chore-view" data-view="tasks">当前任务列表</button><button class="btn" data-act="add-chore" data-guide="chore-add">新增任务</button></div></div>
    <div class="stats chore-stats">
      <div class="stat"><em>今日安排</em><b>${todayChores.length}</b></div>
      <div class="stat"><em>已完成</em><b>${complete.length}</b></div>
      <div class="stat"><em>完成率</em><b>${completion}%</b></div>
    </div>
    ${dateDuties(today(), "今日安排", "按当前排班生成")}
    ${choreCalendar()}
    ${selectedChoreDate === today() ? "" : dateDuties(selectedChoreDate, "所选日期安排", "点击日历切换查看")}
  `;
}
function viewChoreTasks() {
  return `<div class="detail-heading"><button class="back-button" data-act="chore-back" title="返回">‹</button><div class="grow"><h1>当前任务列表</h1><p>管理房间里所有值日安排</p></div><button class="text-button" data-act="add-chore">新增任务</button></div>${currentChoreList(false)}`;
}
function calendarIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function calendarLabel(date) {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}
function choreCalendar() {
  const year = calendarCursor.getFullYear();
  const monthIndex = calendarCursor.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const leading = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let index = 0; index < leading; index++) cells.push(`<div class="calendar-blank"></div>`);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day);
    const iso = calendarIso(date);
    const scheduled = state.chores.filter(chore => isScheduledFor(chore, iso));
    const isToday = iso === today();
    const isSelected = iso === selectedChoreDate;
    const isMonday = date.getDay() === 1;
    cells.push(`<button class="calendar-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-act="select-chore-date" data-date="${iso}" aria-label="${iso} 有${scheduled.length}项值日安排"><b>${day}</b><span class="calendar-dots">${scheduled.slice(0, 3).map(chore => `<i class="calendar-dot" style="background:${member(assigneeFor(chore, iso)).color}"></i>`).join("")}</span>${scheduled.length > 3 ? `<em>+${scheduled.length - 3}</em>` : ""}</button>`);
  }
  return `
    <div class="section-title"><h2>值日日历</h2><span>圆点表示当日有值日安排</span></div>
    <section class="calendar-card">
      <div class="calendar-toolbar"><button class="calendar-nav" data-act="move-calendar" data-direction="-1" title="上个月">‹</button><b>${calendarLabel(calendarCursor)}</b><button class="calendar-nav" data-act="move-calendar" data-direction="1" title="下个月">›</button></div>
      <div class="calendar-weekdays">${["一", "二", "三", "四", "五", "六", "日"].map(day => `<span>${day}</span>`).join("")}</div>
      <div class="calendar-grid">${cells.join("")}</div>
      <div class="calendar-legend"><span><i class="calendar-dot"></i>已安排值日</span><span>点击日期查看安排</span></div>
    </section>
  `;
}
function dateDuties(iso, title, helper) {
  const date = new Date(`${iso}T12:00:00`);
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
  const chores = state.chores.filter(chore => isScheduledFor(chore, iso));
  const isToday = iso === today();
  return `
    <div class="section-title"><h2>${title}</h2><span>${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${weekday}</span></div>
    ${chores.length ? `<div class="card duty-list">
      ${chores.map(chore => {
        const responsible = member(assigneeFor(chore, iso));
        const canCheckIn = isToday;
        const isDone = canCheckIn && done(chore);
        return `<div class="duty-row"><div class="duty-person" style="background:${responsible.color}">${responsible.name.slice(-1)}</div><div class="grow"><b>${chore.area}</b><span>${chore.frequency === "biweekly" ? "每两周一次" : "每周一次"} · ${responsible.name} 负责</span></div><span class="tag ${isDone ? "" : responsible.id === me().id && canCheckIn ? "warn" : "gold"}">${isDone ? "已完成" : canCheckIn ? responsible.id === me().id ? "轮到你" : "待完成" : "已排班"}</span>${isDone && chore.proof?.dataUrl ? `<img class="chore-proof" src="${chore.proof.dataUrl}" alt="值日证明">` : ""}${canCheckIn && !isDone ? `<button class="check-button" data-act="done-chore" data-id="${chore.id}">${responsible.id === me().id ? "打卡" : "代打卡"}</button>` : ""}</div>`;
      }).join("")}
    </div>` : `<div class="card empty">${isToday ? "今天没有安排值日任务，好好享受自由时间吧。" : `${helper}，这一天没有安排值日任务。`}</div>`}
  `;
}
function currentChoreList(showHeading = true) {
  const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  return `
    ${showHeading ? `<div class="section-title"><h2>当前任务列表</h2><button class="text-action" data-act="add-chore">新增任务</button></div>` : ""}
    ${state.chores.length ? `<div class="card chore-task-list">${state.chores.map(chore => `<div class="chore-task-row"><div class="grow"><b>${chore.area}</b><span>${chore.frequency === "biweekly" ? "每两周一次" : "每周一次"} · ${weekdays[chore.weekday]} · ${names(chore.memberIds)}</span></div><div class="chore-task-actions"><button class="text-action" data-act="edit-chore" data-id="${chore.id}">编辑</button><button class="text-action danger-action" data-act="confirm-delete-chore" data-id="${chore.id}">删除</button></div></div>`).join("")}</div>` : `<div class="card empty">还没有值日任务，先添加一项吧。</div>`}
  `;
}
function itemStatus(item) {
  if (item.condition && item.condition !== "ok") return item.condition;
  if (item.kind === "appliance") return item.usingBy ? "using" : "available";
  if (Number(item.quantity) <= 0) return "empty";
  if (Number(item.quantity) <= Number(item.threshold)) return "low";
  return "ok";
}
function itemStatusLabel(item) {
  return { available: "可用", using: "使用中", ok: "库存充足", low: "待补货", empty: "待补货", damaged: "损坏", lost: "丢失", scrapped: "已报废" }[itemStatus(item)] || "待处理";
}
function itemStatusClass(item) {
  return ["low", "empty", "damaged", "lost"].includes(itemStatus(item)) ? "warn" : ["using"].includes(itemStatus(item)) ? "gold" : "";
}
function daysUntil(dateString) {
  if (!dateString) return null;
  const target = new Date(`${dateString}T12:00:00`);
  const current = new Date(`${today()}T12:00:00`);
  return Math.round((target - current) / 86400000);
}
function addDays(iso, amount) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return calendarIso(date);
}
function itemSummaryCard(label, value, tone = "") {
  return `<div class="item-summary-card ${tone}"><b>${value}</b><span>${label}</span></div>`;
}
function viewItem() {
  if (itemView === "detail") return itemDetail(state.items.find(item => item.id === selectedItemId));
  if (itemView === "records") return `<div class="detail-heading"><button class="back-button" data-act="item-back" title="返回">‹</button><div class="grow"><h1>使用记录</h1><p>查看消耗品使用与电器归还记录</p></div></div>${itemRecords()}`;
  const consumables = state.items.filter(item => item.kind === "consumable");
  const appliances = state.items.filter(item => item.kind === "appliance");
  const priorityItems = [
    ...appliances.filter(item => item.usingBy && itemStatus(item) !== "scrapped"),
    ...consumables.filter(item => ["low", "empty"].includes(itemStatus(item)))
  ];
  const priorityIds = new Set(priorityItems.map(item => item.id));
  const regularConsumables = consumables.filter(item => !priorityIds.has(item.id));
  const regularAppliances = appliances.filter(item => !priorityIds.has(item.id));
  const counts = {
    all: state.items.length,
    using: appliances.filter(item => itemStatus(item) === "using").length,
    low: state.items.filter(item => ["low", "empty"].includes(itemStatus(item))).length
  };
  const restockCount = consumables.filter(item => ["low", "empty"].includes(itemStatus(item))).length;
  return `<div class="page-heading"><div><h1>物品</h1><p>消耗品补货，电器使用与归还。</p></div><button class="btn" data-act="open-item" data-guide="item-add">添加物品</button></div>${recentItemRecord()}<div class="item-overview">${itemSummaryCard("物品总数", counts.all)}${itemSummaryCard("使用中", counts.using, "gold")}${itemSummaryCard("待补货", counts.low, "gold")}</div>${priorityItems.length ? `<div class="section-title item-list-heading"><h2>需要处理</h2><span>${priorityItems.length} 项</span></div><div class="priority-item-grid">${priorityItems.map(priorityItemCard).join("")}</div>` : ""}${regularConsumables.length ? `<div class="section-title item-list-heading"><h2>${restockCount ? "其他消耗品" : "消耗品"}</h2><span>${restockCount ? "库存正常" : ""}</span></div>${itemList(regularConsumables, "消耗品")}` : ""}${regularAppliances.length ? `<div class="section-title item-list-heading"><h2>${priorityItems.some(item => item.kind === "appliance") ? "其他电器" : "电器"}</h2><button class="text-action" data-act="item-view" data-view="records">查看全部</button></div>${itemList(regularAppliances, "电器")}` : ""}${!state.items.length ? `<div class="card empty">还没有添加公共物品。</div>` : ""}`;
}
function recentItemRecord() {
  const latest = state.items.flatMap(item => item.logs.map(log => ({ ...log, itemName: item.name }))).sort((first, second) => second.at.localeCompare(first.at))[0];
  return latest ? `<button class="card recent-item-record" data-act="item-view" data-view="records"><div class="todo-icon">记</div><div class="grow"><b>使用记录</b><span>${latest.itemName} · ${latest.text}</span></div><em>${latest.at}</em><i>›</i></button>` : `<button class="card recent-item-record" data-act="item-view" data-view="records"><div class="todo-icon">记</div><div class="grow"><b>使用记录</b><span>还没有使用记录</span></div><i>›</i></button>`;
}
function itemList(items, label) {
  return items.length ? items.map(itemCard).join("") : `<div class="card empty">还没有添加${label}。</div>`;
}
function itemRecords() {
  const records = state.items.flatMap(item => item.logs.map(log => ({ ...log, itemName: item.name }))).sort((a, b) => b.at.localeCompare(a.at));
  return records.length ? records.map(record => `<article class="card compact-card"><div class="row"><div class="todo-icon">${record.itemName.slice(0, 1)}</div><div class="grow"><div class="title">${record.itemName}</div><div class="meta">${record.at} · ${member(record.userId)?.name || "成员"} · ${record.text}</div></div></div></article>`).join("") : `<div class="card empty">还没有使用记录</div>`;
}
function itemCard(item) {
  const status = itemStatus(item);
  const appliance = item.kind === "appliance";
  const needsAttention = appliance ? Boolean(item.usingBy) : ["low", "empty"].includes(status);
  const current = appliance ? (item.usingBy ? `${member(item.usingBy)?.name || "成员"} 使用中 · 请及时归还` : "当前可使用") : `库存 ${item.quantity}${item.unit} · 提醒线 ${item.threshold}${item.unit}`;
  const action = status === "scrapped" ? `<span class="meta compact-item-disabled">已停止使用</span>` : appliance ? `<button class="btn ${needsAttention ? "attention" : ""} compact-item-action" data-act="${item.usingBy ? "open-return" : "open-borrow"}" data-id="${item.id}">${item.usingBy ? "归还" : "使用"}</button>` : `<button class="btn ${needsAttention ? "attention" : "ghost"} compact-item-action" data-act="open-stock-in" data-id="${item.id}">${needsAttention ? "立即补货" : "补货"}</button>`;
  return `<article class="card item-card compact-item-card ${needsAttention ? "needs-attention" : ""}" data-act="view-item-detail" data-id="${item.id}"><div class="row"><div class="item-mark">${item.photo ? `<img src="${item.photo}" alt="">` : item.name.slice(0, 1)}</div><div class="grow"><div class="title">${item.name}</div><div class="meta">${current}${item.location ? ` · ${item.location}` : ""}</div></div><div class="compact-item-side"><span class="tag ${itemStatusClass(item)}">${itemStatusLabel(item)}</span>${action}</div></div></article>`;
}
function priorityItemCard(item) {
  const appliance = item.kind === "appliance";
  const status = itemStatus(item);
  const action = appliance ? `<button class="btn attention" data-act="open-return" data-id="${item.id}">归还</button>` : `<button class="btn attention" data-act="open-stock-in" data-id="${item.id}">立即补货</button>`;
  const detail = appliance ? `${member(item.usingBy)?.name || "成员"} 正在使用，请及时归还` : status === "empty" ? `已用完 · 补货提醒线 ${item.threshold}${item.unit}` : `剩余 ${item.quantity}${item.unit} · 补货提醒线 ${item.threshold}${item.unit}`;
  return `<article class="priority-item-card" data-act="view-item-detail" data-id="${item.id}"><div class="item-mark">${item.photo ? `<img src="${item.photo}" alt="">` : item.name.slice(0, 1)}</div><div class="grow"><b>${item.name}</b><span>${detail}</span></div>${action}</article>`;
}
function itemDetail(item) {
  if (!item) { itemView = "list"; return viewItem(); }
  const appliance = item.kind === "appliance";
  const logs = item.logs || [];
  const detailActions = itemStatus(item) === "scrapped" ? "" : appliance ? `<button class="btn" data-act="${item.usingBy ? "open-return" : "open-borrow"}" data-id="${item.id}">${item.usingBy ? "归还" : "使用"}</button>` : `<button class="btn" data-act="open-stock-in" data-id="${item.id}">补货入库</button>`;
  return `<div class="detail-heading"><button class="back-button" data-act="item-back" title="返回">‹</button><div class="grow"><h1>${item.name}</h1><p>物品详情</p></div><button class="text-button" data-act="edit-item" data-id="${item.id}">编辑</button></div><section class="item-detail-hero">${item.photo ? `<img src="${item.photo}" alt="${item.name}">` : `<div class="item-detail-mark">${item.name.slice(0, 1)}</div>`}<div><h2>${item.name}</h2><span class="tag ${itemStatusClass(item)}">${itemStatusLabel(item)}</span></div></section><div class="section-title"><h2>基本信息</h2></div><div class="item-info-grid"><div><span>类型</span><b>${item.category}</b></div><div><span>归属</span><b>${item.ownerType}</b></div><div><span>存放位置</span><b>${item.location || "未填写"}</b></div><div><span>购买人</span><b>${member(item.purchasedBy)?.name || "未填写"}</b></div><div><span>购买日期</span><b>${item.purchasedAt || "未填写"}</b></div><div><span>价格</span><b>${item.price ? money(item.price) : "未填写"}</b></div></div>${appliance ? `<div class="section-title"><h2>当前使用</h2></div><article class="card item-current-use">${item.usingBy ? `<div class="meta">使用人：${member(item.usingBy)?.name || "成员"} · 开始时间：${item.borrowedAt || "未填写"} · 预计归还：${item.dueAt || "未填写"}${daysUntil(item.dueAt) < 0 ? ` · 已逾期 ${Math.abs(daysUntil(item.dueAt))} 天` : ""}</div>` : `<div class="empty">当前未在使用</div>`}</article>` : `<div class="section-title"><h2>库存信息</h2></div><article class="card item-current-use"><div class="meta">当前库存：${item.quantity}${item.unit} · 低库存阈值：${item.threshold}${item.unit}</div></article>`}<div class="actions item-detail-actions">${detailActions}<button class="btn ghost" data-act="edit-item" data-id="${item.id}">编辑</button>${itemStatus(item) === "scrapped" ? "" : `<button class="btn danger" data-act="archive-item" data-id="${item.id}">报废</button>`}</div><div class="section-title"><h2>使用记录</h2></div>${logs.length ? `<div class="item-timeline">${logs.map(log => `<div><i></i><p><b>${log.text}</b><span>${log.at} · ${member(log.userId)?.name || "成员"}</span></p></div>`).join("")}</div>` : `<div class="card empty">还没有使用记录</div>`}<div class="section-title"><h2>相关账单</h2></div>${state.expenses.filter(expense => expense.itemId === item.id).map(expenseCard).join("") || `<div class="card empty">还没有关联账单</div>`}`;
}

function viewMine() {
  const views = { overview: mineOverview, room: mineRoom, members: mineMembers, rules: mineRules, settings: mineSettings };
  if (mineView !== "overview") {
    const titles = { room: ["我的房间", "编辑"], members: ["房间成员", "添加成员"], rules: ["房间公约", "新增"], settings: ["设置", ""] };
    const [title, action] = titles[mineView];
    const headerAction = mineView === "room" ? "open-room-info" : mineView === "members" ? "open-member" : mineView === "rules" ? "open-rule" : "";
    return `<div class="detail-heading"><button class="back-button" data-act="mine-back" title="返回">‹</button><div class="grow"><h1>${title}</h1><p>${mineView === "room" ? "房间基础资料与共享说明" : mineView === "members" ? `${activeMembers().length} 位当前成员` : mineView === "rules" ? "共同确认，共同遵守" : "数据与偏好"}</p></div>${action ? `<button class="text-button" data-act="${headerAction}">${action}</button>` : ""}</div>${views[mineView]()}`;
  }
  return `<div class="page-heading"><div><h1>我的</h1><p>${me().name} · ${me().room || "未分配房间"}</p></div></div>${views.overview()}<div class="section-title"><h2>房间管理</h2></div><div class="management-list"><button data-act="mine-view" data-view="room" data-guide="room-manage"><span>⌂</span><div><b>我的房间</b><small>${state.house}</small></div><i>›</i></button><button data-act="mine-view" data-view="members"><span>♙</span><div><b>房间成员</b><small>${activeMembers().length} 位成员</small></div><i>›</i></button><button data-act="mine-view" data-view="rules" data-guide="room-rules"><span>§</span><div><b>房间公约</b><small>${state.rules.length} 条规则</small></div><i>›</i></button><button data-act="mine-view" data-view="settings"><span>⚙</span><div><b>设置</b><small>数据与偏好</small></div><i>›</i></button></div>`;
}
function mineOverview() { return `<section class="profile-card"><div class="profile-mark">${state.house.slice(0, 1)}</div><div><span>当前房间</span><b>${state.house}</b><p>${activeMembers().length} 人合住 · 本月已记录 ${state.expenses.filter(expense => expense.createdAt.startsWith(month())).length} 笔账单</p></div></section>`; }
function mineRoom() {
  const info = state.roomInfo;
  return `<section class="room-summary"><div class="room-summary-mark">${state.house.slice(0, 1)}</div><div><span>房间名称</span><b>${state.house}</b><p>${info.layout || "未填写户型"} · ${activeMembers().length} 位成员</p></div></section><div class="room-info-grid"><div><span>房间地址</span><b>${info.address || "未填写"}</b></div><div><span>入住日期</span><b>${info.moveInDate || "未填写"}</b></div><div><span>房间邀请码</span><b class="invite-code">${info.inviteCode || "未生成"}</b></div><div><span>成员人数</span><b>${activeMembers().length} 人</b></div></div><div class="section-title"><h2>房间说明</h2></div><article class="card room-note">${info.note ? `<div class="agree">${info.note}</div>` : `<div class="empty">暂未添加房间说明</div>`}</article>`;
}
function memberStats(person) {
  const participated = state.expenses.filter(expense => expense.splitIds.includes(person.id)).length;
  const responsible = state.chores.filter(chore => chore.memberIds.includes(person.id)).length;
  return { participated, responsible };
}
function mineMembers() {
  return `${activeMembers().map(person => {
    const stats = memberStats(person);
    return `<article class="card member-detail"><div class="member-row"><span class="avatar" style="background:${person.color}">${person.name.slice(-1)}</span><div class="grow"><div class="title">${person.name}${person.id === me().id ? "（我）" : ""}</div><div class="meta">当前成员 · 加入于 ${person.joinedAt}</div></div><span class="tag mute">${person.room || "未分配房间"}</span></div><div class="member-info"><div><span>性别</span><b>${person.gender || "未设置"}</b></div><div><span>房间</span><b>${person.room || "未分配"}</b></div><div><span>参与账单</span><b>${stats.participated} 笔</b></div><div><span>值日范围</span><b>${stats.responsible} 项</b></div></div><div class="actions"><button class="btn ghost" data-act="edit-member" data-id="${person.id}">修改资料</button>${person.id === me().id ? "" : `<button class="btn danger" data-act="delete-member" data-id="${person.id}">移除成员</button>`}</div></article>`;
  }).join("")}`;
}
function mineRules() { return `<div class="section-title"><h2>房间公约</h2><button class="text-button" data-act="open-rule">新增</button></div>${state.rules.filter(rule => !rule.readIds.includes(me().id)).length ? `<div class="notice-banner">你有 ${state.rules.filter(rule => !rule.readIds.includes(me().id)).length} 条公约待确认</div>` : ""}${state.rules.map(ruleCard).join("")}`; }
function ruleCard(rule) {
  const read = rule.readIds.includes(me().id);
  return `<article class="card"><div class="row"><div class="grow"><div class="title">${rule.title}</div><div class="meta">${member(rule.createdBy).name} 发布于 ${rule.createdAt} · ${rule.readIds.length}/${state.members.length} 人已确认</div></div><span class="tag ${read ? "" : "warn"}">${read ? "已确认" : "待确认"}</span></div><div class="agree">${rule.body}</div><div class="actions"><button class="btn" data-act="read-rule" data-id="${rule.id}" ${read ? "disabled" : ""}>我已同意</button></div></article>`;
}
function mineSettings() { return `<div class="section-title"><h2>设置</h2></div><article class="card"><div class="title">新用户引导</div><div class="meta">清空当前浏览器中的演示数据，重新从创建或加入房间开始。</div><div class="actions"><button class="btn" data-act="start-onboarding">进入新用户引导</button><button class="btn ghost" data-act="show-feature-guide">查看功能引导</button></div></article><article class="card"><div class="title">演示数据</div><div class="meta">内容仅存储在当前浏览器，不会同步给其他设备。</div><div class="actions"><button class="btn ghost" data-act="reset-data">重置演示数据</button></div></article>`; }

function openSheet(content) { document.getElementById("sheet").classList.add("show"); document.getElementById("sheet").innerHTML = `<div class="sheet-card">${content}</div>`; }
function closeSheet() { const sheet = document.getElementById("sheet"); sheet.classList.remove("show"); sheet.innerHTML = ""; delete sheet.dataset.itemId; delete sheet.dataset.memberId; delete sheet.dataset.choreId; }
function closeFeatureGuide() {
  const overlay = document.getElementById("guideOverlay");
  overlay.classList.remove("show");
  overlay.innerHTML = "";
  document.querySelectorAll(".guide-target-active").forEach(target => target.classList.remove("guide-target-active"));
}
function renderFeatureGuide() {
  const step = GUIDE_STEPS[guideStep];
  const target = document.querySelector(step.target);
  const overlay = document.getElementById("guideOverlay");
  if (!target) return;
  target.scrollIntoView({ block: "center" });
  requestAnimationFrame(() => {
    const appRect = document.getElementById("app").getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const inset = 6;
    const left = targetRect.left - appRect.left - inset;
    const top = targetRect.top - appRect.top - inset;
    const width = targetRect.width + inset * 2;
    const height = targetRect.height + inset * 2;
    const targetCenter = Math.min(Math.max(targetRect.left - appRect.left + targetRect.width / 2, 38), appRect.width - 38);
    target.classList.add("guide-target-active");
    overlay.innerHTML = `<div class="guide-spotlight" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px"></div><section class="guide-popover" style="--guide-arrow-left:${targetCenter}px"><div class="guide-kicker">操作引导 ${guideStep + 1}/${GUIDE_STEPS.length}</div><h3>${step.title}</h3><p>${step.body}</p><div class="guide-progress">${GUIDE_STEPS.map((_, index) => `<i class="${index <= guideStep ? "active" : ""}"></i>`).join("")}</div><div class="guide-actions"><button class="text-button" data-act="skip-feature-guide">跳过</button><button class="btn" data-act="next-feature-guide">${guideStep === GUIDE_STEPS.length - 1 ? "开始使用" : "下一步"}</button></div></section>`;
    overlay.classList.add("show");
  });
}
function showFeatureGuide() {
  const step = GUIDE_STEPS[guideStep];
  tab = step.tab;
  moneyView = "bills";
  itemView = "list";
  mineView = "overview";
  choreView = "main";
  render();
  renderFeatureGuide();
}
function startFeatureGuide() {
  guideStep = 0;
  state.onboardingCompleted = false;
  showFeatureGuide();
}
function formReportStats() {
  const groups = reportExpenseGroups(reportMonth);
  const total = groups.reduce((sum, item) => sum + item.amount, 0);
  const max = Math.max(...groups.map(item => item.amount), 1);
  openSheet(`<div class="stats-sheet-heading"><div><h3>支出统计</h3><p>${monthLabel(reportMonth)} · 总支出 ${money(total)}</p></div><button class="sheet-close" data-act="close-sheet" aria-label="关闭">×</button></div>${groups.length ? `<div class="sheet-section-title">分类金额与占比</div><div class="chart-bar-list">${groups.map(item => `<div class="chart-bar-row"><div><span><i style="background:${item.color}"></i>${item.category}</span><b>${money(item.amount)} · ${Math.round(item.amount / total * 100)}%</b></div><p><i style="width:${Math.round(item.amount / max * 100)}%;background:${item.color}"></i></p></div>`).join("")}</div>` : `<div class="card empty">该月还没有分类支出</div>`}<button class="btn ghost block" data-act="close-sheet">关闭</button>`);
}
function formExpense(preset = {}) {
  const selected = new Set(preset.splitIds || activeMembers().map(person => person.id));
  if (preset.itemId) document.getElementById("sheet").dataset.itemId = preset.itemId;
  openSheet(`<h3>${preset.title ? "补货入账" : "新增账单"}</h3><label>账单名称</label><input id="f-title" value="${preset.title || ""}" placeholder="例如 9月水费"><div class="grid2"><div><label>金额</label><input id="f-amount" type="number" min="0" step="0.01" value="${preset.amount || ""}" placeholder="0.00"></div><div><label>类别</label><select id="f-cat" class="field">${CATS.map(category => `<option ${category === (preset.category || "日用") ? "selected" : ""}>${category}</option>`).join("")}</select></div></div><label>账单日期</label><input id="f-expense-date" type="date" value="${preset.createdAt || today()}"><label>谁先付</label><select id="f-payer" class="field">${activeMembers().map(person => `<option value="${person.id}" ${person.id === me().id ? "selected" : ""}>${person.name}</option>`).join("")}</select><label>和谁 AA</label><div class="people" id="f-split">${activeMembers().map(person => `<button type="button" class="pick ${selected.has(person.id) ? "on" : ""}" data-act="pick-split" data-id="${person.id}">${person.name}</button>`).join("")}</div><label>备注</label><input id="f-note" value="${preset.note || ""}" placeholder="可选"><button class="btn block" data-act="save-expense">保存账单</button><button class="btn ghost block" data-act="close-sheet">取消</button>`);
}
function formRule() { openSheet(`<h3>新增公约</h3><label>标题</label><input id="f-title" placeholder="例如 浴室不超过 20 分钟"><label>内容</label><textarea id="f-body" placeholder="写清楚边界，方便全员确认"></textarea><button class="btn block" data-act="save-rule">发布并等待确认</button><button class="btn ghost block" data-act="close-sheet">取消</button>`); }
function formUse(item) {
  const consumables = state.items.filter(entry => entry.kind === "consumable" && itemStatus(entry) !== "scrapped");
  const selected = item || consumables[0];
  openSheet(`<h3>消耗品领用</h3><label>物品</label><select id="f-use-item" class="field">${consumables.map(entry => `<option value="${entry.id}" ${entry.id === selected?.id ? "selected" : ""}>${entry.name}（剩余 ${entry.quantity}${entry.unit}）</option>`).join("")}</select><label>领用人</label><select id="f-use-user" class="field">${activeMembers().map(person => `<option value="${person.id}" ${person.id === me().id ? "selected" : ""}>${person.name}</option>`).join("")}</select><label>领用数量</label><input id="f-use-quantity" type="number" min="1" step="1" value="1"><label>用途或说明</label><input id="f-note" placeholder="例如 日常使用"><button class="btn block" data-act="save-use">确认领用</button><button class="btn ghost block" data-act="close-sheet">取消</button>`);
}
function formItem(item) {
  const sheet = document.getElementById("sheet");
  if (item) sheet.dataset.itemId = item.id;
  else delete sheet.dataset.itemId;
  const selectedKind = item?.kind || "consumable";
  openSheet(`<h3>${item ? "编辑公共物品" : "添加公共物品"}</h3><label>物品名称 *</label><input id="f-title" value="${item?.name || ""}" placeholder="例如 抽纸"><label>类型 *</label><div class="people" id="f-kind"><button type="button" class="pick ${selectedKind === "consumable" ? "on" : ""}" data-act="pick-kind" data-id="consumable">消耗品</button><button type="button" class="pick ${selectedKind === "appliance" ? "on" : ""}" data-act="pick-kind" data-id="appliance">电器</button></div><label>归属 *</label><div class="people" id="f-owner-type"><button type="button" class="pick ${item?.ownerType !== "个人贡献" ? "on" : ""}" data-act="pick-owner-type" data-id="公共购买">公共购买</button><button type="button" class="pick ${item?.ownerType === "个人贡献" ? "on" : ""}" data-act="pick-owner-type" data-id="个人贡献">个人贡献</button></div><div class="grid2"><div><label>当前数量</label><input id="f-item-quantity" type="number" min="0" step="1" value="${item?.quantity ?? 1}"></div><div><label>单位</label><input id="f-item-unit" value="${item?.unit || "个"}" placeholder="个/包/台"></div></div><div class="grid2"><div><label>补货提醒线</label><input id="f-item-threshold" type="number" min="0" step="1" value="${item?.threshold ?? 1}"></div><div><label>存放位置</label><input id="f-item-location" value="${item?.location || ""}" placeholder="例如 客厅柜"></div></div><label>购买人</label><select id="f-item-purchaser" class="field">${activeMembers().map(person => `<option value="${person.id}" ${person.id === (item?.purchasedBy || me().id) ? "selected" : ""}>${person.name}</option>`).join("")}</select><div class="grid2"><div><label>购买日期</label><input id="f-item-date" type="date" value="${item?.purchasedAt || today()}"></div><div><label>价格</label><input id="f-item-price" type="number" min="0" step="0.01" value="${item?.price || ""}" placeholder="可选"></div></div><label>物品照片</label><input id="f-item-photo" type="file" accept="image/*" capture="environment"><div id="item-photo-preview" class="photo-preview">${item?.photo ? `<img src="${item.photo}" alt="物品照片预览">` : "可选，用于识别物品"}</div><label>备注</label><textarea id="f-note" placeholder="可填写规格、使用说明等">${item?.note || ""}</textarea><button class="btn block" data-act="save-item">${item ? "保存修改" : "添加物品"}</button><button class="btn ghost block" data-act="close-sheet">取消</button>`);
}
function borrowItem(item) {
  if (!item) { toast("暂无可使用电器"); return; }
  if (item.usingBy) { toast(`${member(item.usingBy)?.name || "成员"} 正在使用`); return; }
  if (item.condition !== "ok") { toast("该电器当前不可使用"); return; }
  item.usingBy = me().id;
  item.borrowedAt = today();
  item.dueAt = addDays(today(), 7);
  item.logs.unshift({ at: today(), userId: me().id, text: `开始使用，预计 ${item.dueAt} 归还` });
  state.notifications.unshift({ id: uid("n"), title: `${me().name} 开始使用${item.name}`, createdAt: today(), read: false });
  toast(`${item.name} 开始使用，7 天后提醒归还`);
  render();
}
function returnItem(item) {
  if (!item?.usingBy) { toast("这台电器当前未在使用"); return; }
  const borrower = member(item.usingBy);
  item.usingBy = "";
  item.borrowedAt = "";
  item.dueAt = "";
  item.condition = "ok";
  item.issueNote = "";
  item.logs.unshift({ at: today(), userId: me().id, text: `归还 · 完好${borrower ? ` · ${borrower.name}` : ""}` });
  state.notifications.unshift({ id: uid("n"), title: `${me().name} 归还了${item.name}`, createdAt: today(), read: false });
  toast(`${item.name} 已归还`);
  render();
}
function formStockIn(item) {
  const consumables = state.items.filter(entry => entry.kind === "consumable" && itemStatus(entry) !== "scrapped");
  const selected = item || consumables[0];
  openSheet(`<h3>采购入库</h3><label>物品</label><select id="f-stock-item" class="field">${consumables.map(entry => `<option value="${entry.id}" ${entry.id === selected?.id ? "selected" : ""}>${entry.name}（当前 ${entry.quantity}${entry.unit}）</option>`).join("")}</select><label>采购人</label><select id="f-stock-user" class="field">${activeMembers().map(person => `<option value="${person.id}" ${person.id === me().id ? "selected" : ""}>${person.name}</option>`).join("")}</select><label>入库数量</label><input id="f-stock-quantity" type="number" min="1" step="1" value="1"><label>采购金额</label><input id="f-stock-price" type="number" min="0" step="0.01" placeholder="可选"><label class="check-label"><input id="f-stock-public" type="checkbox" checked> 作为公共支出同步记账</label><button class="btn block" data-act="save-stock-in">确认入库</button><button class="btn ghost block" data-act="close-sheet">取消</button>`);
}
function formArchiveItem(item) {
  openSheet(`<h3>报废物品</h3><p class="sheet-copy">确定将“${item.name}”标记为报废吗？历史使用记录会保留。</p><button class="btn danger block" data-act="save-archive-item" data-id="${item.id}">确认报废</button><button class="btn ghost block" data-act="close-sheet">取消</button>`);
}
function readPhoto(file, callback) {
  if (!file) { callback(""); return; }
  const reader = new FileReader();
  reader.onload = () => callback(reader.result);
  reader.readAsDataURL(file);
}
function weekdayOptions(selected) {
  return ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((label, index) => `<option value="${index}" ${index === selected ? "selected" : ""}>${label}</option>`).join("");
}
function formChore(chore) {
  const sheet = document.getElementById("sheet");
  if (chore) sheet.dataset.choreId = chore.id;
  else delete sheet.dataset.choreId;
  const selected = new Set(chore?.memberIds || activeMembers().map(person => person.id));
  openSheet(`<h3>${chore ? "调整排班任务" : "添加值日任务"}</h3><label>任务名称</label><input id="f-chore-title" value="${chore?.area || ""}" placeholder="例如 厨房清洁"><div class="grid2"><div><label>频率</label><select id="f-chore-frequency" class="field"><option value="weekly" ${chore?.frequency !== "biweekly" ? "selected" : ""}>每周一次</option><option value="biweekly" ${chore?.frequency === "biweekly" ? "selected" : ""}>每两周一次</option></select></div><div><label>安排在</label><select id="f-chore-weekday" class="field">${weekdayOptions(chore?.weekday ?? 5)}</select></div></div><label>轮值成员</label><div class="people" id="f-chore-members">${activeMembers().map(person => `<button type="button" class="pick ${selected.has(person.id) ? "on" : ""}" data-act="pick-chore-member" data-id="${person.id}">${person.name}</button>`).join("")}</div><div class="sheet-hint">任务会按成员顺序轮换，并自动同步到值日日历。</div><button class="btn block" data-act="save-chore">${chore ? "保存排班" : "添加排班"}</button>${chore ? `<button class="btn ghost block" data-act="delete-chore">删除任务</button>` : ""}<button class="btn ghost block" data-act="close-sheet">取消</button>`);
}
function formDeleteChore(chore) {
  const sheet = document.getElementById("sheet");
  sheet.dataset.choreId = chore.id;
  openSheet(`<h3>删除值日任务</h3><p class="sheet-copy">确定删除“${chore.area}”吗？删除后不再生成后续排班，历史打卡记录不受影响。</p><button class="btn danger block" data-act="delete-chore">确认删除</button><button class="btn ghost block" data-act="close-sheet">取消</button>`);
}
function formChoreCheckin(chore) {
  openSheet(`<h3>${chore.area} · 值日打卡</h3><p class="sheet-copy">请上传完成后的现场照片作为证明，支持拍照或从相册选择。</p><label class="photo-upload">上传照片<input id="f-chore-photo" type="file" accept="image/*" capture="environment"></label><div id="chore-photo-preview" class="photo-preview">暂未选择照片</div><button class="btn block" data-act="save-chore-checkin" data-id="${chore.id}">提交打卡</button><button class="btn ghost block" data-act="close-sheet">取消</button>`);
}
function formChoreSettings() {
  openSheet(`<h3>排班设置</h3><p class="sheet-copy">按真实生活节奏设置任务频率、固定星期和参与成员。</p><div class="schedule-manage-list">${state.chores.map(chore => `<button class="schedule-manage-row" data-act="edit-chore" data-id="${chore.id}"><div><b>${chore.area}</b><span>${chore.frequency === "biweekly" ? "每两周" : "每周"} · ${["周一", "周二", "周三", "周四", "周五", "周六", "周日"][chore.weekday]} · ${names(chore.memberIds)}</span></div><i>›</i></button>`).join("") || `<div class="empty">暂未添加值日任务</div>`}</div><button class="btn block" data-act="add-chore">添加值日任务</button><button class="btn ghost block" data-act="close-sheet">完成</button>`);
}
function formMember(person) {
  const sheet = document.getElementById("sheet");
  if (person) sheet.dataset.memberId = person.id;
  else delete sheet.dataset.memberId;
  openSheet(`<h3>${person ? "修改成员资料" : "添加成员"}</h3><label>昵称</label><input id="f-title" value="${person?.name || ""}" placeholder="例如 小叶"><label>性别</label><select id="f-gender" class="field"><option ${person?.gender === "男" ? "selected" : ""}>男</option><option ${person?.gender === "女" ? "selected" : ""}>女</option><option ${!person || person?.gender === "未设置" ? "selected" : ""}>未设置</option></select><label>房间</label><input id="f-note" value="${person?.room || ""}" placeholder="例如 次卧 C"><button class="btn block" data-act="save-member">${person ? "保存修改" : "添加成员"}</button><button class="btn ghost block" data-act="close-sheet">取消</button>`);
}
function formCreateRoom() {
  openSheet(`<h3>创建房间</h3><p class="sheet-copy">创建后会生成邀请码，可分享给室友加入。</p><label>房间名称</label><input id="f-title" placeholder="例如 梧桐里 3 室"><label>我的昵称</label><input id="f-member-name" value="${me().name === "我" ? "" : me().name}" placeholder="例如 小叶"><label>我的房间</label><input id="f-note" value="${me().room || ""}" placeholder="例如 主卧"><button class="btn block" data-act="save-create-room">创建并进入</button><button class="btn ghost block" data-act="close-sheet">取消</button>`);
}
function formRoomInfo() {
  const info = state.roomInfo;
  openSheet(`<h3>编辑房间资料</h3><label>房间名称</label><input id="f-room-name" value="${state.house}" placeholder="例如 梧桐里 3 室"><label>房间地址</label><input id="f-room-address" value="${info.address || ""}" placeholder="例如 杭州市西湖区梧桐里 8 幢 302"><div class="grid2"><div><label>户型</label><input id="f-room-layout" value="${info.layout || ""}" placeholder="例如 3 室 1 厅 1 卫"></div><div><label>入住日期</label><input id="f-room-date" type="date" value="${info.moveInDate || ""}"></div></div><label>房间邀请码</label><input id="f-room-code" value="${info.inviteCode || ""}" placeholder="例如 WTL302"><label>房间说明</label><textarea id="f-room-note" placeholder="可填写门禁、快递、维修等共享说明">${info.note || ""}</textarea><button class="btn block" data-act="save-room-info">保存资料</button><button class="btn ghost block" data-act="close-sheet">取消</button>`);
}
function formJoinRoom() {
  openSheet(`<h3>加入房间</h3><p class="sheet-copy">输入室友分享的邀请码，完成加入后即可开始使用房间共享功能。</p><label>房间邀请码</label><input id="f-code" placeholder="输入室友分享的邀请码"><label>我的昵称</label><input id="f-member-name" value="${me().name === "我" ? "" : me().name}" placeholder="例如 小叶"><label>我的房间</label><input id="f-note" value="${me().room || ""}" placeholder="例如 次卧 A"><button class="btn block" data-act="save-join-room">加入房间</button><button class="btn ghost block" data-act="close-sheet">取消</button>`);
}

document.getElementById("houseName").addEventListener("dblclick", resetData);
document.getElementById("userSwitch").addEventListener("change", event => { state.currentUserId = event.target.value; render(); });
document.getElementById("tabs").addEventListener("click", event => { const button = event.target.closest("[data-tab]"); if (button) { tab = button.dataset.tab; render(); } });
document.getElementById("view").addEventListener("click", act);
document.getElementById("guideOverlay").addEventListener("click", act);
document.getElementById("view").addEventListener("change", event => {
  if (event.target.id === "report-month-select") {
    reportMonth = event.target.value;
    render();
  }
});
document.getElementById("sheet").addEventListener("click", act);
document.getElementById("sheet").addEventListener("change", event => {
  const previewId = event.target.id === "f-chore-photo" ? "chore-photo-preview" : event.target.id === "f-item-photo" ? "item-photo-preview" : event.target.id === "f-return-photo" ? "return-photo-preview" : "";
  if (!previewId || !event.target.files[0]) return;
  const reader = new FileReader();
  reader.onload = () => { document.getElementById(previewId).innerHTML = `<img src="${reader.result}" alt="照片预览">`; };
  reader.readAsDataURL(event.target.files[0]);
});

function resetData() { state = seed(); localStorage.removeItem(KEY); tab = "home"; mineView = "overview"; choreView = "main"; toast("已重置演示数据"); render(); }
function startOnboarding() {
  state = emptyState();
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_KEY);
  tab = "home";
  mineView = "overview";
  choreView = "main";
  toast("已进入新用户引导");
  render();
}
function act(event) {
  const button = event.target.closest("[data-act]");
  if (!button) { if (event.target.id === "sheet") closeSheet(); return; }
  const action = button.dataset.act;
  const id = button.dataset.id;
  if (action === "goto") { tab = button.dataset.tab; if (button.dataset.mine) mineView = button.dataset.mine; render(); return; }
  if (action === "home-view") { homeView = button.dataset.view; render(); return; }
  if (action === "home-back") { homeView = "main"; render(); return; }
  if (action === "money-view") { moneyView = button.dataset.view; render(); return; }
  if (action === "report-month") { reportMonth = button.dataset.month; render(); return; }
  if (action === "chore-view") { choreView = button.dataset.view; render(); return; }
  if (action === "chore-back") { choreView = "main"; render(); return; }
  if (action === "select-chore-date") { selectedChoreDate = button.dataset.date; render(); return; }
  if (action === "move-calendar") {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + Number(button.dataset.direction), 1, 12);
    selectedChoreDate = calendarIso(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1));
    render();
    return;
  }
  if (action === "item-view") { itemView = button.dataset.view; render(); return; }
  if (action === "item-back") { itemView = "list"; selectedItemId = ""; render(); return; }
  if (action === "view-item-detail") { selectedItemId = id; itemView = "detail"; render(); return; }
  if (action === "mine-view") { mineView = button.dataset.view; render(); return; }
  if (action === "mine-back") { mineView = "overview"; render(); return; }
  if (action === "open-report-stats") return formReportStats();
  if (action === "open-expense") return formExpense();
  if (action === "open-rule") return formRule();
  if (action === "open-item") return formItem();
  if (action === "edit-item") return formItem(state.items.find(item => item.id === id));
  if (action === "open-borrow") return borrowItem(state.items.find(item => item.id === id));
  if (action === "open-return") return returnItem(state.items.find(item => item.id === id));
  if (action === "open-stock-in") return formStockIn(state.items.find(item => item.id === id));
  if (action === "archive-item") return formArchiveItem(state.items.find(item => item.id === id));
  if (action === "open-member") return formMember();
  if (action === "open-room-info") return formRoomInfo();
  if (action === "open-chore-settings") return formChoreSettings();
  if (action === "edit-chore") return formChore(state.chores.find(chore => chore.id === id));
  if (action === "add-chore") return formChore();
  if (action === "confirm-delete-chore") return formDeleteChore(state.chores.find(chore => chore.id === id));
  if (action === "open-create-room") return formCreateRoom();
  if (action === "open-join-room") return formJoinRoom();
  if (action === "load-demo") { state = seed(); tab = "home"; toast("已进入演示房间"); render(); return; }
  if (action === "show-feature-guide") return startFeatureGuide();
  if (action === "skip-feature-guide") {
    state.onboardingCompleted = true;
    closeFeatureGuide();
    tab = "home";
    render();
    return;
  }
  if (action === "next-feature-guide") {
    if (guideStep === GUIDE_STEPS.length - 1) {
      state.onboardingCompleted = true;
      closeFeatureGuide();
      tab = "home";
      toast("开始管理你的房间吧");
      render();
      return;
    }
    guideStep += 1;
    return showFeatureGuide();
  }
  if (action === "edit-member") return formMember(member(id));
  if (action === "delete-member") {
    const person = member(id);
    if (person.id === me().id) { toast("当前身份不能移除"); return; }
    person.active = false;
    state.chores.forEach(chore => {
      chore.memberIds = chore.memberIds.filter(memberId => memberId !== person.id);
    });
    state.notifications.unshift({ id: uid("n"), title: `${person.name} 已退出当前房间`, createdAt: today(), read: false });
    toast(`${person.name} 已移出房间`);
    render();
    return;
  }
  if (action === "close-sheet") return closeSheet();
  if (action === "pick-split") { button.classList.toggle("on"); return; }
  if (action === "pick-chore-member") { button.classList.toggle("on"); return; }
  if (action === "pick-status" || action === "pick-kind" || action === "pick-owner-type" || action === "pick-return-condition") { button.parentElement.querySelectorAll(".pick").forEach(item => item.classList.remove("on")); button.classList.add("on"); return; }
  if (action === "pay") { const expense = state.expenses.find(item => item.id === id); if (!expense.paidIds.includes(me().id)) expense.paidIds.push(me().id); toast("已记下你的这份"); render(); return; }
  if (action === "collect") { const expense = state.expenses.find(item => item.id === id); expense.paidIds = [...new Set([...expense.splitIds, expense.payerId])]; toast("这笔已收齐"); render(); return; }
  if (action === "settle-all") { state.expenses.forEach(expense => { expense.paidIds = [...new Set([...expense.splitIds, expense.payerId])]; }); toast("未结账单已全部结清"); render(); return; }
  if (action === "done-chore") return formChoreCheckin(state.chores.find(item => item.id === id));
  if (action === "read-rule") { const rule = state.rules.find(item => item.id === id); if (!rule.readIds.includes(me().id)) rule.readIds.push(me().id); toast("公约已确认"); render(); return; }
  if (action === "read-notifications") { state.notifications.forEach(note => { note.read = true; }); toast("通知已全部标为已读"); render(); return; }
  if (action === "reset-data") return resetData();
  if (action === "start-onboarding") return startOnboarding();
  if (action === "restock") return formStockIn(state.items.find(item => item.id === id));
  if (action === "toggle-use") {
    const item = state.items.find(entry => entry.id === id);
    if (item.usingBy) return returnItem(item);
    return borrowItem(item);
  }
  if (action === "quick-return") {
    const item = state.items.find(entry => entry.id === id);
    return returnItem(item);
  }
  if (action === "save-expense") {
    const title = document.getElementById("f-title").value.trim();
    const amount = Number(document.getElementById("f-amount").value);
    const createdAt = document.getElementById("f-expense-date").value;
    const splitIds = [...document.querySelectorAll("#f-split .pick.on")].map(item => item.dataset.id);
    if (!title || !amount || !createdAt || !splitIds.length) { toast("请填写名称、金额、日期和分摊人"); return; }
    const payerId = document.getElementById("f-payer").value;
    const itemId = document.getElementById("sheet").dataset.itemId || "";
    state.expenses.unshift({ id: uid("e"), title, amount, category: document.getElementById("f-cat").value, payerId, splitIds, paidIds: [payerId], note: document.getElementById("f-note").value.trim(), createdAt, itemId });
    state.notifications.unshift({ id: uid("n"), title: `${me().name} 新增了账单：${title}`, createdAt: today(), read: false });
    closeSheet(); tab = "money"; moneyView = "bills"; toast("账单已记下"); render(); return;
  }
  if (action === "save-rule") {
    const title = document.getElementById("f-title").value.trim();
    const body = document.getElementById("f-body").value.trim();
    if (!title || !body) { toast("标题和内容都要写"); return; }
    state.rules.unshift({ id: uid("r"), title, body, createdBy: me().id, createdAt: today(), readIds: [me().id] });
    closeSheet(); tab = "mine"; mineView = "rules"; toast("公约已发布，等室友确认"); render(); return;
  }
  if (action === "save-use") {
    const item = state.items.find(entry => entry.id === document.getElementById("f-use-item").value);
    const quantity = Number(document.getElementById("f-use-quantity").value);
    const userId = document.getElementById("f-use-user").value;
    if (!item || !quantity || quantity < 1) { toast("请填写领用数量"); return; }
    if (quantity > Number(item.quantity)) { toast(`库存只有 ${item.quantity}${item.unit}`); return; }
    item.quantity -= quantity;
    item.logs.unshift({ at: today(), userId, text: `领用 ${quantity}${item.unit}${document.getElementById("f-note").value.trim() ? ` · ${document.getElementById("f-note").value.trim()}` : ""}` });
    closeSheet(); toast(`${item.name} 已领用`); render(); return;
  }
  if (action === "save-item") {
    const name = document.getElementById("f-title").value.trim();
    if (!name) { toast("请填写物品名称"); return; }
    const sheet = document.getElementById("sheet");
    const itemId = sheet.dataset.itemId;
    const photo = document.getElementById("f-item-photo").files[0];
    const payload = {
      name,
      kind: document.querySelector("#f-kind .pick.on").dataset.id,
      category: document.querySelector("#f-kind .pick.on").dataset.id === "consumable" ? "消耗品" : "电器",
      ownerType: document.querySelector("#f-owner-type .pick.on").dataset.id,
      quantity: Number(document.getElementById("f-item-quantity").value) || 0,
      unit: document.getElementById("f-item-unit").value.trim() || "个",
      threshold: Number(document.getElementById("f-item-threshold").value) || 0,
      location: document.getElementById("f-item-location").value.trim(),
      purchasedBy: document.getElementById("f-item-purchaser").value,
      purchasedAt: document.getElementById("f-item-date").value,
      price: document.getElementById("f-item-price").value,
      note: document.getElementById("f-note").value.trim()
    };
    readPhoto(photo, dataUrl => {
      if (itemId) {
        const item = state.items.find(entry => entry.id === itemId);
        Object.assign(item, payload);
        if (dataUrl) item.photo = dataUrl;
        item.logs ||= [];
        closeSheet(); itemView = "detail"; selectedItemId = itemId; toast("物品资料已更新"); render();
        return;
      }
      state.items.unshift({ id: uid("i"), ...payload, usingBy: "", borrowedAt: "", dueAt: "", condition: "ok", logs: [], photo: dataUrl });
      closeSheet(); itemView = "list"; toast("已添加公共物品"); render();
    });
    return;
  }
  if (action === "save-stock-in") {
    const item = state.items.find(entry => entry.id === document.getElementById("f-stock-item").value);
    const purchaserId = document.getElementById("f-stock-user").value;
    const quantity = Number(document.getElementById("f-stock-quantity").value);
    const price = Number(document.getElementById("f-stock-price").value) || 0;
    if (!item || !quantity || quantity < 1) { toast("请填写入库数量"); return; }
    item.quantity = Number(item.quantity) + quantity;
    item.condition = "ok";
    item.logs.unshift({ at: today(), userId: purchaserId, text: `采购入库 ${quantity}${item.unit}` });
    if (document.getElementById("f-stock-public").checked && price > 0) {
      state.expenses.unshift({ id: uid("e"), title: `采购 ${item.name}`, amount: price, category: "日用", payerId: purchaserId, splitIds: activeMembers().map(person => person.id), paidIds: [purchaserId], note: "公共物品采购入库", createdAt: today(), itemId: item.id });
      state.notifications.unshift({ id: uid("n"), title: `${member(purchaserId).name} 采购了${item.name}`, createdAt: today(), read: false });
    }
    closeSheet(); toast(`${item.name} 已入库 ${quantity}${item.unit}`); render(); return;
  }
  if (action === "save-archive-item") {
    const item = state.items.find(entry => entry.id === id);
    if (!item) return;
    item.condition = "scrapped";
    item.usingBy = "";
    item.dueAt = "";
    item.logs.unshift({ at: today(), userId: me().id, text: "标记为报废" });
    closeSheet(); itemView = "list"; toast(`${item.name} 已标记报废`); render(); return;
  }
  if (action === "save-chore") {
    const area = document.getElementById("f-chore-title").value.trim();
    const memberIds = [...document.querySelectorAll("#f-chore-members .pick.on")].map(item => item.dataset.id);
    if (!area || !memberIds.length) { toast("请填写任务名称并选择轮值成员"); return; }
    const frequency = document.getElementById("f-chore-frequency").value;
    const weekday = Number(document.getElementById("f-chore-weekday").value);
    const choreId = document.getElementById("sheet").dataset.choreId;
    if (choreId) {
      const chore = state.chores.find(item => item.id === choreId);
      chore.area = area;
      chore.frequency = frequency;
      chore.intervalWeeks = frequency === "biweekly" ? 2 : 1;
      chore.weekday = weekday;
      chore.memberIds = memberIds;
      delete document.getElementById("sheet").dataset.choreId;
      closeSheet();
      toast("排班已更新");
      render();
      return;
    }
    state.chores.push({ id: uid("c"), area, cycle: "weekly", frequency, intervalWeeks: frequency === "biweekly" ? 2 : 1, weekday, memberIds, offset: 0, donePeriod: "" });
    closeSheet();
    toast("值日任务已添加");
    render();
    return;
  }
  if (action === "save-chore-checkin") {
    const chore = state.chores.find(item => item.id === id);
    const photo = document.getElementById("f-chore-photo")?.files[0];
    if (!photo) { toast("请先上传值日照片"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      chore.donePeriod = periodKey(chore);
      chore.proof = { dataUrl: reader.result, at: today(), userId: me().id };
      state.notifications.unshift({ id: uid("n"), title: `${me().name} 完成了${chore.area}值日`, createdAt: today(), read: false });
      closeSheet();
      toast(`${chore.area} 已完成并上传证明`);
      render();
    };
    reader.readAsDataURL(photo);
    return;
  }
  if (action === "delete-chore") {
    const choreId = document.getElementById("sheet").dataset.choreId;
    state.chores = state.chores.filter(chore => chore.id !== choreId);
    closeSheet();
    toast("值日任务已删除");
    render();
    return;
  }
  if (action === "save-member") {
    const name = document.getElementById("f-title").value.trim();
    if (!name) { toast("请填写成员昵称"); return; }
    const colors = ["#6d4c9a", "#266f8f", "#a04d55", "#687332"];
    const memberId = document.getElementById("sheet").dataset.memberId;
    if (memberId) {
      const person = member(memberId);
      person.name = name;
      person.gender = document.getElementById("f-gender").value;
      person.room = document.getElementById("f-note").value.trim();
      delete document.getElementById("sheet").dataset.memberId;
      closeSheet();
      mineView = "members";
      toast("成员资料已更新");
      render();
      return;
    }
    state.members.push({ id: uid("u"), name, gender: document.getElementById("f-gender").value, room: document.getElementById("f-note").value.trim(), color: colors[state.members.length % colors.length], joinedAt: today(), active: true });
    closeSheet(); mineView = "members"; toast("已添加成员"); render();
    return;
  }
  if (action === "save-create-room") {
    const roomName = document.getElementById("f-title").value.trim();
    if (!roomName) { toast("请填写房间名称"); return; }
    state.house = roomName;
    state.roomJoined = true;
    me().name = document.getElementById("f-member-name").value.trim() || "我";
    me().room = document.getElementById("f-note").value.trim() || "未分配房间";
    state.roomInfo = { address: "", layout: "", moveInDate: today(), inviteCode: uid("RM").toUpperCase().slice(-6), note: "" };
    closeSheet();
    toast("房间已创建");
    startFeatureGuide();
    return;
  }
  if (action === "save-room-info") {
    const roomName = document.getElementById("f-room-name").value.trim();
    if (!roomName) { toast("请填写房间名称"); return; }
    state.house = roomName;
    state.roomInfo = {
      address: document.getElementById("f-room-address").value.trim(),
      layout: document.getElementById("f-room-layout").value.trim(),
      moveInDate: document.getElementById("f-room-date").value,
      inviteCode: document.getElementById("f-room-code").value.trim(),
      note: document.getElementById("f-room-note").value.trim()
    };
    closeSheet();
    mineView = "room";
    toast("房间资料已更新");
    render();
    return;
  }
  if (action === "save-join-room") {
    const code = document.getElementById("f-code").value.trim();
    if (!code) { toast("请输入邀请码"); return; }
    state.house = `合租房间 · ${code.toUpperCase()}`;
    state.roomJoined = true;
    me().name = document.getElementById("f-member-name").value.trim() || "我";
    me().room = document.getElementById("f-note").value.trim() || "未分配房间";
    state.roomInfo = { ...state.roomInfo, inviteCode: code.toUpperCase(), moveInDate: state.roomInfo.moveInDate || today() };
    closeSheet();
    toast("已加入房间");
    startFeatureGuide();
  }
}

render();
