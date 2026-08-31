from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = Image.open(root / "build" / "icon.png").convert("RGBA")
res = root / "android" / "app" / "src" / "main" / "res"
if not res.exists():
    raise SystemExit(0)

sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for density, size in sizes.items():
    directory = res / f"mipmap-{density}"
    icon = source.copy()
    icon.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (7, 7, 10, 255))
    canvas.alpha_composite(icon, ((size - icon.width) // 2, (size - icon.height) // 2))
    for name in ("ic_launcher.png", "ic_launcher_round.png"):
        canvas.convert("RGB").save(directory / name, optimize=True)
    foreground_size = int(size * 2.25)
    foreground = Image.new("RGBA", (foreground_size, foreground_size), (0, 0, 0, 0))
    fg_icon = source.copy()
    fg_icon.thumbnail((int(foreground_size * 0.66), int(foreground_size * 0.66)), Image.Resampling.LANCZOS)
    foreground.alpha_composite(fg_icon, ((foreground_size - fg_icon.width) // 2, (foreground_size - fg_icon.height) // 2))
    foreground.save(directory / "ic_launcher_foreground.png", optimize=True)

for splash_path in res.glob("drawable*/splash.png"):
    existing = Image.open(splash_path)
    width, height = existing.size
    splash = Image.new("RGB", (width, height), "#07070a")
    logo = source.copy()
    limit = int(min(width, height) * 0.36)
    logo.thumbnail((limit, limit), Image.Resampling.LANCZOS)
    splash.paste(logo, ((width - logo.width) // 2, (height - logo.height) // 2), logo)
    splash.save(splash_path, optimize=True)
