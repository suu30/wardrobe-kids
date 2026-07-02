import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'wardrobe-kids-v1'

const CATEGORIES = ['トップス', 'ボトムス', 'アウター', 'ワンピース', '肌着・パジャマ', 'くつ', '小物']
const SEASONS = ['オールシーズン', '春夏', '秋冬']
const STATUSES = {
  active: { label: '使用中', cls: 'st-active' },
  sizeout: { label: 'サイズアウト', cls: 'st-sizeout' },
  handmedown: { label: 'お下がり待ち', cls: 'st-handme' },
}

const DEFAULT_DATA = {
  kids: [
    { id: 'k1', name: 'うえの子', size: '120' },
    { id: 'k2', name: 'したの子', size: '95' },
  ],
  items: [],
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DATA
    const parsed = JSON.parse(raw)
    if (!parsed.kids || !parsed.items) return DEFAULT_DATA
    return parsed
  } catch {
    return DEFAULT_DATA
  }
}

const uid = () => Math.random().toString(36).slice(2, 9)

export default function App() {
  const [data, setData] = useState(load)
  const [activeKid, setActiveKid] = useState(data.kids[0]?.id)
  const [catFilter, setCatFilter] = useState('すべて')
  const [statusFilter, setStatusFilter] = useState('すべて')
  const [showForm, setShowForm] = useState(false)
  const [editingKid, setEditingKid] = useState(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const kid = data.kids.find((k) => k.id === activeKid) || data.kids[0]

  const kidItems = useMemo(
    () => data.items.filter((it) => it.kidId === kid?.id),
    [data.items, kid],
  )

  const visibleItems = useMemo(() => {
    return kidItems.filter((it) => {
      if (catFilter !== 'すべて' && it.category !== catFilter) return false
      if (statusFilter !== 'すべて' && it.status !== statusFilter) return false
      return true
    })
  }, [kidItems, catFilter, statusFilter])

  const stats = useMemo(() => {
    const active = kidItems.filter((i) => i.status === 'active')
    const byCat = {}
    active.forEach((i) => {
      byCat[i.category] = (byCat[i.category] || 0) + 1
    })
    return {
      total: active.length,
      sizeout: kidItems.filter((i) => i.status === 'sizeout').length,
      handme: kidItems.filter((i) => i.status === 'handmedown').length,
      byCat,
    }
  }, [kidItems])

  function addItem(item) {
    setData((d) => ({ ...d, items: [{ ...item, id: uid(), kidId: kid.id, addedAt: Date.now() }, ...d.items] }))
    setShowForm(false)
  }

  function updateItem(id, patch) {
    setData((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }))
  }

  function removeItem(id) {
    if (!confirm('このアイテムを削除しますか？')) return
    setData((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }))
  }

  function passDown(id) {
    const other = data.kids.find((k) => k.id !== kid.id)
    if (!other) return
    updateItem(id, { kidId: other.id, status: 'active' })
  }

  function saveKid(kidId, patch) {
    setData((d) => ({
      ...d,
      kids: d.kids.map((k) => (k.id === kidId ? { ...k, ...patch } : k)),
    }))
    setEditingKid(null)
  }

  return (
    <div className="app">
      <header className="masthead">
        <p className="eyebrow">KIDS WARDROBE LEDGER</p>
        <h1>こどもクローゼット</h1>
      </header>

      {/* 名札タブ */}
      <nav className="nametags" aria-label="子どもの切り替え">
        {data.kids.map((k) => (
          <button
            key={k.id}
            className={`nametag ${k.id === kid?.id ? 'is-active' : ''}`}
            onClick={() => setActiveKid(k.id)}
          >
            <span className="nametag-pin" aria-hidden="true" />
            <span className="nametag-name">{k.name}</span>
            <span className="nametag-size">サイズ {k.size}</span>
          </button>
        ))}
      </nav>

      <section className="kidbar">
        {editingKid === kid.id ? (
          <KidEditor kid={kid} onSave={(patch) => saveKid(kid.id, patch)} onCancel={() => setEditingKid(null)} />
        ) : (
          <>
            <div className="kidbar-stats">
              <span><b>{stats.total}</b> 着 使用中</span>
              {stats.sizeout > 0 && <span className="warn"><b>{stats.sizeout}</b> 着 サイズアウト</span>}
              {stats.handme > 0 && <span className="handme"><b>{stats.handme}</b> 着 お下がり待ち</span>}
            </div>
            <button className="ghost" onClick={() => setEditingKid(kid.id)}>名前・サイズを変更</button>
          </>
        )}
      </section>

      {/* カテゴリ内訳 */}
      {stats.total > 0 && (
        <section className="catbreakdown">
          {CATEGORIES.filter((c) => stats.byCat[c]).map((c) => (
            <span key={c} className="catchip">
              {c} <b>{stats.byCat[c]}</b>
            </span>
          ))}
        </section>
      )}

      {/* フィルタ */}
      <section className="filters">
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="カテゴリで絞り込み">
          <option>すべて</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="状態で絞り込み">
          <option value="すべて">すべての状態</option>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="primary" onClick={() => setShowForm(true)}>＋ 服を登録</button>
      </section>

      {showForm && <ItemForm defaultSize={kid.size} onSubmit={addItem} onCancel={() => setShowForm(false)} />}

      {/* アイテム一覧 */}
      <main className="items">
        {visibleItems.length === 0 && (
          <div className="empty">
            <p>{kidItems.length === 0 ? `${kid.name}の服を登録して、クローゼットの台帳をつくりましょう。` : '条件に合う服がありません。フィルタを変えてみてください。'}</p>
          </div>
        )}
        {visibleItems.map((it) => (
          <article key={it.id} className={`item ${it.status !== 'active' ? 'is-muted' : ''}`}>
            <div className="item-tag">
              <span className="item-size">{it.size}</span>
            </div>
            <div className="item-body">
              <div className="item-head">
                <h2>{it.name}</h2>
                <span className={`status ${STATUSES[it.status].cls}`}>{STATUSES[it.status].label}</span>
              </div>
              <p className="item-meta">{it.category} ・ {it.season}{it.memo ? ` ・ ${it.memo}` : ''}</p>
              <div className="item-actions">
                {it.status === 'active' && (
                  <button onClick={() => updateItem(it.id, { status: 'sizeout' })}>サイズアウトにする</button>
                )}
                {it.status === 'sizeout' && (
                  <>
                    <button onClick={() => updateItem(it.id, { status: 'handmedown' })}>お下がり待ちへ</button>
                    <button onClick={() => updateItem(it.id, { status: 'active' })}>使用中に戻す</button>
                  </>
                )}
                {it.status === 'handmedown' && data.kids.length > 1 && (
                  <button className="accent" onClick={() => passDown(it.id)}>
                    {data.kids.find((k) => k.id !== kid.id)?.name}へお下がり
                  </button>
                )}
                <button className="danger" onClick={() => removeItem(it.id)}>削除</button>
              </div>
            </div>
          </article>
        ))}
      </main>

      <footer className="foot">
        <p>データはこの端末のブラウザに保存されます</p>
      </footer>
    </div>
  )
}

function KidEditor({ kid, onSave, onCancel }) {
  const [name, setName] = useState(kid.name)
  const [size, setSize] = useState(kid.size)
  return (
    <div className="kideditor">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="なまえ" aria-label="名前" />
      <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="いまのサイズ" aria-label="サイズ" />
      <button className="primary" onClick={() => onSave({ name: name.trim() || kid.name, size: size.trim() || kid.size })}>保存する</button>
      <button className="ghost" onClick={onCancel}>やめる</button>
    </div>
  )
}

function ItemForm({ defaultSize, onSubmit, onCancel }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [size, setSize] = useState(defaultSize || '')
  const [season, setSeason] = useState(SEASONS[0])
  const [memo, setMemo] = useState('')

  function submit() {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), category, size: size.trim() || '-', season, memo: memo.trim(), status: 'active' })
  }

  return (
    <div className="form">
      <h2>服を登録</h2>
      <label>
        なまえ
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：しましまTシャツ" autoFocus />
      </label>
      <div className="form-row">
        <label>
          カテゴリ
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>
          サイズ
          <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="例：120" />
        </label>
      </div>
      <label>
        季節
        <select value={season} onChange={(e) => setSeason(e.target.value)}>
          {SEASONS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label>
        メモ（ブランド・買った場所など）
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="例：ユニクロ / おばあちゃんから" />
      </label>
      <div className="form-actions">
        <button className="primary" onClick={submit} disabled={!name.trim()}>登録する</button>
        <button className="ghost" onClick={onCancel}>やめる</button>
      </div>
    </div>
  )
}
