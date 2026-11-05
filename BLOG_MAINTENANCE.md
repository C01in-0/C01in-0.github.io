# 博客长期维护与迭代记录

> 本文档是 `myblog` 的持续维护入口。每次修改源站前先完整阅读，完成验证后再更新“迭代记录”和“已知风险”。项目事实以当前仓库、最近的 `AGENTS.md` 与本文档为准；聊天记录不能替代它们。

## 1. 边界与工作顺序

1. 修改前确认目标分支、工作树与工作区是否干净。
2. 正式源文件或配置变更前建立可恢复的精简备份；不要备份 `public/`、缓存、依赖、日志或临时 QA 产物。
3. 默认在独立功能工作树完成修改、构建与视觉验收，不直接修改公网 `main`。
4. 未经 Colin 明确授权，不推送、不部署、不发布，也不进行整体重设计或大规模重构。
5. 发布前必须通过本文档列出的契约检查、构建和多端 QA；图片许可与公开范围必须经过人工确认。

## 2. 仓库与分支约定

- 远端：`C01in-0/C01in-0.github.io`
- `main`：GitHub Pages 生成产物，仅在批准发布时更新。
- `source`：Hexo 源站与可维护配置；本轮只在本地建立，推送前需单独确认。
- 功能工作树：从 `source` 派生，一项迭代一个分支，验收后再合并。
- Butterfly 主题已作为普通源码纳入源站仓库，不能重新引入嵌套 `.git`。

## 3. 文章编号契约

`blog_id` 是文章稳定编号的唯一来源，同时决定首页 `LOG XX` 和图片目录 `/images/blogX/`。编号按发布日期从旧到新连续递增；分页不能重新从 1 计数。

| blog_id | 日期 | 文章 |
| ---: | --- | --- |
| 1 | 2026-03-15 | 2026 软件系统安全赛初赛 MISC |
| 2 | 2026-03-17 | Hello World：博客创建与迭代记录 |
| 3 | 2026-04-05 | Ret2libc 漏洞利用 |
| 4 | 2026-04-12 | CTFshow Pwn 知识精炼 |
| 5 | 2026-04-25 | AHU 校园网静默连网工具 |
| 6 | 2026-06-22 | 从 765.625 说起 |
| 7 | 2026-07-16 | 移动端提示词注入初探 |
| 8 | 2026-07-23 | BIPIA |
| 9 | 2026-07-31 | HackAPrompt Tutorial |
| 10 | 2026-08-05 | Linux 与 Jenkins 自动部署 |
| 11 | 2026-08-12 | Detect & Remove |
| 12 | 2026-08-21 | Task Shield |
| 13 | 2026-08-28 | RENNERVATE |
| 14 | 2026-10-22 | 0xGame2026 AI 题解与学习记录 |

新增文章时：按时间插入后重新检查所有 `blog_id` 的连续性，并同步对应图片目录。不得用当前页序号或渲染顺序临时生成 LOG。

## 4. 图片与文章资产

- 每篇文章只使用 `/images/blogX/...`，其中 `X` 必须等于该文章 `blog_id`。
- 目录名只允许 `blog` 加十进制数字；不保留括号、标题、空格或旧别名。
- 无图片的文章可以没有对应目录，例如当前 `blog5`。
- Markdown 中引用的本地图片必须实际存在；未引用但有保留价值的原始素材可留在所属 `blogX`，但发布前仍需核对许可与公开范围。
- 四篇论文文章只迁移已确认的成品 PNG；实验区 SVG、被替代的表格图和内部附录不进入正式博客。

## 5. 标签与知识索引

- Hexo `tags` 只承担公开归档与导航；文章 front matter 中的 `knowledge` 承担知识星图的细粒度概念。两者不得再互相推断。
- `论文研读` 是文章系列标签，不作为知识概念节点；AI 文章的公开标签控制在 2–4 个，避免归档页碎片化。
- 所有公开文章都必须声明非空 `knowledge`，不能只迁移 AI 文章，否则知识星图的旧主题会显示为 0。
- 四篇论文研读同时属于独立的 `笔记` 与 `科研` 分类。Hexo 多分类必须写成 `categories: [[笔记], [科研]]` 对应的 YAML 嵌套数组；普通字符串数组会被解释成父子层级。
- 概念层级由 `source/data/knowledge-taxonomy-v2.json` 维护；关系边由 `source/data/knowledge-relations.json` 维护。
- AI 知识索引固定从四个正交入口展开：`威胁`、`防御`、`系统对象`、`技术机制`。页面默认只展开一层，后代节点以“更多 N”提示；总览预览与关联分支上限均为 3。
- 本轮概念包括：提示词注入、间接提示词注入、基准评测、对抗式微调、注入检测、输入清洗、Attention、Token 分类、LLM、LLM Agent、移动端、Android、任务对齐、工具调用安全。
- `scripts/knowledge-index.js` 在构建时从文章数据生成 `/data/knowledge-index-v1.json`；知识星图只消费该索引，不解析公开标签或搜索 XML 猜测概念。
- 新增标签时先判断它是系列、主题还是概念；只有稳定且可复用的概念进入知识星图。

## 6. 构建与验收

在功能工作树中依次执行：

```text
npm run clean
npm run build
npm run qa
git diff --check
```

`scripts/blog-contract.js` 会在生成前验证：

- 所有文章都有唯一、连续、按日期排序的正整数 `blog_id`；
- 文章图片路径与 `blog_id` 一致；
- 所有引用图片存在；
- 不存在旧式 `blog*` 目录名；
- 所有文章具有非空 `knowledge`，AI 安全文章具有 2–4 个公开标签，且每个知识概念都存在于 taxonomy；
- 论文研读文章同时属于 `笔记` 与 `科研` 两个独立分类。

自动 QA 至少覆盖：首页与第二页、四篇论文文章、桌面与手机、浅色与暗色换页材质、PJAX 翻页、横向溢出、破图、长标题裁切、术语组件、双分类独立图标、AI 四轴星图无重叠、应用栏透镜退场位置与底框材质、图片延迟撑高文章后的目录定位、全站每篇文章的逐标题目录高亮、暗色选区与论文图片悬停亮度，以及知识图谱连线离场复位。

## 7. 已知风险与踩坑

- Windows 下不同工作树可能因 Git 的 `core.autocrlf` 检出 CRLF。文章源文件仍应保持 UTF-8 无 BOM、LF；构建期契约解析会先把读取内容规范化为 LF，避免合法的标题、日期和 `blog_id` 被误判为缺失。
- Butterfly 主题曾含嵌套 Git 元数据；已隔离备份。不要把主题再次变成 gitlink，否则源站提交无法完整恢复主题源码。
- `main` 是生成站点，`source` 才是可维护源站；二者不能混用或在同一工作目录直接覆盖。
- Butterfly 原目录逻辑只在初始化与窗口缩放时缓存标题坐标；文章图片延迟加载会使目录高亮提前。目录坐标必须监听文章容器尺寸变化，并在 PJAX 重建时清理旧观察器。
- 液态透镜的退场不能在 `pointerleave` 时立刻回中；应先在最后位置淡出，完全隐藏后再无动画复位，否则会出现横向“飞回中间”。
- 液态玻璃的静态背景不能绑定 `--ops-liquid-x`；即便透镜已透明，底层径向高光仍会随复位坐标回到中心，形成另一种肉眼可见的“回拉”。动态坐标只能作用于透镜层。
- Butterfly 的 `nav-fixed` 与自定义 `ops-nav-scrolled` 退出阈值不同。文章固定标题的宽度、字号和行高必须只跟随 `nav-fixed`，否则上滑临近顶部时会先放大，再在 0px 收回。
- `annotateArticleCategories()` 不能用分类父容器作为“已处理”标记；一篇文章有多个独立分类时必须逐链接标记，否则只会渲染第一个分类图标。
- 文章页回顶时不能重播 `ops-nav-arriving`。它会与 Butterfly 约 300ms 的固定导航退出节流叠加，造成标题先闪现一次再被隐藏；入场动效只保留给非文章页面。
- Hexo 会自动载入仓库 `scripts/` 下的 JavaScript。可直接执行的 QA 脚本必须用 `require.main === module` 保护入口；Playwright 等仅供 QA 使用的可选依赖，以及依赖生成目录的读取，都必须延迟到入口内，否则未安装开发依赖的正式工作树会在 `hexo clean/build` 扫描阶段报错。
- Butterfly 的目录激活线约在视口顶部 80px。逐标题 QA 必须把目标标题滚过激活线后再断言，不能在边界外侧取样，否则会把正常保留上一章节误判为错位。
- 知识图谱悬停连线在离场时既要取消延迟计时器，也要清除已经落到节点和边上的强调/弱化类；只清计时器无法撤销已生效的状态。
- 暗色文章图片的悬停规则不能覆盖静态暗化滤镜；静态与悬停必须保持相同亮度，仅用位移和阴影表达浮动。
- 图片许可、邻近工作证据和论文公开范围仍是发布前人工 Gate，自动构建通过不代表可直接发布。

## 8. 2026-09-01 迭代记录

- 建立本地 `source` 基线与独立功能工作树 `feat/paper-migration-log-pagination`。
- 将旧 BIPIA 内部草稿隔离到 `D:\Hacking_world\myblog-isolated\20260901-old-bipia`。
- 迁移并公开化四篇论文研读文章，按 Colin 指定日期写入，并按全站时间顺序编号为 8、11、12、13。
- 统一 13 篇文章的 `blog_id` 与 `blogX` 图片路径；首页第二页 LOG 延续为 03、02、01，不再刷新计数。
- 加入文章编号与图片目录契约检查、术语组件及扩展后的知识标签 taxonomy。
- 分离公开 `tags` 与细粒度 `knowledge`，增加构建期知识索引；AI 星图改为“威胁 / 防御 / 系统对象 / 技术机制”四轴单层渐进展开，并为长标签提供省略显示与完整提示。
- 修复文章插图加载后目录高亮与正文错位的问题；修复应用栏透镜离场时瞬间飞回中心的问题。
- 换页控件改为无独立卡片的轻量阅读轨道，并完成桌面/手机、浅色/暗色视觉检查。
- 2026-09-01 本地验证：13 篇编号、图片路径与知识元数据契约通过，Hexo 生成 181 个文件；12 个页面/视口用例、PJAX、AI 四轴星图、延迟图片目录定位与液态透镜退场回归均通过，无横向溢出、破图、标题裁切或节点重叠。
- 根据第二轮视觉验收移除换页轨道的整块渐变承载层，改为直接落在壁纸上的页码标记；补齐全部旧文章的 `knowledge`，将星图分支预览上限提高到 3，并将四篇论文设为 `笔记 + 科研` 双分类。
- 修复应用栏静态底层高光回中和文章固定标题退出前伸缩；新增“静态背景不随指针”“标题临界点几何一致”“知识总览无 0”“分页无承载带”回归检查。
- 修复论文文章双分类只显示“笔记”图标的问题，现在“笔记 / 科研”各自显示书本与芯片图标；禁止文章页回顶重播应用栏入场动画，并加入逐帧退出回归。
- 清理应用栏底框的多层渐变、下沿内阴影与过强顶光，保留单层透明底材、轻边界和移动液态透镜；浅色与暗色底框均纳入截图与材质属性检查。
- 2026-09-01 第三轮本地验证：Hexo 生成 181 个文件；12 个页面/视口用例、双分类图标、文章标题回顶逐帧状态、应用栏明暗材质与既有回归全部通过。
- 2026-09-02 调整文章阅读态：主内容面板在明暗模式均提高约 5% 不透明度；固定标题合并为单层窄阴影；暗色论文图片降亮且悬停不再增亮；暗色文字选区改为低饱和蓝灰。
- 修复知识图谱连线悬停离场后残留；删除与“博客工程”重复的“博客搭建”公开标签、知识概念及关系边。
- 修复 QA 脚本被 Hexo 自动载入的问题，并把目录对齐检查扩展到全部 13 篇文章、共 175 个标题。最终契约检查、Hexo 构建和 12 个页面/视口回归全部通过，目录错位为 0，知识连线离场残留为 0。
- 2026-09-02 发布前复核发现正式 `source` 工作树未安装 Playwright 时，Hexo 扫描 QA 脚本仍会触发顶层依赖加载；已将 Playwright 改为仅在直接运行 QA 时加载，保持普通构建不依赖浏览器测试环境。
- 2026-09-02 正式 `source` 工作树受全局 `core.autocrlf=true` 影响，将 Markdown 检出为 CRLF；契约检查现会在解析 front matter 前规范化换行，源文件无需批量重写，LF 与 CRLF 工作树都可重复构建。
- 2026-09-02 Git 工作树发布链正式落地：功能分支与 `source` 均推送到远端，正式源站在独立 `source` 工作树生成 180 个文件；GitHub Pages `main` 部署提交为 `7a31536`。`https://c01in.com/`、RENNERVATE 文章页及 GitHub Pages 源地址均返回 200，并命中新版 `ops-v2.0.css?v=20260902-r9`。

## 2026-09-06 友链更新

- 在正式源站 `source/_data/link.yml` 的“友情链接”组末尾新增 DannisKing，地址为 `https://dannisking.com`，有效头像为 `https://dannisking.com/blog/img/brand/dannisking-avatar.png`，简介为 `Beyond the known. Into the unknown.`；保留其他友链、顺序及现有样式。
- 初次添加完成 YAML 解析、条目唯一性、既有数据不变检查及 `flink.pug` 的 5 张卡片内存渲染；当时未构建或发布。Colin 随后明确要求“上推”，本轮授权仅覆盖友链更新及必要的发布修复。
- 生效源为 `source/_data/link.yml`，主题读取 `site.data.link`；`source/data/link.yml` 是另一份旧文件，当前模板和友链增强脚本未引用，本次不重复写入或清理。
- 修改前备份（包含友链文件和本维护记录）：`D:\Hacking_world\myblog-backups\20260906-add-dannisking`。恢复时仅选取这两个明确目标，不覆盖现有文章改动。

### 发布验收与范围保护

- 在独立源码工作树 `D:\Hacking_world\myblog-worktrees\add-dannisking-20260906` 验收，基于 `source` 的 `5c4e0ae`；复用现有依赖，不安装或升级依赖。未带入正式目录中 13 篇文章的未提交修改或未跟踪的 AGENTS.md。
- 干净生成 180 个文件，13 篇文章编号/图片/知识契约通过；全站 QA 通过 12 个页面/视口用例及 13 篇文章的 175 个标题检查。修正头像地址后重建，并复测友链桌面/手机、浅色/暗色共 4 个用例，头像原图加载、横向溢出及悬停连线离场检查全部通过。
- 原头像 `/img/brand/dannisking-avatar.png` 被浏览器和独立 HTTP 检查同时确认返回 404；对方首页资源使用 `/blog/` 前缀，同名 `/blog/img/brand/dannisking-avatar.png` 返回 200、`image/png`，浏览器实际加载宽度 1254px。仅补齐资源前缀，未更换头像素材。
- 发布前实际远端 `main` 为 `cf3d0788f672e757de569d2f0756a4e4178d592a`，比旧维护记录更新；BIPIA 和 RENNERVATE 的线上部分标题与 `source` 基线不同。该不同步不在友链任务内修复，之后全站发布前需要单独核对，不能用旧源码覆盖线上文章。
- 因此本次以现有 `main` 建立产物工作树 `D:\Hacking_world\myblog-worktrees\dannisking-pages-20260906`，仅复制本轮生成的 `link/index.html`，使用非强制 Git 快进推送；不运行会替换整站产物并强推的默认部署器。候选分支差异仅一页，其 SHA-256 与已验收生成页一致。
- 发布前备份：`D:\Hacking_world\myblog-backups\20260906-dannisking-release`，含发布前维护记录、友链基线、原头像配置和原公网友链 HTML。实际推送结果及公网核验在完成后追加。
- 2026-09-06 21:34（Asia/Shanghai）发布完成：友链源码提交 `fe1b740fb14e9faf9d9b1b31d543b2da34acb71a` 已推送 `source`；公网提交 `62d4bc1e778b9be9ebd988fa9c4767020ee67a9d` 已以非强制快进方式推送 `main`，相对 `cf3d078` 仅变更 `link/index.html`。`https://c01in.com/link/` 返回 200，实际页面包含 DannisKing、修正后的头像地址和原简介。
- 发布后 13 篇已有文章及旧 `source/data/link.yml` 共 14 个文件的 SHA-256 与修改前一致；未跟踪的项目 AGENTS.md 未暂存或发布。后续如需回滚本次公网页，可对 `main` 的 `62d4bc1` 创建反向提交，不强推或整体回退其他文章。

## 2026-09-10 miracle 友链更新

- 按 Colin“帮我挂上友链”的要求，在 `source/_data/link.yml` 的友情链接组末尾新增 `miracle`，保留原字段：`https://s1r1us.top/`、`https://s1r1us.top/img/avatar.png`、`keep moving and moving`。网站及头像 HTTP 检查均返回 200，头像为 PNG；浏览器实际加载宽度 1080px。
- 源码工作树 `D:\Hacking_world\myblog-worktrees\add-miracle-20260910` 基于远端 `source` 的 `aa13d26`；复用现有依赖与 Codex 自带 Playwright，不安装软件。干净构建生成 180 个文件，13 篇文章契约通过；完整 QA 通过 12 个页面/视口用例、13 篇文章共 175 个标题检查。最终候选公网友链页通过桌面/手机 × 浅色/暗色 4 个专项用例，卡片和页面无横向溢出、原头像正常、节点总数 6、悬停连线离场恢复正常。
- 产物工作树 `D:\Hacking_world\myblog-worktrees\miracle-pages-20260910` 基于远端 `main` 的 `62d4bc1`。完整生成页还会改变一条既有友链简介及随机标签顺序，故只从构建结果提取 miracle 卡片插入原公网页；去掉新增卡片后与原页面逐字节一致。发布差异只包含 `link/index.html` 的新增卡片，不替换整站或其他友链内容。
- 修改前备份位于 `D:\Hacking_world\myblog-backups\20260910-miracle`，包含友链源码、维护记录、原公网友链 HTML 与原文件散列。13 篇未提交文章、旧 `source/data/link.yml` 和未跟踪 AGENTS.md 共 15 个文件保持不变。验收报告位于源码工作树 `qa/release/report.json` 与 `qa/friend/report.json`，新增卡片的范围校验位于备份目录 `page-scope.json`。

- 2026-09-10 22:08（Asia/Shanghai）公网发布核验完成：源码提交 `e6ae523` 与公网页面提交 `6d5f877b1fccf4857d8c6c5c424329873e569216` 已原子、非强制推送至 `source` / `main`。`https://c01in.com/link/` 返回 200，miracle 名称、网址、原头像和简介均命中；线上桌面/手机 × 浅色/暗色 4 个用例再次通过，头像实际加载宽度均为 1080px，报告为源码工作树 `qa/friend-public/report.json`。发布后 15 个保护文件的 SHA-256 与修改前一致。回滚此公网页更新时，针对 `main` 上的 `6d5f877` 创建反向提交，勿整体回退其他页面。

## 2026-10-20 0xGame2026 AI 题解本地整理

- 按 Colin 要求，在 Obsidian 可见的 `source/_posts/竞赛WP｜0xGame2026 AI 题解与学习记录.md` 新建持续更新文章，先完成「粗心的小x」一节。记录聊天与 `.env` 解码、Git 历史中的删除行、分页器和命令拼写踩坑，以及 Colin 提供的完整 flag；后续题目在同一篇继续追加。
- 新文章使用 `blog_id: 14`、`abbrlink: 0xgame2026-ai`、UTF-8 无 BOM / LF；公开标签为 AI安全、CTF、学习笔记，knowledge 使用已有 CTF、Python 概念，不扩展 taxonomy。五张用户截图原样复制到 `source/images/blog14/`，Markdown 沿用 `images/blog14/...`。
- 新文章和 `blog14` 目录原本不存在。本维护记录修改前已备份到 `D:\Hacking_world\myblog-backups\20261020-0xgame-ai-article\BLOG_MAINTENANCE.md`。已有 13 篇文章的内容散列与任务开始时一致，保留原有未提交修改。
- 本地 `npm run build` 通过，14 篇文章编号及知识元数据契约通过；另行检查新文章的 5 个相对图片引用、原图与复制图/生成图字节一致性，以及编码和换行。生成页面的 5 个图片地址均为 `/images/blog14/...`，与 `public/images/blog14/` 产物对应。未进行浏览器多端视觉验收。
- 本次仅本地写作与构建，无 Git 提交、推送或部署。全仓 `git diff --check` 仍报告既有文章中的行尾空白，不属于本次改动；本次新增文章和维护记录单独检查。
- 同日按 Colin 提供的简短 WP 重写第一题，仅保留三步解题、三张关键截图与 flag；沿用当前文件名 `竞赛题解 02｜0xGame2026 AI 题解与学习记录.md`、元数据、开场及 Week 1 标题。修改前版本备份于 `myblog-backups/20261020-0xgame-ai-concise/`，另两张原图保留在素材目录。核对正文、图片路径和格式，未再次构建或上推。
- 随后按要求在三步 WP 后补充 `git log -p -- chat.py` 的简便查法及简短 Git 命令说明，保留前文和图片；修改前备份于 `myblog-backups/20261020-0xgame-ai-git-notes/`。仅检查追加范围和 Markdown 格式，未构建或上推。
- 再按 Colin 的口吻精简讲解，补上题目原文和两个原始附件，文件放在 `source/attachments/blog14/`，正文使用 `../attachments/blog14/...` 链接。原始 `chat_export.json` 含未转义引号，Hexo 默认 JSON 渲染会报错；在 `_config.yml` 的 `skip_render` 中仅加入这两个附件路径，使其原样输出。首次失败留下 Page 缓存，清理生成缓存后构建通过；两个附件在源目录、生成目录均与原件逐字节一致，生成页链接解析正确。文章、维护记录和配置的修改前备份位于 `myblog-backups/20261020-0xgame-ai-wording-attachments/`，未提交、上推或部署。
- Colin 随后明确只需介绍附件：将下载链接替换为两个文件的简短说明，撤去源目录和生成目录中的附件副本及对应 `skip_render` 配置，保留其新增的 Week 1 / Week 2 复现地址和同期正文修改。修改前文件及附件副本已备份至 `myblog-backups/20261020-0xgame-attachment-description/`。本地构建通过，两个复现地址保留，生成页面不再含附件下载链接；未上推。

### 同日追加 ez_pytorch

- 在现有 `竞赛题解 02｜0xGame2026 AI 题解与学习记录.md` 末尾追加「02｜ez_pytorch」，保留原正文逐字节不变。按 Colin 实际过程记录 `torch.load` 报错、解压模型、`pickletools` 分析、CyberChef 恢复代码排版及运行 `solve.py` 得到结果，简要补充四段数据还原逻辑和 Pickle 的函数调用机制。
- 使用 Colin 提供的 flag `0xGame{3z_p1ckl3_fOr_pyt0rch}`，将指令截图和终端结果图原样复制为 `source/images/blog14/06-pickle-disassembly.png`、`07-pytorch-flag.png`；只介绍附件，不增加附件下载。正文和本维护记录修改前备份于 `D:\Hacking_world\myblog-backups\20261020-ez-pytorch`，两张图片为新增文件。
- 本地 `npm run build` 通过，14 篇文章契约检查通过；另行核对原正文保留、UTF-8 无 BOM / LF、代码块闭合及图片原件一致性。生成页包含新增章节和 flag，两张图片均转为 `/images/blog14/...` 并对应实际生成图。HTML 中花括号使用数字实体，验证时按解码后的文字核对。未执行附件中的 Pickle，未进行浏览器多端视觉验收；本次无 Git 提交、推送或部署。

- Colin 随后提供裁剪后的记事本图，已替换 `06-pickle-disassembly.png`，去除原图中的无关标签页信息；含本地用户名路径的终端结果图已从源/生成目录移至备份，结果以 flag 文本保留。同步精简本节，删去环境专属路径、工具配置说明和重复解释。修改前版本与两张旧图备份在 `myblog-backups/20261020-ez-pytorch-concise/`。再次构建通过，核对新图原件/源图/生成图一致，原第一题正文保留，未提交或上推。后续题解截图先检查无关标签页、用户名及本地路径等脱敏项，正文以实际步骤和必要原理为主。

## 2026-11-05 0xGame 题解行文精简

- 按 Colin 确认的四点建议调整现有文章：将第一题的一行 Git 查法移到命令补充，删去提交输出中的作者和日期，改顺配置加载与 Git 历史的解释；第二题按“原脚本报错 → 简单解法 → 拆包分析”排列，删去重复引导语。保留原口吻、四段还原逻辑、Pickle 原理和 Office 格式的一句补充。
- 修改前文章与维护记录备份于 `D:\Hacking_world\myblog-backups\20261105-0xgame-wording`。已查看精确差异，并核对元数据、flag 及分段、图片引用、UTF-8 无 BOM / LF 和代码块闭合。本次为局部文案调整，未重新构建、提交或上推。

## 2026-11-06 0xGame 题解发布

- Colin 明确要求“上推吧”，发布当前文章及实际引用的 `05-deleted-key.png`、已脱敏的 `06-pickle-disassembly.png`。保留后续题目占位和原文口吻；附件只作介绍，不上传 ZIP、模型、聊天记录或未引用截图。
- 在 `myblog-worktrees/0xgame-source-20261105` 隔离构建，14 篇文章契约通过，干净生成 184 个文件。分页 QA 原来写死第二页 3 篇，现从生成页读取预期 LOG 编号，本次第二页为 04、03、02、01。
- 产物以远端 `main` 的 `6d5f877` 为基线，结合旧源码与新增文章的构建差异合并，保留 13 篇线上旧文正文、既有搜索条目与知识索引内容；更新新文章、两张图片、首页、归档、分类/标签导航和公共侧栏。随机标签云与旧文推荐顺序沿用线上版本，保留已有友链。
- 最终候选站点通过完整 QA：12 个页面/视口用例、14 篇文章共 188 个标题检查；新增文章桌面/手机 × 浅色/暗色 4 个用例通过，图片加载、flag 文字、无横向溢出及无附件下载链接均已核对。源码差异检查通过；生成 HTML 的主题空白行按产物规则检查。
- 发布备份与范围核对记录位于 `D:\Hacking_world\myblog-backups\20261105-0xgame-release`，全站 QA 位于隔离源码工作树的 `qa/release/report.json`。提交仅包含本文、两张图片、必要的分页 QA 修正及维护记录；其他本地文章和配置修改保留。实际推送结果与公网核验随后追加。
- 发布完成：源码提交 `0138af6`、站点提交 `fd71cbf` 已分别快进推送至 `source` / `main`。首次原子推送遇到 GitHub `commit_refs_rules` 服务错误，确认远端未变后改为逐分支推送成功。公网 `https://c01in.com/posts/0xgame2026-ai.html` 返回 200（重定向至无扩展名地址），首页已出现新文章；两张 PNG 返回 200，内容散列与本地一致。公网桌面/手机 × 明暗 4 个用例通过，报告保存在备份目录 `qa-article-public/report.json`。发布前后 14 个本地文章文件散列一致。回滚站点时针对 `fd71cbf` 创建反向提交，不整体回退旧文。

## 9. 回滚位置

- 本轮源站备份：`D:\Hacking_world\myblog-backups\20260901-article-migration-log-pagination`
- 本轮 UI 与知识索引增量备份：`D:\Hacking_world\myblog-backups\20260901-ai-atlas-nav-toc-pagination-r1`
- 本轮视觉修复与全站知识元数据备份：`D:\Hacking_world\myblog-backups\20260901-ui-repair-atlas-metadata-r2`
- 本轮分类图标、标题退出与应用栏底材备份：`D:\Hacking_world\myblog-backups\20260901-category-title-nav-clean-r3`
- 本轮阅读态、知识连线与全站目录审计备份：`D:\Hacking_world\myblog-backups\20260901-title-shadow-article-opacity-r4`
- 本轮 QA 可选依赖延迟加载备份：`D:\Hacking_world\myblog-backups\20260902-qa-lazy-playwright-r5`
- 本轮文章契约 CRLF 兼容备份：`D:\Hacking_world\myblog-backups\20260902-contract-crlf-r6`
- 本轮公网部署记录备份：`D:\Hacking_world\myblog-backups\20260902-public-deploy-record-r7`
- Butterfly 原嵌套 Git 元数据：上述备份内 `theme-butterfly-dotgit`
- 旧 BIPIA 草稿隔离：`D:\Hacking_world\myblog-isolated\20260901-old-bipia`
- 当前功能工作树：`D:\Hacking_world\myblog-worktrees\paper-migration-20260901`

回滚时优先恢复明确的目标源文件，不使用破坏性的全仓库重置，也不删除上述备份或隔离区。
