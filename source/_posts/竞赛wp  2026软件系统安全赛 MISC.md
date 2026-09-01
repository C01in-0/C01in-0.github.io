---
title: 竞赛WP | 026软件系统安全赛初赛 MISC
categories:
  - 竞赛
tags:
  - Misc
  - 隐写
  - PNG
  - ZIP
  - CRC32
  - 零宽字符
abbrlink: fd2c60d3
date: 2026-03-15 22:00:00
---

## 题目信息

- 比赛：2026软件系统安全赛初赛
- 类型：Misc - 图片隐写
- 附件：无后缀文件
- 题目名：steganography

## 解题过程

### 1. 文件修复

下载附件得到一个无后缀文件，使用 010 Editor 打开，发现文件头部有干扰字符，删除后得到一张正常的 PNG 图片（不是你没加载上来，这图就长这样）。

![010editor删除干扰字符](/images/step1.png)

### 2. LSB隐写分析

使用 Kali 的 zsteg 功能扫描，发现文件里藏了一个名为"flag.zip"的压缩包。
![zsteg扫描结果](/images/step2.png)
并且在第 118 行之后会报错，说明它身高造假，在 010 Editor 中对其进行修复（把第二个 00 00 04 00 改为 00 00 00 76）

![修改PNG高度](/images/step3.png)

### 3. 提取隐藏数据
使用指令提取压缩包：
```bash
zsteg -E "b1,rgb,lsb,xy" 2.png > flag.zip
```
对压缩包进行剥离，发现里面还嵌套了六个小压缩包。
![压缩包结构](/images/step4.png)
"inner.zip"压缩包是需要密码的，毋庸置疑，密码应该分布在六个"pass*.zip"中。

### 4. 分析压缩包结构并爆破
  查看 6 个 pass*.zip 的内容：
  zsteg -E "b1,rgb,lsb,xy" 2.png > flag.zip

发现 6 个 pass*.zip 中的 txt 文件都是四字节，利用 ZIP 压缩包会明文暴露文件大小和 CRC32 校验值的特性，编写 Python 脚本挨个爆破它们：
```python
import binascii
import itertools
import string
import sys

crc_dict = {
    'ce70d424': 'pass1',
    'f90c8a70': 'pass2',
    'ff3fe4bb': 'pass3',
    '242a5387': 'pass4',
    '9a27098e': 'pass5',
    'd3f6df9f': 'pass6'
}

targets = {int(k, 16): v for k, v in crc_dict.items()}
chars = " ".join(chr(i) for i in range(32,127))
results = {}

print("开始爆破")

for p in itertools.product(chars, repeat=4):
    s = "".join(p)
    crc = binascii.crc32(s.encode()) & 0xffffffff
    if crc in targets:
        name = targets[crc]
        results[name] = s
        print(f"[*] {name} 破解成功: {s}")
        del targets[crc]
        if not targets:
            break

print("\n === 结果 ===")
if len(results) == 6:
    pwd = "".join([results[f'pass{i}'] for i in range(1, 7)])
    print(f"inner.zip 的最终密码是: {pwd}")
else:
    print("莫得结果")
```

依次拼合六个密码，得到：
flag is c1!xxtLf%fXYPkaA
用它打开"inner.zip"得到"flag.txt"，发现只有孤零零一行。
![零宽字符隐写](/images/step5.png)

### 5.零宽字符解码
还在套娃？不过很显然是零宽字符隐写，解码得到 flag：
dart{bf4100d9-cc8d-48f6-a095-54cbfad189e1}