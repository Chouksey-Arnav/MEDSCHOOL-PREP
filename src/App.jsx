import React, { useState, useEffect, useRef, useCallback } from 'react'

// ── CONFIG ── paste your key here ────────────────────────────────────────
const OPENAI_KEY = import.meta.env.VITE_OPENAI_KEY || 'sk-proj-REPLACE_WITH_YOUR_KEY'
const OPENAI_MODEL = 'gpt-4o-mini'

// ── localStorage helpers ─────────────────────────────────────────────────
const ls = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
  del: (k) => { try { localStorage.removeItem(k) } catch {} },
}

const hashPw = (s) => { let h = 5381; for (let i=0;i<s.length;i++) h = ((h<<5)+h)+s.charCodeAt(i)|0; return (h>>>0).toString(16) }

// ── STUDY PLANS DATA ─────────────────────────────────────────────────────
const STUDY_PLANS = [
  { id: 'p1', title: 'MCAT 3-Month Mastery', focus: 'Comprehensive', duration: '90 Days', color: '#3B82F6', icon: '🧠', desc: 'A relentless, day-by-day breakdown of B/B, C/P, P/S, and CARS. Includes built-in full-length review days.' },
  { id: 'p2', title: 'Biochem & Biology Deep Dive', focus: 'Targeted Review', duration: '30 Days', color: '#10B981', icon: '🧬', desc: 'Focus heavily on high-yield metabolism, genetics, and cell biology. Perfect if B/B is your lowest section.' },
  { id: 'p3', title: 'CARS Daily Strategy', focus: 'Critical Analysis', duration: 'Ongoing', color: '#8B5CF6', icon: '📖', desc: '3 passages a day. Focuses on logic, author tone, and eliminating trap answers without burnout.' },
  { id: 'p4', title: 'Interview & MMI Bootcamp', focus: 'Admissions', duration: '14 Days', color: '#F59E0B', icon: '🎤', desc: 'Daily ethical scenarios, healthcare policy reviews, and personal statement refinement.' }
]

// ── QUIZ DATA (Answers carefully varied: 0=A, 1=B, 2=C, 3=D) ─────────────
const QUIZZES = [
  {
    id:'q01', cat:'Biochemistry', title:'Glycolysis & Regulation', diff:'Hard',
    qs:[
      {q:'Which enzyme catalyzes the rate-limiting, irreversible step of glycolysis?',ch:['Hexokinase','Phosphofructokinase-1','Pyruvate kinase','Phosphoglucose isomerase'],ans:1,exp:'PFK-1 is the primary regulatory enzyme of glycolysis.'},
      {q:'Arsenate poisoning uncouples substrate-level phosphorylation in glycolysis because it:',ch:['Inhibits PFK-1 directly','Chelates NAD⁺ in the cytoplasm','Substitutes for phosphate forming an unstable 1-arseno-3-PG','Blocks aldolase irreversibly'],ans:2,exp:'Arsenate replaces inorganic phosphate in the GAPDH reaction.'},
      {q:'Net ATP yield from glycolysis of one glucose (cytoplasm only) is:',ch:['4 ATP','8 ATP','2 ATP','6 ATP'],ans:2,exp:'Glycolysis produces 4 ATP gross but invests 2 ATP.'},
      {q:'In the Cori cycle, lactate released by muscle is converted to glucose in which organ?',ch:['Kidney','Skeletal muscle','Brain','Liver'],ans:3,exp:'The liver takes up lactate from anaerobic muscle and converts it to glucose.'},
      {q:'Pyruvate kinase deficiency in RBCs most directly causes:',ch:['Hemolytic anemia due to ATP depletion','Polycythemia vera','Methemoglobinemia','Iron-deficiency anemia'],ans:0,exp:'RBCs rely entirely on glycolysis for ATP.'}
    ]
  },
  {
    id:'q02', cat:'Physiology', title:'Cardiovascular Dynamics', diff:'Hard',
    qs:[
      {q:'The Frank-Starling mechanism states that stroke volume increases when:',ch:['Heart rate increases','Preload (EDV) increases','Afterload decreases','Peripheral resistance falls'],ans:1,exp:'Increased venous return stretches sarcomeres to optimal length.'},
      {q:'Which coronary artery is most commonly occluded in an anterior STEMI?',ch:['RCA','LCx','PDA','LAD'],ans:3,exp:'The LAD supplies the anterior wall and anterior 2/3 of the septum.'},
      {q:'Atrial natriuretic peptide (ANP) causes:',ch:['Vasoconstriction','Vasodilation and natriuresis','Increased ADH','Decreased renin with water retention'],ans:1,exp:'ANP reduces preload and blood pressure.'},
      {q:'Pulsus paradoxus is characteristic of:',ch:['Aortic regurgitation','Cardiac tamponade','Aortic stenosis','Hypertrophic cardiomyopathy'],ans:1,exp:'Exaggerated drop in systolic BP during inspiration due to constrained RV filling.'},
      {q:'Afterload on the left ventricle is most directly represented by:',ch:['EDV','PCWP','CVP','Systemic vascular resistance (SVR)'],ans:3,exp:'SVR determines the force the LV must overcome to eject blood.'}
    ]
  }
]

// ── SYSTEM PROMPT ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are MedSchoolPrep AI — an elite, brilliant, and empathetic medical school preparation coach. 
Tone: Premium, highly intelligent, encouraging, mirroring the dark-mode/sleek aesthetic of the app.
Mission: Help with MCAT, AMCAS, interviews, and study plans. 
If the user asks for a study plan, generate a highly structured, day-by-day markdown schedule. Keep formatting clean and readable.`

// ── AUTH MODAL ──────────────────────────────────────────────────────────
function AuthModal({ onSuccess, onClose }) {
  const [view, setView] = useState('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')

  const handleAuth = () => {
    if (!email.includes('@')) return setMsg('Enter a valid email.')
    if (pw.length < 6) return setMsg('Password must be at least 6 characters.')
    
    const users = ls.get('msp_users') || {}
    const key = email.toLowerCase()

    if (view === 'signup') {
      if (users[key]) return setMsg('Account already exists.')
      users[key] = { name: name || 'Premed', hash: hashPw(pw) }
      ls.set('msp_users', users)
    } else {
      if (!users[key] || users[key].hash !== hashPw(pw)) return setMsg('Invalid credentials.')
    }

    const sess = { email: key, name: users[key].name || name }
    ls.set('msp_session', sess)
    onSuccess(sess)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 24, padding: 40, width: '100%', maxWidth: 420, color: '#fff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{view === 'login' ? 'Welcome Back' : 'Start Your Journey'}</h2>
        <p style={{ color: '#9CA3AF', marginBottom: 24, fontSize: 14 }}>{view === 'login' ? 'Log in to continue your prep.' : 'Create an account to save your progress.'}</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {view === 'signup' && <input placeholder="First Name" value={name} onChange={e=>setName(e.target.value)} style={inpStyle} />}
          <input placeholder="Email Address" type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inpStyle} />
          <input placeholder="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)} style={inpStyle} />
          {msg && <div style={{ color: '#EF4444', fontSize: 13 }}>{msg}</div>}
          
          <button onClick={handleAuth} style={{ background: 'linear-gradient(135deg, #3B82F6, #10B981)', padding: 14, borderRadius: 12, border: 'none', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginTop: 8 }}>
            {view === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>
        
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button onClick={() => setView(view === 'login' ? 'signup' : 'login')} style={{ background: 'none', border: 'none', color: '#60A5FA', cursor: 'pointer', fontSize: 14 }}>
            {view === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
        {onClose && <div style={{ marginTop: 16, textAlign: 'center' }}><button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 13 }}>Continue as guest</button></div>}
      </div>
    </div>
  )
}

const inpStyle = { width: '100%', padding: '14px 16px', borderRadius: 12, background: '#1F2937', border: '1px solid #374151', color: '#fff', outline: 'none', fontSize: 15, boxSizing: 'border-box' }

// ── MAIN APP ────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSess] = useState(null)
  const [messages, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoad] = useState(false)
  const [tab, setTab] = useState('chat') // 'chat', 'quiz', 'plans'
  const [activeQuiz, setAQ] = useState(null)
  const [showAuth, setAuth] = useState(false)
  const [progress, setProg] = useState({})
  
  const bottomRef = useRef(null)

  useEffect(() => {
    // Inject global dark styles to body to ensure pure full-screen
    document.body.style.margin = '0'
    document.body.style.background = '#030712'
    document.body.style.color = '#F9FAFB'
    document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    document.body.style.overflow = 'hidden'

    const s = ls.get('msp_session')
    if (s) {
      setSess(s)
      setMsgs(ls.get('msp_history_' + s.email) || [])
      setProg(ls.get('msp_progress_' + s.email) || {})
    }
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading, tab])

  const sendMessage = async (text, hiddenPrompt = null) => {
    if (!text?.trim() && !hiddenPrompt) return
    if (!hiddenPrompt) setInput('')
    
    const userMsg = { role: 'user', content: text }
    const next = hiddenPrompt ? [...messages, { role: 'user', content: hiddenPrompt }] : [...messages, userMsg]
    
    // Only show the readable text to the user if it's a hidden prompt macro
    if (hiddenPrompt) {
      setMsgs([...messages, userMsg])
    } else {
      setMsgs(next)
    }
    
    setLoad(true)
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...next],
        }),
      })
      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content || "Connection error. Please try again."
      const final = [...(hiddenPrompt ? [...messages, userMsg] : next), { role: 'assistant', content: reply }]
      setMsgs(final)
      if (session) ls.set('msp_history_' + session.email, final)
    } catch {
      setMsgs([...next, { role: 'assistant', content: "Network error. Please try again." }])
    }
    setLoad(false)
  }

  const selectPlan = (plan) => {
    setTab('chat')
    const prompt = `I would like to start the "${plan.title}". Please generate a detailed day-by-day or week-by-week schedule for this plan.`
    sendMessage(`Start Plan: ${plan.title}`, prompt)
  }

  // ── RENDER HELPERS ──
  const formatText = (text) => text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#fff">$1</strong>').replace(/\n/g, '<br/>')

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#030712' }}>
      
      {showAuth && <AuthModal onSuccess={(s) => { setSess(s); setAuth(false) }} onClose={() => setAuth(false)} />}

      {/* ── SIDEBAR (Desktop Full Height) ── */}
      <div style={{ width: 280, background: '#111827', borderRight: '1px solid #1F2937', display: 'flex', flexDirection: 'column', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #3B82F6, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 16, boxShadow: '0 0 15px rgba(59,130,246,0.4)' }}>M</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>MedSchoolPrep</div>
            <div style={{ fontSize: 11, color: '#3B82F6', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Pro AI Coach</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <button onClick={() => { setTab('chat'); setAQ(null) }} style={navBtnStyle(tab === 'chat')}>💬 AI Coach</button>
          <button onClick={() => { setTab('plans'); setAQ(null) }} style={navBtnStyle(tab === 'plans')}>📅 Study Plans</button>
          <button onClick={() => { setTab('quiz'); setAQ(null) }} style={navBtnStyle(tab === 'quiz')}>🧠 Quiz Engine</button>
        </div>

        {session ? (
          <div style={{ padding: 16, background: '#1F2937', borderRadius: 16, border: '1px solid #374151' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB', marginBottom: 2 }}>{session.name}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.email}</div>
            <button onClick={() => { ls.del('msp_session'); setSess(null); setMsgs([]) }} style={{ width: '100%', padding: '8px', background: '#374151', borderRadius: 8, border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Log Out</button>
          </div>
        ) : (
          <button onClick={() => setAuth(true)} style={{ padding: 16, background: 'linear-gradient(135deg, #3B82F6, #10B981)', borderRadius: 16, border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}>
            Sign In / Sign Up
          </button>
        )}
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* Top Gradient Glow (Critique AI style) */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: 200, background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '40px', zIndex: 1, position: 'relative' }}>
          
          {/* TAB: PLANS */}
          {tab === 'plans' && (
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>AI-Powered Plans</h1>
              <p style={{ color: '#9CA3AF', fontSize: 16, marginBottom: 40 }}>Select a target path. The AI will instantly generate a structured, day-by-day curriculum tailored to your goals.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                {STUDY_PLANS.map(p => (
                  <div key={p.id} onClick={() => selectPlan(p)} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 20, padding: 24, cursor: 'pointer', transition: 'all 0.2s', ':hover': { borderColor: p.color, transform: 'translateY(-2px)' } }} className="plan-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: `${p.color}20`, color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{p.icon}</div>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#1F2937', color: '#D1D5DB' }}>{p.duration}</span>
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#F9FAFB' }}>{p.title}</h3>
                    <div style={{ fontSize: 13, color: p.color, fontWeight: 600, marginBottom: 12 }}>{p.focus}</div>
                    <p style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.5 }}>{p.desc}</p>
                    <button style={{ width: '100%', marginTop: 20, padding: 12, background: '#1F2937', borderRadius: 10, border: 'none', color: '#fff', fontWeight: 600 }}>Select Plan →</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: QUIZ */}
          {tab === 'quiz' && (
             <div style={{ maxWidth: 900, margin: '0 auto' }}>
              {activeQuiz ? (
                // Super minimal placeholder for Quiz Engine logic to save space - you can paste the full QuizEngine here
                <div style={{ background: '#111827', padding: 40, borderRadius: 24, border: '1px solid #1F2937', textAlign: 'center' }}>
                  <h2 style={{ fontSize: 24, marginBottom: 16 }}>{activeQuiz.title}</h2>
                  <p style={{ color: '#9CA3AF', marginBottom: 24 }}>Question 1 of {activeQuiz.qs.length}</p>
                  <p style={{ fontSize: 18, marginBottom: 30 }}>{activeQuiz.qs[0].q}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500, margin: '0 auto' }}>
                    {activeQuiz.qs[0].ch.map((c, i) => (
                      <button key={i} onClick={() => setAQ(null)} style={{ padding: 16, background: '#1F2937', border: '1px solid #374151', borderRadius: 12, color: '#fff', fontSize: 15, cursor: 'pointer', textAlign: 'left' }}>{c}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>Quiz Engine</h1>
                  <p style={{ color: '#9CA3AF', fontSize: 16, marginBottom: 40 }}>Test your knowledge against high-yield concepts.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {QUIZZES.map(q => (
                      <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 24, background: '#111827', borderRadius: 20, border: '1px solid #1F2937' }}>
                        <div>
                          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{q.title}</h3>
                          <div style={{ fontSize: 13, color: '#9CA3AF' }}>{q.cat} • {q.diff} • {q.qs.length} Questions</div>
                        </div>
                        <button onClick={() => setAQ(q)} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #3B82F6, #10B981)', borderRadius: 10, border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Start Quiz</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
             </div>
          )}

          {/* TAB: CHAT */}
          {tab === 'chat' && (
            <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
              
              {messages.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingTop: '10vh' }}>
                  <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #3B82F6, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, marginBottom: 24, boxShadow: '0 0 40px rgba(16,185,129,0.3)' }}>M</div>
                  <h1 style={{ fontSize: 42, fontWeight: 800, marginBottom: 16, letterSpacing: '-0.03em' }}>Build Unstoppable <br/>Medical Knowledge.</h1>
                  <p style={{ color: '#9CA3AF', fontSize: 18, maxWidth: 500, lineHeight: 1.6, marginBottom: 40 }}>Your personal AI coach for the MCAT, AMCAS, and burnout. Ask a question or select a quick prompt below.</p>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 600 }}>
                    {['Explain Glycolysis', 'Review my AMCAS intro', 'Mock MMI scenario', 'I feel burnt out'].map(p => (
                      <button key={p} onClick={() => sendMessage(p)} style={{ padding: '12px 20px', background: '#111827', border: '1px solid #1F2937', borderRadius: 100, color: '#D1D5DB', fontSize: 14, cursor: 'pointer', transition: 'all 0.2s' }}>{p}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, paddingBottom: 20 }}>
                  {messages.map((m, i) => {
                    const isUser = m.role === 'user'
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 24 }}>
                        {!isUser && <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #3B82F6, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 14, marginRight: 12, flexShrink: 0, marginTop: 4 }}>M</div>}
                        <div style={{ maxWidth: '85%', background: isUser ? '#2563EB' : '#111827', border: isUser ? 'none' : '1px solid #1F2937', borderRadius: 20, borderTopLeftRadius: isUser ? 20 : 4, borderTopRightRadius: isUser ? 4 : 20, padding: '16px 20px', fontSize: 15, lineHeight: 1.6, color: '#F9FAFB', boxShadow: isUser ? '0 4px 15px rgba(37,99,235,0.3)' : '0 4px 15px rgba(0,0,0,0.2)' }}>
                          <span dangerouslySetInnerHTML={{ __html: formatText(m.content) }} />
                        </div>
                      </div>
                    )
                  })}
                  {loading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #3B82F6, #10B981)', marginRight: 12 }} />
                      <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '4px 20px 20px 20px', padding: '16px 20px', display: 'flex', gap: 6 }}>
                        <div style={{ width: 8, height: 8, background: '#4B5563', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
                        <div style={{ width: 8, height: 8, background: '#4B5563', borderRadius: '50%', animation: 'pulse 1s infinite 0.2s' }} />
                        <div style={{ width: 8, height: 8, background: '#4B5563', borderRadius: '50%', animation: 'pulse 1s infinite 0.4s' }} />
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CHAT INPUT BAR ── */}
        {tab === 'chat' && (
          <div style={{ padding: '24px 40px', background: 'linear-gradient(to top, #030712 80%, transparent)', zIndex: 10 }}>
            <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative' }}>
              <input 
                value={input} 
                onChange={e=>setInput(e.target.value)} 
                onKeyDown={e=>{ if(e.key === 'Enter') sendMessage(input) }}
                placeholder="Ask your AI coach anything..."
                style={{ width: '100%', padding: '20px 60px 20px 24px', background: '#111827', border: '1px solid #374151', borderRadius: 20, color: '#fff', fontSize: 16, outline: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}
              />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading} style={{ position: 'absolute', right: 12, top: 12, bottom: 12, width: 44, borderRadius: 12, background: input.trim() ? '#2563EB' : '#374151', border: 'none', color: '#fff', cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
                ↑
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* CSS For Hover Effects & Animations */}
      <style>{`
        .plan-card:hover { border-color: #3B82F6 !important; }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>
    </div>
  )
}

const navBtnStyle = (active) => ({
  background: active ? '#1F2937' : 'transparent',
  color: active ? '#fff' : '#9CA3AF',
  border: 'none',
  padding: '12px 16px',
  borderRadius: 12,
  textAlign: 'left',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s'
})
