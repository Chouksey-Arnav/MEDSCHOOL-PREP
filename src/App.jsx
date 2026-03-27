import React, { useState, useEffect, useRef } from 'react'

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
      { day: 'Day 1', title: 'Amino Acids & Enzyme Kinetics', tasks: ['Memorize 20 standard AAs', 'Take Biochemistry Quiz 1', '2 CARS Passages'] },
      { day: 'Day 2', title: 'Metabolism: Glycolysis & TCA', tasks: ['Draw Glycolysis Pathway', 'Take Metabolism Quiz', 'Review Psych/Soc'] },
    ]
  }
]

// ── MASSIVE QUIZ DATABASE (Strict 15-Question Matrices) ──────────────────
// Quadruple Checked Variation: exactly 4 As (0), 4 Bs (1), 3 Cs (2), 4 Ds (3) per quiz.
const QUIZZES = [
  {
    id:'q001', cat:'Bio/Biochem', title:'Advanced Metabolism & Enzymes', diff:'Hard',
    qs:[
      {q:'Which enzyme bypasses PFK-1 during gluconeogenesis?', ch:['Pyruvate carboxylase','Glucose-6-phosphatase','Fructose-1,6-bisphosphatase','PEP carboxykinase'], ans:2, exp:'FBPase-1 reverses the PFK-1 step.'}, 
      {q:'A competitive inhibitor will alter the Lineweaver-Burk plot by:', ch:['Increasing the y-intercept','Decreasing the x-intercept','Leaving the x-intercept unchanged','Increasing the slope without changing the y-intercept'], ans:3, exp:'Km increases (x-int moves toward origin), Vmax is unchanged (y-int stays same), so slope (Km/Vmax) increases.'}, 
      {q:'Which complex of the ETC does NOT pump protons?', ch:['Complex II','Complex I','Complex III','Complex IV'], ans:0, exp:'Complex II (Succinate dehydrogenase) transfers electrons to CoQ but pumps no protons.'}, 
      {q:'Cyanide inhibits the ETC by binding to:', ch:['Cytochrome c','Cytochrome a3 (Complex IV)','Ubiquinone','ATP Synthase'], ans:1, exp:'CN binds the ferric iron in Complex IV.'}, 
      {q:'What is the net ATP yield of glycolysis per glucose molecule?', ch:['4','1','3','2'], ans:3, exp:'4 produced, 2 consumed. Net 2.'}, 
      {q:'Which amino acid has a pKa near physiological pH?', ch:['Histidine','Lysine','Arginine','Glutamate'], ans:0, exp:'Histidine pKa is ~6.0, making it useful in active sites.'}, 
      {q:'During starvation, the brain uses which molecule for energy?', ch:['Fatty acids','Ketone bodies','Glycerol','Amino acids'], ans:1, exp:'The brain relies on ketone bodies like β-hydroxybutyrate.'}, 
      {q:'Which of the following is a purely ketogenic amino acid?', ch:['Phenylalanine','Tyrosine','Isoleucine','Leucine'], ans:3, exp:'Leucine and Lysine are purely ketogenic.'}, 
      {q:'The pentose phosphate pathway primarily generates:', ch:['NADPH and Ribose-5-P','NADH and Pyruvate','ATP and FADH2','GTP and Citrate'], ans:0, exp:'Produces reducing equivalents (NADPH) and nucleotide precursors.'}, 
      {q:'Which vitamin is a required cofactor for transaminases (AST/ALT)?', ch:['Thiamine (B1)','Pyridoxal phosphate (B6)','Riboflavin (B2)','Cobalamin (B12)'], ans:1, exp:'PLP (B6) is required for amino acid transamination.'}, 
      {q:'A deficiency in sphingomyelinase leads to which disease?', ch:['Tay-Sachs','Gaucher disease','Fabry disease','Niemann-Pick disease'], ans:3, exp:'Niemann-Pick is characterized by sphingomyelin accumulation.'}, 
      {q:'What type of bond connects the backbone of DNA?', ch:['Hydrogen bond','Peptide bond','Phosphodiester bond','Glycosidic bond'], ans:2, exp:'Phosphodiester bonds link the 3\' carbon to the 5\' phosphate.'}, 
      {q:'Which polymerase synthesizes mRNA in eukaryotes?', ch:['RNA Pol I','RNA Pol II','RNA Pol III','DNA Pol III'], ans:1, exp:'RNA Pol II makes mRNA.'}, 
      {q:'In the lac operon, the repressor binds to the:', ch:['Promoter','Enhancer','Operator','Silencer'], ans:2, exp:'The repressor blocks RNA polymerase by binding the operator.'}, 
      {q:'Which process occurs entirely in the cytoplasm?', ch:['Glycolysis','TCA Cycle','Oxidative Phosphorylation','Fatty Acid Beta-Oxidation'], ans:0, exp:'Glycolysis happens in the cytosol.'} 
    ]
  },
  {
    id:'q002', cat:'Chem/Phys', title:'Thermodynamics & Fluid Dynamics', diff:'Hard',
    qs:[
      {q:'According to Poiseuille\'s Law, halving the radius of a vessel reduces flow by a factor of:', ch:['2','4','8','16'], ans:3, exp:'Flow is proportional to radius to the fourth power (r^4).'}, 
      {q:'Which of the following is a state function?', ch:['Work','Heat','Enthalpy','Power'], ans:2, exp:'Enthalpy (H) is path-independent.'}, 
      {q:'If ΔG is negative, the reaction is:', ch:['Exothermic','Endothermic','At equilibrium','Spontaneous'], ans:3, exp:'Negative Gibbs free energy means the reaction proceeds spontaneously.'}, 
      {q:'An adiabatic process is characterized by:', ch:['No change in heat (Q=0)','Constant volume','Constant pressure','Constant temperature'], ans:0, exp:'Adiabatic means no heat exchange with the environment.'}, 
      {q:'Which zero-order kinetic statement is true?', ch:['Rate depends on reactant squared','Rate is independent of reactant concentration','Half-life is constant','Rate increases with time'], ans:1, exp:'Zero-order rate = k. It does not depend on concentration.'}, 
      {q:'A catalyst increases the rate of reaction by:', ch:['Increasing temperature','Increasing collision frequency','Shifting equilibrium right','Lowering activation energy'], ans:3, exp:'Catalysts lower the transition state energy barrier.'}, 
      {q:'At constant temperature, Boyle\'s Law states that:', ch:['Pressure is inversely proportional to volume','Volume is directly proportional to moles','Pressure is directly proportional to temperature','Volume is constant'], ans:0, exp:'P1V1 = P2V2.'}, 
      {q:'In a galvanic cell, oxidation occurs at the:', ch:['Cathode','Anode','Salt bridge','Voltmeter'], ans:1, exp:'An Ox, Red Cat. Oxidation always occurs at the anode.'}, 
      {q:'What is the standard cell potential if E°red(cathode) = 0.80V and E°red(anode) = -0.76V?', ch:['0.04V','-1.56V','-0.04V','1.56V'], ans:3, exp:'Ecell = Ecathode - Eanode = 0.80 - (-0.76) = 1.56V.'}, 
      {q:'Which of the following represents standard conditions?', ch:['298 K, 1 atm, 1 M','273 K, 1 atm, 1 M','298 K, 0 atm, 1 M','273 K, 1 atm, 0 M'], ans:0, exp:'Standard state: 298K (25C), 1 atm, 1 M concentration.'}, 
      {q:'Which phase change is strictly endothermic?', ch:['Condensation','Sublimation','Freezing','Deposition'], ans:1, exp:'Sublimation (solid to gas) requires energy input.'}, 
      {q:'A fluid moving through a narrowed pipe will experience:', ch:['Increased velocity, increased pressure','Decreased velocity, increased pressure','Increased velocity, decreased pressure','Decreased velocity, decreased pressure'], ans:2, exp:'Bernoulli\'s principle: higher velocity = lower pressure.'}, 
      {q:'The focal length of a spherical mirror is equal to:', ch:['Half the radius of curvature','The radius of curvature','Double the radius of curvature','Infinite'], ans:0, exp:'f = R/2.'}, 
      {q:'Capacitance in a parallel plate capacitor is increased by:', ch:['Increasing distance between plates','Inserting a dielectric material','Decreasing plate area','Increasing voltage'], ans:1, exp:'C = k(e0*A/d). Dielectrics increase capacitance.'}, 
      {q:'Alpha decay of Uranium-238 results in a nucleus with:', ch:['Atomic number 92','Mass number 238','Mass number 234','Atomic number 91'], ans:2, exp:'Alpha particle is He (mass 4). 238 - 4 = 234.'} 
    ]
  },
  {
    id:'q003', cat:'Psych/Soc', title:'Behavioral Science Foundations', diff:'Medium',
    qs:[
      {q:'Which psychological perspective focuses heavily on operant conditioning?', ch:['Psychoanalytic','Humanistic','Cognitive','Behaviorist'], ans:3, exp:'Behaviorism focuses on observable behaviors shaped by reinforcement.'}, 
      {q:'In Piaget\'s stages, conservation is typically mastered during the:', ch:['Concrete operational stage','Preoperational stage','Formal operational stage','Sensorimotor stage'], ans:0, exp:'Conservation (7-11 years) marks the concrete operational stage.'}, 
      {q:'A child cries when their mother leaves but is comforted when she returns. This is:', ch:['Avoidant attachment','Secure attachment','Disorganized attachment','Ambivalent attachment'], ans:1, exp:'Classic secure attachment behavior.'}, 
      {q:'Which brain structure is primarily responsible for fear conditioning?', ch:['Hippocampus','Thalamus','Amygdala','Cerebellum'], ans:2, exp:'The amygdala processes emotion, particularly fear.'}, 
      {q:'The phenomenon where individuals put in less effort in a group setting is called:', ch:['Social facilitation','Group polarization','Deindividuation','Social loafing'], ans:3, exp:'Social loafing occurs when individual effort isn\'t evaluated.'}, 
      {q:'According to Erikson, the primary conflict of adolescence is:', ch:['Identity vs. Role Confusion','Intimacy vs. Isolation','Trust vs. Mistrust','Generativity vs. Stagnation'], ans:0, exp:'Adolescents (12-18) struggle with identity formation.'}, 
      {q:'Schizophrenia is most closely associated with excessive transmission of:', ch:['Serotonin','Dopamine','GABA','Acetylcholine'], ans:1, exp:'The dopamine hypothesis links schizophrenia to high dopamine.'}, 
      {q:'Which theory views society as a complex system promoting solidarity?', ch:['Conflict Theory','Symbolic Interactionism','Functionalism','Feminist Theory'], ans:2, exp:'Structural functionalism views society as an organism.'}, 
      {q:'The Hawthorne effect refers to:', ch:['A decrease in performance under pressure','Remembering the first items in a list','Obeying authoritative figures','Altering behavior because one is being observed'], ans:3, exp:'People change behavior when they know they are being watched.'}, 
      {q:'Retrograde amnesia is defined as the inability to:', ch:['Recall past memories','Form new memories','Recognize faces','Speak fluently'], ans:0, exp:'Retrograde = forgetting the past.'}, 
      {q:'In classical conditioning, a conditioned stimulus was originally a(n):', ch:['Unconditioned response','Neutral stimulus','Conditioned response','Unconditioned stimulus'], ans:1, exp:'A neutral stimulus (bell) becomes conditioned after pairing.'}, 
      {q:'The fundamental attribution error is the tendency to overestimate:', ch:['Situational factors','Cultural factors','Groupthink','Dispositional factors'], ans:3, exp:'We blame disposition rather than situation.'}, 
      {q:'Which part of the eye is responsible for high-acuity color vision?', ch:['Cornea','Lens','Fovea centralis','Optic disc'], ans:2, exp:'The fovea is densely packed with cones.'}, 
      {q:'Sleep spindles and K-complexes are characteristic of which sleep stage?', ch:['Stage 1 (N1)','Stage 2 (N2)','Stage 3 (N3)','REM sleep'], ans:1, exp:'Stage 2 EEG shows these distinct waveforms.'}, 
      {q:'The belief that one\'s own culture is superior to others is called:', ch:['Cultural relativism','Ethnocentrism','Xenocentrism','Social Darwinism'], ans:0, exp:'Ethnocentrism is judging others by one\'s own cultural standards.'} 
    ]
  },
  {
    id:'q004', cat:'Bio/Biochem', title:'Genetics & Molecular Biology', diff:'Hard',
    qs:[
      {q:'Which of the following serves as the universal start codon?', ch:['AUG','UAA','UAG','UGA'], ans:0, exp:'AUG codes for Methionine and establishes the reading frame.'}, 
      {q:'In the Hardy-Weinberg equation, p + q equals:', ch:['0','1','2','100'], ans:1, exp:'p and q represent the frequencies of the dominant and recessive alleles, which must sum to 100% (or 1).'}, 
      {q:'RNA Polymerase II is primarily responsible for synthesizing:', ch:['tRNA','rRNA','mRNA','snRNA'], ans:2, exp:'RNA Pol II synthesizes messenger RNA in eukaryotes.'}, 
      {q:'A mutation that changes an amino acid codon into a premature stop codon is a:', ch:['Missense mutation','Silent mutation','Frameshift mutation','Nonsense mutation'], ans:3, exp:'Nonsense mutations prematurely terminate translation.'}, 
      {q:'During which phase of the cell cycle does DNA replication occur?', ch:['S phase','G1 phase','G2 phase','M phase'], ans:0, exp:'Synthesis (S) phase is dedicated exclusively to DNA replication.'}, 
      {q:'A Southern blot is specifically used to detect the presence of specific:', ch:['Proteins','DNA sequences','RNA sequences','Lipids'], ans:1, exp:'SNoW DRoP: Southern = DNA, Northern = RNA, Western = Protein.'}, 
      {q:'What is the correct sequence of steps in a PCR cycle?', ch:['Anneal, Extend, Denature','Extend, Denature, Anneal','Denature, Anneal, Extend','Denature, Extend, Anneal'], ans:2, exp:'Heat separates strands (Denature), primers attach (Anneal), polymerase builds (Extend).'}, 
      {q:'The fully assembled eukaryotic ribosome has a sedimentation coefficient of:', ch:['50S','60S','70S','80S'], ans:3, exp:'Eukaryotes have 80S ribosomes (40S + 60S subunits). Prokaryotes have 70S.'}, 
      {q:'Which molecule acts as the inducer for the lac operon?', ch:['Allolactose','cAMP','Glucose','Tryptophan'], ans:0, exp:'Allolactose binds the repressor, causing it to fall off the operator.'}, 
      {q:'An X-linked recessive trait is most likely to be expressed in:', ch:['Females only','Males more frequently than females','Females more frequently than males','Both sexes equally'], ans:1, exp:'Males only have one X chromosome, so a single recessive allele guarantees expression.'}, 
      {q:'Telomerase functions by acting as a:', ch:['DNA-dependent RNA polymerase','RNA endonuclease','Reverse transcriptase','Topoisomerase'], ans:2, exp:'Telomerase carries its own RNA template and builds DNA from it (Reverse Transcriptase).'}, 
      {q:'The primary function of the spliceosome is to remove:', ch:['Exons','Promoters','Poly-A tails','Introns'], ans:3, exp:'Spliceosomes excise non-coding introns and join coding exons.'}, 
      {q:'A point mutation that does not alter the resulting amino acid is called a:', ch:['Silent mutation','Missense mutation','Nonsense mutation','Insertion'], ans:0, exp:'Due to the degeneracy of the genetic code, third-base wobble often creates silent mutations.'}, 
      {q:'Crossing over (homologous recombination) occurs during which phase of meiosis?', ch:['Metaphase I','Prophase I','Anaphase II','Prophase II'], ans:1, exp:'Recombination occurs between homologous chromosomes during Prophase I.'}, 
      {q:'The Central Dogma of molecular biology states that information flows from:', ch:['RNA → DNA → Protein','Protein → RNA → DNA','DNA → Protein → RNA','DNA → RNA → Protein'], ans:3, exp:'Information flows from DNA to mRNA (transcription) to Protein (translation).'} 
    ]
  },
  {
    id:'q005', cat:'Chem/Phys', title:'Organic Chemistry Mechanisms', diff:'Hard',
    qs:[
      {q:'An SN2 reaction on a chiral center will result in:', ch:['Retention of configuration','Inversion of configuration','A racemic mixture','No reaction'], ans:1, exp:'SN2 involves a backside attack, completely inverting stereochemistry.'}, 
      {q:'The rate of an SN1 reaction depends strictly on the concentration of the:', ch:['Nucleophile only','Solvent','Leaving group','Electrophile only'], ans:3, exp:'SN1 rate = k[Electrophile]. It is unimolecular, depending only on carbocation formation.'}, 
      {q:'For an E2 elimination to occur, the leaving group and the extracted proton must be:', ch:['Anti-periplanar','Syn-periplanar','Gauche','Eclipsed'], ans:0, exp:'E2 requires anti-periplanar geometry (180 degrees apart) for optimal orbital overlap.'}, 
      {q:'A sharp, strong peak at ~1700 cm⁻¹ on an IR spectrum is highly indicative of a:', ch:['Hydroxyl group (-OH)','Amine group (-NH2)','Carbonyl group (C=O)','Alkyne triple bond'], ans:2, exp:'Carbonyls (C=O) show strong, sharp absorption around 1700 cm-1.'}, 
      {q:'Enantiomers are stereoisomers that:', ch:['Have opposite R/S designations at every chiral center','Differ at only one chiral center','Are superimposable mirror images','Have completely different connectivities'], ans:0, exp:'Enantiomers are non-superimposable mirror images; every chiral center flips.'}, 
      {q:'A meso compound must possess chiral centers and:', ch:['A net dipole moment','An internal plane of symmetry','Optical activity','A trans double bond'], ans:1, exp:'Meso compounds have an internal plane of symmetry, rendering the overall molecule achiral.'}, 
      {q:'Oxidation of a primary alcohol with Pyridinium Chlorochromate (PCC) yields a(n):', ch:['Ketone','Carboxylic Acid','Ester','Aldehyde'], ans:3, exp:'PCC is a mild oxidant that stops at the aldehyde. Stronger agents (like KMnO4) go to carboxylic acids.'}, 
      {q:'Ozonolysis of an alkene results in the formation of:', ch:['Alcohols','Epoxides','Carbonyl compounds (Aldehydes/Ketones)','Alkanes'], ans:2, exp:'Ozone (O3) cleaves the double bond to form two carbonyls.'}, 
      {q:'A Grignard reagent (R-MgBr) typically functions as a strong:', ch:['Nucleophile and base','Electrophile and acid','Leaving group','Oxidizing agent'], ans:0, exp:'The carbon-magnesium bond makes the carbon highly nucleophilic and highly basic.'}, 
      {q:'The Diels-Alder reaction is best described as a:', ch:['[2+2] cycloaddition','[4+2] cycloaddition','Free radical halogenation','Nucleophilic acyl substitution'], ans:1, exp:'A diene (4 pi electrons) reacts with a dienophile (2 pi electrons) to form a ring.'}, 
      {q:'In an H-NMR spectrum, a signal appearing further downfield (higher ppm) indicates the proton is:', ch:['Highly shielded','Attached to a metal','Deshielded by an electronegative group','In a nonpolar solvent'], ans:2, exp:'Electronegative atoms pull electron density away, deshielding the proton.'}, 
      {q:'Reacting a carboxylic acid with thionyl chloride (SOCl₂) produces an:', ch:['Anhydride','Amide','Ester','Acyl chloride'], ans:3, exp:'SOCl2 converts OH into a good leaving group (Cl), forming an acyl chloride.'}, 
      {q:'Markovnikov\'s rule states that in the addition of HX to an alkene, the hydrogen adds to the carbon with:', ch:['More hydrogen atoms attached','More alkyl substituents','The highest electronegativity','A double bond'], ans:0, exp:'Adding H to the less substituted carbon creates the more stable carbocation intermediate.'}, 
      {q:'An epimer is a specific type of diastereomer that differs in configuration at:', ch:['All chiral centers','Exactly one chiral center','No chiral centers','The anomeric carbon only'], ans:1, exp:'Epimers differ at only a single stereocenter (e.g., Glucose and Galactose).'}, 
      {q:'A tosylate group (-OTs) is highly useful in organic synthesis because it acts as an excellent:', ch:['Nucleophile','Electrophile','Protecting group','Leaving group'], ans:3, exp:'Tosylates are resonance-stabilized weak bases, making them fantastic leaving groups.'} 
    ]
  },
  {
    id:'q006', cat:'Psych/Soc', title:'Neuroanatomy & Sensation', diff:'Medium',
    qs:[
      {q:'Which lobe of the brain is primarily responsible for executive function and voluntary movement?', ch:['Frontal lobe','Parietal lobe','Occipital lobe','Temporal lobe'], ans:0, exp:'The frontal lobe houses the motor cortex and handles planning, logic, and impulse control.'}, 
      {q:'A patient speaks fluently but the words make no sense ("word salad"). This indicates damage to:', ch:['Broca\'s area','The visual cortex','Wernicke\'s area','The basal ganglia'], ans:2, exp:'Wernicke\'s aphasia involves fluent speech but impaired language comprehension.'}, 
      {q:'Compared to cones, rod cells in the retina are more sensitive to:', ch:['Color variations','Low-intensity light','Fine details','High-frequency sounds'], ans:1, exp:'Rods operate well in dim light but do not detect color.'}, 
      {q:'The Gestalt Law of Proximity states that we tend to perceive objects as grouped together if they are:', ch:['Moving in the same direction','Similar in color','Connected by a line','Physically close to one another'], ans:3, exp:'Proximity means elements near each other are perceived as a group.'}, 
      {q:'Which neurotransmitter is primarily responsible for parasympathetic ("rest and digest") responses?', ch:['Acetylcholine','Epinephrine','Dopamine','Glutamate'], ans:0, exp:'ACh regulates parasympathetic output to lower heart rate and increase digestion.'}, 
      {q:'The hippocampus is a brain structure critically involved in:', ch:['Motor coordination','Memory consolidation','Heart rate regulation','Visual processing'], ans:1, exp:'The hippocampus converts short-term memories into long-term memories.'}, 
      {q:'Recognizing an ambiguous shape as the letter "B" because it sits between an "A" and a "C" is an example of:', ch:['Bottom-up processing','Parallel processing','Top-down processing','Transduction'], ans:2, exp:'Top-down processing uses prior expectations and context to interpret sensory input.'}, 
      {q:'The concept that the "Just Noticeable Difference" is a constant ratio of the original stimulus is known as:', ch:['Signal Detection Theory','Feature Detection','Place Theory','Weber\'s Law'], ans:3, exp:'Weber\'s Law states that the threshold for detecting a difference is proportional to the magnitude of the stimulus.'}, 
      {q:'In "split-brain" patients, which bundle of nerve fibers has been surgically severed?', ch:['Corpus callosum','Optic chiasm','Medulla oblongata','Cerebral peduncles'], ans:0, exp:'The corpus callosum connects the left and right cerebral hemispheres.'}, 
      {q:'Which of the following is a classic physiological response of the sympathetic nervous system?', ch:['Constriction of pupils','Dilation of pupils','Decreased heart rate','Increased salivation'], ans:1, exp:'Sympathetic = fight or flight. Dilation lets more light in to see threats.'}, 
      {q:'The primary somatosensory cortex (processing touch, pain, temperature) is located in the:', ch:['Frontal lobe','Temporal lobe','Parietal lobe','Occipital lobe'], ans:2, exp:'It is located on the postcentral gyrus of the parietal lobe.'}, 
      {q:'The kinesthetic sense refers specifically to the ability to perceive:', ch:['Gravity and balance','Temperature changes','Internal organ pain','Body position and movement in space'], ans:3, exp:'Kinesthesia (proprioception) tracks limb position via receptors in joints and muscles.'}, 
      {q:'The hair cells located in the organ of Corti act primarily as:', ch:['Mechanoreceptors','Chemoreceptors','Photoreceptors','Nociceptors'], ans:0, exp:'Sound waves physically bend the stereocilia, making them mechanoreceptors.'}, 
      {q:'Broca\'s area, responsible for speech production, is typically localized to the:', ch:['Right temporal lobe','Left frontal lobe','Right parietal lobe','Left occipital lobe'], ans:1, exp:'In most humans, language centers are lateralized to the left hemisphere.'}, 
      {q:'Signal Detection Theory suggests that our ability to detect a stimulus depends on both the signal\'s strength and our:', ch:['Age','Absolute threshold','Visual acuity','Psychological state and biases'], ans:3, exp:'Detection relies on physical intensity and cognitive factors (expectations, fatigue, motivation).'} 
    ]
  }
]

// ── SYSTEM PROMPT & MODAL ────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are MedSchoolPrep AI — an elite medical school preparation coach.`

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
        <h2 style={{ fontSize: 26, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>{view === 'login' ? 'Welcome Back' : 'Start Your Journey'}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
          {view === 'signup' && <input placeholder="Full Name" value={name} onChange={e=>setName(e.target.value)} style={inpStyle} />}
          <input placeholder="Email Address" type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inpStyle} />
          <input placeholder="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)} style={inpStyle} />
          <button onClick={handleAuth} style={{ background: '#3B82F6', padding: 16, borderRadius: 12, border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{view === 'login' ? 'Sign In' : 'Create Account'}</button>
        </div>
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button onClick={() => setView(view === 'login' ? 'signup' : 'login')} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}>Switch Mode</button>
        </div>
        <div style={{ marginTop: 16, textAlign: 'center' }}><button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer' }}>Continue as guest</button></div>
      </div>
    </div>
  )
}
const inpStyle = { width: '100%', padding: '16px', borderRadius: 12, background: '#030712', border: '1px solid #374151', color: '#fff', outline: 'none' }

// ── QUIZ ENGINE ──────────────────────────────────────────────────────────
function QuizEngine({ quiz, onFinish }) {
  const [qi, setQi] = useState(0)
  const [sel, setSel] = useState(null)
  const [confirmed, setConf] = useState(false)
  const [score, setScore] = useState(0)
  const q = quiz.qs[qi]
  const LETTERS = ['A', 'B', 'C', 'D']
  const progressPct = ((qi) / quiz.qs.length) * 100

  const handleConfirm = () => { if (sel !== null) { setConf(true); if (sel === q.ans) setScore(s => s + 1) } }
  const handleNext = () => { if (qi + 1 >= quiz.qs.length) onFinish(score + (sel === q.ans ? 1 : 0), quiz.qs.length); else { setQi(q => q + 1); setSel(null); setConf(false) } }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', background: '#111827', padding: 40, borderRadius: 24, border: '1px solid #1F2937' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ color: '#9CA3AF', fontWeight: 600 }}>Question {qi + 1} of {quiz.qs.length}</div>
        <div style={{ color: '#3B82F6', fontWeight: 700 }}>{quiz.cat}</div>
      </div>
      <div style={{ height: 6, background: '#1F2937', borderRadius: 3, marginBottom: 32 }}><div style={{ height: '100%', width: `${progressPct}%`, background: '#3B82F6', transition: 'width 0.4s' }} /></div>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: '#F9FAFB', marginBottom: 32 }}>{q.q}</h2>
      
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
          <div style={{ color: '#D1D5DB' }}>{q.exp}</div>
        </div>
      )}

      {!confirmed ? <button onClick={handleConfirm} disabled={sel === null} style={{ width: '100%', padding: 16, borderRadius: 14, background: sel === null ? '#1F2937' : '#3B82F6', color: '#fff', fontWeight: 700, border: 'none', cursor: sel === null ? 'not-allowed' : 'pointer' }}>Confirm Answer</button>
      : <button onClick={handleNext} style={{ width: '100%', padding: 16, borderRadius: 14, background: '#10B981', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}>{qi + 1 >= quiz.qs.length ? 'View Results →' : 'Next Question →'}</button>}
    </div>
  )
}

// ── MAIN LAYOUT ──────────────────────────────────────────────────────────
export default function App() {
  const [session, setSess] = useState(null)
  const [tab, setTab] = useState('quiz') 
  const [showAuth, setAuth] = useState(false)
  const [activePlan, setActivePlan] = useState(null)
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [quizFilter, setQuizFilter] = useState('All')
  const [quizProgress, setQuizProgress] = useState({})
  
  const [activities, setActivities] = useState([]) 
  const [messages, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoad] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    document.body.style.margin = '0'
    document.body.style.background = '#030712'
    document.body.style.color = '#F9FAFB'
    
    const s = ls.get('msp_session')
    if (s) { 
      setSess(s)
      setQuizProgress(ls.get('msp_qprog_' + s.email) || {})
      setActivities(ls.get('msp_vault_' + s.email) || [])
    }
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
        body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...newMsgs] }),
      })
      const data = await res.json()
      setMsgs([...newMsgs, { role: 'assistant', content: data.choices[0].message.content }])
    } catch { setMsgs([...newMsgs, { role: 'assistant', content: 'Connection error.' }]) }
    setLoad(false)
  }

  const handleAddActivity = () => { setActivities([{ id: Date.now(), title: '', category: 'Clinical Shadowing', hours: '', notes: '' }, ...activities]) }
  const updateActivity = (id, f, v) => { setActivities(activities.map(a => a.id === id ? { ...a, [f]: v } : a)) }
  const deleteActivity = (id) => { setActivities(activities.filter(a => a.id !== id)) }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#030712' }}>
      {showAuth && <AuthModal onSuccess={(s) => { setSess(s); setAuth(false) }} onClose={() => setAuth(false)} />}

      <div style={{ width: 280, background: '#0B0F19', borderRight: '1px solid #1F2937', padding: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #3B82F6, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>M</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>MedSchoolPrep</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <div style={{ fontSize: 11, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 16 }}>Curriculum</div>
          <button onClick={() => {setTab('quiz'); setActiveQuiz(null)}} style={navStyle(tab === 'quiz')}>🧠 Mastery Quizzes</button>
          <button onClick={() => {setTab('plans'); setActivePlan(null)}} style={navStyle(tab === 'plans')}>📅 Study Plans</button>
          <div style={{ fontSize: 11, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, marginTop: 24, paddingLeft: 16 }}>Tools</div>
          <button onClick={() => setTab('coach')} style={navStyle(tab === 'coach')}>💬 AI Coach</button>
          <button onClick={() => setTab('amcas')} style={navStyle(tab === 'amcas')}>🏥 AMCAS Vault</button>
        </div>
        {!session ? <button onClick={() => setAuth(true)} style={{ padding: 16, background: '#3B82F6', borderRadius: 16, border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Sign In</button>
        : <button onClick={() => { ls.del('msp_session'); setSess(null) }} style={{ padding: 16, background: '#1F2937', borderRadius: 16, border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Log Out</button>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 60px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '80%', height: 400, background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        
        <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 10 }}>
          
          {/* ── TAB: QUIZ INFRASTRUCTURE ── */}
          {tab === 'quiz' && !activeQuiz && (
            <div className="fade-in">
              <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 12 }}>Mastery Engine</h1>
              <p style={{ color: '#9CA3AF', marginBottom: 32 }}>Hyper-adaptive quizzes with mathematically varied answers.</p>
              
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                {['All', 'Bio/Biochem', 'Chem/Phys', 'Psych/Soc'].map(cat => (
                  <button key={cat} onClick={() => setQuizFilter(cat)} style={{ padding: '8px 20px', borderRadius: 20, cursor: 'pointer', border: 'none', background: quizFilter === cat ? '#3B82F6' : '#111827', color: '#fff' }}>{cat}</button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
                {QUIZZES.filter(q => quizFilter === 'All' || q.cat.includes(quizFilter)).map(q => {
                  const score = quizProgress[q.id]
                  return (
                    <div key={q.id} style={{ padding: 24, background: '#111827', borderRadius: 20, border: '1px solid #1F2937' }}>
                      <span style={{ fontSize: 11, color: '#3B82F6', fontWeight: 800, textTransform: 'uppercase' }}>{q.cat}</span>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#F9FAFB', marginTop: 8, marginBottom: 20 }}>{q.title}</h3>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {score !== undefined ? <div style={{ color: '#10B981', fontWeight: 700 }}>{score}%</div> : <div style={{ color: '#6B7280' }}>Not started</div>}
                        <button onClick={() => setActiveQuiz(q)} style={{ padding: '8px 20px', background: '#3B82F6', borderRadius: 10, border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Start</button>
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
              <button onClick={() => setActivePlan(null)} style={{ background: 'none', border: 'none', color: '#60A5FA', cursor: 'pointer', marginBottom: 24, fontWeight: 600 }}>← Back</button>
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

const navStyle = (active) => ({ background: active ? '#1F2937' : 'transparent', color: active ? '#F9FAFB' : '#9CA3AF', border: 'none', padding: '12px 16px', borderRadius: 12, textAlign: 'left', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', margin: '0 8px' })
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }
