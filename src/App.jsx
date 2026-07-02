import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'watashi-no-code-cho-v1'

const CATEGORIES = [
  { name: 'トップス', emoji: '👕' },
  { name: 'ボトムス', emoji: '👖' },
  { name: 'ワンピース', emoji: '👗' },
  { name: 'アウター', emoji: '🧥' },
  { name: 'くつ', emoji: '👟' },
  { name: 'ぼうし', emoji: '🧢' },
  { name: 'こもの', emoji: '🎀' },
]

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

const DEFAULT_DATA = { items: [], log: {} } // log: { 'YYYY-MM-DD': [itemId, ...] }

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DATA
    const p = JSON.parse(raw)
    return { items: p.items || [], log: p.log || {} }
  } catch {
    return DEFAULT_DATA
  }
}

const uid = () => Math.random().toString(36).slice(2, 9)
const pad = (n) => String(n).padStart(2, '0')
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`

/** 画像を縮小してdataURLに変換（端末保存の容量対策） */
function compressImage(file, maxSide = 320, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function App() {
  const [data, setData] = useState(load)
  const [tab, setTab] = useState('calendar')
  const today = new Date()
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selectedDay, setSelectedDay] = useState(null) // 'YYYY-MM-DD'

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const itemById = useMemo(() => {
    const map = {}
    data.items.forEach((it) => { map[it.id] = it })
    return map
  }, [data.items])

  const loggedDays = Object.keys(data.log).filter((k) => (data.log[k] || []).length > 0).length

  function addItem(item) {
    setData((d) => ({ ...d, items: [{ ...item, id: uid() }, ...d.items] }))
  }

  function removeItem(id) {
    if (!confirm('このお洋服を削除する？（記録からも消えます）')) return
    setData((d) => {
      const log = {}
      Object.entries(d.log).forEach(([k, ids]) => {
        const rest = ids.filter((x) => x !== id)
        if (rest.length) log[k] = rest
      })
      return { items: d.items.filter((it) => it.id !== id), log }
    })
  }

  function toggleWorn(dayKey, itemId) {
    setData((d) => {
      const cur = d.log[dayKey] || []
      const next = cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId]
      const log = { ...d.log }
      if (next.length) log[dayKey] = next
      else delete log[dayKey]
      return { ...d, log }
    })
  }

  return (
    <div className="app">
      <header className="hero">
        <h1><span className="hero-icon" aria-hidden="true">👗</span>わたしのコーデ帳</h1>
        <p className="hero-stats">{data.items.length}着登録　{loggedDays}日分の記録</p>
      </header>

      <main className="content">
        {tab === 'calendar' ? (
          <Calendar
            ym={ym}
            setYm={setYm}
            today={today}
            log={data.log}
            itemById={itemById}
            onSelectDay={setSelectedDay}
          />
        ) : (
          <Closet items={data.items} onAdd={addItem} onRemove={removeItem} />
        )}
      </main>

      {selectedDay && (
        <DaySheet
          dayKey={selectedDay}
          items={data.items}
          worn={data.log[selectedDay] || []}
          onToggle={(itemId) => toggleWorn(selectedDay, itemId)}
          onClose={() => setSelectedDay(null)}
          onGoCloset={() => { setSelectedDay(null); setTab('closet') }}
        />
      )}

      <nav className="tabbar">
        <button className={tab === 'calendar' ? 'is-active' : ''} onClick={() => setTab('calendar')}>
          <span className="tab-emoji" aria-hidden="true">📅</span>カレンダー
        </button>
        <button className={tab === 'closet' ? 'is-active' : ''} onClick={() => setTab('closet')}>
          <span className="tab-emoji" aria-hidden="true">👗</span>クローゼット
        </button>
      </nav>
    </div>
  )
}

function Calendar({ ym, setYm, today, log, itemById, onSelectDay }) {
  const { y, m } = ym
  const firstDow = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const isThisMonth = today.getFullYear() === y && today.getMonth() === m

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function move(diff) {
    setYm(({ y, m }) => {
      const nm = m + diff
      if (nm < 0) return { y: y - 1, m: 11 }
      if (nm > 11) return { y: y + 1, m: 0 }
      return { y, m: nm }
    })
  }

  return (
    <section className="calendar">
      <div className="cal-head">
        <button className="cal-nav" onClick={() => move(-1)} aria-label="前の月">‹</button>
        <h2>{y}年 {m + 1}月</h2>
        <button className="cal-nav" onClick={() => move(1)} aria-label="次の月">›</button>
      </div>
      <div className="cal-grid cal-week">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`dow ${i === 0 ? 'sun' : ''} ${i === 6 ? 'sat' : ''}`}>{w}</div>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} className="cell empty" />
          const dow = i % 7
          const dayKey = keyOf(y, m, d)
          const worn = log[dayKey] || []
          const isToday = isThisMonth && d === today.getDate()
          return (
            <button
              key={dayKey}
              className={`cell day ${isToday ? 'today' : ''}`}
              onClick={() => onSelectDay(dayKey)}
            >
              <span className={`daynum ${dow === 0 ? 'sun' : ''} ${dow === 6 ? 'sat' : ''}`}>{d}</span>
              <span className="cell-emojis">
                {worn.slice(0, 3).map((id) => {
                  const it = itemById[id]
                  if (!it) return null
                  return it.photo
                    ? <img key={id} className="cell-thumb" src={it.photo} alt={it.name} />
                    : <span key={id}>{it.emoji || '👚'}</span>
                })}
                {worn.length > 3 && <span className="more">+{worn.length - 3}</span>}
              </span>
            </button>
          )
        })}
      </div>
      <p className="cal-hint">日にちをタップして、その日きた服を記録できます</p>
    </section>
  )
}

function DaySheet({ dayKey, items, worn, onToggle, onClose, onGoCloset }) {
  const [, mm, dd] = dayKey.split('-')
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="この日のコーデ">
        <div className="sheet-grip" aria-hidden="true" />
        <h2>{Number(mm)}月{Number(dd)}日のコーデ</h2>
        {items.length === 0 ? (
          <div className="sheet-empty">
            <p>まだお洋服が登録されていません。</p>
            <button className="primary" onClick={onGoCloset}>クローゼットに登録する</button>
          </div>
        ) : (
          <div className="pick-list">
            {items.map((it) => {
              const on = worn.includes(it.id)
              return (
                <button key={it.id} className={`pick ${on ? 'is-on' : ''}`} onClick={() => onToggle(it.id)}>
                  {it.photo
                    ? <img className="pick-photo" src={it.photo} alt="" />
                    : <span className="pick-emoji">{it.emoji}</span>}
                  <span className="pick-name">{it.name}</span>
                  <span className="pick-check">{on ? '✓' : ''}</span>
                </button>
              )
            })}
          </div>
        )}
        <button className="ghost close" onClick={onClose}>とじる</button>
      </div>
    </div>
  )
}

function Closet({ items, onAdd, onRemove }) {
  const [name, setName] = useState('')
  const [cat, setCat] = useState(CATEGORIES[0])
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)

  async function onPhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      setPhoto(await compressImage(file))
    } catch {
      alert('写真の読み込みに失敗しました。別の写真で試してください。')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  function submit() {
    if (!name.trim()) return
    try {
      onAdd({ name: name.trim(), category: cat.name, emoji: cat.emoji, photo })
      setName('')
      setPhoto(null)
    } catch {
      alert('保存できませんでした。端末の保存容量がいっぱいの可能性があります。使わない服を削除してみてください。')
    }
  }

  return (
    <section className="closet">
      <div className="add-card">
        <h2>お洋服を登録</h2>
        <div className="emoji-row" role="radiogroup" aria-label="カテゴリ">
          {CATEGORIES.map((c) => (
            <button
              key={c.name}
              role="radio"
              aria-checked={cat.name === c.name}
              className={`emoji-btn ${cat.name === c.name ? 'is-on' : ''}`}
              onClick={() => setCat(c)}
              title={c.name}
            >
              {c.emoji}
            </button>
          ))}
        </div>
        <p className="cat-label">{cat.name}</p>

        <label className={`photo-pick ${photo ? 'has-photo' : ''}`}>
          {photo
            ? <img src={photo} alt="登録するお洋服の写真" />
            : <span className="photo-pick-hint">{busy ? '読み込み中…' : '📷 写真をとる・えらぶ'}</span>}
          <input type="file" accept="image/*" onChange={onPhotoChange} hidden />
        </label>
        {photo && <button className="ghost photo-clear" onClick={() => setPhoto(null)}>写真をけす</button>}

        <div className="add-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            placeholder="例：いちごのTシャツ"
            aria-label="お洋服の名前"
          />
          <button className="primary" onClick={submit} disabled={!name.trim() || busy}>登録</button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="closet-empty">お気に入りのお洋服を登録して、コーデ帳をはじめましょう</p>
      ) : (
        <ul className="item-list">
          {items.map((it) => (
            <li key={it.id} className="item-row">
              {it.photo
                ? <img className="item-photo" src={it.photo} alt={it.name} />
                : <span className="item-emoji">{it.emoji}</span>}
              <span className="item-name">{it.name}</span>
              <span className="item-cat">{it.category}</span>
              <button className="del" onClick={() => onRemove(it.id)} aria-label={`${it.name}を削除`}>×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
