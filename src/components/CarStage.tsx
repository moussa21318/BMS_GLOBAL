import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import type { CarStage as CarStageType } from '../types'

const STAGES: CarStageType[] = ['deposit', 'purchase', 'parking', 'shipping_prep', 'shipping']

const STAGE_LABELS: Record<CarStageType, string> = {
  deposit: 'stages.deposit',
  purchase: 'stages.purchase',
  parking: 'stages.parking',
  shipping_prep: 'stages.shipping_prep',
  shipping: 'stages.shipping',
}

interface CarStageProps {
  currentStage: CarStageType
  evidence?: Record<string, string>
  onStageChange?: (stage: CarStageType) => void
  onUploadEvidence?: () => void
  isAdmin?: boolean
}

export function CarStage({ currentStage, evidence, onStageChange, onUploadEvidence, isAdmin }: CarStageProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isActuallyAdmin = isAdmin ?? user?.role === 'admin'

  const currentIndex = STAGES.indexOf(currentStage)

  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {STAGES.map((stage, idx) => {
          const isCompleted = idx < currentIndex
          const isCurrent = idx === currentIndex
          const isFuture = idx > currentIndex

          return (
            <div key={stage} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                disabled={!isActuallyAdmin || isCompleted}
                onClick={() => isActuallyAdmin && onStageChange?.(stage)}
                className={`relative flex flex-col items-center group ${
                  !isActuallyAdmin || isFuture ? 'cursor-default' : 'cursor-pointer'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : isCurrent
                        ? 'bg-blue-500 border-blue-500 text-white animate-pulse'
                        : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium whitespace-nowrap ${
                    isCompleted
                      ? 'text-green-600'
                      : isCurrent
                        ? 'text-blue-600'
                        : 'text-gray-400'
                  }`}
                >
                  {t(STAGE_LABELS[stage])}
                </span>
              </button>

              {idx < STAGES.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 self-center mb-6">
                  <div
                    className={`h-full transition-colors ${
                      idx < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {onUploadEvidence && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onUploadEvidence}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            {t('stages.uploadEvidence')}
          </button>
        </div>
      )}

      {evidence && Object.keys(evidence).length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {Object.entries(evidence).map(([key, url]) => (
            <div key={key} className="relative group">
              <img
                src={url}
                alt={t('stages.evidence')}
                className="w-full h-20 object-cover rounded-lg border border-gray-200"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
