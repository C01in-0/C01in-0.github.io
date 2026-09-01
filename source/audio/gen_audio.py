import math
import wave
import random
import struct

sr = 44100

def save_wav(filename, samples):
    with wave.open(filename, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sr)
        # 加入物理过载失真 (Hard Clipping)
        clamped = [max(-1.0, min(1.0, s)) for s in samples]
        byte_data = b''.join(struct.pack("<h", int(s * 32767)) for s in clamped)
        f.writeframesraw(byte_data)

print("[+] 正在合成低频骇入嗡嗡声...")
glitch = []
for i in range(int(sr * 1.0)):
    t = i / sr
    # 核心：使用 FM 调频合成极度压抑的 50Hz 机械嗡嗡声
    modulator = math.sin(2 * math.pi * 5 * t)
    drone = math.sin(2 * math.pi * (50 + 10 * modulator) * t) * 0.8
    # 偶尔刺入撕裂的底噪
    static = random.uniform(-1, 1) * 1.5 if random.random() < 0.05 else 0
    vol = 1.0 if random.random() > 0.08 else 0.0
    glitch.append((drone + static) * vol)
save_wav("prts-glitch.wav", glitch)

print("[+] 正在合成物理级重低音轰鸣...")
boom = []
for i in range(int(sr * 5.0)):
    t = i / sr
    # 次声波坠落：从 150Hz 极速砸向 20Hz
    freq = 20 + 130 * math.exp(-t * 8.0)
    sub = math.sin(2 * math.pi * freq * t)
    # 模拟物理硬件过载的饱和失真
    sub = math.tanh(sub * 3.0) * 0.6
    # 撞击瞬间的空气撕裂音
    impact = random.uniform(-1, 1) * math.exp(-t * 20.0)
    # 幽闭的深渊回声 (40Hz 恒定轰鸣)
    rumble = math.sin(2 * math.pi * 40 * t) * math.exp(-t * 0.5) * 0.4
    master_env = math.exp(-t * 0.7)
    boom.append((sub + impact + rumble) * master_env)
save_wav("prts-boom.wav", boom)

print("[*] 合成完毕，请将两个 wav 文件替换到 /source/audio/ 目录下。")