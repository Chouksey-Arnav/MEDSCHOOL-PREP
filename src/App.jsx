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

// ── MASSIVE QUIZ DATABASE (Strictly Varied Matrices) ─────────────────────
// Variation actively shifts per quiz (e.g. 4A/4B/3C/4D, 3A/5B/3C/4D) to prevent pattern recognition.
const QUIZZES = [
  {
    id:'q001', cat:'Bio/Biochem', title:'Advanced Metabolism & Enzymes', diff:'Hard',
    qs:[
      {q:'Which enzyme bypasses PFK-1 during gluconeogenesis?', ch:['Pyruvate carboxylase','Glucose-6-phosphatase','Fructose-1,6-bisphosphatase','PEP carboxykinase'], ans:2, exp:'FBPase-1 reverses the PFK-1 step.'}, 
      {q:'A competitive inhibitor will alter the Lineweaver-Burk plot by:', ch:['Increasing the y-intercept','Decreasing the x-intercept','Leaving the x-intercept unchanged','Increasing the slope without changing the y-intercept'], ans:3, exp:'Km increases, Vmax is unchanged, so slope increases.'}, 
      {q:'Which complex of the ETC does NOT pump protons?', ch:['Complex II','Complex I','Complex III','Complex IV'], ans:0, exp:'Complex II (Succinate dehydrogenase) transfers electrons but pumps no protons.'}, 
      {q:'Cyanide inhibits the ETC by binding to:', ch:['Cytochrome c','Cytochrome a3 (Complex IV)','Ubiquinone','ATP Synthase'], ans:1, exp:'CN binds the ferric iron in Complex IV.'}, 
      {q:'What is the net ATP yield of glycolysis per glucose molecule?', ch:['4','1','3','2'], ans:3, exp:'4 produced, 2 consumed. Net 2.'}, 
      {q:'Which amino acid has a pKa near physiological pH?', ch:['Histidine','Lysine','Arginine','Glutamate'], ans:0, exp:'Histidine pKa is ~6.0.'}, 
      {q:'During starvation, the brain uses which molecule for energy?', ch:['Fatty acids','Ketone bodies','Glycerol','Amino acids'], ans:1, exp:'The brain relies on ketone bodies like β-hydroxybutyrate.'}, 
      {q:'Which of the following is a purely ketogenic amino acid?', ch:['Phenylalanine','Tyrosine','Isoleucine','Leucine'], ans:3, exp:'Leucine and Lysine are purely ketogenic.'}, 
      {q:'The pentose phosphate pathway primarily generates:', ch:['NADPH and Ribose-5-P','NADH and Pyruvate','ATP and FADH2','GTP and Citrate'], ans:0, exp:'Produces reducing equivalents (NADPH).'}, 
      {q:'Which vitamin is a required cofactor for transaminases (AST/ALT)?', ch:['Thiamine (B1)','Pyridoxal phosphate (B6)','Riboflavin (B2)','Cobalamin (B12)'], ans:1, exp:'PLP (B6) is required for transamination.'}, 
      {q:'A deficiency in sphingomyelinase leads to which disease?', ch:['Tay-Sachs','Gaucher disease','Fabry disease','Niemann-Pick disease'], ans:3, exp:'Niemann-Pick causes sphingomyelin accumulation.'}, 
      {q:'What type of bond connects the backbone of DNA?', ch:['Hydrogen bond','Peptide bond','Phosphodiester bond','Glycosidic bond'], ans:2, exp:'Phosphodiester bonds link 3\' to 5\'.'}, 
      {q:'Which polymerase synthesizes mRNA in eukaryotes?', ch:['RNA Pol I','RNA Pol II','RNA Pol III','DNA Pol III'], ans:1, exp:'RNA Pol II makes mRNA.'}, 
      {q:'In the lac operon, the repressor binds to the:', ch:['Promoter','Enhancer','Operator','Silencer'], ans:2, exp:'The repressor blocks RNA Pol by binding the operator.'}, 
      {q:'Which process occurs entirely in the cytoplasm?', ch:['Glycolysis','TCA Cycle','Oxidative Phosphorylation','Fatty Acid Beta-Oxidation'], ans:0, exp:'Glycolysis happens in the cytosol.'} 
    ]
  },
  {
    id:'q002', cat:'Chem/Phys', title:'Thermodynamics & Fluid Dynamics', diff:'Hard',
    qs:[
      {q:'Halving the radius of a vessel reduces flow by a factor of:', ch:['2','4','8','16'], ans:3, exp:'Flow is proportional to r^4.'}, 
      {q:'Which of the following is a state function?', ch:['Work','Heat','Enthalpy','Power'], ans:2, exp:'Enthalpy (H) is path-independent.'}, 
      {q:'If ΔG is negative, the reaction is:', ch:['Exothermic','Endothermic','At equilibrium','Spontaneous'], ans:3, exp:'Negative Gibbs free energy = spontaneous.'}, 
      {q:'An adiabatic process is characterized by:', ch:['No change in heat (Q=0)','Constant volume','Constant pressure','Constant temperature'], ans:0, exp:'Adiabatic means no heat exchange.'}, 
      {q:'Which zero-order kinetic statement is true?', ch:['Rate depends on reactant squared','Rate is independent of reactant concentration','Half-life is constant','Rate increases with time'], ans:1, exp:'Zero-order rate = k.'}, 
      {q:'A catalyst increases the rate of reaction by:', ch:['Increasing temperature','Increasing collision frequency','Shifting equilibrium right','Lowering activation energy'], ans:3, exp:'Catalysts lower the transition state energy.'}, 
      {q:'At constant temperature, Boyle\'s Law states that:', ch:['Pressure is inversely proportional to volume','Volume is directly proportional to moles','Pressure is directly proportional to temperature','Volume is constant'], ans:0, exp:'P1V1 = P2V2.'}, 
      {q:'In a galvanic cell, oxidation occurs at the:', ch:['Cathode','Anode','Salt bridge','Voltmeter'], ans:1, exp:'An Ox, Red Cat.'}, 
      {q:'What is standard cell potential if E°red(cat)=0.80V and E°red(an)=-0.76V?', ch:['0.04V','-1.56V','-0.04V','1.56V'], ans:3, exp:'Ecell = 0.80 - (-0.76) = 1.56V.'}, 
      {q:'Which of the following represents standard conditions?', ch:['298 K, 1 atm, 1 M','273 K, 1 atm, 1 M','298 K, 0 atm, 1 M','273 K, 1 atm, 0 M'], ans:0, exp:'Standard state is 298K.'}, 
      {q:'Which phase change is strictly endothermic?', ch:['Condensation','Sublimation','Freezing','Deposition'], ans:1, exp:'Sublimation requires energy input.'}, 
      {q:'A fluid moving through a narrowed pipe will experience:', ch:['Increased velocity, increased pressure','Decreased velocity, increased pressure','Increased velocity, decreased pressure','Decreased velocity, decreased pressure'], ans:2, exp:'Bernoulli\'s principle: higher velocity = lower pressure.'}, 
      {q:'The focal length of a spherical mirror is equal to:', ch:['Half the radius of curvature','The radius of curvature','Double the radius of curvature','Infinite'], ans:0, exp:'f = R/2.'}, 
      {q:'Capacitance in a parallel plate capacitor is increased by:', ch:['Increasing distance between plates','Inserting a dielectric material','Decreasing plate area','Increasing voltage'], ans:1, exp:'Dielectrics increase capacitance.'}, 
      {q:'Alpha decay of Uranium-238 results in a nucleus with:', ch:['Atomic number 92','Mass number 238','Mass number 234','Atomic number 91'], ans:2, exp:'Mass drops by 4.'} 
    ]
  },
  {
    id:'q003', cat:'Psych/Soc', title:'Behavioral Science Foundations', diff:'Medium',
    qs:[
      {q:'Which psychological perspective focuses heavily on operant conditioning?', ch:['Psychoanalytic','Humanistic','Cognitive','Behaviorist'], ans:3, exp:'Behaviorism focuses on reinforcement.'}, 
      {q:'In Piaget\'s stages, conservation is typically mastered during the:', ch:['Concrete operational stage','Preoperational stage','Formal operational stage','Sensorimotor stage'], ans:0, exp:'Conservation marks the concrete operational stage.'}, 
      {q:'A child easily comforted upon the mother\'s return exhibits:', ch:['Avoidant attachment','Secure attachment','Disorganized attachment','Ambivalent attachment'], ans:1, exp:'Classic secure attachment.'}, 
      {q:'Which brain structure is primarily responsible for fear conditioning?', ch:['Hippocampus','Thalamus','Amygdala','Cerebellum'], ans:2, exp:'The amygdala processes fear.'}, 
      {q:'Putting in less effort in a group setting is called:', ch:['Social facilitation','Group polarization','Deindividuation','Social loafing'], ans:3, exp:'Social loafing.'}, 
      {q:'According to Erikson, the primary conflict of adolescence is:', ch:['Identity vs. Role Confusion','Intimacy vs. Isolation','Trust vs. Mistrust','Generativity vs. Stagnation'], ans:0, exp:'Adolescents struggle with identity.'}, 
      {q:'Schizophrenia is most closely associated with excessive:', ch:['Serotonin','Dopamine','GABA','Acetylcholine'], ans:1, exp:'The dopamine hypothesis.'}, 
      {q:'Which theory views society as a complex system promoting solidarity?', ch:['Conflict Theory','Symbolic Interactionism','Functionalism','Feminist Theory'], ans:2, exp:'Structural functionalism views society as an organism.'}, 
      {q:'The Hawthorne effect refers to:', ch:['A decrease in performance under pressure','Remembering the first items in a list','Obeying authoritative figures','Altering behavior because one is being observed'], ans:3, exp:'Changing behavior when observed.'}, 
      {q:'Retrograde amnesia is defined as the inability to:', ch:['Recall past memories','Form new memories','Recognize faces','Speak fluently'], ans:0, exp:'Retrograde = forgetting the past.'}, 
      {q:'In classical conditioning, a conditioned stimulus was originally a(n):', ch:['Unconditioned response','Neutral stimulus','Conditioned response','Unconditioned stimulus'], ans:1, exp:'A neutral stimulus becomes conditioned.'}, 
      {q:'The fundamental attribution error is the tendency to overestimate:', ch:['Situational factors','Cultural factors','Groupthink','Dispositional factors'], ans:3, exp:'Blaming disposition over situation.'}, 
      {q:'Which part of the eye is responsible for high-acuity color vision?', ch:['Cornea','Lens','Fovea centralis','Optic disc'], ans:2, exp:'The fovea is packed with cones.'}, 
      {q:'Sleep spindles are characteristic of which sleep stage?', ch:['Stage 1 (N1)','Stage 2 (N2)','Stage 3 (N3)','REM sleep'], ans:1, exp:'Stage 2 EEG shows these.'}, 
      {q:'Believing one\'s own culture is superior is called:', ch:['Cultural relativism','Ethnocentrism','Xenocentrism','Social Darwinism'], ans:0, exp:'Ethnocentrism.'} 
    ]
  },
  {
    id:'q004', cat:'Bio/Biochem', title:'Genetics & Molecular Biology', diff:'Hard',
    qs:[
      {q:'Which of the following serves as the universal start codon?', ch:['AUG','UAA','UAG','UGA'], ans:0, exp:'AUG codes for Methionine.'}, 
      {q:'In the Hardy-Weinberg equation, p + q equals:', ch:['0','1','2','100'], ans:1, exp:'p and q represent allele frequencies (sum to 1).'}, 
      {q:'RNA Polymerase II synthesizes:', ch:['tRNA','rRNA','mRNA','snRNA'], ans:2, exp:'RNA Pol II synthesizes messenger RNA.'}, 
      {q:'A mutation causing a premature stop codon is a:', ch:['Missense mutation','Silent mutation','Frameshift mutation','Nonsense mutation'], ans:3, exp:'Nonsense mutations prematurely terminate.'}, 
      {q:'DNA replication occurs during:', ch:['S phase','G1 phase','G2 phase','M phase'], ans:0, exp:'Synthesis (S) phase.'}, 
      {q:'A Southern blot detects specific:', ch:['Proteins','DNA sequences','RNA sequences','Lipids'], ans:1, exp:'SNoW DRoP: Southern = DNA.'}, 
      {q:'Correct sequence of a PCR cycle?', ch:['Anneal, Extend, Denature','Extend, Denature, Anneal','Denature, Anneal, Extend','Denature, Extend, Anneal'], ans:2, exp:'Denature, Anneal, Extend.'}, 
      {q:'The fully assembled eukaryotic ribosome is:', ch:['50S','60S','70S','80S'], ans:3, exp:'Eukaryotes have 80S ribosomes.'}, 
      {q:'The inducer for the lac operon is:', ch:['Allolactose','cAMP','Glucose','Tryptophan'], ans:0, exp:'Allolactose binds the repressor.'}, 
      {q:'An X-linked recessive trait is most often expressed in:', ch:['Females only','Males more frequently than females','Females more frequently than males','Both sexes equally'], ans:1, exp:'Males only have one X chromosome.'}, 
      {q:'Telomerase functions as a:', ch:['DNA-dependent RNA polymerase','RNA endonuclease','Reverse transcriptase','Topoisomerase'], ans:2, exp:'Builds DNA from an RNA template.'}, 
      {q:'The spliceosome removes:', ch:['Exons','Promoters','Poly-A tails','Introns'], ans:3, exp:'Excises non-coding introns.'}, 
      {q:'A point mutation that does not alter the amino acid is a:', ch:['Silent mutation','Missense mutation','Nonsense mutation','Insertion'], ans:0, exp:'Silent mutation due to wobble.'}, 
      {q:'Crossing over occurs during:', ch:['Metaphase I','Prophase I','Anaphase II','Prophase II'], ans:1, exp:'Recombination occurs in Prophase I.'}, 
      {q:'Information flows from:', ch:['RNA → DNA → Protein','Protein → RNA → DNA','DNA → Protein → RNA','DNA → RNA → Protein'], ans:3, exp:'Central dogma.'} 
    ]
  },
  {
    id:'q005', cat:'Chem/Phys', title:'Organic Chemistry Mechanisms', diff:'Hard',
    qs:[
      {q:'An SN2 reaction on a chiral center results in:', ch:['Retention of configuration','Inversion of configuration','A racemic mixture','No reaction'], ans:1, exp:'SN2 causes complete inversion.'}, 
      {q:'The rate of an SN1 reaction depends strictly on the:', ch:['Nucleophile only','Solvent','Leaving group','Electrophile only'], ans:3, exp:'SN1 rate = k[Electrophile].'}, 
      {q:'For E2 elimination, the leaving group and proton must be:', ch:['Anti-periplanar','Syn-periplanar','Gauche','Eclipsed'], ans:0, exp:'Requires anti-periplanar geometry (180 degrees).'}, 
      {q:'A sharp peak at ~1700 cm⁻¹ on IR indicates a:', ch:['Hydroxyl group','Amine group','Carbonyl group','Alkyne bond'], ans:2, exp:'Carbonyls absorb strongly at 1700 cm-1.'}, 
      {q:'Enantiomers are stereoisomers that:', ch:['Have opposite R/S at every center','Differ at one center','Are superimposable','Have different connectivity'], ans:0, exp:'Non-superimposable mirror images.'}, 
      {q:'A meso compound possesses chiral centers and:', ch:['A net dipole','An internal plane of symmetry','Optical activity','A trans double bond'], ans:1, exp:'Internal symmetry makes it achiral.'}, 
      {q:'Oxidation of a primary alcohol with PCC yields an:', ch:['Ketone','Carboxylic Acid','Ester','Aldehyde'], ans:3, exp:'PCC is a mild oxidant stopping at the aldehyde.'}, 
      {q:'Ozonolysis of an alkene forms:', ch:['Alcohols','Epoxides','Carbonyl compounds','Alkanes'], ans:2, exp:'Cleaves double bonds to form carbonyls.'}, 
      {q:'A Grignard reagent (R-MgBr) functions as a strong:', ch:['Nucleophile and base','Electrophile and acid','Leaving group','Oxidizing agent'], ans:0, exp:'Highly nucleophilic and basic.'}, 
      {q:'The Diels-Alder reaction is a:', ch:['[2+2] cycloaddition','[4+2] cycloaddition','Free radical halogenation','Nucleophilic acyl substitution'], ans:1, exp:'Diene (4 pi) + Dienophile (2 pi).'}, 
      {q:'In H-NMR, a signal further downfield means the proton is:', ch:['Highly shielded','Attached to a metal','Deshielded by an electronegative group','In a nonpolar solvent'], ans:2, exp:'Electronegative atoms pull electron density.'}, 
      {q:'Reacting a carboxylic acid with SOCl₂ produces an:', ch:['Anhydride','Amide','Ester','Acyl chloride'], ans:3, exp:'Forms an acyl chloride.'}, 
      {q:'Markovnikov addition places the hydrogen on the carbon with:', ch:['More hydrogen atoms','More alkyl substituents','Highest electronegativity','A double bond'], ans:0, exp:'Creates the more stable carbocation.'}, 
      {q:'An epimer differs in configuration at:', ch:['All chiral centers','Exactly one chiral center','No chiral centers','The anomeric carbon only'], ans:1, exp:'Differs at a single stereocenter.'}, 
      {q:'A tosylate group is an excellent:', ch:['Nucleophile','Electrophile','Protecting group','Leaving group'], ans:3, exp:'Resonance-stabilized weak bases make great leaving groups.'} 
    ]
  },
  {
    id:'q006', cat:'Psych/Soc', title:'Neuroanatomy & Sensation', diff:'Medium',
    qs:[
      {q:'Which lobe handles executive function and planning?', ch:['Frontal lobe','Parietal lobe','Occipital lobe','Temporal lobe'], ans:0, exp:'The frontal lobe handles planning and logic.'}, 
      {q:'Fluent speech that makes no sense ("word salad") indicates damage to:', ch:['Broca\'s area','The visual cortex','Wernicke\'s area','The basal ganglia'], ans:2, exp:'Wernicke\'s aphasia.'}, 
      {q:'Compared to cones, rods are more sensitive to:', ch:['Color variations','Low-intensity light','Fine details','High-frequency sounds'], ans:1, exp:'Rods operate well in dim light.'}, 
      {q:'The Gestalt Law of Proximity groups objects that are:', ch:['Moving together','Similar in color','Connected','Physically close'], ans:3, exp:'Proximity means close elements group together.'}, 
      {q:'The primary "rest and digest" neurotransmitter is:', ch:['Acetylcholine','Epinephrine','Dopamine','Glutamate'], ans:0, exp:'ACh regulates parasympathetic output.'}, 
      {q:'The hippocampus is critical for:', ch:['Motor coordination','Memory consolidation','Heart rate','Visual processing'], ans:1, exp:'Converts short-term to long-term memory.'}, 
      {q:'Recognizing an ambiguous shape based on context is:', ch:['Bottom-up processing','Parallel processing','Top-down processing','Transduction'], ans:2, exp:'Top-down processing uses expectations.'}, 
      {q:'The concept that the JND is a constant ratio is:', ch:['Signal Detection Theory','Feature Detection','Place Theory','Weber\'s Law'], ans:3, exp:'Weber\'s Law.'}, 
      {q:'In "split-brain" patients, what is severed?', ch:['Corpus callosum','Optic chiasm','Medulla oblongata','Cerebral peduncles'], ans:0, exp:'Connects the two hemispheres.'}, 
      {q:'A sympathetic nervous system response includes:', ch:['Constriction of pupils','Dilation of pupils','Decreased heart rate','Increased salivation'], ans:1, exp:'Dilation lets more light in to see threats.'}, 
      {q:'The primary somatosensory cortex is in the:', ch:['Frontal lobe','Temporal lobe','Parietal lobe','Occipital lobe'], ans:2, exp:'Located on the postcentral gyrus.'}, 
      {q:'The kinesthetic sense perceives:', ch:['Gravity','Temperature','Organ pain','Body position in space'], ans:3, exp:'Proprioception tracks limb position.'}, 
      {q:'Hair cells in the organ of Corti act as:', ch:['Mechanoreceptors','Chemoreceptors','Photoreceptors','Nociceptors'], ans:0, exp:'Sound waves physically bend them.'}, 
      {q:'Broca\'s area is typically localized to the:', ch:['Right temporal lobe','Left frontal lobe','Right parietal lobe','Left occipital lobe'], ans:1, exp:'Language is usually left-lateralized.'}, 
      {q:'Signal Detection Theory relies on signal strength and:', ch:['Age','Absolute threshold','Visual acuity','Psychological state'], ans:3, exp:'Detection relies on cognitive factors like motivation.'} 
    ]
  },
  {
    id:'q007', cat:'Bio/Biochem', title:'Immunology & Cell Biology', diff:'Hard',
    // Matrix Variation: 3 As (0), 5 Bs (1), 3 Cs (2), 4 Ds (3)
    qs:[
      {q:'Which cell type is primarily responsible for producing antibodies?', ch:['T-killer cells','B-lymphocytes','Macrophages','Neutrophils'], ans:1, exp:'B-cells differentiate into plasma cells that secrete antibodies.'}, 
      {q:'Major Histocompatibility Complex (MHC) Class I is found on:', ch:['Only antigen-presenting cells','All nucleated cells','Erythrocytes only','Only T-cells'], ans:1, exp:'MHC I is on all nucleated cells to present endogenous antigens.'}, 
      {q:'Which organelle is the primary site of post-translational modification?', ch:['Nucleus','Lysosome','Golgi apparatus','Smooth ER'], ans:2, exp:'The Golgi modifies, sorts, and packages proteins.'}, 
      {q:'Which of the following is a component of the innate immune system?', ch:['Cytotoxic T cells','Helper T cells','Memory B cells','Natural Killer (NK) cells'], ans:3, exp:'NK cells are innate responders to viral infection and tumors.'}, 
      {q:'The movement of water across a semipermeable membrane is called:', ch:['Active transport','Osmosis','Facilitated diffusion','Pinocytosis'], ans:1, exp:'Osmosis is the passive diffusion of water.'}, 
      {q:'A virus that integrates its genome into the host DNA is in the:', ch:['Lytic cycle','Lysogenic cycle','Prion phase','Capsid stage'], ans:1, exp:'Lysogenic viruses remain dormant by integrating their DNA (provirus).'}, 
      {q:'Apoptosis can be initiated by the release of which molecule from mitochondria?', ch:['ATP','NADH','Cytochrome c','Acetyl-CoA'], ans:2, exp:'Cytochrome c release triggers the caspase cascade.'}, 
      {q:'CD4+ T-cells primarily interact with which molecule?', ch:['MHC Class I','Antibodies','Toll-like receptors','MHC Class II'], ans:3, exp:'CD4+ binds MHC II. CD8+ binds MHC I.'}, 
      {q:'Which of the following breaks down toxic hydrogen peroxide in the cell?', ch:['Peroxisome','Lysosome','Smooth ER','Mitochondria'], ans:0, exp:'Peroxisomes contain catalase to degrade H2O2.'}, 
      {q:'What is the primary function of macrophages?', ch:['Antibody production','Phagocytosis of pathogens','Histamine release','Oxygen transport'], ans:1, exp:'Macrophages engulf and digest cellular debris and pathogens.'}, 
      {q:'The fluid mosaic model describes the plasma membrane as:', ch:['A rigid protein structure','A static lipid bilayer','A dynamic mix of lipids and mobile proteins','A carbohydrate matrix'], ans:2, exp:'Proteins float fluidly within the phospholipid bilayer.'}, 
      {q:'Vaccines primarily provide protection by generating:', ch:['Neutrophils','Mast cells','Complement proteins','Memory B and T cells'], ans:3, exp:'Memory cells mount a rapid response upon secondary exposure.'}, 
      {q:'Which junction prevents fluid from leaking between epithelial cells?', ch:['Tight junctions','Gap junctions','Desmosomes','Plasmodesmata'], ans:0, exp:'Tight junctions seal the intercellular space.'}, 
      {q:'Passive immunity involves the transfer of:', ch:['Antigens','Antibodies','Bone marrow','T-cells'], ans:1, exp:'Passive immunity (like maternal milk) transfers pre-made antibodies.'}, 
      {q:'Opsonization is the process of:', ch:['Cell division','Lysosome fusion','Viral entry','Coating a pathogen to enhance phagocytosis'], ans:3, exp:'Antibodies and complement proteins opsonize pathogens.'} 
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
