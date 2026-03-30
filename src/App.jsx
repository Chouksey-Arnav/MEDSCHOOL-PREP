import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import katex from 'katex';

/* ═══════════════════════════════════════════════════════════════════
   KATEX UTILITIES
═══════════════════════════════════════════════════════════════════ */
const renderMath = (latex) => {
  try { return katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { return latex; }
};
const MixedText = memo(({ t }) => {
  if (!t) return null;
  return (
    <>{String(t).split(/(\$[^$]+\$)/g).map((p, i) =>
      (p[0] === '$' && p[p.length - 1] === '$')
        ? <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(p.slice(1, -1)) }} />
        : <span key={i}>{p}</span>
    )}</>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   LOCAL STORAGE HELPERS
═══════════════════════════════════════════════════════════════════ */
const ls = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};

/* ═══════════════════════════════════════════════════════════════════
   DIAGNOSTIC QUESTIONS
═══════════════════════════════════════════════════════════════════ */
const DIAGNOSTIC_QS = [
  { q: 'Which clinical scenario excites you most?', opts: ['Performing a complex surgical procedure', 'Solving a diagnostic mystery over weeks', 'Comforting a child and their family through illness', 'Exploring the human mind and behavior', 'Running a groundbreaking clinical trial'], w: { surgery: [5,1,1,1,1], internal: [1,5,1,1,2], pediatrics: [1,1,5,1,1], psychiatry: [1,1,2,5,1], research: [1,2,1,1,5] } },
  { q: 'Your ideal work environment is:', opts: ['Fast-paced OR with clear, immediate outcomes', 'Hospital ward with long-term patient relationships', 'Outpatient clinic focused on families', 'Private therapy or inpatient psychiatry unit', 'Lab, conference room, or academic setting'], w: { surgery: [5,1,1,1,1], internal: [1,5,1,1,2], pediatrics: [1,1,5,1,1], psychiatry: [1,1,1,5,1], research: [1,1,1,1,5] } },
  { q: 'Which subject energizes you most?', opts: ['Anatomy and biomechanics', 'Physiology and pharmacology', 'Pediatric development & growth', 'Psychology and social behavior', 'Biochemistry and molecular biology'], w: { surgery: [5,2,1,1,2], internal: [2,5,1,1,2], pediatrics: [1,2,5,1,1], psychiatry: [1,1,1,5,2], research: [2,2,1,2,5] } },
  { q: 'Your personality under pressure:', opts: ['Decisive, action-oriented, hands-on', 'Methodical, analytical, systematic', 'Empathetic, nurturing, patient-centered', 'Reflective, insightful, deep listener', 'Data-driven, evidence-based, rigorous'], w: { surgery: [5,2,1,1,1], internal: [2,5,1,1,2], pediatrics: [1,1,5,2,1], psychiatry: [1,2,2,5,1], research: [1,2,1,1,5] } },
  { q: 'Your strongest MCAT section:', opts: ['Chem/Phys – I love problem-solving', 'Bio/Biochem – I live in the lab', 'CARS – I am a strong reader', 'Psych/Soc – humans fascinate me', 'All equal – I am a complete student'], w: { surgery: [4,3,1,1,2], internal: [2,5,2,2,2], pediatrics: [2,3,3,3,2], psychiatry: [1,2,3,5,2], research: [3,5,2,2,2] } },
  { q: 'How do you prefer patient interaction?', opts: ['Brief, high-stakes procedural interactions', 'Long-term relationship management', 'Family-centered, pediatric-focused care', 'Deep psychological, therapeutic exploration', 'Minimal direct contact – I prefer research'], w: { surgery: [5,1,1,1,1], internal: [1,5,1,1,1], pediatrics: [1,2,5,1,1], psychiatry: [1,1,1,5,1], research: [1,1,1,1,5] } },
  { q: 'Which best describes you?', opts: ['I love working with my hands', 'I love piecing together complex clinical puzzles', 'I love watching patients grow and heal over time', 'I love exploring what makes people think and feel', 'I love discovering knowledge that did not exist before'], w: { surgery: [5,2,1,1,1], internal: [1,5,1,1,2], pediatrics: [1,1,5,1,1], psychiatry: [1,1,2,5,1], research: [1,1,1,1,5] } },
  { q: 'Your dream research project:', opts: ['Surgical technique or device innovation', 'Disease pathophysiology and new drug targets', 'Pediatric vaccine or child health intervention', 'Mental health treatment & psychotherapy outcomes', 'Genomics, proteomics, or molecular medicine'], w: { surgery: [5,2,1,1,1], internal: [1,5,1,1,2], pediatrics: [1,1,5,1,1], psychiatry: [1,1,1,5,1], research: [1,2,1,2,5] } },
  { q: 'Work-life integration for you means:', opts: ['Intense bursts with clear, tangible payoffs', 'Intellectually demanding but predictable hours', 'Family-friendly hours that matter deeply to me', 'Flexible scheduling for patient-therapy sessions', 'Academic schedule with protected research time'], w: { surgery: [5,2,1,1,1], internal: [1,5,1,1,1], pediatrics: [1,1,5,1,1], psychiatry: [1,1,2,5,1], research: [1,1,1,1,5] } },
  { q: 'Which physician inspires you most?', opts: ['Atul Gawande (Surgery & Patient Safety)', 'Paul Kalanithi (Neurology & Literature)', 'Benjamin Spock (Pediatrics & Family Care)', 'Victor Frankl (Psychiatry & Meaning)', 'Francis Collins (Genomics & Leadership)'], w: { surgery: [5,2,1,1,1], internal: [2,5,1,1,2], pediatrics: [1,1,5,1,1], psychiatry: [1,1,1,5,1], research: [1,2,1,1,5] } },
];

/* ═══════════════════════════════════════════════════════════════════
   SPECIALTY PATHS (Khan Academy structure)
═══════════════════════════════════════════════════════════════════ */
const PATHS = {
  surgery: {
    label: 'General Surgery', icon: '🔬', accent: '#ef4444', border: 'border-red-500/40',
    tagline: 'Master anatomy, physiology & surgical science',
    units: [
      { id: 'su1', title: 'Biochemistry Foundations', desc: 'Amino acids, enzymes, metabolism', cat: 'Bio/Biochem', req: 3, xp: 150,
        lessons: [{ title: 'Amino Acid Structure & Properties', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', dur: '18 min', note: 'Know pKa: Asp/Glu (acidic), Lys/Arg/His (basic)' }, { title: 'Enzyme Kinetics & Inhibition', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', dur: '22 min', note: 'Lineweaver-Burk plot: competitive raises Km, non-competitive lowers Vmax' }, { title: 'Glycolysis & the TCA Cycle', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', dur: '25 min', note: 'Net: 2 ATP from glycolysis; 32 ATP from oxidative phosphorylation' }] },
      { id: 'su2', title: 'Cardiovascular & Respiratory', desc: 'Heart, lungs, hemodynamics', cat: 'Chem/Phys', req: 3, xp: 175,
        lessons: [{ title: 'Cardiac Cycle & Hemodynamics', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'Starling curve: increased preload → increased stroke volume' }, { title: 'Respiratory Mechanics & Gas Exchange', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'V/Q mismatch: dead space (no perfusion) vs shunt (no ventilation)' }, { title: 'Acid-Base Disorders', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '15 min', note: 'Use Henderson-Hasselbalch & the ROME mnemonic' }] },
      { id: 'su3', title: 'Musculoskeletal System', desc: 'Bones, muscles, connective tissue', cat: 'Bio/Biochem', req: 3, xp: 175,
        lessons: [{ title: 'Sliding Filament & Muscle Contraction', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'Ca²⁺ releases troponin inhibition → myosin binds actin' }, { title: 'Bone Remodeling & Mineral Homeostasis', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '17 min', note: 'PTH ↑ Ca²⁺ serum; calcitonin ↓ Ca²⁺ serum' }, { title: 'Collagen & Connective Tissue Disorders', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '15 min', note: 'Type I=bone/tendon, Type II=cartilage, Type IV=basement membrane' }] },
      { id: 'su4', title: 'Molecular Biology & Genetics', desc: 'DNA, RNA, gene regulation', cat: 'Bio/Biochem', req: 3, xp: 200,
        lessons: [{ title: 'DNA Replication & Repair', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'Leading strand continuous, lagging strand uses Okazaki fragments' }, { title: 'Transcription, Translation & Post-translational Modification', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'RNA Pol II transcribes mRNA; Signal sequences target proteins to ER' }, { title: 'Mendelian Genetics & Pedigree Analysis', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'Hardy-Weinberg: p² + 2pq + q² = 1; use for allele frequency problems' }] },
      { id: 'su5', title: 'Physics & Fluid Dynamics', desc: 'Mechanics, fluids, thermodynamics', cat: 'Chem/Phys', req: 3, xp: 200,
        lessons: [{ title: "Poiseuille's Law & Fluid Mechanics", url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Q ∝ r⁴ — radius is the most critical variable in flow rate' }, { title: 'Circuits & Electricity', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'Resistors in series add; in parallel: 1/R_total = Σ1/Rn' }, { title: 'Thermodynamics & Free Energy', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'ΔG = ΔH - TΔS; spontaneous when ΔG < 0' }] },
    ]
  },
  internal: {
    label: 'Internal Medicine', icon: '🩺', accent: '#3b82f6', border: 'border-blue-500/40',
    tagline: 'Master diagnostic reasoning & pharmacology',
    units: [
      { id: 'im1', title: 'Pathophysiology Foundations', desc: 'Disease at the cellular level', cat: 'Bio/Biochem', req: 3, xp: 150,
        lessons: [{ title: 'Inflammation & Immune Response', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'COX-2 → prostaglandins → fever; NSAIDs block this pathway' }, { title: 'Necrosis vs Apoptosis', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Apoptosis is programmed (caspase-mediated); necrosis is pathological' }, { title: 'Neoplasia & Cancer Biology', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'Proto-oncogenes (gas pedal) vs tumor suppressors (brakes)' }] },
      { id: 'im2', title: 'Pharmacology Principles', desc: 'Pharmacokinetics & pharmacodynamics', cat: 'Bio/Biochem', req: 3, xp: 175,
        lessons: [{ title: 'Drug Absorption & Bioavailability', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'First-pass metabolism reduces oral bioavailability; IV = 100%' }, { title: 'Receptor Pharmacology', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'ED50: dose for 50% effect; therapeutic index = LD50/ED50' }, { title: 'Drug Metabolism & CYP450', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '15 min', note: 'CYP3A4 metabolizes ~50% of drugs; inducers ↑ clearance' }] },
      { id: 'im3', title: 'Endocrinology', desc: 'Hormones and metabolic axes', cat: 'Bio/Biochem', req: 3, xp: 175,
        lessons: [{ title: 'Hypothalamic-Pituitary Axis', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'Negative feedback: high cortisol → suppresses CRH and ACTH' }, { title: 'Thyroid & Adrenal Physiology', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'T3 is active form; T4 is a prohormone converted peripherally' }, { title: 'Diabetes Mellitus & Insulin Signaling', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Type 1: autoimmune β-cell destruction; Type 2: insulin resistance' }] },
      { id: 'im4', title: 'Electrochemistry & Solutions', desc: 'Galvanic cells, acid-base, colligative', cat: 'Chem/Phys', req: 3, xp: 175,
        lessons: [{ title: 'Galvanic Cells & Nernst Equation', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'E = E° - (RT/nF)lnQ; cathode = reduction, anode = oxidation' }, { title: 'Acid-Base Equilibria & Buffers', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Best buffer: pKa ± 1 of target pH; bicarbonate buffer in blood' }, { title: 'Osmolarity & Colligative Properties', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '15 min', note: 'Osmotic pressure π = iMRT; tonicity determines cell behavior' }] },
      { id: 'im5', title: 'Behavioral Science & Sociology', desc: 'Biopsychosocial model', cat: 'Psych/Soc', req: 3, xp: 200,
        lessons: [{ title: 'Learning, Memory & Conditioning', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Operant: reinforcement/punishment; Classical: CS + US → CR' }, { title: 'Social Cognition & Attribution', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'FAE: over-attribute behavior to disposition vs situation' }, { title: 'Health Disparities & Social Determinants', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '15 min', note: 'SES, race, geography all influence morbidity/mortality outcomes' }] },
    ]
  },
  pediatrics: {
    label: 'Pediatrics', icon: '👶', accent: '#10b981', border: 'border-emerald-500/40',
    tagline: 'Specialize in child development & family medicine',
    units: [
      { id: 'pe1', title: 'Developmental Biology', desc: 'Embryology & developmental milestones', cat: 'Bio/Biochem', req: 3, xp: 150,
        lessons: [{ title: 'Embryonic Development & Organogenesis', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'Teratogens: thalidomide=limb defects, alcohol=FAS, rubella=CHD' }, { title: 'Developmental Milestones by Age', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Gross motor → fine motor → language → social (in order of mastery)' }, { title: 'Chromosomal & Genetic Disorders', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: "Down (Trisomy 21), Turner (45,X), Klinefelter (47,XXY)" }] },
      { id: 'pe2', title: 'Immunology & Infectious Disease', desc: 'Immunity, vaccines, pediatric infections', cat: 'Bio/Biochem', req: 3, xp: 175,
        lessons: [{ title: 'Innate vs Adaptive Immunity', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'MHC I presents to CD8+ T cells; MHC II presents to CD4+ T cells' }, { title: 'Vaccine Immunology', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Live-attenuated (MMR) vs inactivated (flu) vs mRNA (COVID) vaccines' }, { title: 'Pediatric Infections Overview', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '15 min', note: 'RSV, Kawasaki, meningitis—recognize classic presentations' }] },
      { id: 'pe3', title: 'Child Psychology', desc: 'Cognitive and emotional development', cat: 'Psych/Soc', req: 3, xp: 175,
        lessons: [{ title: "Piaget's Stages of Cognitive Development", url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'Sensorimotor→Preoperational→Concrete→Formal Operational' }, { title: 'Attachment Theory', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Secure, avoidant, anxious-ambivalent, disorganized' }, { title: "Erikson's Psychosocial Stages", url: 'https://www.khanacademy.org/test-prep/mcat', dur: '15 min', note: 'Stage 1: Trust vs Mistrust (birth–18mo); conflicts proceed through life' }] },
      { id: 'pe4', title: 'Nutrition & Metabolism', desc: 'Vitamins, lipids, nitrogen metabolism', cat: 'Bio/Biochem', req: 3, xp: 175,
        lessons: [{ title: 'Vitamins & Cofactors', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'Fat-soluble: ADEK; Water-soluble: B vitamins, C. Deficiency diseases!' }, { title: 'Lipid Metabolism & Lipoproteins', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Chylomicrons transport dietary fat; LDL delivers to cells; HDL returns to liver' }, { title: 'Urea Cycle & Nitrogen Metabolism', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '15 min', note: 'Liver detoxifies NH₃ → urea. OTC deficiency → hyperammonemia' }] },
      { id: 'pe5', title: 'Research Methods & Statistics', desc: 'Study design and statistical analysis', cat: 'Psych/Soc', req: 3, xp: 200,
        lessons: [{ title: 'Epidemiology & Study Design', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Gold standard: RCT. Cohort=prospective; Case-control=retrospective' }, { title: 'Biostatistics for the MCAT', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'Sensitivity=SnNout; Specificity=SpPin. PPV depends on prevalence!' }, { title: 'Ethical Principles in Research', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '15 min', note: 'Belmont Report: Respect, Beneficence, Justice. IRB oversees all research.' }] },
    ]
  },
  psychiatry: {
    label: 'Psychiatry', icon: '🧠', accent: '#8b5cf6', border: 'border-violet-500/40',
    tagline: 'Master psychology, neuroscience & behavioral medicine',
    units: [
      { id: 'ps1', title: 'Neuroscience Foundations', desc: 'Neurons, synapses, brain regions', cat: 'Bio/Biochem', req: 3, xp: 150,
        lessons: [{ title: 'Neuron Structure & Action Potential', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'Resting: -70mV. Depolarization via Na⁺ in; Repolarization via K⁺ out' }, { title: 'Synaptic Transmission & Neurotransmitters', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'Dopamine: reward; Serotonin: mood; GABA: inhibitory; Glutamate: excitatory' }, { title: 'Brain Regions & Their Functions', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Limbic system: emotion/memory; PFC: executive function; BG: movement' }] },
      { id: 'ps2', title: 'Psychology & Behavior', desc: 'Learning, cognition, psychopathology', cat: 'Psych/Soc', req: 3, xp: 175,
        lessons: [{ title: 'Sensation, Perception & Consciousness', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'Weber\'s Law: ΔI/I = k (JND is constant fraction of stimulus)' }, { title: 'Motivation, Emotion & Stress', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: "Maslow's hierarchy; James-Lange theory: body reaction PRECEDES emotion" }, { title: 'Psychological Disorders & DSM-5', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'Axis: schizophrenia (positive/negative sx), mood disorders, anxiety clusters' }] },
      { id: 'ps3', title: 'Social Science & Sociology', desc: 'Society, culture, inequality', cat: 'Psych/Soc', req: 3, xp: 175,
        lessons: [{ title: 'Social Stratification & Health Inequity', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'SES gradient: poverty → worse health outcomes across all conditions' }, { title: 'Culture, Identity & Health Behavior', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '16 min', note: 'Cultural competency: recognize, respect, respond to cultural differences' }, { title: 'Social Networks & Group Dynamics', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '15 min', note: 'Bystander effect, conformity (Asch), obedience (Milgram), groupthink' }] },
      { id: 'ps4', title: 'Neuropharmacology', desc: 'Drugs, receptors, clinical psychiatry', cat: 'Bio/Biochem', req: 3, xp: 175,
        lessons: [{ title: 'Antidepressants & Antipsychotics', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'SSRIs inhibit serotonin reuptake; Atypical antipsychotics: D2 + 5-HT2 block' }, { title: 'Anxiolytics & Mood Stabilizers', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Benzodiazepines potentiate GABA; Lithium: gold standard for bipolar' }, { title: 'Neuroplasticity & Memory', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'LTP: NMDA receptors → long-term potentiation. BDNF promotes neurogenesis' }] },
      { id: 'ps5', title: 'Behavioral Research Methods', desc: 'Research design for psych studies', cat: 'Psych/Soc', req: 3, xp: 200,
        lessons: [{ title: 'Psychological Research Methodology', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Experimental vs correlational vs naturalistic. Confounds destroy internal validity.' }, { title: 'Statistics for Psych/Soc', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'Normal distribution: mean=median=mode. Skewed: mean pulled toward tail' }, { title: 'Ethics in Behavioral Research', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '15 min', note: 'Tuskegee, Milgram, Zimbardo — landmark studies that shaped research ethics' }] },
    ]
  },
  research: {
    label: 'Research & Academia', icon: '🔭', accent: '#f59e0b', border: 'border-amber-500/40',
    tagline: 'Excel in biomedical research & academic medicine',
    units: [
      { id: 're1', title: 'Molecular Biology', desc: 'Gene expression, proteins, CRISPR', cat: 'Bio/Biochem', req: 3, xp: 150,
        lessons: [{ title: 'Gene Expression & Epigenetic Regulation', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'Methylation silences; acetylation activates. Epigenetics = heritable non-DNA changes' }, { title: 'Protein Folding, Chaperones & Proteomics', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Prion diseases: misfolded proteins; Hsp70 chaperones prevent aggregation' }, { title: 'CRISPR-Cas9 & Gene Editing', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'Guide RNA directs Cas9; DSB repaired by HDR (precise) or NHEJ (error-prone)' }] },
      { id: 're2', title: 'Epidemiology & Biostatistics', desc: 'Study design, bias, statistics', cat: 'Psych/Soc', req: 3, xp: 175,
        lessons: [{ title: 'Epidemiology: Incidence, Prevalence, Risk', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'Relative Risk from cohort; Odds Ratio from case-control. ARR = risk_control - risk_treatment' }, { title: 'Statistical Power, Error, and Significance', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Type I error = false positive (α); Type II = false negative (β). Power = 1-β' }, { title: 'Systematic Reviews & Meta-Analysis', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '15 min', note: 'Forest plots: diamond crossing 1.0 = not significant; funnel plot detects publication bias' }] },
      { id: 're3', title: 'Physical Chemistry & Spectroscopy', desc: 'Lab techniques and physical chemistry', cat: 'Chem/Phys', req: 3, xp: 175,
        lessons: [{ title: 'Spectroscopy (NMR, IR, Mass Spec)', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'IR: 1700 cm⁻¹ = carbonyl; NMR: n+1 rule for splitting; MS: M⁺ = molecular weight' }, { title: 'Chromatography & Electrophoresis', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'SDS-PAGE separates by size; native PAGE by charge+size; isoelectric focusing by pI' }, { title: 'Thermodynamics & Reaction Kinetics', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'Arrhenius: k = Ae^(-Ea/RT); catalyst lowers Ea, does NOT change ΔG' }] },
      { id: 're4', title: 'Immunology & Virology', desc: 'Host-pathogen interactions in depth', cat: 'Bio/Biochem', req: 3, xp: 175,
        lessons: [{ title: 'Adaptive Immunity: V(D)J Recombination', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'Clonal selection: one B cell → one antibody specificity. Affinity maturation in GCs' }, { title: 'Microbial Pathogenesis & Virulence', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'Exotoxins are secreted; endotoxins (LPS) are membrane-bound. Antitoxins = antitoxin antibodies' }, { title: 'Viral Replication & Antiviral Targets', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'Retroviruses: RNA→DNA via reverse transcriptase. Lytic vs lysogenic cycle' }] },
      { id: 're5', title: 'Organic Chemistry', desc: 'Reactions, mechanisms, stereochemistry', cat: 'Chem/Phys', req: 3, xp: 200,
        lessons: [{ title: 'Nucleophilic Substitution (SN1 & SN2)', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '22 min', note: 'SN2: backside attack → inversion; SN1: carbocation → racemization' }, { title: 'Carbonyl Chemistry & Reactions', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '20 min', note: 'Nucleophilic addition to C=O; aldehydes > ketones in reactivity' }, { title: 'Stereochemistry & Chirality', url: 'https://www.khanacademy.org/test-prep/mcat', dur: '18 min', note: 'R/S via Cahn-Ingold-Prelog priority rules; optical activity measures chirality' }] },
    ]
  },
};

/* ═══════════════════════════════════════════════════════════════════
   QUESTION BANK
═══════════════════════════════════════════════════════════════════ */
const Q_TEMPLATES = [
  { cat: 'Chem/Phys', text: 'A fluid with viscosity η flows through a tube of radius $r$. The pressure gradient is tripled and the radius is halved. The new flow rate is:', choices: ['$\\frac{3}{16}$ of the original', '$\\frac{3}{8}$ of the original', '$\\frac{3}{4}$ of the original', '$6$ times the original'], ans: 0, exp: "Poiseuille's law: $Q = \\frac{\\pi r^4 \\Delta P}{8 \\eta L}$. New $Q = Q_0 \\cdot 3 \\cdot (\\frac{1}{2})^4 = \\frac{3}{16} Q_0$." },
  { cat: 'Bio/Biochem', text: 'A competitive inhibitor is added to an enzyme-substrate reaction. What happens to $K_m$ and $V_{max}$?', choices: ['$K_m$ increases; $V_{max}$ unchanged', '$V_{max}$ decreases; $K_m$ unchanged', 'Both $K_m$ and $V_{max}$ increase', 'Neither parameter changes'], ans: 0, exp: 'Competitive inhibitors compete with substrate for the active site. Excess substrate can overcome inhibition, so $V_{max}$ is preserved but apparent $K_m$ rises.' },
  { cat: 'Bio/Biochem', text: 'Which molecule is the direct energy currency consumed during myosin's power stroke?', choices: ['ATP', 'NADH', 'Creatine phosphate', 'GTP'], ans: 0, exp: 'Myosin ATPase hydrolyzes ATP directly to produce the conformational change of the power stroke. Creatine phosphate regenerates ATP but is not directly used.' },
  { cat: 'Chem/Phys', text: 'Light travels from water ($n=1.33$) into denser glass ($n=1.50$) at an incident angle of 45°. The refracted angle is:', choices: ['Less than 45° (bends toward normal)', 'Greater than 45° (bends away from normal)', 'Exactly 45° (no refraction)', 'Greater than critical angle — total internal reflection'], ans: 0, exp: "Snell's law: $n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$. Since $n_2 > n_1$, $\\sin\\theta_2 < \\sin\\theta_1$, so the ray bends toward the normal." },
  { cat: 'Psych/Soc', text: 'Bystanders at an emergency scene see others not responding and therefore also refrain from helping. This phenomenon is best explained by:', choices: ['Diffusion of responsibility', 'Fundamental attribution error', 'In-group bias', 'Cognitive dissonance'], ans: 0, exp: 'The bystander effect: each individual feels less personally responsible when others are present, reducing likelihood of intervention (Darley & Latané, 1968).' },
  { cat: 'Bio/Biochem', text: 'In the presence of glucose and absence of lactose, the E. coli lac operon is:', choices: ['Repressed — lac repressor bound to operator', 'Active — CAP-cAMP complex activates transcription', 'Partially active due to allolactose', 'Fully transcribed due to high cAMP'], ans: 0, exp: 'Without lactose, allolactose is absent, so the lac repressor remains bound to the operator. The operon is transcriptionally repressed regardless of glucose status.' },
  { cat: 'Chem/Phys', text: 'A galvanic cell\'s cathode ion concentration is increased tenfold. According to the Nernst equation, cell potential will:', choices: ['Increase — Q decreases, E rises', 'Decrease — Q increases, E falls', 'Stay the same — concentration does not affect E', 'Drop to zero — equilibrium is reached'], ans: 0, exp: '$E = E^\\circ - \\frac{RT}{nF} \\ln Q$. Increasing the oxidized species at the cathode decreases Q, which increases $E_{cell}$.' },
  { cat: 'Psych/Soc', text: 'Researchers find that ice cream sales and drowning deaths both peak in summer. This is best described as:', choices: ['Spurious correlation due to a confound (season/heat)', 'Direct causation — ice cream causes drowning', 'Reverse causation — drowning promotes ice cream sales', 'Sampling bias in the data collection'], ans: 0, exp: 'A confounding variable (summer/heat) drives both ice cream consumption and swimming activity (→ drowning risk). Correlation ≠ causation.' },
  { cat: 'Bio/Biochem', text: 'Pyruvate is converted to acetyl-CoA by pyruvate dehydrogenase (PDH). Which cofactor is NOT required by this reaction?', choices: ['Biotin', 'TPP (thiamine pyrophosphate)', 'CoA', 'NAD⁺'], ans: 0, exp: 'Biotin is a cofactor for carboxylation reactions (e.g., pyruvate carboxylase), not PDH. PDH requires TPP, lipoate, CoA, FAD, and NAD⁺.' },
  { cat: 'Chem/Phys', text: 'A reaction has $\\Delta H = +50\\,kJ$ and $\\Delta S = +200\\,J/K$. At 400 K, the reaction is:', choices: ['Spontaneous ($\\Delta G < 0$)', 'Non-spontaneous ($\\Delta G > 0$)', 'At equilibrium ($\\Delta G = 0$)', 'Cannot be determined from this data'], ans: 0, exp: '$\\Delta G = \\Delta H - T\\Delta S = 50{,}000 - (400)(200) = 50{,}000 - 80{,}000 = -30{,}000\\,J$. Since $\\Delta G < 0$, the reaction is spontaneous.' },
];

const Q_BANK = [];
for (let i = 0; i < 800; i++) Q_BANK.push({ ...Q_TEMPLATES[i % Q_TEMPLATES.length], uid: `q${i}` });

function buildMasteryQuiz(cat) {
  const pool = Q_BANK.filter(q => q.cat === cat);
  return [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
}

/* ═══════════════════════════════════════════════════════════════════
   PORTFOLIO OPPORTUNITIES
═══════════════════════════════════════════════════════════════════ */
const OPPORTUNITIES = [
  { id: 'usabo', name: 'USABO – USA Biology Olympiad', type: 'Competition', deadline: 'January', diff: 'Elite', desc: 'National biology competition. Top performers gain recognition for research programs and medical schools.', url: 'https://www.usabo-trc.org/', tags: ['Biology', 'National', 'Competitive'] },
  { id: 'nih_sip', name: 'NIH Summer Internship Program', type: 'Research', deadline: 'February', diff: 'Competitive', desc: '8-week paid research at NIH Bethesda campus. Exceptional for applications.', url: 'https://www.training.nih.gov/programs/sip', tags: ['Research', 'Government', 'Summer', 'Paid'] },
  { id: 'simons', name: 'Simons Summer Research Program', type: 'Research', deadline: 'January', diff: 'Competitive', desc: '7-week research at Stony Brook University with $3,000 stipend.', url: 'https://www.simonsfoundation.org/', tags: ['Research', 'Stipend', 'Summer'] },
  { id: 'hosa', name: 'HOSA Future Health Professionals', type: 'Competition', deadline: 'Varies', diff: 'Open', desc: 'Compete in 60+ healthcare categories. Great for leadership development.', url: 'https://hosa.org/', tags: ['Healthcare', 'Leadership', 'Competition'] },
  { id: 'amsa', name: 'AMSA Premed Scholarship', type: 'Scholarship', deadline: 'May', diff: 'Competitive', desc: 'American Medical Student Association annual awards for premeds.', url: 'https://www.amsa.org/', tags: ['Scholarship', 'Award'] },
  { id: 'rsna', name: 'RSNA Medical Student Symposium', type: 'Conference', deadline: 'October', diff: 'Open', desc: 'Annual radiology conference with free student registration and networking.', url: 'https://www.rsna.org/', tags: ['Conference', 'Radiology', 'Networking'] },
  { id: 'shadowing', name: 'Clinical Shadowing (100+ hrs)', type: 'Clinical', deadline: 'Ongoing', diff: 'Open', desc: 'Shadow physicians in your target specialty. Required for most medical school applications.', url: '#', tags: ['Clinical', 'Required'] },
  { id: 'volunteering', name: 'Hospital / Free Clinic Volunteering', type: 'Volunteering', deadline: 'Ongoing', diff: 'Open', desc: 'Direct patient contact at local hospital, free clinic, or hospice. Shows service orientation.', url: '#', tags: ['Clinical', 'Service'] },
];

/* ═══════════════════════════════════════════════════════════════════
   E-LIBRARY RESOURCES
═══════════════════════════════════════════════════════════════════ */
const ELIB = [
  { cat: 'Bio/Biochem', title: 'Khan Academy – Biomolecules', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', type: 'Video Series', free: true, desc: 'Complete coverage of proteins, enzymes, metabolism, and cell biology.' },
  { cat: 'Bio/Biochem', title: 'Crash Course Biology', url: 'https://www.youtube.com/playlist?list=PL3EED4C1D684D3ADF', type: 'YouTube', free: true, desc: 'Fast-paced, visual biology covering all MCAT Bio content.' },
  { cat: 'Chem/Phys', title: 'Khan Academy – Physical Processes', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', type: 'Video Series', free: true, desc: 'Physics and general chemistry for the MCAT, with practice.' },
  { cat: 'Chem/Phys', title: 'Professor Dave Explains – Organic Chemistry', url: 'https://www.youtube.com/@ProfessorDaveExplains', type: 'YouTube', free: true, desc: 'Clear, detailed walkthroughs of organic chemistry mechanisms.' },
  { cat: 'Psych/Soc', title: 'Khan Academy – Psychological & Social Sci', url: 'https://www.khanacademy.org/test-prep/mcat/social-sciences', type: 'Video Series', free: true, desc: 'All MCAT Psych/Soc topics covered systematically.' },
  { cat: 'Psych/Soc', title: 'Crash Course Psychology', url: 'https://www.youtube.com/playlist?list=PL8dPuuaLjXtOPRKzVLY0jT3gy-7NFgCnz', type: 'YouTube', free: true, desc: 'Comprehensive psychology series from Hank Green.' },
  { cat: 'All', title: 'Anki MCAT Decks (Top-Rated)', url: 'https://www.ankiweb.net/', type: 'Flashcards', free: true, desc: 'Community MCAT decks for spaced-repetition review.' },
  { cat: 'All', title: 'AAMC Official Full-Length Practice Exams', url: 'https://www.aamc.org/students/applying/mcat/preparing/', type: 'Practice Exams', free: false, desc: 'The gold standard — most predictive of actual MCAT score.' },
];

/* ═══════════════════════════════════════════════════════════════════
   MMI INTERVIEW QUESTIONS
═══════════════════════════════════════════════════════════════════ */
const MMI_QS = [
  { q: 'A patient refuses a life-saving blood transfusion on religious grounds. What do you do?', type: 'Ethics' },
  { q: 'Tell me about a time you failed. What did you learn from it?', type: 'Personal' },
  { q: 'How would you address healthcare disparities in underserved communities?', type: 'Policy' },
  { q: 'A colleague appears impaired during a hospital shift. How do you handle this?', type: 'Professionalism' },
  { q: 'Why do you want to be a physician rather than a nurse practitioner or PA?', type: 'Motivation' },
  { q: 'Describe a time you advocated for someone. What was the outcome?', type: 'Leadership' },
  { q: 'How would you care for a patient who distrusts Western medicine?', type: 'Cultural Competency' },
  { q: 'What does it mean to be a good doctor in 2025?', type: 'Reflection' },
  { q: 'A 17-year-old patient asks you not to share her diagnosis with her parents. What do you do?', type: 'Ethics' },
  { q: 'Describe your greatest non-academic achievement and its impact on others.', type: 'Personal' },
];

/* ═══════════════════════════════════════════════════════════════════
   MED SCHOOL ACCEPTANCE BENCHMARKS
═══════════════════════════════════════════════════════════════════ */
const SCHOOL_DATA = [
  { name: 'Johns Hopkins', avgGPA: 3.94, avgMCAT: 523, acceptRate: 6 },
  { name: 'Harvard Medical', avgGPA: 3.93, avgMCAT: 522, acceptRate: 3 },
  { name: 'Stanford Medicine', avgGPA: 3.82, avgMCAT: 520, acceptRate: 2 },
  { name: 'Mayo Clinic School', avgGPA: 3.91, avgMCAT: 520, acceptRate: 2 },
  { name: 'Penn (Perelman)', avgGPA: 3.90, avgMCAT: 522, acceptRate: 4 },
  { name: 'Columbia (VP&S)', avgGPA: 3.86, avgMCAT: 522, acceptRate: 4 },
  { name: 'Duke School of Medicine', avgGPA: 3.84, avgMCAT: 521, acceptRate: 4 },
  { name: 'Vanderbilt Medical', avgGPA: 3.86, avgMCAT: 521, acceptRate: 5 },
  { name: 'UCSF Medicine', avgGPA: 3.82, avgMCAT: 517, acceptRate: 3 },
  { name: 'UT Southwestern', avgGPA: 3.89, avgMCAT: 519, acceptRate: 7 },
  { name: 'Michigan Medicine', avgGPA: 3.86, avgMCAT: 517, acceptRate: 7 },
  { name: 'Emory School of Medicine', avgGPA: 3.75, avgMCAT: 516, acceptRate: 8 },
  { name: 'Boston University Medicine', avgGPA: 3.71, avgMCAT: 515, acceptRate: 4 },
  { name: 'Georgetown Medicine', avgGPA: 3.63, avgMCAT: 511, acceptRate: 4 },
  { name: 'Temple (Katz)', avgGPA: 3.58, avgMCAT: 511, acceptRate: 7 },
];

/* ═══════════════════════════════════════════════════════════════════
   QUIZ ENGINE COMPONENT
═══════════════════════════════════════════════════════════════════ */
const QuizEngine = memo(({ questions, onFinish, title }) => {
  const [qi, setQi] = useState(0);
  const [sel, setSel] = useState(null);
  const [confirmed, setConf] = useState(false);
  const [score, setScore] = useState(0);
  const LETTERS = ['A', 'B', 'C', 'D'];

  const q = questions[qi];
  const handleConfirm = useCallback(() => { if (sel !== null) { setConf(true); if (sel === q.ans) setScore(s => s + 1); } }, [sel, q]);
  const handleNext = useCallback(() => {
    const newScore = score + (sel === q.ans ? 1 : 0);
    if (qi + 1 >= questions.length) { onFinish(newScore, questions.length); }
    else { setQi(i => i + 1); setSel(null); setConf(false); }
  }, [qi, score, sel, q, questions.length, onFinish]);

  return (
    <div className="max-w-3xl mx-auto">
      {title && <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-6">{title}</p>}
      <div className="bg-white/5 border border-white/10 rounded-[28px] p-8">
        <div className="flex justify-between items-center mb-6">
          <span className="text-xs text-gray-500">Question {qi + 1} of {questions.length}</span>
          <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">{q.cat}</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1 mb-8">
          <div className="h-1 rounded-full bg-blue-500 transition-all" style={{ width: `${((qi) / questions.length) * 100}%` }} />
        </div>
        <h2 className="text-xl font-bold text-white mb-8 leading-snug"><MixedText t={q.text} /></h2>
        <div className="grid gap-3 mb-8">
          {q.choices.map((c, i) => {
            let cls = 'flex items-start gap-4 p-4 rounded-2xl border text-left transition-all duration-150 w-full ';
            if (confirmed) {
              if (i === q.ans) cls += 'bg-emerald-500/10 border-emerald-400/50 text-emerald-300';
              else if (i === sel) cls += 'bg-red-500/10 border-red-400/50 text-red-300';
              else cls += 'bg-transparent border-white/5 text-gray-600';
            } else {
              cls += sel === i ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20';
            }
            return (
              <button key={i} disabled={confirmed} onClick={() => setSel(i)} className={cls}>
                <span className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold mt-0.5 ${sel === i && !confirmed ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400'}`}>{LETTERS[i]}</span>
                <MixedText t={c} />
              </button>
            );
          })}
        </div>
        {confirmed && (
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl mb-6">
            <p className="text-xs font-bold text-white mb-2">Rationale</p>
            <p className="text-sm text-gray-300 leading-relaxed"><MixedText t={q.exp} /></p>
          </div>
        )}
        {!confirmed
          ? <button onClick={handleConfirm} disabled={sel === null} className="w-full py-4 bg-white text-black font-black rounded-xl hover:bg-blue-100 transition disabled:opacity-30 disabled:cursor-not-allowed">Confirm Choice</button>
          : <button onClick={handleNext} className="w-full py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-500 transition">{qi + 1 >= questions.length ? 'See Results →' : 'Next Question →'}</button>
        }
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
export default function App() {
  // ── Global State ──
  const [tab, setTab] = useState('home');
  const [user, setUser] = useState(() => ls.get('msp_user', { name: '', specialty: null, xp: 0, streak: 0, lastActive: null }));
  const [pathway, setPathway] = useState(() => ls.get('msp_pathway', {}));
  const [flashDecks, setFlashDecks] = useState(() => ls.get('msp_flash', {}));
  const [portfolio, setPortfolio] = useState(() => ls.get('msp_port', []));
  const [catPerf, setCatPerf] = useState(() => ls.get('msp_catperf', {}));

  // ── Sub-views ──
  const [activeUnit, setActiveUnit] = useState(null); // { unit, mode: 'lesson'|'mastery' }
  const [activeMasteryQs, setActiveMasteryQs] = useState(null);
  const [diagnosticStep, setDiagStep] = useState(0);
  const [diagAnswers, setDiagAnswers] = useState({});
  const [diagDone, setDiagDone] = useState(false);
  const [quizResults, setQuizResults] = useState(null); // { score, total, passed }

  // ── AI Coach ──
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: "Hello! I'm MetaBrain, your dedicated MCAT coach. Ask me anything — from enzyme kinetics to MMI interview prep. What shall we tackle today?" }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const msgsEndRef = useRef(null);

  // ── Flashcards ──
  const [flashInput, setFlashInput] = useState('');
  const [flashLoading, setFlashLoading] = useState(false);
  const [activeDeck, setActiveDeck] = useState(null);
  const [cardIdx, setCardIdx] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  // ── Interview ──
  const [interviewQ, setInterviewQ] = useState(null);
  const [interviewAnswer, setInterviewAnswer] = useState('');
  const [interviewFeedback, setInterviewFeedback] = useState('');
  const [interviewLoading, setInterviewLoading] = useState(false);

  // ── Admissions Calculator ──
  const [gpa, setGpa] = useState('');
  const [mcat, setMcat] = useState('');
  const [calcResults, setCalcResults] = useState(null);

  // ── Wellness (Pomodoro) ──
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroEnd, setPomodoroEnd] = useState(null);
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60);
  const [onBreak, setOnBreak] = useState(false);
  const pomodoroRef = useRef(null);

  // ── Persistence ──
  useEffect(() => { ls.set('msp_user', user); }, [user]);
  useEffect(() => { ls.set('msp_pathway', pathway); }, [pathway]);
  useEffect(() => { ls.set('msp_flash', flashDecks); }, [flashDecks]);
  useEffect(() => { ls.set('msp_port', portfolio); }, [portfolio]);
  useEffect(() => { ls.set('msp_catperf', catPerf); }, [catPerf]);
  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  // ── Pomodoro Timer ──
  useEffect(() => {
    if (pomodoroActive) {
      pomodoroRef.current = setInterval(() => {
        setPomodoroTimeLeft(t => {
          if (t <= 1) {
            clearInterval(pomodoroRef.current);
            setPomodoroActive(false);
            setOnBreak(true);
            return onBreak ? 25 * 60 : 5 * 60;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(pomodoroRef.current);
  }, [pomodoroActive, onBreak]);

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Diagnostic Logic ──
  const handleDiagAnswer = (qIdx, optIdx) => {
    const q = DIAGNOSTIC_QS[qIdx];
    const newAnswers = { ...diagAnswers, [qIdx]: optIdx };
    setDiagAnswers(newAnswers);
    if (qIdx + 1 >= DIAGNOSTIC_QS.length) {
      // Tally scores
      const scores = { surgery: 0, internal: 0, pediatrics: 0, psychiatry: 0, research: 0 };
      Object.entries(newAnswers).forEach(([qi, oi]) => {
        const wq = DIAGNOSTIC_QS[parseInt(qi)];
        Object.keys(scores).forEach(sp => { scores[sp] += wq.w[sp][oi] || 0; });
      });
      const specialty = Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0];
      const newUser = { ...user, specialty, xp: user.xp + 100 };
      setUser(newUser);
      // Initialize pathway for this specialty
      const initPathway = {};
      PATHS[specialty].units.forEach((u, i) => {
        initPathway[u.id] = { unlocked: i === 0, lessonsComplete: [], masteryScore: null };
      });
      setPathway(initPathway);
      setDiagDone(true);
    } else {
      setDiagStep(qIdx + 1);
    }
  };

  // ── Pathway Logic ──
  const currentPath = user.specialty ? PATHS[user.specialty] : null;

  const completeLesson = (unitId, lessonId) => {
    setPathway(prev => {
      const up = { ...prev, [unitId]: { ...prev[unitId], lessonsComplete: [...new Set([...(prev[unitId]?.lessonsComplete || []), lessonId])] } };
      return up;
    });
    setUser(u => ({ ...u, xp: u.xp + 25 }));
  };

  const startMasteryCheck = (unit) => {
    const qs = buildMasteryQuiz(unit.cat);
    setActiveMasteryQs(qs);
    setActiveUnit({ unit, mode: 'mastery' });
  };

  const finishMasteryCheck = (score, total, unit) => {
    const passed = score >= unit.req;
    setQuizResults({ score, total, passed, unit });
    setPathway(prev => {
      const up = { ...prev, [unit.id]: { ...prev[unit.id], masteryScore: score } };
      if (passed) {
        const units = currentPath.units;
        const idx = units.findIndex(u => u.id === unit.id);
        if (idx + 1 < units.length) up[units[idx + 1].id] = { ...up[units[idx + 1].id], unlocked: true, lessonsComplete: up[units[idx + 1].id]?.lessonsComplete || [] };
      }
      return up;
    });
    setUser(u => ({ ...u, xp: u.xp + (passed ? unit.xp : Math.floor(unit.xp * 0.3)) }));
    setCatPerf(prev => {
      const pct = Math.round((score / total) * 100);
      const c = prev[unit.cat] || { total: 0, count: 0 };
      return { ...prev, [unit.cat]: { total: c.total + pct, count: c.count + 1, last: pct } };
    });
    setActiveUnit(null);
    setActiveMasteryQs(null);
  };

  // ── AI Helpers ──
  const callAI = async (systemPrompt, userMsg) => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: systemPrompt, message: userMsg })
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.content || data.message || 'No response received.';
  };

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const newMsgs = [...msgs, { role: 'user', content: chatInput }];
    setMsgs(newMsgs);
    setChatInput('');
    setChatLoading(true);
    const context = user.specialty ? `The student is on the ${PATHS[user.specialty]?.label} pathway with ${user.xp} XP.` : '';
    try {
      const reply = await callAI(
        `You are MetaBrain, an elite MCAT coach for MedSchoolPrep. Be concise, high-yield, and use mnemonics when helpful. ${context}`,
        chatInput
      );
      setMsgs([...newMsgs, { role: 'assistant', content: reply }]);
    } catch {
      setMsgs([...newMsgs, { role: 'assistant', content: '⚠️ Could not reach the AI. Please configure your /api/ai endpoint (see api/ai.js).' }]);
    }
    setChatLoading(false);
  }, [chatInput, chatLoading, msgs, user]);

  const generateFlashcards = async () => {
    if (!flashInput.trim() || flashLoading) return;
    setFlashLoading(true);
    try {
      const reply = await callAI(
        'You are a medical flashcard generator. Given notes, return ONLY a JSON array of objects with "front" and "back" keys. No preamble, no markdown fences. Generate 8-12 cards.',
        flashInput
      );
      const cards = JSON.parse(reply.replace(/```json|```/g, '').trim());
      const deckName = `Deck ${Object.keys(flashDecks).length + 1}`;
      setFlashDecks(prev => ({ ...prev, [deckName]: cards }));
      setActiveDeck(deckName);
      setCardIdx(0);
      setCardFlipped(false);
      setFlashInput('');
    } catch {
      alert('Could not generate flashcards. Check your /api/ai endpoint or try again.');
    }
    setFlashLoading(false);
  };

  const getInterviewFeedback = async () => {
    if (!interviewAnswer.trim() || interviewLoading) return;
    setInterviewLoading(true);
    try {
      const feedback = await callAI(
        'You are an expert medical school interview coach for MMI (Multiple Mini Interview) preparation. Give concise, structured feedback (Strengths, Areas to Improve, Score /10). Be honest but encouraging.',
        `Question: "${interviewQ.q}"\n\nCandidate's answer: "${interviewAnswer}"`
      );
      setInterviewFeedback(feedback);
    } catch {
      setInterviewFeedback('⚠️ Could not get AI feedback. Please check your /api/ai endpoint.');
    }
    setInterviewLoading(false);
  };

  const calcAdmissions = () => {
    const g = parseFloat(gpa);
    const m = parseInt(mcat);
    if (!g || !m || g < 2 || g > 4.0 || m < 472 || m > 528) return alert('Enter valid GPA (2.0–4.0) and MCAT (472–528)');
    const results = SCHOOL_DATA.map(school => {
      const gpaGap = school.avgGPA - g;
      const mcatGap = school.avgMCAT - m;
      let chance = 'Reach';
      if (gpaGap <= -0.1 && mcatGap <= -2) chance = 'Target';
      if (gpaGap <= -0.2 && mcatGap <= -4) chance = 'Safety';
      if (gpaGap >= 0.15 || mcatGap >= 5) chance = 'Reach';
      return { ...school, chance };
    });
    setCalcResults(results);
  };

  // ── SIDEBAR NAV ──
  const NAV = [
    { id: 'home', icon: '⌂', label: 'Home' },
    { id: 'diagnostic', icon: '🧬', label: 'Pathway Diagnostic' },
    { id: 'pathway', icon: '📈', label: 'Learning Pathway' },
    { id: 'quiz', icon: '🧠', label: 'Quiz Library' },
    { id: 'coach', icon: '💬', label: 'MetaBrain AI' },
    { id: 'flashcards', icon: '🃏', label: 'AI Flashcards' },
    { id: 'elibrary', icon: '📚', label: 'E-Library' },
    { id: 'portfolio', icon: '🏆', label: 'Portfolio Builder' },
    { id: 'interview', icon: '🎤', label: 'Interview Simulator' },
    { id: 'admissions', icon: '🎓', label: 'Admissions Calc' },
    { id: 'analytics', icon: '📊', label: 'Analytics' },
  ];

  const accent = user.specialty ? PATHS[user.specialty].accent : '#3b82f6';
  const totalXP = user.xp;
  const xpLevel = Math.floor(totalXP / 500) + 1;
  const xpProgress = (totalXP % 500) / 500 * 100;

  // ── QUIZ LIBRARY STATE ──
  const [quizLibCat, setQuizLibCat] = useState('All');
  const [activeLibQuiz, setActiveLibQuiz] = useState(null);

  const libCats = ['All', 'Bio/Biochem', 'Chem/Phys', 'Psych/Soc'];
  const libQuestions = quizLibCat === 'All' ? Q_BANK.slice(0, 20) : Q_BANK.filter(q => q.cat === quizLibCat).slice(0, 20);

  return (
    <div className="flex h-screen w-screen bg-[#030014] text-white overflow-hidden font-sans">
      {/* ── SIDEBAR ── */}
      <aside className="w-64 shrink-0 flex flex-col bg-black/50 border-r border-white/5 overflow-y-auto">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg" style={{ background: accent }}>M</div>
            <div>
              <p className="font-black text-sm tracking-tight">MedSchoolPrep</p>
              <p className="text-[10px] text-gray-500">Everything App for Premeds</p>
            </div>
          </div>
          {/* XP Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>Level {xpLevel}</span>
              <span>{totalXP % 500} / 500 XP</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${xpProgress}%`, background: accent }} />
            </div>
          </div>
        </div>
        {/* Specialty Badge */}
        {user.specialty && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2" style={{ borderColor: `${accent}40`, color: accent, background: `${accent}10` }}>
            <span>{PATHS[user.specialty].icon}</span>
            <span>{PATHS[user.specialty].label} Path</span>
          </div>
        )}
        {/* Nav Items */}
        <nav className="flex-1 p-3 space-y-0.5 mt-2">
          {NAV.map(item => (
            <button key={item.id} onClick={() => { setTab(item.id); setActiveUnit(null); setQuizResults(null); }}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all ${tab === item.id ? 'bg-white/10 text-white font-semibold border border-white/10' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        {/* Pomodoro */}
        <div className="p-4 border-t border-white/5">
          <div className="bg-white/5 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{onBreak ? '☕ Break' : '⏱ Focus'}</span>
              <button onClick={() => { setPomodoroActive(a => !a); setPomodoroTimeLeft(onBreak ? 5 * 60 : 25 * 60); setOnBreak(false); }}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20">
                {pomodoroActive ? 'Pause' : 'Start'}
              </button>
            </div>
            <p className="text-2xl font-black text-center tracking-widest" style={{ color: accent }}>{fmtTime(pomodoroTimeLeft)}</p>
            {onBreak && <p className="text-[10px] text-center text-emerald-400 mt-1">Great work! Take a break 🌿</p>}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Ambient glow */}
        <div className="pointer-events-none fixed top-0 right-0 w-[600px] h-[600px] rounded-full blur-[150px] opacity-10 transition-all" style={{ background: accent }} />

        <div className="max-w-5xl mx-auto p-8">

          {/* ════════════ HOME ════════════ */}
          {tab === 'home' && (
            <div>
              <div className="mb-8">
                <h1 className="text-4xl font-black mb-1">Good day, Future Doctor 👋</h1>
                <p className="text-gray-500">{user.specialty ? `You're on the ${PATHS[user.specialty].label} path.` : 'Start with the Pathway Diagnostic to get your personalized learning plan.'}</p>
              </div>
              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total XP', val: totalXP.toLocaleString(), icon: '⚡', color: '#f59e0b' },
                  { label: 'Level', val: xpLevel, icon: '🏅', color: '#3b82f6' },
                  { label: 'Units Mastered', val: Object.values(pathway).filter(u => u.masteryScore !== null && u.masteryScore >= 3).length, icon: '🎯', color: '#10b981' },
                  { label: 'Lessons Done', val: Object.values(pathway).reduce((acc, u) => acc + (u.lessonsComplete?.length || 0), 0), icon: '📖', color: '#8b5cf6' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <p className="text-3xl font-black" style={{ color: s.color }}>{s.val}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <button onClick={() => setTab(user.specialty ? 'pathway' : 'diagnostic')} className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-blue-500/40 hover:bg-blue-500/5 transition group">
                  <p className="text-2xl mb-3">📈</p>
                  <h3 className="font-bold mb-1">{user.specialty ? 'Continue Learning Path' : 'Take the Pathway Diagnostic'}</h3>
                  <p className="text-sm text-gray-500">{user.specialty ? `${PATHS[user.specialty].label} – resume where you left off` : 'Discover your ideal specialty path in 10 questions'}</p>
                </button>
                <button onClick={() => setTab('coach')} className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-violet-500/40 hover:bg-violet-500/5 transition">
                  <p className="text-2xl mb-3">💬</p>
                  <h3 className="font-bold mb-1">Ask MetaBrain</h3>
                  <p className="text-sm text-gray-500">Get personalized AI tutoring on any MCAT concept</p>
                </button>
                <button onClick={() => setTab('interview')} className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-emerald-500/40 hover:bg-emerald-500/5 transition">
                  <p className="text-2xl mb-3">🎤</p>
                  <h3 className="font-bold mb-1">MMI Interview Practice</h3>
                  <p className="text-sm text-gray-500">AI-powered feedback on your med school interview answers</p>
                </button>
                <button onClick={() => setTab('admissions')} className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-amber-500/40 hover:bg-amber-500/5 transition">
                  <p className="text-2xl mb-3">🎓</p>
                  <h3 className="font-bold mb-1">Admissions Calculator</h3>
                  <p className="text-sm text-gray-500">See your odds at top medical schools based on your GPA & MCAT</p>
                </button>
              </div>
            </div>
          )}

          {/* ════════════ DIAGNOSTIC ════════════ */}
          {tab === 'diagnostic' && !diagDone && (
            <div>
              <h1 className="text-3xl font-black mb-2">Pathway Diagnostic 🧬</h1>
              <p className="text-gray-500 mb-8">Answer {DIAGNOSTIC_QS.length} questions to discover your ideal specialty path.</p>
              <div className="w-full bg-white/5 rounded-full h-1.5 mb-8">
                <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${(diagnosticStep / DIAGNOSTIC_QS.length) * 100}%` }} />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-[28px] p-8">
                <p className="text-xs text-gray-500 mb-4">Question {diagnosticStep + 1} of {DIAGNOSTIC_QS.length}</p>
                <h2 className="text-2xl font-bold mb-8">{DIAGNOSTIC_QS[diagnosticStep].q}</h2>
                <div className="grid gap-3">
                  {DIAGNOSTIC_QS[diagnosticStep].opts.map((opt, i) => (
                    <button key={i} onClick={() => handleDiagAnswer(diagnosticStep, i)}
                      className="p-4 bg-white/5 border border-white/10 rounded-2xl text-left text-gray-300 hover:bg-blue-500/10 hover:border-blue-500/40 hover:text-white transition font-medium">
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab === 'diagnostic' && diagDone && user.specialty && (
            <div className="text-center max-w-lg mx-auto pt-12">
              <p className="text-6xl mb-6">{PATHS[user.specialty].icon}</p>
              <h1 className="text-3xl font-black mb-3">Your Path: {PATHS[user.specialty].label}</h1>
              <p className="text-gray-400 mb-2">{PATHS[user.specialty].tagline}</p>
              <p className="text-sm text-gray-600 mb-8">You earned 100 XP for completing the diagnostic!</p>
              <button onClick={() => setTab('pathway')}
                className="px-8 py-4 rounded-2xl font-black text-white text-lg transition"
                style={{ background: PATHS[user.specialty].accent }}>
                Begin My Learning Path →
              </button>
            </div>
          )}

          {/* ════════════ LEARNING PATHWAY ════════════ */}
          {tab === 'pathway' && !activeUnit && !quizResults && (
            <div>
              {!user.specialty ? (
                <div className="text-center py-20">
                  <p className="text-5xl mb-4">🧬</p>
                  <h2 className="text-2xl font-bold mb-3">No Pathway Assigned Yet</h2>
                  <p className="text-gray-500 mb-6">Complete the diagnostic to get your personalized learning path.</p>
                  <button onClick={() => setTab('diagnostic')} className="px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition">Take the Diagnostic →</button>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <h1 className="text-3xl font-black mb-1">{PATHS[user.specialty].label} Pathway</h1>
                      <p className="text-gray-500">{PATHS[user.specialty].tagline}</p>
                    </div>
                    <span className="text-3xl">{PATHS[user.specialty].icon}</span>
                  </div>
                  <div className="space-y-4">
                    {PATHS[user.specialty].units.map((unit, idx) => {
                      const state = pathway[unit.id] || { unlocked: idx === 0, lessonsComplete: [], masteryScore: null };
                      const lessonsDone = state.lessonsComplete?.length || 0;
                      const mastered = state.masteryScore !== null && state.masteryScore >= unit.req;
                      const masteryPct = state.masteryScore !== null ? Math.round((state.masteryScore / unit.masteryTotal) * 100) : 0;
                      return (
                        <div key={unit.id} className={`border rounded-[24px] overflow-hidden transition-all ${state.unlocked ? PATHS[user.specialty].border : 'border-white/5'} ${state.unlocked ? 'bg-white/5' : 'bg-white/2 opacity-50'}`}>
                          <div className="p-6 flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 font-black border ${mastered ? 'border-emerald-500/50 bg-emerald-500/20' : state.unlocked ? PATHS[user.specialty].border : 'border-white/10 bg-white/5'}`}>
                              {mastered ? '✅' : state.unlocked ? idx + 1 : '🔒'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h3 className="font-bold truncate">{unit.title}</h3>
                                {mastered && <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full shrink-0">MASTERED</span>}
                              </div>
                              <p className="text-sm text-gray-500">{unit.desc}</p>
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-xs text-gray-600">{lessonsDone}/{unit.lessons.length} lessons</span>
                                {state.masteryScore !== null && <span className="text-xs text-gray-600">Mastery: {state.masteryScore}/{unit.masteryTotal}</span>}
                                <span className="text-xs font-bold" style={{ color: PATHS[user.specialty].accent }}>+{unit.xp} XP</span>
                              </div>
                              {/* Lesson progress bar */}
                              <div className="h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
                                <div className="h-1 rounded-full transition-all" style={{ width: `${(lessonsDone / unit.lessons.length) * 100}%`, background: mastered ? '#10b981' : PATHS[user.specialty].accent }} />
                              </div>
                            </div>
                            {state.unlocked && (
                              <button onClick={() => setActiveUnit({ unit, mode: 'lesson' })}
                                className="shrink-0 px-5 py-2 rounded-xl text-sm font-black text-white transition hover:opacity-80"
                                style={{ background: PATHS[user.specialty].accent }}>
                                {lessonsDone === unit.lessons.length ? 'Review' : 'Study →'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Unit Lesson View */}
          {tab === 'pathway' && activeUnit?.mode === 'lesson' && (
            <div>
              <button onClick={() => setActiveUnit(null)} className="flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition">← Back to Pathway</button>
              <h1 className="text-2xl font-black mb-2">{activeUnit.unit.title}</h1>
              <p className="text-gray-500 mb-8">Complete all lessons, then take the Mastery Check to unlock the next unit.</p>
              <div className="space-y-4 mb-8">
                {activeUnit.unit.lessons.map((lesson, i) => {
                  const done = (pathway[activeUnit.unit.id]?.lessonsComplete || []).includes(lesson.id);
                  return (
                    <div key={lesson.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-400'}`}>{done ? '✓' : i + 1}</span>
                            <h3 className="font-bold">{lesson.title}</h3>
                            <span className="text-xs text-gray-600">{lesson.dur}</span>
                          </div>
                          <p className="text-sm text-gray-500 ml-8">💡 {lesson.note}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <a href={lesson.url} target="_blank" rel="noreferrer"
                            className="px-4 py-2 bg-white/10 rounded-xl text-xs font-bold hover:bg-white/20 transition">
                            Watch ↗
                          </a>
                          {!done && (
                            <button onClick={() => completeLesson(activeUnit.unit.id, lesson.id)}
                              className="px-4 py-2 bg-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-500 transition">
                              Mark Done
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-gradient-to-r from-white/10 to-transparent border border-white/10 rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-lg mb-1">🎯 Mastery Check</h3>
                  <p className="text-sm text-gray-400">Score {activeUnit.unit.req}/{activeUnit.unit.masteryTotal} to master this unit and unlock the next one.</p>
                </div>
                <button onClick={() => startMasteryCheck(activeUnit.unit)}
                  className="px-6 py-3 rounded-xl font-black text-white transition hover:opacity-80"
                  style={{ background: PATHS[user.specialty]?.accent || '#3b82f6' }}>
                  Begin Check →
                </button>
              </div>
            </div>
          )}

          {/* Mastery Quiz */}
          {tab === 'pathway' && activeUnit?.mode === 'mastery' && activeMasteryQs && (
            <QuizEngine questions={activeMasteryQs} title={`Mastery Check — ${activeUnit.unit.title}`} onFinish={(s, t) => finishMasteryCheck(s, t, activeUnit.unit)} />
          )}

          {/* Quiz Result */}
          {tab === 'pathway' && quizResults && (
            <div className="text-center max-w-md mx-auto pt-12">
              <div className={`text-6xl mb-6`}>{quizResults.passed ? '🎉' : '📚'}</div>
              <h1 className="text-3xl font-black mb-3">{quizResults.passed ? 'Unit Mastered!' : 'Keep Practicing!'}</h1>
              <p className="text-5xl font-black mb-2">{quizResults.score}/{quizResults.total}</p>
              <p className="text-gray-500 mb-2">You needed {quizResults.unit.req}/{quizResults.unit.masteryTotal} to pass</p>
              <p className={`text-sm font-bold mb-8 ${quizResults.passed ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {quizResults.passed ? `+${quizResults.unit.xp} XP earned! Next unit unlocked.` : `+${Math.floor(quizResults.unit.xp * 0.3)} XP — review the lessons and try again.`}
              </p>
              <button onClick={() => setQuizResults(null)} className="px-8 py-4 bg-white/10 border border-white/10 rounded-2xl font-bold hover:bg-white/20 transition">
                Return to Pathway
              </button>
            </div>
          )}

          {/* ════════════ QUIZ LIBRARY ════════════ */}
          {tab === 'quiz' && (
            <div>
              {activeLibQuiz ? (
                <div>
                  <button onClick={() => setActiveLibQuiz(null)} className="flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition">← Back to Library</button>
                  <QuizEngine questions={activeLibQuiz} title="Quiz Library" onFinish={() => setActiveLibQuiz(null)} />
                </div>
              ) : (
                <div>
                  <h1 className="text-3xl font-black mb-2">Quiz Library 🧠</h1>
                  <p className="text-gray-500 mb-6">Practice MCAT questions across all tested categories.</p>
                  <div className="flex gap-2 mb-6">
                    {libCats.map(c => (
                      <button key={c} onClick={() => setQuizLibCat(c)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${quizLibCat === c ? 'bg-white text-black border-white' : 'border-white/20 text-gray-400 hover:border-white/40'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[0, 1, 2, 3].map(setIdx => {
                      const qs = libQuestions.slice(setIdx * 5, setIdx * 5 + 5).filter(Boolean);
                      const cat = qs[0]?.cat || libCats[1];
                      return (
                        <div key={setIdx} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-blue-500/30 transition">
                          <div className="text-xs font-bold text-blue-400 mb-1">{cat}</div>
                          <h3 className="font-bold mb-4">Practice Set {setIdx + 1}</h3>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">{qs.length} questions</span>
                            <button onClick={() => setActiveLibQuiz(qs)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition">
                              Start →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════ AI COACH ════════════ */}
          {tab === 'coach' && (
            <div className="flex flex-col h-[calc(100vh-8rem)]">
              <h1 className="text-3xl font-black mb-6">MetaBrain AI Coach 💬</h1>
              <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                {msgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm'}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm p-4">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />)}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={msgsEndRef} />
              </div>
              <div className="mt-4">
                <div className="flex gap-2 mb-3">
                  {['Explain the Nernst equation', 'How does the lac operon work?', 'MMI tips for ethics stations'].map(p => (
                    <button key={p} onClick={() => setChatInput(p)} className="text-[10px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition">{p}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="Ask about any MCAT concept, topic, or study strategy..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 outline-none focus:border-blue-500/50 text-sm placeholder:text-gray-600" />
                  <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                    className="px-6 py-3.5 bg-blue-600 rounded-2xl font-bold text-sm hover:bg-blue-500 disabled:opacity-40 transition">Send</button>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ FLASHCARDS ════════════ */}
          {tab === 'flashcards' && (
            <div>
              <h1 className="text-3xl font-black mb-2">AI Flashcards 🃏</h1>
              <p className="text-gray-500 mb-8">Paste your notes and let MetaBrain generate high-yield flashcard decks.</p>
              {activeDeck && flashDecks[activeDeck] ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <button onClick={() => setActiveDeck(null)} className="text-gray-500 hover:text-white text-sm transition">← All Decks</button>
                    <span className="text-xs text-gray-500">{cardIdx + 1} / {flashDecks[activeDeck].length}</span>
                  </div>
                  <div className="flex justify-center mb-6" onClick={() => setCardFlipped(f => !f)}>
                    <div className="w-full max-w-lg h-56 cursor-pointer" style={{ perspective: '1000px' }}>
                      <div className="relative w-full h-full transition-transform duration-500" style={{ transformStyle: 'preserve-3d', transform: cardFlipped ? 'rotateY(180deg)' : 'none' }}>
                        <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-[28px] flex flex-col items-center justify-center p-8 text-center backface-hidden">
                          <p className="text-xs text-gray-500 mb-4 uppercase tracking-widest">Front</p>
                          <p className="text-xl font-bold">{flashDecks[activeDeck][cardIdx]?.front}</p>
                        </div>
                        <div className="absolute inset-0 bg-blue-600/20 border border-blue-500/40 rounded-[28px] flex flex-col items-center justify-center p-8 text-center" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                          <p className="text-xs text-blue-400 mb-4 uppercase tracking-widest">Back</p>
                          <p className="text-lg text-gray-200">{flashDecks[activeDeck][cardIdx]?.back}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-xs text-gray-600 mb-6">Click card to flip</p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => { setCardIdx(i => Math.max(0, i - 1)); setCardFlipped(false); }} disabled={cardIdx === 0} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl font-bold text-sm disabled:opacity-30 hover:bg-white/10 transition">← Prev</button>
                    <button onClick={() => { setCardIdx(i => Math.min(flashDecks[activeDeck].length - 1, i + 1)); setCardFlipped(false); }} disabled={cardIdx === flashDecks[activeDeck].length - 1} className="px-5 py-2.5 bg-blue-600 rounded-xl font-bold text-sm disabled:opacity-30 hover:bg-blue-500 transition">Next →</button>
                  </div>
                </div>
              ) : (
                <div>
                  {Object.keys(flashDecks).length > 0 && (
                    <div className="grid grid-cols-3 gap-4 mb-8">
                      {Object.keys(flashDecks).map(name => (
                        <button key={name} onClick={() => { setActiveDeck(name); setCardIdx(0); setCardFlipped(false); }}
                          className="p-5 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-blue-500/40 transition">
                          <p className="text-2xl mb-2">🃏</p>
                          <p className="font-bold text-sm">{name}</p>
                          <p className="text-xs text-gray-500">{flashDecks[name].length} cards</p>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h3 className="font-bold mb-4">Generate New Deck from Notes</h3>
                    <textarea value={flashInput} onChange={e => setFlashInput(e.target.value)}
                      placeholder="Paste your study notes here... (e.g., 'Km is the substrate concentration at half-maximal velocity. Competitive inhibitors increase Km. Non-competitive inhibitors decrease Vmax...')"
                      rows={6} className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-blue-500/50 text-gray-300 placeholder:text-gray-700 resize-none mb-4" />
                    <button onClick={generateFlashcards} disabled={flashLoading || !flashInput.trim()}
                      className="px-6 py-3 bg-blue-600 rounded-xl font-bold text-sm hover:bg-blue-500 disabled:opacity-40 transition">
                      {flashLoading ? 'Generating...' : '✨ Generate Flashcards with AI'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════ E-LIBRARY ════════════ */}
          {tab === 'elibrary' && (
            <div>
              <h1 className="text-3xl font-black mb-2">E-Library 📚</h1>
              <p className="text-gray-500 mb-8">Curated, high-quality MCAT resources — all in one place.</p>
              {['Bio/Biochem', 'Chem/Phys', 'Psych/Soc', 'All'].map(cat => {
                const items = ELIB.filter(r => r.cat === cat);
                if (!items.length) return null;
                return (
                  <div key={cat} className="mb-8">
                    <h2 className="text-lg font-bold mb-4 text-gray-300">{cat}</h2>
                    <div className="grid grid-cols-2 gap-4">
                      {items.map((r, i) => (
                        <a key={i} href={r.url} target="_blank" rel="noreferrer"
                          className="p-5 bg-white/5 border border-white/10 rounded-2xl hover:border-blue-500/40 hover:bg-blue-500/5 transition group block">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">{r.type}</span>
                            {r.free ? <span className="text-[10px] font-bold text-emerald-400">FREE</span> : <span className="text-[10px] text-gray-600">Paid</span>}
                          </div>
                          <h3 className="font-bold text-sm mb-2 group-hover:text-white transition">{r.title}</h3>
                          <p className="text-xs text-gray-500">{r.desc}</p>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ════════════ PORTFOLIO BUILDER ════════════ */}
          {tab === 'portfolio' && (
            <div>
              <h1 className="text-3xl font-black mb-2">Portfolio Builder 🏆</h1>
              <p className="text-gray-500 mb-8">Track your activities and discover opportunities to strengthen your application.</p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-bold mb-4">My Activities</h2>
                  <div className="space-y-3 mb-4">
                    {portfolio.length === 0 ? (
                      <div className="bg-white/3 border border-dashed border-white/10 rounded-2xl p-6 text-center">
                        <p className="text-gray-600 text-sm">Add activities to build your timeline</p>
                      </div>
                    ) : portfolio.map((a, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm">{a.title}</p>
                          <p className="text-xs text-gray-500">{a.type} · {a.date}</p>
                        </div>
                        <button onClick={() => setPortfolio(p => p.filter((_, j) => j !== i))} className="text-red-400/60 hover:text-red-400 text-xs">Remove</button>
                      </div>
                    ))}
                  </div>
                  <PortfolioAdder onAdd={(a) => setPortfolio(p => [...p, a])} />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-4">Opportunities Near You</h2>
                  <div className="space-y-3">
                    {OPPORTUNITIES.map(op => (
                      <div key={op.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold text-sm">{op.name}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${op.diff === 'Elite' ? 'bg-red-500/20 text-red-400' : op.diff === 'Competitive' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{op.diff}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{op.desc}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-600">Deadline: {op.deadline}</span>
                          <div className="flex gap-2">
                            <button onClick={() => setPortfolio(p => [...p, { title: op.name, type: op.type, date: op.deadline }])}
                              className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-lg hover:bg-white/20 transition">+ Add</button>
                            {op.url !== '#' && <a href={op.url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-400 hover:text-blue-300">Learn ↗</a>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ INTERVIEW SIMULATOR ════════════ */}
          {tab === 'interview' && (
            <div>
              <h1 className="text-3xl font-black mb-2">MMI Interview Simulator 🎤</h1>
              <p className="text-gray-500 mb-8">Practice medical school Multiple Mini Interview (MMI) questions with AI feedback.</p>
              {!interviewQ ? (
                <div className="grid grid-cols-2 gap-4">
                  {MMI_QS.map((q, i) => (
                    <button key={i} onClick={() => { setInterviewQ(q); setInterviewAnswer(''); setInterviewFeedback(''); }}
                      className="p-5 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-violet-500/40 hover:bg-violet-500/5 transition group">
                      <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full inline-block mb-3">{q.type}</span>
                      <p className="text-sm font-medium text-gray-300 group-hover:text-white transition">{q.q}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <button onClick={() => setInterviewQ(null)} className="text-gray-500 hover:text-white text-sm mb-6 transition">← Back to Questions</button>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                    <span className="text-xs font-bold text-violet-400">{interviewQ.type}</span>
                    <h2 className="text-xl font-bold mt-2">{interviewQ.q}</h2>
                  </div>
                  <textarea value={interviewAnswer} onChange={e => setInterviewAnswer(e.target.value)}
                    placeholder="Type your response here... (Aim for 2-3 minutes of structured content)"
                    rows={7} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm text-gray-200 outline-none focus:border-violet-500/50 placeholder:text-gray-700 resize-none mb-4" />
                  <button onClick={getInterviewFeedback} disabled={interviewLoading || !interviewAnswer.trim()}
                    className="px-6 py-3 bg-violet-600 rounded-xl font-bold text-sm hover:bg-violet-500 disabled:opacity-40 transition mb-6">
                    {interviewLoading ? 'Analyzing...' : '🤖 Get AI Feedback'}
                  </button>
                  {interviewFeedback && (
                    <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-6">
                      <h3 className="font-bold mb-3 text-violet-300">AI Coach Feedback</h3>
                      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{interviewFeedback}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════════════ ADMISSIONS CALCULATOR ════════════ */}
          {tab === 'admissions' && (
            <div>
              <h1 className="text-3xl font-black mb-2">Admissions Calculator 🎓</h1>
              <p className="text-gray-500 mb-8">Compare your stats against top medical schools to identify targets, reaches, and safeties.</p>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="font-bold mb-5">Your Stats</h3>
                  <label className="block text-xs text-gray-500 mb-1">Cumulative GPA</label>
                  <input type="number" value={gpa} onChange={e => setGpa(e.target.value)} placeholder="3.85" step="0.01" min="2" max="4"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 mb-4" />
                  <label className="block text-xs text-gray-500 mb-1">MCAT Score (472–528)</label>
                  <input type="number" value={mcat} onChange={e => setMcat(e.target.value)} placeholder="514" min="472" max="528"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 mb-6" />
                  <button onClick={calcAdmissions} className="w-full py-3 bg-amber-500 text-black font-black rounded-xl hover:bg-amber-400 transition">Calculate →</button>
                </div>
                <div className="col-span-2">
                  {calcResults ? (
                    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                      {calcResults.map(s => (
                        <div key={s.name} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-sm">{s.name}</p>
                            <p className="text-xs text-gray-500">Avg GPA {s.avgGPA} · Avg MCAT {s.avgMCAT} · {s.acceptRate}% accept rate</p>
                          </div>
                          <span className={`text-xs font-black px-3 py-1 rounded-full ${s.chance === 'Safety' ? 'bg-emerald-500/20 text-emerald-400' : s.chance === 'Target' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                            {s.chance}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full bg-white/3 border border-dashed border-white/10 rounded-2xl flex items-center justify-center">
                      <p className="text-gray-600 text-sm">Enter your stats and click Calculate</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-700">⚠️ Estimates based on published averages. Individual outcomes depend on essays, research, clinical experience, and many other factors.</p>
            </div>
          )}

          {/* ════════════ ANALYTICS ════════════ */}
          {tab === 'analytics' && (
            <div>
              <h1 className="text-3xl font-black mb-8">Analytics 📊</h1>
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { label: 'Total XP Earned', val: user.xp.toLocaleString(), sub: `Level ${xpLevel}`, color: '#f59e0b' },
                  { label: 'Units Mastered', val: Object.values(pathway).filter(u => u.masteryScore !== null && u.masteryScore >= 3).length, sub: `of ${currentPath?.units?.length || 0} total`, color: '#10b981' },
                  { label: 'Lessons Completed', val: Object.values(pathway).reduce((a, u) => a + (u.lessonsComplete?.length || 0), 0), sub: 'Keep going!', color: '#3b82f6' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.val}</p>
                    <p className="font-bold text-sm">{s.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="font-bold mb-6">Category Performance</h3>
                {Object.keys(catPerf).length === 0 ? (
                  <p className="text-gray-600 text-sm">Complete mastery checks to see your performance by category.</p>
                ) : (
                  <div className="space-y-5">
                    {Object.entries(catPerf).map(([cat, data]) => {
                      const avg = Math.round(data.total / data.count);
                      const color = avg >= 75 ? '#10b981' : avg >= 50 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="font-medium">{cat}</span>
                            <span style={{ color }}>{avg}% avg · Last: {data.last}%</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${avg}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {currentPath && (
                <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="font-bold mb-6">Pathway Progress — {currentPath.label}</h3>
                  <div className="space-y-4">
                    {currentPath.units.map(unit => {
                      const state = pathway[unit.id] || { unlocked: false, lessonsComplete: [], masteryScore: null };
                      const lessonPct = Math.round(((state.lessonsComplete?.length || 0) / unit.lessons.length) * 100);
                      return (
                        <div key={unit.id}>
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>{unit.title}</span>
                            <span>{state.masteryScore !== null ? `Mastery: ${state.masteryScore}/${unit.masteryTotal}` : `${lessonPct}% lessons done`}</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-2 rounded-full" style={{ width: `${state.masteryScore !== null ? Math.round((state.masteryScore / unit.masteryTotal) * 100) : lessonPct}%`, background: state.unlocked ? currentPath.accent : '#374151' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PORTFOLIO ADDER (sub-component)
═══════════════════════════════════════════════════════════════════ */
function PortfolioAdder({ onAdd }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Research');
  const [date, setDate] = useState('');
  const types = ['Research', 'Clinical', 'Volunteering', 'Competition', 'Scholarship', 'Conference', 'Leadership', 'Other'];
  const submit = () => {
    if (!title.trim()) return;
    onAdd({ title, type, date: date || 'Ongoing' });
    setTitle(''); setDate('');
  };
  return (
    <div className="bg-white/5 border border-dashed border-white/20 rounded-2xl p-4">
      <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-widest">Add Activity</p>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Activity name..." className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500/40 text-gray-200 placeholder:text-gray-700 mb-2" />
      <div className="flex gap-2 mb-3">
        <select value={type} onChange={e => setType(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-400 outline-none">
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="month" value={date} onChange={e => setDate(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-400 outline-none" />
      </div>
      <button onClick={submit} className="w-full py-2 bg-white/10 rounded-xl text-xs font-bold hover:bg-white/20 transition">+ Add to Timeline</button>
    </div>
  );
}
