import {
  Archive,
  ChevronDown,
  Clock3,
  Crown,
  Eye,
  Flame,
  Gauge,
  Gem,
  GitBranch,
  KeyRound,
  Layers3,
  Loader2,
  LogOut,
  Mail,
  PackageOpen,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const API_BASE = 'https://api.tcgdex.net/v2'
const STORAGE_KEY = 'pack-forge-collection-v2'
const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true'
const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL ?? 'http://localhost:8787/api'
const AUTH_TOKEN_KEY = 'pack-forge-auth-token-v1'
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

type AuthUser = {
  id: string
  name: string
  email: string
  createdAt: string
}

type AuthMode = 'login' | 'register'

type AuthResponse = {
  token: string
  user: AuthUser
}

type InspectableCard = Partial<CardDetail> &
  Partial<CollectionCard> & {
    count?: number
    bucket?: RarityBucket
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
  const [authToken, setAuthToken] = useState(() => (AUTH_ENABLED ? loadAuthToken() : ''))
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [authMessage, setAuthMessage] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [error, setError] = useState('')
  const [isLoadingSets, setIsLoadingSets] = useState(true)
  const [isLoadingPool, setIsLoadingPool] = useState(true)
  const [showSetPicker, setShowSetPicker] = useState(false)
  const [celebrationCard, setCelebrationCard] = useState<PullCard | null>(null)
  const [inspectedCard, setInspectedCard] = useState<InspectableCard | null>(null)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const celebrationTimerRef = useRef<number | null>(null)

  useEffect(() => {
    saveCollection(collection)
  }, [collection])

  useEffect(() => {
    if (!AUTH_ENABLED || !authToken) {
      return
    }

    let ignore = false

    async function loadSession() {
      try {
        const result = await authRequest<{ user: AuthUser }>('/auth/me', { token: authToken })
        if (!ignore) setAuthUser(result.user)
      } catch {
        if (!ignore) {
          clearAuthToken()
          setAuthToken('')
          setAuthUser(null)
        }
      }
    }

    loadSession()
    return () => {
      ignore = true
    }
  }, [authToken])

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
          setError('Set data could not be loaded. Check the TCGdex connection and try again.')
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
          setError('The card pool could not be prepared. Select another set or try again.')
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
  const stageClassName = [
    'opening-arena',
    packState,
    currentCard?.bucket ?? '',
    celebrationCard ? 'is-celebrating' : '',
  ]
    .filter(Boolean)
    .join(' ')

  function openPack() {
    if (!selectedSet || !canOpenPack) return

    const nextPack = buildPack(cardPool, packSize)
    setCelebrationCard(null)
    setOpenedPack(nextPack)
    setCurrentIndex(0)
    setPackState('opening')
    setCollection((current) => mergePackIntoCollection(current, selectedSet, nextPack))

    window.setTimeout(() => {
      setPackState('revealing')
      triggerPremiumEvent(nextPack[0])
    }, PACK_OPEN_DELAY)
  }

  function revealNextCard() {
    if (packState !== 'revealing') return

    if (currentIndex >= openedPack.length - 1) {
      setPackState('complete')
      return
    }

    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    triggerPremiumEvent(openedPack[nextIndex])
  }

  function triggerPremiumEvent(card?: PullCard) {
    if (!card || !isPremiumPull(card.bucket)) return

    if (celebrationTimerRef.current) {
      window.clearTimeout(celebrationTimerRef.current)
    }

    setCelebrationCard(card)
    celebrationTimerRef.current = window.setTimeout(() => {
      setCelebrationCard(null)
      celebrationTimerRef.current = null
    }, card.bucket === 'hit' ? 2600 : 1900)
  }

  function resetCollection() {
    const confirmed = window.confirm('Reset the binder and pack history?')
    if (confirmed) setCollection(emptyCollection)
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsAuthLoading(true)
    setAuthMessage('')

    try {
      const body =
        authMode === 'register'
          ? { name: authForm.name, email: authForm.email, password: authForm.password }
          : { email: authForm.email, password: authForm.password }
      const result = await authRequest<AuthResponse>(`/auth/${authMode}`, {
        method: 'POST',
        body,
      })

      saveAuthToken(result.token)
      setAuthToken(result.token)
      setAuthUser(result.user)
      setAuthForm({ name: '', email: '', password: '' })
    } catch (caught) {
      setAuthMessage(caught instanceof Error ? caught.message : 'Authentication request failed.')
    } finally {
      setIsAuthLoading(false)
    }
  }

  function signOut() {
    clearAuthToken()
    setAuthToken('')
    setAuthUser(null)
    setAuthMessage('')
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
            <span className="brand-subtitle">Booster Console</span>
          </div>
        </div>

        <div className="control-panel">
          <label className="field-label" htmlFor="language">
            Language
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
            Active Set
          </label>
          <button className="select-trigger" type="button" onClick={() => setShowSetPicker((visible) => !visible)}>
            <span>
              <strong>{isLoadingSets ? 'Loading sets' : selectedSummary?.name ?? 'Select a set'}</strong>
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
                  placeholder="Search set or id"
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
                        {set.id.toUpperCase()} / {set.cardCount?.total ?? '?'} cards
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="control-panel">
          <label className="field-label">Pack Size</label>
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
            <span>{selectedSet?.cards.length ?? selectedSummary?.cardCount?.total ?? 0} cards indexed</span>
          </div>
          <div className="status-row">
            <Gauge size={18} aria-hidden="true" />
            <span>
              {isLoadingPool ? `${poolProgress.loaded}/${poolProgress.total || '...'}` : 'Ready'}
            </span>
          </div>
        </div>

        {AUTH_ENABLED && (
          <section className="auth-panel" aria-label="Account">
            <div className="auth-heading">
              <div>
                <p className="eyebrow">Account</p>
                <h3>{authUser ? authUser.name : 'Login / Register'}</h3>
              </div>
              <ShieldCheck size={18} aria-hidden="true" />
            </div>

            {authUser ? (
              <div className="session-card">
                <span>{authUser.email}</span>
                <button className="auth-submit secondary" type="button" onClick={signOut}>
                  <LogOut size={16} aria-hidden="true" />
                  Sign out
                </button>
              </div>
            ) : (
              <>
                <div className="auth-tabs">
                  <button
                    className={authMode === 'login' ? 'auth-tab is-active' : 'auth-tab'}
                    type="button"
                    onClick={() => setAuthMode('login')}
                  >
                    Login
                  </button>
                  <button
                    className={authMode === 'register' ? 'auth-tab is-active' : 'auth-tab'}
                    type="button"
                    onClick={() => setAuthMode('register')}
                  >
                    Register
                  </button>
                </div>

                <form className="auth-form" onSubmit={submitAuth}>
                  {authMode === 'register' && (
                    <label className="auth-field">
                      <UserRound size={16} aria-hidden="true" />
                      <input
                        type="text"
                        value={authForm.name}
                        placeholder="Name"
                        minLength={2}
                        maxLength={40}
                        required
                        onChange={(event) => setAuthForm((form) => ({ ...form, name: event.target.value }))}
                      />
                    </label>
                  )}
                  <label className="auth-field">
                    <Mail size={16} aria-hidden="true" />
                    <input
                      type="email"
                      value={authForm.email}
                      placeholder="Email"
                      required
                      onChange={(event) => setAuthForm((form) => ({ ...form, email: event.target.value }))}
                    />
                  </label>
                  <label className="auth-field">
                    <KeyRound size={16} aria-hidden="true" />
                    <input
                      type="password"
                      value={authForm.password}
                      placeholder="Password"
                      minLength={8}
                      maxLength={128}
                      required
                      onChange={(event) => setAuthForm((form) => ({ ...form, password: event.target.value }))}
                    />
                  </label>
                  <button className="auth-submit" type="submit" disabled={isAuthLoading}>
                    {isAuthLoading && <Loader2 className="spin" size={16} aria-hidden="true" />}
                    {authMode === 'register' ? 'Create account' : 'Sign in'}
                  </button>
                </form>
                {authMessage && <p className="auth-message">{authMessage}</p>}
              </>
            )}
          </section>
        )}

        <a className="author-card" href="https://github.com/shazeus" target="_blank" rel="noreferrer">
          <img src="https://github.com/shazeus.png" alt="shazeus" />
          <span>
            <small>Made by</small>
            <strong>shazeus</strong>
          </span>
          <GitBranch size={16} aria-hidden="true" />
        </a>
      </section>

      <section className="pack-stage" aria-label="Pack opening simulator">
        <div className="stage-topbar">
          <div>
            <p className="eyebrow">Pack Opening Simulator</p>
            <h2>{selectedSet?.name ?? selectedSummary?.name ?? 'Loading card set'}</h2>
            <div className="stage-meta">
              {selectedSet?.symbol && <img src={assetUrl(selectedSet.symbol, 'symbol')} alt="" />}
              <span>{selectedSet?.serie?.name ?? 'Pokemon TCG'}</span>
              <span>{selectedSet?.cardCount?.total ?? selectedSummary?.cardCount?.total ?? 0} cards</span>
              {selectedSet?.releaseDate && <span>{selectedSet.releaseDate}</span>}
            </div>
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

        {celebrationCard && (
          <div className={`hit-event ${celebrationCard.bucket}`} aria-live="polite">
            <div className="hit-burst">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="hit-event-card">
              {celebrationCard.bucket === 'hit' ? <Crown size={20} aria-hidden="true" /> : <Gem size={20} aria-hidden="true" />}
              <span>{celebrationCard.bucket === 'hit' ? 'CHASE HIT' : 'RARE PULL'}</span>
              <strong>{celebrationCard.name}</strong>
            </div>
          </div>
        )}

        <div className={stageClassName}>
          <div className="stage-streaks" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="pack-display">
            <div className="pack-plinth">
              <div className={`booster-pack ${packState}`}>
                <div className="tear-line" />
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
            </div>
            <button className="primary-action" type="button" disabled={!canOpenPack} onClick={openPack}>
              {isLoadingPool ? (
                <>
                  <Loader2 className="spin" size={18} aria-hidden="true" />
                  Preparing pool
                </>
              ) : (
                <>
                  <Flame size={18} aria-hidden="true" />
                  Open Pack
                </>
              )}
            </button>
          </div>

          <div className="card-reveal-zone">
            {packState === 'idle' && (
              <div className="idle-panel">
                {selectedSet?.symbol ? <img src={assetUrl(selectedSet.symbol, 'symbol')} alt="" /> : <Sparkles size={32} aria-hidden="true" />}
                <h3>Pack sealed</h3>
                <p>{selectedSet?.name ?? selectedSummary?.name ?? 'Selected set'}</p>
              </div>
            )}

            {packState === 'opening' && (
              <div className="opening-copy">
                <Loader2 className="spin" size={28} aria-hidden="true" />
                <h3>Breaking foil</h3>
              </div>
            )}

            {(packState === 'revealing' || packState === 'complete') && currentCard && (
              <div className="reveal-layout">
                <button
                  className={`spotlight-card ${currentCard.bucket} ${currentCard.foil ? 'foil' : ''}`}
                  key={currentCard.pullId}
                  type="button"
                  onClick={() => setInspectedCard(currentCard)}
                  aria-label={`Inspect ${currentCard.name}`}
                >
                  <div className="card-frame">
                    <img src={cardImageUrl(currentCard.image, 'high')} alt={currentCard.name} />
                    <div className="shine" />
                    <div className="scanline" />
                  </div>
                  <div className="card-caption">
                    <span>{currentCard.localId}</span>
                    <strong>{currentCard.name}</strong>
                    <em>{currentCard.rarity ?? 'Unknown rarity'}</em>
                  </div>
                  <div className="inspect-hint">
                    <Eye size={14} aria-hidden="true" />
                    Inspect card
                  </div>
                </button>

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
                      {currentIndex === openedPack.length - 1 ? 'Finish Pack' : 'Draw Next'}
                    </button>
                  ) : (
                    <button className="draw-button" type="button" onClick={openPack} disabled={!canOpenPack}>
                      <RotateCcw size={18} aria-hidden="true" />
                      New Pack
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
              <button
                className={index <= currentIndex || packState === 'complete' ? `mini-card ${card.bucket} is-visible` : 'mini-card'}
                key={card.pullId}
                type="button"
                disabled={index > currentIndex && packState !== 'complete'}
                onClick={() => setInspectedCard(card)}
              >
                <img src={cardImageUrl(card.image, 'low')} alt={card.name} />
                <span>{index <= currentIndex || packState === 'complete' ? card.name : 'Sealed'}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="collection-rail" aria-label="Collection">
        <div className="metric-grid">
          <Metric icon={<Archive size={18} />} label="Pulled" value={stats.totalPulled.toLocaleString()} />
          <Metric icon={<Trophy size={18} />} label="Unique" value={stats.unique.toLocaleString()} />
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
              <p className="eyebrow">Recent pulls</p>
              <h3>Pack History</h3>
            </div>
            <Clock3 size={18} aria-hidden="true" />
          </div>
          <div className="history-list">
            {collection.history.length === 0 ? (
              <p className="empty-copy">No packs opened yet.</p>
            ) : (
              collection.history.slice(0, 4).map((pack) => (
                <article className="history-item" key={pack.id}>
                  <span>{pack.setName}</span>
                  <strong>{pack.hits.length ? pack.hits.map((card) => card.name).join(', ') : 'No hit'}</strong>
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
              <h3>Collection</h3>
            </div>
            <button className="icon-button" type="button" onClick={resetCollection} aria-label="Reset collection">
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="search-box compact">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={collectionQuery}
              placeholder="Search cards"
              onChange={(event) => setCollectionQuery(event.target.value)}
            />
          </div>
          <div className="collection-list">
            {filteredCollection.length === 0 ? (
              <p className="empty-copy">Pulled cards appear here.</p>
            ) : (
              filteredCollection.map((entry) => (
                <button
                  className={`binder-card ${entry.card.bucket}`}
                  key={entry.card.id}
                  type="button"
                  onClick={() => setInspectedCard({ ...entry.card, count: entry.count })}
                >
                  <img src={cardImageUrl(entry.card.image, 'low')} alt={entry.card.name} />
                  <span>
                    <strong>{entry.card.name}</strong>
                    <small>{entry.card.rarity ?? 'Unknown'} / x{entry.count}</small>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <a className="github-card" href="https://github.com/" target="_blank" rel="noreferrer">
          <GitBranch size={18} aria-hidden="true" />
          <span>Static build published on GitHub Pages</span>
        </a>
      </aside>

      {inspectedCard && (
        <div className="inspection-backdrop" role="dialog" aria-modal="true" aria-label={`${inspectedCard.name} details`}>
          <button className="inspection-scrim" type="button" aria-label="Close card details" onClick={() => setInspectedCard(null)} />
          <section className={`inspection-panel ${inspectedCard.bucket ?? 'common'}`}>
            <button className="close-button" type="button" onClick={() => setInspectedCard(null)} aria-label="Close card details">
              <X size={18} aria-hidden="true" />
            </button>
            <div className="inspection-media">
              <img src={cardImageUrl(inspectedCard.image, 'high')} alt={inspectedCard.name} />
            </div>
            <div className="inspection-copy">
              <p className="eyebrow">Card inspection</p>
              <h3>{inspectedCard.name}</h3>
              <div className="inspection-tags">
                <span>{inspectedCard.localId ?? 'No ID'}</span>
                <span>{inspectedCard.rarity ?? 'Unknown rarity'}</span>
                {inspectedCard.count && <span>x{inspectedCard.count}</span>}
              </div>
              <dl className="inspection-stats">
                <div>
                  <dt>Set</dt>
                  <dd>{inspectedCard.set?.name ?? inspectedCard.setName ?? selectedSet?.name ?? 'Unknown'}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{inspectedCard.types?.join(', ') ?? inspectedCard.category ?? 'Unknown'}</dd>
                </div>
                <div>
                  <dt>HP</dt>
                  <dd>{inspectedCard.hp ?? 'N/A'}</dd>
                </div>
                <div>
                  <dt>Illustrator</dt>
                  <dd>{inspectedCard.illustrator ?? 'N/A'}</dd>
                </div>
              </dl>
              {isPremiumPull(inspectedCard.bucket) && (
                <div className="inspection-callout">
                  <Zap size={16} aria-hidden="true" />
                  Premium pull animation was triggered for this card.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
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

function isPremiumPull(bucket?: RarityBucket) {
  return bucket === 'rare' || bucket === 'hit'
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

function loadAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? ''
}

function saveAuthToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
}

function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
}

async function authRequest<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    token?: string
  } = {},
): Promise<T> {
  const response = await fetch(`${AUTH_API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }

  if (!response.ok) {
    throw new Error(payload.error ?? 'Auth isteği başarısız.')
  }

  return payload as T
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
