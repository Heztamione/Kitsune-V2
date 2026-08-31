from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:8099/", wait_until="networkidle")
    assert page.get_by_role("heading", name="Your den, on every device.").is_visible()
    assert page.locator('a[href="/downloads/windows"]').count() == 1
    assert page.locator('a[href="/downloads/android"]').count() == 1
    assert page.locator('a[href="/app/"]').count() >= 1
    assert page.locator(".download-grid").evaluate("el => getComputedStyle(el).gridTemplateColumns").count("px") == 1
    page.screenshot(path=str(root / "test" / "download-ui-mobile.png"), full_page=True)
    page.goto("http://127.0.0.1:8099/app/", wait_until="networkidle")
    assert page.locator('link[rel="manifest"][href="manifest.webmanifest"]').count() == 1
    assert not errors, errors
    browser.close()
