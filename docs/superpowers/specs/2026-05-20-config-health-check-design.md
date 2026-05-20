# 配置健康检查系统设计

> 解决问题：同事克隆代码后 Docker 部署能启动，但视频下载、笔记生成等功能全部异常。原因是缺少 AI Provider API Key、Cookie 等运行时配置，但用户不知道需要配置什么。

## 目标

1. **启动诊断**：后端启动时自动检查必要配置
2. **首页引导**：前端首页显示配置状态，缺少什么提示什么
3. **一键跳转**：点击可直达对应设置页面

## 检查项定义

| 检查项 | 判断标准 | 影响功能 | 提示链接 |
|--------|----------|----------|----------|
| database | `SELECT 1` 成功 | 全局 | 无（无法启动时直接报错） |
| ffmpeg | `ffmpeg -version` 执行成功 | 视频处理 | 安装文档 |
| ai_provider | 至少 1 个 Provider 有 API Key 且启用 | 笔记生成 | `/settings/model` |
| cookie | Cookie 文件存在且至少 1 个平台有配置 | 视频下载 | `/settings/download/bilibili` |
| transcriber | 模型已下载或下载中 | 视频转写 | 等待/重试 |
| directories | `data/`, `static/screenshots/`, `config/` 存在且可写 | 文件存储 | 自动创建 |

## 状态级别

- **ok**: 全部检查通过
- **degraded**: 部分功能不可用（如无 Cookie），但核心可用
- **error**: 核心功能不可用（如无 AI Provider），必须配置

---

## 后端实现

### 文件修改

**文件**: `backend/app/routers/health.py`

扩展 `/api/health` 端点，返回完整配置状态：

```python
@router.get("/health")
def health_check():
    """系统配置健康检查"""
    checks = {}

    # 1. Database
    checks["database"] = _check_database()

    # 2. FFmpeg
    checks["ffmpeg"] = _check_ffmpeg()

    # 3. AI Provider
    checks["ai_provider"] = _check_ai_provider()

    # 4. Cookie
    checks["cookie"] = _check_cookie()

    # 5. Transcriber
    checks["transcriber"] = _check_transcriber()

    # 6. Directories
    checks["directories"] = _check_directories()

    # 计算整体状态
    status = _compute_status(checks)

    return R.success(data={"status": status, "checks": checks})
```

### 检查函数实现

```python
def _check_database() -> dict:
    """检查数据库连接"""
    try:
        db = next(get_db())
        db.execute(text("SELECT 1"))
        db.close()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "message": str(e)}

def _check_ffmpeg() -> dict:
    """检查 FFmpeg"""
    from ffmpeg_helper import check_ffmpeg_exists
    ok = check_ffmpeg_exists()
    if ok:
        return {"ok": True}
    return {"ok": False, "message": "FFmpeg 未安装，请安装后重启"}

def _check_ai_provider() -> dict:
    """检查 AI 模型供应商"""
    providers = get_enabled_providers()
    has_key = any(p.api_key for p in providers)
    if has_key:
        return {"ok": True, "count": len(providers)}
    return {
        "ok": False,
        "message": "未配置 AI 模型供应商，请前往设置页面添加 API Key",
        "link": "/settings/model"
    }

def _check_cookie() -> dict:
    """检查平台 Cookie"""
    cookie_mgr = CookieConfigManager()
    platforms = {
        "bilibili": cookie_mgr.exists("bilibili"),
        "douyin": cookie_mgr.exists("douyin"),
    }
    ok = any(platforms.values())
    if ok:
        return {"ok": True, "platforms": platforms}
    return {
        "ok": False,
        "message": "未配置平台 Cookie，部分视频可能无法下载",
        "platforms": platforms,
        "link": "/settings/download"
    }

def _check_transcriber() -> dict:
    """检查转写器"""
    from app.transcriber.transcriber_provider import is_transcriber_ready, get_warm_up_status
    ready = is_transcriber_ready()
    status = get_warm_up_status()
    if ready:
        return {"ok": True, "type": status.get("transcriber_type")}
    if status.get("in_progress"):
        return {"ok": True, "type": status.get("transcriber_type"), "message": "模型下载中..."}
    return {"ok": False, "message": "转写模型未就绪", "type": status.get("transcriber_type")}

def _check_directories() -> dict:
    """检查关键目录"""
    from app.utils.path_helper import PROJECT_ROOT
    dirs = [
        PROJECT_ROOT / "data",
        PROJECT_ROOT / "backend" / "static" / "screenshots",
        PROJECT_ROOT / "config",
    ]
    for d in dirs:
        if not d.exists():
            d.mkdir(parents=True, exist_ok=True)
    return {"ok": True}

def _compute_status(checks: dict) -> str:
    """计算整体状态"""
    # AI Provider 是核心功能，缺失则为 error
    if not checks.get("ai_provider", {}).get("ok"):
        return "error"
    # 其他非核心缺失为 degraded
    for key, val in checks.items():
        if key == "ai_provider":
            continue
        if not val.get("ok"):
            return "degraded"
    return "ok"
```

### 依赖导入

需要添加的导入：
```python
from sqlalchemy import text
from app.db.engine import get_db
from app.db.provider_dao import get_enabled_providers
from app.services.cookie_manager import CookieConfigManager
from app.utils.response import R
```

---

## 前端实现

### 新增组件

**文件**: `videoNote_frontend/src/components/ConfigHealthBanner.tsx`

```tsx
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfigHealth } from "@/hooks/useConfigHealth";
import { Link } from "react-router-dom";

export function ConfigHealthBanner() {
  const { status, checks } = useConfigHealth();

  // 全部 OK 时不显示
  if (status === "ok") return null;

  // 有问题时显示警告卡片
  return (
    <Alert variant={status === "error" ? "destructive" : "warning"} className="mb-4">
      <AlertDescription className="flex flex-col gap-2">
        <div className="font-medium">
          配置不完整 ({Object.values(checks).filter(c => c.ok).length}/{Object.keys(checks).length})
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(checks).map(([key, val]) => (
            <span key={key} className="flex items-center gap-1">
              {val.ok ? "✅" : "❌"}
              {LABELS[key]}
              {!val.ok && val.link && (
                <Link to={val.link} className="text-blue-500 underline ml-1">设置</Link>
              )}
            </span>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}

const LABELS = {
  database: "数据库",
  ffmpeg: "FFmpeg",
  ai_provider: "AI 模型",
  cookie: "Cookie",
  transcriber: "转写器",
  directories: "目录",
};
```

### 新增 Hook

**文件**: `videoNote_frontend/src/hooks/useConfigHealth.ts`

```ts
import { useState, useEffect } from "react";
import { getHealth } from "@/services/system";

interface HealthCheck {
  ok: boolean;
  message?: string;
  link?: string;
}

interface HealthData {
  status: "ok" | "degraded" | "error";
  checks: Record<string, HealthCheck>;
}

export function useConfigHealth() {
  const [data, setData] = useState<HealthData>({ status: "ok", checks: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHealth().then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  return { ...data, loading };
}
```

### 修改首页

**文件**: `videoNote_frontend/src/layouts/HomeLayout.tsx`

```tsx
import { ConfigHealthBanner } from "@/components/ConfigHealthBanner";

export function HomeLayout() {
  return (
    <div className="h-screen flex flex-col items-center justify-center p-4">
      <ConfigHealthBanner />  {/* 新增 */}
      <QuickAdd />
    </div>
  );
}
```

### 扩展 system 服务

**文件**: `videoNote_frontend/src/services/system.ts`

```ts
export async function getHealth() {
  return request.get("/health");
}
```

---

## 验证方案

### 后端测试
1. 无 Provider → `/api/health` 返回 `status: "error"`
2. 有 Provider 无 Cookie → `/api/health` 返回 `status: "degraded"`
3. 全部配置 → `/api/health` 返回 `status: "ok"`

### 前端测试
1. 首页显示警告卡片，点击跳转到设置页
2. 配置 AI Provider 后，刷新首页，警告消失或减少
3. 状态 "ok" 时卡片不显示

---

## 文件清单

| 操作 | 文件路径 |
|------|----------|
| 修改 | `backend/app/routers/health.py` |
| 新增 | `videoNote_frontend/src/components/ConfigHealthBanner.tsx` |
| 新增 | `videoNote_frontend/src/hooks/useConfigHealth.ts` |
| 修改 | `videoNote_frontend/src/layouts/HomeLayout.tsx` |
| 修改 | `videoNote_frontend/src/services/system.ts` |