import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { localDB } from '../db/local'
import { useAuth } from '../auth/AuthContext'
import { STAGE_LABELS, STAGE_ORDER } from '../types'
import type { Car, CarImage } from '../types'

const STAGE_COLORS: Record<string, string> = {
  deposit: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  purchase: 'bg-blue-100 text-blue-800 border-blue-300',
  parking: 'bg-green-100 text-green-800 border-green-300',
  shipping_prep: 'bg-purple-100 text-purple-800 border-purple-300',
  shipping: 'bg-indigo-100 text-indigo-800 border-indigo-300',
}

const ITEMS_PER_PAGE = 12

export function CarsList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAdmin } = useAuth()

  const [cars, setCars] = useState<Car[]>([])
  const [allImages, setAllImages] = useState<Map<string, CarImage>>(new Map())
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [stageFilter, setStageFilter] = useState(searchParams.get('stage') || 'all')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const allCars = await localDB.getCars()
    setCars(allCars)

    const imageMap = new Map<string, CarImage>()
    for (const car of allCars) {
      const images = await localDB.getCarImages(car.id)
      if (images.length > 0) {
        imageMap.set(car.id, images[0])
      }
    }
    setAllImages(imageMap)
    setLoading(false)
  }

  const filtered = cars.filter(car => {
    if (stageFilter !== 'all' && car.current_stage !== stageFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      car.name.toLowerCase().includes(q) ||
      (car.serial_number && car.serial_number.toLowerCase().includes(q)) ||
      (car.license_plate && car.license_plate.toLowerCase().includes(q))
    )
  })

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  function updateSearch(newSearch: string) {
    setSearch(newSearch)
    setPage(1)
    const params = new URLSearchParams(searchParams)
    if (newSearch) params.set('q', newSearch)
    else params.delete('q')
    params.delete('page')
    setSearchParams(params, { replace: true })
  }

  function updateStage(newStage: string) {
    setStageFilter(newStage)
    setPage(1)
    const params = new URLSearchParams(searchParams)
    if (newStage !== 'all') params.set('stage', newStage)
    else params.delete('stage')
    params.delete('page')
    setSearchParams(params, { replace: true })
  }

  function goPage(p: number) {
    setPage(p)
    const params = new URLSearchParams(searchParams)
    if (p > 1) params.set('page', String(p))
    else params.delete('page')
    setSearchParams(params, { replace: true })
  }

  async function handleDelete(car: Car, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(t('cars.confirm_delete') || `Delete "${car.name}"?`)) return
    await localDB.deleteCar(car.id)
    await loadData()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">{t('cars.title')}</h1>
        <button
          onClick={() => navigate('/cars/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + {t('cars.add_car')}
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={e => updateSearch(e.target.value)}
          placeholder={t('cars.search_placeholder')}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <select
          value={stageFilter}
          onChange={e => updateStage(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
        >
          <option value="all">{t('cars.all_stages')}</option>
          {STAGE_ORDER.map(stage => (
            <option key={stage} value={stage}>{t(STAGE_LABELS[stage])}</option>
          ))}
        </select>
      </div>

      {/* Cars Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t('cars.no_cars')}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginated.map(car => {
              const firstImage = allImages.get(car.id)
              return (
                <div
                  key={car.id}
                  onClick={() => navigate(`/cars/${car.id}`)}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden relative"
                >
                  {/* Pending edit indicator */}
                  {car.has_pending_edit && (
                    <div className="absolute top-2 left-2 z-10 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
                      {t('cars.pending_edit')}
                    </div>
                  )}

                  {/* Image */}
                  <div className="h-40 bg-gray-100 overflow-hidden">
                    {firstImage ? (
                      <img
                        src={firstImage.storage_path}
                        alt={car.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-800 truncate">{car.name}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STAGE_COLORS[car.current_stage] || 'bg-gray-100 text-gray-600'}`}>
                        {t(STAGE_LABELS[car.current_stage])}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{t('cars.price')}: <span className="font-medium">{car.initial_price.toLocaleString('de-DE')} KRW</span></p>
                      <p>{t('cars.seller')}: {car.seller_number}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      {car.confirmed ? (
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          {t('cars.confirmed')}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{t('cars.unconfirmed')}</span>
                      )}
                      {isAdmin && (
                        <button
                          onClick={e => handleDelete(car, e)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          {t('cars.delete')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => goPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-30 hover:bg-gray-50"
              >
                {t('common.previous')}
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => goPage(p)}
                  className={`px-3 py-1.5 text-sm border rounded-lg ${
                    p === page ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => goPage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-30 hover:bg-gray-50"
              >
                {t('common.next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
