# file: attach_create_sip_extensions.py
# 사용법:
# 1) run_chrome_debug.bat 실행 (9222 포트)
# 2) Next.js에서 API 호출 시 env로 값 전달
#    LOGIN_URL, SIP_USERNAME, SIP_PASSWORD, START_EXT, END_EXT, ENTITY

import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException, NoSuchElementException,
    StaleElementReferenceException, ElementNotInteractableException
)
from selenium.webdriver.common.action_chains import ActionChains
import socket
import time

# ====== 환경 설정 ======
DEBUG_PORT = 9222
LOGIN_URL  = os.getenv("LOGIN_URL", "https://127.0.0.1")
USERNAME   = os.getenv("SIP_USERNAME", "")
PASSWORD   = os.getenv("SIP_PASSWORD", "")
START_EXT  = os.getenv("START_EXT")
END_EXT    = os.getenv("END_EXT")
ENTITY     = os.getenv("ENTITY")
SETTYPE_PARTIAL_TEXT = "SIP extension"

# ====== 유틸 ======
def wait_clickable(wait, locator, sec=15):
    return WebDriverWait(wait._driver, sec).until(EC.element_to_be_clickable(locator))

def wait_present(wait, locator, sec=15):
    return WebDriverWait(wait._driver, sec).until(EC.presence_of_element_located(locator))

def safe_click(wait, locator, sec=15):
    el = wait_clickable(wait, locator, sec)
    try:
        el.click()
    except Exception:
        wait._driver.execute_script("arguments[0].click();", el)

def safe_send_keys(driver, element, text):
    try:
        element.clear()
    except Exception:
        pass
    try:
        element.send_keys(text)
        return
    except (ElementNotInteractableException, StaleElementReferenceException):
        pass
    driver.execute_script("""
        const el = arguments[0], val = arguments[1];
        el.value = '';
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    """, element, text)

def switch_into_frame_that_contains(driver, locator, timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        driver.switch_to.default_content()
        try:
            driver.find_element(*locator)
            return True
        except NoSuchElementException:
            pass
        frames = driver.find_elements(By.CSS_SELECTOR, "iframe, frame")
        for i in range(len(frames)):
            driver.switch_to.default_content()
            try:
                frames = driver.find_elements(By.CSS_SELECTOR, "iframe, frame")
                driver.switch_to.frame(frames[i])
                driver.find_element(*locator)
                return True
            except (NoSuchElementException, StaleElementReferenceException):
                continue
        time.sleep(0.2)
    driver.switch_to.default_content()
    return False

def find_select_with_option_text(driver, partial_text):
    selects = driver.find_elements(By.TAG_NAME, "select")
    for sel in selects:
        options = sel.find_elements(By.TAG_NAME, "option")
        for opt in options:
            if partial_text.lower() in opt.text.strip().lower():
                return sel
    return None

def select_option_by_partial_text(driver, select_el, partial_text):
    opts = select_el.find_elements(By.TAG_NAME, "option")
    for opt in opts:
        if partial_text.lower() in opt.text.strip().lower():
            driver.execute_script("arguments[0].selected = true;", opt)
            driver.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", select_el)
            return True
    return False

def bypass_https_warning_in_page(driver):
    try:
        btn = driver.find_elements(By.ID, "details-button")
        if btn:
            btn[0].click()
            time.sleep(0.2)
            link = driver.find_elements(By.ID, "proceed-link")
            if link:
                link[0].click()
                time.sleep(0.4)
        else:
            try:
                ActionChains(driver).send_keys("thisisunsafe").perform()
                time.sleep(0.4)
            except Exception:
                pass
    except Exception:
        pass

# ----- 로그인 -----
def already_logged_in(wait):
    driver = wait._driver
    users_span = (By.XPATH, "//span[normalize-space(.)='Users']")
    try:
        if switch_into_frame_that_contains(driver, users_span, timeout=2):
            WebDriverWait(driver, 3).until(EC.presence_of_element_located(users_span))
            return True
        driver.switch_to.default_content()
        WebDriverWait(driver, 2).until(EC.presence_of_element_located(users_span))
        return True
    except Exception:
        return False

def ensure_login(wait):
    driver = wait._driver
    if already_logged_in(wait):
        print("[로그인] 이미 로그인 상태 → 스킵")
        return
    print("[로그인] 로그인 필요 → 시도")
    bypass_https_warning_in_page(driver)

    u_loc = (By.ID, "username")
    if not switch_into_frame_that_contains(driver, u_loc, timeout=8):
        driver.switch_to.default_content()
    u_inp = wait_present(wait, u_loc, 12)
    safe_send_keys(driver, u_inp, USERNAME)

    p_loc = (By.ID, "password")
    if not switch_into_frame_that_contains(driver, p_loc, timeout=3):
        driver.switch_to.default_content()
    p_inp = wait_present(wait, p_loc, 12)
    safe_send_keys(driver, p_inp, PASSWORD)

    b_loc = (By.ID, "login-button")
    if not switch_into_frame_that_contains(driver, b_loc, timeout=3):
        driver.switch_to.default_content()
    safe_click(wait, b_loc, 12)
    time.sleep(1.0)

    if not already_logged_in(wait):
        raise RuntimeError("로그인 실패: Users 탭을 찾지 못함")
    print("[로그인] 완료")

# ----- 확장 생성 -----
def create_one_extension(wait, ext_number, entity_value=None, settype_text=SETTYPE_PARTIAL_TEXT):
    driver = wait._driver
    users_span = (By.XPATH, "//span[normalize-space(.)='Users']")
    if not switch_into_frame_that_contains(driver, users_span, timeout=6):
        driver.switch_to.default_content()
    safe_click(wait, users_span, 15)

    create_btn = (By.XPATH, "//button[normalize-space(.)='Create']")
    safe_click(wait, create_btn, 15)

    input_loc = (By.ID, "attr_str_Directory_Number_0")
    if not switch_into_frame_that_contains(driver, input_loc, timeout=6):
        driver.switch_to.default_content()
    inp = wait_present(wait, input_loc, 15)
    safe_send_keys(driver, inp, str(ext_number))

    select_el = find_select_with_option_text(driver, settype_text)
    if not select_el:
        time.sleep(0.3)
        select_el = find_select_with_option_text(driver, settype_text)
    if not select_el:
        raise RuntimeError(f"'{settype_text}' 옵션이 있는 드롭다운을 찾지 못함")
    if not select_option_by_partial_text(driver, select_el, settype_text):
        raise RuntimeError(f"'{settype_text}' 옵션 선택 실패")

    if entity_value is not None and str(entity_value).strip() != "":
        entity_loc = (By.ID, "attr_int_Entity_Number_16")
        if not switch_into_frame_that_contains(driver, entity_loc, timeout=4):
            driver.switch_to.default_content()
        try:
            entity_inp = wait_present(wait, entity_loc, 8)
            safe_send_keys(driver, entity_inp, str(entity_value))
        except Exception as ee:
            print(f"   [경고] 엔티티 입력 실패(무시): {ee}")

    save_btn = (By.XPATH, "//button[normalize-space(.)='Save' and (@type='submit' or @type='button')]")
    safe_click(wait, save_btn, 15)
    time.sleep(0.6)

# ====== 메인 ======
def _debug_port_up(port):
    s = socket.socket()
    s.settimeout(0.5)
    try:
        s.connect(("127.0.0.1", port))
        s.close()
        return True
    except Exception:
        return False

def main():
    if not _debug_port_up(DEBUG_PORT):
        print(f"[오류] 디버그 포트 {DEBUG_PORT} 의 크롬을 찾지 못했습니다.")
        return

    options = webdriver.ChromeOptions()
    options.add_experimental_option("debuggerAddress", f"127.0.0.1:{DEBUG_PORT}")
    options.set_capability("acceptInsecureCerts", True)
    options.add_argument("--ignore-certificate-errors")

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    wait = WebDriverWait(driver, 20)

    def _noquit(*args, **kwargs):
        print("[i] driver.quit()/close() 호출 무시 (크롬은 유지)")
    driver.quit = _noquit
    driver.close = _noquit

    driver.get(LOGIN_URL)

    try:
        ensure_login(wait)
    except Exception as e:
        print(f"[로그인 단계] {e}")
        return

    # ---- 여기부터는 env 값 사용 ----
    try:
        s = int(START_EXT)
        e = int(END_EXT)
        if s > e:
            s, e = e, s
    except Exception:
        print("입력값 오류: START_EXT / END_EXT 확인")
        return

    entity_value = ENTITY if ENTITY and ENTITY.strip() != "" else None

    print(f"[작업] {s} ~ {e} (셋타입: {SETTYPE_PARTIAL_TEXT}, 엔티티: {entity_value or '생략'})")
    try:
        for ext in range(s, e + 1):
            try:
                print(f" - {ext} 생성 중...")
                create_one_extension(wait, ext, entity_value=entity_value, settype_text=SETTYPE_PARTIAL_TEXT)
                print(f"   > {ext} 생성 완료")
            except Exception as ex:
                print(f"   ! {ext} 실패: {ex} → 다음으로 진행")
                continue
    except KeyboardInterrupt:
        print("\n[중단] Ctrl+C 감지 → 루프 종료")
    finally:
        print("[끝] 스크립트 종료. 크롬은 계속 열려 있습니다.")

if __name__ == "__main__":
    main()
