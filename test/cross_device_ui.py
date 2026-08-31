import os
import time
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("KITSUNE_TEST_URL", "http://127.0.0.1:8080/app/")
stamp = str(int(time.time() * 1000))[-8:]
pc_name = f"Pc{stamp}"
mobile_name = f"Mobile{stamp}"
password = "Password123"
message = f"cross-device-{stamp}"


def register(page, name):
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    page.locator("#tabRegister").click()
    page.locator("#authUser").fill(name)
    page.locator("#authPass").fill(password)
    page.locator("#authPass2").fill(password)
    page.locator("#authSubmit").click()
    page.locator("#app:not(.hidden)").wait_for(timeout=15000)
    page.locator(".member-item").first.wait_for(state="attached", timeout=15000)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--allow-http-screen-capture"])
    pc_context = browser.new_context(viewport={"width": 1440, "height": 900})
    mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
    media_mock = """
      Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { value: async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1280; canvas.height = 720;
        const context = canvas.getContext('2d');
        let frame = 0;
        setInterval(() => { context.fillStyle = frame++ % 2 ? '#ff5fa2' : '#07070a'; context.fillRect(0, 0, canvas.width, canvas.height); }, 16);
        return canvas.captureStream(60);
      }});
    """
    pc_context.add_init_script(media_mock)
    mobile_context.add_init_script(media_mock)
    pc = pc_context.new_page()
    mobile = mobile_context.new_page()

    register(pc, pc_name)
    register(mobile, mobile_name)

    pc.locator(f"#memberList .member-name:has-text('{mobile_name}')").wait_for(state="visible", timeout=15000)
    mobile.locator("#mobileMemberBtn").click()
    mobile.locator(f"#memberList .member-name:has-text('{pc_name}')").wait_for(state="visible", timeout=15000)

    # Verify the toggable online panel shows all online users on mobile
    mobile.evaluate("document.getElementById('body').classList.remove('mobile-sidebar','mobile-members'); document.getElementById('mobileOverlay').classList.remove('show');")
    mobile.locator("#mobileOnlineBtn").click()
    mobile.locator("#onlinePanel.open").wait_for(timeout=10000)
    mobile.locator(f"#onlinePanelBody .member-name:has-text('{pc_name}')").wait_for(state="visible", timeout=10000)
    mobile.locator(f"#onlinePanelBody .member-item", has_text=pc_name).click()
    mobile.locator("#profileModal:not(.hidden)").wait_for(timeout=10000)
    mobile.keyboard.press("Escape")
    mobile.evaluate("document.getElementById('onlinePanel').classList.remove('open'); document.getElementById('mobileOverlay').classList.remove('show');")
    mobile.locator("#onlinePanel:not(.open)").wait_for(state="attached", timeout=10000)

    pc.locator("#memberList .member-item", has_text=mobile_name).click()
    pc.locator("#profileAddFriend").click()
    pc.locator(".profile-actions", has_text="Request Sent").wait_for(timeout=15000)

    mobile.locator("#mobileMemberBtn").click()
    mobile.locator("#memberList .member-item", has_text=pc_name).click()
    mobile.locator("#profileAcceptFriend").wait_for(timeout=15000)
    mobile.locator("#profileAcceptFriend").click()
    mobile.locator("#profileDm").wait_for(timeout=15000)
    pc.keyboard.press("Escape")
    mobile.keyboard.press("Escape")

    pc.locator("#msgInput").fill(message)
    pc.locator("#sendBtn").click()
    mobile.locator(f".msg-content:has-text('{message}')").wait_for(state="attached", timeout=15000)

    pc.locator("#memberList .member-item", has_text=mobile_name).click()
    pc.locator("#profileDm").wait_for(timeout=15000)
    pc.locator("#profileDm").click()
    pc.locator("#dmPhone").wait_for(timeout=15000)
    pc.locator("#dmPhone").click()
    mobile.locator("#acceptIncoming").wait_for(timeout=15000)
    mobile.locator("#acceptIncoming").click()
    pc.locator("#callScreen").click()
    pc.locator("#screenTile .tile-fullscreen").wait_for(timeout=15000)
    mobile.locator(".call-tile.screen[data-peer] .tile-fullscreen").wait_for(timeout=20000)
    mobile.locator(".call-tile.screen[data-peer] .tile-fullscreen").click()
    mobile.locator(".call-tile:fullscreen").wait_for(timeout=10000)
    mobile.locator(".call-tile:fullscreen .tile-fullscreen").click()
    mobile.locator(".call-tile:fullscreen").wait_for(state="detached", timeout=10000)
    mobile.locator("#callScreen").click()
    mobile.locator("#screenTile .tile-fullscreen").wait_for(timeout=15000)
    pc.locator(".call-tile.screen[data-peer] .tile-fullscreen").wait_for(timeout=20000)
    pc.locator(".call-tile.screen[data-peer] .tile-fullscreen").click()
    pc.locator(".call-tile:fullscreen").wait_for(timeout=10000)
    pc.locator(".call-tile:fullscreen .tile-fullscreen").click()
    pc.locator(".call-tile:fullscreen").wait_for(state="detached", timeout=10000)

    print(f"PASS: {pc_name} and {mobile_name} are visible to each other")
    print("PASS: mobile online panel lists all online users and opens profiles")
    print("PASS: profile friend request was sent and accepted")
    print(f"PASS: mobile received message {message}")
    print("PASS: desktop and mobile screen streams expose fullscreen controls")
    browser.close()
