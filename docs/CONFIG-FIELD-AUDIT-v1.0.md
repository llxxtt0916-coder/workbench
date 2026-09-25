# 现有表单配置字段盘点表

本盘点依据当前 `index.html` 的新增表单、`edit*` 回填、`save*` 写入、整理/迁移逻辑与台账读取字段。仓库 `data.json` 中下列业务数组均为空；本机浏览器及 Gitee 的实际历史记录不在仓库中，因此不能在此列出用户设备上的真实单位名称。配置页会列出本机未匹配的工作来源文本。

| 业务类型 | 表单实际字段 | 业务数据字段（名称快照 / 稳定 ID） | 配置类型及候选来源 | 状态 |
| --- | --- | --- | --- | --- |
| 工作 | 类别（多选） | `todos.category[]` / `work_category_ids[]` | `work_categories`；扫描全部 `todos` 历史类别回填 | 已接入 |
| 工作 | 来源（多选） | `todos.source[]` / `source_org_ids[]` | 启用的 `external` + `internal`；历史纯文本继续展示、编辑和筛选 | 已接入；无独立来源字典 |
| 采购 | 供应商 | `purchases.supplier` / `supplier_org_id` | `external` + `supplier`；统一对外主体池与各业务历史名称 | 已接入 |
| 采购 | 签订科室 | `purchases.contractDept` / `contract_dept_org_id` | `internal`；历史内部科室回填 | 已接入 |
| 采购 | 报账科室 | `purchases.expenseDept` / `expense_dept_org_id` | `internal`；历史内部科室回填 | 已接入 |
| 合同 | 对方单位 | `contracts.party` / `counterparty_org_id` | `external` + `supplier`；统一对外主体池 | 已接入 |
| 报销 | 供应商名称 | `expenses.supplier` / `supplier_org_id` | `external` + `supplier`；统一对外主体池 | 已接入 |
| 报销 | 旧记录中的报账科室 | `expenses.expenseDept` / `expense_dept_org_id` | `internal`；仅历史回填，当前报销表单无此输入框 | 历史兼容 |
| 委托 | 代理机构 | `agencys.agent` / `agent_org_id` | `external` + `supplier`；统一对外主体池 | 已接入 |
| 委托 | 成交供应商 | `agencys.winSupplier` / `win_supplier_org_id` | `external` + `supplier`；统一对外主体池 | 已接入 |
| 委托 | 需求科室 | `agencys.dept` / `dept_org_id` | `internal`；历史内部科室回填 | 已接入 |
| 会议 | 组织方 | `meetings.organizer` / `organizer_org_id` | `external` + `internal`；历史组织方作为文本候选 | 已接入；无法判断类型的历史文本不自动建组织 |
| 培训 | 组织方 | `trainings.organizer` / `organizer_org_id` | `external` + `internal`；历史组织方作为文本候选 | 已接入；无法判断类型的历史文本不自动建组织 |

同名组织按大小写不敏感的全称去重，已有配置的唯一简称也可匹配。采购、报销、委托供应商历史值优先提供 `supplier` 类型线索；合同对方单位、委托代理机构提供 `external` 线索；内部科室提供 `internal` 线索。若一个历史名称同时出现在内部和对外字段，不自动判定类型，保留原名称快照供人工确认。同一对外名称跨业务扮演不同角色时只创建一条组织。会议/培训组织方及工作旧来源只有名称、没有可靠类型线索时，不静默创建组织或关联 `supplier`。

## 已检查但未映射到本版配置的字段

| 业务类型 | 字段 | 判断 |
| --- | --- | --- |
| 采购、合同、委托 | `category` | 采购/合同类别，与工作类别语义不同；本轮不并入 `work_categories`。 |
| 报销、经费、经费开支 | `category`、`subcategoryId`、`fundItem`、`fundId` | 财务分类或经费关联，不是组织或工作类别；沿用现有逻辑。 |
| 培训 | `category` | 培训类别，与工作类别不同；后续如需维护，应另定字典。 |
| 会议、培训 | `attendees`、`assignee` | 参会人、经办人属于人员，不是组织。 |
| 交接 | `giver`、`receiver`、明细 `unit` | 人员及计量单位，不是组织。 |
| 灵感、速记箱 | `tags`、`quick_notes.source` | 标签和速记渠道，不是工作来源。 |
| 长期目标、提醒、子任务 | 无独立组织字段 | 长期目标沿用工作记录结构；不新增配置。 |
| 报销 | `supplierCode` | 统一社会信用代码，不是另一主体名称；当前表单没有独立收款人、开票方或支付方名称字段。 |

整理/迁移表单仍使用上述同一业务数据字段，不建立第二套组织配置。历史文本保留为名称快照；ID 只在可靠匹配或用户选择时建立。`work_source_ids` 只作为旧记录遗留字段读取，后续保存使用 `source_org_ids`；旧 `wb_config.dictionaries.work_sources` 解析后不再写回。
