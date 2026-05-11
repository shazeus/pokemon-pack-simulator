import {
  Archive,
  ChevronDown,
  Clock3,
  Flame,
  Gauge,
  GitBranch,
  Layers3,
  Loader2,
  PackageOpen,
  RotateCcw,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const API_BASE = 'https://api.tcgdex.net/v2'
const STORAGE_KEY = 'pack-forge-collection-v2'
const DEFAULT_LANGUAGE = 'en'
const DEFAULT_SET_ID = 'sv08'
const PACK_OPEN_DELAY = 980
const CARD_BATCH_SIZE = 18

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'de', label: 'DE' },
  { code: 'es', label: 'ES' },
  { code: 'it', label: 'IT' },
  { code: 'pt-br', label: 'PT-BR' },
]

const PACK_SIZES = [6, 10, 12]

type SetSummary = {
  id: string
  name: string
  logo?: string
  symbol?: string
  cardCount?: {
    total?: number
    official?: number
  }
}

type CardBrief = {
  id: string
  localId: string
  name: string
  image?: string
}

type SetDetail = SetSummary & {
  releaseDate?: string
  serie?: {
    id: string
    name: string
  }
  cards: CardBrief[]
}

type CardDetail = CardBrief & {
  category?: string
  rarity?: string
  hp?: number
  types?: string[]
  illustrator?: string
  set?: SetSummary
  variants?: {
    normal?: boolean
    reverse?: boolean
    holo?: boolean
    firstEdition?: boolean
    wPromo?: boolean
  }
  pricing?: {
    cardmarket?: {
      unit?: string
      avg?: number
      trend?: number
      ['avg-holo']?: number
    }
    tcgplayer?: {
      updated?: string
    } | null
  }
}

type PullCard = CardDetail & {
  pullId: string
  bucket: RarityBucket
  foil: boolean
}

type RarityBucket = 'common' | 'uncommon' | 'rare' | 'hit'

type CollectionCard = {
  id: string
  name: string
  localId: string
  image?: string
  rarity?: string
  setId?: string
  setName?: string
  types?: string[]
  bucket: RarityBucket
}

type CollectionEntry = {
  card: CollectionCard
  count: number
  firstPulledAt: string
  lastPulledAt: string
}

type PackHistory = {
  id: string
  setId: string
  setName: string
  openedAt: string
  size: number
  hits: CollectionCard[]
}

type PersistedState = {
  entries: Record<string, CollectionEntry>
  history: PackHistory[]
}

const emptyCollection: PersistedState = {
  entries: {},
  history: [],
}

const cardCache = new Map<string, CardDetail>()

function App() {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE)
  const [sets, setSets] = useState<SetSummary[]>([])
  const [selectedSetId, setSelectedSetId] = useState(DEFAULT_SET_ID)
  const [setSearch, setSetSearch] = useState('')
  const [selectedSet, setSelectedSet] = useState<SetDetail | null>(null)
  const [cardPool, setCardPool] = useState<CardDetail[]>([])
  const [poolProgress, setPoolProgress] = useState({ loaded: 0, total: 0 })
  const [packSize, setPackSize] = useState(10)
  const [packState, setPackState] = useState<'idle' | 'opening' | 'revealing' | 'complete'>('idle')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [openedPack, setOpenedPack] = useState<PullCard[]>([])
  const [collection, setCollection] = useState<PersistedState>(() => loadCollection())
  const [collectionQuery, setCollectionQuery] = useState('')
  const [error, setError] = useState('')
  const [isLoadingSets, setIsLoadingSets] = useState(true)
  const [isLoadingPool, setIsLoadingPool] = useState(true)
  const [showSetPicker, setShowSetPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    saveCollection(collection)
  }, [collection])

  useEffect(() => {
    let ignore = false

    async function loadSets() {
      setIsLoadingSets(true)
      setError('')
      try {
        const list = await fetchJson<SetSummary[]>(`${API_BASE}/${language}/sets`)
        if (ignore) return

        const playableSets = list
          .filter((set) => set.cardCount?.total && set.cardCount.total >= 60)
          .sort((a, b) => normalizeSetOrder(b.id) - normalizeSetOrder(a.id))

        setSets(playableSets)
        setSelectedSetId((current) =>
          playableSets.some((set) => set.id === current)
            ? current
            : playableSets.find((set) => set.id === DEFAULT_SET_ID)?.id ?? playableSets[0]?.id ?? DEFAULT_SET_ID,
        )
      } catch {
        if (!ignore) {
          setError('Set listesi yüklenemedi. TCGdex bağlantısını kontrol edip tekrar dene.')
        }
      } finally {
        if (!ignore) setIsLoadingSets(false)
      }
    }

    loadSets()
    return () => {
      ignore = true
    }
  }, [language])

  useEffect(() => {
    let ignore = false

    async function loadSetAndPool() {
      if (!selectedSetId) return

      setIsLoadingPool(true)
      setSelectedSet(null)
      setCardPool([])
      setOpenedPack([])
      setCurrentIndex(0)
      setPackState('idle')
      setPoolProgress({ loaded: 0, total: 0 })
      setError('')

      try {
        const detail = await fetchJson<SetDetail>(`${API_BASE}/${language}/sets/${selectedSetId}`)
        if (ignore) return

        setSelectedSet(detail)
        setPoolProgress({ loaded: 0, total: detail.cards.length })

        const hydrated = await hydrateCards(detail.cards, language, (loaded, total) => {
          if (!ignore) setPoolProgress({ loaded, total })
        })

        if (ignore) return
        setCardPool(hydrated.filter((card) => card.image))
      } catch {
        if (!ignore) {
          setError('Kart havuzu hazırlanamadı. Farklı bir set seçebilir veya tekrar deneyebilirsin.')
        }
      } finally {
        if (!ignore) setIsLoadingPool(false)
      }
    }

    loadSetAndPool()
    return () => {
      ignore = true
    }
  }, [language, selectedSetId])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setShowSetPicker(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const selectedSummary = useMemo(
    () => sets.find((set) => set.id === selectedSetId) ?? selectedSet,
    [selectedSet, selectedSetId, sets],
  )

  const filteredSets = useMemo(() => {
    const query = setSearch.trim().toLowerCase()
    if (!query) return sets.slice(0, 40)

    return sets
      .filter((set) => `${set.name} ${set.id}`.toLowerCase().includes(query))
      .slice(0, 40)
  }, [setSearch, sets])

  const stats = useMemo(() => {
    const entries = Object.values(collection.entries)
    const totalPulled = entries.reduce((sum, entry) => sum + entry.count, 0)
    const unique = entries.length
    const hits = entries.filter((entry) => entry.card.bucket === 'hit' || entry.card.bucket === 'rare').length
    const completionTotal = selectedSet?.cardCount?.total ?? selectedSet?.cards.length ?? 0
    const completion = selectedSet
      ? entries.filter((entry) => entry.card.setId === selectedSet.id).length
      : 0

    return {
      totalPulled,
      unique,
      hits,
      completion,
      completionTotal,
    }
  }, [collection.entries, selectedSet])

  const filteredCollection = useMemo(() => {
    const query = collectionQuery.trim().toLowerCase()
    return Object.values(collection.entries)
      .filter((entry) => {
        if (!query) return true
        return `${entry.card.name} ${entry.card.rarity ?? ''} ${entry.card.setName ?? ''}`.toLowerCase().includes(query)
      })
      .sort((a, b) => b.lastPulledAt.localeCompare(a.lastPulledAt))
      .slice(0, 24)
  }, [collection.entries, collectionQuery])

  const currentCard = openedPack[currentIndex]
  const revealedCards = openedPack.slice(0, packState === 'complete' ? openedPack.length : currentIndex + 1)
  const canOpenPack = !isLoadingPool && cardPool.length >= packSize && (packState === 'idle' || packState === 'complete')

  function openPack() {
    if (!selectedSet || !canOpenPack) return

    const nextPack = buildPack(cardPool, packSize)
    setOpenedPack(nextPack)
    setCurrentIndex(0)
    setPackState('opening')
    setCollection((current) => mergePackIntoCollection(current, selectedSet, nextPack))

    window.setTimeout(() => {
      setPackState('revealing')
    }, PACK_OPEN_DELAY)
  }

  function revealNextCard() {
    if (packState !== 'revealing') return

    if (currentIndex >= openedPack.length - 1) {
      setPackState('complete')
      return
    }

    setCurrentIndex((index) => index + 1)
  }

  function resetCollection() {
    const confirmed = window.confirm('Koleksiyonu ve paket geçmişini sıfırlamak istiyor musun?')
    if (confirmed) setCollection(emptyCollection)
  }

  return (
    <main className="app-shell">
      <section className="control-rail" aria-label="Pack controls">
        <div className="brand-block">
          <div className="brand-mark">
            <PackageOpen size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">TCGdex powered</p>
            <h1>Pack Forge</h1>
          </div>
        </div>

        <div className="control-panel">
          <label className="field-label" htmlFor="language">
            Dil
          </label>
          <div className="language-grid">
            {LANGUAGES.map((item) => (
              <button
                className={item.code === language ? 'chip is-active' : 'chip'}
                key={item.code}
                type="button"
                onClick={() => setLanguage(item.code)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-panel set-picker" ref={pickerRef}>
          <label className="field-label" htmlFor="set-search">
            Set
          </label>
          <button className="select-trigger" type="button" onClick={() => setShowSetPicker((visible) => !visible)}>
            <span>
              <strong>{isLoadingSets ? 'Setler yükleniyor' : selectedSummary?.name ?? 'Set seçiliyor'}</strong>
              <small>{selectedSummary?.id.toUpperCase() ?? 'TCGdex'}</small>
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>

          {showSetPicker && (
            <div className="set-popover">
              <div className="search-box">
                <Search size={16} aria-hidden="true" />
                <input
                  id="set-search"
                  type="search"
                  value={setSearch}
                  placeholder="Set adı veya id ara"
                  onChange={(event) => setSetSearch(event.target.value)}
                />
              </div>
              <div className="set-list">
                {filteredSets.map((set) => (
                  <button
                    className={set.id === selectedSetId ? 'set-option is-active' : 'set-option'}
                    key={set.id}
                    type="button"
                    onClick={() => {
                      setSelectedSetId(set.id)
                      setShowSetPicker(false)
                      setSetSearch('')
                    }}
                  >
                    {set.symbol && <img src={assetUrl(set.symbol, 'symbol')} alt="" />}
                    <span>
                      <strong>{set.name}</strong>
                      <small>
                        {set.id.toUpperCase()} / {set.cardCount?.total ?? '?'} kart
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="control-panel">
          <label className="field-label">Paket boyutu</label>
          <div className="segmented">
            {PACK_SIZES.map((size) => (
              <button
                className={size === packSize ? 'segment is-active' : 'segment'}
                key={size}
                type="button"
                onClick={() => setPackSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="status-card">
          <div className="status-row">
            <Layers3 size={18} aria-hidden="true" />
            <span>{selectedSet?.cards.length ?? selectedSummary?.cardCount?.total ?? 0} kartlık havuz</span>
          </div>
          <div className="status-row">
            <Gauge size={18} aria-hidden="true" />
            <span>
              {isLoadingPool ? `${poolProgress.loaded}/${poolProgress.total || '...'}` : 'Hazır'}
            </span>
          </div>
        </div>
      </section>

      <section className="pack-stage" aria-label="Pack opening simulator">
        <div className="stage-topbar">
          <div>
            <p className="eyebrow">Paket açma simülatörü</p>
            <h2>{selectedSet?.name ?? selectedSummary?.name ?? 'Kart seti yükleniyor'}</h2>
          </div>
          <a className="source-link" href="https://tcgdex.dev/" target="_blank" rel="noreferrer">
            TCGdex API
          </a>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        <div className={`opening-arena ${packState}`}>
          <div className="pack-display">
            <div className={`booster-pack ${packState}`}>
              <div className="pack-crimp top" />
              <div className="pack-art">
                {selectedSet?.logo ? (
                  <img src={assetUrl(selectedSet.logo, 'logo')} alt="" />
                ) : (
                  <Sparkles size={44} aria-hidden="true" />
                )}
                <span>{selectedSet?.serie?.name ?? 'Pokemon TCG'}</span>
              </div>
              <div className="pack-crimp bottom" />
            </div>
            <button className="primary-action" type="button" disabled={!canOpenPack} onClick={openPack}>
              {isLoadingPool ? (
                <>
                  <Loader2 className="spin" size={18} aria-hidden="true" />
                  Kart havuzu hazırlanıyor
                </>
              ) : (
                <>
                  <Flame size={18} aria-hidden="true" />
                  Paketi aç
                </>
              )}
            </button>
          </div>

          <div className="card-reveal-zone">
            {packState === 'idle' && (
              <div className="idle-panel">
                <Sparkles size={32} aria-hidden="true" />
                <h3>Set seç, paketi aç, kartları tek tek çek.</h3>
                <p>Her açılış koleksiyona kaydedilir ve hit kartlar ayrıca takip edilir.</p>
              </div>
            )}

            {packState === 'opening' && (
              <div className="opening-copy">
                <Loader2 className="spin" size={28} aria-hidden="true" />
                <h3>Paket açılıyor</h3>
              </div>
            )}

            {(packState === 'revealing' || packState === 'complete') && currentCard && (
              <div className="reveal-layout">
                <div className={`spotlight-card ${currentCard.bucket} ${currentCard.foil ? 'foil' : ''}`} key={currentCard.pullId}>
                  <div className="card-frame">
                    <img src={cardImageUrl(currentCard.image, 'high')} alt={currentCard.name} />
                    <div className="shine" />
                  </div>
                  <div className="card-caption">
                    <span>{currentCard.localId}</span>
                    <strong>{currentCard.name}</strong>
                    <em>{currentCard.rarity ?? 'Bilinmeyen nadirlik'}</em>
                  </div>
                </div>

                <div className="reveal-actions">
                  <div className="progress-pips" aria-label={`${revealedCards.length} of ${openedPack.length} cards revealed`}>
                    {openedPack.map((card, index) => (
                      <span
                        className={index <= currentIndex || packState === 'complete' ? `pip ${card.bucket} is-lit` : 'pip'}
                        key={card.pullId}
                      />
                    ))}
                  </div>
                  {packState === 'revealing' ? (
                    <button className="draw-button" type="button" onClick={revealNextCard}>
                      <PackageOpen size={18} aria-hidden="true" />
                      {currentIndex === openedPack.length - 1 ? 'Paketi bitir' : 'Sıradaki kartı çek'}
                    </button>
                  ) : (
                    <button className="draw-button" type="button" onClick={openPack} disabled={!canOpenPack}>
                      <RotateCcw size={18} aria-hidden="true" />
                      Yeni paket aç
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {openedPack.length > 0 && (
          <div className="pack-strip" aria-label="Opened pack cards">
            {openedPack.map((card, index) => (
              <article
                className={index <= currentIndex || packState === 'complete' ? `mini-card ${card.bucket} is-visible` : 'mini-card'}
                key={card.pullId}
              >
                <img src={cardImageUrl(card.image, 'low')} alt={card.name} />
                <span>{index <= currentIndex || packState === 'complete' ? card.name : 'Hidden'}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="collection-rail" aria-label="Collection">
        <div className="metric-grid">
          <Metric icon={<Archive size={18} />} label="Toplam" value={stats.totalPulled.toLocaleString()} />
          <Metric icon={<Trophy size={18} />} label="Tekil" value={stats.unique.toLocaleString()} />
          <Metric icon={<Sparkles size={18} />} label="Hit" value={stats.hits.toLocaleString()} />
          <Metric
            icon={<Layers3 size={18} />}
            label="Set"
            value={`${stats.completion}/${stats.completionTotal || 0}`}
          />
        </div>

        <section className="history-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Son açılışlar</p>
              <h3>Paket geçmişi</h3>
            </div>
            <Clock3 size={18} aria-hidden="true" />
          </div>
          <div className="history-list">
            {collection.history.length === 0 ? (
              <p className="empty-copy">Henüz paket açılmadı.</p>
            ) : (
              collection.history.slice(0, 4).map((pack) => (
                <article className="history-item" key={pack.id}>
                  <span>{pack.setName}</span>
                  <strong>{pack.hits.length ? pack.hits.map((card) => card.name).join(', ') : 'Hit yok'}</strong>
                  <small>{new Date(pack.openedAt).toLocaleString()}</small>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="collection-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Binder</p>
              <h3>Koleksiyon</h3>
            </div>
            <button className="icon-button" type="button" onClick={resetCollection} aria-label="Koleksiyonu sıfırla">
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="search-box compact">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={collectionQuery}
              placeholder="Kart ara"
              onChange={(event) => setCollectionQuery(event.target.value)}
            />
          </div>
          <div className="collection-list">
            {filteredCollection.length === 0 ? (
              <p className="empty-copy">Açtığın kartlar burada görünecek.</p>
            ) : (
              filteredCollection.map((entry) => (
                <article className={`binder-card ${entry.card.bucket}`} key={entry.card.id}>
                  <img src={cardImageUrl(entry.card.image, 'low')} alt={entry.card.name} />
                  <span>
                    <strong>{entry.card.name}</strong>
                    <small>{entry.card.rarity ?? 'Bilinmeyen'} / x{entry.count}</small>
                  </span>
                </article>
              ))
            )}
          </div>
        </section>

        <a className="github-card" href="https://github.com/" target="_blank" rel="noreferrer">
          <GitBranch size={18} aria-hidden="true" />
          <span>GitHub Pages için hazır statik build</span>
        </a>
      </aside>
    </main>
  )
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="metric-card">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.json() as Promise<T>
}

async function hydrateCards(
  cards: CardBrief[],
  language: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<CardDetail[]> {
  const details: CardDetail[] = []
  let loaded = 0

  for (let index = 0; index < cards.length; index += CARD_BATCH_SIZE) {
    const batch = cards.slice(index, index + CARD_BATCH_SIZE)
    const result = await Promise.all(
      batch.map(async (brief) => {
        const cacheKey = `${language}:${brief.id}`
        const cached = cardCache.get(cacheKey)
        if (cached) return cached

        try {
          const detail = await fetchJson<CardDetail>(`${API_BASE}/${language}/cards/${brief.id}`)
          const merged = { ...brief, ...detail }
          cardCache.set(cacheKey, merged)
          return merged
        } catch {
          return brief
        }
      }),
    )

    details.push(...result)
    loaded += batch.length
    onProgress(loaded, cards.length)
  }

  return details
}

function buildPack(pool: CardDetail[], size: number): PullCard[] {
  const buckets = {
    common: pool.filter((card) => bucketForRarity(card.rarity) === 'common'),
    uncommon: pool.filter((card) => bucketForRarity(card.rarity) === 'uncommon'),
    rare: pool.filter((card) => bucketForRarity(card.rarity) === 'rare'),
    hit: pool.filter((card) => bucketForRarity(card.rarity) === 'hit'),
  }

  const commonCount = Math.max(2, Math.floor(size * 0.52))
  const uncommonCount = Math.max(2, Math.floor(size * 0.28))
  const hitCount = Math.max(1, size - commonCount - uncommonCount)
  const pack: CardDetail[] = []

  pack.push(...drawFromBucket(buckets.common.length ? buckets.common : pool, commonCount))
  pack.push(...drawFromBucket(buckets.uncommon.length ? buckets.uncommon : pool, uncommonCount))

  for (let index = 0; index < hitCount; index += 1) {
    const hitPool = Math.random() > 0.72 && buckets.hit.length ? buckets.hit : buckets.rare.length ? buckets.rare : buckets.hit
    pack.push(...drawFromBucket(hitPool.length ? hitPool : pool, 1))
  }

  return shuffle(pack)
    .slice(0, size)
    .map((card, index) => {
      const bucket = bucketForRarity(card.rarity)
      return {
        ...card,
        pullId: `${card.id}-${Date.now()}-${index}`,
        bucket,
        foil: bucket === 'hit' || bucket === 'rare' || Boolean(card.variants?.holo) || Math.random() > 0.82,
      }
    })
}

function drawFromBucket(bucket: CardDetail[], count: number) {
  return shuffle(bucket).slice(0, count)
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

function bucketForRarity(rarity = ''): RarityBucket {
  const value = rarity.toLowerCase()
  if (value.includes('secret') || value.includes('ultra') || value.includes('rare holo') || value.includes('double rare')) {
    return 'hit'
  }
  if (value.includes('rare') || value.includes('promo') || value.includes('legend')) {
    return 'rare'
  }
  if (value.includes('uncommon')) {
    return 'uncommon'
  }
  return 'common'
}

function mergePackIntoCollection(current: PersistedState, set: SetDetail, pack: PullCard[]): PersistedState {
  const openedAt = new Date().toISOString()
  const entries = { ...current.entries }

  for (const card of pack) {
    const existing = entries[card.id]
    const storedCard: CollectionCard = {
      id: card.id,
      name: card.name,
      localId: card.localId,
      image: card.image,
      rarity: card.rarity,
      setId: card.set?.id ?? set.id,
      setName: card.set?.name ?? set.name,
      types: card.types,
      bucket: card.bucket,
    }

    entries[card.id] = existing
      ? {
          ...existing,
          count: existing.count + 1,
          lastPulledAt: openedAt,
        }
      : {
          card: storedCard,
          count: 1,
          firstPulledAt: openedAt,
          lastPulledAt: openedAt,
        }
  }

  const hits = pack
    .filter((card) => card.bucket === 'hit' || card.bucket === 'rare')
    .map((card) => ({
      id: card.id,
      name: card.name,
      localId: card.localId,
      image: card.image,
      rarity: card.rarity,
      setId: card.set?.id ?? set.id,
      setName: card.set?.name ?? set.name,
      types: card.types,
      bucket: card.bucket,
    }))

  const history = [
    {
      id: `${set.id}-${openedAt}`,
      setId: set.id,
      setName: set.name,
      openedAt,
      size: pack.length,
      hits,
    },
    ...current.history,
  ].slice(0, 20)

  return { entries, history }
}

function loadCollection(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyCollection

    const parsed = JSON.parse(raw) as PersistedState
    return {
      entries: parsed.entries ?? {},
      history: parsed.history ?? [],
    }
  } catch {
    return emptyCollection
  }
}

function saveCollection(collection: PersistedState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collection))
}

function cardImageUrl(image?: string, quality: 'low' | 'high' = 'low') {
  if (!image) return ''
  return `${image}/${quality}.webp`
}

function assetUrl(image: string, type: 'logo' | 'symbol') {
  if (image.endsWith('.webp') || image.endsWith('.png') || image.endsWith('.jpg')) return image
  return type === 'logo' || type === 'symbol' ? `${image}.webp` : image
}

function normalizeSetOrder(id: string) {
  const digits = id.match(/\d+/g)?.join('') ?? '0'
  const family = id.replace(/\d|\./g, '')
  const familyWeight = family.startsWith('me') ? 5000 : family.startsWith('sv') ? 4000 : family.startsWith('swsh') ? 3000 : 0
  return familyWeight + Number(digits)
}

export default App
