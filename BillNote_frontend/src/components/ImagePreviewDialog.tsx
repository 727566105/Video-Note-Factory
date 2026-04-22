import { FC } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog.tsx'

interface ImagePreviewDialogProps {
  open: boolean
  onClose: () => void
  imageUrl: string
  title?: string
}

const ImagePreviewDialog: FC<ImagePreviewDialogProps> = ({
  open,
  onClose,
  imageUrl,
  title = '图片预览'
}) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="max-w-4xl w-full bg-black/90 border-none p-0 flex items-center justify-center [&>[data-slot=dialog-close]]:rounded-full [&>[data-slot=dialog-close]]:bg-white/80 [&>[data-slot=dialog-close]]:p-2 [&>[data-slot=dialog-close]]:text-black [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]]:hover:bg-white"
        showCloseButton={true}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="relative w-full h-full flex items-center justify-center p-4">
          <img
            src={imageUrl}
            alt={title}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
            onError={(e) => {
              e.currentTarget.src = '/placeholder.png'
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ImagePreviewDialog