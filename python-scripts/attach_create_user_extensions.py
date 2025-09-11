# -*- coding: utf-8 -*-
"""
유저 생성 자동화 (취소/정지 신속 반영 + 견고한 프레임/대기 처리)

환경 변수
- LOGIN_URL, USER_USERNAME, USER_PASSWORD
- START_EXT, END_EXT (정수 범위)
- ENTITY (선택, 숫자/문자 모두 허용)
- SET_TYPE_VALUE, SET_TYPE_TEXT (둘 중 하나 이상)
- HUNT_GROUP, PICKUP_GROUP (선택)
- CANCEL_FLAG_FILE (선택, "1" 이면 즉시 중단)

사전 준비
- 크롬 디버그 모드 실행 (--remote-debugging-port=9222)
"""

import os, time, socket, signal, sys, json
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
ENTITY     = os.getenv("ENTITY", "").strip()

SET_TYPE_VALUE = os.getenv("SET_TYPE_VALUE", "").strip()
SET_TYPE_TEXT  = os.getenv("SET_TYPE_TEXT", "").strip()

HUNT_GROUP     = os.getenv("HUNT_GROUP", "").strip()
PICKUP_GROUP   = os.getenv("PICKUP_GROUP", "").strip()

CANCEL_FLAG_FILE = os.getenv("CANCEL_FLAG_FILE", "").strip()

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
            return f.read().strip() == "1"
    except Exception:
        return False

def _adj(total, fast=0.2):
    """취소 감지 시 대기 시간을 즉시 단축"""
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
    end = time.time() + _adj(total_sec, 0.5)
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
    end = time.time() + _adj(total_sec, 0.5)
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
    end = time.time() + _adj(total_sec, 0.5)
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

def wait_invisible(driver, locator, total_sec=6, step=0.25):
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

# ===== 셀렉트 박스 =====
def find_select(driver):
    return driver.find_elements(By.TAG_NAME, "select") or []

def select_option(driver, prefer_value=None, fallback_text=None):
    selects = find_select(driver)
    pv = (prefer_value or "").strip().lower()
    ft = (fallback_text or "").strip().lower()
    for sel in selects:
        options = sel.find_elements(By.TAG_NAME, "option")
        # 1) value 일치 우선
        if pv:
            for opt in options:
                val = (opt.get_attribute("value") or "").strip().lower()
                if val == pv:
                    driver.execute_script("arguments[0].selected = true;", opt)
                    driver.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", sel)
                    return True
        # 2) 텍스트 포함 매칭
        if ft:
            for opt in options:
                if ft in opt.text.strip().lower():
                    driver.execute_script("arguments[0].selected = true;", opt)
                    driver.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", sel)
                    return True
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

# ===== 로그인 / 세션 =====
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

def _click_ok_dialog_if_present(driver, timeout=2):
    ok_btn = (By.XPATH, "//button[@id='dialog-ok-btn' or (contains(@class,'custom-button1--valid') and normalize-space(.)='OK')]")
    try:
        if switch_into_frame_that_contains(driver, ok_btn, timeout=_adj(timeout, 0.4)):
            safe_click(driver, ok_btn, total_sec=3)
            time.sleep(_adj(0.2, 0.05))
            return True
        return False
    except Exception:
        return False
    finally:
        driver.switch_to.default_content()

def check_session_and_relogin(driver):
    """Unauthorized/session timeout 등 모달이 있으면 닫고, 로그인 재확인"""
    clicked = _click_ok_dialog_if_present(driver, timeout=1)
    users_span = (By.XPATH, "//span[normalize-space(.)='Users']")
    try:
        if switch_into_frame_that_contains(driver, users_span, timeout=2):
            WebDriverWait(driver, 2).until(EC.presence_of_element_located(users_span))
            driver.switch_to.default_content()
            return clicked
    except Exception:
        pass
    try:
        ensure_login(driver)
        return True
    except Exception:
        return False

# ===== 페이지 조작 =====
def open_users_tab(driver):
    users_span = (By.XPATH, "//span[normalize-space(.)='Users']")
    safe_click(driver, users_span, total_sec=15)
    time.sleep(_adj(0.2, 0.05))

# ===== 생성 =====
def create_one(driver, ext_number, entity_value=None):
    # Users → Create
    open_users_tab(driver)

    create_btn = (By.XPATH, "//button[normalize-space(.)='Create']")
    safe_click(driver, create_btn, total_sec=10)

    # Directory Number
    input_loc = (By.ID, "attr_str_Directory_Number_0")
    inp = wait_present(driver, input_loc, total_sec=10)
    safe_send_keys(driver, inp, str(ext_number))

    # Set Type (value → 텍스트 fallback)
    if not (SET_TYPE_VALUE or SET_TYPE_TEXT):
        raise RuntimeError("Set Type 미지정: SET_TYPE_VALUE 또는 SET_TYPE_TEXT 중 하나는 필요")

    ok = select_option(driver, prefer_value=SET_TYPE_VALUE, fallback_text=SET_TYPE_TEXT)
    if not ok:
        raise RuntimeError(f"Set Type 선택 실패 (value='{SET_TYPE_VALUE}', text~='{SET_TYPE_TEXT}')")

    # Entity (선택)
    if entity_value:
        entity_loc = (By.ID, "attr_int_Entity_Number_16")
        try:
            el = wait_present(driver, entity_loc, total_sec=6)
            safe_send_keys(driver, el, str(entity_value))
        except Exception as ee:
            print(f"   [경고] 엔티티 입력 실패(무시): {ee}")

    # Facilities 탭 선택(있으면)
    try:
        facilities_tab = (By.XPATH, "//li[contains(@class,'group') and contains(@class,'cpointer') and normalize-space(text())='Facilities']")
        if switch_into_frame_that_contains(driver, facilities_tab, timeout=_adj(3, 0.4)):
            try:
                el = wait_present(driver, facilities_tab, total_sec=5)
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
                driver.execute_script("arguments[0].click();", el)
                time.sleep(_adj(0.2, 0.05))
            except Exception:
                pass
    except Exception:
        pass

    # Hunt Group / Pickup Group (선택)
    try:
        if HUNT_GROUP:
            hg_loc = (By.ID, "attr_str_Station_Group_Directory_Number_52")
            if switch_into_frame_that_contains(driver, hg_loc, timeout=_adj(2, 0.4)):
                try:
                    hg_inp = wait_present(driver, hg_loc, total_sec=5)
                    safe_send_keys(driver, hg_inp, HUNT_GROUP)
                except Exception as he:
                    print(f"   [경고] 헌트그룹 입력 실패(무시): {he}")
        if PICKUP_GROUP:
            pg_loc = (By.ID, "attr_str_Pickup_Group_Name_54")
            if switch_into_frame_that_contains(driver, pg_loc, timeout=_adj(2, 0.4)):
                try:
                    pg_inp = wait_present(driver, pg_loc, total_sec=5)
                    safe_send_keys(driver, pg_inp, PICKUP_GROUP)
                except Exception as pe:
                    print(f"   [경고] 픽업그룹 입력 실패(무시): {pe}")
    except Exception:
        pass

    # Save
    save_btn = (By.XPATH, "//button[normalize-space(.)='Save' and (@type='submit' or @type='button')]")
    safe_click(driver, save_btn, total_sec=10)
    time.sleep(_adj(0.6, 0.15))

# ===== 메인 =====
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
    # 1) jobs 입력 파싱 (JOBS_JSON 우선, 없으면 단일 범위 호환)
    jobs_json = os.getenv("JOBS_JSON", "").strip()
    jobs = []
    if jobs_json:
        try:
            raw = json.loads(jobs_json)
            assert isinstance(raw, list)
            for j in raw:
                s = int(j.get("startExt"))
                e = int(j.get("endExt"))
                if s > e: s, e = e, s
                jobs.append({
                    "startExt": s,
                    "endExt": e,
                    "entity": (j.get("entity") or "").strip(),
                    "setTypeValue": (j.get("setTypeValue") or "").strip(),
                    "setTypeText": (j.get("setTypeText") or "").strip(),
                    "huntGroup": (j.get("huntGroup") or "").strip(),
                    "pickupGroup": (j.get("pickupGroup") or "").strip(),
                })
        except Exception as e:
            print(f"[입력 파싱 오류] JOBS_JSON: {e}")
            return 1
    else:
        # 구버전 호환 (단일 범위)
        START_EXT = os.getenv("START_EXT")
        END_EXT   = os.getenv("END_EXT")
        if not START_EXT or not END_EXT:
            print("입력값 오류: JOBS_JSON 또는 START_EXT/END_EXT 필요")
            return 1
        try:
            s = int(START_EXT); e = int(END_EXT)
            if s > e: s, e = e, s
        except Exception:
            print("입력값 오류: START_EXT/END_EXT 정수 필수")
            return 1
        jobs.append({
            "startExt": s,
            "endExt": e,
            "entity": (os.getenv("ENTITY", "") or "").strip(),
            "setTypeValue": (os.getenv("SET_TYPE_VALUE", "") or "").strip(),
            "setTypeText": (os.getenv("SET_TYPE_TEXT", "") or "").strip(),
            "huntGroup": (os.getenv("HUNT_GROUP", "") or "").strip(),
            "pickupGroup": (os.getenv("PICKUP_GROUP", "") or "").strip(),
        })

    # 2) 크롬 디버그 포트 확인/드라이버 연결
    DEBUG_PORT = 9222
    def _debug_port_up(port):
        import socket
        s = socket.socket(); s.settimeout(0.5)
        try:
            s.connect(("127.0.0.1", port)); s.close(); return True
        except Exception: return False

    if not _debug_port_up(DEBUG_PORT):
        print(f"[오류] 디버그 포트 {DEBUG_PORT} 의 크롬을 찾지 못했습니다.")
        return 1

    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from webdriver_manager.chrome import ChromeDriverManager

    options = webdriver.ChromeOptions()
    options.add_experimental_option("debuggerAddress", f"127.0.0.1:{DEBUG_PORT}")
    options.set_capability("acceptInsecureCerts", True)
    options.add_argument("--ignore-certificate-errors")

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

    LOGIN_URL = os.getenv("LOGIN_URL", "https://127.0.0.1")
    driver.get(LOGIN_URL)

    try:
        # ✅ 로그인 1회만 수행
        ensure_login(driver)

        # 3) 모든 묶음을 **한 세션에서 연속 처리**
        for idx, j in enumerate(jobs):
            print(f"[묶음 {idx+1}/{len(jobs)}] {j['startExt']}~{j['endExt']} "
                  f"(type='{j['setTypeValue'] or j['setTypeText']}', entity='{j['entity']}', "
                  f"HG='{j['huntGroup']}', PG='{j['pickupGroup']}')")

            # 묶음별 동적 설정(전역/모듈 변수를 쓰는 유틸이면 setter로 전달)
            global SET_TYPE_VALUE, SET_TYPE_TEXT, HUNT_GROUP, PICKUP_GROUP
            SET_TYPE_VALUE = j["setTypeValue"]
            SET_TYPE_TEXT  = j["setTypeText"]
            HUNT_GROUP     = j["huntGroup"]
            PICKUP_GROUP   = j["pickupGroup"]
            entity_value   = j["entity"] or None

            for ext in range(j["startExt"], j["endExt"] + 1):
                if should_cancel():
                    print("[중단] 취소 감지 → 즉시 종료")
                    return 1
                print(f" - {ext} 생성 시도...")
                try:
                    # 세션 만료/팝업 여부 가벼운 체크
                    check_session_and_relogin(driver)
                    create_one(driver, ext, entity_value=entity_value)
                    print(f"   > {ext} 생성 완료")
                except TimeoutException as te:
                    print(f"   ! {ext} 타임아웃: {te} → 다음으로 진행")
                except Exception as ex:
                    print(f"   ! {ext} 실패: {ex} → 다음으로 진행")

        print("[끝] 모든 묶음 처리 완료")
        return 0

    except KeyboardInterrupt:
        print("\n[중단] Ctrl+C 감지 → 종료")
        return 1
    except Exception as e:
        print(f"[예외 종료] {e}")
        return 1
    finally:
        try: driver.quit()
        except Exception: pass


if __name__ == "__main__":
    code = main()
    sys.exit(code)