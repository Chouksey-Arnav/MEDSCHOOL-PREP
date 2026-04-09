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
   SPECIALTY PATHS
═══════════════════════════════════════════════════════════════════ */
const PATHS = {
  surgery: {
    label: 'General Surgery', icon: '🔬', accent: '#ef4444', border: 'border-red-500/40',
    tagline: 'Master anatomy, physiology & surgical science',
    units: [
      { id: 'su1', title: 'Biochemistry Foundations', desc: 'Amino acids, enzymes, metabolism', cat: 'Bio/Biochem', req: 3, masteryTotal: 4, xp: 150,
        lessons: [
          { id: 'su1-l1', title: 'Amino Acid Structure & Properties', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=Eq1xMEGTnVE', dur: '18 min', note: 'Know pKa: Asp/Glu (acidic), Lys/Arg/His (basic)' },
          { id: 'su1-l2', title: 'Enzyme Kinetics & Inhibition', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=4SjNWBJkASU', dur: '22 min', note: 'Lineweaver-Burk: competitive raises Km, non-competitive lowers Vmax' },
          { id: 'su1-l3', title: 'Glycolysis & the TCA Cycle', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=2f7YwCtHcgk', dur: '25 min', note: 'Net: 2 ATP glycolysis; ~30 ATP from oxidative phosphorylation' },
        ]
      },
      { id: 'su2', title: 'Cardiovascular & Respiratory', desc: 'Heart, lungs, hemodynamics', cat: 'Chem/Phys', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 'su2-l1', title: 'Cardiac Cycle & Hemodynamics', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=AXTzYYCl3bk', dur: '20 min', note: 'Starling curve: increased preload → increased stroke volume' },
          { id: 'su2-l2', title: 'Respiratory Mechanics & Gas Exchange', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=HPHByM4ANLI', dur: '18 min', note: 'V/Q mismatch: dead space (no perfusion) vs shunt (no ventilation)' },
          { id: 'su2-l3', title: 'Acid-Base Disorders', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=0YbBMPah3y0', dur: '15 min', note: 'Use Henderson-Hasselbalch & the ROME mnemonic' },
        ]
      },
      { id: 'su3', title: 'Musculoskeletal System', desc: 'Bones, muscles, connective tissue', cat: 'Bio/Biochem', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 'su3-l1', title: 'Sliding Filament & Muscle Contraction', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=GrHsiHazpsw', dur: '20 min', note: 'Ca2+ releases troponin inhibition → myosin binds actin' },
          { id: 'su3-l2', title: 'Bone Remodeling & Mineral Homeostasis', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=wJ_GGMx-GCk', dur: '17 min', note: 'PTH up-regulates Ca2+ serum; calcitonin down-regulates Ca2+' },
          { id: 'su3-l3', title: 'Collagen & Connective Tissue', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=Ck7RqJiHcNk', dur: '15 min', note: 'Type I=bone/tendon, Type II=cartilage, Type IV=basement membrane' },
        ]
      },
      { id: 'su4', title: 'Molecular Biology & Genetics', desc: 'DNA, RNA, gene regulation', cat: 'Bio/Biochem', req: 3, masteryTotal: 4, xp: 200,
        lessons: [
          { id: 'su4-l1', title: 'DNA Replication & Repair', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=TNKWgcFPHqw', dur: '20 min', note: 'Leading strand continuous, lagging strand uses Okazaki fragments' },
          { id: 'su4-l2', title: 'Transcription, Translation & PTMs', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=WkI_Vbwn14g', dur: '18 min', note: 'RNA Pol II transcribes mRNA; Signal sequences target proteins to ER' },
          { id: 'su4-l3', title: 'Mendelian Genetics & Pedigree Analysis', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=kMKho3d1_0w', dur: '22 min', note: 'Hardy-Weinberg: p2 + 2pq + q2 = 1; use for allele frequency problems' },
        ]
      },
      { id: 'su5', title: 'Physics & Fluid Dynamics', desc: 'Mechanics, fluids, thermodynamics', cat: 'Chem/Phys', req: 3, masteryTotal: 4, xp: 200,
        lessons: [
          { id: 'su5-l1', title: "Poiseuille's Law & Fluid Mechanics", url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=4TqDhZ9LDSQ', dur: '18 min', note: 'Q proportional to r4 — radius is the most critical variable in flow rate' },
          { id: 'su5-l2', title: 'Circuits & Electricity', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=ZrMw7P6P2Cs', dur: '20 min', note: 'Resistors in series add; in parallel: 1/R_total = sum(1/Rn)' },
          { id: 'su5-l3', title: 'Thermodynamics & Free Energy', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=CFmzT1lAdcA', dur: '22 min', note: 'deltaG = deltaH - T*deltaS; spontaneous when deltaG < 0' },
        ]
      },
    ]
  },
  internal: {
    label: 'Internal Medicine', icon: '🩺', accent: '#3b82f6', border: 'border-blue-500/40',
    tagline: 'Master diagnostic reasoning & pharmacology',
    units: [
      { id: 'im1', title: 'Pathophysiology Foundations', desc: 'Disease at the cellular level', cat: 'Bio/Biochem', req: 3, masteryTotal: 4, xp: 150,
        lessons: [
          { id: 'im1-l1', title: 'Inflammation & Immune Response', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=kz9LFvRBLXA', dur: '20 min', note: 'COX-2 → prostaglandins → fever; NSAIDs block this pathway' },
          { id: 'im1-l2', title: 'Necrosis vs Apoptosis', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=9KIH42V6A3M', dur: '18 min', note: 'Apoptosis is programmed (caspase-mediated); necrosis is pathological' },
          { id: 'im1-l3', title: 'Neoplasia & Cancer Biology', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=RZhL7LDPk8w', dur: '22 min', note: 'Proto-oncogenes (gas pedal) vs tumor suppressors (brakes)' },
        ]
      },
      { id: 'im2', title: 'Pharmacology Principles', desc: 'Pharmacokinetics & pharmacodynamics', cat: 'Bio/Biochem', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 'im2-l1', title: 'Drug Absorption & Bioavailability', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=CUXJqHB_6Os', dur: '18 min', note: 'First-pass metabolism reduces oral bioavailability; IV = 100%' },
          { id: 'im2-l2', title: 'Receptor Pharmacology', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=9miR3Xv_1mI', dur: '20 min', note: 'ED50: dose for 50% effect; therapeutic index = LD50/ED50' },
          { id: 'im2-l3', title: 'Drug Metabolism & CYP450', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=6-w4x1wz9oQ', dur: '15 min', note: 'CYP3A4 metabolizes ~50% of drugs; inducers increase clearance' },
        ]
      },
      { id: 'im3', title: 'Endocrinology', desc: 'Hormones and metabolic axes', cat: 'Bio/Biochem', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 'im3-l1', title: 'Hypothalamic-Pituitary Axis', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=dJ79hHgOLxE', dur: '22 min', note: 'Negative feedback: high cortisol → suppresses CRH and ACTH' },
          { id: 'im3-l2', title: 'Thyroid & Adrenal Physiology', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=L5ESTrH7V7s', dur: '20 min', note: 'T3 is active form; T4 is a prohormone converted peripherally' },
          { id: 'im3-l3', title: 'Diabetes Mellitus & Insulin Signaling', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=X9ivR4-eFmA', dur: '18 min', note: 'Type 1: autoimmune beta-cell destruction; Type 2: insulin resistance' },
        ]
      },
      { id: 'im4', title: 'Electrochemistry & Solutions', desc: 'Galvanic cells, acid-base, colligative', cat: 'Chem/Phys', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 'im4-l1', title: 'Galvanic Cells & Nernst Equation', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=lQ6FBA1HM3s', dur: '20 min', note: 'E = Eo - (RT/nF)lnQ; cathode = reduction, anode = oxidation' },
          { id: 'im4-l2', title: 'Acid-Base Equilibria & Buffers', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=VZqCH7SVRGQ', dur: '18 min', note: 'Best buffer: pKa +/- 1 of target pH; bicarbonate buffer in blood' },
          { id: 'im4-l3', title: 'Osmolarity & Colligative Properties', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=hVMzGK8mfRk', dur: '15 min', note: 'Osmotic pressure pi = iMRT; tonicity determines cell behavior' },
        ]
      },
      { id: 'im5', title: 'Behavioral Science & Sociology', desc: 'Biopsychosocial model', cat: 'Psych/Soc', req: 3, masteryTotal: 4, xp: 200,
        lessons: [
          { id: 'im5-l1', title: 'Learning, Memory & Conditioning', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=mB-6dn9cTJA', dur: '18 min', note: 'Operant: reinforcement/punishment; Classical: CS + US → CR' },
          { id: 'im5-l2', title: 'Social Cognition & Attribution', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=8MHMDqSbPDI', dur: '20 min', note: 'FAE: over-attribute behavior to disposition vs situation' },
          { id: 'im5-l3', title: 'Health Disparities & Social Determinants', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=Hs1aFSH0cxo', dur: '15 min', note: 'SES, race, geography all influence morbidity/mortality outcomes' },
        ]
      },
    ]
  },
  pediatrics: {
    label: 'Pediatrics', icon: '👶', accent: '#10b981', border: 'border-emerald-500/40',
    tagline: 'Specialize in child development & family medicine',
    units: [
      { id: 'pe1', title: 'Developmental Biology', desc: 'Embryology & developmental milestones', cat: 'Bio/Biochem', req: 3, masteryTotal: 4, xp: 150,
        lessons: [
          { id: 'pe1-l1', title: 'Embryonic Development & Organogenesis', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=dAOWQDOX35k', dur: '22 min', note: 'Teratogens: thalidomide=limb defects, alcohol=FAS, rubella=CHD' },
          { id: 'pe1-l2', title: 'Developmental Milestones by Age', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=VDNgKtC_GRc', dur: '18 min', note: 'Gross motor → fine motor → language → social (order of mastery)' },
          { id: 'pe1-l3', title: 'Chromosomal & Genetic Disorders', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=IpBEae19Qlo', dur: '20 min', note: 'Down (T21), Turner (45,X), Klinefelter (47,XXY)' },
        ]
      },
      { id: 'pe2', title: 'Immunology & Infectious Disease', desc: 'Immunity, vaccines, pediatric infections', cat: 'Bio/Biochem', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 'pe2-l1', title: 'Innate vs Adaptive Immunity', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=LmpuerlbJu0', dur: '22 min', note: 'MHC I presents to CD8+ T cells; MHC II presents to CD4+ T cells' },
          { id: 'pe2-l2', title: 'Vaccine Immunology', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=rb7TVW77ZCs', dur: '18 min', note: 'Live-attenuated (MMR) vs inactivated (flu) vs mRNA (COVID)' },
          { id: 'pe2-l3', title: 'Pediatric Infections Overview', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=VXRLgqBjr9E', dur: '15 min', note: 'RSV, Kawasaki, meningitis — recognize classic presentations' },
        ]
      },
      { id: 'pe3', title: 'Child Psychology', desc: 'Cognitive and emotional development', cat: 'Psych/Soc', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 'pe3-l1', title: "Piaget's Stages of Cognitive Development", url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=TRF27F2bn-A', dur: '20 min', note: 'Sensorimotor → Preoperational → Concrete → Formal Operational' },
          { id: 'pe3-l2', title: 'Attachment Theory', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=yrB5kSXE_uQ', dur: '18 min', note: 'Secure, avoidant, anxious-ambivalent, disorganized' },
          { id: 'pe3-l3', title: "Erikson's Psychosocial Stages", url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=OhBME54N0hI', dur: '15 min', note: 'Stage 1: Trust vs Mistrust (birth-18mo); conflicts proceed through life' },
        ]
      },
      { id: 'pe4', title: 'Nutrition & Metabolism', desc: 'Vitamins, lipids, nitrogen metabolism', cat: 'Bio/Biochem', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 'pe4-l1', title: 'Vitamins & Cofactors', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=K0-BFzqBsJ8', dur: '20 min', note: 'Fat-soluble: ADEK; Water-soluble: B vitamins, C. Deficiency diseases!' },
          { id: 'pe4-l2', title: 'Lipid Metabolism & Lipoproteins', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=n5QoSHmOubc', dur: '18 min', note: 'Chylomicrons transport dietary fat; LDL delivers to cells; HDL returns to liver' },
          { id: 'pe4-l3', title: 'Urea Cycle & Nitrogen Metabolism', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=i-5cSNWrK6E', dur: '15 min', note: 'Liver detoxifies NH3 → urea. OTC deficiency → hyperammonemia' },
        ]
      },
      { id: 'pe5', title: 'Research Methods & Statistics', desc: 'Study design and statistical analysis', cat: 'Psych/Soc', req: 3, masteryTotal: 4, xp: 200,
        lessons: [
          { id: 'pe5-l1', title: 'Epidemiology & Study Design', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=OqEbX6FSEQA', dur: '18 min', note: 'Gold standard: RCT. Cohort=prospective; Case-control=retrospective' },
          { id: 'pe5-l2', title: 'Biostatistics for the MCAT', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=U3M5-meSBKA', dur: '20 min', note: 'Sensitivity=SnNout; Specificity=SpPin. PPV depends on prevalence!' },
          { id: 'pe5-l3', title: 'Ethical Principles in Research', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=X88jFfPvn00', dur: '15 min', note: 'Belmont Report: Respect, Beneficence, Justice. IRB oversees all research.' },
        ]
      },
    ]
  },
  psychiatry: {
    label: 'Psychiatry', icon: '🧠', accent: '#8b5cf6', border: 'border-violet-500/40',
    tagline: 'Master psychology, neuroscience & behavioral medicine',
    units: [
      { id: 'ps1', title: 'Neuroscience Foundations', desc: 'Neurons, synapses, brain regions', cat: 'Bio/Biochem', req: 3, masteryTotal: 4, xp: 150,
        lessons: [
          { id: 'ps1-l1', title: 'Neuron Structure & Action Potential', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=HYLyhXRp298', dur: '22 min', note: 'Resting: -70mV. Depolarization via Na+ in; Repolarization via K+ out' },
          { id: 'ps1-l2', title: 'Synaptic Transmission & Neurotransmitters', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=WhowH0kb7n0', dur: '20 min', note: 'Dopamine: reward; Serotonin: mood; GABA: inhibitory; Glutamate: excitatory' },
          { id: 'ps1-l3', title: 'Brain Regions & Their Functions', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=SRInEgxs2Pk', dur: '18 min', note: 'Limbic: emotion/memory; PFC: executive function; BG: movement' },
        ]
      },
      { id: 'ps2', title: 'Psychology & Behavior', desc: 'Learning, cognition, psychopathology', cat: 'Psych/Soc', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 'ps2-l1', title: 'Sensation, Perception & Consciousness', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=unWnZvXJH2o', dur: '20 min', note: "Weber's Law: deltaI/I = k (JND is constant fraction of stimulus)" },
          { id: 'ps2-l2', title: 'Motivation, Emotion & Stress', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=bZEiJz3k5DY', dur: '18 min', note: "Maslow's hierarchy; James-Lange: body reaction PRECEDES emotion" },
          { id: 'ps2-l3', title: 'Psychological Disorders & DSM-5', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=FHrfGiAb1ig', dur: '22 min', note: 'Schizophrenia (positive/negative sx), mood disorders, anxiety clusters' },
        ]
      },
      { id: 'ps3', title: 'Social Science & Sociology', desc: 'Society, culture, inequality', cat: 'Psych/Soc', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 'ps3-l1', title: 'Social Stratification & Health Inequity', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=7hTB1-4qM70', dur: '18 min', note: 'SES gradient: poverty → worse health outcomes across all conditions' },
          { id: 'ps3-l2', title: 'Culture, Identity & Health Behavior', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=FSJZ3mcC_p8', dur: '16 min', note: 'Cultural competency: recognize, respect, respond to cultural differences' },
          { id: 'ps3-l3', title: 'Social Networks & Group Dynamics', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=UGxGDdQnC1Y', dur: '15 min', note: 'Bystander effect, conformity (Asch), obedience (Milgram), groupthink' },
        ]
      },
      { id: 'ps4', title: 'Neuropharmacology', desc: 'Drugs, receptors, clinical psychiatry', cat: 'Bio/Biochem', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 'ps4-l1', title: 'Antidepressants & Antipsychotics', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=YgnTKZnBXOM', dur: '22 min', note: 'SSRIs inhibit serotonin reuptake; Atypical APs: D2 + 5-HT2 block' },
          { id: 'ps4-l2', title: 'Anxiolytics & Mood Stabilizers', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=3Qp4DHWGZCA', dur: '18 min', note: 'Benzodiazepines potentiate GABA; Lithium: gold standard for bipolar' },
          { id: 'ps4-l3', title: 'Neuroplasticity & Memory', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=OyK9T4nBD9g', dur: '20 min', note: 'LTP: NMDA receptors → long-term potentiation. BDNF promotes neurogenesis' },
        ]
      },
      { id: 'ps5', title: 'Behavioral Research Methods', desc: 'Research design for psych studies', cat: 'Psych/Soc', req: 3, masteryTotal: 4, xp: 200,
        lessons: [
          { id: 'ps5-l1', title: 'Psychological Research Methodology', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=9GCM1TerXck', dur: '18 min', note: 'Experimental vs correlational vs naturalistic. Confounds destroy internal validity.' },
          { id: 'ps5-l2', title: 'Statistics for Psych/Soc', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=MXaJ7sa7q-8', dur: '22 min', note: 'Normal distribution: mean=median=mode. Skewed: mean pulled toward tail' },
          { id: 'ps5-l3', title: 'Ethics in Behavioral Research', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=cRGMv_MVKGQ', dur: '15 min', note: 'Tuskegee, Milgram, Zimbardo — landmark studies that shaped research ethics' },
        ]
      },
    ]
  },
  research: {
    label: 'Research & Academia', icon: '🔭', accent: '#f59e0b', border: 'border-amber-500/40',
    tagline: 'Excel in biomedical research & academic medicine',
    units: [
      { id: 're1', title: 'Molecular Biology', desc: 'Gene expression, proteins, CRISPR', cat: 'Bio/Biochem', req: 3, masteryTotal: 4, xp: 150,
        lessons: [
          { id: 're1-l1', title: 'Gene Expression & Epigenetic Regulation', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=TfYf_rPWUdY', dur: '22 min', note: 'Methylation silences; acetylation activates. Epigenetics = heritable non-DNA changes' },
          { id: 're1-l2', title: 'Protein Folding, Chaperones & Proteomics', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=gFcp2Xpd29I', dur: '18 min', note: 'Prion diseases: misfolded proteins; Hsp70 chaperones prevent aggregation' },
          { id: 're1-l3', title: 'CRISPR-Cas9 & Gene Editing', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=2pp17E4E-O8', dur: '20 min', note: 'Guide RNA directs Cas9; DSB repaired by HDR (precise) or NHEJ (error-prone)' },
        ]
      },
      { id: 're2', title: 'Epidemiology & Biostatistics', desc: 'Study design, bias, statistics', cat: 'Psych/Soc', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 're2-l1', title: 'Epidemiology: Incidence, Prevalence, Risk', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=OqEbX6FSEQA', dur: '20 min', note: 'Relative Risk from cohort; Odds Ratio from case-control.' },
          { id: 're2-l2', title: 'Statistical Power, Error, and Significance', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=7nh3X_8c2cY', dur: '18 min', note: 'Type I error = false positive (alpha); Type II = false negative (beta). Power = 1-beta' },
          { id: 're2-l3', title: 'Systematic Reviews & Meta-Analysis', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=SAE-mJXwnPE', dur: '15 min', note: 'Forest plots: diamond crossing 1.0 = not significant; funnel plot detects publication bias' },
        ]
      },
      { id: 're3', title: 'Physical Chemistry & Spectroscopy', desc: 'Lab techniques and physical chemistry', cat: 'Chem/Phys', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 're3-l1', title: 'Spectroscopy: NMR, IR & Mass Spec', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=SBir5wUS3Bo', dur: '20 min', note: 'IR: 1700 cm-1 = carbonyl; NMR: n+1 rule; MS: M+ = molecular weight' },
          { id: 're3-l2', title: 'Chromatography & Electrophoresis', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=1bFzMPJNHmw', dur: '18 min', note: 'SDS-PAGE separates by size; native PAGE by charge+size' },
          { id: 're3-l3', title: 'Thermodynamics & Reaction Kinetics', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=CFmzT1lAdcA', dur: '22 min', note: 'Arrhenius: k = Ae^(-Ea/RT); catalyst lowers Ea, does NOT change deltaG' },
        ]
      },
      { id: 're4', title: 'Immunology & Virology', desc: 'Host-pathogen interactions in depth', cat: 'Bio/Biochem', req: 3, masteryTotal: 4, xp: 175,
        lessons: [
          { id: 're4-l1', title: 'Adaptive Immunity & V(D)J Recombination', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=mwnVcFWoxps', dur: '22 min', note: 'Clonal selection: one B cell → one antibody specificity. Affinity maturation in GCs' },
          { id: 're4-l2', title: 'Microbial Pathogenesis & Virulence', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=VXRLgqBjr9E', dur: '20 min', note: 'Exotoxins are secreted; endotoxins (LPS) are membrane-bound' },
          { id: 're4-l3', title: 'Viral Replication & Antiviral Targets', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=0h5Jd7sgQWY', dur: '18 min', note: 'Retroviruses: RNA→DNA via reverse transcriptase. Lytic vs lysogenic cycle' },
        ]
      },
      { id: 're5', title: 'Organic Chemistry', desc: 'Reactions, mechanisms, stereochemistry', cat: 'Chem/Phys', req: 3, masteryTotal: 4, xp: 200,
        lessons: [
          { id: 're5-l1', title: 'Nucleophilic Substitution (SN1 & SN2)', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=MqnVGNr3mso', dur: '22 min', note: 'SN2: backside attack → inversion; SN1: carbocation → racemization' },
          { id: 're5-l2', title: 'Carbonyl Chemistry & Reactions', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=j9MikXByeys', dur: '20 min', note: 'Nucleophilic addition to C=O; aldehydes > ketones in reactivity' },
          { id: 're5-l3', title: 'Stereochemistry & Chirality', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=H8Z-VWq7DkI', dur: '18 min', note: 'R/S via Cahn-Ingold-Prelog priority rules; optical activity measures chirality' },
        ]
      },
    ]
  },
};

/* ═══════════════════════════════════════════════════════════════════
   QUESTION BANK
═══════════════════════════════════════════════════════════════════ */
const Q_TEMPLATES = [
  { cat: 'Chem/Phys', text: 'A fluid flows through a tube. The pressure gradient is tripled and the radius is halved. The new flow rate compared to the original is:', choices: ['3/16 of the original', '3/8 of the original', '3/4 of the original', '6 times the original'], ans: 0, exp: "Poiseuille's law: Q = pi*r^4*deltaP / (8*eta*L). New Q = Q0 * 3 * (1/2)^4 = 3/16 of Q0." },
  { cat: 'Bio/Biochem', text: 'A competitive inhibitor is added to an enzyme-substrate reaction. What happens to Km and Vmax?', choices: ['Km increases; Vmax unchanged', 'Vmax decreases; Km unchanged', 'Both Km and Vmax increase', 'Neither parameter changes'], ans: 0, exp: 'Competitive inhibitors compete with substrate for the active site. Excess substrate can overcome inhibition, so Vmax is preserved but apparent Km rises.' },
  { cat: 'Bio/Biochem', text: 'Which molecule is the direct energy currency consumed during myosin\'s power stroke?', choices: ['ATP', 'NADH', 'Creatine phosphate', 'GTP'], ans: 0, exp: 'Myosin ATPase hydrolyzes ATP directly to produce the conformational change of the power stroke. Creatine phosphate regenerates ATP but is not directly used.' },
  { cat: 'Chem/Phys', text: 'Light travels from water (n=1.33) into denser glass (n=1.50) at an incident angle of 45 degrees. The refracted angle is:', choices: ['Less than 45 degrees (bends toward normal)', 'Greater than 45 degrees (bends away from normal)', 'Exactly 45 degrees (no refraction)', 'Greater than critical angle - total internal reflection'], ans: 0, exp: "Snell's law: n1*sin(theta1) = n2*sin(theta2). Since n2 > n1, sin(theta2) < sin(theta1), so the ray bends toward the normal." },
  { cat: 'Psych/Soc', text: 'Bystanders at an emergency scene see others not responding and therefore also refrain from helping. This is best explained by:', choices: ['Diffusion of responsibility', 'Fundamental attribution error', 'In-group bias', 'Cognitive dissonance'], ans: 0, exp: 'The bystander effect: each individual feels less personally responsible when others are present, reducing likelihood of intervention (Darley & Latane, 1968).' },
  { cat: 'Bio/Biochem', text: 'In the presence of glucose and absence of lactose, the E. coli lac operon is:', choices: ['Repressed — lac repressor bound to operator', 'Active — CAP-cAMP complex activates transcription', 'Partially active due to allolactose', 'Fully transcribed due to high cAMP'], ans: 0, exp: 'Without lactose, allolactose is absent, so the lac repressor remains bound to the operator. The operon is transcriptionally repressed.' },
  { cat: 'Chem/Phys', text: "A galvanic cell's cathode ion concentration is increased tenfold. According to the Nernst equation, cell potential will:", choices: ['Increase — Q decreases, E rises', 'Decrease — Q increases, E falls', 'Stay the same — concentration does not affect E', 'Drop to zero — equilibrium is reached'], ans: 0, exp: 'E = Eo - (RT/nF)*ln(Q). Increasing oxidized species at cathode decreases Q, which increases E_cell.' },
  { cat: 'Psych/Soc', text: 'Researchers find that ice cream sales and drowning deaths both peak in summer. This is best described as:', choices: ['Spurious correlation due to a confound (season/heat)', 'Direct causation — ice cream causes drowning', 'Reverse causation — drowning promotes ice cream sales', 'Sampling bias in the data collection'], ans: 0, exp: 'A confounding variable (summer/heat) drives both ice cream consumption and swimming activity. Correlation is not causation.' },
  { cat: 'Bio/Biochem', text: 'Pyruvate is converted to acetyl-CoA by pyruvate dehydrogenase (PDH). Which cofactor is NOT required by this reaction?', choices: ['Biotin', 'TPP (thiamine pyrophosphate)', 'CoA', 'NAD+'], ans: 0, exp: 'Biotin is a cofactor for carboxylation reactions (e.g., pyruvate carboxylase), not PDH. PDH requires TPP, lipoate, CoA, FAD, and NAD+.' },
  { cat: 'Chem/Phys', text: 'A reaction has deltaH = +50 kJ and deltaS = +200 J/K. At 400 K, the reaction is:', choices: ['Spontaneous (deltaG < 0)', 'Non-spontaneous (deltaG > 0)', 'At equilibrium (deltaG = 0)', 'Cannot be determined from this data'], ans: 0, exp: 'deltaG = deltaH - T*deltaS = 50000 - (400)(200) = 50000 - 80000 = -30000 J. Since deltaG < 0, the reaction is spontaneous.' },
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
  { id: 'usabo', name: 'USABO – USA Biology Olympiad', type: 'Competition', deadline: 'January', diff: 'Elite', desc: 'National biology competition. Top performers gain recognition for research programs and medical schools.', url: 'https://www.usabo-trc.org/' },
  { id: 'nih_sip', name: 'NIH Summer Internship Program', type: 'Research', deadline: 'February', diff: 'Competitive', desc: '8-week paid research at NIH Bethesda campus. Exceptional for applications.', url: 'https://www.training.nih.gov/programs/sip' },
  { id: 'simons', name: 'Simons Summer Research Program', type: 'Research', deadline: 'January', diff: 'Competitive', desc: '7-week research at Stony Brook University with $3,000 stipend.', url: 'https://www.simonsfoundation.org/' },
  { id: 'hosa', name: 'HOSA Future Health Professionals', type: 'Competition', deadline: 'Varies', diff: 'Open', desc: 'Compete in 60+ healthcare categories. Great for leadership development.', url: 'https://hosa.org/' },
  { id: 'amsa', name: 'AMSA Premed Scholarship', type: 'Scholarship', deadline: 'May', diff: 'Competitive', desc: 'American Medical Student Association annual awards for premeds.', url: 'https://www.amsa.org/' },
  { id: 'rsna', name: 'RSNA Medical Student Symposium', type: 'Conference', deadline: 'October', diff: 'Open', desc: 'Annual radiology conference with free student registration and networking.', url: 'https://www.rsna.org/' },
  { id: 'shadowing', name: 'Clinical Shadowing (100+ hrs)', type: 'Clinical', deadline: 'Ongoing', diff: 'Open', desc: 'Shadow physicians in your target specialty. Required for most medical school applications.', url: '#' },
  { id: 'volunteering', name: 'Hospital / Free Clinic Volunteering', type: 'Volunteering', deadline: 'Ongoing', diff: 'Open', desc: 'Direct patient contact at local hospital, free clinic, or hospice. Shows service orientation.', url: '#' },
];

/* ═══════════════════════════════════════════════════════════════════
   E-LIBRARY
═══════════════════════════════════════════════════════════════════ */
const ELIB = [
  { cat: 'Bio/Biochem', title: 'Khan Academy – Biomolecules', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', type: 'Video Series', free: true, desc: 'Complete coverage of proteins, enzymes, metabolism, and cell biology.' },
  { cat: 'Bio/Biochem', title: 'Crash Course Biology', url: 'https://www.youtube.com/playlist?list=PL3EED4C1D684D3ADF', type: 'YouTube', free: true, desc: 'Fast-paced, visual biology covering all MCAT Bio content.' },
  { cat: 'Bio/Biochem', title: 'Khan Academy – MCAT Organ Systems', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', type: 'Video Series', free: true, desc: 'All organ systems: cardiovascular, respiratory, renal, immune, endocrine.' },
  { cat: 'Chem/Phys', title: 'Khan Academy – Physical Processes', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', type: 'Video Series', free: true, desc: 'Physics and general chemistry for the MCAT, with practice.' },
  { cat: 'Chem/Phys', title: 'Professor Dave Explains – Organic Chemistry', url: 'https://www.youtube.com/@ProfessorDaveExplains', type: 'YouTube', free: true, desc: 'Clear, detailed walkthroughs of organic chemistry mechanisms.' },
  { cat: 'Chem/Phys', title: 'The Organic Chemistry Tutor', url: 'https://www.youtube.com/@TheOrganicChemistryTutor', type: 'YouTube', free: true, desc: 'Massive library of worked chemistry problems for the MCAT.' },
  { cat: 'Psych/Soc', title: 'Khan Academy – Psychological & Social Sciences', url: 'https://www.khanacademy.org/test-prep/mcat/social-sciences', type: 'Video Series', free: true, desc: 'All MCAT Psych/Soc topics covered systematically.' },
  { cat: 'Psych/Soc', title: 'Crash Course Psychology', url: 'https://www.youtube.com/playlist?list=PL8dPuuaLjXtOPRKzVLY0jT3gy-7NFgCnz', type: 'YouTube', free: true, desc: 'Comprehensive psychology series from Hank Green.' },
  { cat: 'Psych/Soc', title: 'Crash Course Sociology', url: 'https://www.youtube.com/playlist?list=PL8dPuuaLjXtOGriz-x5pXWmgDBqLanNmH', type: 'YouTube', free: true, desc: 'Sociology for MCAT: stratification, race, gender, socialization.' },
  { cat: 'All', title: 'Anki MCAT Decks (Top-Rated)', url: 'https://www.ankiweb.net/', type: 'Flashcards', free: true, desc: 'Community MCAT decks for spaced-repetition review.' },
  { cat: 'All', title: 'AAMC Official Full-Length Practice Exams', url: 'https://www.aamc.org/students/applying/mcat/preparing/', type: 'Practice Exams', free: false, desc: 'The gold standard — most predictive of actual MCAT score.' },
  { cat: 'All', title: 'MCAT Reddit Community Wiki', url: 'https://www.reddit.com/r/Mcat/wiki/', type: 'Community', free: true, desc: 'Curated community wiki with score improvement strategies and resource rankings.' },
];

/* ═══════════════════════════════════════════════════════════════════
   MMI QUESTIONS
═══════════════════════════════════════════════════════════════════ */
const MMI_QS = [
  { q: "A patient refuses a life-saving blood transfusion on religious grounds. They are conscious and competent. What do you do?", type: 'Ethics' },
  { q: 'Tell me about a significant failure or setback. What did you learn from it?', type: 'Personal' },
  { q: 'How would you address healthcare disparities in underserved communities?', type: 'Policy' },
  { q: 'A colleague appears impaired during a hospital shift. How do you handle this?', type: 'Professionalism' },
  { q: 'Why do you want to be a physician rather than a nurse practitioner or PA?', type: 'Motivation' },
  { q: 'Describe a time you advocated for someone. What was the outcome?', type: 'Leadership' },
  { q: 'How would you care for a patient who distrusts Western medicine?', type: 'Cultural Competency' },
  { q: 'What does it mean to be a good doctor in 2025?', type: 'Reflection' },
  { q: "A 17-year-old patient asks you not to share her diagnosis with her parents. What do you do?", type: 'Ethics' },
  { q: 'Describe your greatest non-academic achievement and its impact on others.', type: 'Personal' },
  { q: 'Healthcare costs in the US are highest in the world but outcomes lag. What is the root cause?', type: 'Healthcare Systems' },
  { q: 'A patient with terminal cancer asks what you would do in their situation. How do you respond?', type: 'End-of-Life' },
];

/* ═══════════════════════════════════════════════════════════════════
   MED SCHOOL DATA
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
const QuizEngine = memo(({ questions, onFinish, title, onBack }) => {
  const [qi, setQi] = useState(0);
  const [sel, setSel] = useState(null);
  const [confirmed, setConf] = useState(false);
  const [score, setScore] = useState(0);
  const LETTERS = ['A', 'B', 'C', 'D'];

  const q = questions[qi];
  const handleConfirm = useCallback(() => {
    if (sel !== null) { setConf(true); if (sel === q.ans) setScore(s => s + 1); }
  }, [sel, q]);

  const handleNext = useCallback(() => {
    const newScore = score + (sel === q.ans ? 1 : 0);
    if (qi + 1 >= questions.length) { onFinish(newScore, questions.length); }
    else { setQi(i => i + 1); setSel(null); setConf(false); }
  }, [qi, score, sel, q, questions.length, onFinish]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        {onBack && (
          <button onClick={onBack} className="text-gray-500 hover:text-white text-sm transition">
            ← Back
          </button>
        )}
        {title && <p className="text-xs font-bold text-blue-400 uppercase tracking-widest flex-1 text-center">{title}</p>}
        <span className="text-xs text-gray-500">{qi + 1} / {questions.length}</span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-1 mb-6">
        <div className="h-1 rounded-full bg-blue-500 transition-all" style={{ width: `${(qi / questions.length) * 100}%` }} />
      </div>
      <div className="bg-white/5 border border-white/10 rounded-[28px] p-8">
        <div className="flex justify-between items-center mb-6">
          <span className="text-xs text-gray-500">Question {qi + 1} of {questions.length}</span>
          <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">{q.cat}</span>
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
                <span className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold mt-0.5 ${sel === i && !confirmed ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                  {confirmed && i === q.ans ? '✓' : confirmed && i === sel ? '✗' : LETTERS[i]}
                </span>
                <MixedText t={c} />
              </button>
            );
          })}
        </div>
        {confirmed && (
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl mb-6">
            <p className="text-xs font-bold text-white mb-2">Explanation</p>
            <p className="text-sm text-gray-300 leading-relaxed"><MixedText t={q.exp} /></p>
          </div>
        )}
        {!confirmed
          ? <button onClick={handleConfirm} disabled={sel === null} className="w-full py-4 bg-white text-black font-black rounded-xl hover:bg-blue-100 transition disabled:opacity-30 disabled:cursor-not-allowed">Confirm Answer</button>
          : <button onClick={handleNext} className="w-full py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-500 transition">{qi + 1 >= questions.length ? 'See Results →' : 'Next Question →'}</button>
        }
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   PORTFOLIO ADDER SUB-COMPONENT
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
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Activity name..."
        className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500/40 text-gray-200 placeholder:text-gray-700 mb-2" />
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

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
export default function App() {
  const [tab, setTab] = useState('home');
  const [user, setUser] = useState(() => {
    const stored = ls.get('msp_user', { name: '', specialty: null, xp: 0, streak: 0, lastActive: null });
    if (!stored.name) {
      try { const s = JSON.parse(localStorage.getItem('msp_session') || 'null'); if (s?.name) stored.name = s.name; } catch { }
    }
    return stored;
  });
  const [pathway, setPathway] = useState(() => ls.get('msp_pathway', {}));
  const [flashDecks, setFlashDecks] = useState(() => ls.get('msp_flash', {}));
  const [portfolio, setPortfolio] = useState(() => ls.get('msp_port', []));
  const [catPerf, setCatPerf] = useState(() => ls.get('msp_catperf', {}));

  // Sub-views
  const [activeUnit, setActiveUnit] = useState(null);
  const [activeMasteryQs, setActiveMasteryQs] = useState(null);
  const [diagnosticStep, setDiagStep] = useState(0);
  const [diagAnswers, setDiagAnswers] = useState({});
  const [diagDone, setDiagDone] = useState(false);
  const [quizResults, setQuizResults] = useState(null);

  // Settings
  const [settingsName, setSettingsName] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // AI Coach
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: "Hello! I'm MetaBrain, your dedicated MCAT coach. Ask me anything — from enzyme kinetics to MMI interview prep. What shall we tackle today?" }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const msgsEndRef = useRef(null);

  // Flashcards
  const [flashInput, setFlashInput] = useState('');
  const [flashLoading, setFlashLoading] = useState(false);
  const [activeDeck, setActiveDeck] = useState(null);
  const [cardIdx, setCardIdx] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  // E-Library
  const [libSearch, setLibSearch] = useState('');
  const [libCat, setLibCat] = useState('All');

  // Interview
  const [interviewQ, setInterviewQ] = useState(null);
  const [interviewAnswer, setInterviewAnswer] = useState('');
  const [interviewFeedback, setInterviewFeedback] = useState('');
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewType, setInterviewType] = useState('All');

  // Admissions
  const [gpa, setGpa] = useState('');
  const [mcat, setMcat] = useState('');
  const [clinicalHrs, setClinicalHrs] = useState('');
  const [volunteerHrs, setVolunteerHrs] = useState('');
  const [hasResearch, setHasResearch] = useState(false);
  const [calcResults, setCalcResults] = useState(null);

  // Quiz Library
  const [quizLibCat, setQuizLibCat] = useState('All');
  const [quizSearch, setQuizSearch] = useState('');
  const [activeLibQuiz, setActiveLibQuiz] = useState(null);

  // Pomodoro
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60);
  const [onBreak, setOnBreak] = useState(false);
  const pomodoroRef = useRef(null);

  // Persistence
  useEffect(() => { ls.set('msp_user', user); }, [user]);
  useEffect(() => { ls.set('msp_pathway', pathway); }, [pathway]);
  useEffect(() => { ls.set('msp_flash', flashDecks); }, [flashDecks]);
  useEffect(() => { ls.set('msp_port', portfolio); }, [portfolio]);
  useEffect(() => { ls.set('msp_catperf', catPerf); }, [catPerf]);
  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  // Daily Streak
  useEffect(() => {
    const today = new Date().toDateString();
    if (user.lastActive === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    setUser(u => ({ ...u, streak: u.lastActive === yesterday ? (u.streak || 0) + 1 : 1, lastActive: today }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pomodoro Timer
  useEffect(() => {
    if (pomodoroActive) {
      pomodoroRef.current = setInterval(() => {
        setPomodoroTimeLeft(t => {
          if (t <= 1) { clearInterval(pomodoroRef.current); setPomodoroActive(false); setOnBreak(b => !b); return onBreak ? 25 * 60 : 5 * 60; }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(pomodoroRef.current);
  }, [pomodoroActive, onBreak]);

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const signOut = useCallback(() => {
    ['msp_session', 'msp_user', 'msp_pathway', 'msp_flash', 'msp_port', 'msp_catperf'].forEach(k => localStorage.removeItem(k));
    window.location.replace('/');
  }, []);

  // Diagnostic Logic
  const handleDiagAnswer = (qIdx, optIdx) => {
    const newAnswers = { ...diagAnswers, [qIdx]: optIdx };
    setDiagAnswers(newAnswers);
    if (qIdx + 1 >= DIAGNOSTIC_QS.length) {
      const scores = { surgery: 0, internal: 0, pediatrics: 0, psychiatry: 0, research: 0 };
      Object.entries(newAnswers).forEach(([qi, oi]) => {
        const wq = DIAGNOSTIC_QS[parseInt(qi)];
        Object.keys(scores).forEach(sp => { scores[sp] += wq.w[sp][oi] || 0; });
      });
      const specialty = Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0];
      setUser(u => ({ ...u, specialty, xp: u.xp + 100 }));
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

  // Pathway Logic
  const currentPath = user.specialty ? PATHS[user.specialty] : null;

  const completeLesson = (unitId, lessonId) => {
    setPathway(prev => ({
      ...prev,
      [unitId]: { ...prev[unitId], lessonsComplete: [...new Set([...(prev[unitId]?.lessonsComplete || []), lessonId])] }
    }));
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
      if (passed && currentPath) {
        const units = currentPath.units;
        const idx = units.findIndex(u => u.id === unit.id);
        if (idx + 1 < units.length) {
          up[units[idx + 1].id] = { ...up[units[idx + 1].id], unlocked: true, lessonsComplete: up[units[idx + 1].id]?.lessonsComplete || [] };
        }
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

  // AI Helpers
  const callAI = async (systemPrompt, userMsg) => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: systemPrompt, message: userMsg })
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.content || 'No response received.';
  };

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const newMsgs = [...msgs, { role: 'user', content: chatInput }];
    setMsgs(newMsgs); setChatInput(''); setChatLoading(true);
    const context = user.specialty ? `The student is on the ${PATHS[user.specialty]?.label} pathway with ${user.xp} XP.` : '';
    try {
      const reply = await callAI(`You are MetaBrain, an elite MCAT coach for MedSchoolPrep. Be concise, high-yield, and use mnemonics when helpful. ${context}`, chatInput);
      setMsgs([...newMsgs, { role: 'assistant', content: reply }]);
    } catch {
      setMsgs([...newMsgs, { role: 'assistant', content: '⚠️ Could not reach the AI. Please ensure ANTHROPIC_API_KEY is set in your Vercel environment variables.' }]);
    }
    setChatLoading(false);
  }, [chatInput, chatLoading, msgs, user]);

  const generateFlashcards = async () => {
    if (!flashInput.trim() || flashLoading) return;
    setFlashLoading(true);
    try {
      const reply = await callAI('You are a medical flashcard generator. Given notes, return ONLY a JSON array of objects with "front" and "back" keys. No preamble, no markdown fences. Generate 8-12 cards.', flashInput);
      const cards = JSON.parse(reply.replace(/```json|```/g, '').trim());
      const deckName = `Deck ${Object.keys(flashDecks).length + 1}`;
      setFlashDecks(prev => ({ ...prev, [deckName]: cards }));
      setActiveDeck(deckName); setCardIdx(0); setCardFlipped(false); setFlashInput('');
    } catch { alert('Could not generate flashcards. Check your /api/ai endpoint or try again.'); }
    setFlashLoading(false);
  };

  const getInterviewFeedback = async () => {
    if (!interviewAnswer.trim() || interviewLoading) return;
    setInterviewLoading(true);
    try {
      const feedback = await callAI('You are an expert medical school interview coach for MMI preparation. Give structured feedback with: STRENGTHS, AREAS TO IMPROVE, and a SCORE out of 10. Be honest but encouraging.', `Question: "${interviewQ.q}"\n\nCandidate answer: "${interviewAnswer}"`);
      setInterviewFeedback(feedback);
    } catch { setInterviewFeedback('⚠️ Could not get AI feedback. Please check your Vercel ANTHROPIC_API_KEY environment variable.'); }
    setInterviewLoading(false);
  };

  const calcAdmissions = () => {
    const g = parseFloat(gpa), m = parseInt(mcat);
    if (!g || !m || g < 2 || g > 4.0 || m < 472 || m > 528) return alert('Enter valid GPA (2.0–4.0) and MCAT (472–528)');
    const clin = parseInt(clinicalHrs) || 0, vol = parseInt(volunteerHrs) || 0;
    const results = SCHOOL_DATA.map(school => {
      const gpaGap = school.avgGPA - g, mcatGap = school.avgMCAT - m;
      let score = 0;
      if (gpaGap <= -0.2 && mcatGap <= -4) score = 3;
      else if (gpaGap <= -0.1 && mcatGap <= -2) score = 2;
      else if (gpaGap <= 0.1 && mcatGap <= 2) score = 1;
      if (clin >= 1000) score += 0.5;
      if (vol >= 200) score += 0.3;
      if (hasResearch) score += 0.3;
      const chance = score >= 2.5 ? 'Safety' : score >= 1.5 ? 'Target' : 'Reach';
      return { ...school, chance, score };
    });
    setCalcResults(results.sort((a, b) => b.score - a.score));
  };

  // Derived values
  const accent = user.specialty ? PATHS[user.specialty].accent : '#3b82f6';
  const totalXP = user.xp;
  const xpLevel = Math.floor(totalXP / 500) + 1;
  const xpProgress = (totalXP % 500) / 500 * 100;
  const unitsMastered = Object.values(pathway).filter(u => u.masteryScore !== null && u.masteryScore >= 3).length;
  const lessonsDone = Object.values(pathway).reduce((a, u) => a + (u.lessonsComplete?.length || 0), 0);

  // Nav
  const NAV = [
    { id: 'home', label: 'Home' },
    { id: 'diagnostic', label: 'Pathway Diagnostic' },
    { id: 'pathway', label: 'Learning Pathway' },
    { id: 'quiz', label: 'Quiz Library' },
    { id: 'coach', label: 'MetaBrain AI' },
    { id: 'flashcards', label: 'AI Flashcards' },
    { id: 'elibrary', label: 'E-Library' },
    { id: 'portfolio', label: 'Portfolio Builder' },
    { id: 'interview', label: 'Interview Simulator' },
    { id: 'admissions', label: 'Admissions Calc' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'settings', label: 'Settings' },
  ];

  const libCats = ['All', 'Bio/Biochem', 'Chem/Phys', 'Psych/Soc', 'MCAT Practice'];
  const filteredLib = ELIB.filter(r => (libCat === 'All' || r.cat === libCat) && (r.title.toLowerCase().includes(libSearch.toLowerCase()) || r.desc.toLowerCase().includes(libSearch.toLowerCase())));
  const libQs = quizLibCat === 'All' ? Q_BANK.slice(0, 40) : Q_BANK.filter(q => q.cat === quizLibCat).slice(0, 40);
  const filteredMMI = interviewType === 'All' ? MMI_QS : MMI_QS.filter(q => q.type === interviewType);

  const navTo = (id) => { setTab(id); setActiveUnit(null); setQuizResults(null); };

  return (
    <div className="flex h-screen w-screen bg-[#030014] text-white overflow-hidden font-sans">
      {/* ── SIDEBAR ── */}
      <aside className="w-64 shrink-0 flex flex-col bg-black/50 border-r border-white/5 overflow-y-auto">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-base shrink-0 text-white" style={{ background: accent }}>M</div>
              <div>
                <p className="font-black text-sm tracking-tight">MedSchoolPrep</p>
                <p className="text-[10px] text-gray-500">Everything App for Premeds</p>
              </div>
            </div>
            <button onClick={signOut} title="Sign out"
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 flex items-center justify-center transition group">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-gray-500 group-hover:text-red-400 transition">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
          {user.name && <p className="text-[11px] text-gray-500 mb-3 truncate">Hey, <span className="text-gray-300 font-semibold">{user.name.split(' ')[0]}</span></p>}
          <div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>Level {xpLevel}</span>
              <span>{totalXP % 500} / 500 XP</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${xpProgress}%`, background: accent }} />
            </div>
          </div>
        </div>
        {user.specialty && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2" style={{ borderColor: `${accent}40`, color: accent, background: `${accent}10` }}>
            <span>{PATHS[user.specialty].icon}</span>
            <span>{PATHS[user.specialty].label} Path</span>
          </div>
        )}
        <nav className="flex-1 p-3 space-y-0.5 mt-2">
          {NAV.map(item => (
            <button key={item.id} onClick={() => navTo(item.id)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all ${tab === item.id ? 'bg-white/10 text-white font-semibold border border-white/10' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`}>
              {item.label}
            </button>
          ))}
        </nav>
        {/* Pomodoro */}
        <div className="p-4 border-t border-white/5">
          <div className="bg-white/5 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{onBreak ? 'Break' : 'Focus'}</span>
              <button onClick={() => { setPomodoroActive(a => !a); if (!pomodoroActive) setPomodoroTimeLeft(onBreak ? 5 * 60 : 25 * 60); }}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20">
                {pomodoroActive ? 'Pause' : 'Start'}
              </button>
            </div>
            <p className="text-2xl font-black text-center tracking-widest" style={{ color: accent }}>{fmtTime(pomodoroTimeLeft)}</p>
            {onBreak && <p className="text-[10px] text-center text-emerald-400 mt-1">Great work! Take a break.</p>}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="pointer-events-none fixed top-0 right-0 w-[600px] h-[600px] rounded-full blur-[150px] opacity-10 transition-all" style={{ background: accent }} />
        <div className="max-w-5xl mx-auto p-8">

          {/* ════ HOME ════ */}
          {tab === 'home' && (
            <div>
              <div className="mb-8">
                <h1 className="text-4xl font-black mb-1">Hello, {user.name ? user.name.split(' ')[0] : 'Future Doctor'} 👋</h1>
                <p className="text-gray-500">{user.specialty ? `You're on the ${PATHS[user.specialty].label} path. Keep going!` : 'Start with the Pathway Diagnostic to get your personalized learning plan.'}</p>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total XP', val: totalXP.toLocaleString(), color: '#f59e0b' },
                  { label: 'Level', val: xpLevel, color: '#3b82f6' },
                  { label: 'Day Streak', val: `${user.streak || 1}`, color: '#ef4444' },
                  { label: 'Units Mastered', val: unitsMastered, color: '#10b981' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.val}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => navTo(user.specialty ? 'pathway' : 'diagnostic')} className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-blue-500/40 hover:bg-blue-500/5 transition">
                  <h3 className="font-bold mb-1">{user.specialty ? 'Continue Learning Path' : 'Take the Pathway Diagnostic'}</h3>
                  <p className="text-sm text-gray-500">{user.specialty ? `${PATHS[user.specialty].label} – resume where you left off` : 'Discover your ideal specialty path in 10 questions'}</p>
                </button>
                <button onClick={() => navTo('coach')} className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-violet-500/40 hover:bg-violet-500/5 transition">
                  <h3 className="font-bold mb-1">Ask MetaBrain AI</h3>
                  <p className="text-sm text-gray-500">Get personalized AI tutoring on any MCAT concept</p>
                </button>
                <button onClick={() => navTo('quiz')} className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-emerald-500/40 hover:bg-emerald-500/5 transition">
                  <h3 className="font-bold mb-1">Quiz Library</h3>
                  <p className="text-sm text-gray-500">Practice MCAT questions across all tested categories</p>
                </button>
                <button onClick={() => navTo('admissions')} className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-amber-500/40 hover:bg-amber-500/5 transition">
                  <h3 className="font-bold mb-1">Admissions Calculator</h3>
                  <p className="text-sm text-gray-500">See your odds at top medical schools</p>
                </button>
              </div>
            </div>
          )}

          {/* ════ DIAGNOSTIC ════ */}
          {tab === 'diagnostic' && !diagDone && (
            <div>
              <h1 className="text-3xl font-black mb-2">Pathway Diagnostic</h1>
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
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl" style={{ background: `${PATHS[user.specialty].accent}20`, border: `1px solid ${PATHS[user.specialty].accent}40` }}>
                {PATHS[user.specialty].icon}
              </div>
              <h1 className="text-3xl font-black mb-3">Your Path: {PATHS[user.specialty].label}</h1>
              <p className="text-gray-400 mb-2">{PATHS[user.specialty].tagline}</p>
              <p className="text-sm text-gray-600 mb-8">You earned 100 XP for completing the diagnostic!</p>
              <button onClick={() => navTo('pathway')} className="px-8 py-4 rounded-2xl font-black text-white text-lg transition hover:opacity-80" style={{ background: PATHS[user.specialty].accent }}>
                Begin My Learning Path →
              </button>
            </div>
          )}

          {/* ════ LEARNING PATHWAY ════ */}
          {tab === 'pathway' && !activeUnit && !quizResults && (
            <div>
              {!user.specialty ? (
                <div className="text-center py-20">
                  <h2 className="text-2xl font-bold mb-3">No Pathway Assigned Yet</h2>
                  <p className="text-gray-500 mb-6">Complete the diagnostic to get your personalized learning path.</p>
                  <button onClick={() => navTo('diagnostic')} className="px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition">Take the Diagnostic →</button>
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
                      const lessonsDoneCount = state.lessonsComplete?.length || 0;
                      const mastered = state.masteryScore !== null && state.masteryScore >= unit.req;
                      const lessonPct = Math.round((lessonsDoneCount / unit.lessons.length) * 100);
                      const masteryPct = state.masteryScore !== null ? Math.round((state.masteryScore / unit.masteryTotal) * 100) : 0;
                      return (
                        <div key={unit.id} className={`border rounded-[24px] overflow-hidden transition-all ${state.unlocked ? PATHS[user.specialty].border : 'border-white/5'} ${!state.unlocked && 'opacity-50'}`} style={{ background: 'rgba(8,8,20,0.5)' }}>
                          <div className="p-6 flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-black border text-lg ${mastered ? 'border-emerald-500/50 bg-emerald-500/20' : state.unlocked ? PATHS[user.specialty].border : 'border-white/10 bg-white/5'}`}>
                              {mastered ? '✓' : state.unlocked ? idx + 1 : '🔒'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h3 className="font-bold truncate">{unit.title}</h3>
                                {mastered && <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full shrink-0">MASTERED</span>}
                              </div>
                              <p className="text-sm text-gray-500">{unit.desc}</p>
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-xs text-gray-600">{lessonsDoneCount}/{unit.lessons.length} lessons</span>
                                {state.masteryScore !== null && <span className="text-xs text-gray-600">Score: {state.masteryScore}/{unit.masteryTotal}</span>}
                                <span className="text-xs font-bold" style={{ color: PATHS[user.specialty].accent }}>+{unit.xp} XP</span>
                              </div>
                              <div className="h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
                                <div className="h-1 rounded-full transition-all" style={{ width: `${state.masteryScore !== null ? masteryPct : lessonPct}%`, background: mastered ? '#10b981' : PATHS[user.specialty].accent }} />
                              </div>
                            </div>
                            {state.unlocked && (
                              <button onClick={() => setActiveUnit({ unit, mode: 'lesson' })}
                                className="shrink-0 px-5 py-2 rounded-xl text-sm font-black text-white transition hover:opacity-80"
                                style={{ background: PATHS[user.specialty].accent }}>
                                {lessonsDoneCount === unit.lessons.length ? 'Review' : 'Study →'}
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
                          <a href={lesson.yt} target="_blank" rel="noreferrer" className="px-3 py-2 bg-red-500/15 border border-red-500/25 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/25 transition">YouTube ↗</a>
                          <a href={lesson.url} target="_blank" rel="noreferrer" className="px-3 py-2 bg-white/10 rounded-xl text-xs font-bold hover:bg-white/20 transition">Khan ↗</a>
                          {!done ? (
                            <button onClick={() => completeLesson(activeUnit.unit.id, lesson.id)} className="px-3 py-2 bg-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-500 transition">Mark Done</button>
                          ) : (
                            <span className="px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">Done ✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-gradient-to-r from-white/10 to-transparent border border-white/10 rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-lg mb-1">Mastery Check</h3>
                  <p className="text-sm text-gray-400">Score {activeUnit.unit.req}/{activeUnit.unit.masteryTotal} to master this unit and unlock the next.</p>
                </div>
                <button onClick={() => startMasteryCheck(activeUnit.unit)}
                  className="px-6 py-3 rounded-xl font-black text-white transition hover:opacity-80"
                  style={{ background: PATHS[user.specialty]?.accent || '#3b82f6' }}>
                  Begin Check →
                </button>
              </div>
            </div>
          )}

          {tab === 'pathway' && activeUnit?.mode === 'mastery' && activeMasteryQs && (
            <QuizEngine questions={activeMasteryQs} title={`Mastery Check — ${activeUnit.unit.title}`}
              onBack={() => { setActiveUnit(null); setActiveMasteryQs(null); }}
              onFinish={(s, t) => finishMasteryCheck(s, t, activeUnit.unit)} />
          )}

          {tab === 'pathway' && quizResults && (
            <div className="text-center max-w-md mx-auto pt-12">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl ${quizResults.passed ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-blue-500/10 border border-blue-500/20'}`}>
                {quizResults.passed ? '🎉' : '📚'}
              </div>
              <h1 className="text-3xl font-black mb-3">{quizResults.passed ? 'Unit Mastered!' : 'Keep Practicing!'}</h1>
              <p className="text-5xl font-black mb-2">{quizResults.score}/{quizResults.total}</p>
              <p className="text-gray-500 mb-2">Needed {quizResults.unit.req}/{quizResults.unit.masteryTotal} to pass</p>
              <p className={`text-sm font-bold mb-8 ${quizResults.passed ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {quizResults.passed ? `+${quizResults.unit.xp} XP earned! Next unit unlocked.` : `+${Math.floor(quizResults.unit.xp * 0.3)} XP — review lessons and try again.`}
              </p>
              <button onClick={() => setQuizResults(null)} className="px-8 py-4 bg-white/10 border border-white/10 rounded-2xl font-bold hover:bg-white/20 transition">Return to Pathway</button>
            </div>
          )}

          {/* ════ QUIZ LIBRARY ════ */}
          {tab === 'quiz' && (
            <div>
              {activeLibQuiz ? (
                <div>
                  <QuizEngine questions={activeLibQuiz} title="Quiz Library"
                    onBack={() => setActiveLibQuiz(null)}
                    onFinish={() => setActiveLibQuiz(null)} />
                </div>
              ) : (
                <div>
                  <h1 className="text-3xl font-black mb-2">Quiz Library</h1>
                  <p className="text-gray-500 mb-6">Practice MCAT questions across all tested categories.</p>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {['All', 'Bio/Biochem', 'Chem/Phys', 'Psych/Soc'].map(c => (
                      <button key={c} onClick={() => setQuizLibCat(c)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${quizLibCat === c ? 'bg-white text-black border-white' : 'border-white/20 text-gray-400 hover:border-white/40'}`}>{c}</button>
                    ))}
                  </div>
                  <div className="relative mb-5">
                    <input value={quizSearch} onChange={e => setQuizSearch(e.target.value)} placeholder="Search questions..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-4 py-2.5 text-sm outline-none focus:border-blue-500/50 placeholder:text-gray-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[0, 1, 2, 3, 4, 5].map(setIdx => {
                      const filtered = libQs.filter(q => quizSearch ? q.text.toLowerCase().includes(quizSearch.toLowerCase()) : true);
                      const qs = filtered.slice(setIdx * 5, setIdx * 5 + 5).filter(Boolean);
                      if (!qs.length) return null;
                      const names = ['Biochemistry Essentials', 'Cardiovascular Physics', 'Genetic & Molecular Biology', 'Psychosocial & Behavior', 'Organic Chemistry', 'Electrochemistry & Equilibria'];
                      return (
                        <div key={setIdx} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-blue-500/30 transition">
                          <div className="text-xs font-bold text-blue-400 mb-1">{qs[0]?.cat || 'Mixed'}</div>
                          <h3 className="font-bold mb-4">{names[setIdx] || `Practice Set ${setIdx + 1}`}</h3>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">{qs.length} questions</span>
                            <button onClick={() => setActiveLibQuiz(qs)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition">Start →</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ AI COACH ════ */}
          {tab === 'coach' && (
            <div className="flex flex-col h-[calc(100vh-8rem)]">
              <h1 className="text-3xl font-black mb-6">MetaBrain AI Coach</h1>
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
                      <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />)}</div>
                    </div>
                  </div>
                )}
                <div ref={msgsEndRef} />
              </div>
              <div className="mt-4">
                <div className="flex gap-2 mb-3 flex-wrap">
                  {['Explain the Nernst equation', 'How does the lac operon work?', 'MMI tips for ethics stations', 'Glycolysis high-yield facts'].map(p => (
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

          {/* ════ FLASHCARDS ════ */}
          {tab === 'flashcards' && (
            <div>
              <h1 className="text-3xl font-black mb-2">AI Flashcards</h1>
              <p className="text-gray-500 mb-8">Paste your notes and let MetaBrain generate high-yield flashcard decks.</p>
              {activeDeck && flashDecks[activeDeck] ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <button onClick={() => setActiveDeck(null)} className="text-gray-500 hover:text-white text-sm transition">← All Decks</button>
                    <span className="text-xs text-gray-500">{cardIdx + 1} / {flashDecks[activeDeck].length}</span>
                  </div>
                  <div className="flex justify-center mb-6 cursor-pointer" onClick={() => setCardFlipped(f => !f)}>
                    <div className="w-full max-w-lg h-56" style={{ perspective: '1000px' }}>
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
                          <p className="font-bold text-sm mb-1">{name}</p>
                          <p className="text-xs text-gray-500">{flashDecks[name].length} cards</p>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h3 className="font-bold mb-4">Generate New Deck from Notes</h3>
                    <textarea value={flashInput} onChange={e => setFlashInput(e.target.value)}
                      placeholder="Paste your study notes here... MetaBrain will extract 8-12 high-yield flashcards."
                      rows={6} className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-blue-500/50 text-gray-300 placeholder:text-gray-700 resize-none mb-4" />
                    <button onClick={generateFlashcards} disabled={flashLoading || !flashInput.trim()}
                      className="px-6 py-3 bg-blue-600 rounded-xl font-bold text-sm hover:bg-blue-500 disabled:opacity-40 transition">
                      {flashLoading ? 'Generating...' : 'Generate Flashcards with AI'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ E-LIBRARY ════ */}
          {tab === 'elibrary' && (
            <div>
              <h1 className="text-3xl font-black mb-2">E-Library</h1>
              <p className="text-gray-500 mb-6">Curated, high-quality MCAT resources — all in one place.</p>
              <div className="flex gap-2 mb-4 flex-wrap">
                {libCats.map(c => (
                  <button key={c} onClick={() => setLibCat(c)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${libCat === c ? 'bg-white text-black border-white' : 'border-white/20 text-gray-400 hover:border-white/40'}`}>{c}</button>
                ))}
              </div>
              <div className="relative mb-6">
                <input value={libSearch} onChange={e => setLibSearch(e.target.value)} placeholder="Search resources..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500/50 placeholder:text-gray-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {filteredLib.map((r, i) => (
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
              {filteredLib.length === 0 && <p className="text-center text-gray-600 py-12">No resources match your search.</p>}
            </div>
          )}

          {/* ════ PORTFOLIO BUILDER ════ */}
          {tab === 'portfolio' && (
            <div>
              <h1 className="text-3xl font-black mb-2">Portfolio Builder</h1>
              <p className="text-gray-500 mb-8">Track your activities and discover opportunities to strengthen your application.</p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-bold mb-4">My Activities</h2>
                  <div className="space-y-3 mb-4">
                    {portfolio.length === 0 ? (
                      <div className="border border-dashed border-white/10 rounded-2xl p-6 text-center"><p className="text-gray-600 text-sm">Add activities to build your timeline</p></div>
                    ) : portfolio.map((a, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                        <div><p className="font-bold text-sm">{a.title}</p><p className="text-xs text-gray-500">{a.type} · {a.date}</p></div>
                        <button onClick={() => setPortfolio(p => p.filter((_, j) => j !== i))} className="text-red-400/60 hover:text-red-400 text-xs">Remove</button>
                      </div>
                    ))}
                  </div>
                  <PortfolioAdder onAdd={(a) => setPortfolio(p => [...p, a])} />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-4">Opportunities</h2>
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
                            <button onClick={() => setPortfolio(p => [...p, { title: op.name, type: op.type, date: op.deadline }])} className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-lg hover:bg-white/20 transition">+ Add</button>
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

          {/* ════ INTERVIEW SIMULATOR ════ */}
          {tab === 'interview' && (
            <div>
              <h1 className="text-3xl font-black mb-2">MMI Interview Simulator</h1>
              <p className="text-gray-500 mb-6">Practice medical school Multiple Mini Interview questions with AI feedback.</p>
              {!interviewQ ? (
                <div>
                  <div className="flex gap-2 mb-5 flex-wrap">
                    {['All', 'Ethics', 'Personal', 'Policy', 'Professionalism', 'Motivation', 'Leadership', 'Cultural Competency', 'Reflection', 'Healthcare Systems', 'End-of-Life'].map(t => (
                      <button key={t} onClick={() => setInterviewType(t)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${interviewType === t ? 'bg-white text-black border-white' : 'border-white/20 text-gray-400 hover:border-white/40'}`}>{t}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {filteredMMI.map((q, i) => (
                      <button key={i} onClick={() => { setInterviewQ(q); setInterviewAnswer(''); setInterviewFeedback(''); }}
                        className="p-5 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-violet-500/40 hover:bg-violet-500/5 transition group">
                        <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full inline-block mb-3">{q.type}</span>
                        <p className="text-sm font-medium text-gray-300 group-hover:text-white transition">{q.q}</p>
                      </button>
                    ))}
                  </div>
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
                    {interviewLoading ? 'Analyzing...' : 'Get AI Feedback'}
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

          {/* ════ ADMISSIONS CALCULATOR ════ */}
          {tab === 'admissions' && (
            <div>
              <h1 className="text-3xl font-black mb-2">Admissions Calculator</h1>
              <p className="text-gray-500 mb-8">Compare your profile against top medical schools.</p>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                  <h3 className="font-bold mb-2">Your Profile</h3>
                  {[
                    { l: 'Cumulative GPA', v: gpa, fn: setGpa, ph: '3.85', type: 'number', step: '0.01', min: '2', max: '4' },
                    { l: 'MCAT Score (472–528)', v: mcat, fn: setMcat, ph: '514', type: 'number', min: '472', max: '528' },
                    { l: 'Clinical Hours', v: clinicalHrs, fn: setClinicalHrs, ph: '1200', type: 'number' },
                    { l: 'Volunteer Hours', v: volunteerHrs, fn: setVolunteerHrs, ph: '200', type: 'number' },
                  ].map(f => (
                    <div key={f.l}>
                      <label className="block text-xs text-gray-500 mb-1">{f.l}</label>
                      <input type={f.type} value={f.v} onChange={e => f.fn(e.target.value)} placeholder={f.ph} step={f.step} min={f.min} max={f.max}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 text-sm" />
                    </div>
                  ))}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasResearch} onChange={e => setHasResearch(e.target.checked)} className="rounded" />
                    <span className="text-sm text-gray-400">Research experience</span>
                  </label>
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
                          <span className={`text-xs font-black px-3 py-1 rounded-full ${s.chance === 'Safety' ? 'bg-emerald-500/20 text-emerald-400' : s.chance === 'Target' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>{s.chance}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full bg-white/3 border border-dashed border-white/10 rounded-2xl flex items-center justify-center">
                      <p className="text-gray-600 text-sm">Enter your profile and click Calculate</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-700">⚠️ Estimates based on published averages. Essays, research, and other factors significantly impact outcomes.</p>
            </div>
          )}

          {/* ════ ANALYTICS ════ */}
          {tab === 'analytics' && (
            <div>
              <h1 className="text-3xl font-black mb-8">Analytics</h1>
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { label: 'Total XP Earned', val: user.xp.toLocaleString(), sub: `Level ${xpLevel}`, color: '#f59e0b' },
                  { label: 'Units Mastered', val: unitsMastered, sub: `of ${currentPath?.units?.length || 0} total`, color: '#10b981' },
                  { label: 'Lessons Completed', val: lessonsDone, sub: 'Keep going!', color: '#3b82f6' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.val}</p>
                    <p className="font-bold text-sm">{s.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
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
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="font-bold mb-6">Pathway Progress — {currentPath.label}</h3>
                  <div className="space-y-4">
                    {currentPath.units.map(unit => {
                      const state = pathway[unit.id] || { unlocked: false, lessonsComplete: [], masteryScore: null };
                      const lessonPct = Math.round(((state.lessonsComplete?.length || 0) / unit.lessons.length) * 100);
                      const masteryPct = state.masteryScore !== null ? Math.round((state.masteryScore / unit.masteryTotal) * 100) : 0;
                      return (
                        <div key={unit.id}>
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>{unit.title}</span>
                            <span>{state.masteryScore !== null ? `Mastery: ${state.masteryScore}/${unit.masteryTotal}` : `${lessonPct}% lessons`}</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${state.masteryScore !== null ? masteryPct : lessonPct}%`, background: state.unlocked ? currentPath.accent : '#374151' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ SETTINGS ════ */}
          {tab === 'settings' && (
            <div>
              <h1 className="text-3xl font-black mb-2">Settings</h1>
              <p className="text-gray-500 mb-8">Customize your MedSchoolPrep experience.</p>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-lg">
                <h3 className="font-bold mb-5">Your Profile</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Display Name</label>
                    <input
                      value={settingsName || user.name}
                      onChange={e => setSettingsName(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Current Specialty Path</label>
                    <select
                      value={user.specialty || ''}
                      onChange={e => {
                        const sp = e.target.value;
                        setUser(u => ({ ...u, specialty: sp || null }));
                        if (sp) {
                          const initPathway = {};
                          PATHS[sp].units.forEach((u, i) => { initPathway[u.id] = { unlocked: i === 0, lessonsComplete: [], masteryScore: null }; });
                          setPathway(prev => ({ ...initPathway, ...prev }));
                        }
                      }}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 text-sm">
                      <option value="">No pathway selected</option>
                      {Object.entries(PATHS).map(([id, p]) => <option key={id} value={id}>{p.icon} {p.label}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      if (settingsName.trim()) setUser(u => ({ ...u, name: settingsName.trim() }));
                      setSettingsSaved(true);
                      setTimeout(() => setSettingsSaved(false), 2000);
                    }}
                    className="w-full py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-500 transition">
                    {settingsSaved ? 'Saved! ✓' : 'Save Changes'}
                  </button>
                </div>
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h3 className="font-bold mb-3 text-red-400">Danger Zone</h3>
                  <button onClick={() => {
                    if (window.confirm('Reset all progress? This cannot be undone.')) {
                      ['msp_user', 'msp_pathway', 'msp_flash', 'msp_port', 'msp_catperf'].forEach(k => localStorage.removeItem(k));
                      window.location.reload();
                    }
                  }} className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-bold hover:bg-red-500/20 transition">
                    Reset All Progress
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
border border-white/10 rounded-[28px] flex flex-col items-center justify-center p-8 text-center" style={{backfaceVisibility:'hidden'}}>
                          <p className="text-xs text-gray-500 mb-4 uppercase tracking-widest">Front</p>
                          <p className="text-xl font-bold">{flashDecks[activeDeck][cardIdx]?.front}</p>
                        </div>
                        <div className="absolute inset-0 bg-blue-600/20 border border-blue-500/40 rounded-[28px] flex flex-col items-center justify-center p-8 text-center" style={{backfaceVisibility:'hidden',transform:'rotateY(180deg)'}}>
                          <p className="text-xs text-blue-400 mb-4 uppercase tracking-widest">Back</p>
                          <p className="text-lg text-gray-200">{flashDecks[activeDeck][cardIdx]?.back}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-xs text-gray-600 mb-6">Click card to flip</p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={()=>{setCardIdx(i=>Math.max(0,i-1));setCardFlipped(false);}} disabled={cardIdx===0} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl font-bold text-sm disabled:opacity-30 hover:bg-white/10 transition">← Prev</button>
                    <button onClick={()=>{setCardIdx(i=>Math.min(flashDecks[activeDeck].length-1,i+1));setCardFlipped(false);}} disabled={cardIdx===flashDecks[activeDeck].length-1} className="px-5 py-2.5 bg-blue-600 rounded-xl font-bold text-sm disabled:opacity-30 hover:bg-blue-500 transition">Next →</button>
                  </div>
                </div>
              ):(
                <div>
                  {Object.keys(flashDecks).length>0&&(
                    <div className="grid grid-cols-3 gap-4 mb-8">
                      {Object.keys(flashDecks).map(name=>(
                        <button key={name} onClick={()=>{setActiveDeck(name);setCardIdx(0);setCardFlipped(false);}}
                          className="p-5 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-blue-500/40 transition">
                          <p className="font-bold text-sm mb-1">{name}</p>
                          <p className="text-xs text-gray-500">{flashDecks[name].length} cards</p>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h3 className="font-bold mb-4">Generate New Deck from Notes</h3>
                    <textarea value={flashInput} onChange={e=>setFlashInput(e.target.value)}
                      placeholder="Paste your study notes here. MetaBrain will extract 8-12 high-yield flashcards."
                      rows={6} className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-blue-500/50 text-gray-300 placeholder:text-gray-700 resize-none mb-4"/>
                    <button onClick={generateFlashcards} disabled={flashLoading||!flashInput.trim()} className="px-6 py-3 bg-blue-600 rounded-xl font-bold text-sm hover:bg-blue-500 disabled:opacity-40 transition">
                      {flashLoading?'Generating...':'Generate with AI'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════ E-LIBRARY ══════ */}
          {tab==='elibrary'&&(
            <div>
              <h1 className="text-3xl font-black mb-2">E-Library</h1>
              <p className="text-gray-500 mb-6">Curated, high-quality MCAT resources — videos, articles, and practice tools.</p>
              <div className="flex gap-2 mb-4 flex-wrap">
                {['All','Bio/Biochem','Chem/Phys','Psych/Soc'].map(c=>(
                  <button key={c} onClick={()=>setLibCat(c)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${libCat===c?'bg-white text-black border-white':'border-white/20 text-gray-400 hover:border-white/40'}`}>{c}</button>
                ))}
              </div>
              <input value={libSearch} onChange={e=>setLibSearch(e.target.value)} placeholder="Search resources..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500/50 placeholder:text-gray-600 mb-5"/>
              <div className="grid grid-cols-2 gap-4">
                {filteredLib.map((r,i)=>{
                  const ytId=getYTId(r.url);
                  const isYT=r.type==='YouTube';
                  return (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-blue-500/40 transition group">
                      {/* Thumbnail */}
                      {ytId&&(
                        <button
                          onClick={()=>setVideoModal({url:r.url,title:r.title})}
                          className="relative w-full bg-black overflow-hidden block"
                          style={{paddingTop:'56.25%'}}>
                          <img
                            src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                            alt={r.title}
                            className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21"/></svg>
                            </div>
                          </div>
                        </button>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">{r.type}</span>
                          {r.free?<span className="text-[10px] font-bold text-emerald-400">FREE</span>:<span className="text-[10px] text-gray-600">Paid</span>}
                        </div>
                        <h3 className="font-bold text-sm mb-2 leading-snug group-hover:text-white transition">{r.title}</h3>
                        <p className="text-xs text-gray-500 mb-3">{r.desc}</p>
                        <div className="flex gap-2">
                          {ytId&&(
                            <button onClick={()=>setVideoModal({url:r.url,title:r.title})}
                              className="flex-1 py-2 bg-red-500/15 border border-red-500/25 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/25 transition">
                              ▶ Watch
                            </button>
                          )}
                          <a href={r.url} target="_blank" rel="noreferrer"
                            className="flex-1 py-2 bg-white/8 border border-white/15 rounded-lg text-xs font-bold text-center hover:bg-white/15 transition">
                            {isYT?'Open YouTube ↗':'Open ↗'}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredLib.length===0&&<p className="col-span-2 text-center text-gray-600 py-12">No resources match your search.</p>}
              </div>
            </div>
          )}

          {/* ══════ PORTFOLIO ══════ */}
          {tab==='portfolio'&&(
            <div>
              <h1 className="text-3xl font-black mb-2">Portfolio Builder</h1>
              <p className="text-gray-500 mb-8">Track activities and discover opportunities to strengthen your application.</p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-bold mb-4">My Activities</h2>
                  <div className="space-y-3 mb-4">
                    {portfolio.length===0?(
                      <div className="border border-dashed border-white/10 rounded-2xl p-6 text-center"><p className="text-gray-600 text-sm">Add activities to build your timeline</p></div>
                    ):portfolio.map((a,i)=>(
                      <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                        <div><p className="font-bold text-sm">{a.title}</p><p className="text-xs text-gray-500">{a.type} · {a.date}</p></div>
                        <button onClick={()=>setPortfolio(p=>p.filter((_,j)=>j!==i))} className="text-red-400/60 hover:text-red-400 text-xs">Remove</button>
                      </div>
                    ))}
                  </div>
                  <PortfolioAdder onAdd={a=>setPortfolio(p=>[...p,a])}/>
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-4">Opportunities</h2>
                  <div className="space-y-3">
                    {OPPORTUNITIES.map(op=>(
                      <div key={op.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold text-sm">{op.name}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${op.diff==='Elite'?'bg-red-500/20 text-red-400':op.diff==='Competitive'?'bg-yellow-500/20 text-yellow-400':'bg-emerald-500/20 text-emerald-400'}`}>{op.diff}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{op.desc}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-600">Deadline: {op.deadline}</span>
                          <div className="flex gap-2">
                            <button onClick={()=>setPortfolio(p=>[...p,{title:op.name,type:op.type,date:op.deadline}])} className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-lg hover:bg-white/20 transition">+ Add</button>
                            {op.url!=='#'&&<a href={op.url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-400 hover:text-blue-300">Learn ↗</a>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════ INTERVIEW ══════ */}
          {tab==='interview'&&(
            <div>
              <h1 className="text-3xl font-black mb-2">MMI Interview Simulator</h1>
              <p className="text-gray-500 mb-6">Practice Multiple Mini Interview questions with AI feedback.</p>
              {!interviewQ?(
                <div>
                  <div className="flex gap-2 mb-5 flex-wrap">
                    {['All','Ethics','Personal','Policy','Professionalism','Motivation','Leadership','Cultural Competency','Reflection','Healthcare Systems','End-of-Life'].map(t=>(
                      <button key={t} onClick={()=>setInterviewType(t)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${interviewType===t?'bg-white text-black border-white':'border-white/20 text-gray-400 hover:border-white/40'}`}>{t}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {filteredMMI.map((q,i)=>(
                      <button key={i} onClick={()=>{setInterviewQ(q);setInterviewAnswer('');setInterviewFeedback('');}}
                        className="p-5 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-violet-500/40 hover:bg-violet-500/5 transition group">
                        <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full inline-block mb-3">{q.type}</span>
                        <p className="text-sm font-medium text-gray-300 group-hover:text-white transition">{q.q}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ):(
                <div>
                  <button onClick={()=>setInterviewQ(null)} className="text-gray-500 hover:text-white text-sm mb-6 transition">← Back to Questions</button>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                    <span className="text-xs font-bold text-violet-400">{interviewQ.type}</span>
                    <h2 className="text-xl font-bold mt-2">{interviewQ.q}</h2>
                  </div>
                  <textarea value={interviewAnswer} onChange={e=>setInterviewAnswer(e.target.value)}
                    placeholder="Type your response here... (Aim for 2-3 minutes of structured content)"
                    rows={7} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm text-gray-200 outline-none focus:border-violet-500/50 placeholder:text-gray-700 resize-none mb-4"/>
                  <button onClick={getInterviewFeedback} disabled={interviewLoading||!interviewAnswer.trim()}
                    className="px-6 py-3 bg-violet-600 rounded-xl font-bold text-sm hover:bg-violet-500 disabled:opacity-40 transition mb-6">
                    {interviewLoading?'Analyzing...':'Get AI Feedback'}
                  </button>
                  {interviewFeedback&&(
                    <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-6">
                      <h3 className="font-bold mb-3 text-violet-300">AI Coach Feedback</h3>
                      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{interviewFeedback}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════ ADMISSIONS ══════ */}
          {tab==='admissions'&&(
            <div>
              <h1 className="text-3xl font-black mb-2">Admissions Calculator</h1>
              <p className="text-gray-500 mb-8">Compare your profile against top medical schools.</p>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                  <h3 className="font-bold">Your Profile</h3>
                  {[
                    {l:'Cumulative GPA',v:gpa,fn:setGpa,ph:'3.85',type:'number',step:'0.01',min:'2',max:'4'},
                    {l:'MCAT (472–528)',v:mcat,fn:setMcat,ph:'514',type:'number',min:'472',max:'528'},
                    {l:'Clinical Hours',v:clinicalHrs,fn:setClinicalHrs,ph:'1000',type:'number'},
                    {l:'Volunteer Hours',v:volunteerHrs,fn:setVolunteerHrs,ph:'200',type:'number'},
                  ].map(f=>(
                    <div key={f.l}>
                      <label className="block text-xs text-gray-500 mb-1">{f.l}</label>
                      <input type={f.type} value={f.v} onChange={e=>f.fn(e.target.value)} placeholder={f.ph} step={f.step} min={f.min} max={f.max}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 text-sm"/>
                    </div>
                  ))}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasResearch} onChange={e=>setHasResearch(e.target.checked)} className="rounded"/>
                    <span className="text-sm text-gray-400">Research experience</span>
                  </label>
                  <button onClick={calcAdmissions} className="w-full py-3 bg-amber-500 text-black font-black rounded-xl hover:bg-amber-400 transition">Calculate →</button>
                </div>
                <div className="col-span-2">
                  {calcResults?(
                    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                      {calcResults.map(s=>(
                        <div key={s.name} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-sm">{s.name}</p>
                            <p className="text-xs text-gray-500">Avg GPA {s.avgGPA} · MCAT {s.avgMCAT} · {s.acceptRate}% accept</p>
                          </div>
                          <span className={`text-xs font-black px-3 py-1 rounded-full ${s.chance==='Safety'?'bg-emerald-500/20 text-emerald-400':s.chance==='Target'?'bg-blue-500/20 text-blue-400':'bg-red-500/20 text-red-400'}`}>{s.chance}</span>
                        </div>
                      ))}
                    </div>
                  ):(
                    <div className="h-full border border-dashed border-white/10 rounded-2xl flex items-center justify-center">
                      <p className="text-gray-600 text-sm">Enter your profile and click Calculate</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-700">⚠️ Estimates based on published averages. Essays, research, and clinical experience significantly impact outcomes.</p>
            </div>
          )}

          {/* ══════ ANALYTICS ══════ */}
          {tab==='analytics'&&(
            <div>
              <h1 className="text-3xl font-black mb-8">Analytics</h1>
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  {label:'Total XP',val:user.xp.toLocaleString(),sub:`Level ${xpLevel}`,color:'#f59e0b'},
                  {label:'Units Mastered',val:unitsMastered,sub:`of ${currentPath?.units?.length||0} total`,color:'#10b981'},
                  {label:'Course Mastery',val:`${courseMastery}%`,sub:currentPath?.label||'No path yet',color:'#3b82f6'},
                ].map(s=>(
                  <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <p className="text-3xl font-black mb-1" style={{color:s.color}}>{s.val}</p>
                    <p className="font-bold text-sm">{s.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
              {Object.keys(catPerf).length>0&&(
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                  <h3 className="font-bold mb-6">Category Performance</h3>
                  <div className="space-y-5">
                    {Object.entries(catPerf).map(([cat,data])=>{
                      const avg=Math.round(data.total/data.count);
                      const color=avg>=75?'#10b981':avg>=50?'#f59e0b':'#ef4444';
                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="font-medium">{cat}</span>
                            <span style={{color}}>{avg}% avg · Last: {data.last}%</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-2 rounded-full prog-fill" style={{width:`${avg}%`,background:color}}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {currentPath&&(
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="font-bold mb-6">Unit Mastery — {currentPath.label}</h3>
                  <div className="space-y-5">
                    {currentPath.units.map(unit=>{
                      const pct=calcUnitMastery(pathway,unit);
                      return (
                        <div key={unit.id} className="flex items-center gap-4">
                          <CircularProgress pct={pct} accent={accent} size={52}/>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-sm truncate">{unit.title}</span>
                              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{pct}%</span>
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                              {unit.lessons.map(l=><MasteryDot key={l.id} level={getLessonState(pathway,unit.id,l.id).masteryLevel||0} size={20}/>)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════ SETTINGS ══════ */}
          {tab==='settings'&&(
            <div>
              <h1 className="text-3xl font-black mb-2">Settings</h1>
              <p className="text-gray-500 mb-8">Customize your MedSchoolPrep experience.</p>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-lg">
                <h3 className="font-bold mb-5">Your Profile</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Display Name</label>
                    <input value={settingsName||user.name} onChange={e=>setSettingsName(e.target.value)} placeholder="Your name"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 text-sm"/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Active Learning Path</label>
                    <select value={effectiveSpecialty||''} onChange={e=>{const sp=e.target.value;if(sp)switchPathway(sp);else setViewSpecialty(null);}}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 text-sm">
                      <option value="">No pathway selected</option>
                      {Object.entries(PATHS).map(([id,p])=><option key={id} value={id}>{p.icon} {p.label}</option>)}
                    </select>
                    {diagnosticSpecialty&&(
                      <p className="text-[10px] text-gray-600 mt-1">🎯 Diagnostic recommended: {PATHS[diagnosticSpecialty].label}</p>
                    )}
                  </div>
                  <button onClick={()=>{if(settingsName.trim())setUser(u=>({...u,name:settingsName.trim()}));setSettingsSaved(true);setTimeout(()=>setSettingsSaved(false),2000);}}
                    className="w-full py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-500 transition">
                    {settingsSaved?'Saved! ✓':'Save Changes'}
                  </button>
                </div>
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h3 className="font-bold mb-3 text-red-400">Danger Zone</h3>
                  <button onClick={()=>{if(window.confirm('Reset all progress? This cannot be undone.')){['msp_session','msp_user','msp_pathway','msp_flash','msp_port','msp_catperf','msp_view_specialty'].forEach(k=>localStorage.removeItem(k));window.location.reload();}}}
                    className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-bold hover:bg-red-500/20 transition">
                    Reset All Progress
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
