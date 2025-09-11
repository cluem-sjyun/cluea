# -*- coding: utf-8 -*-
import os, time, socket, signal
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    NoSuchElementException, StaleElementReferenceException,
    ElementNotInteractableException, TimeoutException
)
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys

# ===== 환경 =====
DEBUG_PORT = 9222
LOGIN_URL  = os.getenv("LOGIN_URL", "https://127.0.0.1")
USERNAME   = os.getenv("USER_USERNAME", "")
PASSWORD   = os.getenv("USER_PASSWORD", "")
START_EXT  = os.getenv("START_EXT")
END_EXT    = os.getenv("END_EXT")
START_EXT_LIST = os.getenv("START_EXT_LIST", "")
CANCEL_FLAG_FILE = os.getenv("CANCEL_FLAG_FILE", "")

# ===== 취소(시그널 + 플래그) =====
_CANCEL = False
def _set_cancel(signum, frame):
    global _CANCEL
    _CANCEL = True

signal.signal(signal.SIGINT, _set_cancel)
signal.signal(signal.SIGTERM, _set_cancel)

def should_cancel():
    if _CANCEL:
        return True
    if not CANCEL_FLAG_FILE:
        return False
    try:
        if not os.path.exists(CANCEL_FLAG_FILE):
            return False
        with open(CANCEL_FLAG_FILE, "r", encoding="utf-8", errors="ignore") as f:
            v = f.read().strip()
        return v == "1"
    except Exception:
        return False

# should_cancel이면 대기를 크게 단축
def _adj(total, fast=0.2):
    return fast if should_cancel() else total

# ===== 프레임 탐색 =====
def switch_into_frame_that_contains(driver, locator, timeout=10):
    """locator가 보이는 프레임으로 진입. 없으면 False."""
    end = time.time() + _adj(timeout, 0.4)
    while time.time() < end:
        if should_cancel():
            return False
        driver.switch_to.default_content()
        try:
            driver.find_element(*locator)
            return True
        except NoSuchElementException:
            pass
        frames = driver.find_elements(By.CSS_SELECTOR, "iframe, frame")
        for i in range(len(frames)):
            if should_cancel():
                return False
            driver.switch_to.default_content()
            try:
                frames = driver.find_elements(By.CSS_SELECTOR, "iframe, frame")
                driver.switch_to.frame(frames[i])
                driver.find_element(*locator)
                return True
            except (NoSuchElementException, StaleElementReferenceException):
                continue
        time.sleep(_adj(0.2, 0.05))
    driver.switch_to.default_content()
    return False

# ===== 견고한 대기/액션 헬퍼 =====
def _refind(driver, locator, frame_timeout=1.0):
    switch_into_frame_that_contains(driver, locator, timeout=_adj(frame_timeout, 0.2))
    return driver.find_element(*locator)

def wait_present(driver, locator, total_sec=10, step=0.5):
    end = time.time() + _adj(total_sec, 0.4)
    step = _adj(step, 0.1)
    last_err = None
    while time.time() < end:
        if should_cancel():
            raise TimeoutException("취소 감지")
        try:
            el = _refind(driver, locator, frame_timeout=min(step, 1.0))
            return el
        except (NoSuchElementException, StaleElementReferenceException) as e:
            last_err = e
            time.sleep(step)
    raise last_err or TimeoutException(f"요소 대기 타임아웃: {locator}")

def wait_clickable(driver, locator, total_sec=10, step=0.5):
    end = time.time() + _adj(total_sec, 0.4)
    step = _adj(step, 0.1)
    last_err = None
    while time.time() < end:
        if should_cancel():
            raise TimeoutException("취소 감지")
        try:
            el = _refind(driver, locator, frame_timeout=min(step, 1.0))
            if el.is_displayed() and el.is_enabled():
                return el
        except (NoSuchElementException, StaleElementReferenceException) as e:
            last_err = e
        time.sleep(step)
    raise last_err or TimeoutException(f"클릭 가능 대기 타임아웃: {locator}")

def safe_click(driver, locator, total_sec=10, step=0.3):
    end = time.time() + _adj(total_sec, 0.4)
    step = _adj(step, 0.1)
    last_err = None
    while time.time() < end:
        if should_cancel():
            raise TimeoutException("취소 감지")
        try:
            el = wait_clickable(driver, locator, total_sec=min(step, 1.0), step=step)
            try:
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
            except Exception:
                pass
            try:
                el.click()
                return
            except Exception:
                driver.execute_script("arguments[0].click();", el)
                return
        except (NoSuchElementException, StaleElementReferenceException, TimeoutException) as e:
            last_err = e
        time.sleep(step)
    raise last_err or TimeoutException(f"클릭 실패: {locator}")

def safe_send_keys(driver, locator_or_element, text, total_sec=10, step=0.3):
    end = time.time() + _adj(total_sec, 0.4)
    step = _adj(step, 0.1)
    last_err = None
    while time.time() < end:
        if should_cancel():
            raise TimeoutException("취소 감지")
        try:
            el = (locator_or_element if hasattr(locator_or_element, "send_keys")
                  else wait_present(driver, locator_or_element, total_sec=min(step, 1.0), step=step))
            try:
                el.clear()
            except Exception:
                pass
            try:
                el.send_keys(text)
                return
            except (ElementNotInteractableException, StaleElementReferenceException):
                driver.execute_script("""
                    const el = arguments[0], val = arguments[1];
                    el.value = '';
                    el.focus();
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                """, el, text)
                return
        except (NoSuchElementException, StaleElementReferenceException, TimeoutException) as e:
            last_err = e
        time.sleep(step)
    raise last_err or TimeoutException("send_keys 실패")

def wait_invisible(driver, locator, total_sec=8, step=0.3):
    end = time.time() + _adj(total_sec, 0.4)
    step = _adj(step, 0.1)
    while time.time() < end:
        if should_cancel():
            return True
        try:
            if WebDriverWait(driver, step).until(EC.invisibility_of_element_located(locator)):
                return True
        except TimeoutException:
            pass
        time.sleep(step)
    return False

# 빠른 존재 확인(없는 내선 스킵 단축)
def fast_exists(driver, locator, tries=3, interval=0.2):
    interval = _adj(interval, 0.05)
    for _ in range(tries):
        if should_cancel():
            return False
        try:
            switch_into_frame_that_contains(driver, locator, timeout=_adj(0.3, 0.1))
            els = driver.find_elements(*locator)
            if els:
                return True
        except Exception:
            pass
        time.sleep(interval)
    return False

# ===== HTTPS 경고 우회 =====
def bypass_https_warning_in_page(driver):
    try:
        btn = driver.find_elements(By.ID, "details-button")
        if btn:
            try:
                btn[0].click(); time.sleep(_adj(0.2, 0.05))
            except Exception:
                driver.execute_script("arguments[0].click();", btn[0]); time.sleep(_adj(0.2, 0.05))
            link = driver.find_elements(By.ID, "proceed-link")
            if link:
                try:
                    link[0].click(); time.sleep(_adj(0.4, 0.1))
                except Exception:
                    driver.execute_script("arguments[0].click();", link[0]); time.sleep(_adj(0.4, 0.1))
        else:
            try:
                ActionChains(driver).send_keys("thisisunsafe").perform()
                time.sleep(_adj(0.4, 0.1))
            except Exception:
                pass
    except Exception:
        pass

# ===== 로그인 =====
def already_logged_in(driver):
    users_span = (By.XPATH, "//span[normalize-space(.)='Users']")
    try:
        el = wait_present(driver, users_span, total_sec=2)
        return el is not None
    except Exception:
        return False

def ensure_login(driver):
    if already_logged_in(driver):
        print("[로그인] 이미 로그인 상태 → 스킵")
        return
    print("[로그인] 로그인 시도")
    bypass_https_warning_in_page(driver)

    u_loc = (By.ID, "username")
    u_inp = wait_present(driver, u_loc, total_sec=12)
    safe_send_keys(driver, u_inp, USERNAME)

    p_loc = (By.ID, "password")
    p_inp = wait_present(driver, p_loc, total_sec=12)
    safe_send_keys(driver, p_inp, PASSWORD)

    b_loc = (By.ID, "login-button")
    safe_click(driver, b_loc, total_sec=12)
    time.sleep(_adj(1.0, 0.2))

    if not already_logged_in(driver):
        raise RuntimeError("로그인 실패: Users 탭 표시 안됨")
    print("[로그인] 완료")

# ===== 결과 찾기(빠른 스킵) =====
def _find_and_open_result_by_ext(driver, ext_number, total_sec=1.2):
    end = time.time() + _adj(total_sec, 0.4)
    ext = str(ext_number)

    fast_candidates = [
        (By.XPATH, f"//tr[.//td[normalize-space(.)='{ext}'] or .//*[normalize-space(.)='{ext}']]"),
        (By.XPATH, f"//*[contains(@class,'font-big')][contains(normalize-space(.),'{ext}')]"),
        (By.XPATH, f"//tr[.//td[contains(normalize-space(.), '{ext}')] or .//*[contains(normalize-space(.), '{ext}')]]"),
    ]

    while time.time() < end:
        if should_cancel():
            return False
        for loc in fast_candidates:
            try:
                switch_into_frame_that_contains(driver, loc, timeout=_adj(0.3, 0.1))
                rows = driver.find_elements(*loc)
                if rows:
                    row = rows[0]
                    try:
                        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", row)
                    except Exception:
                        pass
                    try:
                        row.click()
                    except Exception:
                        driver.execute_script("arguments[0].click();", row)
                    return True
            except Exception:
                pass
        time.sleep(_adj(0.15, 0.05))

    return False

# ===== 삭제 로직 =====
def open_users_tab(driver):
    users_span = (By.XPATH, "//span[normalize-space(.)='Users']")
    safe_click(driver, users_span, total_sec=15)
    time.sleep(_adj(0.2, 0.05))

def search_and_open_user(driver, ext_number):
    if should_cancel():
        print("[중단] 취소 감지(검색 시작 전)"); return False

    # 1) 검색 인풋 (짧게)
    search_input = (By.XPATH, "//input[@type='text' and contains(@class,'w100')]")
    try:
        inp = wait_present(driver, search_input, total_sec=_adj(4, 0.4), step=_adj(0.25, 0.1))
    except TimeoutException:
        print("   > 검색 인풋 없음 → 스킵")
        return False

    # 초기화 후 입력
    try:
        inp.clear()
    except Exception:
        pass
    safe_send_keys(driver, inp, str(ext_number), total_sec=_adj(2, 0.3), step=_adj(0.2, 0.1))

    # 2) Apply(없으면 Enter)
    apply_btn = (By.XPATH, "//button[@type='submit' and (normalize-space(.)='Apply' or contains(@class,'custom-button1--valid'))]")
    try:
        safe_click(driver, apply_btn, total_sec=_adj(0.8, 0.2), step=_adj(0.2, 0.1))
    except Exception:
        try: inp.send_keys(Keys.ENTER)
        except Exception: pass

    # 3) 스피너/오버레이 짧게만 대기
    spinners = [
        (By.CSS_SELECTOR, ".loading, .spinner, .overlay"),
        (By.XPATH, "//*[contains(@class,'loading') or contains(@class,'spinner') or contains(@class,'overlay')]"),
    ]
    for sp in spinners:
        wait_invisible(driver, sp, total_sec=_adj(0.8, 0.2), step=_adj(0.2, 0.1))

    # 4) 결과 빠른 확인 → 없으면 즉시 False
    if _find_and_open_result_by_ext(driver, ext_number, total_sec=_adj(1.2, 0.4)):
        time.sleep(_adj(0.05, 0.02))
        return True

    # 느리게 뜨는 페이지 대비: 전역 텍스트에라도 보이면 한 번 더
    any_result = fast_exists(driver, (By.XPATH, f"//*[contains(normalize-space(.),'{ext_number}')]"),
                             tries=2, interval=0.15)
    if any_result and _find_and_open_result_by_ext(driver, ext_number, total_sec=_adj(0.6, 0.3)):
        return True

    print(f"   > {ext_number} 결과 없음 → 스킵(빠른)")
    return False

def delete_current_user(driver):
    if should_cancel():
        print("[중단] 취소 감지(삭제 전)"); return
    del_btn = (By.XPATH, "//button[contains(@class,'custom-button1--delete') and normalize-space(.)='Delete']")
    safe_click(driver, del_btn, total_sec=10)
    time.sleep(_adj(0.1, 0.05))

    if should_cancel():
        print("[중단] 취소 감지(OK 전)"); return
    ok_btn = (By.XPATH, "//button[@id='dialog-ok-btn' or (contains(@class,'custom-button1--valid') and normalize-space(.)='OK')]")
    safe_click(driver, ok_btn, total_sec=10)
    time.sleep(_adj(0.2, 0.05))

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
    # ✅ 대상 리스트 구성
    if START_EXT_LIST.strip():
        try:
            targets = [int(x) for x in START_EXT_LIST.split(",") if x.strip().isdigit()]
        except Exception:
            print("입력값 오류: START_EXT_LIST 파싱 실패"); return
    else:
        if not START_EXT or not END_EXT:
            print("입력값 오류: START_EXT/END_EXT 또는 START_EXT_LIST 필요"); return
        try:
            s = int(START_EXT); e = int(END_EXT)
            if s > e: s, e = e, s
            targets = list(range(s, e+1))
        except Exception:
            print("입력값 오류: START_EXT/END_EXT 정수 필요"); return

    if not _debug_port_up(DEBUG_PORT):
        print(f"[오류] 디버그 포트 {DEBUG_PORT} 의 크롬을 찾지 못했습니다."); return

    options = webdriver.ChromeOptions()
    options.add_experimental_option("debuggerAddress", f"127.0.0.1:{DEBUG_PORT}")
    options.set_capability("acceptInsecureCerts", True)
    options.add_argument("--ignore-certificate-errors")

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

    driver.get(LOGIN_URL)
    try:
        ensure_login(driver)
    except Exception as e:
        print(f"[로그인 단계] {e}")
        try: driver.quit()
        except Exception: pass
        return

    print(f"[삭제 작업] {targets}")
    try:
        open_users_tab(driver)
        for ext in targets:
            if should_cancel():
                print("[중단] 취소 감지(루프)"); break
            print(f" - {ext} 검색/오픈 시도...")
            if not search_and_open_user(driver, ext):
                continue
            if should_cancel():
                print("[중단] 취소 감지(삭제 직전)"); break
            delete_current_user(driver)
            print(f"   > {ext} 삭제 완료")
    except KeyboardInterrupt:
        print("\n[중단] Ctrl+C 감지 → 종료")
    finally:
        try: driver.quit()
        except Exception: pass
        print("[끝] 스크립트 종료")

if __name__ == "__main__":
    main()
