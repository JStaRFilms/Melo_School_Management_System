"""Verify the private homepage in a fresh headless browser, never a personal profile."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import hashlib
import json
import re

from PIL import Image
from playwright.sync_api import expect, sync_playwright

SITE = Path(__file__).resolve().parent.parent
ROOT = SITE.parents[2]
OUTPUT = ROOT / "deliverables/obhis-homepage-review"
OUTPUT.mkdir(parents=True, exist_ok=True)
errors = []
http_failures = []
external_requests = []


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def warm_images(page):
    for y in range(0, page.evaluate("document.documentElement.scrollHeight"), 500):
        page.evaluate('(y) => scrollTo({top:y,behavior:"instant"})', y)
        page.wait_for_timeout(35)
    page.wait_for_function("Array.from(document.images).filter(i=>i.getClientRects().length).every(i=>i.complete&&i.naturalWidth>0)")


def document_top(locator):
    return locator.evaluate("e=>e.getBoundingClientRect().top+scrollY")


def no_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth"), "Horizontal overflow"


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(SITE)))
Thread(target=server.serve_forever, daemon=True).start()
origin = f"http://127.0.0.1:{server.server_port}/"
url = origin + "obhis-homepage-review.html"


def observe(page):
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("response", lambda r: http_failures.append([r.status, r.url]) if r.status >= 400 else None)
    page.on("request", lambda r: external_requests.append(r.url) if not r.url.startswith(origin) else None)


try:
    hero_pattern = r'<section class="hero-stage".*?</section>'
    original = (SITE / "obhis-motion-prototype.html").read_text(encoding="utf-8")
    current = (SITE / "obhis-homepage-review.html").read_text(encoding="utf-8")
    assert re.search(hero_pattern, original, re.S).group() == re.search(hero_pattern, current, re.S).group()
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for width in [1440, 1024, 768, 760, 390, 320]:
                context = browser.new_context(viewport={"width": width, "height": 900 if width > 760 else 844}, has_touch=width <= 760)
                page = context.new_page()
                observe(page)
                page.goto(url, wait_until="networkidle")
                warm_images(page)
                no_overflow(page)
                top = document_top(page.locator("#our-school"))
                page.locator('[data-scene-choice="you"]').click()
                expect(page.locator('[data-panel="you"]')).to_have_attribute("aria-hidden", "false")
                expect(page.get_by_role("heading", level=1)).to_have_count(1)
                assert document_top(page.locator("#our-school")) == top
                for index in range(8):
                    scene = "olive" if index % 2 == 0 else "you"
                    page.locator(f'[data-scene-choice="{scene}"]').evaluate("e=>e.click()")
                page.wait_for_timeout(1000)
                assert document_top(page.locator("#our-school")) == top
                no_overflow(page)
                page.locator('[data-scene-choice="olive"]').click()
                page.wait_for_timeout(1000)
                before = document_top(page.locator(".crest-story"))
                page.locator('[data-collection-choice="culture"]').click()
                expect(page.locator(".album-sheet:visible")).to_have_count(2)
                expect(page.locator('[data-collection-choice="culture"]')).to_have_attribute("aria-pressed", "true")
                page.wait_for_timeout(400)
                shift = round(document_top(page.locator(".crest-story")) - before, 2)
                no_overflow(page)
                launcher = page.locator('.album-photo[data-photo="2"]')
                launcher.click()
                expect(page.locator("#photo-viewer")).to_be_visible()
                expect(page.locator("#viewer-position")).to_have_text("3 of 4")
                expect(page.locator("#viewer-close")).to_be_focused()
                next_photo = page.locator("#viewer-next")
                next_photo.tap() if width <= 760 else next_photo.click()
                expect(page.locator("#viewer-position")).to_have_text("4 of 4")
                page.wait_for_function('document.querySelector("#viewer-image").complete&&document.querySelector("#viewer-image").naturalWidth>0')
                bounds = page.evaluate('''()=>{const d=document.querySelector("#photo-viewer").getBoundingClientRect();const f=document.querySelector(".viewer-image").getBoundingClientRect();const i=document.querySelector("#viewer-image").getBoundingClientRect();const b=document.querySelector(".viewer-bottom").getBoundingClientRect();return {dialogFits:d.left>=0&&d.right<=innerWidth&&d.top>=0&&d.bottom<=innerHeight,imageFits:i.bottom<=f.bottom+1&&i.right<=f.right+1,captionClear:b.top>=f.bottom}}''')
                assert all(bounds.values()), bounds
                assert page.locator('.viewer-image').evaluate('e=>Math.abs(e.clientWidth-(e.parentElement.clientWidth-parseFloat(getComputedStyle(e.parentElement).paddingLeft)-parseFloat(getComputedStyle(e.parentElement).paddingRight)))<1')
                for key in ["Tab"] * 8 + ["Shift+Tab"] * 8:
                    page.keyboard.press(key)
                    assert page.evaluate('document.querySelector("#photo-viewer").contains(document.activeElement)')
                page.keyboard.press("ArrowLeft")
                expect(page.locator("#viewer-position")).to_have_text("3 of 4")
                page.keyboard.press("Escape")
                expect(page.locator("#photo-viewer")).not_to_be_visible()
                expect(launcher).to_be_focused()
                assert page.evaluate('getComputedStyle(document.documentElement).overflowY!=="hidden"')
                page.locator('[data-collection-choice="day"]').focus()
                page.keyboard.press("ArrowLeft")
                expect(page.locator('[data-collection-choice="day"]')).to_have_attribute("aria-pressed", "true")
                page.locator("#visit-guide summary").click()
                assert not page.locator("#visit-guide").evaluate("e=>e.open")
                page.locator(".campus-visit").click()
                assert page.locator("#visit-guide").evaluate("e=>e.open")
                page.wait_for_timeout(650)
                assert page.locator("#visit-guide").bounding_box()["y"] >= page.locator(".site-header").bounding_box()["height"] - 1
                page.locator("#application-guide summary").focus()
                page.keyboard.press("Enter")
                assert page.locator("#application-guide").evaluate("e=>e.open")
                page.locator("#application-guide summary").click()
                if width in [1440, 390, 320]:
                    warm_images(page)
                    page.evaluate('scrollTo({top:0,behavior:"instant"})')
                    page.wait_for_timeout(400)
                    page.screenshot(path=str(OUTPUT / f"homepage-{width}.png"), full_page=True)
                    if width == 1440:
                        page.mouse.move(0, 0)
                        capture_style = '.site-header { visibility:hidden !important; }'
                        page.locator("#school-life").screenshot(path=str(OUTPUT / "school-album-desktop.png"), style=capture_style)
                        page.locator("#campuses").screenshot(path=str(OUTPUT / "campuses-desktop.png"), style=capture_style)
                        page.locator('[data-collection-choice="culture"]').click()
                        page.wait_for_timeout(400)
                        page.locator("#school-life").screenshot(path=str(OUTPUT / "cultural-album-desktop.png"), style=capture_style)
                        page.locator('.album-photo[data-photo="2"]').click()
                        page.wait_for_timeout(150)
                        page.screenshot(path=str(OUTPUT / "photo-viewer-desktop.png"))
                        page.keyboard.press("Escape")
                results.append({"width": width, "overflow": False, "hero_content_shift": 0, "album_content_shift": shift, "viewer_keyboard_touch_visit": "passed"})
                context.close()
            page = browser.new_page(viewport={"width": 1440, "height": 1080})
            observe(page)
            page.goto(url + "?scene=you", wait_until="networkidle")
            expect(page.locator('[data-panel="you"]')).to_have_attribute("aria-hidden", "false")
            page.reload()
            expect(page.locator('[data-panel="you"]')).to_have_attribute("aria-hidden", "false")
            page.locator('[data-scene-choice="olive"]').click()
            page.go_back()
            expect(page.locator('[data-panel="you"]')).to_have_attribute("aria-hidden", "false")
            page.go_forward()
            expect(page.locator('[data-panel="olive"]')).to_have_attribute("aria-hidden", "false")
            page.locator('[data-scene-choice="olive"]').focus()
            page.keyboard.press("ArrowRight")
            expect(page.locator('[data-panel="you"]')).to_have_attribute("aria-hidden", "false")
            page.emulate_media(reduced_motion="reduce")
            page.locator('[data-collection-choice="culture"]').click()
            page.locator('[data-scene-choice="olive"]').click()
            assert page.evaluate('getComputedStyle(document.documentElement).scrollBehavior==="auto"')
            assert page.evaluate('getComputedStyle(document.querySelector(".scene-you")).transitionDuration==="0s"')
            assert page.evaluate('getComputedStyle(document.querySelector(".album-sheet:not([hidden]) img")).animationName==="none"')
            page.emulate_media(reduced_motion="no-preference")
            page.evaluate('scrollTo({top:0,behavior:"instant"})')
            page.wait_for_timeout(1000)
            page.locator('[data-scene-choice="you"]').evaluate("e=>e.click()")
            audit = page.evaluate('''async()=>{const samples=[];let previous;await new Promise(resolve=>{function sample(t){if(previous!==undefined)samples.push(t-previous);previous=t;if(samples.length<65)requestAnimationFrame(sample);else resolve()}requestAnimationFrame(sample)});const root=document.documentElement;const average=samples.reduce((a,b)=>a+b,0)/samples.length;const report={isScrollUnlocked:root.scrollHeight>innerHeight&&getComputedStyle(root).overflowY!=="hidden",maxScroll:root.scrollHeight-innerHeight,fpsAverage:Math.round(1000/average),frameDrops:samples.filter(v=>v>22).length,webglDrawCalls:0,shaderErrors:[],samples:samples.length,maxFrameMs:Math.round(Math.max(...samples)*10)/10};window.__CREATIVE_AUDIT__=report;return report}''')
            assert audit["isScrollUnlocked"]
            page.wait_for_timeout(400)
            assert page.evaluate('document.getAnimations().filter(a=>a.playState==="running").length===0')
            warm_images(page)
            page.evaluate('scrollTo({top:0,behavior:"instant"})')
            page.screenshot(path=str(OUTPUT / "homepage-you-desktop.png"), full_page=True)
            page.close()
            context = browser.new_context(java_script_enabled=False, viewport={"width": 390, "height": 844})
            page = context.new_page()
            observe(page)
            page.goto(url, wait_until="networkidle")
            warm_images(page)
            expect(page.locator(".album-sheet:visible")).to_have_count(4)
            expect(page.locator(".album-choices")).not_to_be_visible()
            expect(page.locator(".scene-controls")).not_to_be_visible()
            expect(page.get_by_role("heading", level=1)).to_have_count(1)
            no_overflow(page)
            page.locator(".album-photo").first.click()
            assert "school-friends.webp" in page.url
            context.close()
        finally:
            browser.close()
    assert not errors, errors
    assert not http_failures, http_failures
    assert not external_requests, external_requests
    manifest = json.loads((SITE / "obhis-homepage-review-assets/provenance.json").read_text())
    for asset in manifest["assets"]:
        assert hashlib.sha256((Path(manifest["source_root"]) / asset["source"]).read_bytes()).hexdigest() == asset["source_sha256"]
        target = SITE / "obhis-homepage-review-assets" / asset["asset"]
        assert hashlib.sha256(target.read_bytes()).hexdigest() == asset["output_sha256"]
        with Image.open(target) as image:
            assert not image.getexif() and "exif" not in image.info
    assert not any(value in current for value in ["0903 476", "0915 949", "0805 775", "₦5,000", "1904768", "<form"])
    report = {"responsive": results, "history_reduced_motion_nojs": "passed", "errors": errors, "http_failures": http_failures, "external_requests": external_requests, "finite_runtime_audit": audit, "hero_and_source_preservation": "passed"}
    (OUTPUT / "verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
finally:
    server.shutdown()
    server.server_close()
