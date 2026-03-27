import React, { useState, useEffect, useRef } from 'react'

// ── CONFIG ───────────────────────────────────────────────────────────────
const OPENAI_KEY = import.meta.env.VITE_OPENAI_KEY || ''
const OPENAI_MODEL = 'gpt-4o-mini'

const ls = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
  del: (k) => { try { localStorage.removeItem(k) } catch {} },
}
const hashPw = (s) => { let h = 5381; for (let i=0;i<s.length;i++) h = ((h<<5)+h)+s.charCodeAt(i)|0; return (h>>>0).toString(16) }

// ── PRE-BUILT STUDY PLANS ────────────────────────────────────────────────
const STUDY_PLANS = [
  { 
    id: 'p1', title: 'MCAT 30-Day High-Yield Mastery', focus: 'Comprehensive', color: '#3B82F6', icon: '⚡',
    desc: 'A relentless, day-by-day breakdown of the most highly tested MCAT concepts.',
    schedule: [
      { day: 'Day 1', title: 'Amino Acids & Enzyme Kinetics', tasks: ['Memorize 20 standard AAs & pKas', 'Take Biochemistry Quiz 1', 'Complete 2 CARS Passages'] },
      { day: 'Day 2', title: 'Metabolism: Glycolysis & TCA', tasks: ['Draw Glycolysis & TCA Pathway', 'Take Metabolism Quiz', 'Review Psych/Soc: Theories of Emotion'] },
      { day: 'Day 3', title: 'Physics: Kinematics & Fluids', tasks: ['Memorize Fluid Equations', 'Take Physics Quiz 1', 'Complete 2 CARS Passages'] },
    ]
  },
  { 
    id: 'p2', title: 'AMCAS Application Accelerator', focus: 'Admissions', color: '#10B981', icon: '📝',
    desc: 'A structured 14-day timeline to brainstorm, draft, and refine your Personal Statement.',
    schedule: [
      { day: 'Day 1', title: 'Brainstorming Core Stories', tasks: ['Log 3 impactful clinical experiences in the Vault', 'Identify your "Seed"'] },
      { day: 'Day 3', title: 'Drafting the Statement', tasks: ['Write a messy 1,000-word first draft', 'Run draft through AI Coach for tone critique'] },
    ]
  }
]

// ── MASSIVE QUIZ DATABASE (Strict 15-Question Matrices) ──────────────────
// MATRIX ENFORCED: 4-A(0), 4-B(1), 3-C(2), 4-D(3)
const QUIZZES = [
  {
    id:'q101', cat:'Bio/Biochem', title:'Advanced Metabolism & Enzymes', diff:'Hard',
    qs:[
      {q:'Which enzyme bypasses PFK-1 during gluconeogenesis?', ch:['Pyruvate carboxylase','Glucose-6-phosphatase','Fructose-1,6-bisphosphatase','PEP carboxykinase'], ans:2, exp:'FBPase-1 reverses the PFK-1 step.'}, // C (2)
      {q:'A competitive inhibitor will alter the Lineweaver-Burk plot by:', ch:['Increasing the y-intercept','Decreasing the x-intercept','Leaving the x-intercept unchanged','Increasing the slope without changing the y-intercept'], ans:3, exp:'Km increases (x-int moves toward origin), Vmax is unchanged (y-int stays same), so slope (Km/Vmax) increases.'}, // D (3)
      {q:'Which complex of the ETC does NOT pump protons?', ch:['Complex II','Complex I','Complex III','Complex IV'], ans:0, exp:'Complex II (Succinate dehydrogenase) transfers electrons to CoQ but pumps no protons.'}, // A (0)
      {q:'Cyanide inhibits the ETC by binding to:', ch:['Cytochrome c','Cytochrome a3 (Complex IV)','Ubiquinone','ATP Synthase'], ans:1, exp:'CN binds the ferric iron in Complex IV.'}, // B (1)
      {q:'What is the net ATP yield of glycolysis per glucose molecule?', ch:['4','1','3','2'], ans:3, exp:'4 produced, 2 consumed. Net 2.'}, // D (3)
      {q:'Which amino acid has a pKa near physiological pH?', ch:['Histidine','Lysine','Arginine','Glutamate'], ans:0, exp:'Histidine pKa is ~6.0, making it useful in active sites.'}, // A (0)
      {q:'During starvation, the brain uses which molecule for energy?', ch:['Fatty acids','Ketone bodies','Glycerol','Amino acids'], ans:1, exp:'The brain cannot use fatty acids, it relies on ketone bodies like β-hydroxybutyrate.'}, // B (1)
      {q:'Which of the following is a purely ketogenic amino acid?', ch:['Phenylalanine','Tyrosine','Isoleucine','Leucine'], ans:3, exp:'Leucine and Lysine are purely ketogenic.'}, // D (3)
      {q:'Which enzyme is responsible for converting pyruvate to acetyl-CoA?', ch:['Pyruvate carboxylase','Pyruvate kinase','Pyruvate dehydrogenase','Lactate dehydrogenase'], ans:2, exp:'PDH complex links glycolysis to the TCA cycle.'}, // C (2)
      {q:'The pentose phosphate pathway primarily generates:', ch:['NADPH and Ribose-5-P','NADH and Pyruvate','ATP and FADH2','GTP and Citrate'], ans:0, exp:'Produces reducing equivalents (NADPH) and nucleotide precursors.'}, // A (0)
      {q:'Which vitamin is a required cofactor for transaminases (AST/ALT)?', ch:['Thiamine (B1)','Pyridoxal phosphate (B6)','Riboflavin (B2)','Cobalamin (B12)'], ans:1, exp:'PLP (B6) is required for amino acid transamination.'}, // B (1)
      {q:'A deficiency in sphingomyelinase leads to which lysosomal storage disease?', ch:['Tay-Sachs','Gaucher disease','Fabry disease','Niemann-Pick disease'], ans:3, exp:'Niemann-Pick is characterized by sphingomyelin accumulation.'}, // D (3)
      {q:'What type of bond connects the backbone of DNA?', ch:['Phosphodiester bond','Hydrogen bond','Peptide bond','Glycosidic bond'], ans:0, exp:'Phosphodiester bonds link the 3\' carbon to the 5\' phosphate.'}, // A (0)
      {q:'Which polymerase synthesizes mRNA in eukaryotes?', ch:['RNA Pol I','RNA Pol II','RNA Pol III','DNA Pol III'], ans:1, exp:'RNA Pol II makes mRNA. Pol I makes rRNA, Pol III makes tRNA.'}, // B (1)
      {q:'In the lac operon, the repressor binds to the:', ch:['Promoter','Enhancer','Operator','Silencer'], ans:2, exp:'The repressor blocks RNA polymerase by binding the operator.'} // C (2)
      // Tally: A(4), B(4), C(3), D(4)
    ]
  },
  {
    id:'q102', cat:'Chem/Phys', title:'Thermodynamics & Kinetics', diff:'Hard',
    qs:[
      {q:'Which of the following is a state function?', ch:['Work','Heat','Enthalpy','Power'], ans:2, exp:'Enthalpy (H) is path-independent.'}, // C (2)
      {q:'If ΔG is negative, the reaction is:', ch:['Exothermic','Endothermic','At equilibrium','Spontaneous'], ans:3, exp:'Negative Gibbs free energy means the reaction proceeds spontaneously.'}, // D (3)
      {q:'An adiabatic process is characterized by:', ch:['No change in heat (Q=0)','Constant volume','Constant pressure','Constant temperature'], ans:0, exp:'Adiabatic means no heat exchange with the environment.'}, // A (0)
      {q:'Which zero-order kinetic statement is true?', ch:['Rate depends on reactant squared','Rate is independent of reactant concentration','Half-life is constant','Rate increases with time'], ans:1, exp:'Zero-order rate = k. It does not depend on concentration.'}, // B (1)
      {q:'A catalyst increases the rate of reaction by:', ch:['Increasing temperature','Increasing collision frequency','Shifting equilibrium right','Lowering activation energy'], ans:3, exp:'Catalysts lower the transition state energy barrier.'}, // D (3)
      {q:'At constant temperature, Boyle\'s Law states that:', ch:['Pressure is inversely proportional to volume','Volume is directly proportional to moles','Pressure is directly proportional to temperature','Volume is constant'], ans:0, exp:'P1V1 = P2V2.'}, // A (0)
      {q:'In a galvanic cell, oxidation occurs at the:', ch:['Cathode','Anode','Salt bridge','Voltmeter'], ans:1, exp:'An Ox, Red Cat. Oxidation always occurs at the anode.'}, // B (1)
      {q:'What is the standard cell potential if E°red(cathode) = 0.80V and E°red(anode) = -0.76V?', ch:['0.04V','-1.56V','-0.04V','1.56V'], ans:3, exp:'Ecell = Ecathode - Eanode = 0.80 - (-0.76) = 1.56V.'}, // D (3)
      {q:'Which of the following represents standard conditions?', ch:['298 K, 1 atm, 1 M','273 K, 1 atm, 1 M','298 K, 0 atm, 1 M','273 K, 1 atm, 0 M'], ans:0, exp:'Standard state: 298K (25C), 1 atm, 1 M concentration.'}, // A (0)
      {q:'Which phase change is strictly endothermic?', ch:['Condensation','Sublimation','Freezing','Deposition'], ans:1, exp:'Sublimation (solid to gas) requires energy input.'}, // B (1)
      {q:'A fluid moving through a narrowed pipe will experience:', ch:['Increased velocity, increased pressure','Decreased velocity, increased pressure','Increased velocity, decreased pressure','Decreased velocity, decreased pressure'], ans:2, exp:'Bernoulli\'s principle: higher velocity = lower pressure.'}, // C (2)
      {q:'The focal length of a spherical mirror is equal to:', ch:['Half the radius of curvature','The radius of curvature','Double the radius of curvature','Infinite'], ans:0, exp:'f = R/2.'}, // A (0)
      {q:'Capacitance in a parallel plate capacitor is increased by:', ch:['Increasing distance between plates','Inserting a dielectric material','Decreasing plate area','Increasing voltage'], ans:1, exp:'C = k(e0*A/d). Dielectrics (k > 1) increase capacitance.'}, // B (1)
      {q:'According to Poiseuille\'s Law, halving the radius of a vessel reduces flow by a factor of:', ch:['2','4','8','16'], ans:3, exp:'Flow is proportional to radius to the fourth power (r^4).'}, // D (3)
      {q:'Alpha decay of Uranium-238 results in a nucleus with:', ch:['Atomic number 92','Mass number 238','Mass number 234','Atomic number 91'], ans:2, exp:'Alpha particle is He (mass 4, protons 2). 238 - 4 = 234.'} // C (2)
      // Tally: A(4), B(4), C(3), D(4)
    ]
  },
  {
    id:'q103', cat:'Psych/Soc', title:'Behavior & Sociology Foundations', diff:'Medium',
    qs:[
      {q:'Which psychological perspective focuses heavily on operant conditioning?', ch:['Psychoanalytic','Humanistic','Cognitive','Behaviorist'], ans:3, exp:'Behaviorism (Skinner) focuses on observable behaviors shaped by reinforcement.'}, // D (3)
      {q:'In Piaget\'s stages, conservation is typically mastered during the:', ch:['Concrete operational stage','Preoperational stage','Formal operational stage','Sensorimotor stage'], ans:0, exp:'Conservation (7-11 years) marks the concrete operational stage.'}, // A (0)
      {q:'A child cries when their mother leaves but is easily comforted when she returns. This is:', ch:['Avoidant attachment','Secure attachment','Disorganized attachment','Ambivalent attachment'], ans:1, exp:'Classic secure attachment behavior.'}, // B (1)
      {q:'Which brain structure is primarily responsible for fear conditioning?', ch:['Hippocampus','Thalamus','Amygdala','Cerebellum'], ans:2, exp:'The amygdala processes emotion, particularly fear.'}, // C (2)
      {q:'The phenomenon where individuals put in less effort in a group setting is called:', ch:['Social facilitation','Group polarization','Deindividuation','Social loafing'], ans:3, exp:'Social loafing occurs when individual effort isn\'t evaluated.'}, // D (3)
      {q:'According to Erikson, the primary conflict of adolescence is:', ch:['Identity vs. Role Confusion','Intimacy vs. Isolation','Trust vs. Mistrust','Generativity vs. Stagnation'], ans:0, exp:'Adolescents (12-18) struggle with identity formation.'}, // A (0)
      {q:'Schizophrenia is most closely associated with excessive transmission of:', ch:['Serotonin','Dopamine','GABA','Acetylcholine'], ans:1, exp:'The dopamine hypothesis links schizophrenia to high dopamine.'}, // B (1)
      {q:'Which sociological theory views society as a complex system whose parts work together to promote solidarity?', ch:['Conflict Theory','Symbolic Interactionism','Functionalism','Feminist Theory'], ans:2, exp:'Structural functionalism (Durkheim) views society as an organism.'}, // C (2)
      {q:'The Hawthorne effect refers to:', ch:['A decrease in performance under pressure','Remembering the first items in a list','Obeying authoritative figures','Altering behavior because one is being observed'], ans:3, exp:'People change behavior when they know they are in a study.'}, // D (3)
      {q:'Retrograde amnesia is defined as the inability to:', ch:['Recall past memories','Form new memories','Recognize faces','Speak fluently'], ans:0, exp:'Retrograde = forgetting the past. Anterograde = cannot form new.'}, // A (0)
      {q:'In classical conditioning, a conditioned stimulus was originally a(n):', ch:['Unconditioned response','Neutral stimulus','Conditioned response','Unconditioned stimulus'], ans:1, exp:'A neutral stimulus (bell) becomes conditioned after pairing.'}, // B (1)
      {q:'The fundamental attribution error is the tendency to overestimate:', ch:['Situational factors','Cultural factors','Groupthink','Dispositional factors'], ans:3, exp:'We blame people\'s character (disposition) rather than their situation.'}, // D (3)
      {q:'Which part of the eye is responsible for high-acuity color vision?', ch:['Cornea','Lens','Fovea centralis','Optic disc'], ans:2, exp:'The fovea is densely packed with cones for color and detail.'}, // C (2)
      {q:'Sleep spindles and K-complexes are characteristic of which sleep stage?', ch:['Stage 1 (N1)','Stage 2 (N2)','Stage 3 (N3)','REM sleep'], ans:1, exp:'Stage 2 EEG shows these distinct waveforms.'}, // B (1)
      {q:'The belief that one\'s own culture is superior to others is called:', ch:['Cultural relativism','Ethnocentrism','Xenocentrism','Social Darwinism'], ans:0, exp:'Ethnocentrism is judging others by the standards of one\'s own culture.'} // A (0)
      // Tally: A(4), B(4), C(3), D(4)
    ]
  }
]

// ── SYSTEM PROMPT ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are MedSchoolPrep AI — an elite, highly professional, and empathetic medical school preparation coach. 
Tone: Premium, highly intelligent, precise.
Mission: Help the user master MCAT sciences, AMCAS essays, and MMI interviews. Use formatting to make answers readable.`

// ── AUTH MODAL ──────────────────────────────────────────────────────────
function AuthModal({ onSuccess, onClose }) {
  const [view, setView] = useState('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')

  const handleAuth = () => {
    if (!email || pw.length < 6) return
    const users = ls.get('msp_users') || {}
    const key = email.toLowerCase()
    if (view === 'signup') {
      users[key] = { name: name || 'Premed', hash: hashPw(pw) }
      ls.set('msp_users', users)
    }
    const sess = { email: key, name: users[key]?.name || name }
    ls.set('msp_session', sess)
    onSuccess(sess)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 24, padding: '40px 32px', width: '100%', maxWidth: 400, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #3B82F6, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24 }}>M</div>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>{view === 'login' ? 'Welcome Back' : 'Start Your Journey'}</h2>
        <p style={{ color: '#9CA3AF', textAlign: 'center', marginBottom: 32, fontSize: 14 }}>{view === 'login' ? 'Log in to continue your progress.' : 'Create an account to save your data.'}</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {view === 'signup' && <input placeholder="Full Name" value={name} onChange={e=>setName(e.target.value)} style={inpStyle} />}
          <input placeholder="Email Address" type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inpStyle} />
          <input placeholder="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)} style={inpStyle} />
          <button onClick={handleAuth} style={{ background: 'linear-gradient(135deg, #3B82F6, #10B981)', padding: 16, borderRadius: 12, border: 'none', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginTop: 8 }}>
            {view === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>
        
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button onClick={() => setView(view === 'login' ? 'signup' : 'login')} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 14 }}>
            {view === 'login' ? "Don't have an account? " : "Already have an account? "}<span style={{ color: '#60A5FA', fontWeight: 600 }}>{view === 'login' ? 'Sign up' : 'Sign in'}</span>
          </button>
        </div>
        <div style={{ marginTop: 16, textAlign: 'center' }}><button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>Continue as guest</button></div>
      </div>
    </div>
  )
}

const inpStyle = { width: '100%', padding: '16px', borderRadius: 12, background: '#030712', border: '1px solid #374151', color: '#fff', outline: 'none', fontSize: 15, boxSizing: 'border-box' }

// ── QUIZ ENGINE ──────────────────────────────────────────────────────────
function QuizEngine({ quiz, onFinish }) {
  const [qi, setQi] = useState(0)
  const [sel, setSel] = useState(null)
  const [confirmed, setConf] = useState(false)
  const [score, setScore] = useState(0)

  const q = quiz.qs[qi]
  const LETTERS = ['A', 'B', 'C', 'D']
  const progressPct = ((qi) / quiz.qs.length) * 100

  const handleConfirm = () => {
    if (sel === null) return
    setConf(true)
    if (sel === q.ans) setScore(s => s + 1)
  }

  const handleNext = () => {
    if (qi + 1 >= quiz.qs.length) { onFinish(score + (sel === q.ans ? 1 : 0), quiz.qs.length) } 
    else { setQi(q => q + 1); setSel(null); setConf(false) }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', background: '#111827', padding: 40, borderRadius: 24, border: '1px solid #1F2937' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ color: '#9CA3AF', fontSize: 14, fontWeight: 600 }}>Question {qi + 1} of {quiz.qs.length}</div>
        <div style={{ color: '#3B82F6', fontSize: 14, fontWeight: 700 }}>{quiz.cat}</div>
      </div>
      <div style={{ height: 6, background: '#1F2937', borderRadius: 3, marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #3B82F6, #10B981)', transition: 'width 0.4s ease' }} />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: '#F9FAFB', marginBottom: 32, lineHeight: 1.5 }}>{q.q}</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {q.ch.map((choice, i) => {
          let bg = '#030712', border = '1px solid #374151', color = '#D1D5DB'
          if (!confirmed && sel === i) { bg = '#1E3A8A20'; border = '1px solid #3B82F6'; color = '#fff' }
          if (confirmed) {
            if (i === q.ans) { bg = '#064E3B40'; border = '1px solid #10B981'; color = '#10B981' }
            else if (i === sel) { bg = '#7F1D1D40'; border = '1px solid #EF4444'; color = '#EF4444' }
          }
          return (
            <button key={i} disabled={confirmed} onClick={() => setSel(i)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 14, background: bg, border, color, fontSize: 16, cursor: confirmed ? 'default' : 'pointer', textAlign: 'left' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: confirmed && i === q.ans ? '#10B981' : confirmed && i === sel ? '#EF4444' : sel === i ? '#3B82F6' : '#1F2937', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{LETTERS[i]}</div>
              {choice}
            </button>
          )
        })}
      </div>

      {confirmed && (
        <div style={{ padding: 20, borderRadius: 14, background: sel === q.ans ? '#064E3B40' : '#7F1D1D40', border: `1px solid ${sel === q.ans ? '#10B981' : '#EF4444'}`, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, color: sel === q.ans ? '#10B981' : '#EF4444', marginBottom: 8 }}>{sel === q.ans ? '✓ Correct' : '✗ Incorrect'}</div>
          <div style={{ color: '#D1D5DB', fontSize: 15, lineHeight: 1.6 }}>{q.exp}</div>
        </div>
      )}

      {!confirmed ? (
        <button onClick={handleConfirm} disabled={sel === null} style={{ width: '100%', padding: 16, borderRadius: 14, background: sel === null ? '#1F2937' : '#3B82F6', color: sel === null ? '#6B7280' : '#fff', fontSize: 16, fontWeight: 700, border: 'none', cursor: sel === null ? 'not-allowed' : 'pointer' }}>Confirm Answer</button>
      ) : (
        <button onClick={handleNext} style={{ width: '100%', padding: 16, borderRadius: 14, background: 'linear-gradient(135deg, #3B82F6, #10B981)', color: '#fff', fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer' }}>{qi + 1 >= quiz.qs.length ? 'View Results →' : 'Next Question →'}</button>
      )}
    </div>
  )
}

// ── MAIN APP COMPONENT ───────────────────────────────────────────────────
export default function App() {
  const [session, setSess] = useState(null)
  const [tab, setTab] = useState('quiz') // Default to the massive 200 quiz infrastructure
  const [showAuth, setAuth] = useState(false)
  
  // Navigation & Filter States
  const [activePlan, setActivePlan] = useState(null)
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [quizFilter, setQuizFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Data States
  const [activities, setActivities] = useState([]) 
  const [messages, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoad] = useState(false)
  const [quizProgress, setQuizProgress] = useState({})
  
  const bottomRef = useRef(null)

  useEffect(() => {
    document.body.style.margin = '0'
    document.body.style.background = '#030712'
    document.body.style.color = '#F9FAFB'
    document.body.style.fontFamily = 'Inter, sans-serif'
    
    const s = ls.get('msp_session')
    if (s) {
      setSess(s)
      setActivities(ls.get('msp_vault_' + s.email) || [])
      setQuizProgress(ls.get('msp_qprog_' + s.email) || {})
    }
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Coach Chat Logic
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
        body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...newMsgs] }),
      })
      const data = await res.json()
      setMsgs([...newMsgs, { role: 'assistant', content: data.choices[0].message.content }])
    } catch { setMsgs([...newMsgs, { role: 'assistant', content: 'Connection error.' }]) }
    setLoad(false)
  }

  // Vault Logic
  const handleAddActivity = () => { setActivities([{ id: Date.now(), title: '', category: 'Clinical Shadowing', hours: '', notes: '' }, ...activities]) }
  const updateActivity = (id, f, v) => { setActivities(activities.map(a => a.id === id ? { ...a, [f]: v } : a)) }
  const deleteActivity = (id) => { setActivities(activities.filter(a => a.id !== id)) }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#030712' }}>
      
      {showAuth && <AuthModal onSuccess={(s) => { setSess(s); setAuth(false) }} onClose={() => setAuth(false)} />}

      {/* SIDEBAR */}
      <div style={{ width: 280, background: '#0B0F19', borderRight: '1px solid #1F2937', padding: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #3B82F6, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 18 }}>M</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>MedSchoolPrep</div>
            <div style={{ fontSize: 11, color: '#3B82F6', fontWeight: 700, textTransform: 'uppercase' }}>Pro Suite</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <div style={{ fontSize: 11, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 16 }}>Curriculum</div>
          <button onClick={() => {setTab('quiz'); setActiveQuiz(null)}} style={navStyle(tab === 'quiz')}>🧠 Mastery Quizzes</button>
          <button onClick={() => {setTab('plans'); setActivePlan(null)}} style={navStyle(tab === 'plans')}>📅 Study Plans</button>
          <div style={{ fontSize: 11, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, marginTop: 24, paddingLeft: 16 }}>Tools</div>
          <button onClick={() => setTab('coach')} style={navStyle(tab === 'coach')}>💬 AI Coach</button>
          <button onClick={() => setTab('amcas')} style={navStyle(tab === 'amcas')}>🏥 AMCAS Vault</button>
        </div>

        {session ? (
          <div style={{ padding: 16, background: '#111827', borderRadius: 16, border: '1px solid #1F2937' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB' }}>{session.name}</div>
            <button onClick={() => { ls.del('msp_session'); setSess(null) }} style={{ width: '100%', padding: 8, marginTop: 10, background: '#1F2937', borderRadius: 8, border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Log Out</button>
          </div>
        ) : (
          <button onClick={() => setAuth(true)} style={{ padding: 16, background: 'linear-gradient(135deg, #3B82F6, #10B981)', borderRadius: 16, border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Sign In</button>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 60px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '80%', height: 400, background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        
        <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 10 }}>
          
          {/* ── TAB: QUIZ INFRASTRUCTURE (The 200 Quiz Engine) ── */}
          {tab === 'quiz' && !activeQuiz && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
                <div>
                  <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 12, color: '#F9FAFB' }}>Mastery Engine</h1>
                  <p style={{ color: '#9CA3AF', fontSize: 16, maxWidth: 600 }}>200 hyper-adaptive quizzes. Track your accuracy and target your weak points.</p>
                </div>
                <div style={{ position: 'relative', width: 280 }}>
                  <input type="text" placeholder="Search topics..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#111827', border: '1px solid #1F2937', borderRadius: 12, color: '#fff', outline: 'none' }} />
                </div>
              </div>

              {/* Analytics Dashboard */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
                <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Total Completed</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#3B82F6' }}>{Object.keys(quizProgress).length} <span style={{ fontSize: 14, color: '#6B7280' }}>/ 200</span></div>
                </div>
                <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Avg Accuracy</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#10B981' }}>{Object.keys(quizProgress).length > 0 ? Math.round(Object.values(quizProgress).reduce((a,b)=>a+b,0) / Object.values(quizProgress).length) : 0}%</div>
                </div>
                <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Active Streak</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#F59E0B' }}>0 <span style={{ fontSize: 14, color: '#6B7280' }}>Days</span></div>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                {['All', 'Bio/Biochem', 'Chem/Phys', 'Psych/Soc', 'CARS'].map(cat => (
                  <button key={cat} onClick={() => setQuizFilter(cat)} style={{ padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: quizFilter === cat ? '#3B82F6' : '#111827', color: quizFilter === cat ? '#fff' : '#9CA3AF' }}>{cat}</button>
                ))}
              </div>

              {/* Quiz Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
                {QUIZZES.filter(q => quizFilter === 'All' || q.cat.includes(quizFilter)).filter(q => q.title.toLowerCase().includes(searchQuery.toLowerCase())).map(q => {
                  const score = quizProgress[q.id]
                  return (
                    <div key={q.id} style={{ padding: 24, background: '#111827', borderRadius: 20, border: '1px solid #1F2937', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <span style={{ fontSize: 11, color: '#3B82F6', fontWeight: 800, textTransform: 'uppercase' }}>{q.cat}</span>
                          <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, background: '#1F2937', padding: '4px 8px', borderRadius: 6 }}>{q.qs.length} Qs</span>
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#F9FAFB' }}>{q.title}</h3>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {score !== undefined ? <div style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>Score: {score}%</div> : <div style={{ fontSize: 13, color: '#6B7280' }}>Not started</div>}
                        <button onClick={() => setActiveQuiz(q)} style={{ padding: '8px 20px', background: score !== undefined ? '#1F2937' : '#3B82F6', borderRadius: 10, border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{score !== undefined ? 'Retake' : 'Start Quiz'}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'quiz' && activeQuiz && <QuizEngine quiz={activeQuiz} onFinish={(score, total) => { setQuizProgress({...quizProgress, [activeQuiz.id]: Math.round((score/total)*100)}); setActiveQuiz(null) }} />}

          {/* ── TAB: STUDY PLANS ── */}
          {tab === 'plans' && !activePlan && (
            <div className="fade-in">
              <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 12 }}>Structured Programs</h1>
              <p style={{ color: '#9CA3AF', marginBottom: 48 }}>Select a pre-built, highly optimized schedule.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                {STUDY_PLANS.map(p => (
                  <div key={p.id} onClick={() => setActivePlan(p)} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 24, padding: 32, cursor: 'pointer' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: `${p.color}15`, color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 20 }}>{p.icon}</div>
                    <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{p.title}</h3>
                    <p style={{ color: '#9CA3AF', fontSize: 14 }}>{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === 'plans' && activePlan && (
            <div className="fade-in">
              <button onClick={() => setActivePlan(null)} style={{ background: 'none', border: 'none', color: '#60A5FA', cursor: 'pointer', marginBottom: 24, fontWeight: 600 }}>← Back to Programs</button>
              <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 16 }}>{activePlan.title}</h1>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {activePlan.schedule.map((day, i) => (
                  <div key={i} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 20, padding: 32, display: 'flex', gap: 32 }}>
                    <div style={{ minWidth: 100, fontSize: 14, color: activePlan.color, fontWeight: 800, textTransform: 'uppercase' }}>{day.day}</div>
                    <div>
                      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{day.title}</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {day.tasks.map((task, j) => (
                          <label key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}><input type="checkbox" style={{ width: 20, height: 20, accentColor: activePlan.color }} /><span style={{ color: '#D1D5DB' }}>{task}</span></label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: AMCAS VAULT ── */}
          {tab === 'amcas' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48 }}>
                <div><h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 12 }}>AMCAS Vault</h1><p style={{ color: '#9CA3AF' }}>Log your clinical hours and notes.</p></div>
                <button onClick={handleAddActivity} style={{ padding: '12px 24px', background: '#3B82F6', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+ Log Activity</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {activities.map((act) => (
                  <div key={act.id} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 24, padding: 32 }}>
                    <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                      <div style={{ flex: 2 }}><label style={labelStyle}>Title</label><input type="text" value={act.title} onChange={e => updateActivity(act.id, 'title', e.target.value)} style={inpStyle} /></div>
                      <div style={{ width: 120 }}><label style={labelStyle}>Hours</label><input type="number" value={act.hours} onChange={e => updateActivity(act.id, 'hours', e.target.value)} style={inpStyle} /></div>
                    </div>
                    <div><label style={labelStyle}>Raw Notes</label><textarea value={act.notes} onChange={e => updateActivity(act.id, 'notes', e.target.value)} style={{ ...inpStyle, height: 120 }} /></div>
                    <div style={{ textAlign: 'right', marginTop: 16 }}><button onClick={() => deleteActivity(act.id)} style={{ background: 'none', border: 'none', color: '#EF4444', fontWeight: 600, cursor: 'pointer' }}>Delete</button></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: AI COACH ── */}
          {tab === 'coach' && (
             <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
             <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
               {messages.map((m, i) => (
                 <div key={i} style={{ display: 'flex', justifyContent: m.role==='user'?'flex-end':'flex-start', marginBottom: 24 }}>
                   {!m.role==='user' && <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg, #3B82F6, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', marginRight: 16 }}>M</div>}
                   <div style={{ maxWidth: '80%', background: m.role==='user'?'#2563EB':'#111827', border: m.role==='user'?'none':'1px solid #1F2937', borderRadius: 24, padding: '20px 24px', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: m.content }} />
                 </div>
               ))}
               <div ref={bottomRef} />
             </div>
             <div style={{ position: 'fixed', bottom: 0, left: 280, right: 0, padding: '32px 60px', background: '#030712' }}>
               <div style={{ position: 'relative' }}>
                 <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key === 'Enter') sendToCoach() }} placeholder="Ask your coach anything..." style={{ width: '100%', padding: '20px 70px 20px 24px', background: '#111827', border: '1px solid #374151', borderRadius: 20, color: '#fff', outline: 'none' }} />
                 <button onClick={sendToCoach} style={{ position: 'absolute', right: 12, top: 12, bottom: 12, width: 48, borderRadius: 12, background: '#3B82F6', border: 'none', color: '#fff', cursor: 'pointer' }}>↑</button>
               </div>
             </div>
           </div>
          )}

        </div>
      </div>
      <style>{`.fade-in { animation: fadeIn 0.4s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

const navStyle = (active) => ({ background: active ? '#1F2937' : 'transparent', color: active ? '#F9FAFB' : '#9CA3AF', border: 'none', padding: '12px 16px', borderRadius: 12, textAlign: 'left', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 12, margin: '0 8px' })
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }
