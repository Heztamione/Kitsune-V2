from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = Image.open(root / "build" / "icon.png").convert("RGBA")
for size in (192, 512):
    image = source.copy()
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (7, 7, 10, 255))
    canvas.alpha_composite(image, ((size - image.width) // 2, (size - image.height) // 2))
    canvas.convert("RGB").save(root / "src" / "renderer" / "assets" / f"kitsune-logo-{size}.png", optimize=True)
