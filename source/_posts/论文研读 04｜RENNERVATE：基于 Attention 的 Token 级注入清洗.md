---
title: 论文研读 04 | RENNERVATE：基于 Attention 的 Token 级注入清洗
date: 2026-08-28 19:25:00
blog_id: 13
categories:
  - 笔记
tags:
  - 论文研读
  - 间接提示词注入
  - Attention
  - Token 分类
  - 输入清洗
abbrlink: ef9d0362
description: 从 token、embedding、attention 与两步池化讲清 RENNERVATE 的 token 级检测和清洗，并核对其白盒前提、效用与自适应攻击结果。
---

## 前言与论文信息

2017 年的 *Attention Is All You Need* 把 Transformer 推上了舞台，这个标题后来也快成了论文界的固定句式。RENNERVATE 接得很直接：*Attention is All You Need to Defend Against Indirect Prompt Injection Attacks in LLMs*。这是一处标题上的致意，方法也确实从 attention 下手——模型照常用 attention 生成回复，防守者再把这份内部信号拿来找注入。

标题接得漂亮，方法却不算好读。它先让模型生成一小段回复，读取各层、各 head 留下的 attention，再回头判断输入中的哪些 token 属于注入。随后，系统删掉这些输入 token，输出可供应用继续处理原任务的清洗文本。最多前 32 个**回复 token**负责产生线索，真正被分类和删除的是**输入 token**；这两个方向一旦写反，后面的池化和清洗也会一起读反。

| 项目 | 信息 |
|---|---|
| 论文 | *Attention is All You Need to Defend Against Indirect Prompt Injection Attacks in LLMs* |
| 作者 | Yinan Zhong、Qianhao Miao、Yanjiao Chen、Jiangyi Deng、Yushi Cheng、Wenyuan Xu |
| 发表信息 | NDSS Symposium 2026；会议于 2026 年 2 月 23—27 日在美国圣迭戈举行 |
| DOI | [10.14722/ndss.2026.240394](https://doi.org/10.14722/ndss.2026.240394) |
| CCF 分类 | NDSS 在 [CCF 网络与信息安全领域目录](https://www.ccf.org.cn/Academic_Evaluation/NIS/zgjsjxhtjgjxshy/al/2023-03-09/787256.shtml) 中列为 A 类会议 |

![RENNERVATE 的 token 清洗主线](/images/blog13/rennervate-mainline.png)

*图 1：单个输入 token 的 attention 特征依次经过回复位置池化、head 池化、分类、平滑与删除。根据论文 Equation 4、Figures 2—3、Algorithm 1 自制；`l / h / m` 分别表示层数、<span class="glossary-term" data-glossary-term="attention-head">attention head</span>s 与截取的回复 token 数。*

## 模型生成回复时，attention 怎样留下信号

模型不会直接处理人眼看到的整句话。<strong><span class="glossary-term" data-glossary-term="tokenizer">Tokenizer</span></strong> 先按模型自己的词表把文本切成 token，再把每个 token 映射为整数 ID。ID 本身只是索引；模型到 embedding matrix 中查出对应的高维向量，才得到进入网络的初始 <strong><span class="glossary-term" data-glossary-term="embedding">embedding</span></strong>。在模型参数和 token ID 不变时，这次查表不是随机抽签。上下文含义要等这些向量经过多层 Transformer 之后逐步形成。

生成回复采用自回归方式。模型先依据全部输入预测第一个回复 token，把它接到上下文末尾，再预测第二个，如此继续。生成第 `j` 个回复 token 时，**causal mask**（因果掩码）挡住尚未出现的未来回复；模型只能读取允许看见的输入和此前已经生成的部分。RENNERVATE 正是在这段正常推理里读取 attention，不需要另造一套“安全 attention”。

<strong><span class="glossary-term" data-glossary-term="attention">Attention</span></strong> 可以先理解成当前生成位置怎样分配对既有上下文的关注权重。它随层、attention head、输入内容和回复位置变化：同一个 token 的 embedding 可以保持不变，它在不同句子、不同层和不同回复位置上得到的 attention 仍会变化。对某个输入 token `i`，论文把前 `m` 个回复位置、`l` 层和每层 `h` 个 heads 的数值收在一起，后面才得到 `l × h × m` 张量。

这组权重在论文实验中具有分类价值，却不是“某个 token 导致攻击成功”的完整因果证明。RENNERVATE 读取的是生成过程留下的信号；提示结构、模型训练、解码策略与任务语境仍然参与最终行为。

![从 token、embedding 到 attention，以及三种架构的可见范围](/images/blog13/attention-primer.png)

*图 2：上半部分区分 tokenization、embedding 与 attention；下半部分比较三种架构的可见范围。根据 Zhong et al., NDSS 2026, Section II-A，PDF pp.2—3 自制；矩阵只表示 attention mask，不表示不同模型的 heads 可以逐一对应。*

### 三种架构改变了哪些可见关系

论文的预备知识区分三种 Transformer 架构，差别首先落在“哪些 token 可以互相看见”。<strong><span class="glossary-term" data-glossary-term="encoder-decoder">Encoder-decoder</span></strong> 把输入和输出分开：encoder 让输入 token 双向交互，decoder 用因果 self-attention 读取已生成内容，再通过 cross-attention 查看 encoder 表示。T5、Flan-T5 属于这一路线，本文只把它们用于架构说明，没有作为目标模型测试。

<strong><span class="glossary-term" data-glossary-term="causal-decoder">Causal decoder</span></strong> 把提示与回复放进同一条序列，使用下三角 causal mask；每个位置只能看见自己和过去。Dolly、Falcon、LLaMA2 与 LLaMA3 属于本文的 causal decoder 目标模型。<strong><span class="glossary-term" data-glossary-term="prefix-decoder">Prefix decoder</span></strong> 则允许输入前缀内部双向交互，开始输出后再按因果方式逐 token 生成；ChatGLM-6B 属于这一类。（Sections II-A、VI-A，PDF pp.2—3、6—7）

三种架构的共同切口是：生成回复时，都能形成“回复 token 指向输入 token”的 attention 信号。它们的层数、head 数和 attention 组织并不相同，所以 RENNERVATE 要先把原始张量压成固定维表示；论文在五个目标模型上分别实现 detector，没有把一个模型的 detector 直接搬到另一种架构上。（Section II-A、Section VI-A，PDF pp.2—3、6—7）

## 部署 RENNERVATE 需要看见什么

基础威胁模型允许攻击者完全控制 Agent 读取的外部文本，并知道系统可能部署检测与防御；防守者不修改目标 LLM 参数，但可以读取推理时的 attention，因此部署端具有白盒内部观测权限。论文后面的自适应评测再区分两种攻击：黑盒攻击依靠反复查询与输出反馈改写载荷，白盒攻击直接把 detector loss 写进梯度优化目标。（Section IV、Section VI-D，PDF pp.4、11—12）

这个条件直接决定了部署边界。普通闭源 API 通常只返回最终文本，不开放每层每个 head 的 attention。RENNERVATE 可以由模型提供方部署在模型内部；API 用户则可以按论文建议，在本地影子 LLM 上读取 attention、完成检测和清洗，再把文本送给主模型。（Section VII，PDF p.13）

<span class="glossary-term" data-glossary-term="shadow-llm">影子 LLM</span> 读到的是**自己的 attention**。论文把 ChatGLM-6B 作为可本地运行的例子，没有充分证明一个影子模型的 token 判断能够稳定保护任意架构、任意版本的闭源目标模型。它是一种部署建议，还不是跨模型迁移已经解决的证据。

作者估计 ChatGLM-6B 与 RENNERVATE 可以一起运行在单张 RTX 3090 上。这个数字只说明论文所述配置具有实现可能；复现还需要正确导出 attention、匹配 tokenizer，并为影子模型训练 detector。

## Attention 怎样变成逐 token 的删除决定

RENNERVATE 由 Token-Level Detector、Injection Identifier 和 Injection Sanitizer 三个模块组成。

![原论文 Figure 2：RENNERVATE 总体设计](/images/blog13/paper-figure-2-system.png)

*图 3（原论文 Figure 2）：左侧模型产生 attention 特征，右侧依次进行逐 token 检测、整段识别与清洗。来源：Zhong et al., NDSS 2026, Figure 2，PDF p.5；用于固定三个模块及其输入输出。*

### Token-Level Detector：把 attention 压成两个 logits

模型生成前 `m` 个回复 token 时，RENNERVATE 收集它们对每个输入 token 的 attention。对单个输入 token，原始特征维度是 `l × h × m`：`l` 层，每层 `h` 个 head，每个 head 保留 `m` 个回复位置。论文默认 `m=32`。（Equation 4、Section VI-A，PDF pp.5—6）

这个张量大小随模型层数、head 数和截取回复长度变化，不能直接交给统一结构的分类器。论文因此设计两步 attentive <span class="glossary-term" data-glossary-term="pooling">pooling</span>：

1. **Resp-Wise pooling** 先在回复位置维上聚合。它学习哪些回复 token 更有辨识力，同时保留加权均值与加权标准差；
2. **Head-Wise pooling** 再在 attention-head 维上聚合，让不同 head 的信息压成固定长度表示。

两级都不是普通平均。Attentive statistics pooling 先学习不同 frame 的权重，再同时计算 weighted mean 与 weighted standard deviation：均值保留总体趋势，标准差记录回复位置或 heads 之间的波动。对一个给定模型，每个输入 token 最终得到固定维表示；输入 token 的数量本身仍随文本长度变化，所以整段输入仍是一组变长的逐 token 特征。

拿论文里的 ChatGLM 配置做一个尺寸练习：`l=28`、`h=32`、`m=32` 时，单个输入 token 起初对应 `28×32×32=28,672` 个 attention 数值。Resp-Wise pooling 将 32 个回复位置压成每个 head 的均值与标准差，形状变为 `28×1×64`；Head-Wise pooling 再聚合 32 个 heads，得到 `1×56` 的固定表示。分类器面对的输入终于不再随着回复长度和 heads 数量无限伸缩。

准确的维度变化是：第一步压缩**回复位置维**，第二步压缩 **head 维**。层的信息随后进入全连接层与残差块，分类器为每个输入 token 输出 clean / injected 两个 <span class="glossary-term" data-glossary-term="logits">logits</span>；logits 是 softmax 前的未归一化分数，不是概率。（Section V-A、Figure 3，PDF pp.5—6）

![原论文 Figure 3：两步池化与逐 token 分类器](/images/blog13/paper-figure-3-pooling.png)

*图 4（原论文 Figure 3）：上方是 attentive statistics pooling，下面是 Resp-Wise、Head-Wise 与分类器结构。来源：Zhong et al., NDSS 2026, Figure 3，PDF p.6；用于核对两步池化的真实网络结构。*

### Injection Identifier：从孤立标签判断整段注入

逐 token logits 仍可能有孤立误判。Identifier 先用宽度 `k=5` 的 <span class="glossary-term" data-glossary-term="mean-filter">mean filter</span> 平滑预测，再计算连续 injected token 的最长片段；最长片段超过阈值时，整段文本才会被判为 injected。论文默认阈值同样设为 5。（Algorithm 1、Section VI-A，PDF pp.5—6）

### Injection Sanitizer：删除输入 token，输出清洗文本

Sanitizer 根据平滑后的 token 标签删除预测为 injected 的输入 token，随后 detokenize 得到清洗文本，供 LLM-integrated application 继续处理未被注入的任务。最多前 32 个**回复 token**只负责产生检测特征；真正被逐个分类和删除的是**输入 token**。这是理解整个方法最容易写反的地方。

论文确定 detector 需要先取得最多前 `m` 个回复 token 对输入的 attention，之后才输出清洗文本；它没有规定完整应用怎样编排首段生成、清洗与最终回答，也没有报告端到端 latency。若部署者把它实现成“先探测，再用清洗文本重新生成”，额外推理和首段输出隔离就是需要评估的工程成本，不是本文已经测量的实验结果。

![原论文 Figure 8：一次实际检测与清洗](/images/blog13/paper-figure-8-sanitization-example.png)

*图 5（原论文 Figure 8）：同一段文本依次经过原始输入、逐 token 检测和平滑、token 删除。来源：Zhong et al., NDSS 2026, Appendix Figure 8，PDF p.17；用于观察分类边界怎样落到真实字符串上。图中灰色高亮是 detector 判定，删除线表示 sanitizer 最终移除的 token。*

## FIPI 怎样构造，近零 ASR 又意味着什么

### FIPI 的 token 标签从哪里来

FIPI 不是从真实攻击日志里直接采样出来的。作者以 SEP 的 9,160 组“用户指令—干净数据”为基础，用 GPT-3.5-Turbo 改写重复指令并扩充到 10,000 组 benign 实例；随后人工设计 100 组 **probe-witness**，把有唯一答案的 probe 写进攻击指令，用 witness 是否出现在回答中判定攻击是否成功。

攻击侧包含 Naive、Escape Characters、Context Ignoring、Fake Completion 及三种组合形式。作者把生成出的 adversarial instruction 随机插入干净数据，先在字符级标注起止位置，再用每个目标模型自己的 tokenizer 转成 token 标签。同一段文本换 tokenizer，标签边界也可能变化。最终 FIPI 包含 100,000 个 injected 实例与 10,000 个 benign 实例，覆盖 300 个 NLP 任务；作者另抽 1,000 条人工检查攻击部署与 token 位置标签。（Section VI-A，PDF pp.7—8）

训练集和测试集来自不同的“用户指令—干净数据”组合，并使用不同方式生成攻击指令。这比随机切开同一批模板更严格，仍然属于人工构造分布；它没有自动覆盖真实网页、邮件或 GUI 中所有表达方式。

### 检测与清洗使用了不同分母

检测实验使用留出的 `5,000 injected + 5,000 benign` 样本：五个目标模型的准确率为 `97.88%—99.58%`，FPR 为 `0.46%—2.42%`，FNR 为 `0.30%—1.82%`。（Section VI-A、Table I，PDF pp.7—9）

清洗比较的分母不同。作者从注入样本中另取 1,000 条与基线比较，RENNERVATE 清洗后的 FIPI ASR 为 `0%—0.20%`。因此，检测准确率与清洗 ASR 不能写成同一批 10,000 个测试样本上的连续指标。（Section VI-B.2、Tables II—III，PDF pp.8—10）

细粒度标签让训练目标与清洗动作直接对齐：分类器不是只学整段 `clean / injected`，而是要给每个输入 token 标出身份。论文在五个模型上分别实现 detector，不能把某个模型训练出的 logits 直接套给另一个模型。

### Utility 为什么会在跨任务设置里掉下去

![依据原论文 Tables III—IV 重绘的安全性与 Utility 表](/images/blog13/tables-3-4-safety-utility-redraw.png)

*图 6（自制数据重排图）：依据原论文 Tables III—IV 重绘。Table III 将 LLaMA2 与 LLaMA3 分开列出，两组各自保留 RENNERVATE 行；Table IV 接在其后，方便把清洗 ASR 与 <span class="glossary-term" data-glossary-term="alpacaeval">AlpacaEval 2.0</span> Utility 放在同一处阅读。数据来源：Zhong et al., NDSS 2026, Tables III—IV，PDF p.10。*

Table IV 的 FIPI win rate 为 `43.60%—46.78%`，接近无损时的 50% 参照点；跨任务组合里却出现 `1.90%`、`5.03%`、`9.84%` 等低值。作者检查失败样本后认为，注入里除了攻击指令，还可能夹着与注入任务有关的普通内容；清洗器没能完整去掉这部分，语法纠错等精细任务也可能因少量 token 误删而明显受损。（Section VI-C、Table IV，PDF p.10）

跨任务 ASR 还经过了一层 DeepSeek judge。作者从判断结果中随机抽取 200 条、按正负样本各半人工核验，judge accuracy 为 `94.50%`。这给测量链提供了抽样校验，也意味着这里的 ASR 含有 judge 误差；它与 FIPI 主实验依靠 probe-witness 的规则判定不是同一种测量方式。（Section VI-C，PDF pp.9—10）

“Token 级删除更精细”描述的是可用的操作粒度，不是 Utility 必然更高的保证。细粒度提供了一把更窄的手术刀，刀落在哪里仍由分类器决定；对语法纠错、格式转换这类依赖局部词形的任务，少量误删也可能明显改变结果。

## 未见攻击与自适应攻击下的残余 ASR

论文还测试了训练中没有出现的 GCG 和 Neural Exec。LLaMA2 上，GCG 清洗后 ASR 为 `0%—7%`，Neural Exec 为 `0%`。（Table VII，PDF p.12）这里的 unseen 指攻击方法或数据集没有进入训练，不表示某个 detector 已经跨目标模型迁移；每个目标模型仍使用自己的 attention 与 detector。

更值得保留的是自适应结果。这里的“黑盒”描述攻击者只通过查询观察系统，而不是说 RENNERVATE 变成了黑盒防御。PAIR/TAP 反复查询并修改注入，在 LLaMA3 上仍留下 `19% / 9%` ASR；白盒自适应 GCG 把规避 detector 的 loss 加进优化目标，五个数据集上的残余 ASR 为 `0%—5%`。（Tables VIII—IX，PDF p.12）

两种黑盒攻击的预算也不同：PAIR 最多查询 20 次，TAP 用树搜索把上限扩到 70 次；实验让 DeepSeek 同时承担 attacker 与 judge，并为每种攻击生成 100 个 FIPI 注入实例。白盒 GCG 则运行 500 轮优化，把“骗过目标模型”和“骗过 token detector”一起写进目标函数。攻击者知道什么、能查询多少次，都会改变 ASR；把这组自适应结果与普通 FIPI 表格并列，才看得出防御面对针对性优化时的真实余量。

分布内近零结果、自适应残余和跨任务 Utility 必须一起看。它们共同说明 attention detector 在论文设置中很强，也说明攻击者针对 detector 优化后仍能找到漏网样本。标题里的 “All You Need” 是方法命名，不是“只要 attention 就能解决所有 IPI”的实验结论。

## Token 级清洗的价值与部署代价

RENNERVATE 把模型生成时产生的内部 attention 变成逐输入 token 的检测信号，再把标签真正用于局部清洗。与 Detect & Remove 相比，它把删除单位推进到 tokenizer 产生的 token；代价是更高的目标模型可见性、需要先取得回复 token 的内部信号，以及按模型训练 detector 的工作。

作者在讨论中明确承认三项边界：内部 attention 是部署前提，task-specific content 可能在清洗后残留，多模态 IPI 尚未处理。（Sections VII—VIII，PDF p.13）论文覆盖文本输入与模型回答，没有观察图像、音频、GUI 元素、工具动作或设备最终状态；后四项是根据评测范围得到的综合判断。

“白盒”也需要拆开理解。RENNERVATE 读取内部 attention，却不修改目标 LLM 参数；BIPIA 的白盒方案则新增特殊 token 并监督微调目标模型。影子 LLM 路线把内部访问搬到本地模型上，却引入新的迁移问题：检测器依据影子模型自己的 attention 做判断，论文没有证明这种判断能稳定保护任意架构和版本的闭源目标。

多模态边界如今已经进入实证阶段：[EVA](https://aclanthology.org/2026.findings-acl.1230/) 研究 GUI 环境注入中的语义攻击，[OS-Sentinel](https://aclanthology.org/2026.acl-long.431/) 则在真实移动工作流里检查轨迹与动作风险。它们没有验证 RENNERVATE 的 token sanitizer 可以直接迁移到图像或 GUI；恰恰相反，输入表示、内部信号和最终结果指标都要重新定义。

**模型生成时留下的 attention 轨迹可以定位输入中的注入 token，由此实现更细的清洗；这份能力依赖内部可见性，detector 仍需按模型建立。应用若用清洗文本重新生成最终回答，还要承担额外推理。**

## 术语速查

<div class="article-glossary-index" data-glossary-collection="rennervate">
  <p class="article-glossary-index__status">术语数据正在加载……</p>
</div>

## 参考文献

[1] Yinan Zhong, Qianhao Miao, Yanjiao Chen, Jiangyi Deng, Yushi Cheng, Wenyuan Xu. *Attention is All You Need to Defend Against Indirect Prompt Injection Attacks in LLMs*. NDSS 2026. DOI: [10.14722/ndss.2026.240394](https://doi.org/10.14722/ndss.2026.240394).

[2] Jingwei Yi et al. *Benchmarking and Defending Against Indirect Prompt Injection Attacks on Large Language Models*. KDD 2025.

[3] Yulin Chen et al. *Can Indirect Prompt Injection Attacks Be Detected and Removed?* ACL 2025.

[4] Feiran Jia et al. *The Task Shield: Enforcing Task Alignment to Defend Against Indirect Prompt Injection in LLM Agents*. ACL 2025.

[5] Ashish Vaswani et al. *Attention Is All You Need*. NeurIPS 2017.

[6] Qiushi Sun et al. *OS-Sentinel: Towards Safety-Enhanced Mobile GUI Agents via Hybrid Validation in Realistic Workflows*. ACL 2026. DOI: [10.18653/v1/2026.acl-long.431](https://doi.org/10.18653/v1/2026.acl-long.431).

[7] Yijie Lu et al. *EVA: Evolving Semantic Adversaries for Red-Teaming GUI Agents Against Environmental Injection Attacks*. Findings of ACL 2026. DOI: [10.18653/v1/2026.findings-acl.1230](https://doi.org/10.18653/v1/2026.findings-acl.1230).
