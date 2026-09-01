---
title: 学习笔记 04 | 从网络扫盲到 Jenkins 自动部署：一次 Linux 实习实践
tags:
  - Linux
  - 计算机网络
  - MySQL
  - Nginx
  - Jenkins
  - 学习笔记
categories: 笔记
description: 从网络基础概念出发，记录一次 Linux 服务配置、数据库权限实验与 Jenkins 自动发布实践。
abbrlink: cb98cbc5
date: 2026-08-05 18:00:00
blog_id: 10
---

# 前言

有幸参加本次企业实习。

最初报名时，我并没有设定特别具体的技术目标，主要是想提前看看真实的职场环境：企业里的任务如何分配，不同人员怎样协作，以及现实中的服务器和 CTF 靶机有什么区别。

进入实习后才发现，除了体验工作流程，技术上的收获也比预想中丰富。任务内容从 Linux、UFW 和 MySQL，一路延伸到 TCP、HTTP、Nginx、Git 和 Jenkins。每个名词似乎都见过，排成一列以后却突然有了几分陌生。

此前我打 CTF 时用过 Linux，搭博客时也执行过 Git 和 Hexo，但这些知识一直比较零散。知道 `404` 表示没找到页面，却说不清请求已经走到了哪里；知道 `hexo d` 可以发布博客，也没认真想过网页究竟怎样从本地到达服务器。

本文先整理完成实践所需的基础概念，再按照实际操作顺序复盘 Linux 环境检查、UFW、MySQL、Nginx，以及 GitHub + Jenkins + SSH 的自动发布流程。

文中的服务器地址、账密、内部目录和网络配置等均已省略或替换，学习笔记可以公开，实验环境就不必开源了。

<!-- more -->

# 概念扫盲：先画一张网络地图

> 所谓基础不牢地动山摇，本人的网络基础可谓是**焚书坑儒**级别的，先把地图捋清，再谈如何赶路。

##  浏览器如何找到网页

浏览器访问网页，大致经过下面的过程：
*（其中，DNS 查询通常通过 UDP 或 TCP 完成；网页请求与响应则通过 TCP，或基于 UDP 的 QUIC 传输。浏览器解析和页面呈现属于本地处理）*

```text
输入 URL
  ↓
通过 UDP/TCP 向 DNS 服务器查询，将域名解析为 IP
  ↓
根据 IP 和端口连接目标服务器
  ↓
通过TCP + TLS（HTTP/1.1、HTTP/2）
或基于UDP的 QUIC（HTTP/3）建立连接
  ↓
发送 HTTP 请求
  ↓
Web 服务器处理请求并返回资源
  ↓
浏览器解析 HTML、CSS、JavaScript
  ↓
呈现页面
```

URL 全称是 **Uniform Resource Locator，统一资源定位符**。例如：

```text
https://example.com:8081/replay/index.html
```

可以拆成：

```text
https                 协议
example.com           域名
8081                  端口
/replay/index.html    资源路径
```

DNS 全称是 **Domain Name System，域名系统**，负责将域名解析为 IP 地址。它更像一本网络通讯录，只负责查号，不负责把网页送到浏览器。

IP 全称是 **Internet Protocol，网际协议**。IP 地址用于标识网络中的通信位置，并帮助数据包跨网络到达目标。

端口则用于区分同一台主机上的不同服务：

```text
22    SSH
80    HTTP
443   HTTPS
3306  MySQL
```

所以“服务器在线”不代表“网站一定能访问”。服务器可能活得很好，只是目标端口根本没人值班。

## IP、MAC 与 ARP

IP 地址用于网络层寻址，设备切换网络后通常可能发生变化。

MAC 地址是网卡在数据链路层使用的标识，主要参与同一局域网内的通信。IPv4 局域网中的 ARP 可以根据目标 IP 查询对应的 MAC 地址。

可以暂时这样理解：

```text
IP 决定数据要去哪个网络位置
MAC 决定局域网中的这一跳交给谁
```

访问远程服务器时，本机通常不会获得远程服务器的 MAC 地址，而是先查询默认网关的 MAC，再把数据交给网关继续转发。

这也解释了后面进行的 DHCP 静态分配：路由器记录终端 MAC，并为它保留相对固定的内网 IP，从而方便地址管理和访问控制。

> **补充：** MAC/IP 绑定适合管理终端地址，但 MAC 地址可以被伪造，因此不能单独作为强身份认证手段。

## TCP、UDP 与 QUIC

TCP 全称是 **Transmission Control Protocol（传输控制协议）**。
TCP 在正式传输数据前会通过三次握手建立连接，并利用序列号、ACK 确认、超时重传、流量控制和拥塞控制等机制，尽量保证数据完整、有序地到达。网页请求、SSH、数据库连接和文件传输通常都很重视这些能力。

UDP 全称是 **User Datagram Protocol（用户数据报协议）**。
UDP 不负责建立可靠连接，也不自带确认、重传和排序机制，因此协议较为轻量。它常用于 DNS 查询、实时音视频等场景；如果业务需要可靠性，可以由上层协议自行实现。

QUIC 是一种构建在 UDP 之上的现代传输协议。
它借助 UDP 传递数据，同时自行实现了可靠传输、加密、拥塞控制和多路数据流等能力。QUIC 不是简单的“UDP 升级版”，也不是把 TCP 和 UDP 直接拼在一起，而是针对现代网络环境设计的一套新传输机制。HTTP/1.1 和 HTTP/2 通常基于 TCP，HTTP/3 则使用 QUIC。

> **补充：三次握手**  三次握手是 TCP 建立连接的过程，不是所有网络通信都会经历的固定仪式。UDP 本身就没有这一步。

## HTTP、HTTPS 与状态码

HTTP 全称是 **Hypertext Transfer Protocol，超文本传输协议**。它规定客户端如何表达请求，以及服务器如何返回响应。

常见状态码包括：

```text
200 OK              请求成功
304 Not Modified    资源未变化，可以继续使用缓存
403 Forbidden       服务器拒绝访问
404 Not Found       没有找到请求的资源
500 Internal Error  服务器内部处理失败
502 Bad Gateway     代理无法正常连接后端服务
```

能够收到 `404`，通常说明 TCP 连接和 HTTP 请求已经到达某个 Web 服务，只是目标路径或文件不存在。靶场关闭时经常表现为直接打不开而不是 `404`，原因也正在这里：前者可能根本没有服务响应，后者至少还有服务器认真回了一句“没这东西”。

HTTPS 可以理解为受 TLS 保护的 HTTP。TLS 全称是 **Transport Layer Security，传输层安全协议**，主要提供通信加密、身份认证和完整性校验。

# 实践主线：从服务器检查到自动发布


> 理论与实践之间，通常隔着无数的`404`、`WARNING`、`Refused`......

前面的概念最终会落到两条实际链路上：

```text
访问链路：浏览器 → 网络 → Nginx → 网页文件
发布链路：本地代码 → GitHub → Jenkins → SSH → Linux → Nginx
```

接下来按照实际操作顺序复盘。

## 第一步：连接并检查 Linux 环境

首先使用 MobaXterm，通过 SSH 登录 Ubuntu 实验服务器。

SSH 全称是 **Secure Shell**，用于加密的远程登录与命令执行。登录后先检查基础环境：

```bash
whoami
hostnamectl
ip addr
df -h
free -h
```

这些命令分别查看当前用户、系统版本、网卡地址、磁盘和内存。

随后检查监听端口：

```bash
ss -lntup
```

参数含义如下：

```text
-l  显示监听状态
-n  直接显示数字地址和端口
-t  显示 TCP
-u  显示 UDP
-p  显示对应进程
```

再检查正在运行的服务和后台任务，确认没有其他人正在安装软件或修改相同配置。共享服务器不是个人练习机，动手前先看一眼现场，能省下很多“这是谁改的”式悬案。

> **补充：进程、服务与端口**  进程是正在运行的程序实例；服务是由系统管理、通常长期运行的后台程序；端口是网络访问服务时使用的逻辑入口。服务显示为运行状态，也不一定代表它成功监听了预期端口。

## 第二步：认识 UFW 的控制边界

UFW 是 Ubuntu 上常用的防火墙管理工具：

```bash
ufw status numbered
```

公网请求能否到达服务，通常受三层条件影响：

```text
云平台安全组
→ Ubuntu UFW
→ 应用程序的监听地址与端口
```

例如，Nginx 监听 `0.0.0.0:8081`，只表示它愿意从所有 IPv4 网卡接收请求。如果 UFW 或云安全组没有允许 `8081`，公网依然无法访问。

如果 Nginx 只监听 `127.0.0.1:8081`，则它只接受服务器自己发出的请求。即使防火墙放行，外部请求也不会被它接收。

本次实验没有直接将网页端口暴露到公网，而是通过 SSH 隧道访问。这种方式少开一个公网入口，也少给未来的自己留一个需要半夜解释的安全问题。

## 第三步：完成 MySQL 权限实验

为了不影响共享环境中的其他数据，先创建独立实验数据库与测试表，再设置管理账号和只读账号：

```sql
GRANT ALL PRIVILEGES ON lab_db.*
TO 'admin_user'@'localhost';

GRANT SELECT ON lab_db.*
TO 'read_user'@'localhost';
```

使用只读账号执行查询：

```sql
SELECT * FROM notes;
```

可以正常得到数据。继续尝试删除：

```sql
DELETE FROM notes WHERE id = 1;
```

MySQL 返回：

```text
ERROR 1142: DELETE command denied
```

![只读账号查询成功而删除被拒绝](/images/blog10/01-mysql-readonly-permission-denied.png)

这次红色 `ERROR` 不是失败现场，而是实验结果：账号身份有效，查询位于授权范围内，删除操作则被权限系统拦下。

MySQL 账号还包含来源主机：

```text
'read_user'@'localhost'   只允许服务器本机登录
'read_user'@'指定网段'      只允许匹配地址登录
'read_user'@'%'           允许任意来源尝试登录
```

此外，还要检查 MySQL 实际监听的位置：

```bash
ss -lntp | grep 3306
```

如果显示 `127.0.0.1:3306`，说明数据库只接受服务器本机连接。账号来源、监听地址、UFW 和云安全组共同构成数据库的访问边界。

## 第四步：备份并恢复数据库

使用 `mysqldump` 导出数据库：

```bash
mysqldump \
  --single-transaction \
  --no-tablespaces \
  -u admin_user -p \
  lab_db > lab_db.sql
```

再将备份导入独立恢复库：

```bash
mysql -u admin_user -p restore_db < lab_db.sql
```

恢复后重新查询数据，确认表结构与记录完整。

这里遇到一个值得保留的坑：即使 `mysqldump` 认证失败，重定向符 `>` 也可能提前创建一个大小为 `0` 的文件。因此“备份文件存在”不能证明“备份成功”，还要检查文件大小和内容：

```bash
ls -lh lab_db.sql
test -s lab_db.sql
```

文件存在只是有了一个壳，里面有没有数据库，还得另说。

## 第五步：完成 DHCP 的 MAC/IP 静态分配

在路由管理界面中，根据 DHCP 终端列表确认实验终端的内网 IP 与 MAC，再创建静态分配记录。

绑定后，路由器会根据终端 MAC，为其保留相对固定的内网 IP。这可以减少 DHCP 租约变化，方便编写访问控制规则和定位终端。

由于原始截图包含真实局域网 IP、MAC 和其他终端信息，本文不展示该界面。相比证明“我确实点过添加”，不泄露一整张局域网终端名单显然更重要。

## 第六步：部署并配置 Nginx

HTML 文件存放在服务器硬盘中，并不会自动回答浏览器。Nginx 作为 Web 服务器，负责监听端口、接收 HTTP 请求、查找文件并返回网页资源。

脱敏后的配置逻辑如下：

```nginx
server {
    listen 8081;
    server_name _;

    root /var/www/lab-web;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

修改后先检查配置：

```bash
nginx -t
```

确认语法正确，再重新加载：

```bash
systemctl reload nginx
```

随后使用 `curl` 从服务器内部验证：

```bash
curl -I http://127.0.0.1:8081/
curl http://127.0.0.1:8081/
```

`curl` 可以理解为不负责渲染页面的命令行浏览器。第一条命令查看状态码和响应头，第二条查看服务器返回的 HTML 正文。

> **补充：** 文件已经传到服务器，不代表 Nginx 一定会返回它。Nginx 的 `root`、`location` 与请求 URL 共同决定它最终读取哪个文件。

## 第七步：建立 GitHub 代码仓库

本地网页项目包含 `index.html`、`styles.css` 和 `README.md`。初始化 Git 仓库后完成首次提交：

```bash
git add index.html styles.css README.md
git commit -m "feat: add initial deployment page"
git remote add origin <远程仓库地址>
git push -u origin main
```

其中：

```text
git add      将修改加入暂存区
git commit   生成本地版本记录
git push     将提交发送到远程仓库
```

`commit` 成功不代表 GitHub 已经更新。只有完成 `push`，远程仓库和 Jenkins 才能看到该版本。

![GitHub 仓库中的首次提交](/images/blog10/02-github-repository-and-first-commit.png)

为了复现发布过程，后续又创建 `replay` 分支，对网页内容进行修改并推送。这样可以在不改动主分支的情况下重复验证整条部署链路。

## 第八步：安装并配置 Jenkins

Jenkins 安装在 Windows 实验机上，并以系统服务形式运行。安装时需要选择兼容的 Java 运行环境：

它在本次实验中的职责是：

```text
拉取 GitHub 指定分支
保存构建工作区
调用 Publish Over SSH
向 Linux 传输网页文件
执行部署后的检查命令
记录每次构建日志
```

Jenkins 不是另一个 GitHub，也不负责保存代码历史。它更像一名严格照流程办事的发布员：仓库给它什么版本，它就按任务配置继续处理什么版本。

在源码管理中填写仓库地址，并指定 `replay` 分支：
*（这里打错字了，指定分支里应该是“replay”，这也当时导致 Jenkins 无法找到目标分支）

![Jenkins 配置 GitHub 仓库与 replay 分支](/images/blog10/04-jenkins-source-and-replay-branch.png)

本次实验启用了 Jenkins 的 **Poll SCM**。Jenkins 会按照设定的时间表检查代码仓库是否出现新的提交；检测到目标分支发生变化后，才会触发后续的构建与部署。

图中的 `H/5 * * * *` 是 Jenkins 使用的定时表达式，表示大约每 5 分钟检查一次。实际使用时，可以根据项目的更新频率和服务器负载修改该表达式，自定义检查周期。

![Jenkins 使用 Poll SCM 定期检查仓库](/images/blog10/05-jenkins-poll-scm-trigger.png)

> **补充：** Poll SCM 会定期询问仓库是否出现新提交，没有变化时不会无意义地重复部署。Webhook 则由 GitHub 在提交发生后主动通知 Jenkins，两者触发方向不同。

## 第九步：使用专用账号完成 SSH 发布

自动化部署没有直接使用 `root`，而是在 Linux 中创建专用部署账号，只允许它写入指定网页目录。

Windows 端为 Jenkins 创建独立 SSH 密钥对：私钥保存在 Jenkins 所在主机，公钥加入 Linux 部署账号。配置前先测试该账号能否登录，以及是否有权写入目标目录。

Jenkins 中的 Publish Over SSH 任务配置如下：

![Jenkins 的 Publish Over SSH 文件与远程命令配置](/images/blog10/07-publish-over-ssh-job-config.png)

Jenkins 建立 SSH 会话后，通过 SFTP 上传网页，再执行权限检查等远程命令。

> **补充：SSH 与 SFTP**  SSH 用于加密登录和远程执行命令；SFTP 运行在 SSH 连接之上，用于安全传输文件。日志中的 `SSH: Connected` 只能证明登录成功，不能单独证明文件已经写入目标目录。

最终构建依次完成：

```text
拉取 GitHub 提交
检出 replay 分支
建立 SSH 会话
打开 SFTP 通道
上传 index.html 与 styles.css
执行远程检查命令
返回 Finished: SUCCESS
```

服务器内部使用 `curl` 得到新版内容后，再通过 SSH 隧道从 Windows 浏览器访问最终页面：

![通过 Jenkins 发布并由 Nginx 返回的测试页面](/images/blog10/08-final-deployed-page.png)


# 故障回看：踩坑血泪史

> “满纸荒唐言，一把辛酸泪，都云作者痴，谁解其中味？”

## SSH 主机密钥发生变化

重新连接服务器时，MobaXterm 曾提示：

```text
Remote server identification has changed
```

这表示服务器提供的 SSH 主机密钥与本地历史记录不同。它可能由服务器重装、实例更换或密钥更新引起，也可能意味着连接对象并非原服务器。

因此不应未经核对直接接受，而应先确认服务器身份和新密钥指纹。安全软件偶尔确实会“狼来了”，但主机密钥变化属于值得先看一眼狼在哪的那种。

## Jenkins 与当前用户不是同一个环境

个人终端可以访问 GitHub，但 Jenkins 拉取仓库时仍然出现连接重置。

原因是 Jenkins 作为 Windows 系统服务运行，使用的不是当前登录用户。两者可能拥有不同的用户目录、环境变量、Git 配置、代理配置和文件权限。

所以“我的 Git 能访问 GitHub”只能证明当前用户环境正常，不能直接证明 Jenkins 服务环境正常。最终为 Jenkins 所属服务账号配置代理后，仓库拉取恢复。

## Publish Over SSH 插件版本不兼容

配置 Publish Over SSH 时，测试连接页面出现内部错误。查看 Jenkins 日志后发现：

```text
NoSuchMethodError
```

异常指向插件接口不兼容，而不是 SSH 密钥或服务器网络。更换兼容版本并重启 Jenkins 后恢复正常。

![Publish Over SSH 插件版本调整](/images/blog10/06-publish-over-ssh-plugin-version.png)

这次故障说明：错误页面通常只负责告诉用户“出事了”，真正解释怎么出的事，还得去日志里找。

## SSH 已连接但文件上传失败

日志出现 `SSH: Connected`，只能证明网络、22 端口、账号与密钥认证基本正常。

如果随后出现 `Permission denied`，应检查服务器目标目录：

```bash
ls -ld /var/www/lab-web
```

此时继续修改 SSH 密钥没有意义，问题已经从“能否登录”推进到了“登录后能否写文件”。

## 服务器返回新版，本机却拒绝连接

服务器执行 `curl` 已经返回 `200 OK` 与新版内容，但 Windows 浏览器访问 `127.0.0.1:8081` 仍显示拒绝连接。

原因是两个 `127.0.0.1` 分别属于两台机器：

```text
服务器的 127.0.0.1 → 服务器自己
Windows 的 127.0.0.1 → Windows 自己
```

实验网页没有直接开放公网，因此需要建立 SSH 本地端口转发：

```text
Windows 127.0.0.1:8081
→ SSH 加密隧道
→ 服务器 127.0.0.1:8081
→ Nginx
```

启动隧道后，Windows 本地端口开始监听，浏览器才成功显示页面。

## 最终排查顺序

经过几轮复现，可以把自动发布链路整理为以下检查顺序：

```text
1. GitHub 是否存在目标提交
2. Jenkins 是否拉取正确分支和提交编号
3. SSH 是否成功建立会话
4. SFTP 是否完成文件传输
5. 服务器目标目录是否存在新版文件
6. Nginx 是否指向正确目录
7. 服务器内部 curl 是否返回新版内容
8. 本地 SSH 隧道是否监听
9. 浏览器是否显示最终页面
```

不同现象也能帮助缩小范围：

| 现象                   | 优先检查                  |
| -------------------- | --------------------- |
| Jenkins 无法拉取仓库       | 网络、代理、DNS、仓库地址        |
| SSH 无法连接             | 网络、22 端口、密钥和账号        |
| SSH 已连接但上传失败         | 目录所有者和写入权限            |
| 返回 `404`             | URL、Nginx 配置和网页文件     |
| 服务器 `curl` 成功，本机拒绝连接 | SSH 隧道和本地监听           |
| 返回旧页面                | 提交版本、部署目录、Nginx 指向或缓存 |
| 公网访问超时               | 云安全组、UFW 和网络路由        |

这套方法的核心不是背下所有报错，而是先问：

```text
请求已经走到了哪一层？
哪一段已经有成功证据？
下一段还依赖哪些条件？
```

# 尾声

> 哎呀懒得编题记了，但是空着不合格式，那就写这些吧。

这次实践还有一点让我感受颇深，就是部署与安全其实没有清晰的分界线。

数据库的只读账号、Jenkins 的专用部署用户、SSH 密钥、UFW 规则和仅监听本机的 Nginx，看起来属于不同工具，背后却都在回答同一个问题：

```
谁可以通过什么路径，访问哪些资源，又能执行哪些操作？
```

这也是最小权限、防火墙和身份认证真正落到系统中的样子。

以前打 CTF 时，我更关心怎样获得 Shell；这次则第一次从维护者的方向思考：即使有人获得某个账号，系统应当如何限制他接下来还能做什么。

当然，目前的理解仍然很基础。但至少以后再见到 `404`、`Permission denied` 或 `Connection refused`，它们不再只是三种不同写法的“寄”，而是指向三段不同链路的线索。

先记录到这里叭，我也该下班了hh。

# 特别鸣谢

> 与君相逢，实属荣幸

## 学业班主任与企业导师

感谢学业班主任积极与企业沟通，为我们争取并协调本次实习机会，让我得以提前进入真实的工作环境，看看课堂之外的任务究竟怎样开展。

同样感谢企业导师在实习期间的指导与任务安排。从 Linux、数据库和网络基础，到后续的 Jenkins 自动部署，任务难度一路平稳上升，导师身为企业的网络大神，竟能抽出时间不吝赐教，本人非常感激。

出于隐私考虑，本文不记录导师姓名与企业信息，但感谢不会因此自动脱敏。

## 同行伙伴

感谢一同实习的伙伴们。大家共享环境、交流报错，也让我第一次意识到真实服务器不是个人靶机：动手前要先看一眼，陌生进程更不能随手扬了，不然同事的劳动成果将如奶油一般化开......

## Codex

，算是实习期间的全天候技术陪练兼情绪价值提供者。途中虽然会拿P的终端图糊弄我，好在最终还是陪我跑通了整条部署链路。

以后智械危机我第二个投降 GPT。
*（为什么不是第一个？详见 [Hello World | 博客创建与迭代记录](https://c01in.com/posts/5501a000/) 结尾。）*
