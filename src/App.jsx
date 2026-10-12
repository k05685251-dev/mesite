import { useState, useEffect, useMemo, useRef } from "react";

/* ============ Yordamchi funksiyalar ============ */
const KEY = "maqsad-jamgarma-v1";
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY);
const uid = () => Math.random().toString(36).slice(2, 9);
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
const longDate = (s) => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const shortDate = (s) => { const d = parse(s); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`; };
const fmt = (n) => Math.round(n).toLocaleString("ru-RU");
const short = (n) =>
  n >= 1e9 ? (n / 1e9).toFixed(1).replace(/\.0$/, "") + " mlrd" :
  n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + " mln" :
  n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + " ming" : String(Math.round(n));

const defaultState = {
  goal: { name: "Mening orzuim", emoji: "🎯", target: 10000000, currency: "so'm", deadline: "", note: "" },
  tx: [],
  done: [],
  dark: false,
  setup: false,
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return { ...defaultState, ...d, done: Array.isArray(d.done) ? d.done : [], goal: { ...defaultState.goal, ...d.goal } };
    }
  } catch (e) {}
  return defaultState;
}

/* Bajarilgan orzuni arxivga o'tkazib, yangi (0%) orzu ochadi */
function archiveGoal(s, id) {
  const sorted = [...s.tx].sort((a, b) => a.date.localeCompare(b.date) || (a.ts || 0) - (b.ts || 0));
  const saved = sorted.reduce((sum, t) => sum + (t.type === "in" ? t.amount : -t.amount), 0);
  if (saved < s.goal.target) return s;
  const start = sorted[0]?.date || today();
  const entry = {
    id,
    name: s.goal.name,
    emoji: s.goal.emoji,
    target: s.goal.target,
    currency: s.goal.currency,
    start,
    end: today(),
    days: Math.max(1, daysBetween(start, today()) + 1),
    count: sorted.filter((t) => t.type === "in").length,
  };
  return { ...s, done: [entry, ...(s.done || [])], goal: { ...defaultState.goal, currency: s.goal.currency }, tx: [], setup: false };
}

const QUOTES = [
  "Katta orzu kichik qadamlardan boshlanadi.",
  "Bugun tejagan har bir tiyin — ertangi erkinlik.",
  "Sabr qilgan murodiga yetar.",
  "Doimiylik katta summadan ko'ra muhimroq.",
  "Maqsading seni kutyapti, to'xtama!",
  "Har kuni ozgina — oxirida ko'p bo'ladi.",
  "Intizom — orzu va natija o'rtasidagi ko'prik.",
];
const EMOJIS = ["🎯", "🚗", "🏠", "📱", "💻", "✈️", "💍", "🎓", "🏍️", "🕋", "🎮", "👟", "📷", "🏋️", "💰"];
const QUICK = [10000, 50000, 100000, 500000];
const TABS = [["home", "🏠", "Asosiy"], ["history", "🧾", "Tarix"], ["stats", "📈", "Tahlil"], ["settings", "⚙️", "Sozlamalar"]];

/* ============ Asosiy komponent ============ */
export default function App() {
  const [st, setSt] = useState(load);
  const [tab, setTab] = useState("home");
  const [form, setForm] = useState({ type: "in", amount: "", note: "", date: today() });
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [quote, setQuote] = useState(0);
  const [rev, setRev] = useState(0);
  const [sms, setSms] = useState(null);
  const [collapsing, setCollapsing] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [landed, setLanded] = useState(null);
  const smsTimers = useRef([]);
  const pendingFinish = useRef(false);
  const busy = useRef(false);
  const timer = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  }, [st]);

  useEffect(() => {
    document.documentElement.style.background = st.dark ? "#0e1a14" : "#e9f0ea";
    document.body.style.margin = "0";
  }, [st.dark]);

  useEffect(() => {
    const t = setInterval(() => setQuote((q) => (q + 1) % QUOTES.length), 9000);
    return () => clearInterval(t);
  }, []);

  const say = (msg, undo) => {
    clearTimeout(timer.current);
    setToast({ msg, undo });
    timer.current = setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => () => smsTimers.current.forEach(clearTimeout), []);

  /* Katta oyna kichrayib kartaga aylanadi, yangi orzu ochiladi */
  const finishGoal = () => {
    if (busy.current) return;
    busy.current = true;
    setTab("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setCollapsing(true);
    setTimeout(() => {
      const id = uid();
      setSt((s) => archiveGoal(s, id));
      setCollapsing(false);
      setRev((r) => r + 1);
      setForm((f) => ({ ...f, amount: "", note: "" }));
      setLanded(id);
      setFresh(true);
      busy.current = false;
      setTimeout(() => setLanded(null), 2200);
      setTimeout(() => setFresh(false), 1200);
    }, 950);
  };

  const closeSms = () => {
    setSms((s) => (s ? { ...s, leaving: true } : s));
    setTimeout(() => setSms(null), 350);
    if (pendingFinish.current) {
      pendingFinish.current = false;
      setTimeout(finishGoal, 450);
    }
  };
  const showSms = (finishAfter) => {
    smsTimers.current.forEach(clearTimeout);
    pendingFinish.current = !!finishAfter;
    setSms({ id: Date.now(), typing: true, leaving: false, next: !!finishAfter });
    smsTimers.current = [
      setTimeout(() => setSms((s) => (s ? { ...s, typing: false } : s)), 1600),
      setTimeout(closeSms, 14000),
    ];
  };

  const { goal, tx } = st;
  const done = st.done || [];
  const set = (patch) => setSt((s) => ({ ...s, ...patch }));

  /* ---------- Hisob-kitoblar ---------- */
  const stats = useMemo(() => {
    const sorted = [...tx].sort((a, b) => a.date.localeCompare(b.date) || (a.ts || 0) - (b.ts || 0));
    const saved = sorted.reduce((s, t) => s + (t.type === "in" ? t.amount : -t.amount), 0);
    const pct = goal.target > 0 ? Math.max(0, Math.min(100, (saved / goal.target) * 100)) : 0;
    const left = Math.max(0, goal.target - saved);
    const deposits = sorted.filter((t) => t.type === "in");
    const first = sorted[0]?.date;
    const daysActive = first ? Math.max(1, daysBetween(first, today()) + 1) : 1;
    const avgDay = saved > 0 ? saved / daysActive : 0;
    const etaDays = avgDay > 0 && left > 0 ? Math.ceil(left / avgDay) : 0;
    let etaDate = null;
    if (etaDays) { const d = new Date(Date.now() + etaDays * DAY); etaDate = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; }
    let daysLeft = null, needDay = 0, needWeek = 0, needMonth = 0;
    if (goal.deadline) {
      daysLeft = daysBetween(today(), goal.deadline);
      if (daysLeft > 0) { needDay = left / daysLeft; needWeek = needDay * 7; needMonth = needDay * 30; }
    }
    const dates = new Set(deposits.map((d) => d.date));
    let streak = 0;
    const d = new Date();
    if (!dates.has(ymd(d))) d.setDate(d.getDate() - 1);
    while (dates.has(ymd(d))) { streak++; d.setDate(d.getDate() - 1); }
    const biggest = deposits.reduce((m, t) => Math.max(m, t.amount), 0);
    let run = 0;
    const points = sorted.map((t) => { run += t.type === "in" ? t.amount : -t.amount; return { date: t.date, v: run }; });
    const onTrack = daysLeft !== null && daysLeft > 0 && deposits.length ? avgDay >= needDay : null;
    const totIn = deposits.reduce((s, t) => s + t.amount, 0);
    return { sorted, saved, pct, left, avgDay, etaDays, etaDate, daysLeft, needDay, needWeek, needMonth, streak, biggest, points, onTrack, count: deposits.length, totIn, totOut: totIn - saved };
  }, [tx, goal]);

  const addTx = () => {
    const amount = parseFloat(String(form.amount).replace(/\s/g, ""));
    if (!amount || amount <= 0) return say("Summani to'g'ri kiriting");
    if (form.type === "out" && amount > stats.saved) return say("Yechish summasi jamg'armadan katta");
    const newSaved = stats.saved + (form.type === "in" ? amount : -amount);
    setSt((s) => ({ ...s, tx: [...s.tx, { id: uid(), ts: Date.now(), type: form.type, amount, note: form.note.trim(), date: form.date || today() }] }));
    setForm({ ...form, amount: "", note: "" });
    if (stats.pct < 100 && newSaved >= goal.target) { setToast(null); showSms(true); }
    else say(form.type === "in" ? `+${fmt(amount)} ${goal.currency} qo'shildi 🎉` : `−${fmt(amount)} ${goal.currency} yechildi`);
  };

  const delTx = (t) => {
    setSt((s) => ({ ...s, tx: s.tx.filter((x) => x.id !== t.id) }));
    say("Yozuv o'chirildi", () => { setSt((s) => ({ ...s, tx: [...s.tx, t] })); setToast(null); });
  };

  const download = (blob, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const exportJSON = () => download(new Blob([JSON.stringify(st, null, 2)], { type: "application/json" }), "jamgarma.json");
  const exportCSV = () => {
    const rows = ["Sana,Turi,Summa,Izoh", ...stats.sorted.map((t) => `${t.date},${t.type === "in" ? "Kirim" : "Chiqim"},${t.amount},"${t.note.replace(/"/g, "'")}"`)];
    download(new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv" }), "jamgarma.csv");
  };
  const importJSON = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data.goal || !Array.isArray(data.tx)) throw new Error();
        const txs = data.tx
          .filter((t) => t && typeof t.amount === "number" && t.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && (t.type === "in" || t.type === "out"))
          .map((t) => ({ id: t.id || uid(), ts: t.ts || 0, type: t.type, amount: t.amount, note: String(t.note || ""), date: t.date }));
        setSt({ ...defaultState, ...data, goal: { ...defaultState.goal, ...data.goal }, tx: txs, done: Array.isArray(data.done) ? data.done : [], setup: true });
        setRev((r) => r + 1);
        say("Ma'lumotlar yuklandi ✅");
      } catch (err) { say("Fayl noto'g'ri"); }
    };
    r.readAsText(f);
  };
  const resetAll = () =>
    setConfirm({
      text: "Hamma ma'lumot o'chib ketadi. Davom etasizmi?",
      yes: () => { setSt({ ...defaultState, dark: st.dark }); setRev((r) => r + 1); setConfirm(null); },
    });

  const shown = [...stats.sorted].reverse().filter((t) => (filter === "all" || t.type === filter) && (!search || (t.note + t.amount).toLowerCase().includes(search.toLowerCase())));

  return (
    <div className={"app " + (st.dark ? "dark" : "")}>
      <style>{css}</style>

      <header className="top">
        <div className="brand"><span className="logo">{goal.emoji}</span><b>{goal.name}</b></div>
        <nav className="tabs">
          {TABS.map(([k, ic, l]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); window.scrollTo({ top: 0 }); }}>
              <span className="ic">{ic}</span><span>{l}</span>
            </button>
          ))}
        </nav>
        <button className="mode" aria-label="Rejimni almashtirish" onClick={() => set({ dark: !st.dark })}>{st.dark ? "☀️" : "🌙"}</button>
      </header>

      <main>
        {/* ====== ASOSIY ====== */}
        {tab === "home" && (
          <>
            {done.length > 0 && (
              <section className="doneBox">
                <h4><span>🏆</span> Bajarilgan orzular <em>{done.length}</em></h4>
                <div className="doneList">
                  {done.map((d) => (
                    <div key={d.id} className={"doneCard" + (landed === d.id ? " land" : "")}>
                      <div className="doneEmoji">{d.emoji}<i>✓</i></div>
                      <div className="doneInfo">
                        <b>{d.name}</b>
                        <span>{fmt(d.target)} {d.currency}</span>
                        <small>{d.days} kunda · {longDate(d.end)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className={"hero" + (collapsing ? " shrink" : "") + (fresh ? " fresh" : "")}>
              <div className="jarWrap">
                <div className="jar">
                  <div className="liquid" style={{ height: stats.pct + "%" }}>{stats.pct > 0 && <i className="wave" />}</div>
                  <span className="jarPct">{stats.pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="heroText">
                <p className="muted">Men {goal.name.toLowerCase()} uchun yig'yapman</p>
                <h1>{fmt(stats.saved)} <small>{goal.currency}</small></h1>
                <p className="of">maqsad: <b>{fmt(goal.target)} {goal.currency}</b></p>
                <div className="bar"><div style={{ width: stats.pct + "%" }} /></div>
                <div className="chips">
                  <span>Qoldi: <b>{fmt(stats.left)}</b></span>
                  {stats.daysLeft !== null && <span>{stats.daysLeft > 0 ? `${stats.daysLeft} kun qoldi` : "Muddat tugadi"}</span>}
                  {stats.streak > 0 && <span>🔥 {stats.streak} kun ketma-ket</span>}
                </div>
                {stats.pct >= 100 ? (
                  <button className="cta gold pulse" onClick={finishGoal}>🚀 Orzu bajarildi — yangisiga o'tish</button>
                ) : (
                  <p className="quote">“{QUOTES[quote]}”</p>
                )}
                {goal.note && <p className="muted">📝 {goal.note}</p>}
              </div>
            </section>

            <div className="cols">
              <section className="card">
                <h3>Pul qo'shish yoki yechish</h3>
                <div className="seg">
                  <button className={form.type === "in" ? "on in" : ""} onClick={() => setForm({ ...form, type: "in" })}>＋ Kirim</button>
                  <button className={form.type === "out" ? "on out" : ""} onClick={() => setForm({ ...form, type: "out" })}>− Chiqim</button>
                </div>
                <div className="row">
                  <input type="number" inputMode="decimal" placeholder={`Summa (${goal.currency})`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addTx()} />
                  <input type="date" value={form.date} max={today()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <input placeholder="Izoh (masalan: maoshdan, sovg'a...)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addTx()} />
                <div className="quick">
                  {QUICK.map((q) => (
                    <button key={q} onClick={() => setForm({ ...form, amount: String((parseFloat(form.amount) || 0) + q) })}>+{fmt(q)}</button>
                  ))}
                </div>
                <button className={"cta " + form.type} onClick={addTx}>{form.type === "in" ? "Jamg'armaga qo'shish" : "Jamg'armadan yechish"}</button>
              </section>

              <div className="stack">
                <section className="grid4">
                  <Stat label="Kunlik o'rtacha" value={fmt(stats.avgDay)} sub={goal.currency} />
                  <Stat label="Eng katta kirim" value={fmt(stats.biggest)} sub={goal.currency} />
                  <Stat label="Kirimlar soni" value={stats.count} sub="marta" />
                  <Stat label="Taxminiy tugash" value={stats.pct >= 100 ? "Bajarildi 🏆" : stats.etaDate || "—"} sub={stats.etaDays ? `${stats.etaDays} kundan keyin` : ""} />
                </section>
                <section className="card">
                  <h3>Bosqichlar</h3>
                  <div className="miles">
                    {[10, 25, 50, 75, 100].map((m) => {
                      const dn = stats.pct >= m;
                      return (
                        <div key={m} className={"mile " + (dn ? "done" : "")}>
                          <div className="dot">{dn ? "✓" : m + "%"}</div>
                          <span>{short((goal.target * m) / 100)}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          </>
        )}

        {/* ====== TARIX ====== */}
        {tab === "history" && (
          <section className="card">
            <h3>Barcha yozuvlar ({tx.length})</h3>
            <div className="row">
              <input placeholder="🔍 Qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">Hammasi</option>
                <option value="in">Faqat kirim</option>
                <option value="out">Faqat chiqim</option>
              </select>
            </div>
            {shown.length === 0 && <p className="empty">{tx.length ? "Hech narsa topilmadi." : "Hozircha yozuv yo'q. «Asosiy» bo'limdan birinchi summani qo'shing."}</p>}
            <ul className="list">
              {shown.map((t) => (
                <li key={t.id}>
                  <div className={"badge " + t.type}>{t.type === "in" ? "＋" : "−"}</div>
                  <div className="grow2">
                    <b>{t.note || (t.type === "in" ? "Kirim" : "Chiqim")}</b>
                    <small>{longDate(t.date)}</small>
                  </div>
                  <b className={"amt " + t.type}>{t.type === "in" ? "+" : "−"}{fmt(t.amount)}</b>
                  <button className="x" aria-label="O'chirish" onClick={() => delTx(t)}>✕</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ====== TAHLIL ====== */}
        {tab === "stats" && (
          <div className="cols wide">
            <section className="card">
              <h3>Jamg'arma o'sishi</h3>
              <Chart points={stats.points} target={goal.target} />
            </section>
            <div className="stack">
              <section className="card">
                <h3>Muddatga yetish rejasi</h3>
                {stats.pct >= 100 ? (
                  <p className="verdict ok">Maqsad bajarilgan! 🎉</p>
                ) : stats.daysLeft === null ? (
                  <p className="empty">Sozlamalarda muddat belgilang — qancha yig'ish kerakligini hisoblab beraman.</p>
                ) : stats.daysLeft <= 0 ? (
                  <p className="verdict bad">Muddat o'tib ketgan. Sozlamalarda yangi sana qo'ying.</p>
                ) : (
                  <>
                    <div className="grid3">
                      <Stat label="Kuniga" value={fmt(stats.needDay)} sub={goal.currency} />
                      <Stat label="Haftasiga" value={fmt(stats.needWeek)} sub={goal.currency} />
                      <Stat label="Oyiga" value={fmt(stats.needMonth)} sub={goal.currency} />
                    </div>
                    <p className={"verdict " + (stats.onTrack ? "ok" : stats.onTrack === null ? "" : "bad")}>
                      {stats.onTrack === null ? "Yig'ishni boshlang — natija shu yerda ko'rinadi." : stats.onTrack ? "✅ Tempingiz yetarli, shu zaylda davom eting!" : "⚠️ Hozirgi temp bilan muddatga ulgurmaysiz. Biroz ko'proq yig'ing."}
                    </p>
                  </>
                )}
              </section>
              <section className="card">
                <h3>Qiziqarli faktlar</h3>
                <ul className="facts">
                  <li>Jami kirim: <b>{fmt(stats.totIn)} {goal.currency}</b></li>
                  <li>Jami chiqim: <b>{fmt(stats.totOut)} {goal.currency}</b></li>
                  <li>Hozirgi seriya: <b>{stats.streak} kun</b></li>
                  <li>Har 1% = <b>{fmt(goal.target / 100)} {goal.currency}</b></li>
                  <li>Bajarilgan orzular: <b>{done.length} ta</b></li>
                </ul>
              </section>
            </div>
          </div>
        )}

        {/* ====== SOZLAMALAR ====== */}
        {tab === "settings" && (
          <div className="cols wide">
            <GoalForm key={rev} goal={goal} onSave={(g) => { set({ goal: g, setup: true }); say("Maqsad saqlandi ✅"); }} />
            <section className="card">
              <h3>Ma'lumotlar</h3>
              <div className="quick">
                <button onClick={exportJSON}>⬇ JSON saqlash</button>
                <button onClick={exportCSV}>⬇ Excel (CSV)</button>
                <button onClick={() => fileRef.current.click()}>⬆ Yuklash</button>
                <button onClick={() => showSms(false)}>🔔 Xabarni sinab ko'rish</button>
                <button className="danger" onClick={resetAll}>🗑 Hammasini tozalash</button>
              </div>
              <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importJSON} />
              <p className="muted">Ma'lumotlar brauzeringizda saqlanadi. Telefon yoki brauzer almashtirsangiz, avval JSON faylni saqlab oling.</p>
            </section>
          </div>
        )}
      </main>

      {!st.setup && (
        <div className="modal">
          <div className="box">
            <h2>{done.length ? "Yangi orzu! 🚀" : "Xush kelibsiz! 👋"}</h2>
            <p className="muted">{done.length ? "Oldingi orzuingiz bajarildi. Endi keyingi maqsadingiz nima?" : "Avval maqsadingizni kiriting — nimaga pul yig'yapsiz?"}</p>
            <GoalForm key={"m" + rev} goal={goal} bare onSave={(g) => set({ goal: g, setup: true })} />
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal">
          <div className="box">
            <h2>Ishonchingiz komilmi?</h2>
            <p className="muted">{confirm.text}</p>
            <div className="row">
              <button className="cta out" onClick={confirm.yes}>Ha, o'chirish</button>
              <button className="cta plain" onClick={() => setConfirm(null)}>Bekor qilish</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.msg}</span>
          {toast.undo && <button onClick={toast.undo}>Qaytarish</button>}
        </div>
      )}
      {sms && <SmsNotice sms={sms} goal={goal} onClose={closeSms} />}
      <footer>{goal.emoji} Har bir qadam seni maqsadga yaqinlashtiradi.</footer>
    </div>
  );
}

/* ============ Kichik komponentlar ============ */
const CONF = ["#e0a21b", "#1f8a57", "#e0522d", "#2f7de0", "#d84fa0", "#7a4fe0"];

function SmsNotice({ sms, goal, onClose }) {
  return (
    <>
      {!sms.typing && !sms.leaving && (
        <div className="confetti" aria-hidden="true" key={sms.id}>
          {Array.from({ length: 36 }, (_, i) => (
            <i key={i} style={{ left: ((i * 37) % 100) + "%", background: CONF[i % CONF.length], animationDelay: (i % 9) * 0.1 + "s", animationDuration: 2.4 + (i % 5) * 0.45 + "s", transform: `rotate(${i * 40}deg)` }} />
          ))}
        </div>
      )}
      <div className={"sms" + (sms.leaving ? " leave" : "")} role="alert" onClick={onClose}>
        <div className="smsHead">
          <span className="smsIc">{goal.emoji}</span>
          <b>Orzu</b>
          <small>hozir</small>
        </div>
        <div className="smsBody">
          {sms.typing ? (
            <span className="typing"><i /><i /><i /></span>
          ) : (
            <p>
              Tabriklayman! 🎉 Siz <b>{goal.name}</b> uchun <b>{fmt(goal.target)} {goal.currency}</b> yig'dingiz. Maqsadingizga yetdingiz — o'zingizdan faxrlansangiz arziydi! 🏆
            </p>
          )}
        </div>
        {sms.next && !sms.typing && <small className="smsHint">Bosing — yangi orzuga o'tamiz 🚀</small>}
      </div>
    </>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <small>{label}</small>
      <b>{value}</b>
      {sub && <em>{sub}</em>}
    </div>
  );
}

function GoalForm({ goal, onSave, bare }) {
  const [g, setG] = useState({ ...goal, target: String(goal.target) });
  const [err, setErr] = useState("");
  const save = () => {
    const target = parseFloat(g.target);
    if (!g.name.trim()) return setErr("Maqsad nomini kiriting");
    if (!target || target <= 0) return setErr("Summa 0 dan katta bo'lishi kerak");
    setErr("");
    onSave({ ...g, name: g.name.trim(), target });
  };
  const body = (
    <>
      {!bare && <h3>Maqsad sozlamalari</h3>}
      <label>Maqsad nomi</label>
      <input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} placeholder="Masalan: Yangi mashina" />
      <label>Belgi</label>
      <div className="emojis">
        {EMOJIS.map((e) => (
          <button key={e} type="button" className={g.emoji === e ? "on" : ""} onClick={() => setG({ ...g, emoji: e })}>{e}</button>
        ))}
      </div>
      <div className="row">
        <div className="field"><label>Kerakli summa</label><input type="number" inputMode="decimal" value={g.target} onChange={(e) => setG({ ...g, target: e.target.value })} /></div>
        <div className="field"><label>Valyuta</label>
          <select value={g.currency} onChange={(e) => setG({ ...g, currency: e.target.value })}>
            {["so'm", "$", "€", "₽", "₸"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <label>Muddat (ixtiyoriy)</label>
      <input type="date" value={g.deadline} min={today()} onChange={(e) => setG({ ...g, deadline: e.target.value })} />
      <label>Eslatma (nima uchun bu muhim?)</label>
      <input value={g.note} onChange={(e) => setG({ ...g, note: e.target.value })} placeholder="Masalan: oilam uchun" />
      {err && <p className="verdict bad">{err}</p>}
      <button className="cta in" onClick={save}>Saqlash</button>
    </>
  );
  return bare ? <div className="formBare">{body}</div> : <section className="card">{body}</section>;
}

function Chart({ points, target }) {
  const box = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [points.length]);

  if (points.length < 1) return <p className="empty">Grafik birinchi kirimdan keyin paydo bo'ladi.</p>;
  const H = w < 480 ? 210 : 260, L = 10, R = 10, T = 22, B = 28;
  const pts = points.length === 1 ? [{ date: points[0].date, v: 0 }, points[0]] : points;
  const max = Math.max(target, ...pts.map((p) => p.v)) || 1;
  const x = (i) => L + (i * (w - L - R)) / (pts.length - 1);
  const y = (v) => H - B - (Math.max(0, v) / max) * (H - T - B);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.v)}`).join(" ");
  const area = `${line} L${x(pts.length - 1)},${H - B} L${x(0)},${H - B} Z`;
  return (
    <div ref={box} className="chartBox">
      <svg width={w} height={H} className="chart">
        <line x1={L} x2={w - R} y1={y(target)} y2={y(target)} className="tline" />
        <text x={w - R} y={y(target) - 6} textAnchor="end" className="ttext">maqsad</text>
        <path d={area} className="area" />
        <path d={line} className="cline" />
        {pts.length <= 40 && pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r="3.5" className="cdot" />)}
        <text x={L} y={H - 8} className="ttext">{shortDate(pts[0].date)}</text>
        <text x={w - R} y={H - 8} textAnchor="end" className="ttext">{shortDate(pts[pts.length - 1].date)}</text>
      </svg>
    </div>
  );
}

/* ============ Uslublar ============ */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;800&family=Fraunces:opsz,wght@9..144,600;9..144,800&display=swap');
.app{--bg:#e9f0ea;--card:#fbfdf9;--ink:#12281f;--mute:#5d7066;--line:#d3dfd5;--pine:#14452f;--gold:#e0a21b;--coral:#e0522d;--in:#1f8a57;--water:#2f9e6b;
 font-family:'Bricolage Grotesque',system-ui,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;min-height:100dvh;line-height:1.5;color-scheme:light;-webkit-text-size-adjust:100%}
.app.dark{--bg:#0e1a14;--card:#15251d;--ink:#e6f0e8;--mute:#8fa598;--line:#254034;--pine:#7fd4a6;--gold:#f0b73a;--in:#47c98a;--water:#3fb57e;color-scheme:dark}
.app *{box-sizing:border-box}
.app button{font-family:inherit}

/* --- Sarlavha va menyu --- */
.top{display:flex;align-items:center;gap:16px;padding:12px 40px;padding-top:calc(12px + env(safe-area-inset-top));position:sticky;top:0;background:var(--bg);z-index:10;border-bottom:1px solid var(--line)}
.brand{display:flex;gap:10px;align-items:center;font-family:'Fraunces',Georgia,serif;font-size:21px;min-width:0;flex:1}
.brand b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.logo{font-size:26px}
.tabs{display:flex;gap:4px}
.tabs button{display:inline-flex;align-items:center;gap:6px;background:none;border:0;padding:9px 16px;border-radius:99px;color:var(--ink);cursor:pointer;font-size:15px;font-weight:600}
.tabs button.on{background:var(--pine);color:var(--bg)}
.tabs button:hover:not(.on){background:var(--line)}
.tabs .ic{font-size:15px}
.mode{background:none;border:1.5px solid var(--line);width:42px;height:42px;border-radius:50%;cursor:pointer;font-size:18px;flex:none}

/* --- Maket --- */
main{max-width:1120px;margin:0 auto;padding:28px 40px;display:grid;gap:20px}
.cols{display:grid;gap:20px;align-items:start}
.stack{display:grid;gap:20px}
@media(min-width:1000px){.cols{grid-template-columns:1.05fr .95fr}.cols.wide{grid-template-columns:1.2fr .8fr}}

/* --- Bosh blok --- */
.hero{display:grid;grid-template-columns:260px 1fr;gap:40px;align-items:center;padding:36px 40px;border-radius:28px;background:var(--pine);color:#eaf6ee;transform-origin:top center}
.app.dark .hero{background:#1b3a2b}
.hero.shrink{animation:heroShrink .95s cubic-bezier(.6,0,.35,1) both;pointer-events:none}
@keyframes heroShrink{
  0%{transform:none;opacity:1;filter:none}
  35%{transform:scale(.97);opacity:1}
  100%{transform:translateY(-90px) scale(.12);opacity:0;filter:blur(3px)}
}
.hero.fresh{animation:heroIn .9s cubic-bezier(.2,.9,.3,1) both}
@keyframes heroIn{from{opacity:0;transform:translateY(40px) scale(.94)}to{opacity:1;transform:none}}
.jarWrap{display:flex;justify-content:center}
.jar{position:relative;width:200px;height:270px;border:5px solid #eaf6ee;border-radius:30px 30px 70px 70px;overflow:hidden;background:rgba(255,255,255,.08)}
.liquid{position:absolute;bottom:0;left:0;right:0;background:var(--gold);transition:height 1.2s cubic-bezier(.2,.8,.2,1)}
.wave{position:absolute;top:-10px;left:0;width:200%;height:20px;background:radial-gradient(circle at 10px 20px,transparent 10px,var(--gold) 11px) repeat-x;background-size:40px 20px;animation:w 5s linear infinite}
@keyframes w{to{transform:translateX(-40px)}}
.jarPct{position:absolute;inset:0;display:grid;place-items:center;font-family:'Fraunces',serif;font-weight:800;font-size:40px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.5)}
.heroText{min-width:0}
.heroText .muted{color:#b9d7c4;margin:0}
.hero h1{font-family:'Fraunces',serif;font-size:clamp(32px,5vw,60px);margin:4px 0 0;line-height:1.08;letter-spacing:-.02em;overflow-wrap:anywhere}
.hero h1 small{font-size:.4em;font-family:'Bricolage Grotesque',sans-serif;font-weight:600;color:var(--gold)}
.of{margin:4px 0 14px;color:#cfe5d6}
.bar{height:10px;background:rgba(255,255,255,.16);border-radius:9px;overflow:hidden}
.bar div{height:100%;background:var(--gold);transition:width 1s}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.chips span{background:rgba(255,255,255,.12);padding:5px 12px;border-radius:99px;font-size:14px}
.quote{font-family:'Fraunces',serif;font-style:italic;margin:6px 0;color:#f3e3b5;min-height:48px}

/* --- Bajarilgan orzular kartalari --- */
.doneBox{display:grid;gap:8px}
.doneBox h4{margin:0;font-family:'Fraunces',serif;font-size:16px;color:var(--mute);display:flex;gap:8px;align-items:center}
.doneBox h4 em{font-style:normal;background:var(--gold);color:#2a1d00;border-radius:99px;font-size:12px;font-weight:800;padding:1px 9px}
.doneList{display:flex;gap:12px;overflow-x:auto;padding:4px 2px 10px;scroll-snap-type:x proximity}
.doneCard{flex:none;scroll-snap-align:start;position:relative;overflow:hidden;display:flex;gap:14px;align-items:center;min-width:260px;max-width:320px;padding:12px 18px 12px 12px;border-radius:20px;background:linear-gradient(135deg,#14452f,#1f6a49);color:#eaf6ee;box-shadow:0 8px 22px rgba(20,69,47,.28);border:1.5px solid rgba(224,162,27,.55)}
.app.dark .doneCard{background:linear-gradient(135deg,#1b3a2b,#23553c)}
.doneCard::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.2) 50%,transparent 70%);transform:translateX(-120%);animation:shine 5s 1.2s ease-in-out infinite;pointer-events:none}
@keyframes shine{to{transform:translateX(120%)}}
.doneEmoji{position:relative;flex:none;width:50px;height:50px;border-radius:16px;background:rgba(255,255,255,.14);display:grid;place-items:center;font-size:28px}
.doneEmoji i{position:absolute;right:-6px;bottom:-6px;width:21px;height:21px;border-radius:50%;background:var(--gold);color:#2a1d00;font-style:normal;font-size:12px;font-weight:800;display:grid;place-items:center;border:2px solid #14452f}
.doneInfo{min-width:0;display:grid}
.doneInfo b{font-family:'Fraunces',serif;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.doneInfo span{color:#f3e3b5;font-weight:700;font-size:14px}
.doneInfo small{color:#b9d7c4;font-size:12px}
.doneCard.land{animation:landIn 1.2s cubic-bezier(.2,1,.3,1) both;box-shadow:0 0 0 0 rgba(224,162,27,.7),0 8px 22px rgba(20,69,47,.28)}
.doneCard.land .doneEmoji{animation:pop .8s .5s cubic-bezier(.3,1.6,.4,1) both}
@keyframes landIn{
  0%{transform:translateY(240px) scale(2.6);opacity:0}
  35%{opacity:1}
  75%{transform:translateY(-6px) scale(1.04);box-shadow:0 0 0 14px rgba(224,162,27,0),0 8px 22px rgba(20,69,47,.28)}
  100%{transform:none}
}
@keyframes pop{from{transform:scale(.4) rotate(-20deg)}to{transform:none}}

/* --- Kartalar va formalar --- */
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:24px;display:grid;gap:12px;min-width:0}
.card h3{margin:0;font-family:'Fraunces',serif;font-size:20px}
.card label{font-size:13px;color:var(--mute);font-weight:600;margin-bottom:-6px;display:block}
.app input,.app select{width:100%;min-width:0;min-height:48px;padding:12px 14px;border:1.5px solid var(--line);border-radius:12px;background:var(--bg);color:var(--ink);font:inherit;font-size:16px}
.app input:focus,.app select:focus,.app button:focus-visible{outline:3px solid var(--gold);outline-offset:1px}
.row{display:flex;gap:10px;flex-wrap:wrap}.row>*{flex:1 1 150px;min-width:0}
.field{display:grid;gap:8px}
.seg{display:grid;grid-template-columns:1fr 1fr;background:var(--bg);border-radius:12px;padding:4px}
.seg button{border:0;background:none;padding:12px;border-radius:9px;font-weight:700;font-size:16px;cursor:pointer;color:var(--mute)}
.seg .on.in{background:var(--in);color:#fff}.seg .on.out{background:var(--coral);color:#fff}
.quick{display:flex;flex-wrap:wrap;gap:8px}
.quick button,.emojis button{border:1.5px solid var(--line);background:var(--bg);color:var(--ink);padding:10px 16px;min-height:44px;border-radius:99px;cursor:pointer;font-size:15px;font-weight:600}
.quick button:hover{border-color:var(--pine)}
.quick .danger{color:var(--coral);border-color:var(--coral)}
.cta{border:0;min-height:52px;padding:14px;border-radius:14px;font-weight:800;font-size:16px;color:#fff;cursor:pointer}
.cta.in{background:var(--in)}.cta.out{background:var(--coral)}.cta.plain{background:var(--line);color:var(--ink)}
.cta.gold{background:var(--gold);color:#2a1d00;width:100%;margin:6px 0}
.cta.pulse{animation:pulse 1.8s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(224,162,27,.55)}50%{box-shadow:0 0 0 12px rgba(224,162,27,0)}}
.cta:active{transform:scale(.99)}

/* --- Statistika --- */
.grid4{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;display:grid;gap:2px;min-width:0}
.stat small{color:var(--mute);font-size:13px}.stat b{font-family:'Fraunces',serif;font-size:20px;overflow-wrap:anywhere}.stat em{font-style:normal;color:var(--mute);font-size:12px}
.miles{display:flex;justify-content:space-between;gap:6px}
.mile{display:grid;justify-items:center;align-content:start;gap:6px;font-size:12px;color:var(--mute);text-align:center;flex:1;min-width:0}
.dot{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;border:2px dashed var(--line);font-weight:800;font-size:13px}
.mile.done .dot{background:var(--gold);border:2px solid var(--gold);color:#2a1d00;font-size:18px}
.mile.done{color:var(--ink)}

/* --- Tarix --- */
.list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.list li{display:flex;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:14px;background:var(--bg)}
.grow2{flex:1;min-width:0}
.grow2 b{display:block;overflow-wrap:anywhere}
.list small{display:block;color:var(--mute)}
.badge{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;flex:none}
.badge.in{background:var(--in)}.badge.out{background:var(--coral)}
.amt{white-space:nowrap}
b.in{color:var(--in)}b.out{color:var(--coral)}
.x{border:0;background:none;color:var(--mute);cursor:pointer;font-size:16px;width:40px;height:40px;flex:none}.x:hover{color:var(--coral)}
.empty,.muted{color:var(--mute)}
.card p,.box p{margin:0}
.verdict{padding:12px 14px;border-radius:12px;font-weight:600}
.verdict.ok{background:rgba(31,138,87,.15)}.verdict.bad{background:rgba(224,82,45,.15)}
.facts{margin:0;padding-left:18px;display:grid;gap:6px}

/* --- Grafik --- */
.chartBox{width:100%;min-width:0}
.chart{display:block;max-width:100%}
.tline{stroke:var(--gold);stroke-dasharray:6 5;stroke-width:1.5}
.ttext{fill:var(--mute);font-size:12px}
.area{fill:var(--water);opacity:.18}.cline{fill:none;stroke:var(--water);stroke-width:3;stroke-linejoin:round}.cdot{fill:var(--pine)}

/* --- Belgilar, oynalar, bildirish --- */
.emojis{display:flex;flex-wrap:wrap;gap:6px}.emojis button{padding:6px 10px;font-size:22px;border-radius:12px;min-height:44px;min-width:44px}.emojis .on{border-color:var(--pine);background:var(--line)}
.modal{position:fixed;inset:0;background:rgba(5,15,10,.7);display:grid;place-items:center;padding:16px;z-index:40;overflow:auto;animation:fadeIn .4s both}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.box{background:var(--card);border-radius:24px;padding:26px;max-width:480px;width:100%;display:grid;gap:12px;max-height:100%;overflow:auto;animation:boxIn .5s cubic-bezier(.2,1.1,.3,1) both}
@keyframes boxIn{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:none}}
.box h2{font-family:'Fraunces',serif;margin:0}
.formBare{display:grid;gap:10px}
.formBare label{font-size:13px;color:var(--mute);font-weight:600;margin-bottom:-4px}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:12px 18px;border-radius:14px;display:flex;gap:14px;align-items:center;z-index:50;box-shadow:0 10px 30px rgba(0,0,0,.3);max-width:calc(100% - 32px)}
.toast button{background:var(--gold);border:0;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;color:#2a1d00}
footer{text-align:center;color:var(--mute);padding:10px 16px 40px;font-size:14px}

/* --- SMS xabar --- */
.sms{position:fixed;top:84px;right:16px;width:min(360px,calc(100% - 32px));background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:20px;padding:14px 16px;box-shadow:0 18px 50px rgba(0,0,0,.28);z-index:60;cursor:pointer;animation:smsIn .7s cubic-bezier(.2,1.2,.3,1) both}
.sms.leave{animation:smsOut .35s ease-in both}
@keyframes smsIn{from{transform:translateX(130%);opacity:0}to{transform:none;opacity:1}}
@keyframes smsOut{to{transform:translateX(130%);opacity:0}}
.smsHead{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.smsHead small{margin-left:auto;color:var(--mute)}
.smsIc{width:30px;height:30px;border-radius:9px;background:var(--line);display:grid;place-items:center;font-size:17px;animation:ring 1s .7s ease-in-out 2}
@keyframes ring{0%,100%{transform:rotate(0)}20%{transform:rotate(-18deg)}40%{transform:rotate(16deg)}60%{transform:rotate(-10deg)}80%{transform:rotate(6deg)}}
.smsBody{background:var(--bg);border-radius:6px 16px 16px 16px;padding:10px 14px;min-height:42px}
.smsBody p{animation:fadeUp .5s both;line-height:1.45}
.smsHint{display:block;margin-top:8px;color:var(--mute);font-weight:600;text-align:center;animation:fadeUp .5s .4s both}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.typing{display:inline-flex;gap:5px;align-items:center;height:22px}
.typing i{width:8px;height:8px;border-radius:50%;background:var(--mute);animation:blink 1s infinite}
.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}
@keyframes blink{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}
.confetti{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:55}
.confetti i{position:absolute;top:-16px;width:9px;height:14px;border-radius:2px;animation:fall linear forwards}
@keyframes fall{to{top:105%;opacity:.8}}
@media(max-width:680px){.sms{top:calc(64px + env(safe-area-inset-top));right:12px}}
@media(prefers-reduced-motion:reduce){.confetti{display:none}.sms{animation-duration:.01s}.doneCard::after{display:none}.cta.pulse{animation:none}}

/* --- Planshet --- */
@media(max-width:999px){
  .top{padding-left:24px;padding-right:24px}
  main{padding:22px 24px;max-width:780px}
  .hero{grid-template-columns:200px 1fr;gap:28px;padding:28px}
  .jar{width:160px;height:220px}
}

/* --- Telefon: pastki menyu --- */
@media(max-width:680px){
  .top{padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top))}
  .brand{font-size:18px}
  .tabs{position:fixed;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:var(--card);border-top:1px solid var(--line);padding:6px 8px calc(6px + env(safe-area-inset-bottom));z-index:30}
  .tabs button{flex-direction:column;gap:0;padding:6px 2px;font-size:11px;border-radius:12px;min-height:50px;justify-content:center}
  .tabs .ic{font-size:21px}
  main{padding:16px 14px 96px;gap:16px}
  .cols,.stack{gap:16px}
  .hero{grid-template-columns:1fr;gap:18px;padding:22px 18px;border-radius:24px;text-align:left}
  .jar{width:140px;height:190px;border-radius:24px 24px 56px 56px}
  .jarPct{font-size:30px}
  .card{padding:18px;border-radius:18px}
  .grid3{grid-template-columns:1fr}
  .grid3 .stat{grid-template-columns:1fr auto;align-items:center}
  .toast{bottom:84px}
  .dot{width:40px;height:40px;font-size:12px}
  .mile{font-size:11px}
  .doneCard{min-width:230px}
  footer{display:none}
}
@media(max-width:360px){.quick button{padding:10px 12px}.hero h1{font-size:30px}}
@media(prefers-reduced-motion:reduce){.wave{animation:none}.liquid,.bar div{transition:none}.hero.shrink,.hero.fresh,.doneCard.land{animation-duration:.01s}}
`;