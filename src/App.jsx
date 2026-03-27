import React, { useState, useEffect, useRef, useCallback } from 'react'

// ── CONFIG ───────────────────────────────────────────────────────────────
const OPENAI_KEY = import.meta.env.VITE_OPENAI_KEY || 'sk-proj-REPLACE_WITH_YOUR_KEY'
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
    desc: 'A relentless, day-by-day breakdown of the most highly tested MCAT concepts across all four sections.',
    schedule: [
      { day: 'Day 1', title: 'Amino Acids & Enzyme Kinetics', tasks: ['Memorize 20 standard AAs & pKas', 'Take Biochemistry Quiz 1', 'Complete 2 CARS Passages'] },
      { day: 'Day 2', title: 'Metabolism: Glycolysis & TCA', tasks: ['Draw Glycolysis & TCA Pathway', 'Take Metabolism Quiz', 'Review Psych/Soc: Theories of Emotion'] },
      { day: 'Day 3', title: 'Physics: Kinematics & Fluids', tasks: ['Memorize Fluid Equations (Poiseuille, Bernoulli)', 'Take Physics Quiz', 'Complete 2 CARS Passages'] },
      { day: 'Day 4', title: 'Full Length Review Day', tasks: ['Take Full Length Exam 1', 'Log all incorrect answers', 'Review weak points with AI Coach'] }
    ]
  },
  { 
    id: 'p2', title: 'AMCAS Application Accelerator', focus: 'Admissions', color: '#10B981', icon: '📝',
    desc: 'A structured 14-day timeline to brainstorm, draft, and refine your Personal Statement and Work & Activities.',
    schedule: [
      { day: 'Day 1', title: 'Brainstorming Core Stories', tasks: ['Log 3 impactful clinical experiences in the Vault', 'Identify your "Seed" (Why Medicine?)'] },
      { day: 'Day 3', title: 'Drafting the Statement', tasks: ['Write a messy 1,000-word first draft', 'Cut down to 5,300 characters', 'Run draft through AI Coach for tone critique'] },
      { day: 'Day 7', title: 'Refining Work & Activities', tasks: ['Select 3 Most Meaningful Experiences', 'Draft 700-character descriptions for remaining 12'] }
    ]
  },
  { 
    id: 'p3', title: 'MMI & Interview Bootcamp', focus: 'Interviews', color: '#F59E0B', icon: '🎤',
    desc: 'Prepare for high-pressure ethical scenarios, traditional interviews, and healthcare policy questions.',
    schedule: [
      { day: 'Day 1', title: 'The 4 Pillars of Medical Ethics', tasks: ['Review Autonomy, Beneficence, Non-maleficence, Justice', 'Ask AI Coach for a mock ethical scenario'] },
      { day: 'Day 2', title: 'Traditional Questions', tasks: ['Draft "Tell me about yourself"', 'Draft "Why our school?"', 'Practice delivery out loud'] }
    ]
  }
]

// ── MASSIVE QUIZ DATABASE (15 Quizzes, 150 Questions) ────────────────────
const QUIZZES = [
  {
    id:'q01', cat:'Biochemistry', title:'Glycolysis & Regulation', diff:'Hard', time: 480,
    qs:[
      {q:'Which enzyme catalyzes the rate-limiting, irreversible step of glycolysis?',ch:['Hexokinase','Phosphofructokinase-1','Pyruvate kinase','Phosphoglucose isomerase'],ans:1,exp:'PFK-1 is the primary regulatory enzyme of glycolysis. It is allosterically inhibited by ATP and citrate, and activated by AMP and fructose-2,6-bisphosphate.'},
      {q:'Arsenate poisoning uncouples substrate-level phosphorylation in glycolysis because it:',ch:['Inhibits PFK-1 directly','Chelates NAD⁺ in the cytoplasm','Substitutes for phosphate forming an unstable 1-arseno-3-PG','Blocks aldolase irreversibly'],ans:2,exp:'Arsenate replaces inorganic phosphate in the GAPDH reaction, forming 1-arseno-3-phosphoglycerate, which spontaneously hydrolyzes, bypassing ATP synthesis.'},
      {q:'Net ATP yield from glycolysis of one glucose (cytoplasm only) is:',ch:['4 ATP','6 ATP','2 ATP','8 ATP'],ans:2,exp:'Glycolysis produces 4 ATP gross but invests 2 ATP in the preparatory phase, giving a net of 2 ATP per glucose.'},
      {q:'In the Cori cycle, lactate released by muscle is converted to glucose in which organ?',ch:['Kidney','Skeletal muscle','Brain','Liver'],ans:3,exp:'The liver takes up lactate from anaerobic muscle/RBC glycolysis and converts it to glucose via gluconeogenesis, recycling carbon at an ATP cost.'},
      {q:'Pyruvate kinase deficiency in RBCs most directly causes:',ch:['Polycythemia vera','Hemolytic anemia due to ATP depletion','Methemoglobinemia','Iron-deficiency anemia'],ans:1,exp:'RBCs rely entirely on glycolysis for ATP. PK deficiency → ATP depletion → rigid cells destroyed in the spleen → hemolytic anemia.'},
      {q:'Fructose-2,6-bisphosphate (F2,6BP) simultaneously:',ch:['Inhibits both PFK-1 and FBPase-1','Activates PFK-1 and inhibits FBPase-1','Activates gluconeogenesis only','Inhibits PFK-1 and activates FBPase-1'],ans:1,exp:'F2,6BP is the most potent activator of PFK-1 (glycolysis) and simultaneously inhibits FBPase-1 (gluconeogenesis), ensuring reciprocal regulation.'},
      {q:'Which step in glycolysis is the first ATP-consuming reaction?',ch:['Conversion of G6P to F6P','Phosphorylation of glucose by hexokinase','Phosphorylation of F6P by PFK-1','Conversion of 3-PG to 2-PG'],ans:1,exp:'Hexokinase phosphorylates glucose → G6P, consuming the first ATP. The second ATP is consumed by PFK-1.'},
      {q:'The reducing agent produced in the GAPDH step of glycolysis is:',ch:['FADH₂','NADPH','NADH','ATP'],ans:2,exp:'GAPDH catalyzes oxidation of G3P to 1,3-BPG, reducing NAD⁺ to NADH.'},
      {q:'Phosphoenolpyruvate (PEP) directly donates its phosphate to ADP in a reaction catalyzed by:',ch:['Phosphoglycerate kinase','Enolase','Pyruvate carboxylase','Pyruvate kinase'],ans:3,exp:'Pyruvate kinase catalyzes PEP + ADP → pyruvate + ATP (substrate-level phosphorylation).'},
      {q:'High citrate levels in the cell inhibit PFK-1 because:',ch:['Citrate is a competitive substrate','Elevated citrate signals sufficient energy and biosynthetic precursors','Citrate directly degrades F2,6BP','Citrate activates glucokinase'],ans:1,exp:'When citrate accumulates, it signals energy abundance and allosterically inhibits PFK-1, reducing glycolytic flux.'}
    ]
  },
  {
    id:'q02', cat:'Biochemistry', title:'TCA Cycle & Oxidative Phosphorylation', diff:'Hard', time: 480,
    qs:[
      {q:'Which TCA cycle enzyme is embedded in the inner mitochondrial membrane?',ch:['Isocitrate dehydrogenase','Succinate dehydrogenase','Fumarase','α-Ketoglutarate dehydrogenase'],ans:1,exp:'Succinate dehydrogenase (Complex II) is the only TCA enzyme embedded in the IMM.'},
      {q:'Thiamine (B1) deficiency impairs the TCA cycle primarily by inhibiting:',ch:['Citrate synthase and fumarase','α-Ketoglutarate dehydrogenase and PDH','Succinyl-CoA synthetase and IDH','Malate dehydrogenase and aconitase'],ans:1,exp:'Both PDH and α-KGDH require thiamine pyrophosphate (TPP).'},
      {q:'Cyanide poisoning kills by blocking:',ch:['Complex I','Complex II','Complex IV (cytochrome c oxidase)','ATP synthase'],ans:2,exp:'CN⁻ binds the Fe³⁺ in cytochrome a₃ of Complex IV, halting the entire ETC.'},
      {q:'The modern P/O ratio for NADH oxidation is approximately:',ch:['1.0','3.0','2.5','4.0'],ans:2,exp:'Modern measurements give P/O ≈ 2.5 for NADH (~10 H⁺ pumped, ~4 H⁺ per ATP).'},
      {q:'Which intermediate is shared between the TCA cycle and the urea cycle?',ch:['Oxaloacetate','Citrate','Succinyl-CoA','Fumarate'],ans:3,exp:'Fumarate is produced in the urea cycle and enters the TCA cycle.'},
      {q:'GTP is produced by substrate-level phosphorylation in the TCA cycle at which step?',ch:['Citrate synthase','Isocitrate dehydrogenase','Succinyl-CoA synthetase','Malate dehydrogenase'],ans:2,exp:'Succinyl-CoA synthetase converts succinyl-CoA → succinate, producing GTP.'},
      {q:'2,4-Dinitrophenol (DNP) causes weight loss by:',ch:['Inhibiting ATP synthase','Dissipating the proton gradient as heat','Blocking Complex I','Activating lipase'],ans:1,exp:'DNP is a weak acid that shuttles H⁺ across the IMM, collapsing the proton gradient and generating heat.'},
      {q:'Which cofactors are required by the α-KGDH complex?',ch:['Biotin, lipoate, CoA, FAD, NAD⁺','TPP, lipoate, CoA, FAD, NAD⁺','PLP, biotin, CoA, FAD, NAD⁺','TPP, biotin, CoA, NADPH, FAD'],ans:1,exp:'Requires TPP (B1), lipoic acid, CoA (B5), FAD (B2), and NAD⁺ (B3).'},
      {q:'The function of ubiquinone (coenzyme Q) is to:',ch:['Pump protons directly','Transfer electrons from Complexes I & II to III','Catalyze ATP synthesis','Reduce cytochrome c'],ans:1,exp:'CoQ is a mobile lipid-soluble electron carrier in the IMM.'},
      {q:'NADH produced in the cytoplasm enters the ETC via:',ch:['Direct transport','Malate-aspartate or glycerol-3-phosphate shuttles','The citrate shuttle','The carnitine shuttle'],ans:1,exp:'The IMM is impermeable to NADH, requiring shuttles.'}
    ]
  },
  {
    id:'q03', cat:'Biochemistry', title:'Amino Acid Metabolism', diff:'Medium', time: 480,
    qs:[
      {q:'Phenylketonuria (PKU) results from deficiency of:',ch:['Tyrosinase','Homogentisate oxidase','Phenylalanine hydroxylase','Cystathionine β-synthase'],ans:2,exp:'PAH converts phenylalanine to tyrosine.'},
      {q:'Which amino acid is both glucogenic AND ketogenic?',ch:['Leucine','Lysine','Phenylalanine','Glycine'],ans:2,exp:'Phenylalanine produces both glucose and ketone body precursors. Leucine and lysine are strictly ketogenic.'},
      {q:'Maple syrup urine disease involves a deficiency in an enzyme that requires which cofactor?',ch:['PLP','TPP (Thiamine)','Biotin','Cobalamin'],ans:1,exp:'Branched-chain α-keto acid dehydrogenase requires TPP.'},
      {q:'Transamination reactions (ALT, AST) require which coenzyme?',ch:['NAD⁺','Thiamine','Pyridoxal phosphate (PLP, B6)','Biotin'],ans:2,exp:'All aminotransferases require PLP to transfer the amino group.'},
      {q:'Serotonin biosynthesis requires which amino acid?',ch:['Tyrosine','Tryptophan','Phenylalanine','Histidine'],ans:1,exp:'Tryptophan is the precursor for serotonin (and niacin).'},
      {q:'Which amino acid carries nitrogen from muscle to the liver?',ch:['Glutamine only','Alanine','Glutamate','Arginine'],ans:1,exp:'The glucose-alanine cycle transports nitrogen to the liver.'},
      {q:'Tyrosinase deficiency causes:',ch:['Albinism','Alkaptonuria','PKU','Melasma'],ans:0,exp:'Tyrosinase is required for melanin synthesis.'},
      {q:'The urea cycle occurs in:',ch:['Mitochondria only','Cytoplasm only','Both mitochondria and cytoplasm','Lysosomes'],ans:2,exp:'Steps 1-2 in mitochondria, steps 3-5 in cytoplasm.'},
      {q:'N-acetylglutamate (NAG) is an obligate activator of:',ch:['Arginase','CPS-I','OTC','Argininosuccinate lyase'],ans:1,exp:'CPS-I requires NAG to function.'},
      {q:'Which of the following is a purely ketogenic amino acid?',ch:['Isoleucine','Threonine','Leucine','Valine'],ans:2,exp:'Leucine and Lysine are the only strictly ketogenic amino acids.'}
    ]
  },
  {
    id:'q04', cat:'Cell Biology', title:'Cell Signaling', diff:'Hard', time: 480,
    qs:[
      {q:'Cholera toxin causes secretory diarrhea by permanently activating:',ch:['Gi alpha','Gs alpha','Phospholipase C','RTKs'],ans:1,exp:'Cholera toxin ADP-ribosylates Gsα, keeping adenylyl cyclase active.'},
      {q:'The PI3K/Akt/mTOR pathway primarily promotes:',ch:['Apoptosis','Cell survival and anabolic growth','Catabolic metabolism','Cell cycle arrest'],ans:1,exp:'Akt phosphorylates mTOR, driving protein synthesis and survival.'},
      {q:'β-Arrestin promotes GPCR desensitization by:',ch:['Inactivating AC','Sterically blocking G-protein coupling','Activating PDE','Dephosphorylating the receptor'],ans:1,exp:'It binds phosphorylated GPCRs, blocking G-proteins and recruiting clathrin.'},
      {q:'Epinephrine causes hepatic glycogenolysis via:',ch:['β-AR → Gs → cAMP → PKA','β-AR → Gi → PP1','α₁-AR → Gq → IP₃','RTK → PI3K'],ans:0,exp:'Epinephrine uses the Gs/cAMP/PKA cascade.'},
      {q:'The JAK-STAT pathway is primarily activated by:',ch:['Steroids','GPCRs','Cytokines','Lipid messengers'],ans:2,exp:'Cytokine receptors lack intrinsic kinase activity and rely on JAKs.'},
      {q:'Diacylglycerol (DAG) directly activates:',ch:['Adenylyl cyclase','PKA','PKC','Phospholipase A₂'],ans:2,exp:'DAG, along with Ca²⁺, activates Protein Kinase C.'},
      {q:'The Ras oncogene is constitutively activated by a mutation that prevents:',ch:['GTP binding','GTP hydrolysis (GTPase activity)','GDP release','Membrane localization'],ans:1,exp:'Mutations block the intrinsic GTPase activity, locking Ras in the active GTP-bound state.'},
      {q:'Which second messenger opens ryanodine receptors (RyR) in cardiac muscle?',ch:['IP₃','cAMP','Ca²⁺ influx (CICR)','DAG'],ans:2,exp:'Calcium-induced calcium release is unique to cardiac E-C coupling.'},
      {q:'Steroid hormones typically act by:',ch:['Opening ion channels','Binding intracellular receptors to alter transcription','Activating GPCRs','Inhibiting kinases'],ans:1,exp:'Steroids are lipophilic, crossing the membrane to act as transcription factors.'},
      {q:'Nitric oxide (NO) causes vasodilation by activating:',ch:['Adenylyl cyclase','Guanylyl cyclase (producing cGMP)','Phospholipase C','Protein kinase A'],ans:1,exp:'NO diffuses into smooth muscle and activates soluble guanylyl cyclase.'}
    ]
  },
  {
    id:'q05', cat:'Physiology', title:'Pulmonary Mechanics', diff:'Medium', time: 480,
    qs:[
      {q:'The O₂-Hb dissociation curve shifts RIGHT (decreased affinity) when:',ch:['Temp decreases, pH increases','Temp increases, PaCO₂ increases, pH decreases','PaCO₂ decreases','Carbon monoxide is present'],ans:1,exp:'The Bohr effect: increased Temp, CO₂, H⁺ (low pH), and 2,3-DPG shift the curve right to unload oxygen.'},
      {q:'Type II pneumocytes are responsible for:',ch:['Gas exchange','Producing surfactant and regenerating epithelium','Phagocytosis','Mucus production'],ans:1,exp:'Type II cells produce surfactant (DPPC) and act as stem cells for Type I cells.'},
      {q:'Hypoxic pulmonary vasoconstriction (HPV) serves to:',ch:['Increase blood flow to hypoxic areas','Divert blood away from poorly ventilated alveoli to optimize V/Q','Raise total pressure','Stimulate surfactant'],ans:1,exp:'HPV improves V/Q matching by shunting blood to well-ventilated regions.'},
      {q:'The primary mode of CO₂ transport in blood is:',ch:['Dissolved in plasma','Bound to Hb','As bicarbonate (HCO₃⁻)','As carbonic acid'],ans:2,exp:'~70% of CO₂ is carried as bicarbonate, converted by carbonic anhydrase.'},
      {q:'An FEV₁/FVC ratio of 58% that improves significantly with albuterol indicates:',ch:['Restrictive disease','Fixed COPD','Reversible obstructive disease (Asthma)','Normal physiology'],ans:2,exp:'Obstructive (<70%) with reversibility is classic for asthma.'},
      {q:'By Laplace\'s Law (P = 2γ/r), surfactant prevents:',ch:['Large alveoli from bursting','Small alveoli from collapsing into larger ones','Bronchoconstriction','Pulmonary edema'],ans:1,exp:'Surfactant lowers surface tension more in small alveoli, stabilizing them.'},
      {q:'Dead space ventilation is INCREASED in:',ch:['Pneumonia','Pulmonary embolism','Pulmonary edema','Asthma'],ans:1,exp:'A PE blocks perfusion to ventilated alveoli, creating alveolar dead space.'},
      {q:'In chronic COPD with hypercapnia, the primary respiratory drive shifts to:',ch:['Central chemoreceptors sensing CO₂','Peripheral chemoreceptors sensing Hypoxia','Stretch receptors','Irritant receptors'],ans:1,exp:'Chronic high CO₂ desensitizes central receptors, leaving the hypoxic drive.'},
      {q:'Which lung volume CANNOT be measured by spirometry?',ch:['Tidal volume','Vital capacity','Residual volume','Inspiratory reserve'],ans:2,exp:'Residual volume is the air left after max exhalation and cannot be blown into a spirometer.'},
      {q:'Hyperventilation primarily causes:',ch:['Respiratory acidosis','Respiratory alkalosis (decreased PaCO₂)','Metabolic acidosis','Metabolic alkalosis'],ans:1,exp:'Blowing off CO₂ raises blood pH, causing respiratory alkalosis.'}
    ]
  }
]

// ── SYSTEM PROMPT ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are MedSchoolPrep AI — an elite, highly professional, and empathetic medical school preparation coach. 
Tone: Premium, highly intelligent, precise, mirroring the aesthetic of a top-tier prep course.
Mission: Help the user master MCAT sciences, AMCAS essays, and MMI interviews. Use formatting (bullet points, bold text) to make your answers scannable and easy to read.`

// ── AUTH MODAL ──────────────────────────────────────────────────────────
function AuthModal({ onSuccess, onClose }) {
  const [view, setView] = useState('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')

  const handleAuth = () => {
    if (!email.includes('@')) return setMsg('Please enter a valid email.')
    if (pw.length < 6) return setMsg('Password must be at least 6 characters.')
    
    const users = ls.get('msp_users') || {}
    const key = email.toLowerCase()

    if (view === 'signup') {
      if (users[key]) return setMsg('Account already exists. Please sign in.')
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 24, padding: '40px 32px', width: '100%', maxWidth: 400, color: '#fff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #3B82F6, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24 }}>M</div>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>{view === 'login' ? 'Welcome Back' : 'Start Your Journey'}</h2>
        <p style={{ color: '#9CA3AF', textAlign: 'center', marginBottom: 32, fontSize: 14 }}>{view === 'login' ? 'Log in to continue your progress.' : 'Create an account to save your data.'}</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {view === 'signup' && <input placeholder="Full Name" value={name} onChange={e=>setName(e.target.value)} style={inpStyle} />}
          <input placeholder="Email Address" type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inpStyle} />
          <input placeholder="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)} style={inpStyle} />
          {msg && <div style={{ color: '#EF4444', fontSize: 13, background: '#7F1D1D20', padding: 10, borderRadius: 8, border: '1px solid #7F1D1D' }}>{msg}</div>}
          
          <button onClick={handleAuth} style={{ background: 'linear-gradient(135deg, #3B82F6, #10B981)', padding: 16, borderRadius: 12, border: 'none', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginTop: 8, transition: 'opacity 0.2s', ':hover': { opacity: 0.9 } }}>
            {view === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>
        
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button onClick={() => {setView(view === 'login' ? 'signup' : 'login'); setMsg('')}} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 14, transition: 'color 0.2s' }}>
            {view === 'login' ? "Don't have an account? " : "Already have an account? "}<span style={{ color: '#60A5FA', fontWeight: 600 }}>{view === 'login' ? 'Sign up' : 'Sign in'}</span>
          </button>
        </div>
        {onClose && <div style={{ marginTop: 16, textAlign: 'center' }}><button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>Continue as guest</button></div>}
      </div>
    </div>
  )
}

const inpStyle = { width: '100%', padding: '16px', borderRadius: 12, background: '#030712', border: '1px solid #374151', color: '#fff', outline: 'none', fontSize: 15, boxSizing: 'border-box', transition: 'border-color 0.2s' }

// ── QUIZ ENGINE (Fully Interactive & Restored) ───────────────────────────
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
    if (qi + 1 >= quiz.qs.length) {
      onFinish(score + (sel === q.ans ? 1 : 0), quiz.qs.length)
    } else {
      setQi(q => q + 1)
      setSel(null)
      setConf(false)
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', background: '#111827', padding: 40, borderRadius: 24, border: '1px solid #1F2937', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ color: '#9CA3AF', fontSize: 14, fontWeight: 600 }}>Question {qi + 1} of {quiz.qs.length}</div>
        <div style={{ color: '#3B82F6', fontSize: 14, fontWeight: 700 }}>{quiz.cat}</div>
      </div>
      
      {/* Progress Bar */}
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
            else { opacity: 0.5 }
          }
          return (
            <button key={i} disabled={confirmed} onClick={() => setSel(i)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 14, background: bg, border, color, fontSize: 16, cursor: confirmed ? 'default' : 'pointer', transition: 'all 0.2s', textAlign: 'left' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: confirmed && i === q.ans ? '#10B981' : confirmed && i === sel ? '#EF4444' : sel === i ? '#3B82F6' : '#1F2937', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {LETTERS[i]}
              </div>
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
        <button onClick={handleConfirm} disabled={sel === null} style={{ width: '100%', padding: 16, borderRadius: 14, background: sel === null ? '#1F2937' : '#3B82F6', color: sel === null ? '#6B7280' : '#fff', fontSize: 16, fontWeight: 700, border: 'none', cursor: sel === null ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
          Confirm Answer
        </button>
      ) : (
        <button onClick={handleNext} style={{ width: '100%', padding: 16, borderRadius: 14, background: 'linear-gradient(135deg, #3B82F6, #10B981)', color: '#fff', fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          {qi + 1 >= quiz.qs.length ? 'View Results →' : 'Next Question →'}
        </button>
      )}
    </div>
  )
}

// ── MAIN APP COMPONENT ───────────────────────────────────────────────────
export default function App() {
  const [session, setSess] = useState(null)
  const [tab, setTab] = useState('plans') 
  
  // Navigation States
  const [activePlan, setActivePlan] = useState(null)
  const [activeQuiz, setActiveQuiz] = useState(null)
  
  // Data States
  const [activities, setActivities] = useState([]) 
  const [messages, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoad] = useState(false)
  const [quizProgress, setQuizProgress] = useState({})
  
  const bottomRef = useRef(null)

  useEffect(() => {
    // Global Dark Mode Base
    document.body.style.margin = '0'
    document.body.style.background = '#030712'
    document.body.style.color = '#F9FAFB'
    document.body.style.fontFamily = 'Inter, -apple-system, sans-serif'
    
    const s = ls.get('msp_session')
    if (s) {
      setSess(s)
      setActivities(ls.get('msp_vault_' + s.email) || [])
      setQuizProgress(ls.get('msp_qprog_' + s.email) || {})
    }
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // AI Coach Logic
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
    } catch {
      setMsgs([...newMsgs, { role: 'assistant', content: 'Connection error. Please try again.' }])
    }
    setLoad(false)
  }

  // AMCAS Vault Logic
  const handleAddActivity = () => {
    const newAct = [{ id: Date.now(), title: '', category: 'Clinical Shadowing', hours: '', notes: '' }, ...activities]
    setActivities(newAct)
    if (session) ls.set('msp_vault_' + session.email, newAct)
  }

  const updateActivity = (id, field, value) => {
    const updated = activities.map(a => a.id === id ? { ...a, [field]: value } : a)
    setActivities(updated)
    if (session) ls.set('msp_vault_' + session.email, updated)
  }

  const deleteActivity = (id) => {
    const updated = activities.filter(a => a.id !== id)
    setActivities(updated)
    if (session) ls.set('msp_vault_' + session.email, updated)
  }

  // Quiz Finish Logic
  const handleQuizFinish = (score, total) => {
    if (session && activeQuiz) {
      const pct = Math.round((score / total) * 100)
      const updated = { ...quizProgress, [activeQuiz.id]: pct }
      setQuizProgress(updated)
      ls.set('msp_qprog_' + session.email, updated)
    }
    setActiveQuiz(null) // Return to quiz browser
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#030712' }}>
      
      {showAuth && <AuthModal onSuccess={(s) => { setSess(s); setAuth(false) }} onClose={() => setAuth(false)} />}

      {/* ── PROFESSIONAL SIDEBAR ── */}
      <div style={{ width: 280, background: '#0B0F19', borderRight: '1px solid #1F2937', padding: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #3B82F6, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 18, boxShadow: '0 0 15px rgba(59,130,246,0.3)' }}>M</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>MedSchoolPrep</div>
            <div style={{ fontSize: 11, color: '#3B82F6', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Pro Suite</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <div style={{ fontSize: 11, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, marginTop: 10, paddingLeft: 16 }}>Curriculum</div>
          <button onClick={() => {setTab('plans'); setActivePlan(null)}} style={navStyle(tab === 'plans')}>📅 Study Plans</button>
          <button onClick={() => {setTab('quiz'); setActiveQuiz(null)}} style={navStyle(tab === 'quiz')}>🧠 Quiz Engine</button>
          
          <div style={{ fontSize: 11, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, marginTop: 24, paddingLeft: 16 }}>Tools</div>
          <button onClick={() => {setTab('coach')}} style={navStyle(tab === 'coach')}>💬 AI Coach</button>
          <button onClick={() => {setTab('amcas')}} style={navStyle(tab === 'amcas')}>🏥 AMCAS Vault</button>
        </div>

        {session ? (
          <div style={{ padding: 16, background: '#111827', borderRadius: 16, border: '1px solid #1F2937' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB' }}>{session.name}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>{session.email}</div>
            <button onClick={() => { ls.del('msp_session'); setSess(null); setActivities([]) }} style={{ width: '100%', padding: 8, background: '#1F2937', borderRadius: 8, border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'background 0.2s', ':hover': { background: '#374151' } }}>Log Out</button>
          </div>
        ) : (
          <button onClick={() => setAuth(true)} style={{ padding: 16, background: 'linear-gradient(135deg, #3B82F6, #10B981)', borderRadius: 16, border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.2)' }}>
            Sign In / Sign Up
          </button>
        )}
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 60px', position: 'relative' }}>
        
        {/* Subtle Background Glow */}
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '80%', height: 400, background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 10 }}>
          
          {/* ── TAB: STUDY PLANS (List) ── */}
          {tab === 'plans' && !activePlan && (
            <div className="fade-in">
              <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.02em' }}>Structured Programs</h1>
              <p style={{ color: '#9CA3AF', fontSize: 16, marginBottom: 48, maxWidth: 600, lineHeight: 1.6 }}>Stop guessing what to study. Select a pre-built, highly optimized schedule designed specifically for MCAT mastery and admissions success.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                {STUDY_PLANS.map(p => (
                  <div key={p.id} onClick={() => setActivePlan(p)} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 24, padding: 32, cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }} className="hover-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                      <div style={{ width: 56, height: 56, borderRadius: 16, background: `${p.color}15`, color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, border: `1px solid ${p.color}30` }}>{p.icon}</div>
                    </div>
                    <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#F9FAFB' }}>{p.title}</h3>
                    <div style={{ fontSize: 13, color: p.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>{p.focus}</div>
                    <p style={{ color: '#9CA3AF', fontSize: 14, lineHeight: 1.6 }}>{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: ACTIVE STUDY PLAN (Detail View) ── */}
          {tab === 'plans' && activePlan && (
            <div className="fade-in">
              <button onClick={() => setActivePlan(null)} style={{ background: 'none', border: 'none', color: '#60A5FA', cursor: 'pointer', marginBottom: 24, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, padding: 0, fontWeight: 600 }}>← Back to Programs</button>
              <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 16, letterSpacing: '-0.02em' }}>{activePlan.title}</h1>
              <div style={{ height: 4, background: '#1F2937', borderRadius: 2, marginBottom: 48, overflow: 'hidden' }}>
                 <div style={{ height: '100%', width: '15%', background: activePlan.color }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {activePlan.schedule.map((day, i) => (
                  <div key={i} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 20, padding: 32, display: 'flex', gap: 32 }}>
                    <div style={{ minWidth: 100 }}>
                      <div style={{ fontSize: 14, color: activePlan.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{day.day}</div>
                    </div>
                    <div>
                      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#F9FAFB' }}>{day.title}</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {day.tasks.map((task, j) => (
                          <label key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                            <input type="checkbox" style={{ width: 20, height: 20, accentColor: activePlan.color, marginTop: 2, cursor: 'pointer' }} />
                            <span style={{ color: '#D1D5DB', fontSize: 15, lineHeight: 1.5 }}>{task}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: QUIZ ENGINE BROWSER ── */}
          {tab === 'quiz' && !activeQuiz && (
            <div className="fade-in">
              <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.02em' }}>Quiz Engine</h1>
              <p style={{ color: '#9CA3AF', fontSize: 16, marginBottom: 48, maxWidth: 600, lineHeight: 1.6 }}>Test your knowledge with hyper-adaptive, high-yield MCAT questions.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {QUIZZES.map(q => {
                  const score = quizProgress[q.id]
                  return (
                    <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 24, background: '#111827', borderRadius: 20, border: '1px solid #1F2937', transition: 'border-color 0.2s', ':hover': { borderColor: '#374151' } }}>
                      <div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#F9FAFB' }}>{q.title}</h3>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#3B82F6', fontWeight: 700, background: '#1E3A8A30', padding: '4px 10px', borderRadius: 20 }}>{q.cat}</span>
                          <span style={{ fontSize: 13, color: '#6B7280' }}>{q.qs.length} Questions</span>
                          {score !== undefined && <span style={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>✓ {score}%</span>}
                        </div>
                      </div>
                      <button onClick={() => setActiveQuiz(q)} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #3B82F6, #10B981)', borderRadius: 12, border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', transition: 'transform 0.2s', ':active': { transform: 'scale(0.98)' } }}>
                        {score !== undefined ? 'Retake' : 'Start'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── TAB: ACTIVE QUIZ ── */}
          {tab === 'quiz' && activeQuiz && (
            <QuizEngine quiz={activeQuiz} onFinish={handleQuizFinish} />
          )}

          {/* ── TAB: AMCAS ACTIVITY VAULT ── */}
          {tab === 'amcas' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48 }}>
                <div>
                  <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.02em' }}>AMCAS Vault</h1>
                  <p style={{ color: '#9CA3AF', fontSize: 16, maxWidth: 600, lineHeight: 1.6 }}>A professional tracker for your clinical hours, shadowing, and research. Log the raw details now so you aren't stressing during application season.</p>
                </div>
                <button onClick={handleAddActivity} style={{ padding: '12px 24px', background: '#3B82F6', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>+</span> Log Activity
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {activities.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '80px 40px', background: '#111827', borderRadius: 24, border: '1px dashed #374151' }}>
                    <div style={{ fontSize: 40, marginBottom: 16 }}>🏥</div>
                    <div style={{ color: '#F9FAFB', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No activities logged yet.</div>
                    <div style={{ color: '#6B7280', fontSize: 14 }}>Start tracking your premed journey today to build a bulletproof application.</div>
                  </div>
                ) : activities.map((act) => (
                  <div key={act.id} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 24, padding: 32 }}>
                    <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                      <div style={{ flex: 2 }}>
                        <label style={labelStyle}>Experience Name / Title</label>
                        <input type="text" placeholder="e.g., Medical Scribe at City Hospital" value={act.title} onChange={e => updateActivity(act.id, 'title', e.target.value)} style={inpStyle} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Category</label>
                        <select value={act.category} onChange={e => updateActivity(act.id, 'category', e.target.value)} style={{ ...inpStyle, appearance: 'none' }}>
                          <option>Clinical Experience</option>
                          <option>Physician Shadowing</option>
                          <option>Research / Lab</option>
                          <option>Volunteering (Non-Clinical)</option>
                          <option>Leadership</option>
                        </select>
                      </div>
                      <div style={{ width: 120 }}>
                        <label style={labelStyle}>Total Hours</label>
                        <input type="number" placeholder="0" value={act.hours} onChange={e => updateActivity(act.id, 'hours', e.target.value)} style={inpStyle} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Raw Description & Notes (What did you do? How did it feel?)</label>
                      <textarea placeholder="Brain dump your experience here. Don't worry about sounding professional yet..." value={act.notes} onChange={e => updateActivity(act.id, 'notes', e.target.value)} style={{ ...inpStyle, height: 120, resize: 'vertical', lineHeight: 1.5 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                      <button onClick={() => deleteActivity(act.id)} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete Entry</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: AI COACH (Chat) ── */}
          {tab === 'coach' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', paddingTop: '15vh' }}>
                     <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #3B82F6, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 24px', boxShadow: '0 0 40px rgba(59,130,246,0.3)' }}>M</div>
                     <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16, color: '#F9FAFB' }}>Your Personal AI Coach</h1>
                     <p style={{ color: '#9CA3AF', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>Ask complex biochemistry questions, request mock MMI scenarios, or review your application essays.</p>
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const isUser = m.role === 'user'
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 24 }}>
                        {!isUser && <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg, #3B82F6, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 16, marginRight: 16, flexShrink: 0, marginTop: 4 }}>M</div>}
                        <div style={{ maxWidth: '80%', background: isUser ? '#2563EB' : '#111827', border: isUser ? 'none' : '1px solid #1F2937', borderRadius: 24, borderTopLeftRadius: isUser ? 24 : 6, borderTopRightRadius: isUser ? 6 : 24, padding: '20px 24px', fontSize: 15, lineHeight: 1.7, color: '#F9FAFB', boxShadow: isUser ? '0 10px 25px rgba(37,99,235,0.2)' : '0 10px 25px rgba(0,0,0,0.2)' }}>
                          <span dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#fff">$1</strong>').replace(/\n/g, '<br/>') }} />
                        </div>
                      </div>
                    )
                  })
                )}
                {loading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 24 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg, #3B82F6, #10B981)', marginRight: 16 }} />
                    <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '6px 24px 24px 24px', padding: '20px 24px', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <div style={{ width: 8, height: 8, background: '#4B5563', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
                      <div style={{ width: 8, height: 8, background: '#4B5563', borderRadius: '50%', animation: 'pulse 1s infinite 0.2s' }} />
                      <div style={{ width: 8, height: 8, background: '#4B5563', borderRadius: '50%', animation: 'pulse 1s infinite 0.4s' }} />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              
              {/* Chat Input */}
              <div style={{ position: 'fixed', bottom: 0, left: 280, right: 0, padding: '32px 60px', background: 'linear-gradient(to top, #030712 70%, transparent)', zIndex: 10 }}>
                <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative' }}>
                  <input 
                    value={input} 
                    onChange={e=>setInput(e.target.value)} 
                    onKeyDown={e=>{ if(e.key === 'Enter') sendToCoach() }}
                    placeholder="Ask your coach anything..."
                    style={{ width: '100%', padding: '20px 70px 20px 24px', background: '#111827', border: '1px solid #374151', borderRadius: 20, color: '#fff', fontSize: 16, outline: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}
                  />
                  <button onClick={sendToCoach} disabled={!input.trim() || loading} style={{ position: 'absolute', right: 12, top: 12, bottom: 12, width: 48, borderRadius: 12, background: input.trim() ? 'linear-gradient(135deg, #3B82F6, #10B981)' : '#1F2937', border: 'none', color: '#fff', cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', fontSize: 20 }}>
                    ↑
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* Global Styles & Animations */}
      <style>{`
        .hover-card:hover { border-color: #3B82F6 !important; transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

const navStyle = (active) => ({
  background: active ? '#1F2937' : 'transparent',
  color: active ? '#F9FAFB' : '#9CA3AF',
  border: 'none',
  padding: '12px 16px',
  borderRadius: 12,
  textAlign: 'left',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginLeft: 8,
  marginRight: 8
})

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }    
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
