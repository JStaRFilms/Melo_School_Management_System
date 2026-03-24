from pathlib import Path
import json
import time

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


SCREENSHOT_DIR = Path("scripts/screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


def save_shot(page, name: str) -> None:
    page.screenshot(path=str(SCREENSHOT_DIR / name), full_page=True)


def wait_for_idle(page) -> None:
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_load_state("networkidle")


def wait_for_selected_mode(page) -> str:
    direct = page.locator("label", has_text="Direct /40 Entry").first
    scaled = page.locator("label", has_text="Scaled /60 Entry").first

    for _ in range(20):
        direct_class = direct.get_attribute("class") or ""
        scaled_class = scaled.get_attribute("class") or ""
        if "border-blue-600" in direct_class:
            return "raw40"
        if "border-blue-600" in scaled_class:
            return "raw60_scaled_to_40"
        page.wait_for_timeout(250)

    raise AssertionError("Could not determine the selected exam mode.")


def click_mode_card(page, card_text: str) -> None:
    button = page.get_by_role("button", name="Commit Settings")
    page.locator("label", has_text=card_text).first.click()

    for _ in range(20):
        if not button.is_disabled():
            return
        page.wait_for_timeout(250)

    raise AssertionError(f"Changing exam mode to '{card_text}' did not enable save.")


def sign_in(page, base_url: str, email: str, password: str, expected_path: str) -> None:
    page.goto(f"{base_url}/sign-in", wait_until="networkidle")
    page.fill("#email", email)
    page.fill("#password", password)
    page.click('button[type="submit"]')
    page.wait_for_url(f"**{expected_path}*", timeout=60000)
    wait_for_idle(page)


def select_option_by_label(page, label_text: str, option_label: str) -> None:
    container = page.locator("label", has_text=label_text).first.locator("xpath=..")
    select = container.locator("select")
    select.select_option(label=option_label)
    page.wait_for_timeout(500)


def cycle_mode_and_restore(page) -> dict:
    page.goto("http://localhost:3002/assessments/setup/exam-recording", wait_until="networkidle")
    page.locator("h1", has_text="Exam Protocol").wait_for(timeout=30000)
    content = page.content()
    if "Preview mode is active" in content:
        raise AssertionError("Admin settings page is still in preview mode.")

    original_mode = wait_for_selected_mode(page)
    target_text = "Scaled /60 Entry" if original_mode == "raw40" else "Direct /40 Entry"
    restore_text = "Direct /40 Entry" if original_mode == "raw40" else "Scaled /60 Entry"

    click_mode_card(page, target_text)
    page.get_by_role("button", name="Commit Settings").click()
    page.locator("text=Settings updated").wait_for(timeout=30000)
    save_shot(page, "t14_admin_settings_saved.png")

    click_mode_card(page, restore_text)
    page.get_by_role("button", name="Commit Settings").click()
    page.locator("text=Settings updated").wait_for(timeout=30000)

    return {"original_mode": original_mode}


def update_first_band_and_restore(page) -> dict:
    page.goto("http://localhost:3002/assessments/setup/grading-bands", wait_until="networkidle")
    page.locator("h1", has_text="Grading Bands").wait_for(timeout=30000)
    content = page.content()
    if "Preview mode is active" in content:
        raise AssertionError("Admin grading-bands page is still in preview mode.")

    first_remark = page.locator("tbody tr").first.locator('input[type="text"]').first
    original_value = first_remark.input_value()
    updated_value = f"{original_value} Verified"
    if original_value.endswith(" Verified"):
        updated_value = original_value.replace(" Verified", "")

    first_remark.fill(updated_value)
    page.get_by_role("button", name="Commit Global Policy").click()
    page.locator("text=Grading bands updated").wait_for(timeout=30000)
    save_shot(page, "t14_admin_bands_saved.png")

    first_remark.fill(original_value)
    page.get_by_role("button", name="Commit Global Policy").click()
    page.locator("text=Grading bands updated").wait_for(timeout=30000)

    return {"band_remark": original_value}


def load_admin_sheet(page) -> None:
    page.goto("http://localhost:3002/assessments/results/entry", wait_until="networkidle")
    page.locator("text=Select a session, term, class, and subject to begin.").wait_for(timeout=30000)
    select_option_by_label(page, "Session", "2025/2026")
    select_option_by_label(page, "Term", "First Term")
    select_option_by_label(page, "Class", "JSS 1A")
    select_option_by_label(page, "Subject", "Mathematics")
    page.locator("tr", has_text="Alice Johnson").first.wait_for(timeout=30000)
    content = page.content()
    if "Preview mode is active" in content:
        raise AssertionError("Admin score-entry page is still in preview mode.")


def load_teacher_sheet(page) -> None:
    page.goto("http://localhost:3001/assessments/exams/entry", wait_until="networkidle")
    page.locator("text=No Students Selected").wait_for(timeout=30000)
    select_option_by_label(page, "Session", "2025/2026")
    select_option_by_label(page, "Term", "First Term")
    select_option_by_label(page, "Class", "JSS 1A")
    select_option_by_label(page, "Subject", "Mathematics")
    page.locator("tr", has_text="Alice Johnson").first.wait_for(timeout=30000)
    content = page.content()
    if "Preview mode is active" in content:
        raise AssertionError("Teacher score-entry page is still in preview mode.")


def change_exam_score_and_restore(page, student_name: str, save_button_label: str, success_text: str) -> dict:
    row = page.locator("tr", has_text=student_name).first
    exam_input = row.locator('input[type="number"]:visible').nth(3)
    original_value = exam_input.input_value()
    original_number = int(original_value)
    next_value = original_number + 1 if original_number < 39 else original_number - 1

    exam_input.fill(str(next_value))
    page.get_by_role("button", name=save_button_label).click()
    page.locator(f"text={success_text}").wait_for(timeout=30000)
    save_shot(page, f"{student_name.replace(' ', '_').lower()}_{save_button_label.replace(' ', '_').lower()}.png")

    row = page.locator("tr", has_text=student_name).first
    exam_input = row.locator('input[type="number"]:visible').nth(3)
    exam_input.fill(str(original_number))
    page.get_by_role("button", name=save_button_label).click()
    page.locator(f"text={success_text}").wait_for(timeout=30000)

    return {"student": student_name, "original_exam_raw": original_number}


def main() -> int:
    report = {
        "admin": {},
        "teacher": {},
        "consoleErrors": [],
        "pageErrors": [],
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        admin_context = browser.new_context(viewport={"width": 1440, "height": 1000})
        teacher_context = browser.new_context(viewport={"width": 1440, "height": 1000})
        admin_page = admin_context.new_page()
        teacher_page = teacher_context.new_page()

        for page in (admin_page, teacher_page):
            page.on("console", lambda msg: report["consoleErrors"].append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
            page.on("pageerror", lambda err: report["pageErrors"].append(str(err)))

        try:
            sign_in(
                admin_page,
                "http://localhost:3002",
                "admin@demo-academy.school",
                "Admin123!Pass",
                "/assessments/setup/exam-recording",
            )
            save_shot(admin_page, "t14_admin_after_signin.png")
            report["admin"]["settings"] = cycle_mode_and_restore(admin_page)
            report["admin"]["gradingBands"] = update_first_band_and_restore(admin_page)
            load_admin_sheet(admin_page)
            report["admin"]["scoreEntry"] = change_exam_score_and_restore(
                admin_page,
                "Alice Johnson",
                "Commit Batch",
                "Changes Synced Successfully",
            )

            sign_in(
                teacher_page,
                "http://localhost:3001",
                "teacher@demo-academy.school",
                "Teacher123!Pass",
                "/assessments/exams/entry",
            )
            save_shot(teacher_page, "t14_teacher_after_signin.png")
            load_teacher_sheet(teacher_page)
            report["teacher"]["scoreEntry"] = change_exam_score_and_restore(
                teacher_page,
                "Bob Smith",
                "Finalize Sheet",
                "Changes Synced Successfully",
            )
        except PlaywrightTimeoutError as exc:
            save_shot(admin_page, "t14_timeout_admin.png")
            save_shot(teacher_page, "t14_timeout_teacher.png")
            report["failure"] = f"Timeout: {exc}"
            print(json.dumps(report, indent=2))
            return 1
        except Exception as exc:
            save_shot(admin_page, "t14_failure_admin.png")
            save_shot(teacher_page, "t14_failure_teacher.png")
            report["failure"] = str(exc)
            print(json.dumps(report, indent=2))
            return 1
        finally:
            admin_context.close()
            teacher_context.close()
            browser.close()

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
