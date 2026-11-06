"""index.html のタイムラインを1コマずつ撮影して PNG 連番にする。

使い方:
  python3 capture.py stills 2 6 12 ...   # 指定秒のコマだけ撮る（確認用）
  python3 capture.py frames              # 全コマを frames/ に書き出す（30fps）
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
FPS = 30
CHROME = str(Path.home() / "Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")


def main():
    mode = sys.argv[1]
    out = HERE / ("stills" if mode == "stills" else "frames")
    out.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME)
        page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page.goto((HERE / "index.html").as_uri() + "?capture=1")
        page.evaluate("document.fonts.ready")
        if mode == "stills":
            for s in sys.argv[2:]:
                page.evaluate(f"window.__render({float(s)})")
                page.screenshot(path=str(out / f"t{float(s):05.1f}.png"))
        else:
            total = int(page.evaluate("window.__duration") * FPS)
            for i in range(total):
                page.evaluate(f"window.__render({i / FPS})")
                page.screenshot(path=str(out / f"{i:05d}.png"))
                if i % 150 == 0:
                    print(f"{i}/{total}", flush=True)
        browser.close()


if __name__ == "__main__":
    main()
