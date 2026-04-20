import { useState, forwardRef } from 'react';
import toast from 'react-hot-toast';
import { Image, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface ImageTemplate {
  id: string;
  name: string;
  description: string;
  width: number;
  preview: string;
}

const IMAGE_TEMPLATES: ImageTemplate[] = [
  {
    id: 'xiaohongshu',
    name: '温暖橙粉',
    description: '温暖渐变，柔和配色，适合生活分享',
    width: 1080,
    preview: '/templates/xiaohongshu-preview.png',
  },
  {
    id: 'simple',
    name: '极简黑白',
    description: '黑白配色，极简设计，专业现代',
    width: 1080,
    preview: '/templates/simple-preview.png',
  },
  {
    id: 'academic',
    name: '学术蓝',
    description: '深蓝配色，正式排版，适合学术笔记',
    width: 1080,
    preview: '/templates/academic-preview.png',
  },
];

interface ExportImageButtonProps {
  taskId: string;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

/**
 * 图文导出按钮组件
 * 用于将笔记导出为图片格式，支持多种模板选择
 */
export const ExportImageButton = forwardRef<HTMLButtonElement, ExportImageButtonProps>(({
  taskId,
  disabled = false,
  variant = 'default',
  size = 'default',
  className = '',
}, ref) => {
  const [loading, setLoading] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('xiaohongshu');

  const handleExport = async (template: string) => {
    setLoading(true);
    setShowTemplateDialog(false);
    try {
      const response = await fetch(`/api/export/image/${taskId}?template=${template}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: '导出失败' }));
        throw new Error(errorData.detail || '导出失败');
      }

      const blob = await response.blob();
      const contentType = response.headers.get('Content-Type') || '';
      const imageCount = response.headers.get('X-Image-Count') || '1';

      // 从 Content-Disposition 头提取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `note_${taskId}.png`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1]);
        } else {
          const plainMatch = contentDisposition.match(/filename="([^"]+)"/i);
          if (plainMatch) {
            filename = plainMatch[1];
          }
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // 根据文件类型显示不同的成功消息
      if (contentType.includes('zip')) {
        toast.success(`图文导出成功（${imageCount}张图片已打包）`);
      } else {
        toast.success('图文导出成功');
      }
    } catch (error) {
      console.error('图文导出失败:', error);
      const errorMessage = error instanceof Error ? error.message : '图文导出失败，请重试';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleButtonClick = () => {
    setShowTemplateDialog(true);
  };

  const handleConfirmExport = () => {
    handleExport(selectedTemplate);
  };

  return (
    <>
      <Button
        ref={ref}
        onClick={handleButtonClick}
        disabled={disabled || loading}
        variant={variant}
        size={size}
        className={className}
      >
        {loading ? (
          <>
            <Image className="w-4 h-4 animate-pulse" />
            <span>生成中...</span>
          </>
        ) : (
          <>
            <Image className="w-4 h-4" />
            <span>导出图文</span>
          </>
        )}
      </Button>

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择图文模板</DialogTitle>
            <DialogDescription>
              选择一个模板样式来导出笔记为图片
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {IMAGE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                type="button"
                className={`w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-gray-50 ${
                  selectedTemplate === template.id ? 'border-primary bg-primary/5' : 'border-gray-200'
                }`}
              >
                <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                  selectedTemplate === template.id
                    ? 'border-primary bg-primary'
                    : 'border-gray-300'
                }`}>
                  {selectedTemplate === template.id && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{template.name}</div>
                  <div className="text-sm text-gray-500 mt-1">{template.description}</div>
                </div>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTemplateDialog(false)}
            >
              取消
            </Button>
            <Button type="button" onClick={handleConfirmExport} disabled={loading}>
              {loading ? '生成中...' : '确认导出'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
