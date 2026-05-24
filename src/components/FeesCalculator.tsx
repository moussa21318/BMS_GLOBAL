import { useTranslation } from 'react-i18next'
import { NumberInput } from './NumberInput'

interface FeesCalcProps {
  initialPrice: number
  data: {
    deposit: number
    second_payment: number
    transport_fee_1: number
    transport_fee_2: number
    other_fees: number
    file_fees: number
    shipping_fees: number
  }
  onChange: (data: any) => void
  readOnly?: boolean
}

function formatKRW(amount: number): string {
  return amount.toLocaleString('de-DE') + ' KRW'
}

export function FeesCalculator({ initialPrice, data, onChange, readOnly }: FeesCalcProps) {
  const { t } = useTranslation()

  const totalFees =
    (data.deposit || 0) +
    (data.second_payment || 0) +
    (data.transport_fee_1 || 0) +
    (data.transport_fee_2 || 0) +
    (data.other_fees || 0) +
    (data.file_fees || 0) +
    (data.shipping_fees || 0)

  const totalPrice = (initialPrice || 0) + totalFees

  const depositError = initialPrice && data.deposit + data.second_payment > initialPrice
    ? t('validation.deposit_rule', { max: formatKRW(initialPrice) })
    : undefined

  const fields = [
    { key: 'deposit', label: t('fees.deposit'), required: true },
    { key: 'second_payment', label: t('fees.second_payment'), required: true },
    { key: 'transport_fee_1', label: t('fees.transport_fee_1'), required: false },
    { key: 'transport_fee_2', label: t('fees.transport_fee_2'), required: false },
    { key: 'other_fees', label: t('fees.other_fees'), required: false },
    { key: 'file_fees', label: t('fees.file_fees'), required: false },
    { key: 'shipping_fees', label: t('fees.shipping_fees'), required: false },
  ]

  const updateField = (key: string, value: number) => {
    onChange({ ...data, [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
        <span className="text-sm font-medium text-gray-700">{t('cars.initial_price')}</span>
        <span className="font-semibold text-gray-900">{formatKRW(initialPrice)}</span>
      </div>

      {fields.map(({ key, label, required }) => (
        <NumberInput
          key={key}
          label={label}
          value={(data as any)[key] ?? 0}
          onChange={(v: number) => updateField(key, v)}
          required={required}
          error={key === 'deposit' || key === 'second_payment' ? depositError : undefined}
          readOnly={readOnly}
        />
      ))}

      <div className="border-t pt-4 mt-6 space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">{t('fees.total_fees')}</span>
          <span className="font-semibold text-gray-900">{formatKRW(totalFees)}</span>
        </div>
        <div className="flex justify-between items-center text-lg">
          <span className="font-bold text-gray-800">{t('fees.total_price')}</span>
          <span className="font-bold text-blue-600">{formatKRW(totalPrice)}</span>
        </div>
      </div>
    </div>
  )
}
