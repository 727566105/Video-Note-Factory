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
import toast from 'react-hot-toast'
import { getDownloaderCookie, updateDownloaderCookie } from '@/services/downloader'
import { useParams } from 'react-router-dom'
import { videoPlatforms } from '@/constant/note.ts'
import { Copy, Eye, EyeOff } from 'lucide-react'

const CookieSchema = z.object({
  cookie: z.string().min(10, '请填写有效 Cookie'),
})

const DownloaderForm = () => {
  const form = useForm({
    resolver: zodResolver(CookieSchema),
    defaultValues: { cookie: '' },
  })
  const { id } = useParams()

  const [loading, setLoading] = useState(true)
  const [showCookie, setShowCookie] = useState(false)

  useEffect(() => {
    const loadCookie = async () => {
      setLoading(true) // 🔁 切换平台时显示 loading
      try {
        const res = await getDownloaderCookie(id)
        const cookie = res?.cookie || ''
        form.reset({ cookie }) // ✅ 正确重置表单值
      } catch (e) {
        toast.error('加载 Cookie 失败: ' + e)
        form.reset({ cookie: '' }) // ❗失败时也要清空旧值
      } finally {
        setLoading(false)
      }
    }

    if (id) loadCookie()
  }, [id]) // 🔁 每当 id 变化时触发

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
    } catch (e) {
      toast.error('保存失败')
    }
  }

  if (loading) return <div className="p-4">加载中...</div>

  return (
    <div className="max-w-xl p-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="text-lg font-bold">
            设置{videoPlatforms.find(item => item.value === id)?.label}下载器 Cookie
          </div>

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

          <Button type="submit">保存</Button>
        </form>
      </Form>
    </div>
  )
}

export default DownloaderForm
