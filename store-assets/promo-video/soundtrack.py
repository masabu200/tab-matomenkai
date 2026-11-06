"""紹介動画のBGMと効果音を合成して soundtrack.wav に書き出す（外部素材なし・権利の心配なし）。

0〜10.4秒：悩みのパート（短調の薄いパッド＋タブが増える音）
10.6秒〜：ロゴ登場から明るい長調の進行へ。クリックや場面転換に効果音を重ねる。
"""
from pathlib import Path
import wave
import numpy as np

SR = 44100
DUR = 40.0
N = int(SR * DUR)
out = np.zeros((N, 2))


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


def add(sig, t, pan=0.0):
    i = int(t * SR)
    j = min(N, i + len(sig))
    if j <= i:
        return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[i:j, 0] += sig[: j - i] * l
    out[i:j, 1] += sig[: j - i] * r


def pad(notes, t, d, vol):
    n = int(d * SR)
    x = np.arange(n) / SR
    s = np.zeros(n)
    for m in notes:
        for det in (-0.08, 0.0, 0.08):
            f = hz(m + det)
            s += np.sin(2 * np.pi * f * x) + 0.25 * np.sin(4 * np.pi * f * x)
    s *= env(n, min(1.2, d / 3), min(1.4, d / 3)) * vol / (len(notes) * 3)
    add(s, t)


def pluck(m, t, vol, pan=0.0, d=0.9):
    n = int(d * SR)
    x = np.arange(n) / SR
    f = hz(m)
    s = (np.sin(2 * np.pi * f * x) + 0.35 * np.sin(4 * np.pi * f * x) + 0.12 * np.sin(6 * np.pi * f * x)) * np.exp(-x * 5.5)
    s *= env(n, 0.004, 0.05) * vol
    add(s, t, pan)


def click(t, vol=0.35):
    n = int(0.06 * SR)
    x = np.arange(n) / SR
    s = np.sin(2 * np.pi * 1800 * x) * np.exp(-x * 90) + np.random.randn(n) * np.exp(-x * 160) * 0.3
    add(s * vol, t)


def whoosh(t, d=0.7, vol=0.18, rise=True):
    n = int(d * SR)
    noise = np.random.randn(n)
    k = np.linspace(0, 1, n)
    shape = np.sin(np.pi * (k if rise else 1 - k) ** 0.8) ** 2
    # 簡易ローパス：移動平均の幅を時間で変える代わりに2段で近似
    sm = np.convolve(noise, np.ones(24) / 24, mode="same")
    add(sm * shape * vol * 3, t)


np.random.seed(7)

# --- 悩みパート ---
pad([57, 60, 64], 0.0, 5.4, 0.16)       # Am
pad([53, 57, 60, 64], 5.2, 5.6, 0.16)   # Fmaj7
for i in range(26):                     # タブが増えるたびのポツポツ音
    tt = 0.45 + 3.3 * (i / 26) ** 0.8
    pluck(76 + (i % 3) * 2, tt, 0.05, pan=-0.6 + 1.2 * (i / 26), d=0.25)
for tt in (4.7, 6.5, 8.2):              # 吹き出し
    pluck(69, tt, 0.12, d=0.6)
    pluck(72, tt + 0.07, 0.08, d=0.6)
whoosh(9.7, 0.9, rise=True)

# --- ロゴ ---
for i, m in enumerate([60, 64, 67, 72, 76]):
    pluck(m, 10.6 + i * 0.13, 0.16, pan=-0.4 + i * 0.2, d=1.6)
pad([48, 60, 64, 67, 71], 10.5, 4.3, 0.2)

# --- 明るい進行 C G Am F（90bpm 相当） ---
prog = [[48, 55, 64, 67], [43, 55, 62, 71], [45, 57, 64, 72], [41, 57, 65, 69]]
arp = [[72, 76, 79, 76], [71, 74, 79, 74], [72, 76, 81, 76], [69, 72, 77, 72]]
beat = 60 / 90
t = 14.4
bar = 0
while t < DUR - 1.5:
    ch = prog[bar % 4]
    pad(ch, t, beat * 4 + 0.4, 0.15)
    pluck(ch[0] - 12 + 12, t, 0.10, d=1.2)
    for k in range(8):
        pluck(arp[bar % 4][k % 4], t + k * beat / 2, 0.055 if k % 2 else 0.075, pan=(-0.35 if k % 2 else 0.35), d=0.5)
    t += beat * 4
    bar += 1
pad([48, 55, 64, 67, 72], 37.5, 2.5, 0.2)   # 締め

# --- 効果音 ---
for tt in (15.95, 22.7, 25.0, 30.75):
    click(tt)
for i in range(18):                     # タブがスペースへ飛ぶ
    pluck(84 + (i % 3) * 3, 16.15 + i * 0.1 + 0.6, 0.035, pan=0.5, d=0.2)
pluck(79, 18.95, 0.12, d=1.0); pluck(84, 19.05, 0.1, d=1.2)   # 保存完了
for tt in (20.5, 27.1, 32.3, 35.6):
    whoosh(tt, 0.6, 0.12)

# マスター：フェードアウトと正規化
out[-int(1.5 * SR):] *= np.linspace(1, 0, int(1.5 * SR))[:, None] ** 2
out /= np.max(np.abs(out)) / 0.7
pcm = (out * 32767).astype(np.int16)
with wave.open(str(Path(__file__).with_name("soundtrack.wav")), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok")
