import { useState } from 'react';
import toast from 'react-hot-toast';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportPDFButtonProps {
  taskId: string;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

/**
 * PDF 导出按钮组件
 * 用于将笔记导出为 PDF 文件
 */
export function ExportPDFButton({
  taskId,
  disabled = false,
  variant = 'default',
  size = 'default',
  className = '',
}: ExportPDFButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/export/pdf/${taskId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: '导出失败' }));
        throw new Error(errorData.detail || '导出失败');
      }

      const blob = await response.blob();
      // 从 Content-Disposition 头提取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `note_${taskId}.pdf`; // 后备文件名

      if (contentDisposition) {
        // 解析 RFC 5987 格式: attachment; filename*=UTF-8''<encoded_filename>
        const filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1]);
        } else {
          // 兼容普通格式: attachment; filename="<filename>"
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

      toast.success('PDF 导出成功');
    } catch (error) {
      console.error('PDF 导出失败:', error);
      const errorMessage = error instanceof Error ? error.message : 'PDF 导出失败，请重试';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || loading}
      variant={variant}
      size={size}
      className={className}
    >
      {loading ? (
        <>
          <FileText className="w-4 h-4 animate-pulse" />
          <span>生成中...</span>
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          <span>导出 PDF</span>
        </>
      )}
    </Button>
  );
}
