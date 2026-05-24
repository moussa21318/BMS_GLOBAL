import { useState, useCallback, type FocusEvent, type ChangeEvent } from 'react'

function formatDots(val: number): string {
  return val.toLocaleString('de-DE')
}

function parseDots(str: string): number {
  const cleaned = str.replace(/\./g, '').replace(/[^0-9\-]/g, '')
  const num = parseInt(cleaned, 10)
  return isNaN(num) ? 0 : num
}

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  label?: string
  required?: boolean
  error?: string
  readOnly?: boolean
}

export function NumberInput({ value, onChange, label, required, error, readOnly }: NumberInputProps) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)

  const displayValue = focused
    ? draft ?? String(value)
    : formatDots(value)

  const handleFocus = useCallback((e: FocusEvent<HTMLInputElement>) => {
    setFocused(true)
    setDraft(String(value))
    e.target.select()
  }, [value])

  const handleBlur = useCallback(() => {
    setFocused(false)
    if (draft !== null) {
      onChange(parseDots(draft))
    }
    setDraft(null)
  }, [draft, onChange])

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value)
  }, [])

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          readOnly={readOnly}
          className={`w-full px-3 py-2 pr-12 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
            error
              ? 'border-red-400 focus:ring-red-200'
              : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
          } ${readOnly ? 'bg-gray-50 cursor-default' : 'bg-white'}`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
          KRW
        </span>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
