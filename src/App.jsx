import { useState, useEffect, useRef } from "react";

// ────────────────────────────────────────────────────────────
// 定数
// ────────────────────────────────────────────────────────────
const STORAGE_KEY = "wardrobe_data_v1";
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const WEEK   = ["日","月","火","水","木","金","土"];

function todayObj() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstDow(y, m)    { return new Date(y, m, 1).getDay(); }
function dateKey(y, m, d)  {
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
function initData() {
  return { items: {}, records: {} };
}

// 日曜始まりの週の最初の日を返す
function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0,0,0,0);
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ────────────────────────────────────────────────────────────
// 画像圧縮（長辺300px・JPEG0.65）
// ────────────────────────────────────────────────────────────
function compressImage(dataURL, maxSize = 300, quality = 0.65) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataURL;
  });
}

// ────────────────────────────────────────────────────────────
// ストレージ（window.storage API）
// ────────────────────────────────────────────────────────────
async function loadFromStorage() {
  try {
    const result = await window.storage.get(STORAGE_KEY);
    return result ? JSON.parse(result.value) : initData();
  } catch { return initData(); }
}

async function saveToStorage(data) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(data));
  } catch(e) {
    console.error("storage save error:", e);
  }
}

// ────────────────────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────────────────────
function wearCounts(data) {
  const c = {};
  Object.values(data.records).forEach(ids =>
    ids.forEach(id => { c[id] = (c[id] || 0) + 1; })
  );
  return c;
}

function wearBadge(n) {
  if (n >= 7) return { emoji:"🔥🔥", text:`${n}回`, warn:true };
  if (n >= 4) return { emoji:"🔥",   text:`${n}回`, warn:true };
  if (n >= 2) return { emoji:"⭐",   text:`${n}回`, warn:false };
  return               { emoji:"",    text:`${n}回`, warn:false };
}

// ────────────────────────────────────────────────────────────
// App
// ────────────────────────────────────────────────────────────
export default function App() {
  const [data,    setData]    = useState(initData);
  const [ready,   setReady]   = useState(false);
  const [scene,   setScene]   = useState("week");
  const [year,    setYear]    = useState(() => todayObj().year);
  const [month,   setMonth]   = useState(() => todayObj().month);
  const [selDay,  setSelDay]  = useState(null);
  const [selDate, setSelDate] = useState(null); // 週表示から遷移する日付詳細用（Dateオブジェクト）
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [flow,    setFlow]    = useState(null);
  const [saving,  setSaving]  = useState(false);
  const fileRef = useRef();
  const t = todayObj();

  // 初期ロード
  useEffect(() => {
    loadFromStorage().then(d => { setData(d); setReady(true); });
  }, []);

  // データ変更時に保存
  useEffect(() => {
    if (!ready) return;
    setSaving(true);
    saveToStorage(data).finally(() => setSaving(false));
  }, [data, ready]);

  const counts   = wearCounts(data);
  const itemList = Object.values(data.items);

  // ── アイテム操作 ──────────────────────────────────────────
  function addNewItem(img) {
    const id = `item_${Date.now()}`;
    setData(prev => ({
      ...prev,
      items: { ...prev.items, [id]: { id, photos:[img], firstPhoto:img } }
    }));
    return id;
  }

  function appendPhoto(itemId, img) {
    setData(prev => {
      const item = prev.items[itemId];
      if (!item) return prev;
      // サブ写真は最大4枚まで
      const photos = [...item.photos, img].slice(0, 5);
      return { ...prev, items: { ...prev.items, [itemId]: { ...item, photos } } };
    });
  }

  function assignToDay(itemId, y, m, d) {
    const key = dateKey(y, m, d);
    setData(prev => {
      const cur = prev.records[key] || [];
      if (cur.includes(itemId)) return prev;
      return { ...prev, records: { ...prev.records, [key]: [...cur, itemId] } };
    });
  }

  function removeFromDay(itemId, y, m, d) {
    const key = dateKey(y, m, d);
    setData(prev => {
      const cur = (prev.records[key] || []).filter(i => i !== itemId);
      const records = { ...prev.records };
      if (cur.length) records[key] = cur; else delete records[key];
      return { ...prev, records };
    });
  }

  function deleteItem(id) {
    setData(prev => {
      const items = { ...prev.items };
      delete items[id];
      const records = {};
      Object.entries(prev.records).forEach(([k,ids]) => {
        const f = ids.filter(i => i !== id);
        if (f.length) records[k] = f;
      });
      return { items, records };
    });
  }

  // ── 写真フロー ────────────────────────────────────────────
  function startPhotoFlow(img) { setFlow({ step:"match", img }); }

  function currentTargetDate() {
    // day/weekどちらから来たかに応じて対象日を返す
    if (scene === "day" && selDay) return { y: year, m: month, d: selDay };
    if (selDate) return { y: selDate.getFullYear(), m: selDate.getMonth(), d: selDate.getDate() };
    return null;
  }

  function finishAsNew() {
    const id = addNewItem(flow.img);
    const t = currentTargetDate();
    if (t) assignToDay(id, t.y, t.m, t.d);
    setFlow(null);
  }

  function finishAsExisting(itemId) {
    appendPhoto(itemId, flow.img);
    const t = currentTargetDate();
    if (t) assignToDay(itemId, t.y, t.m, t.d);
    setFlow(null);
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = async ev => {
      const compressed = await compressImage(ev.target.result);
      startPhotoFlow(compressed);
    };
    reader.readAsDataURL(file);
  }

  // ── ローディング ──────────────────────────────────────────
  if (!ready) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
      height:"100vh",background:"#FBF6F2",flexDirection:"column",gap:12}}>
      <div style={{fontSize:32}}>👗</div>
      <div style={{fontSize:14,color:"#C0907A"}}>よみこみ中…</div>
    </div>
  );

  // ── カレンダー ────────────────────────────────────────────
  function CalendarView() {
    const fd    = firstDow(year, month);
    const total = daysInMonth(year, month);
    const cells = [...Array(fd).fill(null), ...Array.from({length:total},(_,i)=>i+1)];

    function prev() { month===0?(setYear(y=>y-1),setMonth(11)):setMonth(m=>m-1); }
    function next() { month===11?(setYear(y=>y+1),setMonth(0)):setMonth(m=>m+1); }

    return (
      <div style={{paddingBottom:80}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px 10px"}}>
          <button onClick={prev} style={S.navBtn}>‹</button>
          <span style={{fontSize:20,fontWeight:700,color:"#3D2B1F"}}>
            {year}年 {MONTHS[month]}
          </span>
          <button onClick={next} style={S.navBtn}>›</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 10px",gap:2}}>
          {WEEK.map((w,i)=>(
            <div key={w} style={{textAlign:"center",fontSize:10,fontWeight:700,padding:"3px 0",
              color:i===0?"#D06060":i===6?"#6080C0":"#9A8070"}}>{w}</div>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 10px",gap:3}}>
          {cells.map((day,idx)=>{
            if (!day) return <div key={`e${idx}`}/>;
            const key  = dateKey(year,month,day);
            const ids  = data.records[key] || [];
            const isToday = day===t.day && month===t.month && year===t.year;
            const dow  = (fd+day-1)%7;
            const hasHot = ids.some(id => (counts[id]||0) >= 4);

            return (
              <div key={day}
                onClick={()=>{ setSelDay(day); setSelDate(null); setScene("day"); }}
                style={{
                  minHeight:68,borderRadius:10,cursor:"pointer",
                  background:isToday?"#FFF0F3":"#FFFCFA",
                  border:isToday?"2px solid #F4A7B9":"1px solid #EDE0D8",
                  padding:"5px 3px 3px",position:"relative",
                  boxShadow:"0 1px 3px rgba(0,0,0,.04)",
                  transition:"box-shadow .12s",
                }}
                onMouseEnter={e=>e.currentTarget.style.boxShadow="0 3px 10px rgba(0,0,0,.10)"}
                onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,.04)"}
              >
                {hasHot && <div style={{position:"absolute",top:2,right:3,fontSize:9}}>🔥</div>}
                <div style={{textAlign:"center",fontSize:10,fontWeight:isToday?700:500,
                  color:dow===0?"#D06060":dow===6?"#6080C0":"#7A6050",marginBottom:2}}>{day}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:1,justifyContent:"center"}}>
                  {ids.slice(0,4).map(id=>{
                    const item = data.items[id];
                    if (!item) return null;
                    return <img key={id} src={item.firstPhoto} alt=""
                      style={{width:20,height:20,borderRadius:4,objectFit:"cover",
                        border:`2px solid ${(counts[id]||0)>=4?"#F4A7B9":"#fff"}`}}/>;
                  })}
                  {ids.length>4 && <div style={{fontSize:8,color:"#B09080",alignSelf:"center"}}>+{ids.length-4}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── クローゼット ──────────────────────────────────────────
  function ClosetView() {
    const sorted = [...itemList].sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0));
    return (
      <div style={{padding:"20px 14px 80px"}}>
        <div style={{fontSize:16,fontWeight:700,color:"#3D2B1F",marginBottom:14}}>
          最近よく着てる服
        </div>
        {sorted.length===0 && (
          <div style={{textAlign:"center",color:"#C0A090",padding:40,fontSize:13}}>
            まだ服がないよ！<br/>カレンダーの日付から写真で記録してみよう📷
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
          {sorted.map(item=>{
            const n = counts[item.id]||0;
            const badge = wearBadge(n);
            return (
              <div key={item.id} style={{
                borderRadius:14,overflow:"hidden",
                border:`1.5px solid ${badge.warn?"#F4A7B9":"#EDE0D8"}`,
                background:"#FFFCFA",position:"relative",
                boxShadow:badge.warn?"0 2px 12px rgba(244,167,185,.3)":"0 2px 6px rgba(0,0,0,.04)",
              }}>
                <img src={item.firstPhoto} alt=""
                  style={{width:"100%",height:120,objectFit:"cover",display:"block"}}/>
                <div style={{
                  position:"absolute",top:8,right:8,
                  background:badge.warn?"#F4A7B9":"rgba(255,255,255,.92)",
                  color:badge.warn?"#fff":"#5C3D2E",
                  borderRadius:20,padding:"3px 9px",fontSize:12,fontWeight:700,
                  boxShadow:"0 1px 4px rgba(0,0,0,.15)",
                }}>{badge.emoji} {badge.text}</div>
                <button onClick={()=>{ if(window.confirm("この服の記録を全部消す？")) deleteItem(item.id); }}
                  style={{position:"absolute",top:8,left:8,background:"rgba(255,255,255,.9)",
                    border:"none",borderRadius:20,width:24,height:24,cursor:"pointer",
                    fontSize:13,color:"#C07070",display:"flex",alignItems:"center",justifyContent:"center",
                    boxShadow:"0 1px 4px rgba(0,0,0,.12)"}}>×</button>
                {item.photos.length>1 && (
                  <div style={{display:"flex",gap:3,padding:"4px 6px",overflowX:"auto"}}>
                    {item.photos.slice(1).map((p,i)=>(
                      <img key={i} src={p} alt=""
                        style={{width:32,height:32,borderRadius:5,objectFit:"cover",flexShrink:0}}/>
                    ))}
                  </div>
                )}
                {badge.warn && (
                  <div style={{fontSize:11,color:"#E07070",textAlign:"center",
                    padding:"4px 6px 8px",fontWeight:600}}>
                    {n>=7?"かなり着てるね！":"最近よく着てるよ"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── 日付詳細 ──────────────────────────────────────────────
  function DayView() {
    const dObj = selDate || new Date(year, month, selDay);
    const y = dObj.getFullYear(), m = dObj.getMonth(), d = dObj.getDate();
    const key = dateKey(y, m, d);
    const ids = data.records[key] || [];
    const dow = WEEK[dObj.getDay()];
    const backTo = selDate ? "week" : "calendar";

    return (
      <div style={{padding:"16px 14px 80px"}}>
        <button onClick={()=>{ setScene(backTo); }}
          style={{background:"none",border:"none",color:"#C0907A",cursor:"pointer",fontSize:13,marginBottom:12}}>
          ← もどる
        </button>
        <div style={{fontSize:20,fontWeight:700,color:"#3D2B1F",marginBottom:2}}>
          {MONTHS[m]} {d}日（{dow}）
        </div>
        <div style={{fontSize:12,color:"#B09080",marginBottom:18}}>この日のコーデ</div>

        {ids.length===0 ? (
          <div style={{textAlign:"center",color:"#C0A090",padding:"30px 0",fontSize:13}}>
            記録なし。下の📷から今日の服を登録しよう！
          </div>
        ) : (
          <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:20}}>
            {ids.map(id=>{
              const item = data.items[id];
              if (!item) return null;
              const n = counts[id]||0;
              const badge = wearBadge(n);
              return (
                <div key={id} style={{width:90,position:"relative"}}>
                  <img src={item.firstPhoto} alt=""
                    style={{width:90,height:90,objectFit:"cover",borderRadius:12,display:"block",
                      border:`2px solid ${badge.warn?"#F4A7B9":"#EDE0D8"}`}}/>
                  <div style={{
                    position:"absolute",top:4,right:4,
                    background:badge.warn?"#F4A7B9":"rgba(255,255,255,.9)",
                    color:badge.warn?"#fff":"#5C3D2E",
                    borderRadius:20,padding:"1px 6px",fontSize:10,fontWeight:700,
                  }}>{badge.emoji}{badge.text}</div>
                  <button onClick={()=>removeFromDay(id,y,m,d)}
                    style={{position:"absolute",top:4,left:4,background:"rgba(255,255,255,.9)",
                      border:"none",borderRadius:20,width:20,height:20,cursor:"pointer",
                      fontSize:11,color:"#C07070",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={()=>{ setSelDate(new Date(y,m,d)); fileRef.current.click(); }} style={{
          width:"100%",background:"#F4A7B9",border:"none",borderRadius:14,
          padding:"14px 0",fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",
          boxShadow:"0 3px 10px rgba(244,167,185,.35)",marginBottom:12,
        }}>
          📷 この日の服を写真で記録
        </button>

        {itemList.length>0 && (
          <>
            <div style={{fontSize:12,color:"#9A8070",fontWeight:600,margin:"4px 0 10px"}}>
              登録済みの服から選ぶ
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {itemList.map(item=>{
                const selected = ids.includes(item.id);
                return (
                  <div key={item.id}
                    onClick={()=> selected ? removeFromDay(item.id,y,m,d) : assignToDay(item.id,y,m,d)}
                    style={{width:64,cursor:"pointer",borderRadius:10,overflow:"hidden",
                      border:`2px solid ${selected?"#F4A7B9":"#EDE0D8"}`,
                      boxShadow:selected?"0 0 0 2px #F4A7B9":"none",transition:"all .12s"}}>
                    <img src={item.firstPhoto} alt=""
                      style={{width:64,height:64,objectFit:"cover",display:"block"}}/>
                    {selected && (
                      <div style={{fontSize:10,color:"#F4A7B9",textAlign:"center",
                        padding:"2px 0",fontWeight:700,background:"#FFF0F3"}}>✓</div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── 週表示（先週＋今週、日曜始まり） ─────────────────────
  function WeekView() {
    const thisWeekStart = weekAnchor;
    const lastWeekStart = addDays(thisWeekStart, -7);
    const todayKey = fmtDateKey(new Date());

    function prevBlock() { setWeekAnchor(addDays(weekAnchor, -7)); }
    function nextBlock()  { setWeekAnchor(addDays(weekAnchor, 7)); }
    function backToToday(){ setWeekAnchor(startOfWeek(new Date())); }

    function WeekRow({ label, start }) {
      const days = Array.from({length:7}, (_,i)=>addDays(start,i));
      return (
        <div style={{marginBottom:18}}>
          <div style={{fontSize:12,fontWeight:700,color:"#9A8070",marginBottom:6,paddingLeft:2}}>
            {label}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
            {days.map((d,i)=>{
              const key = fmtDateKey(d);
              const ids = data.records[key] || [];
              const isToday = key === todayKey;
              const hasHot = ids.some(id => (counts[id]||0) >= 4);
              return (
                <div key={i}
                  onClick={()=>{ setSelDate(d); setScene("day"); }}
                  style={{
                    minHeight:96,borderRadius:12,cursor:"pointer",
                    background:isToday?"#FFF0F3":"#FFFCFA",
                    border:isToday?"2px solid #F4A7B9":"1px solid #EDE0D8",
                    padding:"6px 3px 4px",position:"relative",
                    boxShadow:"0 1px 3px rgba(0,0,0,.04)",
                  }}
                >
                  {hasHot && <div style={{position:"absolute",top:3,right:4,fontSize:11}}>🔥</div>}
                  <div style={{textAlign:"center",fontSize:11,fontWeight:isToday?700:500,
                    color:i===0?"#D06060":i===6?"#6080C0":"#7A6050",marginBottom:4}}>
                    {d.getDate()}
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:2,justifyContent:"center"}}>
                    {ids.slice(0,4).map(id=>{
                      const item = data.items[id];
                      if (!item) return null;
                      return (
                        <img key={id} src={item.firstPhoto} alt=""
                          style={{width:36,height:36,borderRadius:7,objectFit:"cover",
                            border:`2px solid ${(counts[id]||0)>=4?"#F4A7B9":"#fff"}`}}/>
                      );
                    })}
                    {ids.length>4 && <div style={{fontSize:9,color:"#B09080"}}>+{ids.length-4}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div style={{padding:"14px 12px 80px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button onClick={prevBlock} style={S.navBtn}>‹</button>
          <button onClick={backToToday}
            style={{background:"#FFF0F3",border:"none",borderRadius:20,padding:"5px 14px",
              fontSize:12,fontWeight:700,color:"#E07070",cursor:"pointer"}}>
            今週へ
          </button>
          <button onClick={nextBlock} style={S.navBtn}>›</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 0 4px",gap:4}}>
          {WEEK.map((w,i)=>(
            <div key={w} style={{textAlign:"center",fontSize:10,fontWeight:700,
              color:i===0?"#D06060":i===6?"#6080C0":"#9A8070"}}>{w}</div>
          ))}
        </div>

        <WeekRow label={`先週　${lastWeekStart.getMonth()+1}/${lastWeekStart.getDate()}〜`} start={lastWeekStart} />
        <WeekRow label={`今週　${thisWeekStart.getMonth()+1}/${thisWeekStart.getDate()}〜`} start={thisWeekStart} />

        <div style={{fontSize:11,color:"#C0A090",textAlign:"center",marginTop:10}}>
          日付をタップして服を記録・確認できます
        </div>
      </div>
    );
  }

  // ── マッチングモーダル ────────────────────────────────────
  function MatchModal() {
    if (!flow) return null;
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(30,15,10,.55)",zIndex:200,
        display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:"#FFFCFA",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,
          padding:22,maxHeight:"85vh",overflowY:"auto"}}>
          <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:18}}>
            <img src={flow.img} alt="" style={{width:90,height:90,objectFit:"cover",borderRadius:12,flexShrink:0}}/>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:"#3D2B1F",marginBottom:4}}>
                この服、前にも着た？
              </div>
              <div style={{fontSize:12,color:"#9A8070",lineHeight:1.5}}>
                同じ服なら選んでね。<br/>新しい服なら「はじめて着る」を押して！
              </div>
            </div>
          </div>

          {itemList.length>0 && (
            <>
              <div style={{fontSize:12,color:"#9A8070",fontWeight:600,marginBottom:10}}>登録済みの服</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
                {itemList.map(item=>{
                  const n = counts[item.id]||0;
                  const badge = wearBadge(n);
                  return (
                    <div key={item.id} onClick={()=>finishAsExisting(item.id)}
                      style={{cursor:"pointer",borderRadius:10,overflow:"hidden",
                        border:"1.5px solid #EDE0D8",background:"#FFFCFA"}}>
                      <img src={item.firstPhoto} alt=""
                        style={{width:"100%",height:80,objectFit:"cover",display:"block"}}/>
                      <div style={{padding:"3px 5px 5px",textAlign:"center"}}>
                        <span style={{fontSize:11,fontWeight:700,
                          color:badge.warn?"#E07070":"#7A6050"}}>
                          {badge.emoji} {badge.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setFlow(null)}
              style={{flex:1,background:"#EDE0D8",border:"none",borderRadius:12,
                padding:"12px 0",fontSize:13,color:"#8A6A5A",cursor:"pointer",fontWeight:600}}>
              キャンセル
            </button>
            <button onClick={finishAsNew}
              style={{flex:2,background:"#F4A7B9",border:"none",borderRadius:12,
                padding:"12px 0",fontSize:14,color:"#fff",cursor:"pointer",fontWeight:700,
                boxShadow:"0 3px 10px rgba(244,167,185,.35)"}}>
              ✨ はじめて着る服
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────
  return (
    <div style={{fontFamily:"'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif",
      background:"#FBF6F2",minHeight:"100vh",maxWidth:480,margin:"0 auto",position:"relative"}}>

      {/* ヘッダー */}
      <div style={{background:"linear-gradient(130deg,#F4A7B9 0%,#F9C784 100%)",
        padding:"16px 18px 12px",position:"sticky",top:0,zIndex:50}}>
        <div style={{fontSize:18,fontWeight:700,color:"#fff",letterSpacing:.3,
          textShadow:"0 1px 4px rgba(0,0,0,.1)"}}>
          👗 わたしのコーデ帳
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.85)",marginTop:1,display:"flex",gap:10}}>
          <span>{itemList.length}着登録</span>
          <span>{Object.keys(data.records).length}日分の記録</span>
          {saving && <span>💾 保存中…</span>}
        </div>
      </div>

      {scene==="week"     && <WeekView/>}
      {scene==="calendar" && <CalendarView/>}
      {scene==="closet"   && <ClosetView/>}
      {scene==="day"      && <DayView/>}

      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>

      {/* ボトムナビ */}
      {scene!=="day" && (
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
          width:"100%",maxWidth:480,background:"#FFFCFA",
          borderTop:"1px solid #EDE0D8",display:"flex",
          boxShadow:"0 -2px 10px rgba(0,0,0,.06)",zIndex:100}}>
          {[
            {id:"week",    icon:"🗓️",label:"週間"},
            {id:"calendar",icon:"📅",label:"月間"},
            {id:"closet",  icon:"👗",label:"クローゼット"},
          ].map(tab=>(
            <button key={tab.id} onClick={()=>setScene(tab.id)}
              style={{flex:1,background:"none",border:"none",padding:"11px 0 9px",cursor:"pointer",
                display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <span style={{fontSize:22}}>{tab.icon}</span>
              <span style={{fontSize:10,fontWeight:700,
                color:scene===tab.id?"#F4A7B9":"#B09080"}}>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      <MatchModal/>
    </div>
  );
}

const S = {
  navBtn: {
    background:"none",border:"none",fontSize:26,color:"#C0907A",
    cursor:"pointer",padding:"0 8px",lineHeight:1,
  },
};

