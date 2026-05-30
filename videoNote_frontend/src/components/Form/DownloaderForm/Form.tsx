// 下载器 Cookie 设置表单（最简化版）
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getDownloaderCookie, updateDownloaderCookie, testDownloaderCookie } from '@/services/downloader'
import { Navigate, useParams } from 'react-router-dom'
import { videoPlatforms } from '@/constant/note.ts'
import { Copy, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'

const CookieSchema = z.object({
  cookie: z.string()
    .min(10, '请填写有效 Cookie')
    .refine(val => !(val.includes('<') && val.includes('>')), {
      message: '内容包含 HTML 标签，请复制纯 Cookie 文本',
    })
    .refine(val => !/[一-鿿]/.test(val), {
      message: 'Cookie 不应包含中文字符，请检查复制内容',
    }),
})

type TestResult = { valid: boolean; message: string; details?: string } | null

const DownloaderForm = () => {
  const { id } = useParams()
  const isMobile = useIsMobile()
  const form = useForm({
    resolver: zodResolver(CookieSchema),
    defaultValues: { cookie: '' },
  })
  const [loading, setLoading] = useState(true)
  const [showCookie, setShowCookie] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult>(null)

  useEffect(() => {
    const loadCookie = async () => {
      setLoading(true)
      try {
        const res = await getDownloaderCookie(id)
        const cookie = res?.cookie || ''
        form.reset({ cookie })
      } catch (e) {
        toast.error('加载 Cookie 失败: ' + e)
        form.reset({ cookie: '' })
      } finally {
        setLoading(false)
      }
    }

    if (id) loadCookie()
  }, [id])

  const handleCopy = () => {
    if (form.getValues('cookie')) {
      navigator.clipboard.writeText(form.getValues('cookie'))
      toast.success('已复制到剪贴板')
    } else {
      toast.error('Cookie 为空')
    }
  }

  const onSubmit = async values => {
    try {
      await updateDownloaderCookie({
        platform: id,
        cookie: String(values.cookie),
      })
      toast.success('保存成功')
      setTestResult(null)
    } catch (e) {
      toast.error('保存失败')
    }
  }

  const handleTest = async () => {
    const cookie = form.getValues('cookie')
    if (!cookie || cookie.length < 10) {
      toast.error('请先填写 Cookie')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await testDownloaderCookie({ platform: id, cookie })
      setTestResult(res)
    } catch (e) {
      setTestResult({ valid: false, message: '验证请求失败', details: String(e) })
    } finally {
      setTesting(false)
    }
  }

  // 本地视频和本地音频不需要配置 Cookie，重定向回下载器列表
  if (id === 'local' || id === 'local_audio') {
    return <Navigate to="/settings/download" replace />
  }

  if (loading) return <div className="p-4 md:p-6">加载中...</div>

  return (
    <div className="p-4 md:p-6 max-w-xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* 标题 - 仅桌面端显示 */}
          {!isMobile && (
            <div className="text-lg font-bold">
              设置{videoPlatforms.find(item => item.value === id)?.label}下载器 Cookie
            </div>
          )}

          <FormField
            control={form.control}
            name="cookie"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2">
                <FormLabel>Cookie</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      type={showCookie ? 'text' : 'password'}
                      placeholder="输入 Cookie"
                      className="pr-20"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        className="p-1 text-neutral-400 hover:text-neutral-600"
                        onClick={() => setShowCookie(!showCookie)}
                      >
                        {showCookie ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        className="p-1 text-neutral-400 hover:text-neutral-600"
                        onClick={handleCopy}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2">
            <Button type="submit" size={isMobile ? 'sm' : 'default'}>保存</Button>
            <Button
              type="button"
              variant="outline"
              size={isMobile ? 'sm' : 'default'}
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? '验证中...' : '检查可用性'}
            </Button>
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 rounded-md p-3 text-sm ${
              testResult.valid
                ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
            }`}>
              {testResult.valid
                ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              }
              <div>
                <div className="font-medium">{testResult.message}</div>
                {testResult.details && (
                  <div className="mt-0.5 opacity-80">{testResult.details}</div>
                )}
              </div>
            </div>
          )}
        </form>
      </Form>
    </div>
  )
}

export default DownloaderForm