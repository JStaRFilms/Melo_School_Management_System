"""Live integration test: Admin exam recording settings page."""
from playwright.sync_api import sync_playwright
import sys
import time

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()

        console_msgs = []
        page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))

        # 1. Navigate to admin sign-in
        print("1. Navigating to admin sign-in page...")
        page.goto("http://localhost:3002/sign-in", wait_until="networkidle")
        # Wait for React to hydrate and render
        page.wait_for_selector('input[id="email"]', state="visible", timeout=30000)
        page.screenshot(path="scripts/screenshots/admin_signin.png")
        print(f"   Sign-in page loaded OK")

        # 2. Fill in credentials and submit
        print("2. Signing in as admin...")
        page.fill('input[id="email"]', "admin@demo-academy.school")
        page.fill('input[id="password"]', "Admin123!Pass")
        page.click('button[type="submit"]')

        # Wait for redirect away from sign-in
        page.wait_for_url("**/assessments/**", timeout=30000)
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        page.screenshot(path="scripts/screenshots/admin_after_login.png")
        print(f"   Redirected to: {page.url}")

        # 3. Navigate to exam recording settings
        print("3. Navigating to exam recording settings...")
        page.goto("http://localhost:3002/assessments/setup/exam-recording", wait_until="networkidle")
        time.sleep(3)
        page.screenshot(path="scripts/screenshots/admin_exam_settings.png")

        content = page.content()
        has_exam_protocol = "Exam Protocol" in content
        is_mock_mode = "Preview mode" in content
        has_save = page.locator('button:has-text("Save")').count() > 0

        print(f"   Has 'Exam Protocol': {has_exam_protocol}")
        print(f"   Is mock mode: {is_mock_mode}")
        print(f"   Has save button: {has_save}")

        # 4. Test mode toggle and save
        print("4. Testing mode toggle...")
        raw60_option = page.locator('text=/60').first
        if raw60_option.is_visible():
            raw60_option.click()
            time.sleep(1)
            print("   Mode toggled")

            save_btn = page.locator('button:has-text("Save")')
            if save_btn.count() > 0:
                save_btn.first.click()
                time.sleep(2)
                page.screenshot(path="scripts/screenshots/admin_exam_saved.png")
                print("   Save clicked OK")

        browser.close()

        print("\n=== VERDICT ===")
        if is_mock_mode:
            print("FAIL: Page is in MOCK mode")
            return 1
        elif has_exam_protocol and has_save:
            print("PASS: Admin settings page works with live data")
            return 0
        else:
            print("PARTIAL: Some elements missing")
            return 1

if __name__ == "__main__":
    import os
    os.makedirs("scripts/screenshots", exist_ok=True)
    sys.exit(main())
