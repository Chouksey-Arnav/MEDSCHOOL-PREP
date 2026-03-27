import React, { useState, useEffect, useRef } from 'react'

// ── CONFIG ───────────────────────────────────────────────────────────────
const OPENAI_KEY = import.meta.env.VITE_OPENAI_KEY || ''
const OPENAI_MODEL = 'gpt-4o-mini'

const ls = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
}

// ── PRE-BUILT STUDY PLANS (Not just chat prompts!) ───────────────────────
const STUDY_PLANS = [
  { 
    id: 'p1', title: 'MCAT 30-Day Crash Course', focus: 'High-Yield Review', color: '#3B82F6', icon: '⚡',
    desc: 'A relentless, day-by-day breakdown of the most highly tested MCAT concepts.',
    schedule: [
      { day: 'Day 1', title: 'Amino Acids & Enzyme Kinetics', tasks: ['Memorize 20 standard AAs', 'Michaelis-Menten Quiz', '2 CARS Passages'] },
      { day: 'Day 2', title: 'Metabolism: Glycolysis & TCA', tasks: ['Draw Glycolysis Pathway', 'Cellular Respiration Quiz', 'Psych/Soc: Theories of Emotion'] },
      { day: 'Day 3', title: 'Physics: Kinematics & Fluids', tasks: ['Memorize Fluid Equations', 'Newtonian Mechanics Quiz', '2 CARS Passages'] },
      { day: 'Day 4', title: 'Full Length Review Day', tasks: ['Take FL Exam 1', 'Review all incorrect answers in AI Coach'] }
    ]
  },
  { 
    id: 'p2', title: 'AMCAS Application Prep', focus: 'Admissions', color: '#10B981', icon: '📝',
    desc: 'Structured timeline to draft your personal statement and work/activities.',
    schedule: [
      { day: 'Week 1', title: 'Brainstorming Core Stories', tasks: ['Log 3 impactful clinical experiences', 'Identify "Seed" for Personal Statement'] },
      { day: 'Week 2', title: 'Drafting the Statement', tasks: ['Write messy first draft', 'Run draft through AI Coach for critique'] },
    ]
  }
]

// ── QUIZ DATA (Answer varied: 0=A, 1=B, 2=C, 3=D) ────────────────────────
const QUIZZES = [
  {
    id:'q01', cat:'Biochemistry', title:'Metabolism & Enzymes', diff:'Hard',
    qs:[
      {q:'Which enzyme catalyzes the rate-limiting step of glycolysis?',ch:['Hexokinase','Phosphofructokinase-1','Pyruvate kinase','Aldolase'],ans:1,exp:'PFK-1 is the primary regulatory enzyme.'},
      {q:'Competitive inhibitors change enzyme kinetics by:',ch:['Decreasing Vmax','Decreasing Km','Increasing Km without affecting Vmax','Increasing Vmax'],ans:2,exp:'They compete for the active site, requiring more substrate (higher Km) but Vmax remains the same.'}
    ]
  }
]

// ── MAIN APP ────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('plans') // 'coach', 'plans', 'quiz', 'amcas'
  const [activePlan, setActivePlan] = useState(null)
  const [activities, setActivities] = useState([]) // For AMCAS Vault
  
  // AI Coach State
  const [messages, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoad] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    document.body.style.margin = '0'
    document.body.style.background = '#030712'
    document.body.style.color = '#F9FAFB'
    document.body.style.fontFamily = 'system-ui, sans-serif'
    
    const savedVault = ls.get('msp_vault')
    if (savedVault) setActivities(savedVault)
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendToCoach = async () => {
    if (!input.trim() || loading) return
    const newMsgs = [...messages, { role: 'user', content: input }]
    setMsgs(newMsgs)
    setInput('')
    setLoad(true)
    
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: 'system', content: 'You are MedSchoolPrep AI.' }, ...newMsgs] }),
      })
      const data = await res.json()
      setMsgs([...newMsgs, { role: 'assistant', content: data.choices[0].message.content }])
    } catch {
      setMsgs([...newMsgs, { role: 'assistant', content: 'Network error. Please try again.' }])
    }
    setLoad(false)
  }

  const addActivity = () => {
    const newAct = [...activities, { id: Date.now(), title: 'New Clinical Experience', hours: 0, notes: '' }]
    setActivities(newAct)
    ls.set('msp_vault', newAct)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#030712' }}>
      
      {/* ── SIDEBAR ── */}
      <div style={{ width: 260, background: '#0B0F19', borderRight: '1px solid #1F2937', padding: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #3B82F6, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>M</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>MedSchoolPrep</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => {setTab('plans'); setActivePlan(null)}} style={navStyle(tab === 'plans')}>📅 Study Plans</button>
          <button onClick={() => {setTab('coach'); setActivePlan(null)}} style={navStyle(tab === 'coach')}>💬 AI Coach</button>
          <button onClick={() => {setTab('amcas'); setActivePlan(null)}} style={navStyle(tab === 'amcas')}>🏥 AMCAS Vault</button>
          <button onClick={() => {setTab('quiz'); setActivePlan(null)}} style={navStyle(tab === 'quiz')}>🧠 Quiz Engine</button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 40, position: 'relative' }}>
        
        {/* Background Glow */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '80%', height: 300, background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 60%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 10 }}>
          
          {/* ── STUDY PLANS UI ── */}
          {tab === 'plans' && !activePlan && (
            <div>
              <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>Structured Programs</h1>
              <p style={{ color: '#9CA3AF', marginBottom: 40 }}>Pre-built, highly optimized schedules for the MCAT and admissions.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                {STUDY_PLANS.map(p => (
                  <div key={p.id} onClick={() => setActivePlan(p)} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 20, padding: 24, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <div style={{ fontSize: 32, marginBottom: 16 }}>{p.icon}</div>
                    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{p.title}</h3>
                    <div style={{ fontSize: 13, color: p.color, fontWeight: 600, marginBottom: 12 }}>{p.focus}</div>
                    <p style={{ color: '#9CA3AF', fontSize: 14 }}>{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ACTIVE PLAN DETAIL UI (The beautiful timeline) ── */}
          {tab === 'plans' && activePlan && (
            <div>
              <button onClick={() => setActivePlan(null)} style={{ background: 'none', border: 'none', color: '#60A5FA', cursor: 'pointer', marginBottom: 20 }}>← Back to Plans</button>
              <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>{activePlan.title}</h1>
              <div style={{ height: 4, background: '#1F2937', borderRadius: 2, marginBottom: 40, overflow: 'hidden' }}>
                 <div style={{ height: '100%', width: '15%', background: activePlan.color }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {activePlan.schedule.map((day, i) => (
                  <div key={i} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 16, padding: 24, display: 'flex', gap: 20 }}>
                    <div style={{ minWidth: 80 }}>
                      <div style={{ fontSize: 14, color: activePlan.color, fontWeight: 700 }}>{day.day}</div>
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{day.title}</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {day.tasks.map((task, j) => (
                          <label key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                            <input type="checkbox" style={{ width: 18, height: 18, accentColor: activePlan.color }} />
                            <span style={{ color: '#D1D5DB', fontSize: 15 }}>{task}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AMCAS VAULT UI ── */}
          {tab === 'amcas' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
                <div>
                  <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>AMCAS Activity Vault</h1>
                  <p style={{ color: '#9CA3AF' }}>Log your clinical, shadowing, and research hours. The AI will write your descriptions later.</p>
                </div>
                <button onClick={addActivity} style={{ padding: '10px 20px', background: '#3B82F6', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, cursor: 'pointer' }}>+ Add Activity</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {activities.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, background: '#111827', borderRadius: 20, border: '1px dashed #374151', color: '#9CA3AF' }}>No activities logged yet. Start tracking your premed journey!</div>
                ) : activities.map((act, i) => (
                  <div key={act.id} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 16, padding: 24 }}>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                      <input type="text" placeholder="Activity Title (e.g. Scribe at ER)" style={inputStyle} defaultValue={act.title} />
                      <input type="number" placeholder="Hours" style={{...inputStyle, width: 120}} defaultValue={act.hours} />
                    </div>
                    <textarea placeholder="Brain dump what happened. The AI will make it sound professional later..." style={{...inputStyle, height: 100, resize: 'none'}} defaultValue={act.notes} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AI COACH UI ── */}
          {tab === 'coach' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
                {messages.length === 0 && <div style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '20vh' }}>Ask me anything about the MCAT or your application...</div>}
                {messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 20 }}>
                    <div style={{ maxWidth: '80%', padding: '16px 20px', borderRadius: 20, background: m.role === 'user' ? '#2563EB' : '#1F2937', color: '#fff', lineHeight: 1.5 }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && <div style={{ color: '#9CA3AF' }}>Coach is typing...</div>}
                <div ref={bottomRef} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') sendToCoach()}} placeholder="Message your AI Coach..." style={{ flex: 1, ...inputStyle }} />
                <button onClick={sendToCoach} style={{ padding: '0 24px', background: '#3B82F6', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Send</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

const navStyle = (active) => ({ background: active ? '#1F2937' : 'transparent', color: active ? '#fff' : '#9CA3AF', border: 'none', padding: '12px 16px', borderRadius: 10, textAlign: 'left', fontSize: 14, fontWeight: 600, cursor: 'pointer' })
const inputStyle = { width: '100%', padding: '14px', background: '#0B0F19', border: '1px solid #374151', borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' }
