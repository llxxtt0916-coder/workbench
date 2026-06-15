# 我的工作台 — 产品设计框架

> 版本：v1.4 | 日期：2026-06-15 | 变更：Phase 0 全部完成，驾驶舱重构为综合数据面板

---

## 一、产品愿景

**北极星：** 让公共卫生领域基层管理者专注于"做正确的事"，而不是"记住要做的事"。

**一句话定位：** 为疾控监督员等公卫基层管理者提供**个人**工作台——统一管理任务、台账、会议、培训、灵感，消除碎片化工具切换和信息遗漏。

**产品边界：** 纯个人工具。不做多人协作、不做权限管理、不做审批流程。Gitee 同步仅用于跨设备数据备份。

**价值主张：**

| 用户痛点 | 产品解法 |
|----------|----------|
| 任务来源分散（卫健委/市疾控/自研…），无法统一追踪 | 多来源统一收件箱，按来源维度统计 |
| 台账（合同/采购/报销）与实际工作任务脱节 | 台账自动生成对应工作记录，形成闭环 |
| 周期工作（月报/年报）容易遗忘 | 智能周期引擎，自动推算下次到期并提醒 |
| 发票报销信息手动录入繁琐 | OCR 自动识别 → 一键填充 |
| 会议太多，会前准备/会后行动项容易遗漏 | 会议日程自动关联工作记录，会前提醒 + 会后生成待办 |
| 培训学分、证书、考核记录零散存放 | 培训台账统一管理，截止提醒防过期 |
| 不知道工作完成质量如何 | 驾驶舱指标体系（完成率、滞留天数、逾期率） |
| 月底/年底汇总耗时（手动翻台账、整理数据） | 数据汇总面板 + 月报一键生成草稿 |
| 向上汇报缺少数据支撑 | 趋势分析图表 + 跨模块交叉统计 |

---

## 二、用户画像

### 主用户：疾控监督员 / 公卫基层管理者

| 维度 | 描述 |
|------|------|
| **典型工作内容** | 月报撰写、督导评价、数据收集分析、采购申请、差旅报销、接收上级交办任务、撰写分析报告、参加/组织会议、参加培训/继续教育 |
| **典型工作流** | 接收指令 → 分解任务 → 执行 → 产生台账记录（合同/采购/报销/培训）→ 参加/组织会议 → 归档复盘 |
| **高频痛点** | ① 多个来源的任务容易遗漏 ② 周期工作记不住截止日期 ③ 手动填报销信息繁琐 ④ 月底/年底汇总时数据散落各处 ⑤ 会议行动项无人跟踪 ⑥ 培训学分/证书过期遗忘 |
| **使用环境** | 办公电脑为主（Windows），偶尔手机查看（浏览器） |
| **技术熟练度** | 中等偏上，能接受新工具，但不希望配置过于复杂 |

### 产品边界（明确不做什么）

| 不做（Non-goals） | 原因 |
|-------------------|------|
| 多人协作 / 团队共享 | 个人工作台定位 |
| 审批流程（合同/采购/报销） | 无外部用户，审批在线下完成 |
| 即时通讯 / 消息通知 | 非沟通工具 |
| 知识库 / Wiki | 灵感收集 + 工作记录已覆盖此需求 |
| 与 OA 系统对接 | 技术复杂度远超收益 |

---

## 三、信息架构（重构后）

### 核心理念：以"工作记录"为统一数据底座

```
┌─────────────────────────────────────────────────┐
│                  驾驶舱 Dashboard                 │
│   指标总览 · 日历视图 · 截止提醒 · 快捷入口       │
├─────────────────────────────────────────────────┤
│                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│   │ 待办工作  │  │ 重点工作  │  │ 周期工作  │     │
│   │ pending  │  │   key    │  │recurring │     │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│        │             │             │            │
│        ▼             ▼             ▼            │
│   ┌──────────────────────────────────────┐     │
│   │         工作记录（统一数据底座）        │     │
│   │  ┌──────┐┌──────┐┌──────┐┌──────┐   │     │
│   │  │ 任务  ││合同  ││采购  ││培训  │ … │     │
│   │  │关联  ││关联  ││关联  ││关联  │   │     │
│   │  └──────┘└──────┘└──────┘└──────┘   │     │
│   └──────────────────────────────────────┘     │
│                      │                          │
│   ┌──────────┬───────┼───────┬──────────┐      │
│   ▼          ▼       │       ▼          ▼      │
│┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐      │
││ 合同  ││ 采购  ││ 报销  ││ 会议  ││ 培训  │      │
││台账  ││台账  ││台账  ││日程  ││记录  │      │
│└──────┘└──────┘└──────┘└──────┘└──────┘      │
│                                                 │
│   ┌──────────────────────────────────────┐     │
│   │          灵感收集 Inspiration         │     │
│   │    想法捕获 · 标签分类 · 定期回顾      │     │
│   └──────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

### 关键设计原则

1. **工作记录是"一等公民"**：合同、采购、报销、会议、培训模块创建/更新时，自动在工作记录中生成/同步对应条目
2. **台账是"结构化视图"**：同一份数据，台账提供列表+统计视图，工作记录提供任务追踪视图
3. **灵感是"输入源"**：灵感可以一键转化为待办工作
4. **会议驱动行动**：会议日程中的"行动项"自动拆解为待办任务和子任务
5. **培训与任务联动**：培训报名 → 生成考前复习任务；培训到期 → 生成复训提醒

---

## 四、数据模型设计

### 4.1 核心实体关系

```
工作记录 (todos) ─────────── 核心实体
  │
  ├── type: pending | key | recurring | record
  ├── category[]: 多标签分类
  ├── source[]: 多来源标注
  ├── status: 未开始 | 进行中 | 已完成 | 已取消
  ├── subtasks[]: 子任务列表
  ├── recurrence: 周期规则（仅 type=recurring 时）
  │
  ├── (1:0..1)── 合同台账 (contracts)     ← contractRef 外键
  ├── (1:0..1)── 采购台账 (purchases)     ← purchaseRef 外键
  ├── (1:0..1)── 报销台账 (expenses)      ← expenseRef 外键
  ├── (1:0..1)── 会议日程 (meetings)      ← meetingRef 外键
  └── (1:0..1)── 培训记录 (trainings)     ← trainingRef 外键

灵感收集 (inspirations) ─── 独立实体
  │
  ├── tags[]: 标签
  └── (可转化为工作记录)

会议日程 (meetings) ─── 新模块
  │
  ├── attendees[]: 参与人
  ├── actionItems[]: → 关联 subtasks
  └── meetingRef → 关联工作记录

培训记录 (trainings) ─── 新模块
  │
  ├── credits: 学分/学时
  ├── certificate: 证书信息
  └── trainingRef → 关联工作记录

设置 (settings) ─── 独立实体（本地存储）
```

### 4.2 工作记录（todos）— 统一数据模型

```typescript
interface Todo {
  id: number;
  type: 'pending' | 'key' | 'recurring' | 'record';

  // 核心字段
  name: string;                    // 工作名称
  content: string;                 // 详细描述
  status: '未开始' | '进行中' | '已完成' | '已取消';
  priority: 'high' | 'mid' | 'low';

  // 分类与来源
  category: string[];              // 多标签分类
  source: string[];                // 来源（上级交办/自研/文件要求…）

  // 时间轴
  issueDate: string;               // 下发日期
  deadline: string;                // 截止日期
  completeDate: string;            // 完成日期
  createdAt: string;               // 创建时间

  // 堵点卡点
  blocker: string;                 // 当前阻碍

  // 子任务
  subtasks: Subtask[];

  // 周期规则（仅 type=recurring）
  recurrence?: RecurrenceRule;
  completedCount?: number;         // 已完成次数
  paused?: boolean;                // 是否暂停

  // 台账关联（新增！当前缺失）
  contractRef?: number;            // 关联合同 ID
  purchaseRef?: number;            // 关联采购 ID
  expenseRef?: number;             // 关联报销 ID
  meetingRef?: number;             // 关联会议 ID（新增）
  trainingRef?: number;            // 关联培训 ID（新增）

  // 溯源
  _prevType?: string;              // 移到记录前的原始类型
  convertedFromInspiration?: number; // 从灵感转化而来
}
```

### 4.3 合同 / 采购 / 报销 — 统一化

三个台账模块共享相似结构，应抽取公共字段：

```typescript
interface LedgerBase {
  id: number;
  name: string;                    // 名称
  amount: number;                  // 金额
  status: string;                  // 状态
  category: string;                // 分类
  date: string;                    // 核心日期
  note: string;                    // 备注
  createdAt: string;               // 创建时间
  todoRef?: number;                // 关联工作记录 ID（新增！）
}
```

### 4.4 会议日程（meetings）— 新模块

```typescript
interface Meeting {
  id: number;
  name: string;                    // 会议名称
  date: string;                    // 会议日期
  startTime?: string;              // 开始时间（HH:mm）
  endTime?: string;                // 结束时间（HH:mm）
  location?: string;               // 地点
  type: '线上' | '线下' | '混合';   // 会议类型
  organizer?: string;              // 组织方
  attendees: string[];             // 参与人列表

  // 会议前
  agenda?: string;                 // 会议议程
  prepTasks?: string;              // 会前准备事项

  // 会议后
  minutes?: string;                // 会议纪要
  actionItems: ActionItem[];       // 行动项（自动生成子任务）
  nextMeetingDate?: string;        // 下次会议时间

  // 关联
  todoRef?: number;                // 关联工作记录 ID
  createdAt: string;
}

interface ActionItem {
  text: string;                    // 行动项内容
  assignee?: string;               // 负责人
  deadline?: string;               // 截止日期
  done: boolean;                   // 是否完成
}
```

### 4.5 培训记录（trainings）— 新模块

```typescript
interface Training {
  id: number;
  name: string;                    // 培训名称
  organizer: string;               // 组织方/主办方
  type: '线上' | '线下' | '混合';
  category: string;                // 分类（如：业务培训/继续教育/党建学习）

  // 时间
  startDate: string;               // 开始日期
  endDate: string;                 // 结束日期

  // 学分/证书
  credits?: number;                // 学分/学时
  creditType?: string;             // 学分类型（如：I类学分/II类学分）
  hasCertificate: boolean;         // 是否有证书
  certificateNo?: string;          // 证书编号
  certificateExpiry?: string;      // 证书有效期（过期自动提醒）

  // 费用
  fee?: number;                    // 培训费用
  feeStatus?: '自费' | '公费' | '免费';

  // 考核
  hasExam: boolean;                // 是否有考核
  examDate?: string;               // 考核日期
  examResult?: string;             // 考核结果（合格/优秀/不合格）

  // 内容
  content?: string;                // 培训内容摘要
  attachment?: string;             // 附件（培训通知/课件链接）

  // 关联
  todoRef?: number;                // 关联工作记录 ID（用于生成"参加培训"、"备考复习"等任务）
  expenseRef?: number;             // 关联报销记录（如果有费用）

  status: '待参加' | '已完成' | '已取消';
  createdAt: string;
}
```

### 4.6 字段命名规范（必须统一）

| 当前问题 | 规范后 |
|----------|--------|
| `content` vs `note` vs `description` 混用 | 统一用 `content` 表示主体内容，`note` 表示补充备注 |
| `name` vs `title` 混用 | 统一用 `name`（台账类）、`title`（灵感类） |
| `date` vs `appDate` vs `signDate` | 统一语义：`issueDate`/`deadline`/`completeDate`/`signDate`/`expiryDate` |

---

## 五、核心用户旅程

### 旅程 1：上级交办任务 → 跟踪 → 完成

```
收到通知 → 打开智能录入 → 粘贴文字 → 自动识别为任务
  → 自动填充：名称/来源/截止日期 → 确认保存
  → 进入待办列表 → 拆分子任务 → 标记进行中
  → 遇到堵点 → 填写卡点记录 → 完成后标记完成
  → 自动进入工作记录 → 月底汇总时有据可查
```

### 旅程 2：发票报销 → OCR 识别 → 归档

```
拿到发票 → 打开报销模块 → 上传发票图片
  → OCR 自动识别：发票号/金额/日期/供应商/内容
  → 用户确认/修正 → 一键填充表单
  → 保存报销记录 → 同时在待办中生成"报销 XX 元"任务
  → 报销完成 → 更新状态 → 从待办中自动完成
```

### 旅程 3：采购 → 合同 → 报销 联动

```
发起采购 → 填写采购明细 → 选择"已签订合同"
  → 自动在合同台账中生成合同记录（状态：待签）
  → 同时生成"签署 XX 合同"任务
  → 选择"需报账" → 自动在报销台账中生成报销记录
  → 三个模块数据联动，一处更新三处同步
```

### 旅程 4：灵感 → 定期回顾 → 转化为行动

```
随时记录灵感 → 打标签（如"疾控监督员"）
  → 驾驶舱显示"本周灵感 N 条"
  → 定期回顾功能 → 选择有价值的灵感
  → 一键转化为工作记录（待办/重点）
```

---

## 六、功能优先级矩阵（RICE 框架）

| # | 功能 | Reach 覆盖 | Impact 影响 | Confidence 信心 | Effort 工作量 | RICE 得分 | 优先级 |
|---|------|-----------|-------------|-----------------|---------------|-----------|--------|
| 1 | 统一数据模型重构（台账关联工作记录） | 10 | 9 | 9 | 5 | 1620 | 🔴 P0 |
| 2 | 驾驶舱指标体系重设计 | 10 | 8 | 8 | 3 | 2133 | 🔴 P0 |
| 3 | 代码拆分（HTML/CSS/JS 分文件） | 10 | 5 | 10 | 4 | 1250 | 🔴 P0 |
| 4 | PWA manifest 补全 | 8 | 4 | 10 | 1 | 3200 | 🔴 P0 |
| 5 | 来源维度统计面板 | 7 | 7 | 8 | 3 | 1307 | 🟡 P1 |
| 6 | 截止日期日历视图 | 8 | 8 | 7 | 4 | 1120 | 🟡 P1 |
| 7 | 灵感→工作记录转化 | 5 | 7 | 8 | 2 | 1400 | 🟡 P1 |
| 8 | 会议日程模块（含行动项→子任务联动） | 8 | 8 | 9 | 4 | 1440 | 🟡 P1 |
| 9 | 培训记录模块（含学分归档+证书到期提醒） | 7 | 7 | 9 | 3 | 1470 | 🟡 P1 |
| 10 | **数据汇总面板**（跨模块交叉统计+钻取） | 9 | 9 | 8 | 4 | 1620 | 🟡 P1 |
| 11 | 会议纪要模板 | 6 | 6 | 9 | 2 | 1620 | 🟡 P1 |
| 12 | **自动生成月报草稿** | 10 | 10 | 7 | 6 | 1167 | 🟡 P1 |
| 13 | 培训年汇总报表 | 5 | 6 | 9 | 2 | 1350 | 🟢 P2 |
| 14 | **数据分析与趋势图表** | 7 | 7 | 7 | 4 | 858 | 🟢 P2 |
| 15 | 自然语言查询 | 4 | 6 | 5 | 5 | 240 | 🟢 P2 |

> **RICE 得分 = (Reach × Impact × Confidence) / Effort**

---

## 七、路线图

### Phase 0：地基（当前 ~ 2周）

```
✅ 已有功能运行正常
✅ 产出产品设计框架（本文档）
📋 统一数据模型并迁移现有数据（含新增 meetingRef/trainingRef）
📋 代码拆分：CSS → styles.css, JS → app.js
📋 补全 manifest.json，启用 PWA 安装
📋 字段命名规范化
```

### Phase 1：北极星指标 + 新模块基础版（2~4周）

```
🎯 驾驶舱指标体系上线
   - 本周/本月完成率
   - 逾期任务数 & 平均滞留天数
   - 周期工作健康度
   - 合同到期预警
📋 台账→工作记录自动关联
📋 来源维度统计面板
📋 截止日期日历热力图
📋 会议日程模块 MVP
   - 会议增删改查 + 列表视图
   - 会前提醒 + 自动生成待办
📋 培训记录模块 MVP
   - 培训增删改查 + 列表视图
   - 证书到期提醒
📋 数据汇总面板基础版（本月任务完成统计 + 台账金额汇总）
```

### Phase 2：体验深化 + 数据能力（1~2个月）

```
🎯 数据汇总面板完整版（跨模块交叉统计+钻取明细）
🎯 自动生成月报草稿 v1（结构化模板，含环比/同比）
🎯 会议行动项→工作记录子任务联动
🎯 培训学分归档 + 年汇总报表
🎯 灵感→行动转化工作流
🎯 会议纪要模板（结构化填写）
🎯 智能标签推荐（基于历史数据）
🎯 移动端体验优化
🎯 自然语言查询："我这周完成了什么？"
```

### Phase 3：智能化（3个月+）

```
🎯 月报生成 v2（富文本导出 + 图表嵌入 + 公文格式）
🎯 数据分析趋势图表（月度趋势、同比环比、热力图）
🎯 培训→报销联动（公费培训自动生成报销记录）
🎯 会议日历热力图（一眼看月度会议密度）
🎯 与外部日历（系统日历/飞书日历）同步
🎯 智能提醒升级（基于历史行为的个性化提醒）
```

---

## 八、成功指标体系

### 北极星指标（North Star）

> **周期工作按时完成率** = 按时完成的周期工作数 / 应完成周期工作总数

### 驱动指标（L1 — 与北极星直接相关）

| 指标 | 当前基线 | 目标（3个月） | 数据来源 |
|------|----------|---------------|----------|
| 周期工作按时完成率 | 需测算 | ≥ 90% | todos（type=recurring） |
| 待办工作平均滞留天数 | 需测算 | ≤ 3 天 | todos（type=pending, 从创建到完成） |
| 逾期任务占比 | 需测算 | ≤ 5% | todos（deadline < today 且未完成） |

### 健康指标（L2 — 产品健康度）

| 指标 | 说明 |
|------|------|
| 灵感→行动转化率 | 灵感被转化为工作记录的比例 |
| 台账数据完整率 | 合同/采购/报销/会议/培训必填字段完整率 |
| OCR 识别准确率 | 发票 OCR 识别后用户修改的次数 |
| 会议行动项完成率 | 会议中列出的行动项标记完成的比例 |
| 证书到期预警覆盖率 | 有证书的培训中有到期提醒设置的比例 |
| 数据同步成功率 | Gitee push/pull 成功率 |

### 体验指标（L3 — 用户满意度）

| 指标 | 说明 |
|------|------|
| 智能录入采纳率 | 通过智能录入创建的任务占比 |
| 功能模块使用分布 | 各模块的使用频次（间接反映需求匹配度） |

---

## 九、技术架构建议

### 当前 → 目标

```
当前（单体巨石）               目标（模块化）
─────────────────────       ─────────────────────
index.html (2900+ 行)       index.html        (~200 行)
  ├─ HTML 结构                 ├─ 布局 + 路由
  ├─ CSS 全部样式              ├─ 模块加载入口
  └─ JS 全部逻辑            styles/
                               ├─ base.css      (~100 行)
                               ├─ layout.css    (~80 行)
                               ├─ components.css(~200 行)
                               └─ responsive.css (~50 行)
                            js/
                               ├─ app.js        (初始化/路由)
                               ├─ db.js         (数据层)
                               ├─ sync.js       (Gitee 同步)
                               ├─ modules/
                               │   ├─ dashboard.js
                               │   ├─ todo.js
                               │   ├─ inspiration.js
                               │   ├─ contract.js
                               │   ├─ purchase.js
                               │   ├─ expense.js
                               │   ├─ meeting.js       ← 新增
                               │   ├─ training.js      ← 新增
                               │   └─ smart-input.js
                               ├─ ocr.js         (OCR 引擎)
                               └─ utils.js       (工具函数)
```

### 技术选型建议

| 层面 | 当前 | 建议 | 理由 |
|------|------|------|------|
| 框架 | 原生 JS | 保持原生 JS | 你的场景不需要 React/Vue 的复杂度 |
| 模块化 | 无 | ES Modules (`type="module"`) | 原生支持，无需构建工具 |
| 数据层 | localStorage 直读直写 | 抽象 DataStore 类 | 未来可切换后端存储 |
| 状态管理 | 全局变量 + DOM | 简单 EventEmitter | 模块间通信解耦 |
| 测试 | 无 | 至少对数据层写单测 | 数据迁移时防回归 |

---

## 十、立即行动清单

按优先级排序，全部 P0/P1 已完成（2026-06-14，phase0-refactor 分支，tag: v0-phase0）：

- [x] **P0**：创建 `docs/PRODUCT_DESIGN.md`（✅ 本文档即产物，v1.3 已更新）
- [x] **P0**：补全 `manifest.json`（PWA installable，含 icons/icon-192.svg + icon-512.svg）
- [x] **P0**：数据模型迁移脚本 — 补全 `meetingRef`/`trainingRef` 外键 + `todoRef` 台账关联
- [x] **P0**：所有时间字段统一为 `YYYY-MM-DD` 格式（`repairData()` 自动标准化）
- [x] **P0**：所有台账模块补全 `category` 字段（默认值 + `repairData()` 自动补齐）
- [-] **P0**：驾驶舱指标从"计数"改为"比率"（❌ 用户决定跳过，日常汇报使用计数型指标）
- [x] **P1**：CSS 拆分 → `styles/base.css` + `styles/layout.css` + `styles/components.css`
- [x] **P1**：字段命名规范化 — `content`=主体内容, `note`=补充备注, `name`=台账类, `title`=灵感类
- [x] **P1**：台账创建/更新时自动同步工作记录 — `syncLedgerTodo()` 通用函数，支持 contract/purchase/expense/meeting/training
- [x] **P1**：会议日程模块 MVP — 月历视图 + 增删改查 + 行动项→子任务联动
- [x] **P1**：培训记录模块 MVP — 增删改查 + 证书到期提醒（30天内红色预警）
- [x] **P2 规划**：数据汇总面板设计（跨模块交叉统计+钻取）
- [x] **P2 规划**：自动生成月报模板设计（❌ 已删除，用户不需要）

### Phase 0 实现说明（2026-06-15 更新）

- **分支**：`phase0-refactor` | **标签**：`v0-phase0-complete` | **回滚**：`git checkout master`
- **模块总数**：8 个（驾驶舱/数据汇总 + 工作记录 + 灵感收集 + 会议日程 + 培训记录 + 采购台账 + 合同台账 + 报销台账）
- **驾驶舱**：v1.4 重构为综合数据面板，删除旧图表型驾驶舱，原位替换为跨模块统计+钻取面板
- **Bug 修复**：灵感保存缺少 `DB.set()` 导致数据不持久化
- **代码规模**：`index.html` ~5700 行 + 3 个 CSS 文件 ~1640 行（移除 Chart.js 依赖）

---

> **产品经理不是需求搬运工，是价值判断官。**  
> 这份框架的目标不是告诉你要做什么功能，而是帮你在每次想"加个新功能"时，能把新想法放进正确的优先级框里，判断它是否服务于北极星指标。

---

## 十一、数据汇总与月报：Phase 0 必须预留的设计

> **原则**：月报自动生成是 Phase 2 的功能，但 Phase 0 的数据模型必须支持它。

### 月报需要从各模块提取的数据

| 月报章节 | 数据来源 | 当前缺失的字段/逻辑 |
|----------|----------|---------------------|
| 本月任务概况 | `todos` | 需按 `completeDate` 按月聚合；需计算环比 |
| 重点工作进展 | `todos` (type=key) | 需区分"已完成"和"进行中"的占比 |
| 堵点卡点汇总 | `todos.blocker` | 需按月提取非空的 `blocker` 字段 |
| 合同签署统计 | `contracts` | 需按 `signDate` 按月聚合金额和数量 |
| 采购统计 | `purchases` | 需按 `date` 按月聚合，加"到货率" |
| 报销统计 | `expenses` | 需按 `appDate`/`reimbDate` 分别统计 |
| 会议统计 | `meetings`（新增） | 需按 `date` 按月计数 |
| 培训统计 | `trainings`（新增） | 需按 `startDate` 按月聚合学分 |
| 下月计划 | `todos.deadline` | 需筛选 deadline 在下月的任务 |

### Phase 0 必须确保的数据条件

1. **时间字段标准化**：所有模块的核心日期字段必须统一为 `YYYY-MM-DD` 字符串格式
2. **状态字段可统计**：每个模块的 `status` 字段有明确的枚举值，不可为空
3. **金额字段统一**：所有涉及金额的字段统一为 `number` 类型，单位为"元"
4. **分类字段存在**：每个台账模块必须有 `category` 字段用于分组统计
5. **删除不丢数据**：软删除（标记 `deleted: true`）而非物理删除，防止月报丢失历史数据

### 月报模板数据结构（Phase 2 实现）

```typescript
interface MonthlyReport {
  year: number;
  month: number;                       // 1-12

  // 自动聚合
  taskSummary: {
    totalCompleted: number;
    keyCompleted: number;
    recurringCompleted: number;
    completionRate: number;            // 完成率
    avgDwellDays: number;              // 平均滞留天数
    overdueCount: number;              // 逾期数
    blockers: string[];                // 堵点卡点列表
  };

  ledgerSummary: {
    contracts: { count: number; amount: number; expiringSoon: number };
    purchases: { count: number; amount: number; arrivalRate: number };
    expenses: { count: number; amount: number; reimbursedRate: number };
  };

  meetingSummary: {
    count: number;
    actionItemsPending: number;        // 待完成行动项
  };

  trainingSummary: {
    count: number;
    totalCredits: number;
    certificatesExpiring: number;      // 即将到期证书数
  };

  nextMonthPlan: Todo[];               // 下月到期任务

  generatedAt: string;                 // 生成时间
  userEdits?: string;                  // 用户手动编辑内容
}
```

---

*本文档将随产品迭代持续更新。下次评审时间：2026-07-14*
