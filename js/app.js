const KEY = "roommate-housekeeper-mvp-v1";
const TABS = [
  { id: "today", ico: "◎", lab: "今日" },
  { id: "money", ico: "¥", lab: "费用" },
  { id: "chore", ico: "◇", lab: "值日" },
  { id: "item", ico: "▢", lab: "物品" },
  { id: "rule", ico: "§", lab: "公约" }
];
const CATS = ["房租", "水电", "餐饮", "日用", "其他"];
const ITEM_STATUS = {
  ok: { lab: "充足", tag: "" },
  low: { lab: "不多了", tag: "gold" },
  empty: { lab: "用完了", tag: "warn" }
};

let state = load() || seed();
let tab = "today";

function uid(prefix) {
  return prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function monday(iso) {
  const d = new Date(iso + "T12:00:00");
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtMoney(n) {
  return "¥" + Number(n).toFixed(2).replace(/\.00$/, "");
}
function member(id) { return state.members.find(m => m.id === id); }
function me() { return member(state.currentUserId); }
function names(ids) { return ids.map(id => member(id).name).join("、"); }
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || ""); }
  catch { return null; }
}
function toast(text) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.style.display = "none", 1600);
}

function seed() {
  const members = [
    { id: "u1", name: "阿哲", color: "#2f6a58" },
    { id: "u2", name: "小满", color: "#c45c26" },
    { id: "u3", name: "老K", color: "#3d5a80" }
  ];
  const all = members.map(m => m.id);
  return {
    house: "梧桐里 3 室",
    currentUserId: "u1",
    members,
    expenses: [
      { id: "e1", title: "9月房租", amount: 4500, category: "房租", payerId: "u1", splitIds: all, paidIds: ["u1"], note: "转给房东截止5号", createdAt: "2026-09-01" },
      { id: "e2", title: "8月电费", amount: 186, category: "水电", payerId: "u2", splitIds: all, paidIds: ["u2"], note: "峰谷电合计", createdAt: "2026-09-08" },
      { id: "e3", title: "空气炸锅纸盘", amount: 29.9, category: "日用", payerId: "u3", splitIds: all, paidIds: ["u1","u2","u3"], note: "", createdAt: "2026-09-06" }
    ],
    chores: [
      { id: "c1", area: "厨房", cycle: "weekly", memberIds: all, offset: 0, donePeriod: "" },
      { id: "c2", area: "卫生间", cycle: "weekly", memberIds: all, offset: 1, donePeriod: monday(today()) },
      { id: "c3", area: "客厅", cycle: "weekly", memberIds: all, offset: 2, donePeriod: "" },
      { id: "c4", area: "倒垃圾", cycle: "daily", memberIds: all, offset: 1, donePeriod: "" }
    ],
    items: [
      { id: "i1", name: "抽纸", kind: "consumable", status: "low", note: "客厅只剩 1 提", usingBy: "", logs: [{ at: "2026-09-10", userId: "u2", text: "用掉客厅最后半提" }] },
      { id: "i2", name: "洗洁精", kind: "consumable", status: "ok", note: "水槽下方", usingBy: "", logs: [] },
      { id: "i3", name: "垃圾袋", kind: "consumable", status: "empty", note: "需要补大号", usingBy: "", logs: [{ at: "2026-09-12", userId: "u3", text: "用完了" }] },
      { id: "i4", name: "洗衣机", kind: "durable", status: "ok", note: "阳台滚筒", usingBy: "", logs: [] },
      { id: "i5", name: "空气炸锅", kind: "durable", status: "ok", note: "厨房台面", usingBy: "u2", logs: [{ at: "2026-09-12", userId: "u2", text: "开始使用" }] }
    ],
    rules: [
      { id: "r1", title: "23:30 后客厅小声", body: "戴耳机、关门说话，不在客厅打电话。临时加班提前群里说一声。", createdBy: "u1", createdAt: "2026-08-20", readIds: ["u2","u3"] },
      { id: "r2", title: "公共食物要写名字", body: "没写名字默认可共享。个人饮料放第一层，过期当天晚上处理。", createdBy: "u2", createdAt: "2026-08-20", readIds: ["u1","u2","u3"] },
      { id: "r3", title: "客人过夜提前说", body: "提前一天告知。公共区域不堆行李，卫生间不超过 20 分钟。", createdBy: "u3", createdAt: "2026-09-01", readIds: ["u1","u2","u3"] }
    ]
  };
}

function periodKey(chore) {
  return chore.cycle === "daily" ? today() : monday(today());
}
function periodIndex(chore) {
  const key = periodKey(chore);
  const start = new Date("2026-01-05T12:00:00");
  const cur = new Date(key + "T12:00:00");
  const days = Math.round((cur - start) / 86400000);
  return chore.cycle === "daily" ? days : Math.floor(days / 7);
}
function assignee(chore) {
  const i = Math.abs(periodIndex(chore) + chore.offset) % chore.memberIds.length;
  return chore.memberIds[i];
}
function choreDone(chore) { return chore.donePeriod === periodKey(chore); }
function share(exp) { return exp.amount / exp.splitIds.length; }
function expSettled(exp) {
  return exp.splitIds.every(id => id === exp.payerId || exp.paidIds.includes(id));
}
function owes(exp, userId) {
  return exp.splitIds.includes(userId) && userId !== exp.payerId && !exp.paidIds.includes(userId);
}
function netMap() {
  const net = Object.fromEntries(state.members.map(m => [m.id, 0]));
  state.expenses.forEach(exp => {
    if (expSettled(exp)) return;
    const s = share(exp);
    exp.splitIds.forEach(id => {
      if (id === exp.payerId || exp.paidIds.includes(id)) return;
      net[id] -= s;
      net[exp.payerId] += s;
    });
  });
  return net;
}
function transfers() {
  const debtors = [], creditors = [];
  state.members.forEach(m => {
    const v = Math.round(netMap()[m.id] * 100) / 100;
    if (v < -0.009) debtors.push({ id: m.id, amt: -v });
    if (v > 0.009) creditors.push({ id: m.id, amt: v });
  });
  const list = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    list.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].amt -= pay; creditors[j].amt -= pay;
    if (debtors[i].amt < 0.01) i++;
    if (creditors[j].amt < 0.01) j++;
  }
  return list;
}
function todos() {
  const uid = state.currentUserId;
  const list = [];
  state.expenses.filter(e => owes(e, uid)).forEach(e => list.push({
    type: "money", title: "待付 " + e.title, meta: `付给${member(e.payerId).name} · 你的份额 ${fmtMoney(share(e))}`, id: e.id, warn: true
  }));
  state.chores.filter(c => assignee(c) === uid && !choreDone(c)).forEach(c => list.push({
    type: "chore", title: "值日 · " + c.area, meta: c.cycle === "daily" ? "今日完成即可" : "本周完成即可", id: c.id, warn: false
  }));
  state.items.filter(it => it.status !== "ok" || it.usingBy === uid).forEach(it => list.push({
    type: "item",
    title: it.status === "empty" ? it.name + " 用完了" : it.status === "low" ? it.name + " 不多了" : "你正在用 " + it.name,
    meta: it.note || "去物品页标记或补货",
    id: it.id, warn: it.status !== "ok"
  }));
  state.rules.filter(r => !r.readIds.includes(uid)).forEach(r => list.push({
    type: "rule", title: "未确认公约", meta: r.title, id: r.id, warn: true
  }));
  return list;
}

function render() {
  document.getElementById("houseName").textContent = state.house;
  const user = me();
  const av = document.getElementById("meAvatar");
  av.style.background = user.color;
  av.textContent = user.name.slice(-1);
  const sel = document.getElementById("userSwitch");
  sel.innerHTML = state.members.map(m => `<option value="${m.id}" ${m.id===user.id?"selected":""}>${m.name}</option>`).join("");
  document.getElementById("tabs").innerHTML = TABS.map(t =>
    `<button data-tab="${t.id}" class="${t.id===tab?"active":""}"><span class="ico">${t.ico}</span><span class="lab">${t.lab}</span></button>`
  ).join("");
  const view = document.getElementById("view");
  view.innerHTML = ({ today: viewToday, money: viewMoney, chore: viewChore, item: viewItem, rule: viewRule })[tab]();
  save();
}

function viewToday() {
  const list = todos();
  const pay = list.filter(x => x.type === "money").length;
  const chore = list.filter(x => x.type === "chore").length;
  const unread = list.filter(x => x.type === "rule").length;
  return `
    <section class="hero">
      <div class="house-kicker">TODAY · ${today()}</div>
      <b>${list.length ? "还有 " + list.length + " 件要处理" : "今天都齐了"}</b>
      <p>${list.length ? "先把钱、值和公约过一遍，公共物品缺的再补。" : "费用已跟上，值日和公约也都确认过了。"}</p>
      <div class="chips">
        <span class="chip">待付 ${pay}</span>
        <span class="chip">值日 ${chore}</span>
        <span class="chip">未读公约 ${unread}</span>
      </div>
    </section>
    <div class="section-title"><h2>待办</h2><span>${me().name} 的视角</span></div>
    ${list.length ? list.map(item => `
      <article class="card">
        <div class="row">
          <div class="grow">
            <div class="title">${item.title}</div>
            <div class="meta">${item.meta}</div>
          </div>
          <span class="tag ${item.warn?"warn":""}">${{money:"费用",chore:"值日",item:"物品",rule:"公约"}[item.type]}</span>
        </div>
        <div class="actions">
          ${item.type==="money"?`<button class="btn" data-act="pay" data-id="${item.id}">付我这份</button>`:""}
          ${item.type==="chore"?`<button class="btn" data-act="done-chore" data-id="${item.id}">打卡完成</button>`:""}
          ${item.type==="item"?`<button class="btn ghost" data-act="goto" data-tab="item">去处理</button>`:""}
          ${item.type==="rule"?`<button class="btn" data-act="read-rule" data-id="${item.id}">我已同意</button>`:""}
        </div>
      </article>`).join("") : `<div class="card empty">没有待办。切换室友还能看到别人的今日。</div>`}
  `;
}

function viewMoney() {
  const net = netMap()[state.currentUserId];
  const plan = transfers();
  const open = state.expenses.filter(e => !expSettled(e));
  const closed = state.expenses.filter(e => expSettled(e));
  return `
    <div class="stats">
      <div class="stat"><em>你的净额</em><b class="money">${net>=0?"+":""}${fmtMoney(net)}</b></div>
      <div class="stat"><em>未结账单</em><b>${open.length}</b></div>
      <div class="stat"><em>建议转账</em><b>${plan.length}</b></div>
    </div>
    <div class="card">
      <div class="title">最小结清建议</div>
      <div class="meta">${plan.length ? plan.map(t => `${member(t.from).name} → ${member(t.to).name} ${fmtMoney(t.amount)}`).join(" ｜ ") : "当前没有未结金额。"}</div>
      <div class="actions">
        <button class="btn" data-act="open-expense">记一笔</button>
        <button class="btn ghost" data-act="settle-all" ${plan.length?"":"disabled"}>全部标记已结</button>
      </div>
    </div>
    <div class="section-title"><h2>未结清</h2><span>AA 按人数均摊</span></div>
    ${open.map(expCard).join("") || `<div class="card empty">没有未结账单</div>`}
    <div class="section-title"><h2>已结清</h2></div>
    ${closed.map(expCard).join("") || `<div class="card empty">还没有结清记录</div>`}
  `;
}
function expCard(exp) {
  const settled = expSettled(exp);
  const mine = owes(exp, state.currentUserId);
  const wait = exp.splitIds.filter(id => id !== exp.payerId && !exp.paidIds.includes(id));
  return `
    <article class="card ${settled?"done":""}">
      <div class="row">
        <div class="grow">
          <div class="title">${exp.title} <span class="money">${fmtMoney(exp.amount)}</span></div>
          <div class="meta">${exp.category} · ${member(exp.payerId).name}先付 · 人均 ${fmtMoney(share(exp))} · ${exp.createdAt}</div>
          <div class="meta">${settled ? "已全部结清" : "待付：" + (wait.length?names(wait):"无")}${exp.note?" · "+exp.note:""}</div>
        </div>
        <span class="tag ${settled?"":"warn"}">${settled?"已结":"未结"}</span>
      </div>
      ${settled?"":`<div class="actions">
        ${mine?`<button class="btn" data-act="pay" data-id="${exp.id}">付我这份</button>`:""}
        ${state.currentUserId===exp.payerId?`<button class="btn ghost" data-act="collect" data-id="${exp.id}">我已收齐</button>`:""}
      </div>`}
    </article>`;
}

function viewChore() {
  return `
    <section class="hero">
      <div class="house-kicker">CLEANING BOARD</div>
      <b>值日按周期轮转</b>
      <p>厨房/卫生间/客厅按周轮，倒垃圾按天轮。完成只记本期，下期自动换人。</p>
    </section>
    ${state.chores.map(c => {
      const person = member(assignee(c));
      const done = choreDone(c);
      const mine = person.id === state.currentUserId;
      return `
        <article class="card ${done?"done":""}">
          <div class="row">
            <div class="grow">
              <div class="title">${c.area}</div>
              <div class="meta">${c.cycle==="daily"?"每天轮转":"按周轮转"} · 本期是 ${person.name}${done?" · 已打卡":" · 未完成"}</div>
            </div>
            <span class="tag ${done?"": mine?"warn":"gold"}">${done?"已完成": mine?"轮到你":"进行中"}</span>
          </div>
          <div class="actions">
            <button class="btn" data-act="done-chore" data-id="${c.id}" ${done?"disabled":""}>${mine?"打卡完成":"代为打卡"}</button>
          </div>
        </article>`;
    }).join("")}
  `;
}

function viewItem() {
  return `
    <div class="section-title"><h2>公共物品</h2><span>消耗品看余量，大件看谁在用</span></div>
    ${state.items.map(it => {
      const st = ITEM_STATUS[it.status];
      const using = it.usingBy ? member(it.usingBy).name + " 使用中" : "空闲";
      return `
        <article class="card">
          <div class="row">
            <div class="grow">
              <div class="title">${it.name}</div>
              <div class="meta">${it.kind==="consumable"?"消耗品":"共用大件"} · ${it.note || ""}</div>
              <div class="meta">${it.kind==="durable" ? using : "状态：" + st.lab}</div>
            </div>
            <span class="tag ${it.kind==="durable" ? (it.usingBy?"gold":"") : st.tag}">${it.kind==="durable"?(it.usingBy?"使用中":"空闲"):st.lab}</span>
          </div>
          <div class="actions">
            ${it.kind==="consumable"?`
              <button class="btn ghost" data-act="use-item" data-id="${it.id}">记一次使用</button>
              <button class="btn" data-act="restock" data-id="${it.id}">我去补货</button>
            `:`
              <button class="btn" data-act="toggle-use" data-id="${it.id}">${it.usingBy===state.currentUserId?"用完归还":"我开始用"}</button>
            `}
          </div>
          ${it.logs.length?`<div class="usage">${it.logs.slice(0,2).map(l => `${l.at} · ${member(l.userId).name} · ${l.text}`).join("<br>")}</div>`:""}
        </article>`;
    }).join("")}
  `;
}

function viewRule() {
  const unread = state.rules.filter(r => !r.readIds.includes(state.currentUserId)).length;
  return `
    <section class="hero">
      <div class="house-kicker">HOUSE RULES</div>
      <b>宿舍公约</b>
      <p>条款对全屋生效。新条款默认未读，确认后才从今日待办消失。</p>
      <div class="chips"><span class="chip">你未确认 ${unread}</span></div>
    </section>
    <button class="btn block" data-act="open-rule">新增一条公约</button>
    ${state.rules.map(r => {
      const ok = r.readIds.includes(state.currentUserId);
      return `
        <article class="card">
          <div class="row">
            <div class="grow">
              <div class="title">${r.title}</div>
              <div class="meta">${member(r.createdBy).name} 发布于 ${r.createdAt} · ${r.readIds.length}/${state.members.length} 人已确认</div>
            </div>
            <span class="tag ${ok?"":"warn"}">${ok?"已确认":"待确认"}</span>
          </div>
          <div class="agree">${r.body}</div>
          <div class="actions">
            <button class="btn" data-act="read-rule" data-id="${r.id}" ${ok?"disabled":""}>我已同意</button>
          </div>
        </article>`;
    }).join("")}
  `;
}

function openSheet(html) {
  const sheet = document.getElementById("sheet");
  sheet.classList.add("show");
  sheet.innerHTML = `<div class="sheet-card">${html}</div>`;
}
function closeSheet() {
  const sheet = document.getElementById("sheet");
  sheet.classList.remove("show");
  sheet.innerHTML = "";
}

function formExpense(preset = {}) {
  const split = new Set(preset.splitIds || state.members.map(m => m.id));
  const sheet = document.getElementById("sheet");
  if (preset.itemId) sheet.dataset.itemId = preset.itemId;
  else delete sheet.dataset.itemId;
  openSheet(`
    <h3>${preset.title ? "补货入账" : "记一笔 AA"}</h3>
    <label>名称</label>
    <input id="f-title" value="${preset.title || ""}" placeholder="例如 9月水费" />
    <div class="grid2">
      <div><label>金额</label><input id="f-amount" type="number" min="0" step="0.01" value="${preset.amount || ""}" placeholder="0.00" /></div>
      <div><label>类别</label><select id="f-cat" class="field">${CATS.map(c => `<option ${c===(preset.category||"日用")?"selected":""}>${c}</option>`).join("")}</select></div>
    </div>
    <label>谁先付</label>
    <select id="f-payer" class="field">${state.members.map(m => `<option value="${m.id}" ${m.id===state.currentUserId?"selected":""}>${m.name}</option>`).join("")}</select>
    <label>和谁 AA</label>
    <div class="people" id="f-split">${state.members.map(m => `<button type="button" class="pick ${split.has(m.id)?"on":""}" data-act="pick-split" data-id="${m.id}">${m.name}</button>`).join("")}</div>
    <label>备注</label>
    <input id="f-note" value="${preset.note || ""}" placeholder="可选" />
    <div class="actions">
      <button class="btn block" data-act="save-expense">保存账单</button>
      <button class="btn ghost block" data-act="close-sheet">取消</button>
    </div>
  `);
}
function formRule() {
  openSheet(`
    <h3>新增公约</h3>
    <label>标题</label>
    <input id="f-title" placeholder="例如 浴室不超过 20 分钟" />
    <label>内容</label>
    <textarea id="f-body" placeholder="写清楚边界，方便全员确认"></textarea>
    <button class="btn block" data-act="save-rule">发布并等确认</button>
    <button class="btn ghost block" data-act="close-sheet">取消</button>
  `);
}
function formUse(item) {
  openSheet(`
    <h3>记一次使用 · ${item.name}</h3>
    <label>余量</label>
    <div class="people" id="f-status">
      ${Object.entries(ITEM_STATUS).map(([k,v]) => `<button type="button" class="pick ${item.status===k?"on":""}" data-act="pick-status" data-id="${k}">${v.lab}</button>`).join("")}
    </div>
    <label>说明</label>
    <input id="f-note" placeholder="例如 用掉最后一袋" />
    <button class="btn block" data-act="save-use" data-id="${item.id}">保存</button>
    <button class="btn ghost block" data-act="close-sheet">取消</button>
  `);
}

function pay(id) {
  const exp = state.expenses.find(e => e.id === id);
  if (!exp.paidIds.includes(state.currentUserId)) exp.paidIds.push(state.currentUserId);
  toast("已记下你的这份");
  render();
}
function collect(id) {
  const exp = state.expenses.find(e => e.id === id);
  exp.paidIds = Array.from(new Set([...exp.splitIds, exp.payerId]));
  toast("这笔已收齐");
  render();
}
function doneChore(id) {
  const c = state.chores.find(x => x.id === id);
  c.donePeriod = periodKey(c);
  toast(c.area + " 已打卡");
  render();
}
function readRule(id) {
  const r = state.rules.find(x => x.id === id);
  if (!r.readIds.includes(state.currentUserId)) r.readIds.push(state.currentUserId);
  toast("公约已确认");
  render();
}

document.getElementById("houseName").addEventListener("dblclick", () => {
  state = seed();
  localStorage.removeItem(KEY);
  tab = "today";
  toast("已重置演示数据");
  render();
});
document.getElementById("userSwitch").addEventListener("change", e => {
  state.currentUserId = e.target.value;
  render();
});
document.getElementById("tabs").addEventListener("click", e => {
  const btn = e.target.closest("[data-tab]");
  if (!btn) return;
  tab = btn.dataset.tab;
  render();
});
document.getElementById("view").addEventListener("click", onAct);
document.getElementById("sheet").addEventListener("click", onAct);

function onAct(e) {
  const btn = e.target.closest("[data-act]");
  if (!btn) {
    if (e.target.id === "sheet") closeSheet();
    return;
  }
  const act = btn.dataset.act;
  const id = btn.dataset.id;
  if (act === "goto") { tab = btn.dataset.tab; render(); return; }
  if (act === "pay") return pay(id);
  if (act === "collect") return collect(id);
  if (act === "done-chore") return doneChore(id);
  if (act === "read-rule") return readRule(id);
  if (act === "open-expense") return formExpense();
  if (act === "open-rule") return formRule();
  if (act === "close-sheet") return closeSheet();
  if (act === "settle-all") {
    state.expenses.forEach(exp => exp.paidIds = Array.from(new Set([...exp.splitIds, exp.payerId])));
    toast("未结账单已全部结清");
    render();
    return;
  }
  if (act === "use-item") return formUse(state.items.find(x => x.id === id));
  if (act === "toggle-use") {
    const it = state.items.find(x => x.id === id);
    if (it.usingBy === state.currentUserId) {
      it.usingBy = "";
      it.logs.unshift({ at: today(), userId: state.currentUserId, text: "归还" });
      toast("已归还");
    } else if (it.usingBy) {
      toast(member(it.usingBy).name + " 还在用");
      return;
    } else {
      it.usingBy = state.currentUserId;
      it.logs.unshift({ at: today(), userId: state.currentUserId, text: "开始使用" });
      toast("已标记使用中");
    }
    render();
    return;
  }
  if (act === "restock") {
    const it = state.items.find(x => x.id === id);
    formExpense({ title: "补货 " + it.name, category: "日用", note: "由公共物品一键入账", itemId: it.id });
    return;
  }
  if (act === "pick-split") {
    btn.classList.toggle("on");
    return;
  }
  if (act === "pick-status") {
    btn.parentElement.querySelectorAll(".pick").forEach(x => x.classList.remove("on"));
    btn.classList.add("on");
    return;
  }
  if (act === "save-expense") {
    const title = document.getElementById("f-title").value.trim();
    const amount = Number(document.getElementById("f-amount").value);
    const splitIds = [...document.querySelectorAll("#f-split .pick.on")].map(x => x.dataset.id);
    if (!title || !amount || splitIds.length < 1) { toast("请填写名称、金额和分摊人"); return; }
    const payerId = document.getElementById("f-payer").value;
    state.expenses.unshift({
      id: uid("e"), title, amount, category: document.getElementById("f-cat").value,
      payerId, splitIds, paidIds: [payerId], note: document.getElementById("f-note").value.trim(), createdAt: today()
    });
    const itemId = document.getElementById("sheet").dataset.itemId;
    if (itemId) {
      const it = state.items.find(x => x.id === itemId);
      it.status = "ok";
      it.logs.unshift({ at: today(), userId: state.currentUserId, text: "补货并入账 " + fmtMoney(amount) });
      delete document.getElementById("sheet").dataset.itemId;
    }
    closeSheet();
    tab = "money";
    toast("账单已记下");
    render();
    return;
  }
  if (act === "save-rule") {
    const title = document.getElementById("f-title").value.trim();
    const body = document.getElementById("f-body").value.trim();
    if (!title || !body) { toast("标题和内容都要写"); return; }
    state.rules.unshift({
      id: uid("r"), title, body, createdBy: state.currentUserId, createdAt: today(), readIds: [state.currentUserId]
    });
    closeSheet();
    toast("公约已发布，等人确认");
    render();
    return;
  }
  if (act === "save-use") {
    const it = state.items.find(x => x.id === id);
    const status = document.querySelector("#f-status .pick.on").dataset.id;
    const note = document.getElementById("f-note").value.trim() || "记一次使用";
    it.status = status;
    it.logs.unshift({ at: today(), userId: state.currentUserId, text: note });
    closeSheet();
    toast("已更新 " + it.name);
    render();
  }
}

render();
