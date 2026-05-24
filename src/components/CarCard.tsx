import { useTranslation } from 'react-i18next'

const STAGE_COLORS: Record<string, string> = {
  deposit: 'bg-gray-100 text-gray-700',
  purchase: 'bg-blue-100 text-blue-700',
  parking: 'bg-yellow-100 text-yellow-700',
  shipping_prep: 'bg-orange-100 text-orange-700',
  shipping: 'bg-green-100 text-green-700',
}

function formatKRW(amount: number): string {
  return amount.toLocaleString('de-DE') + '₩'
}

export function CarCard({ car, onClick }: { car: any; onClick: () => void }) {
  const { t } = useTranslation()

  const stageColor = STAGE_COLORS[car.stage] || 'bg-gray-100 text-gray-700'
  const firstImage = car.images?.[0]

  return (
    <div
      onClick={onClick}
      className="relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
    >
      {car.pending_edit && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-yellow-400 z-10" />
      )}

      <div className="aspect-[16/10] bg-gray-100 relative overflow-hidden">
        {firstImage ? (
          <img
            src={firstImage}
            alt={car.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 truncate flex-1">{car.name}</h3>
          <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${stageColor}`}>
            {t(`stages.${car.stage}`)}
          </span>
        </div>

        <p className="text-lg font-bold text-gray-900 mb-1">
          {formatKRW(car.price)}
        </p>

        {car.seller_number && (
          <p className="text-sm text-gray-500">
            {t('car.seller')}: {car.seller_number}
          </p>
        )}

        {car.confirmed && (
          <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {t('car.confirmed')}
          </span>
        )}
      </div>
    </div>
  )
}
