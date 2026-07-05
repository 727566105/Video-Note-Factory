#!/usr/bin/env python3
"""
配置一键导入功能 —— 端到端可靠性测试

模拟真实跨设备迁移场景，用真实 API(非 mock)验证:
  场景1: 完整成功路径(导出含真实密钥 → 导入 → 验证数据写入)
  场景2: 占位符密钥(应归 skipped 不报错)
  场景3: 冲突覆盖(同名 provider 被覆盖)
  场景4: 旧用法回归(传 selected_items+credentials 仍兼容)
  场景5: 空配置项跳过(siyuan/webdav 为 null 时正确处理)

运行: cd <项目根目录> && .venv/bin/python tests/e2e_config_import.py
"""
import json
import urllib.request
import urllib.error
import sys
import copy
from datetime import datetime

BASE = "http://127.0.0.1:8483"
ADMIN = {"username": "admin", "password": "123456"}

# 测试结果统计
results = {"pass": 0, "fail": 0, "details": []}


def log_result(name, passed, detail=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    results["pass" if passed else "fail"] += 1
    results["details"].append((status, name, detail))
    print(f"  {status} | {name}" + (f" — {detail}" if detail else ""))


def api(method, path, token=None, data=None):
    """调用 API，返回 (status_code, response_json)"""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        f"{BASE}{path}", data=body, headers=headers, method=method
    )
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def get_token():
    code, resp = api("POST", "/api/auth/login", data=ADMIN)
    assert code == 200 and resp.get("code") == 0, f"登录失败: {resp}"
    return resp["data"]["token"]


def get_all_providers(token):
    """获取当前所有 provider (id -> api_key 映射)。
    注意: 接口返回的 api_key 是脱敏的(中间用星号),如 sk-xxxx****yyyy"""
    code, resp = api("GET", "/api/get_all_providers", token)
    assert code == 200, f"获取 providers 失败: {code}"
    # resp 可能是 {code,msg,data} 或直接列表
    providers = resp.get("data", resp) if isinstance(resp, dict) else resp
    return {p["id"]: p.get("api_key", "") for p in providers}


def matches_masked(real_value, masked_returned):
    """脱敏值匹配: 接口返回形如 sk-xxx****yyy,
    验证返回值的首尾与真实值一致(脱敏保留首尾字符)。
    例: real='sk-e2e-real-key-12345', masked='sk-e*************2345'
    """
    if not masked_returned or "*" not in masked_returned:
        return masked_returned == real_value  # 未脱敏则直接比较
    prefix, _, suffix = masked_returned.partition("****")
    # 用最长连续星号段分割(脱敏可能不止4个星号)
    import re
    parts = re.split(r'\*+', masked_returned)
    if len(parts) >= 2:
        prefix, suffix = parts[0], parts[-1]
    return real_value.startswith(prefix) and real_value.endswith(suffix)


def get_siyuan_config(token):
    code, resp = api("GET", "/api/siyuan/config", token)
    if code == 200 and resp.get("code") == 0:
        return resp.get("data")
    return None


def get_webdav_config(token):
    code, resp = api("GET", "/api/webdav/config", token)
    if code == 200 and resp.get("code") == 0:
        return resp.get("data")
    return None


def export_config(token):
    """导出当前配置(含真实密钥)"""
    code, resp = api("GET", "/api/configs/export", token)
    assert code == 200 and resp.get("code") == 0, f"导出失败: {resp}"
    return resp["data"]


def import_config(token, config_data, selected_items=None, credentials=None):
    """执行导入，返回 (code, response_json)"""
    payload = {"config_data": config_data}
    if selected_items is not None:
        payload["selected_items"] = selected_items
    if credentials is not None:
        payload["credentials"] = credentials
    return api("POST", "/api/configs/import/execute", token, payload)


def make_test_config(providers=None, siyuan=None, webdav=None):
    """构造测试用配置文件结构"""
    return {
        "version": "1.0",
        "exported_at": datetime.now().isoformat(),
        "configs": {
            "providers": providers or [],
            "siyuan_config": siyuan,
            "webdav_config": webdav,
        },
    }


# ============================================================
# 测试场景
# ============================================================

def test_scenario_1_full_success(token):
    """场景1: 完整成功路径 — 导入含真实密钥的配置,验证数据写入"""
    print("\n场景1: 完整成功路径(导出含真实密钥 → 导入 → 验证写入)")
    test_provider = {
        "id": "e2e-test-provider-1",
        "name": "E2E测试模型",
        "logo": "TestLogo",
        "type": "built-in",
        "base_url": "https://e2e.test.api/v1",
        "enabled": 1,
        "api_key": "sk-e2e-real-key-12345",
    }
    config = make_test_config(providers=[test_provider])

    code, resp = import_config(token, config)
    ok = code == 200 and resp.get("code") == 0
    log_result("导入请求成功", ok, f"code={resp.get('code')}")

    success = resp.get("data", {}).get("success", [])
    failed = resp.get("data", {}).get("failed", [])
    skipped = resp.get("data", {}).get("skipped", [])
    ok = len(success) > 0 and len(failed) == 0
    log_result("返回 success>0 且 failed=0", ok,
               f"success={len(success)} failed={len(failed)} skipped={len(skipped)}")

    # 验证 provider 确实写入数据库(接口返回脱敏值,用首尾匹配)
    providers = get_all_providers(token)
    written = providers.get("e2e-test-provider-1")
    ok = matches_masked("sk-e2e-real-key-12345", written)
    log_result("provider 数据正确写入数据库", ok, f"脱敏api_key={written}")


def test_scenario_2_placeholder_skipped(token):
    """场景2: 占位符密钥 — 应归 skipped,不报错"""
    print("\n场景2: 占位符密钥(sk-test / ******** → 应 skipped)")
    configs = [
        {"id": "e2e-placeholder-test", "name": "占位符测试", "base_url": "u",
         "logo": "", "type": "built-in", "enabled": 1, "api_key": "sk-test"},
        {"id": "e2e-stars-test", "name": "星号测试", "base_url": "u",
         "logo": "", "type": "built-in", "enabled": 1, "api_key": "********"},
    ]
    config = make_test_config(providers=configs)

    code, resp = import_config(token, config)
    data = resp.get("data", {})
    success = data.get("success", [])
    failed = data.get("failed", [])
    skipped = data.get("skipped", [])

    ok = len(success) == 0 and len(failed) == 0
    log_result("占位符不进 success 也不进 failed", ok,
               f"success={len(success)} failed={len(failed)} skipped={len(skipped)}")

    skipped_ids = [s.get("id") for s in skipped if s.get("type") == "providers"]
    ok = "e2e-placeholder-test" in skipped_ids and "e2e-stars-test" in skipped_ids
    log_result("两个占位符 provider 都进 skipped", ok, f"skipped_ids={skipped_ids}")

    # 验证占位符 provider 没有被写入数据库
    providers = get_all_providers(token)
    ok = "e2e-placeholder-test" not in providers
    log_result("占位符 provider 未写入数据库", ok)


def test_scenario_3_conflict_overwrite(token):
    """场景3: 冲突覆盖 — 同名 provider 应被新值覆盖"""
    print("\n场景3: 冲突覆盖(同名 provider 被新值覆盖)")
    # 先写入 v1
    config_v1 = make_test_config(providers=[{
        "id": "e2e-overwrite-target", "name": "覆盖测试v1", "base_url": "u",
        "logo": "", "type": "built-in", "enabled": 1, "api_key": "sk-v1-original"
    }])
    import_config(token, config_v1)
    providers = get_all_providers(token)
    before = providers.get("e2e-overwrite-target")
    ok = matches_masked("sk-v1-original", before)
    log_result("前置: v1 已写入", ok, f"脱敏api_key={before}")

    # 再导入 v2 覆盖
    config_v2 = make_test_config(providers=[{
        "id": "e2e-overwrite-target", "name": "覆盖测试v2", "base_url": "u2",
        "logo": "", "type": "built-in", "enabled": 1, "api_key": "sk-v2-overwritten"
    }])
    code, resp = import_config(token, config_v2)
    ok = code == 200 and resp.get("code") == 0
    log_result("覆盖导入请求成功", ok)

    providers = get_all_providers(token)
    after = providers.get("e2e-overwrite-target")
    ok = matches_masked("sk-v2-overwritten", after) and not matches_masked("sk-v1-original", after)
    log_result("同名 provider 已被 v2 覆盖", ok, f"v1={before} → v2={after}")


def test_scenario_4_legacy_compatibility(token):
    """场景4: 旧用法回归 — 传 selected_items+credentials 仍正常"""
    print("\n场景4: 旧用法回归(传 selected_items + credentials)")
    config = make_test_config(providers=[{
        "id": "e2e-legacy-test", "name": "旧用法测试", "base_url": "u",
        "logo": "", "type": "built-in", "enabled": 1, "api_key": "sk-test"  # 文件里是占位符
    }])

    # 旧用法: 显式传 selected_items 和 credentials(凭证覆盖占位符)
    code, resp = import_config(
        token, config,
        selected_items=["providers"],
        credentials={"providers": {"e2e-legacy-test": "sk-legacy-cred-key"}}
    )
    ok = code == 200 and resp.get("code") == 0
    log_result("旧用法请求成功", ok)

    data = resp.get("data", {})
    success = data.get("success", [])
    ok = len(success) > 0
    log_result("旧用法仍能成功导入", ok, f"success={len(success)}")

    # 验证用的是 credentials 的值而非文件占位符(接口返回脱敏值,首尾匹配)
    providers = get_all_providers(token)
    written = providers.get("e2e-legacy-test")
    ok = matches_masked("sk-legacy-cred-key", written)
    log_result("credentials 优先级高于文件占位符", ok, f"脱敏写入值={written}")


def test_scenario_5_null_config_skip(token):
    """场景5: siyuan/webdav 为 null 时正确跳过"""
    print("\n场景5: siyuan_config / webdav_config 为 null 时正确跳过")
    config = make_test_config(providers=[], siyuan=None, webdav=None)

    code, resp = import_config(token, config)
    ok = code == 200 and resp.get("code") == 0
    log_result("null 配置导入请求成功", ok)

    # providers 为空列表,siyuan/webdav 为 null → selected_items 自动展开应为空
    data = resp.get("data", {})
    ok = len(data.get("success", [])) == 0 and len(data.get("failed", [])) == 0
    log_result("无可用项时不产生 success/failed", ok,
               f"success={len(data.get('success',[]))} failed={len(data.get('failed',[]))}")


def cleanup(token):
    """清理测试产生的 provider,避免污染数据库"""
    print("\n清理测试数据...")
    test_ids = [
        "e2e-test-provider-1", "e2e-placeholder-test", "e2e-stars-test",
        "e2e-overwrite-target", "e2e-legacy-test",
    ]
    for pid in test_ids:
        code, _ = api("DELETE", f"/api/delete_provider/{pid}", token)
        if code == 200:
            print(f"  已删除测试 provider: {pid}")


def main():
    print("=" * 64)
    print("配置一键导入功能 —— 端到端可靠性测试")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"目标: {BASE}")
    print("=" * 64)

    # 前置检查: 后端是否在线
    try:
        code, _ = api("GET", "/api/health")
        if code != 200:
            print(f"❌ 后端不可用(health={code}),请先启动后端")
            sys.exit(1)
        print("✅ 后端在线")
    except Exception:
        print("❌ 无法连接后端,请先启动: .venv/bin/python backend/main.py")
        sys.exit(1)

    token = get_token()
    print(f"✅ 登录成功(token={token[:20]}...)")

    # 运行所有场景
    try:
        test_scenario_1_full_success(token)
        test_scenario_2_placeholder_skipped(token)
        test_scenario_3_conflict_overwrite(token)
        test_scenario_4_legacy_compatibility(token)
        test_scenario_5_null_config_skip(token)
    finally:
        cleanup(token)

    # 汇总
    print("\n" + "=" * 64)
    print(f"测试汇总: ✅ {results['pass']} 通过, ❌ {results['fail']} 失败")
    print("=" * 64)

    if results["fail"] > 0:
        print("\n失败项明细:")
        for status, name, detail in results["details"]:
            if status.startswith("❌"):
                print(f"  {name}: {detail}")
        sys.exit(1)
    else:
        print("\n🎉 全部测试通过! 配置一键导入功能可靠可用。")
        sys.exit(0)


if __name__ == "__main__":
    main()
