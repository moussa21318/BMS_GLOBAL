import { useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface ImageItem {
  id: string
  url: string
  file?: File
}

interface ImageUploadProps {
  images: ImageItem[]
  onChange: (images: ImageItem[]) => void
  maxImages?: number
}

let idCounter = 0
function nextId() {
  return `img_${Date.now()}_${++idCounter}`
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ImageUpload({ images, onChange, maxImages = 10 }: ImageUploadProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const remaining = maxImages - images.length
    const toAdd = files.slice(0, remaining)

    const newItems: ImageItem[] = []
    const newPreviews: Record<string, string> = {}

    for (const file of toAdd) {
      const id = nextId()
      const dataUrl = await readFileAsDataURL(file)
      newItems.push({ id, url: dataUrl, file })
      newPreviews[id] = dataUrl
    }

    onChange([...images, ...newItems])

    if (inputRef.current) inputRef.current.value = ''
  }, [images, maxImages, onChange])

  const handleRemove = useCallback((id: string) => {
    onChange(images.filter((img) => img.id !== id))
  }, [images, onChange])

  const moveImage = useCallback((index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= images.length) return
    const next = [...images]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }, [images, onChange])

  const atLimit = images.length >= maxImages

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">
          {images.length}/{maxImages}
        </span>
        {!atLimit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 text-sm border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            {t('imageUpload.add')}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleSelect}
        className="hidden"
      />

      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {images.map((img, idx) => (
            <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
              <img
                src={img.url}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => moveImage(idx, -1)}
                    className="p-1 bg-white/80 rounded hover:bg-white"
                    title={t('imageUpload.moveLeft')}
                  >
                    ◀
                  </button>
                )}
                {idx < images.length - 1 && (
                  <button
                    type="button"
                    onClick={() => moveImage(idx, 1)}
                    className="p-1 bg-white/80 rounded hover:bg-white"
                    title={t('imageUpload.moveRight')}
                  >
                    ▶
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(img.id)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                ✕
              </button>
              <span className="absolute bottom-1 left-1 text-xs text-white bg-black/50 px-1.5 py-0.5 rounded">
                {idx + 1}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
