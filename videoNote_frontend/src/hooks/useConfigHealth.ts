import { useState, useEffect } from "react";
import { getHealth } from "@/services/system";

interface HealthCheck {
  ok: boolean;
  message?: string;
  link?: string;
  count?: number;
  platforms?: Record<string, boolean>;
  type?: string;
}

interface HealthData {
  status: "ok" | "degraded" | "error";
  checks: Record<string, HealthCheck>;
}

export function useConfigHealth() {
  const [data, setData] = useState<HealthData>({
    status: "ok",
    checks: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHealth()
      .then((res: unknown) => {
        const healthData = (res as HealthData) || { status: "ok", checks: {} };
        if (healthData.checks && typeof healthData.status === "string") {
          setData(healthData);
        }
        setLoading(false);
      })
      .catch((e) => {
        console.error('获取配置健康状态失败:', e)
        setLoading(false);
      });
  }, []);

  return { ...data, loading };
}
