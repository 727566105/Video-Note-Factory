import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfigHealth } from "@/hooks/useConfigHealth";
import { Link } from "react-router-dom";

const LABELS: Record<string, string> = {
  database: "数据库",
  ffmpeg: "FFmpeg",
  ai_provider: "AI 模型",
  cookie: "Cookie",
  transcriber: "转写器",
  directories: "目录",
};

export function ConfigHealthBanner() {
  const { status, checks, loading } = useConfigHealth();

  // 加载中、数据为空或全部 OK 时不显示
  if (loading || !checks || status === "ok") return null;

  // 计算通过数量
  const passedCount = Object.values(checks).filter((c) => c.ok).length;
  const totalCount = Object.keys(checks).length;

  return (
    <Alert
      variant={status === "error" ? "destructive" : "warning"}
      className="absolute left-1/2 top-4 z-20 max-w-2xl w-full -translate-x-1/2"
    >
      <AlertDescription className="flex flex-col gap-3">
        <div className="font-medium text-base">
          配置不完整 ({passedCount}/{totalCount})
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {Object.entries(checks).map(([key, val]) => (
            <span key={key} className="flex items-center gap-1.5 text-sm">
              <span className={val.ok ? "text-green-600" : "text-red-500"}>
                {val.ok ? "✓" : "✗"}
              </span>
              <span>{LABELS[key] || key}</span>
              {!val.ok && val.link && (
                <Link
                  to={val.link}
                  className="text-blue-500 hover:underline ml-1"
                >
                  设置
                </Link>
              )}
              {!val.ok && val.message && !val.link && (
                <span className="text-gray-500 text-xs ml-1">
                  {val.message}
                </span>
              )}
            </span>
          ))}
        </div>
        {status === "error" && (
          <div className="text-sm text-gray-600 mt-1">
            核心功能需要 AI 模型配置，请先添加 API Key
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}