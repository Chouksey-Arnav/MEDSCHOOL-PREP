import React, { useState, useEffect, useRef, memo, useCallback } from 'react';

/* ─── AI HELPER — routes through Vercel /api/ai (server-side key) ── */
const callAI = async (system, userMsg, maxTokens = 700, fullMessages = null) => {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, message: userMsg, messages: fullMessages, maxTokens }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.content || '';
};

/* ─── localStorage ───────────────────────────────────────────────── */
const ls = {
  get:  (k, d = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set:  (k, v)        => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/* ─── ICONS ──────────────────────────────────────────────────────── */
const Icon = ({ name, size = 18, color = 'currentColor', style: styleProp }) => {
  const s = { width: size, height: size, display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...styleProp };
  const paths = {
    home:        "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
    brain:       "M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96-.44 2.5 2.5 0 01-2.96-3.08 3 3 0 01-.34-5.58 2.5 2.5 0 013.32-3.97A2.5 2.5 0 019.5 2 M14.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 004.96-.44 2.5 2.5 0 002.96-3.08 3 3 0 00.34-5.58 2.5 2.5 0 00-3.32-3.97A2.5 2.5 0 0014.5 2z",
    chat:        "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
    quiz:        "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3 M12 17h.01",
    path:        "M22 12l-4 0-3 9-6-18-3 9-4 0",
    flashcard:   "M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2z M12 9v6 M9 12h6",
    library:     "M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
    trophy:      "M8 9V2h8v7 M5 2H3v7a4 4 0 004 4h10a4 4 0 004-4V2h-2 M12 13v8 M8 21h8",
    mic:         "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8",
    chart:       "M18 20V10 M12 20V4 M6 20v-6",
    dna:         "M2 15c6.667-6 13.333 0 20-6 M9 22c1.798-3.333 5.204-3.333 7-6.5L20 2 M2 8l4 4.5 M9 2l-2 2.5 M15.5 11.5L16 15 M12 15l3 4",
    grad:        "M22 10v6 M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5",
    timer:       "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
    check:       "M20 6L9 17l-5-5",
    x:           "M18 6L6 18 M6 6l12 12",
    star:        "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    lock:        "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z M7 11V7a5 5 0 0110 0v4",
    play:        "M5 3l14 9-14 9V3z",
    arrow:       "M5 12h14 M12 5l7 7-7 7",
    back:        "M19 12H5 M12 19l-7-7 7-7",
    search:      "M21 21l-4.35-4.35 M17 11A6 6 0 105 11a6 6 0 0012 0z",
    video:       "M23 7l-7 5 7 5V7z M1 5h15a2 2 0 012 2v10a2 2 0 01-2 2H1a2 2 0 01-2-2V7a2 2 0 012-2z",
    coffee:      "M18 8h1a4 4 0 010 8h-1 M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z M6 1v3 M10 1v3 M14 1v3",
    map:         "M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z M8 2v16 M16 6v16",
    stethoscope: "M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3 M8 15v1a6 6 0 006 6 6 6 0 006-6v-4 M20 8a2 2 0 100 4 2 2 0 000-4z",
    flask:       "M9 3H5a2 2 0 00-2 2v4m6-6h10M9 3v4m0 0H7m2 0h2M7 7l-4 9a2 2 0 001.8 3h14.4a2 2 0 001.8-3L17 7",
    user:        "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
    bolt:        "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    settings:    "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
    starEmpty:   "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  };
  const d = paths[name] || paths.star;
  const isFilled = ['star', 'play', 'bolt'].includes(name);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={isFilled ? color : "none"} stroke={isFilled ? "none" : color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={s}>
      {d.split(" M ").map((seg, i) => <path key={i} d={(i === 0 ? "" : "M ") + seg} />)}
    </svg>
  );
};

const ALL_QUIZZES = [
  { id:'bb01', cat:'Bio/Biochem', title:'Enzyme Kinetics & Michaelis-Menten', diff:'Hard', qs:[
    {q:'At substrate concentration equal to Km, reaction velocity equals:', ch:['Vmax', '¼ Vmax', '½ Vmax', '¾ Vmax'], ans:2, exp:'By definition, Km is the [S] at which v = Vmax/2.'},
    {q:'A competitive inhibitor raises apparent Km and leaves Vmax:', ch:['Decreased', 'Increased', 'Unchanged', 'Doubled'], ans:2, exp:'Competitive inhibitors can be outcompeted by excess substrate, preserving Vmax.'},
    {q:'On a Lineweaver-Burk plot, a noncompetitive inhibitor changes:', ch:['Only the x-intercept', 'Only the y-intercept', 'Both intercepts', 'Neither intercept'], ans:1, exp:'Noncompetitive inhibitors decrease Vmax (raise y-intercept) without affecting Km.'},
    {q:'The kcat/Km ratio is called:', ch:['Turnover number', 'Specificity constant', 'Inhibition constant', 'Hill coefficient'], ans:1, exp:'kcat/Km reflects catalytic efficiency at low substrate concentrations.'},
    {q:'An allosteric enzyme with Hill coefficient n=2.8 shows:', ch:['Negative cooperativity', 'No cooperativity', 'Positive cooperativity', 'Competitive inhibition'], ans:2, exp:'Hill coefficient >1 indicates positive cooperativity; each substrate binding increases affinity for the next.'},
    {q:'An irreversible enzyme inhibitor forms a _____ bond with the enzyme:', ch:['Hydrogen', 'Ionic', 'Covalent', 'Hydrophobic'], ans:2, exp:'Irreversible inhibitors (e.g., organophosphates) form permanent covalent bonds with active site residues.'},
    {q:'At high [S] >> Km, enzyme kinetics become:', ch:['First-order', 'Zero-order (rate approaches Vmax)', 'Second-order', 'Mixed-order'], ans:1, exp:'When all active sites are occupied, rate is independent of [S] — zero-order kinetics.'},
    {q:'Feedback inhibition most commonly occurs when:', ch:['A substrate activates its own enzyme', 'The end product inhibits the first committed step', 'A cofactor binds the enzyme', 'The enzyme is phosphorylated by PKA'], ans:1, exp:'End-product feedback inhibition (e.g., ATCase inhibited by CTP) controls pathway flux efficiently.'},
    {q:'The induced fit model proposes:', ch:['Active site is rigid', 'Substrate changes to fit enzyme', 'Enzyme changes conformation upon substrate binding', 'Covalent bonds form between enzyme and substrate'], ans:2, exp:'Induced fit: substrate binding induces conformational change in the enzyme creating the catalytic geometry.'},
    {q:'An uncompetitive inhibitor binds only the ES complex. Its effect on Km is:', ch:['Increases Km', 'Decreases Km', 'No change', 'Doubles Km'], ans:1, exp:'Uncompetitive inhibitors decrease both apparent Km and Vmax proportionally (parallel shift on L-B plot).'},
    {q:'Isozymes are:', ch:['Enzymes with identical structures but different functions', 'Different forms of an enzyme catalyzing the same reaction', 'Enzymes requiring the same cofactor', 'Enzymes inhibited by the same inhibitor'], ans:1, exp:'Isozymes catalyze the same reaction but differ in tissue distribution, kinetics, or regulatory properties.'},
    {q:'Glucokinase (HK IV) differs from hexokinase I-III in that it:', ch:['Has low Km and is product-inhibited', 'Has high Km, not product-inhibited, inducible by insulin', 'Is present only in muscle', 'Phosphorylates fructose only'], ans:1, exp:'Glucokinase: high Km (~10mM), sigmoidal kinetics, no product inhibition, liver/pancreas specific — acts as glucose sensor.'},
    {q:'The active site accounts for approximately what fraction of enzyme amino acids?', ch:['50%', '25%', '10-15%', '1-5%'], ans:3, exp:'Active sites are relatively small, comprising only 1-5% of residues, held together by protein folding.'},
    {q:'Zymogen activation by proteolytic cleavage is an example of:', ch:['Allosteric activation', 'Covalent modification', 'Competitive activation', 'Cofactor binding'], ans:1, exp:'Zymogen activation (e.g., trypsinogen to trypsin) involves irreversible covalent modification.'},
    {q:'Vmax depends on:', ch:['Substrate concentration', 'Total enzyme concentration and kcat', 'Inhibitor concentration', 'Temperature alone'], ans:1, exp:'Vmax = kcat × [E]total; depends on both catalytic rate constant and total enzyme concentration.'},
  ]},
  { id:'bb02', cat:'Bio/Biochem', title:'Glycolysis & Gluconeogenesis', diff:'Hard', qs:[
    {q:'Net ATP yield from glycolysis of one glucose:', ch:['4', '2', '36', '38'], ans:1, exp:'Glycolysis produces 4 ATP gross; 2 are invested in steps 1 and 3, giving net 2 ATP.'},
    {q:'Rate-limiting enzyme of glycolysis:', ch:['Hexokinase', 'Aldolase', 'Phosphofructokinase-1 (PFK-1)', 'Pyruvate kinase'], ans:2, exp:'PFK-1: inhibited by ATP/citrate, activated by AMP/ADP/F-2,6-BP.'},
    {q:'During vigorous exercise, pyruvate → lactate by LDH. The PRIMARY purpose is:', ch:['Generate additional ATP', 'Regenerate NAD+ for continued glycolysis', 'Export lactate to liver', 'Reduce oxygen consumption'], ans:1, exp:'LDH regenerates NAD+ by oxidizing NADH, allowing GAPDH to continue glycolysis anaerobically.'},
    {q:'Gluconeogenesis bypasses pyruvate kinase using:', ch:['Hexokinase and G6Pase', 'Pyruvate carboxylase (PC) and PEPCK', 'FBPase-1 and G6Pase', 'PFK-1 and aldolase'], ans:1, exp:'Pyruvate → OAA (pyruvate carboxylase, biotin) → PEP (PEPCK, GTP) bypasses the irreversible PK step.'},
    {q:'Major allosteric activator of PFK-1 under high-energy demand:', ch:['ATP', 'Citrate', 'Fructose-2,6-bisphosphate', 'Phosphoenolpyruvate'], ans:2, exp:'F-2,6-BP (made by PFK-2) is the most potent allosteric activator of PFK-1.'},
    {q:'Glucokinase has high Km and is inducible by:', ch:['Glucagon', 'Insulin', 'Cortisol', 'Epinephrine'], ans:1, exp:'Glucokinase is induced by insulin, allowing liver to increase glucose phosphorylation after meals.'},
    {q:'2,3-BPG in RBCs (Rapoport-Luebering shunt):', ch:['Provides ATP for RBC contraction', 'Stabilizes Hb T-state, reducing O2 affinity', 'Activates pyruvate kinase', 'Inhibits glycolysis under high O2'], ans:1, exp:'2,3-BPG binds beta-subunit cleft of deoxy-Hb, stabilizing T-state → right shift of O2 dissociation curve.'},
    {q:'Which organ primarily performs gluconeogenesis during prolonged fasting?', ch:['Skeletal muscle', 'Brain', 'Liver and kidney', 'Red blood cells'], ans:2, exp:'Liver performs ~80% of gluconeogenesis; kidney contributes significantly during prolonged fasting.'},
    {q:'Arsenate poisoning uncouples glycolysis from ATP production because:', ch:['It inhibits PFK-1', 'It substitutes for phosphate in GAPDH, producing unstable 1-arseno-3-PG', 'It inactivates pyruvate kinase', 'It prevents NAD+ regeneration'], ans:1, exp:'Arsenate mimics phosphate in GAPDH reaction; the arseno product spontaneously hydrolyzes without making ATP.'},
    {q:'Cori cycle: muscle exports ___ to liver, which converts it to ___:', ch:['Alanine; glucose via transamination', 'Lactate; glucose via gluconeogenesis', 'Pyruvate; acetyl-CoA', 'Ketone bodies; acetyl-CoA'], ans:1, exp:'Cori cycle: muscle lactate → blood → liver gluconeogenesis → glucose → blood → muscle.'},
    {q:'Fructose-1,6-bisphosphatase is inhibited by:', ch:['AMP and F-2,6-BP', 'ATP and citrate', 'Glucagon and cortisol', 'Adrenaline and ADP'], ans:0, exp:'FBPase-1 is inhibited by AMP and F-2,6-BP, preventing gluconeogenesis when energy is low.'},
    {q:'Hexokinase is product-inhibited by:', ch:['ATP', 'Glucose-6-phosphate', 'ADP', 'Fructose-6-phosphate'], ans:1, exp:'Hexokinase is irreversible and product-inhibited by G6P — prevents wasting ATP when glucose is plentiful.'},
    {q:'Phosphoglucose isomerase catalyzes:', ch:['Glucose-6-P ↔ Fructose-6-P', 'Fructose-6-P ↔ Fructose-1,6-BP', 'Glucose-1-P ↔ Glucose-6-P', 'G3P ↔ DHAP'], ans:0, exp:'PGI converts G6P (aldose) ↔ F6P (ketose), the second step of glycolysis.'},
    {q:'Pyruvate carboxylase (gluconeogenesis first step) requires:', ch:['TPP', 'Biotin + ATP + CO2', 'PLP', 'FAD'], ans:1, exp:'Pyruvate carboxylase: pyruvate + CO2 + ATP → OAA. Requires biotin, activated by acetyl-CoA.'},
    {q:'Which amino acid enters gluconeogenesis as oxaloacetate via transamination?', ch:['Leucine', 'Aspartate', 'Lysine', 'Phenylalanine'], ans:1, exp:'Aspartate ↔ OAA via AST. OAA is a direct gluconeogenic precursor via PEPCK.'},
  ]},
  { id:'bb03', cat:'Bio/Biochem', title:'TCA Cycle & Electron Transport', diff:'Expert', qs:[
    {q:'One turn of the TCA cycle from acetyl-CoA yields:', ch:['2 NADH, 2 FADH2, 2 GTP', '3 NADH, 1 FADH2, 1 GTP, 2 CO2', '4 NADH, 2 FADH2, 1 ATP', '2 NADH, 1 FADH2, 2 CO2'], ans:1, exp:'Per acetyl-CoA: 3 NADH (isocitrate DH, α-KGDH, malate DH), 1 FADH2 (succinate DH), 1 GTP, 2 CO2.'},
    {q:'Cyanide poisoning kills by inhibiting:', ch:['Complex I', 'Complex II', 'Complex III', 'Complex IV (cytochrome c oxidase)'], ans:3, exp:'CN- binds Fe3+ in cytochrome a3 of Complex IV, blocking O2 reduction and halting the ETC.'},
    {q:'The proton gradient across the IMM is used by:', ch:['Complex III only', 'ATP synthase (Complex V)', 'Complex I', 'Complex II'], ans:1, exp:'F0F1-ATP synthase uses proton flow down the gradient (chemiosmosis) to drive ADP + Pi → ATP.'},
    {q:'Thiamine (B1) deficiency impairs PDH and α-KGDH because:', ch:['Thiamine is consumed as substrate', 'Both require TPP (thiamine pyrophosphate) as cofactor', 'Thiamine stabilizes lipoic acid', 'B1 is required for FAD regeneration'], ans:1, exp:'TPP (active B1) is the cofactor for both PDH and α-KGDH; B1 deficiency → Wernicke\'s encephalopathy.'},
    {q:'GTP in the TCA cycle is formed by:', ch:['Isocitrate dehydrogenase', 'Succinyl-CoA synthetase', 'Malate dehydrogenase', 'Fumarase'], ans:1, exp:'Succinyl-CoA synthetase: succinyl-CoA + GDP + Pi → succinate + GTP (substrate-level phosphorylation).'},
    {q:'Modern P/O ratio for NADH oxidation via ETC:', ch:['3.0', '2.5', '2.0', '1.5'], ans:1, exp:'Current measurements: ~2.5 ATP per NADH and ~1.5 ATP per FADH2, based on H+/ATP stoichiometry.'},
    {q:'Which TCA enzyme is embedded in the inner mitochondrial membrane?', ch:['Isocitrate dehydrogenase', 'Aconitase', 'Succinate dehydrogenase (Complex II)', 'Citrate synthase'], ans:2, exp:'Succinate dehydrogenase is the only TCA enzyme in the IMM; it directly links TCA to ETC (Complex II).'},
    {q:'The citrate shuttle transports acetyl-CoA to cytoplasm for:', ch:['Gluconeogenesis', 'Ketogenesis', 'Fatty acid synthesis', 'Amino acid catabolism'], ans:2, exp:'Citrate exits mitochondria; ATP-citrate lyase cleaves it back to acetyl-CoA + OAA in cytoplasm.'},
    {q:'Rotenone inhibits Complex I, blocking transfer of electrons from:', ch:['Cyt b to cyt c1', 'FADH2 to CoQ', 'NADH to CoQ (ubiquinone)', 'Cyt c to O2'], ans:2, exp:'Rotenone blocks NADH dehydrogenase (Complex I) at the Fe-S cluster step.'},
    {q:'2,4-Dinitrophenol (DNP) causes weight loss by acting as:', ch:['ATPase inhibitor', 'Complex I inhibitor', 'Mitochondrial uncoupler (protonophore)', 'Allosteric activator of PDH'], ans:2, exp:'DNP is a lipophilic weak acid that shuttles H+ across the IMM, dissipating the gradient as heat.'},
    {q:'TCA cycle rate-limiting enzyme:', ch:['Citrate synthase', 'Isocitrate dehydrogenase', 'α-KGDH', 'Fumarase'], ans:1, exp:'Isocitrate dehydrogenase: inhibited by NADH/ATP, activated by ADP/Ca2+.'},
    {q:'Acetyl-CoA enters the TCA cycle by condensing with:', ch:['Fumarate', 'Malate', 'Oxaloacetate', 'Succinate'], ans:2, exp:'Citrate synthase: acetyl-CoA + OAA → citrate + CoA (irreversible, rate-limiting entry step).'},
    {q:'CO2 is released in the TCA cycle at which two steps?', ch:['Citrate synthase and aconitase', 'Isocitrate DH and α-KGDH', 'Malate DH and fumarase', 'Succinate DH and succinyl-CoA synthetase'], ans:1, exp:'Isocitrate → α-KG (CO2 #1) and α-KG → succinyl-CoA (CO2 #2). Both are oxidative decarboxylations.'},
    {q:'Brown adipose tissue generates heat by:', ch:['Activating Complex I', 'Expressing UCP1 (thermogenin) that uncouples the proton gradient', 'Hydrolyzing more ATP', 'Running TCA in reverse'], ans:1, exp:'UCP1 allows H+ to re-enter the matrix without going through ATP synthase → heat production.'},
    {q:'FADH2 from TCA differs from NADH in that it:', ch:['Cannot donate electrons to ETC', 'Donates electrons at Complex II (lower energy), yielding ~1.5 ATP vs ~2.5', 'Requires thiamine as cofactor', 'Is made by citrate synthase'], ans:1, exp:'FADH2 enters at Complex II (CoQ), bypassing the first H+-pumping step → less ATP.'},
  ]},
  { id:'cp01', cat:'Chem/Phys', title:'Atomic Structure & Periodic Trends', diff:'Medium', qs:[
    {q:'The Heisenberg Uncertainty Principle states:', ch:['Electrons have definite orbits', 'Position and momentum cannot both be known precisely simultaneously', 'Energy of a photon equals hf', 'Atomic orbitals are classical'], ans:1, exp:'ΔxΔp ≥ ℏ/2: precision in position × precision in momentum ≥ h/4π. Fundamental, not measurement error.'},
    {q:'Moving down Group 1 (alkali metals), which property increases?', ch:['Ionization energy', 'Electronegativity', 'Atomic radius and metallic character', 'Electron affinity'], ans:2, exp:'Atomic radius increases down a group (more shells); metallic character (ease of losing e-) also increases.'},
    {q:'The photoelectric effect is explained by:', ch:['Wave nature of light', 'Particle (photon) nature: E=hf, threshold frequency required', 'Electromagnetic induction', 'Compton scattering only'], ans:1, exp:'Einstein (1905): photons of energy E=hf. Only photons above threshold frequency eject electrons.'},
    {q:'Electron configuration of Fe (Z=26):', ch:['[Ar] 3d6 4s2', '[Ar] 3d8', '[Ar] 4s2 3d4', '[Kr] 3d6 4s2'], ans:0, exp:'Fe: [Ar] core + 4s2 then 3d6. Fe2+: [Ar] 3d6; Fe3+: [Ar] 3d5.'},
    {q:'Quantum numbers (n=3, l=1, ml=0, ms=+1/2) describe an electron in:', ch:['3s orbital', '3p orbital', '3d orbital', '4p orbital'], ans:1, exp:'n=3 (third shell), l=1 (p orbital), ml=0 (one of three p orientations). This is a 3p electron.'},
    {q:'Effective nuclear charge (Zeff) increases going:', ch:['Down a group', 'Left to right across a period', 'From metals to nonmetals down a group', 'With each added electron'], ans:1, exp:'Across a period: protons added without proportional shielding → Zeff increases → smaller radius, higher IE.'},
    {q:'Which element has the highest first ionization energy?', ch:['Francium', 'Cesium', 'Helium (noble gas, smallest radius)', 'Fluorine'], ans:2, exp:'Noble gases have highest IE in their period; helium has highest overall (both electrons in n=1 shell).'},
    {q:'The de Broglie wavelength of a particle is:', ch:['lambda = hf', 'lambda = h/mv', 'lambda = E/hc', 'lambda = c/f'], ans:1, exp:'de Broglie: λ = h/p = h/(mv). Larger mass or speed → shorter wavelength → less wave-like behavior.'},
    {q:'The d subshell can hold a maximum of:', ch:['2 electrons', '6 electrons', '10 electrons', '14 electrons'], ans:2, exp:'d subshell: 5 orbitals × 2 electrons each = 10 electrons maximum.'},
    {q:'Electronegativity generally increases:', ch:['Down any group', 'Right to left across a period', 'From left to right and bottom to top (toward F)', 'With increasing atomic radius'], ans:2, exp:'Electronegativity follows Zeff: increases L→R and B→T. Fluorine has highest electronegativity (4.0).'},
    {q:'Hydrogen emission spectrum shows discrete lines because:', ch:['Electrons randomly emit photons', 'Electrons transition between fixed energy levels, emitting photons of specific wavelengths', 'Hydrogen has only one electron', 'Protons and neutrons interact to produce light'], ans:1, exp:'Bohr/QM: En = -13.6/n2 eV. Transitions give ΔE = hf for specific wavelengths.'},
    {q:'Electron affinity is most negative (most favorable) for:', ch:['Alkali metals', 'Noble gases', 'Halogens (especially Cl and F)', 'Alkaline earth metals'], ans:2, exp:'Halogens: one electron short of noble gas config → highest tendency to gain e- → most exothermic EA.'},
    {q:'The n=2 shell contains a maximum of:', ch:['2', '4', '8', '18'], ans:2, exp:'n=2: 2s (2 e-) + 2p (6 e-) = 8 electrons. General formula: max 2n2 electrons per shell.'},
    {q:'Rutherford gold foil experiment proved:', ch:['Atoms are mostly empty with diffuse positive charge', 'Atomic nucleus is small, dense, and positively charged', 'Electrons are embedded in a positive sphere', 'Atoms have no internal structure'], ans:1, exp:'Most alpha particles passed through (empty space), some deflected at large angles → small dense positive nucleus.'},
    {q:'Which quantum number determines the shape of an orbital?', ch:['n (principal)', 'l (azimuthal/angular momentum)', 'ml (magnetic)', 'ms (spin)'], ans:1, exp:'l determines shape: l=0 (s, spherical), l=1 (p, dumbbell), l=2 (d, cloverleaf), l=3 (f, complex).'},
  ]},
  { id:'cp02', cat:'Chem/Phys', title:'Thermodynamics & Chemical Equilibrium', diff:'Hard', qs:[
    {q:'For a spontaneous process at constant T and P, ΔG must be:', ch:['Greater than zero', 'Equal to zero', 'Less than zero', 'Greater than ΔH'], ans:2, exp:'ΔG = ΔH - TΔS. Spontaneous: ΔG < 0. Equilibrium: ΔG = 0.'},
    {q:'A reaction with ΔH = +50 kJ and ΔS = +200 J/K at 400 K. ΔG equals:', ch:['+50 kJ', '+130 kJ', '-30 kJ (spontaneous)', '-80 kJ'], ans:2, exp:'ΔG = 50000 - (400)(200) = 50000 - 80000 = -30000 J = -30 kJ. Entropy-driven spontaneity.'},
    {q:'Hess\'s Law states:', ch:['Enthalpy depends on path', 'ΔH for a reaction is the same regardless of path (state function)', 'Entropy always increases', 'ΔG equals TΔS'], ans:1, exp:'Hess\'s Law: ΔH is a state function; total enthalpy change is independent of pathway.'},
    {q:'Keq = 1000 means:', ch:['Reaction goes to completion instantly', 'Products strongly favored at equilibrium', 'Neither reactants nor products favored', 'Reaction is kinetically very fast'], ans:1, exp:'Keq >> 1: products strongly favored. ΔG° = -RTlnK. K=1000: ΔG° ≈ -17.1 kJ/mol.'},
    {q:'Increasing pressure shifts equilibrium toward:', ch:['Side with more moles of gas', 'Side with fewer moles of gas', 'Neither side', 'Only the side with higher temperature'], ans:1, exp:'Increasing pressure shifts toward fewer moles of gas. Equal gas moles: pressure has no effect on position.'},
    {q:'Entropy increases when:', ch:['Gas is compressed', 'Solution freezes to solid', 'Substance vaporizes or dissolves', 'Temperature decreases'], ans:2, exp:'Entropy: gas > liquid > solid. Vaporization and dissolution both increase molecular disorder.'},
    {q:'Bomb calorimeter measures ΔE at:', ch:['Constant pressure', 'Constant temperature', 'Constant volume', 'Constant entropy'], ans:2, exp:'Bomb calorimeter: rigid container → constant volume → q = ΔE. Coffee cup calorimeter: constant pressure → ΔH.'},
    {q:'Colligative properties depend on:', ch:['Chemical identity of solute', 'Number of particles of solute, not their identity', 'Polarity of the solvent', 'Both identity and concentration'], ans:1, exp:'Colligative: ΔTb, ΔTf, π, vapor pressure depression depend only on particle concentration, not identity.'},
    {q:'A catalyst increases reaction rate by:', ch:['Increasing ΔH', 'Lowering activation energy Ea without changing ΔG', 'Increasing collision frequency', 'Shifting equilibrium toward products'], ans:1, exp:'Catalysts lower Ea for both forward and reverse reactions. Thermodynamics (ΔG, K) are unchanged.'},
    {q:'1 mol NaCl in 1 kg water depresses freezing point by approximately:', ch:['-1.86°C', '-3.72°C (i=2 for NaCl)', '-5.58°C', '-0.93°C'], ans:1, exp:'NaCl → Na+ + Cl-; i≈2. ΔTf = 1.86 × 1 mol/kg × 2 = -3.72°C.'},
    {q:'The van\'t Hoff equation describes how Keq varies with:', ch:['Concentration of reactants', 'Pressure', 'Temperature (lnKeq ∝ -ΔH°/RT)', 'Volume'], ans:2, exp:'van\'t Hoff: d(lnK)/dT = ΔH°/RT2. Exothermic: K decreases with T. Endothermic: K increases with T.'},
    {q:'Maximum non-PV work from a spontaneous process equals:', ch:['ΔG (positive)', '−ΔG', 'ΔH', 'TΔS'], ans:1, exp:'-ΔG = maximum non-PV work (electrical, chemical, etc.) at constant T and P.'},
    {q:'The third law of thermodynamics states:', ch:['Entropy of universe always increases', 'Entropy of a perfect crystal at absolute zero is zero', 'Enthalpy cannot convert entirely to work', 'Energy cannot be created or destroyed'], ans:1, exp:'Third law: S=0 at T=0K for a perfect crystal. Provides absolute reference for standard molar entropies.'},
    {q:'Which is a thermodynamic state function?', ch:['Heat (q)', 'Work (w)', 'Entropy (S)', 'Both q and w'], ans:2, exp:'State functions depend only on current state: U, H, G, S, T, P, V. Path functions: q and w.'},
    {q:'For Haber process N2 + 3H2 ⇌ 2NH3, ΔH°=-92 kJ/mol. Moderate T is used because:', ch:['High T needed for Keq', 'High T is thermodynamically unfavorable but necessary for acceptable reaction rate', 'Pressure has no effect', 'T does not affect equilibrium'], ans:1, exp:'Haber: low T → better yield but slow; high T → faster rate but lower yield. Compromise: ~450°C, 200 atm.'},
  ]},
  { id:'cp03', cat:'Chem/Phys', title:'Fluids, Circuits & Optics', diff:'Hard', qs:[
    {q:'Poiseuille\'s law: blood flow Q is proportional to:', ch:['r2 × ΔP', 'r4 × ΔP / (η × L)', 'ΔP / r', 'r × ΔP / η'], ans:1, exp:'Q = πr4ΔP/(8ηL). Flow ∝ r4 — most powerful determinant. Halving radius decreases flow 16-fold.'},
    {q:'Bernoulli\'s equation predicts at a vessel narrowing:', ch:['Pressure increases', 'Velocity increases and pressure decreases', 'Both velocity and pressure increase', 'Flow rate decreases'], ans:1, exp:'Bernoulli: P + ½ρv2 + ρgh = constant. Narrowing → v increases (continuity: A1v1=A2v2) → P decreases.'},
    {q:'Reynolds number Re > 2000 predicts:', ch:['Laminar, smooth flow', 'Turbulent flow with eddies', 'Viscosity too high', 'Newtonian fluid behavior'], ans:1, exp:'Re = ρvd/η. Re < 2000: laminar; Re > 4000: turbulent. Turbulence increases resistance and energy cost.'},
    {q:'Two resistors R1=4Ω and R2=12Ω in parallel. Total resistance:', ch:['16Ω', '8Ω', '3Ω', '6Ω'], ans:2, exp:'1/Rtotal = 1/4 + 1/12 = 3/12 + 1/12 = 4/12. Rtotal = 3Ω. Parallel always gives R < smallest individual R.'},
    {q:'Ohm\'s Law: V = IR relates:', ch:['Voltage, current, and resistance', 'Power, resistance, and frequency', 'Charge, capacitance, and time', 'Magnetic field, current, and length'], ans:0, exp:'Ohm\'s Law: V=IR (volts, amperes, ohms). Derived: P = IV = I2R = V2/R.'},
    {q:'In a series RC circuit with large C, charging to full voltage:', ch:['Occurs instantaneously', 'Takes longer (τ=RC is large) — time constant for reaching 63% charge', 'Occurs more quickly', 'Is independent of R'], ans:1, exp:'RC time constant τ=RC. V(t)=Vmax(1-e^(-t/RC)). At t=τ: V=63% Vmax.'},
    {q:'Converging lens (f=20cm), object at 30cm. Image distance di:', ch:['10cm', '60cm', '15cm', '-60cm'], ans:1, exp:'1/di = 1/20 - 1/30 = 3/60 - 2/60 = 1/60. di=60cm (real image on other side). m = -60/30 = -2.'},
    {q:'Light from water (n=1.33) to glass (n=1.50) at 45°. The ray bends:', ch:['Away from normal (speeds up)', 'Toward normal (slows down in denser medium)', 'Not at all', 'Total internal reflection'], ans:1, exp:'Into denser medium (higher n): light slows → bends toward normal. Snell: n1sinθ1 = n2sinθ2.'},
    {q:'Total internal reflection occurs when:', ch:['Light goes from less to more dense medium', 'Angle of incidence exceeds critical angle going from denser to less dense medium', 'Wavelength equals interface thickness', 'Frequency matches natural frequency of medium'], ans:1, exp:'TIR: denser to less dense medium AND θ1 > θc = arcsin(n2/n1). Basis of optical fiber communication.'},
    {q:'Power of a lens in diopters is:', ch:['P = f × 1000', 'P = 1/f (focal length in meters)', 'P = n/f', 'P = f2/n'], ans:1, exp:'P (diopters) = 1/f (meters). Converging: +P. Diverging: -P. Example: +2D lens has f = 0.5m = 50cm.'},
    {q:'Doppler effect: moving source approaching stationary observer produces:', ch:['Lower frequency', 'Higher frequency (wavelength compressed)', 'No change in frequency', 'Only amplitude changes'], ans:1, exp:'Approaching source → compressed waves → higher frequency. Basis of Doppler ultrasound for blood flow.'},
    {q:'Significant diffraction occurs when wavelength is:', ch:['Much smaller than the obstacle', 'Comparable to or larger than the obstacle/slit size', 'Different polarization than slit', 'Exactly equal to slit width only'], ans:1, exp:'Diffraction: λ ≈ slit size or larger. Sound diffracts around doors; visible light through small slits.'},
    {q:'Object inside focal point of converging lens produces:', ch:['Real, inverted, smaller image', 'Virtual, upright, magnified image (magnifying glass)', 'Real, upright, magnified image', 'Virtual, inverted, smaller image'], ans:1, exp:'Object inside focal point: rays diverge → virtual image behind lens. Virtual, upright, magnified — magnifying glass.'},
    {q:'Doubling plate separation in parallel plate capacitor (constant V) changes C to:', ch:['Doubles C', 'Doubles electric field', 'Halves C and halves stored energy', 'Quadruples stored energy'], ans:2, exp:'C = ε0A/d. Double d: C halved. E=V/d: E halved. Energy = ½CV2: halved. Charge Q=CV also halves.'},
    {q:'Blood flow through capillaries is best modeled as:', ch:['Turbulent, high Re', 'Laminar, low Re (Stokes flow)', 'Pulsatile and turbulent', 'Bernoulli flow with constant pressure'], ans:1, exp:'Capillaries: diameter ~5-10μm, low velocity, high viscosity → very low Re (~0.001) → Poiseuille law applies.'},
  ]},
  { id:'cp04', cat:'Chem/Phys', title:'Organic Chemistry Reactions', diff:'Hard', qs:[
    {q:'SN2 reactions favor which substrate?', ch:['Tertiary carbons', 'Secondary carbons with bulky nucleophiles', 'Primary carbons (least steric hindrance)', 'Quaternary carbons'], ans:2, exp:'SN2: bimolecular, backside attack → inversion. Favors primary substrates and strong nucleophiles.'},
    {q:'Markovnikov rule predicts HBr addition to propene gives:', ch:['1-bromopropane', '2-bromopropane (H adds to less substituted C → 2° carbocation → Br- attacks)', 'Both equally', '1,2-dibromopropane'], ans:1, exp:'Markovnikov: H adds to less substituted C, forming the more stable carbocation → 2-bromopropane.'},
    {q:'Planar carbocation intermediate leading to racemization occurs in:', ch:['SN2 (inversion only)', 'E2 (no carbocation)', 'SN1 (flat carbocation → both faces → racemic)', 'Electrophilic addition'], ans:2, exp:'SN1: ionization → planar carbocation (sp2) → nucleophile attacks both faces equally → racemization.'},
    {q:'Diels-Alder reaction is classified as:', ch:['Electrophilic aromatic substitution', '[4+2] pericyclic cycloaddition (diene + dienophile)', 'Free radical chain reaction', 'Nucleophilic addition-elimination'], ans:1, exp:'Diels-Alder: [4+2] cycloaddition. Concerted, stereospecific (syn addition) → 6-membered ring.'},
    {q:'Aldehydes are more reactive than ketones toward nucleophilic addition because:', ch:['Aldehydes have higher MW', 'One H (less steric) and H is less e-donating than alkyl, making carbonyl more electrophilic', 'Ketones form enols preferentially', 'Ketones cannot undergo nucleophilic addition'], ans:1, exp:'Ketones: two e-donating alkyls stabilize carbonyl carbon + more steric hindrance vs aldehydes.'},
    {q:'Fischer esterification is:', ch:['Acid + alcohol ⇌ ester + water (reversible, driven by removing water)', 'Acid chloride + alcohol → ester (irreversible)', 'Acid + amine → amide', 'Ester + water → acid + alcohol'], ans:0, exp:'Fischer: RCOOH + R\'OH ⇌ RCOOR\' + H2O. Reversible (K≈1-4). Driven forward by excess alcohol or removing water.'},
    {q:'In E2 elimination, leaving group and β-H must be:', ch:['Syn-periplanar (0°)', 'Gauche (60°)', 'Anti-periplanar (180°)', 'On the same carbon'], ans:2, exp:'E2: concerted, requires anti-periplanar arrangement (180° dihedral). For cyclohexanes: diaxial orientation.'},
    {q:'Nitration of benzene is an example of:', ch:['Free radical substitution', 'Electrophilic aromatic substitution (EAS)', 'Nucleophilic aromatic substitution', 'Elimination reaction'], ans:1, exp:'EAS: benzene π electrons attack NO2+ electrophile → arenium ion → proton loss restores aromaticity.'},
    {q:'Friedel-Crafts acylation is preferred over alkylation because:', ch:['Alkylation requires higher T', 'Acylation avoids polysubstitution (EWG deactivates ring after one substitution)', 'Acylation requires no Lewis acid', 'Alkylation gives only ortho products'], ans:1, exp:'Acyl group deactivates ring (EWG) → stops at monoacylation. Alkyl group activates → polyalkylation occurs.'},
    {q:'Ozonolysis of cyclohexene with oxidative workup (H2O2) gives:', ch:['Cyclohexanone', 'Hexanedioic acid (adipic acid)', '1,6-hexanedial', 'Two separate aldehyde fragments'], ans:1, exp:'Ozonolysis cleaves C=C: cyclohexene → open chain, oxidative workup → COOH at both ends → adipic acid.'},
    {q:'A Grignard reagent is destroyed by:', ch:['Acetone', 'Water (proton sources) → RH + Mg(OH)X', 'Esters', 'CO2'], ans:1, exp:'Grignard reagents are strong bases; proton sources (H2O, alcohol, acid) destroy them. Must use anhydrous conditions.'},
    {q:'Degree of unsaturation (DBE) for C7H14O:', ch:['0', '1', '2', '3'], ans:1, exp:'DBE = (2C + 2 - H + N)/2 = (14 + 2 - 14)/2 = 2/2 = 1. One ring or double bond. O not counted.'},
    {q:'IR absorption at ~1700 cm-1 is characteristic of:', ch:['N-H stretch', 'O-H stretch', 'C=O stretch (carbonyl) in ketones, aldehydes, or carboxylic acids', 'C-H stretch in alkanes'], ans:2, exp:'Carbonyl (C=O): ~1700-1750 cm-1. Ketones: ~1715; aldehydes: ~1725; esters: ~1735; amides: ~1680.'},
    {q:'In NMR, chemical shift (ppm) increases (downfield) when proton is:', ch:['Highly shielded by electron density', 'Deshielded by electronegative atoms or π systems', 'On a larger, less flexible molecule', 'On a primary carbon'], ans:1, exp:'Deshielding → downfield: aromatic H (6.5-8.5 ppm), aldehyde H (~9-10), carboxylic OH (~10-12).'},
    {q:'SN1 reactions are favored by:', ch:['Weak nucleophiles, polar protic solvents, tertiary substrates', 'Strong nucleophiles, polar aprotic solvents, primary substrates', 'Nonpolar solvents, tertiary substrates, strong bases', 'Gas phase conditions'], ans:0, exp:'SN1: tertiary/allylic/benzylic substrates (stable carbocation), polar protic solvents, weak nucleophiles.'},
  ]},
  { id:'ps01', cat:'Psych/Soc', title:'Social Psychology & Cognition', diff:'Medium', qs:[
    {q:'Fundamental attribution error refers to:', ch:['Attributing our successes to ability', 'Overestimating dispositional and underestimating situational factors in OTHERS\' behavior', 'Always attributing behavior to external causes', 'Believing our actions are always intentional'], ans:1, exp:'FAE: when observing others, we over-rely on character and ignore situational forces.'},
    {q:'Cognitive dissonance occurs when:', ch:['Two people disagree', 'A person holds conflicting beliefs or acts against beliefs, causing discomfort', 'Someone forgets information', 'A person uses heuristics'], ans:1, exp:'Festinger: conflicting cognitions create discomfort → motivation to reduce by changing attitude, behavior, or cognitions.'},
    {q:'Availability heuristic leads people to:', ch:['Use logical analysis', 'Judge probability by how easily examples come to mind', 'Always underestimate risks', 'Rely on base rates'], ans:1, exp:'Availability: judge likelihood by ease of recall. Dramatic events (plane crashes, shark attacks) are overestimated.'},
    {q:'Obedience to authority was demonstrated in whose famous experiments?', ch:['Solomon Asch', 'Philip Zimbardo', 'Stanley Milgram (~65% gave max shock)', 'Leon Festinger'], ans:2, exp:'Milgram (1963): ~65% gave \'450V\' shocks when instructed by authority. Situational power over individual moral judgment.'},
    {q:'Bystander effect occurs because of:', ch:['Aggression instincts', 'Diffusion of responsibility and pluralistic ignorance', 'In-group favoritism', 'Social loafing only'], ans:1, exp:'Darley & Latané: each person assumes others will help (diffusion) and looks to others for cues (pluralistic ignorance).'},
    {q:'Social facilitation predicts:', ch:['Presence of others always decreases performance', 'Improves performance on well-learned tasks but impairs difficult/novel tasks', 'Improves all tasks equally', 'No effect on trained individuals'], ans:1, exp:'Social facilitation: dominant responses enhanced by audience; non-dominant responses impaired. Arousal mediates.'},
    {q:'Conformity (Asch line experiments) was highest when:', ch:['Person was the only one giving wrong answer', 'Confederates were unanimous, group size 3-5, task ambiguous', 'Task was easy and clear-cut', 'Person had high self-esteem'], ans:1, exp:'Asch: ~32-37% wrong answers. Conformity peaks with unanimity, group size 3-5, and ambiguous stimuli.'},
    {q:'Schema theory explains:', ch:['How neurons form connections', 'Mental frameworks that organize and interpret new information (can cause memory distortions)', 'Role of dopamine in reward', 'Stages of moral development'], ans:1, exp:'Schemas: knowledge structures that filter, organize, and reconstruct information. Explain constructive memory.'},
    {q:'Self-serving bias refers to:', ch:['Always attributing outcomes to others', 'Attributing successes to internal factors and failures to external factors', 'Preferring ourselves in all situations', 'Believing others see us as we see ourselves'], ans:1, exp:'Self-serving bias: \'I passed because I\'m smart; I failed because the test was unfair.\' Protects self-esteem.'},
    {q:'Groupthink is most likely in groups that are:', ch:['Large and diverse with open debate', 'Highly cohesive, isolated, with directive leader and pressure for consensus', 'Small with equal status members', 'Competitive with individual metrics'], ans:1, exp:'Groupthink (Janis): cohesive group suppresses dissent → illusion of unanimity. Bay of Pigs, Challenger disaster.'},
    {q:'Priming is a phenomenon where:', ch:['Repetition improves explicit recall', 'Exposure to one stimulus increases accessibility of related stimuli (implicit memory)', 'Pain triggers autobiographical memories', 'Emotional events create stronger memories'], ans:1, exp:'Priming (implicit): prior exposure facilitates later processing without awareness. \'Doctor\' primes \'nurse\'.'},
    {q:'According to Maslow, which need must be met before esteem?', ch:['Self-actualization', 'Esteem itself', 'Safety and love/belonging (physiological → safety → love → esteem → self-actualization)', 'Cognitive needs'], ans:2, exp:'Maslow\'s hierarchy: physiological → safety → love/belonging → esteem → self-actualization.'},
    {q:'Internal locus of control means:', ch:['Believing external forces control fate', 'Believing you control your own outcomes', 'Having an internal monologue', 'Attributing others\' actions to internal causes'], ans:1, exp:'Rotter: internal = \'I control what happens to me.\' Associated with better health and academic performance.'},
    {q:'The Stroop effect demonstrates:', ch:['Superiority of parallel processing', 'Interference between automatic processing (reading) and controlled processing (naming ink color)', 'Short-term memory limitations of 7±2', 'Role of dopamine in attention'], ans:1, exp:'Stroop: naming ink color of color words is slower due to automatic reading interfering with controlled naming.'},
    {q:'Actor-observer bias: actors attribute their behavior to:', ch:['Their personality traits', 'Situational factors; observers attribute actors\' behavior to disposition', 'Both equally to situation and disposition', 'Random factors'], ans:1, exp:'Actor-observer: we (actors) cite situation for our behavior; observers attribute our behavior to our disposition.'},
  ]},
  { id:'ps02', cat:'Psych/Soc', title:'Development, Learning & Memory', diff:'Medium', qs:[
    {q:'Piaget\'s preoperational stage (ages 2-7) is characterized by:', ch:['Logical operations and conservation', 'Egocentrism, symbolic thinking, but lack of conservation and reversibility', 'Abstract hypothetical reasoning', 'Object permanence development'], ans:1, exp:'Preoperational: symbolic thought, but egocentric, centration, cannot conserve (quantity preserved despite appearance).'},
    {q:'Classical conditioning: neutral stimulus becomes conditioned stimulus through:', ch:['Operant reinforcement', 'Repeated pairing with UCS → NS elicits CR alone', 'Modeling and social learning', 'Spontaneous association after single pairing'], ans:1, exp:'Pavlov: NS + UCS → CS. Bell paired with food → bell alone causes salivation.'},
    {q:'Variable ratio reinforcement produces behavior that is:', ch:['Easily extinguished', 'Most resistant to extinction (slot machine effect)', 'Weakest and most irregular', 'Best for learning new behaviors'], ans:1, exp:'VR: reinforcement after unpredictable responses. Highest, most consistent rates. Most resistant to extinction.'},
    {q:'The hippocampus is critical for:', ch:['Implicit/procedural memory', 'Forming new explicit declarative memories (episodic and semantic)', 'Emotional conditioning via fear responses', 'LTP in the cerebellum'], ans:1, exp:'H.M. (bilateral hippocampectomy): profound anterograde amnesia for explicit memories. Implicit memories spared.'},
    {q:'Vygotsky\'s Zone of Proximal Development refers to:', ch:['Maximum intellectual capacity of a child', 'Range between what child can do alone vs. with guidance (scaffolding)', 'Developmental lag between cognitive and social maturity', 'Skills requiring no assistance'], ans:1, exp:'ZPD: between actual (independent) and potential level (with guidance). Scaffolding: temporary support gradually removed.'},
    {q:'Erikson\'s Industry vs. Inferiority corresponds to:', ch:['Early childhood (2-3 years)', 'School age (6-12 years) — developing competence vs. inferiority', 'Adolescence', 'Early adulthood'], ans:1, exp:'Erikson Stage 4 (6-12 years): developing competence through achievement. Failure → inferiority complex.'},
    {q:'Serial position effect shows:', ch:['Middle items remembered best', 'Items at beginning (primacy) and end (recency) remembered better than middle', 'All items recalled equally', 'Recency effect is permanent while primacy is temporary'], ans:1, exp:'Primacy: first items → LTM via rehearsal. Recency: last items → still in working memory. Middle items poorest.'},
    {q:'Long-term potentiation (LTP) is the cellular mechanism underlying:', ch:['Receptor desensitization', 'Synaptic strengthening — basis of learning and memory (NMDA-dependent)', 'Saltatory conduction in myelinated axons', 'Neurotransmitter reuptake'], ans:1, exp:'LTP: repeated stimulation → NMDA receptors (coincidence detectors) → Ca2+ → AMPA insertion → stronger synapse.'},
    {q:'Kohlberg\'s post-conventional moral reasoning involves:', ch:['Following rules to avoid punishment', 'Conforming to social norms', 'Abstract principles of justice and human rights (beyond laws and authority)', 'Self-interest and concrete exchange'], ans:2, exp:'Kohlberg Stage 5-6: social contract, individual rights, universal ethical principles. May disobey unjust laws.'},
    {q:'Secure attachment in infancy predicts:', ch:['Greater independence, no need for social support', 'Better emotional regulation, social competence, and relationship quality in adulthood', 'Higher IQ scores', 'Reduced need for peer relationships'], ans:1, exp:'Secure attachment: consistent responsive caregiving → safe base. Better peer relationships and emotional regulation.'},
    {q:'The spacing effect (Ebbinghaus) states:', ch:['Massed practice (cramming) is more effective', 'Distributed practice leads to better long-term retention than massed practice', 'Frequency of review matters more than timing', 'Memory consolidation requires 8+ hours of sleep'], ans:1, exp:'Spacing effect: spaced sessions > equal time in one session. Retrieval from partial forgetting strengthens memory.'},
    {q:'Negative reinforcement:', ch:['Decreases behavior by adding aversive stimulus (punishment)', 'Increases behavior by removing an aversive stimulus', 'Is the same as punishment', 'Decreases behavior by removing pleasant stimulus'], ans:1, exp:'Negative reinforcement INCREASES behavior by REMOVING something aversive. Very different from punishment.'},
    {q:'Wernicke\'s area is associated with:', ch:['Motor production of speech', 'Language comprehension; damage → fluent but nonsensical speech (Wernicke\'s aphasia)', 'Visual processing', 'Emotional regulation'], ans:1, exp:'Wernicke\'s area (posterior superior temporal gyrus): comprehension. Wernicke\'s aphasia: word salad, poor comprehension.'},
    {q:'Piaget\'s formal operational stage begins around age 12 and includes:', ch:['Mastery of conservation', 'Egocentric thinking with symbolic representation', 'Abstract thinking, hypothetical reasoning, systematic problem-solving', 'Only concrete visible operations'], ans:2, exp:'Formal operational (12+): abstract thought, hypothetical-deductive reasoning, metacognition, hypothesis testing.'},
    {q:'Erikson\'s Identity vs. Role Confusion occurs during:', ch:['Early childhood', 'School age', 'Adolescence (12-18 years)', 'Middle adulthood'], ans:2, exp:'Identity vs. Role Confusion (Stage 5, adolescence): forming a coherent identity. Failure → role confusion.'},
  ]},
  { id:'ps03', cat:'Psych/Soc', title:'Sociology, Research Methods & Statistics', diff:'Medium', qs:[
    {q:'Cohort study measure of association:', ch:['Odds ratio (OR)', 'Relative risk (RR) — incidence in exposed / incidence in unexposed', 'Prevalence ratio', 'Attributable risk percent'], ans:1, exp:'Cohort measures incidence → RR. Case-control: past exposure in cases vs. controls → OR.'},
    {q:'A p-value of 0.03 means:', ch:['3% chance treatment has no effect', '3% probability of data as extreme as observed IF null hypothesis were true', 'Treatment increases outcome by 3%', '97% confidence in results'], ans:1, exp:'P-value = P(data|H0). p<0.05: reject H0. Does NOT mean: P(H0 is true), effect size, or clinical significance.'},
    {q:'Sensitivity is:', ch:['TN/(TN+FP)', 'TP/(TP+FN) — ability to identify true positives', 'TP/(TP+FP)', 'TN/(TN+FN)'], ans:1, exp:'Se = TP/(TP+FN) = true positive rate. SnNOut: Sensitive test, Negative result, rules Out disease.'},
    {q:'Specificity is:', ch:['TP/(TP+FN)', 'TP/(TP+FP)', 'TN/(TN+FP) — ability to identify true negatives', 'TN/(TN+FN)'], ans:2, exp:'Sp = TN/(TN+FP). SpPIn: Specific test, Positive result, rules In disease.'},
    {q:'Positive predictive value (PPV) is most affected by:', ch:['Test sensitivity alone', 'Test specificity alone', 'Disease prevalence in the population tested', 'Number of true negatives'], ans:2, exp:'PPV = TP/(TP+FP) = P(disease|positive test). PPV rises dramatically with higher prevalence.'},
    {q:'Goffman\'s \'dramaturgical model\' describes people as:', ch:['Passive recipients of social norms', 'Performers managing impressions for different audiences (front vs. backstage)', 'Rational utility maximizers', 'Conditioned responders'], ans:1, exp:'Goffman: social life is theater. Front stage: performance for audience. Backstage: preparation. Impression management.'},
    {q:'Durkheim\'s altruistic suicide results from:', ch:['Normlessness (anomie)', 'Too little integration (egoistic)', 'Excessive regulation (fatalistic)', 'Over-integration (sacrifices self for group)'], ans:3, exp:'Durkheim\'s types: Egoistic (low integration), Altruistic (high integration), Anomic (low regulation), Fatalistic (high regulation).'},
    {q:'Recall bias is most problematic in:', ch:['Randomized controlled trials', 'Cross-sectional studies', 'Case-control studies (asking about past exposures after outcome known)', 'Prospective cohort studies'], ans:2, exp:'Cases recall past exposures differently than controls → differential recall → biased OR.'},
    {q:'Social stratification is best defined as:', ch:['Individual differences in personality', 'Hierarchical ranking of groups with unequal access to resources, power, and prestige', 'Cultural diversity within a society', 'Social mobility patterns'], ans:1, exp:'Stratification: structured inequality. Systems: slavery, caste (ascribed), estates (feudal), class (achieved, more fluid).'},
    {q:'Biopsychosocial model understands illness as:', ch:['Purely biological', 'Purely psychological', 'Result of complex interactions among biological, psychological, and social factors', 'Social constructs created by medicine'], ans:2, exp:'Engel (1977): genetic predisposition (bio) + stress/coping (psycho) + poverty/support (social) → health outcome.'},
    {q:'Anomie (Durkheim) refers to:', ch:['High social integration leading to conformity', 'Normlessness during rapid social change when existing norms break down', 'Individual alienation from personal goals', 'Dysfunction from social stratification'], ans:1, exp:'Anomie: disruption of social regulation → lack of norms. Occurs during rapid social change. Higher suicide rates.'},
    {q:'Ecological fallacy occurs when:', ch:['Animal studies apply to humans', 'Group-level findings are incorrectly applied to individuals', 'Individual studies are aggregated without meta-analysis', 'Correlation is confused with causation'], ans:1, exp:'Ecological fallacy (Robinson, 1950): population-level association may not apply to individuals.'},
    {q:'Intersectionality (Crenshaw) argues:', ch:['All social categories are equally important', 'Multiple social identities interact and create overlapping systems of discrimination/privilege', 'Social identities can be studied independently', 'Inequality is solely based on class'], ans:1, exp:'Intersectionality: race, gender, class, sexuality are not additive but intersecting. Coined by Kimberlé Crenshaw (1989).'},
    {q:'Number Needed to Treat (NNT) is calculated as:', ch:['1/Relative Risk', '1/Absolute Risk Reduction (ARR = control rate - treatment rate)', 'Relative Risk × prevalence', 'Odds Ratio / study duration'], ans:1, exp:'NNT = 1/ARR. Lower NNT = more effective treatment. ARR=10%: NNT=10 (treat 10 to prevent 1 event).'},
    {q:'Thomas theorem: \'If men define situations as real, they are real in their consequences.\' Best illustrated by:', ch:['Scientific hypothesis testing', 'A bank run: belief a bank will fail → withdrawals → actually cause the failure', 'Confirmation bias in research', 'Halo effect in perception'], ans:1, exp:'Thomas theorem (1928): social reality constructed by subjective perceptions that produce real consequences. Self-fulfilling prophecy.'},
  ]},
];

/* ══════════════════════════════════════════════════════════════════
   PRE-BUILT FLASHCARD DECKS (12 decks)
══════════════════════════════════════════════════════════════════ */
const FLASH_DECKS = {
  'Enzyme Kinetics': [
    {front:'Define Km', back:'[S] at half-maximal velocity (½Vmax). Low Km = high affinity. Km ≈ KD only when kcat << k-1.'},
    {front:'Competitive inhibitor effects', back:'Km increases (apparent); Vmax unchanged. Overcome by excess substrate. L-B plot: same y-intercept, shifted x-intercept.'},
    {front:'Noncompetitive inhibitor effects', back:'Km unchanged; Vmax decreases. Cannot be overcome by substrate. L-B plot: parallel lines (shifted y-intercept).'},
    {front:'kcat (turnover number)', back:'Substrate molecules converted per enzyme per second at saturation. kcat/Km = specificity constant (efficiency at low [S]).'},
    {front:'Hill coefficient > 1', back:'Positive cooperativity: each substrate binding increases affinity for next. Produces sigmoidal v vs [S] curve.'},
    {front:'Feedback inhibition', back:'End product inhibits first committed (rate-limiting) step. Example: CTP inhibits ATCase. Prevents overproduction.'},
    {front:'Zymogen activation', back:'Inactive precursor activated by proteolytic cleavage. Examples: pepsinogen→pepsin; trypsinogen→trypsin. Irreversible covalent modification.'},
    {front:'Uncompetitive inhibitor', back:'Binds only ES complex. Decreases BOTH apparent Km and Vmax proportionally. Parallel shift on L-B plot.'},
  ],
  'Cardiovascular Physiology': [
    {front:'Frank-Starling law', back:'↑Preload (EDV) → ↑sarcomere stretch → ↑actin-myosin overlap → ↑SV. Heart adjusts CO to match venous return.'},
    {front:'Cardiac output formula', back:'CO = HR × SV. Normal: ~70 bpm × 70 mL = 5 L/min. Fick method: CO = O2 consumption / (arterial - venous O2 content).'},
    {front:'MAP calculation', back:'MAP = DBP + 1/3(PP). Or MAP = CO × SVR. Normal: ~93 mmHg (120/80: 80 + 1/3×40 = 93.3).'},
    {front:'Baroreceptor reflex', back:'↓BP → ↓baroreceptor firing → ↑sympathetic/↓parasympathetic → ↑HR, ↑contractility, ↑vasoconstriction → ↑BP.'},
    {front:'Ejection fraction (EF)', back:'EF = SV/EDV × 100%. Normal: 55-65%. EF < 40%: systolic HF. EF measures contractility.'},
    {front:'ECG waves', back:'P: atrial depolarization. PR: AV node conduction (0.12-0.20s). QRS: ventricular depolarization. T: ventricular repolarization.'},
    {front:'Starling forces in capillaries', back:'Filtration: (Pc - Pi) - σ(πc - πi). Pc: capillary hydrostatic; πc: capillary oncotic (albumin); Pi/πi: interstitial.'},
    {front:'Coronary blood flow timing', back:'Left coronary: perfuses during DIASTOLE (compressed during systole). Right: perfuses during both (lower pressure RV).'},
  ],
  'Respiratory Physiology': [
    {front:'Bohr effect', back:'↑CO2 or ↑H+ → right shift of O2-Hb curve (↓affinity) → O2 unloading to active tissues. Active muscle: high CO2, H+, temp, 2,3-BPG.'},
    {front:'FEV1/FVC ratio', back:'< 0.7: obstructive (COPD, asthma). > 0.7 with ↓FVC: restrictive (fibrosis). Normal: ≥ 0.7.'},
    {front:'V/Q ratio in lung zones', back:'Apex (Zone 1): V/Q > 1 (dead space-like). Base (Zone 3): V/Q < 1 (shunt-like). Normal V/Q ≈ 0.8.'},
    {front:'Surfactant function', back:'DPPC: reduces alveolar surface tension. Prevents collapse (atelectasis). More effective in small alveoli. Made by type II pneumocytes.'},
    {front:'Primary respiratory drive', back:'PaCO2 → central chemoreceptors (medulla). Not PaO2 (peripheral only). COPD hypercapnia: hypoxic drive becomes primary.'},
    {front:'Pulmonary compliance', back:'ΔV/ΔP. High compliance: emphysema (destroyed elastic tissue). Low compliance: fibrosis (stiff lungs require more effort).'},
    {front:'2,3-BPG effects on Hb', back:'Binds beta-chain cleft of deoxy-Hb → stabilizes T-state → right shift (↓O2 affinity). ↑ with: altitude, anemia, hypoxia.'},
    {front:'Haldane effect', back:'O2 binding to Hb releases CO2 (promotes CO2 unloading at lungs). Deoxy-Hb carries more CO2 than oxy-Hb.'},
  ],
  'Renal Physiology': [
    {front:'GFR normal value', back:'~125 mL/min. Creatinine clearance ≈ GFR. ↓ with: renal mass loss, aging, DM, HTN.'},
    {front:'Aldosterone mechanism', back:'MR receptor in principal cells → ↑ENaC (apical, Na+ entry) + ↑Na/K-ATPase (basolateral) → Na+ reabsorption, K+ secretion.'},
    {front:'ADH (vasopressin) mechanism', back:'V2R → Gs → cAMP → PKA → phosphorylates AQP2 vesicles → fusion with apical membrane → ↑water reabsorption in collecting duct.'},
    {front:'RAAS cascade', back:'↓Perfusion → Renin (JG cells) → Ang I → ACE (lung) → Ang II → vasoconstriction + aldosterone + ADH + thirst.'},
    {front:'Anion gap (AG)', back:'AG = Na+ - (Cl- + HCO3-). Normal: 8-12 mEq/L. ↑AG metabolic acidosis: MUDPILES (Methanol, Uremia, DKA, Propylene glycol, INH, Lactate, EG, Salicylates).'},
    {front:'Diabetes insipidus types', back:'Central DI: ↓ADH production. Nephrogenic DI: ↓renal response to ADH. Both: dilute polyuria, polydipsia, high serum osmolality.'},
    {front:'Renal glucose handling', back:'Freely filtered; reabsorbed in PCT by SGLT2. Renal threshold: ~180 mg/dL. Above → glucosuria → osmotic diuresis in DKA.'},
    {front:'Loop of Henle TAL', back:'Thick ascending limb: NKCC2 cotransporter (furosemide target). IMPERMEABLE to water → concentrates medullary interstitium.'},
  ],
  'Acid-Base Balance': [
    {front:'Henderson-Hasselbalch for blood', back:'pH = 6.1 + log([HCO3-]/[H2CO3]). Normal: 7.40 = 6.1 + log(24/1.2). Ratio = 20:1. [CO2(d)] = 0.03 × PaCO2.'},
    {front:'Metabolic acidosis compensation', back:'↓HCO3-: high AG (MUDPILES) or normal AG (RTA, diarrhea). Compensation: hyperventilation ↓PaCO2. Winter\'s: PaCO2 = 1.5[HCO3-] + 8 ± 2.'},
    {front:'Metabolic alkalosis causes', back:'↑HCO3-: vomiting (↓Cl-, ↓K+), diuretics, primary hyperaldosteronism, antacid excess. Compensation: hypoventilation ↑PaCO2.'},
    {front:'Respiratory acidosis causes', back:'↑PaCO2: hypoventilation. Causes: COPD, opioids/sedatives, neuromuscular disease. Renal compensation: ↑HCO3- (days).'},
    {front:'Respiratory alkalosis causes', back:'↓PaCO2: hyperventilation. Causes: anxiety, pain, PE, pregnancy, altitude, early sepsis. Renal: ↓HCO3- (days).'},
    {front:'MUDPILES mnemonic', back:'M: Methanol. U: Uremia. D: DKA. P: Propylene glycol. I: INH/Iron. L: Lactic acidosis. E: Ethylene glycol. S: Salicylates.'},
    {front:'Buffer system hierarchy (speed)', back:'1st (immediate): HCO3- system, proteins, Hb. 2nd (minutes): respiratory (PaCO2). 3rd (hours-days): renal (HCO3- reabsorption).'},
    {front:'Urinary anion gap (UAG)', back:'UAG = Na+u + K+u - Cl-u. Negative: appropriate NH4+ excretion (GI cause). Positive: RTA (kidney not excreting acid).'},
  ],
  'Immunology': [
    {front:'MHC class I vs class II', back:'MHC I: ALL nucleated cells; intracellular antigens → CD8+ CTLs. MHC II: APCs only; extracellular antigens → CD4+ T helpers.'},
    {front:'Complement pathways', back:'Classical: IgG/IgM + C1. Lectin (MBL): mannose-binding. Alternative: spontaneous C3 hydrolysis. All converge at C3 → MAC (C5b-9 pore).'},
    {front:'Type I-IV hypersensitivity', back:'I: IgE + mast cells (anaphylaxis). II: IgG/M cytotoxic. III: immune complexes (lupus, serum sickness). IV: T-cell, delayed (TB test, contact dermatitis).'},
    {front:'NK cell killing', back:'Kills: (1) cells lacking MHC I (missing self — tumor/virus), (2) antibody-coated cells (ADCC via Fc receptors). Mechanism: perforin + granzymes.'},
    {front:'CD4 T helper subsets', back:'Th1: IFN-γ → macrophage activation, IL-12. Th2: IL-4 → humoral (IgE). Th17: IL-6/TGF-β → neutrophils. Treg: TGF-β/IL-10 → suppression.'},
    {front:'Immunoglobulin isotypes', back:'IgM: first response, pentamer. IgG: crosses placenta, most abundant. IgA: secretory/mucosal, dimer. IgE: allergy/parasites. IgD: B cell activation.'},
    {front:'B cell class switching', back:'B cell + antigen + CD4+ Th2 (CD40L-CD40 + cytokines) → activation → plasma cells. IL-4→IgE, IL-5→IgA, IL-12→IgG.'},
    {front:'Innate vs adaptive immunity', back:'Innate: non-specific, immediate (0-4h), no memory. Adaptive: specific, delayed (days), memory; B cells (Ab) and T cells.'},
  ],
  'Endocrinology': [
    {front:'Insulin vs glucagon (fed vs fasted)', back:'Fed (insulin): ↑GLUT4, glycogen synthesis, lipogenesis, protein synthesis; ↓gluconeogenesis. Fasted (glucagon): ↑glycogenolysis, gluconeogenesis, ketogenesis.'},
    {front:'HPA axis', back:'Stress → CRH (hypothalamus) → ACTH (anterior pituitary) → cortisol (adrenal cortex). Cortisol: ↑gluconeogenesis, anti-inflammatory, catabolic.'},
    {front:'Thyroid hormone synthesis', back:'TRH → TSH → T3/T4 synthesis (iodine + thyroglobulin). T4 → T3 (active) peripherally. Negative feedback: T3/T4 inhibit TRH and TSH.'},
    {front:'PTH and calcium regulation', back:'↓Ca2+ → ↑PTH (chief cells) → ↑bone resorption, ↑renal Ca2+ reabsorption, ↑1α-hydroxylase (activates Vit D) → ↑intestinal Ca2+ absorption.'},
    {front:'Cushing syndrome', back:'Causes: exogenous steroids (#1), pituitary adenoma (Cushing disease, ACTH↑), adrenal adenoma (ACTH↓). Features: central obesity, striae, moon face, HTN, DM.'},
    {front:'Addison disease', back:'Autoimmune adrenal destruction → ↓cortisol + ↓aldosterone + ↑ACTH/MSH (hyperpigmentation). Features: fatigue, ↓BP, hyponatremia, hyperkalemia.'},
    {front:'DM type 1 vs type 2', back:'T1DM: autoimmune β-cell destruction → absolute insulin deficiency. T2DM: insulin resistance + relative deficiency. T1: ketosis prone, thin, youth onset.'},
    {front:'Aldosterone regulation', back:'Stimulated by: ↑Ang II, ↑K+, ↓blood volume. Effect: Na+ reabsorption + K+/H+ secretion. Conn syndrome: primary hyperaldosteronism → HTN + hypokalemia.'},
  ],
  'Pharmacology Fundamentals': [
    {front:'Volume of distribution (Vd)', back:'Vd = dose / plasma concentration. <1 L/kg: plasma (heparin). 1-15: tissues. >15 L/kg: highly tissue-bound (chloroquine, amiodarone).'},
    {front:'First-pass metabolism', back:'Oral → portal → liver → metabolized before systemic circulation. High first-pass: morphine, nitroglycerin, propranolol, lidocaine → need IV or sublingual.'},
    {front:'CYP450 inducers and inhibitors', back:'Inducers (↑metabolism): rifampin, carbamazepine, phenytoin, St. John\'s wort, chronic alcohol. Inhibitors (↓metabolism): azoles, macrolides, grapefruit, acute alcohol.'},
    {front:'Therapeutic index (TI)', back:'TI = LD50/ED50. Wide TI (penicillin): safe. Narrow TI (lithium, warfarin, digoxin, aminoglycosides, phenytoin): require therapeutic drug monitoring.'},
    {front:'Half-life and steady state', back:'t½ = 0.693 × Vd / CL. Steady state: ~4-5 half-lives. Loading dose: Vd × target [C]. Maintenance dose: CL × target [C].'},
    {front:'Penicillin mechanism and resistance', back:'Beta-lactam inhibits transpeptidase (PBP) → no peptidoglycan cross-linking → cell wall lysis. Resistance: beta-lactamase or MRSA (altered PBP, mecA gene).'},
    {front:'Acetaminophen toxicity', back:'NAPQI (reactive metabolite) normally detoxified by glutathione. Overdose: NAPQI accumulates → hepatocyte necrosis. Antidote: N-acetylcysteine (NAC).'},
    {front:'Receptor agonist types', back:'Agonist: binds + activates. Partial agonist: activates with lower Emax. Antagonist: binds, no activation, blocks agonist. Inverse agonist: decreases basal activity.'},
  ],
  'Neuroscience Basics': [
    {front:'Action potential phases', back:'Resting: -70mV (K+ leak + Na/K ATPase). Depolarization: Na+ in. Repolarization: Na+ inactivates, K+ opens. Hyperpolarization: K+ channels slow to close.'},
    {front:'Major neurotransmitters', back:'ACh: NMJ, memory. DA: reward (mesolimbic), motor (nigrostriatal). 5-HT: mood, GI. NE: arousal. GABA: inhibitory (Cl-). Glutamate: excitatory (AMPA, NMDA).'},
    {front:'Myelin and saltatory conduction', back:'Myelin: Schwann cells (PNS), oligodendrocytes (CNS). AP jumps node-to-node (Ranvier) → faster propagation. MS: autoimmune demyelination.'},
    {front:'Blood-brain barrier (BBB)', back:'Tight junctions between brain capillary endothelial cells. Allows: lipid-soluble drugs, O2, CO2, glucose (GLUT1). Blocks: large/polar molecules.'},
    {front:'Spinal cord tracts', back:'Spinothalamic (anterolateral): pain + temperature — crosses at entry level (contralateral). Dorsal columns (DCML): vibration + proprioception — crosses at medulla.'},
    {front:'Autonomic nervous system', back:'Sympathetic: T1-L2, short pre/long post, NE (except sweat: ACh). Para: CN III/VII/IX/X + S2-4, long pre/short post, ACh throughout. Both: ACh at preganglionic.'},
    {front:'Cranial nerve types', back:'Sensory only: I (olfactory), II (optic), VIII (vestibulocochlear). Motor only: III, IV, VI, XI, XII. Both: V (trigeminal), VII (facial), IX (glossopharyngeal), X (vagus).'},
    {front:'LTP mechanism', back:'Repeated stimulation → NMDA receptors (require depolarization + glutamate) → Ca2+ influx → AMPA receptor insertion → stronger synapse. Basis of learning/memory.'},
  ],
  'CARS Strategies': [
    {front:'The #1 CARS rule', back:'All answers must be supported by the passage. NEVER use outside knowledge. The answer must come from what the AUTHOR SAYS in the passage.'},
    {front:'Main idea question strategy', back:'Look for what the ENTIRE passage argues. The right answer is broad, encompassing all parts. Avoid answers describing only one paragraph.'},
    {front:'Author would agree strategy', back:'Return to passage for evidence. Find author\'s position on the topic. Right answer follows logically from stated position. Avoid extreme unless author uses extreme language.'},
    {front:'Strengthen/Weaken strategy', back:'Identify main assumption. Strengthen: add evidence supporting assumption. Weaken: undermine assumption or show flaw. Do NOT look for what contradicts a detail.'},
    {front:'Elimination strategy', back:'Eliminate: (1) Too extreme. (2) Contradicts passage. (3) True but irrelevant to question. (4) Outside knowledge. Remaining answer is correct.'},
    {front:'CARS tone words', back:'Dismissive: "mere," "so-called." Cautious: "may," "might." Definitive: "proves," "demonstrates." Critical: "undermines." Supportive: "validates," "confirms."'},
    {front:'Active reading for CARS', back:'Passage map: 1-2 words per paragraph (main point + author attitude). Know the overall argument before answering. 3-4 min reading, ~1.5 min per question.'},
    {front:'Time management for CARS', back:'9 passages, 90 min = 10 min per passage. Spend 3-4 min reading, 6-7 min on ~7 questions. Flag difficult questions and return. Always answer — no penalty.'},
  ],
  'Vitamins & Cofactors': [
    {front:'B1 (Thiamine) — cofactor for', back:'TPP: PDH, alpha-KGDH, BCKDH (all alpha-keto acid dehydrogenases) + transketolase (PPP). Deficiency: Wernicke-Korsakoff (alcoholics), beriberi.'},
    {front:'B3 (Niacin) — forms and function', back:'NAD+/NADH (oxidative reactions) and NADP+/NADPH (biosynthetic, antioxidant). Deficiency: Pellagra (dermatitis, diarrhea, dementia). Synthesized from tryptophan.'},
    {front:'B6 (Pyridoxine) — cofactor for', back:'PLP: ALL aminotransferases, decarboxylases (DOPA→DA, 5-HTP→5-HT), glycogen phosphorylase, ALA synthase (heme), CBS. Deficiency: ↑homocysteine, neuropathy.'},
    {front:'B12 (Cobalamin) — two reactions', back:'1) Methylmalonyl-CoA mutase: methylmalonyl-CoA → succinyl-CoA. 2) Methionine synthase: homocysteine → methionine. Deficiency: megaloblastic anemia + neurological damage.'},
    {front:'Folate (B9) — one-carbon metabolism', back:'THF carries one-carbon units. Essential for: dTMP synthesis (dUMP → dTMP via TS, blocked by 5-FU/MTX) and purine synthesis. Deficiency: megaloblastic anemia (no neuro damage).'},
    {front:'Biotin — carboxylation reactions', back:'PACk-Man: Pyruvate carboxylase, Acetyl-CoA carboxylase, Propionyl-CoA carboxylase. All add CO2. Deficiency: alopecia, dermatitis, dementia (avidin in raw eggs).'},
    {front:'Fat-soluble vitamins (ADEK)', back:'A: vision (retinal), epithelial integrity. D: calcium/phosphate (VDR). E: antioxidant (membrane protection). K: clotting factors II, VII, IX, X + proteins C, S.'},
    {front:'Iron absorption and transport', back:'Fe2+ absorbed (non-heme Fe3+ reduced by Vit C). Duodenum. Transferrin transports (Fe3+). Ferritin stores (Fe3+). Hepcidin: master regulator — blocks ferroportin.'},
  ],
  'MCAT Test Strategy': [
    {front:'MCAT format overview', back:'4 sections: C/P (59Q, 95min), CARS (53Q, 90min), B/B (59Q, 95min), P/S (59Q, 95min). ~7.5 hours total. Score: 472-528 (each section 118-132).'},
    {front:'Time management', back:'C/P: 1.6 min/Q. CARS: 1.7 min/Q (9 passages × 10 min). B/B: 1.6 min/Q. P/S: 1.6 min/Q. Flag questions >2 min. No penalty for wrong answers — always guess.'},
    {front:'High-yield Bio/Biochem topics', back:'Enzyme kinetics (every year), genetics, amino acids/proteins, metabolism (glycolysis, TCA, beta-oxidation), cell biology (signal transduction), evolution, microbiology.'},
    {front:'High-yield Chem/Phys topics', back:'Acids/bases (Henderson-Hasselbalch, titrations), thermodynamics (ΔG, Keq), electrochemistry (Nernst), fluids (Poiseuille, Bernoulli), optics (lens equation), organic mechanisms.'},
    {front:'MCAT score percentiles (approximate)', back:'528: 100th. 521-523: 99th. 519-520: 97th. 517: 95th. 515: 92nd. 513: 88th. 511: 82nd. 509: 76th. Average accepted: ~511-512.'},
    {front:'Common MCAT traps', back:'(1) True but irrelevant. (2) Extreme language (always/never) — usually wrong in CARS. (3) Outside knowledge in CARS. (4) Adjacent numerical answers — closest may be wrong.'},
    {front:'MCAT experimental design questions', back:'Know: IV vs DV, confounders, positive/negative controls, blinding, placebo, randomization. "What would be the best control?" and "What confound exists?"'},
    {front:'Best content resources', back:'1. AAMC materials (most predictive). 2. Kaplan books. 3. Khan Academy MCAT. 4. Anki decks (Zanki/Lightyear). Active recall > passive reading for retention.'},
  ],
};

/* ══════════════════════════════════════════════════════════════════
   E-LIBRARY (52 resources)
══════════════════════════════════════════════════════════════════ */
const ELIB = [
  {cat:'Bio/Biochem',title:'Khan Academy – Biomolecules',url:'https://www.khanacademy.org/test-prep/mcat/biomolecules',type:'Video Series',free:true,desc:'Complete proteins, enzymes, lipids, carbohydrates, and nucleic acids for MCAT.'},
  {cat:'Bio/Biochem',title:'Khan Academy – Cells',url:'https://www.khanacademy.org/test-prep/mcat/cells',type:'Video Series',free:true,desc:'Cell structure, organelles, cell cycle, and mitosis/meiosis.'},
  {cat:'Bio/Biochem',title:'Khan Academy – Metabolism',url:'https://www.khanacademy.org/test-prep/mcat/metabolism',type:'Video Series',free:true,desc:'Glycolysis, TCA cycle, oxidative phosphorylation, fatty acid metabolism.'},
  {cat:'Bio/Biochem',title:'Crash Course Biology',url:'https://www.youtube.com/playlist?list=PL3EED4C1D684D3ADF',type:'YouTube',free:true,desc:'Fast-paced visual biology covering all MCAT Bio content. 40+ episodes.'},
  {cat:'Bio/Biochem',title:'NCBI Bookshelf – Biochemistry',url:'https://www.ncbi.nlm.nih.gov/books/NBK22367/',type:'Textbook',free:true,desc:'Chapters from Biochemistry (Berg, Tymoczko, Stryer) freely available.'},
  {cat:'Bio/Biochem',title:'iBiology – Biochemistry Lectures',url:'https://www.ibiology.org/',type:'Video Lectures',free:true,desc:'Research-grade lectures by leading scientists on molecular biology.'},
  {cat:'Bio/Biochem',title:'Sketchy Micro & Pharm',url:'https://www.sketchy.com/',type:'Visual Learning',free:false,desc:'Mnemonic-based visual stories for microbiology and pharmacology. Extremely effective.'},
  {cat:'Bio/Biochem',title:'Ninja Nerd Science',url:'https://www.youtube.com/@NinjaNerdScience',type:'YouTube',free:true,desc:'High-yield anatomy, physiology, and pathology lectures with whiteboard explanations.'},
  {cat:'Bio/Biochem',title:'Osmosis by Elsevier',url:'https://www.osmosis.org/',type:'Video + Q Bank',free:false,desc:'High-yield animated videos for physiology, pathology, and pharmacology.'},
  {cat:'Bio/Biochem',title:'Armando Hasudungan – Immunology',url:'https://www.youtube.com/@armandohasudungan',type:'YouTube',free:true,desc:'Hand-drawn illustrations explaining immunology and physiology concepts.'},
  {cat:'Bio/Biochem',title:'AAMC Biological Foundations Guide',url:'https://students-residents.aamc.org/mcat/prepare-mcat/what-mcat',type:'Official Guide',free:false,desc:'AAMC official content outline for the B/B section with sample questions.'},
  {cat:'Bio/Biochem',title:'Dr. Najeeb Lectures',url:'https://www.drnajeeblectures.com/',type:'Video Lectures',free:false,desc:'Comprehensive 800+ lecture series on basic sciences, physiology, and neuroscience.'},
  {cat:'Bio/Biochem',title:'Crash Course Chemistry (Biochem)',url:'https://www.youtube.com/c/crashcourse',type:'YouTube',free:true,desc:'Biochemistry episodes covering organic chemistry fundamentals clearly.'},
  {cat:'Chem/Phys',title:'Khan Academy – Physical Processes',url:'https://www.khanacademy.org/test-prep/mcat/physical-processes',type:'Video Series',free:true,desc:'Physics and general chemistry including thermodynamics, fluids, optics, and circuits.'},
  {cat:'Chem/Phys',title:'Khan Academy – Chemical & Physical Foundations',url:'https://www.khanacademy.org/test-prep/mcat/chemical-and-physical-foundations-of-biological-systems',type:'Video Series',free:true,desc:'Complete C/P MCAT prep including electrochemistry and acid-base.'},
  {cat:'Chem/Phys',title:'Professor Dave Explains – Organic Chem',url:'https://www.youtube.com/@ProfessorDaveExplains',type:'YouTube',free:true,desc:'Clear walkthroughs of all organic chemistry mechanisms tested on MCAT.'},
  {cat:'Chem/Phys',title:'The Organic Chemistry Tutor',url:'https://www.youtube.com/@TheOrganicChemistryTutor',type:'YouTube',free:true,desc:'Worked examples for gen chem, physics, and organic chemistry.'},
  {cat:'Chem/Phys',title:'MIT OpenCourseWare – General Chemistry',url:'https://ocw.mit.edu/courses/5-111sc-principles-of-chemical-science-fall-2014/',type:'Course',free:true,desc:'MIT 5.111 General Chemistry lectures, problem sets, and exams.'},
  {cat:'Chem/Phys',title:'MIT OpenCourseWare – Physics',url:'https://ocw.mit.edu/courses/8-01sc-classical-mechanics-fall-2016/',type:'Course',free:true,desc:'Classical mechanics (8.01) and electromagnetism (8.02) from MIT.'},
  {cat:'Chem/Phys',title:'Hyperphysics – Physics Reference',url:'http://hyperphysics.phy-astr.gsu.edu/hbase/hframe.html',type:'Reference',free:true,desc:'Comprehensive interconnected physics reference covering all MCAT physics.'},
  {cat:'Chem/Phys',title:'Chemguide – Organic Mechanisms',url:'https://www.chemguide.co.uk/',type:'Reference',free:true,desc:'Detailed explanations of organic reaction mechanisms and kinetics.'},
  {cat:'Chem/Phys',title:"Chad's Prep – General Chemistry",url:'https://www.chadsprep.com/',type:'Video + Practice',free:false,desc:'One of the most recommended MCAT Chem/Phys prep resources. Very high yield.'},
  {cat:'Psych/Soc',title:'Khan Academy – Psych/Soc',url:'https://www.khanacademy.org/test-prep/mcat/social-sciences',type:'Video Series',free:true,desc:'Complete MCAT Psych/Soc: personality, development, social psychology, sociology.'},
  {cat:'Psych/Soc',title:'Crash Course Psychology',url:'https://www.youtube.com/playlist?list=PL8dPuuaLjXtOPRKzVLY0jT3gy-7NFgCnz',type:'YouTube',free:true,desc:'40-episode series covering entire introductory psychology curriculum.'},
  {cat:'Psych/Soc',title:'Crash Course Sociology',url:'https://www.youtube.com/playlist?list=PL8dPuuaLjXtMJ-AfB_7J1538YKZkEjJsN',type:'YouTube',free:true,desc:'Sociology covering stratification, culture, socialization, and institutions.'},
  {cat:'Psych/Soc',title:'Simply Psychology',url:'https://www.simplypsychology.org/',type:'Reference',free:true,desc:'Concise summaries of every major psychological theory, study, and concept.'},
  {cat:'Psych/Soc',title:'OpenStax Psychology',url:'https://openstax.org/books/psychology-2e/pages/1-introduction',type:'Textbook',free:true,desc:'Free peer-reviewed introductory psychology textbook covering all MCAT Psych/Soc.'},
  {cat:'Psych/Soc',title:'OpenStax Sociology',url:'https://openstax.org/books/introduction-sociology-3e/pages/1-introduction',type:'Textbook',free:true,desc:'Free introductory sociology textbook — stratification, culture, and groups.'},
  {cat:'Research Methods',title:'Khan Academy – Health and Medicine',url:'https://www.khanacademy.org/test-prep/mcat/social-sciences-practice',type:'Video Series',free:true,desc:'Epidemiology, study design, and biostatistics for MCAT.'},
  {cat:'Research Methods',title:'Coursera – Epidemiology (Johns Hopkins)',url:'https://www.coursera.org/specializations/epidemiology-public-health-practice',type:'Course',free:true,desc:'Full epidemiology specialization from JHU Bloomberg School of Public Health.'},
  {cat:'Research Methods',title:'BMJ – Statistics at Square One',url:'https://www.bmj.com/about-bmj/resources-readers/publications/statistics-square-one',type:'Reference',free:true,desc:'Classic guide to medical statistics — covers all MCAT biostatistics topics.'},
  {cat:'Research Methods',title:'CASP Checklists',url:'https://casp-uk.net/casp-tools-checklists/',type:'Reference',free:true,desc:'Evidence-based medicine study design checklists (RCT, cohort, case-control, diagnostic).'},
  {cat:'MCAT Prep',title:'AAMC Official Practice Exams',url:'https://www.aamc.org/students/applying/mcat/preparing/',type:'Practice Exams',free:false,desc:'Gold standard — FL1-FL4 + Sample Test. Most predictive of actual MCAT score.'},
  {cat:'MCAT Prep',title:'Anki MCAT Decks (Zanki/Lightyear)',url:'https://www.ankiweb.net/',type:'Flashcards',free:true,desc:'Community-made comprehensive MCAT Anki decks. Best for spaced repetition.'},
  {cat:'MCAT Prep',title:'Reddit r/MCAT Wiki',url:'https://www.reddit.com/r/Mcat/wiki/index',type:'Community Guide',free:true,desc:'Community-maintained MCAT prep guide, timeline, and resource list.'},
  {cat:'MCAT Prep',title:'Jack Westin – CARS Practice',url:'https://jackwestin.com/mcat-cars',type:'Practice',free:true,desc:'CARS passages updated daily. Best free resource for CARS passage practice.'},
  {cat:'MCAT Prep',title:'Blueprint MCAT (formerly Next Step)',url:'https://blueprintprep.com/mcat',type:'Full Prep Course',free:false,desc:'10 full-length practice exams, adaptive question banks, and study schedules.'},
  {cat:'MCAT Prep',title:'Uworld MCAT Q Bank',url:'https://www.uworld.com/mcat/',type:'Question Bank',free:false,desc:'High-quality question bank with detailed explanations. Great for targeted practice.'},
  {cat:'MCAT Prep',title:'Kaplan MCAT Complete 7-Book Set',url:'https://www.kaptest.com/mcat',type:'Textbooks',free:false,desc:'Comprehensive review books covering all MCAT content. Good for initial content review.'},
  {cat:'MCAT Prep',title:'MCAT Self Prep (YouTube)',url:'https://www.youtube.com/@MCATSelfPrep',type:'YouTube',free:true,desc:'Free MCAT prep channel with content review, strategy, and motivational content.'},
  {cat:'Clinical & Career',title:'AAMC – Careers in Medicine (CiM)',url:'https://www.aamc.org/cim/',type:'Career Tool',free:true,desc:'Explore 120+ medical specialties with lifestyle and training requirements.'},
  {cat:'Clinical & Career',title:'MSAR – Medical School Admission Requirements',url:'https://apps.aamc.org/msar-ui/',type:'Database',free:false,desc:'Official data: median GPA, MCAT, acceptance rates for all LCME-accredited schools.'},
  {cat:'Clinical & Career',title:'Student Doctor Network (SDN)',url:'https://forums.studentdoctor.net/',type:'Community Forum',free:true,desc:'Pre-med forums with school-specific secondary essay compilations and interview feedback.'},
  {cat:'Clinical & Career',title:'Association of American Medical Colleges',url:'https://www.aamc.org/',type:'Official Resource',free:true,desc:'Application cycles, diversity in medicine, research opportunities, and policy news.'},
  {cat:'Clinical & Career',title:'Gold Standard MCAT',url:'https://www.mcat-prep.com/',type:'Textbook + Practice',free:false,desc:'Comprehensive MCAT prep books with practice questions, especially strong in C/P.'},
  {cat:'Clinical & Career',title:'Princeton Review – 10 Practice Tests',url:'https://www.princetonreview.com/medical/mcat-prep',type:'Practice Exams',free:false,desc:'10 full-length practice tests with detailed scoring breakdowns.'},
];

/* ══════════════════════════════════════════════════════════════════
   COMPETITIONS DATABASE
══════════════════════════════════════════════════════════════════ */
const COMPETITIONS = [
  {id:'usabo',name:'USA Biology Olympiad (USABO)',type:'Competition',deadline:'Jan 15',effort:'Elite',national:true,states:[],tags:['Biology','National'],url:'https://www.usabo-trc.org/',desc:'Prestigious national bio competition; top performers gain research opportunities and med school recognition.'},
  {id:'usnco',name:'US National Chemistry Olympiad',type:'Competition',deadline:'Mar 1',effort:'Elite',national:true,states:[],tags:['Chemistry','National'],url:'https://www.acs.org/usnco',desc:'ACS national chemistry competition. Winner represents USA at IChO.'},
  {id:'nih_sip',name:'NIH Summer Internship Program (SIP)',type:'Research',deadline:'Feb 1',effort:'Competitive',national:true,states:[],tags:['Research','NIH','Paid'],url:'https://www.training.nih.gov/programs/sip',desc:'8-10 week paid research internship at NIH Bethesda. Exceptional for medical school applications.'},
  {id:'simons',name:'Simons Summer Research Program',type:'Research',deadline:'Jan 20',effort:'Competitive',national:false,states:['NY','CT','NJ','PA'],tags:['Research','Stipend'],url:'https://www.simonsfoundation.org/',desc:'7-week research at Stony Brook with $3,000 stipend.'},
  {id:'hosa',name:'HOSA Future Health Professionals',type:'Competition',deadline:'Varies',effort:'Open',national:true,states:[],tags:['Healthcare','Leadership'],url:'https://hosa.org/',desc:'Compete in 60+ healthcare categories nationally. Great for leadership development.'},
  {id:'amsa',name:'AMSA Pre-Med Scholarship',type:'Scholarship',deadline:'May 15',effort:'Competitive',national:true,states:[],tags:['Scholarship'],url:'https://www.amsa.org/',desc:'AMSA annual awards for pre-med students demonstrating leadership and service.'},
  {id:'rsna',name:'RSNA Medical Student Symposium',type:'Conference',deadline:'Oct 1',effort:'Open',national:true,states:[],tags:['Conference','Radiology'],url:'https://www.rsna.org/',desc:'Annual radiology conference with free student registration and networking.'},
  {id:'intel_isef',name:'Regeneron ISEF (Science Fair)',type:'Competition',deadline:'Feb 15',effort:'Competitive',national:true,states:[],tags:['Research','Science Fair'],url:'https://www.societyforscience.org/isef/',desc:"World's largest pre-college science fair. Qualify through state/regional fairs."},
  {id:'goldwater',name:'Goldwater Scholarship',type:'Scholarship',deadline:'Feb 1',effort:'Elite',national:true,states:[],tags:['Research','Scholarship','Elite'],url:'https://goldwaterscholarship.gov/',desc:'Prestigious for sophomore/junior STEM students planning research careers. $7,500 award.'},
  {id:'snma',name:'Student National Medical Association',type:'Organization',deadline:'Ongoing',effort:'Open',national:true,states:[],tags:['Diversity','Leadership'],url:'https://snma.org/',desc:'For underrepresented students in medicine. Conferences, mentorship, community health.'},
  {id:'aamc_diver',name:'AAMC FIRST Program',type:'Research',deadline:'Mar 15',effort:'Competitive',national:true,states:[],tags:['Research','Diversity'],url:'https://www.aamc.org/services/first-student-research',desc:'Diversity in research program for students from underrepresented backgrounds.'},
  {id:'gates',name:'Gates Cambridge Scholarship',type:'Scholarship',deadline:'Oct 15',effort:'Elite',national:true,states:[],tags:['Scholarship','International'],url:'https://www.gatescambridge.org/',desc:'Full scholarship to Cambridge University for graduate study. For exceptional students.'},
  {id:'red_cross',name:'Red Cross Health Services Volunteer',type:'Volunteering',deadline:'Ongoing',effort:'Open',national:true,states:[],tags:['Service','Clinical'],url:'https://www.redcross.org/',desc:'Direct patient interaction and community service. Strong clinical exposure.'},
  {id:'state_fair',name:'State Science & Engineering Fair',type:'Competition',deadline:'Varies',effort:'Open',national:false,states:[],tags:['State','Science Fair'],url:'#',desc:'Your state ISEF. Great first step to qualify for regional and national competitions.'},
  {id:'scp',name:'Hospital Shadowing / Clinical Programs',type:'Clinical',deadline:'Ongoing',effort:'Open',national:false,states:[],tags:['Clinical','Shadowing'],url:'#',desc:'Contact local hospitals and clinics for volunteer/shadowing. Essential for applications.'},
  {id:'sc_nat',name:'Society for Neuroscience Abstract Award',type:'Competition',deadline:'Aug 1',effort:'Competitive',national:true,states:[],tags:['Neuroscience','Research'],url:'https://www.sfn.org/',desc:'Present research at SfN annual meeting. Abstract award for outstanding undergraduate work.'},
  {id:'aoao',name:'American Osteopathic Association Programs',type:'Organization',deadline:'Ongoing',effort:'Open',national:true,states:[],tags:['DO','AOA'],url:'https://osteopathic.org/',desc:'Resources and programs for students considering DO (Doctor of Osteopathic Medicine) path.'},
  {id:'amapre',name:'AMA Pre-Med Scholarship',type:'Scholarship',deadline:'Apr 30',effort:'Competitive',national:true,states:[],tags:['AMA','Scholarship'],url:'https://www.ama-assn.org/',desc:'AMA scholarships demonstrating commitment to patient care and medical advocacy.'},
  {id:'ncas',name:'National Academy of Medicine Scholars',type:'Research',deadline:'Feb 28',effort:'Elite',national:true,states:[],tags:['NAM','Policy'],url:'https://www.nationalacademies.org/',desc:'Health policy research for exceptional students interested in healthcare systems.'},
  {id:'scialog',name:'SCIALOG Fellows Program',type:'Research',deadline:'Varies',effort:'Competitive',national:true,states:[],tags:['Research','Innovation'],url:'https://rescorp.org/scialog/',desc:'Collaborative research bringing emerging scientists together for interdisciplinary work.'},
];

/* ══════════════════════════════════════════════════════════════════
   DIAGNOSTIC QUESTIONS
══════════════════════════════════════════════════════════════════ */
const DIAG_QS = [
  {q:'A competitive inhibitor is added to an enzymatic reaction. Vmax and Km changes are:',ch:['Vmax ↓; Km unchanged','Vmax unchanged; Km ↑','Both ↑','Both ↓'],ans:1,cat:'biochem',exp:'Competitive inhibitors: Vmax preserved (overcome by substrate), apparent Km increases.'},
  {q:'Frank-Starling law: increased preload leads to:',ch:['Decreased stroke volume','Decreased heart rate','Increased stroke volume via sarcomere stretch','Increased afterload'],ans:2,cat:'biosys',exp:'↑EDV → ↑stretch → ↑actin-myosin overlap → ↑SV (Frank-Starling mechanism).'},
  {q:'At pH = pKa in Henderson-Hasselbalch equation, [A−]/[HA] =',ch:['0','0.5','1 (equal amounts)','10'],ans:2,cat:'chemphys',exp:'pH = pKa + log([A-]/[HA]). pH = pKa → log ratio = 0 → ratio = 1.'},
  {q:'Fundamental attribution error describes our tendency to:',ch:['Attribute our failures to external causes',"Overestimate dispositional factors in others' behavior",'Underestimate our abilities',"Attribute others' successes to luck"],ans:1,cat:'psychsoc',exp:"FAE: when explaining OTHERS' behavior we over-rely on character, under-appreciate situation."},
  {q:"Poiseuille's Law: if vessel radius decreases by 50%, flow changes by:",ch:['−50%','−75%','−87.5%','−93.75% (1/16 of original)'],ans:3,cat:'chemphys',exp:'Q ∝ r⁴. (0.5)⁴ = 1/16 → 93.75% decrease. Radius is the dominant determinant.'},
  {q:'A randomized controlled trial (RCT) differs from a cohort study in that it:',ch:['Cannot demonstrate causation','Uses only retrospective data','Randomly assigns subjects to exposures, enabling causal inference','Is only used for rare diseases'],ans:2,cat:'research',exp:'RCT: randomization controls confounders → causal inference. Gold standard for interventions.'},
  {q:'Bohr effect: high CO₂/low pH in exercising muscle causes:',ch:['Left shift: ↑Hb-O₂ affinity','Right shift: ↓Hb-O₂ affinity → better O₂ delivery','No change in O₂ affinity','Increased Hb concentration'],ans:1,cat:'biosys',exp:'Bohr effect: acidosis → T-state stabilized → right shift → O₂ unloaded to active tissue.'},
  {q:'Variable ratio reinforcement produces behavior that is:',ch:['Easily extinguished','Most resistant to extinction','Only effective for simple behaviors','Less frequent than fixed ratio'],ans:1,cat:'psychsoc',exp:'VR: unpredictable timing prevents discrimination of extinction → highest resistance.'},
  {q:'In a galvanic cell, the anode is where:',ch:['Reduction occurs (gains e−)','The salt bridge is attached','Oxidation occurs (loses e−)','The external circuit terminates'],ans:2,cat:'chemphys',exp:'"An Ox, Red Cat": Anode = Oxidation; negative terminal in a galvanic cell.'},
  {q:"Piaget's concrete operational stage includes acquisition of:",ch:['Object permanence','Abstract hypothetical reasoning','Conservation and reversibility','Symbolic/language development'],ans:2,cat:'psychsoc',exp:'Concrete operational (7-11 yr): conservation (quantity preserved despite appearance), reversibility, classification.'},
  {q:'What area of medicine interests you MOST?',ch:['Working directly with patients — diagnosing and treating disease','Discovering new treatments — laboratory research and clinical trials','Mental health — understanding and healing the mind','All aspects equally — broad MCAT preparation'],ans:3,cat:'interest',exp:''},
  {q:'What is your PRIMARY MCAT study goal?',ch:['Master biological systems and biochemistry (Bio/Biochem focus)','Excel in chemistry and physics (C/P focus)','Build skills in psychology, sociology, and reasoning (P/S + CARS)','Strengthen all four sections equally'],ans:3,cat:'goal',exp:''},
];

/* ══════════════════════════════════════════════════════════════════
   SPECIALTY PATHS
══════════════════════════════════════════════════════════════════ */
const PATHS = {
  surgeon: { label:'General Surgery', icon:'stethoscope', accent:'#ef4444', tagline:'Mastery in anatomy, physiology & procedural sciences',
    units:[
      {id:'sg-u1', title:'Biochemistry Foundations', desc:'Enzymes, metabolism, molecular biology', cat:'Bio/Biochem', xp:150, lessons:[
        {id:'sg-l1', title:'Enzyme Kinetics', url:'https://www.khanacademy.org/test-prep/mcat/biomolecules', dur:'22 min', note:'Km = [S] at ½Vmax. Competitive: ↑Km, Vmax unchanged. Noncompetitive: Km unchanged, ↓Vmax.'},
        {id:'sg-l2', title:'Metabolic Pathways Overview', url:'https://www.khanacademy.org/test-prep/mcat/biomolecules', dur:'25 min', note:'Glycolysis → TCA → ETC. Net: 30-32 ATP per glucose. Key regulators: PFK-1, isocitrate DH.'},
        {id:'sg-l3', title:'Protein Structure & Collagen', url:'https://www.khanacademy.org/test-prep/mcat/biomolecules', dur:'18 min', note:'Collagen: triple helix, hydroxyproline requires Vit C. Scurvy = defective wound healing.'},
      ]},
      {id:'sg-u2', title:'Cardiovascular & Hematology', desc:'Heart, vessels, blood', cat:'Bio/Biochem', xp:175, lessons:[
        {id:'sg-l4', title:'Cardiac Output & Frank-Starling', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'CO = HR × SV. Starling: ↑preload → ↑SV. Sympathetics: ↑HR and ↑contractility.'},
        {id:'sg-l5', title:'Coagulation Cascade', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'Extrinsic (TF/VIIa) and intrinsic (XII) converge at factor X. Final: fibrinogen → fibrin.'},
        {id:'sg-l6', title:'Fluid Mechanics in Circulation', url:'https://www.khanacademy.org/test-prep/mcat', dur:'22 min', note:'Q = ΔP×πr⁴/(8ηL). Turbulence (Re>2000): bruits. Bernoulli: ↑v → ↓P at narrowing.'},
      ]},
      {id:'sg-u3', title:'Musculoskeletal & Wound Healing', desc:'Bones, muscles, tissue repair', cat:'Bio/Biochem', xp:175, lessons:[
        {id:'sg-l7', title:'Sliding Filament Theory', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'Ca²⁺ → troponin → tropomyosin shifts → myosin binds actin. Power stroke: ADP+Pi release.'},
        {id:'sg-l8', title:'Bone Remodeling', url:'https://www.khanacademy.org/test-prep/mcat', dur:'17 min', note:'PTH ↑Ca²⁺: bone resorption + renal Ca reabsorption + Vit D activation.'},
        {id:'sg-l9', title:'Immune Response & Inflammation', url:'https://www.khanacademy.org/test-prep/mcat', dur:'22 min', note:'Acute: neutrophils first; macrophages later. C3b = opsonin. TNF-α, IL-1,6: fever.'},
      ]},
    ]
  },
  internist: { label:'Internal Medicine', icon:'stethoscope', accent:'#3b82f6', tagline:'Mastery of diagnostic reasoning & pharmacology',
    units:[
      {id:'im-u1', title:'Endocrinology & Metabolism', desc:'Hormones, glucose homeostasis', cat:'Bio/Biochem', xp:175, lessons:[
        {id:'im-l1', title:'Insulin & Glucagon Signaling', url:'https://www.khanacademy.org/test-prep/mcat', dur:'22 min', note:'Fed: insulin ↑GLUT4, glycogen synthesis, lipogenesis. Fasted: glucagon ↑gluconeogenesis, ketogenesis.'},
        {id:'im-l2', title:'Thyroid & Adrenal Physiology', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'T3 = active (T4 converted peripherally). TSH negative feedback. Cushing = excess cortisol.'},
        {id:'im-l3', title:'Diabetes & Metabolic Syndrome', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'T1: autoimmune β-cell. T2: insulin resistance. DKA: ketosis + acidosis + hyperglycemia.'},
      ]},
      {id:'im-u2', title:'Pharmacology Principles', desc:'PK/PD, drug interactions', cat:'Bio/Biochem', xp:150, lessons:[
        {id:'im-l4', title:'ADME & Bioavailability', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'First-pass metabolism: oral → portal → liver. IV = 100% bioavailability.'},
        {id:'im-l5', title:'CYP450 Interactions', url:'https://www.khanacademy.org/test-prep/mcat', dur:'16 min', note:'Inducers ↑metabolism (rifampin, carbamazepine). Inhibitors ↓metabolism (azoles, macrolides, grapefruit).'},
        {id:'im-l6', title:'Receptor Pharmacology', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'ED50: effective in 50% of population. TI = LD50/ED50. Partial agonist: lower Emax.'},
      ]},
      {id:'im-u3', title:'Acid-Base & Electrolytes', desc:'Blood gas interpretation, RAAS', cat:'Chem/Phys', xp:175, lessons:[
        {id:'im-l7', title:'Blood Gas Analysis', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'Step 1: Acidosis (pH<7.35) or alkalosis (>7.45)? Step 2: respiratory or metabolic? Step 3: compensation?'},
        {id:'im-l8', title:'RAAS and Sodium Balance', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'↓BP → Renin → Ang I → Ang II (ACE) → vasoconstriction + aldosterone → Na⁺/water retention.'},
        {id:'im-l9', title:'Diuretics Mechanism & Use', url:'https://www.khanacademy.org/test-prep/mcat', dur:'16 min', note:'Loop (furosemide): TAL NKCC2. Thiazide: DCT NCC. K-sparing (spironolactone): aldosterone antagonist.'},
      ]},
    ]
  },
  psychiatrist: { label:'Psychiatry & Behavioral', icon:'brain', accent:'#8b5cf6', tagline:'Mastery of neuroscience, psychology & pharmacology',
    units:[
      {id:'ps-u1', title:'Neuroscience Foundations', desc:'Neurons, synapses, neurotransmitters', cat:'Bio/Biochem', xp:175, lessons:[
        {id:'ps-l1', title:'Action Potential & Membrane', url:'https://www.khanacademy.org/test-prep/mcat', dur:'22 min', note:'RMP -70mV. Depolarization: Na⁺ in. Repolarization: K⁺ out. Myelination: saltatory conduction.'},
        {id:'ps-l2', title:'Neurotransmitters & Drugs', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'DA: reward (VTA→NAcc), motor (SN→striatum). 5-HT: mood, GI. GABA: inhibitory. SSRIs block SERT.'},
        {id:'ps-l3', title:'Brain Anatomy & Function', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'Limbic: emotion/memory (amygdala, hippocampus). PFC: executive. BG: motor. Cerebellum: coordination.'},
      ]},
      {id:'ps-u2', title:'Psychological Disorders', desc:'DSM-5 categories, treatments', cat:'Psych/Soc', xp:175, lessons:[
        {id:'ps-l4', title:'Mood Disorders', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'MDD: ≥2 wk + ≥5 criteria. Bipolar I: ≥1 manic episode (≥7 days). Li+ for bipolar; SSRIs for MDD.'},
        {id:'ps-l5', title:'Anxiety & Trauma Disorders', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'GAD: ≥6 mo excessive worry. Panic disorder: recurrent panic attacks. PTSD: intrusion, avoidance, hyperarousal.'},
        {id:'ps-l6', title:'Schizophrenia Spectrum', url:'https://www.khanacademy.org/test-prep/mcat', dur:'22 min', note:'Positive: hallucinations, delusions, disorganized. Negative: flat affect, alogia, avolition. D2 blockade.'},
      ]},
      {id:'ps-u3', title:'Social Psychology & Development', desc:'Behavior, cognition, lifespan', cat:'Psych/Soc', xp:150, lessons:[
        {id:'ps-l7', title:'Developmental Lifespan Psychology', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'Piaget (cognitive), Erikson (psychosocial), Kohlberg (moral). Ainsworth: secure, avoidant, anxious-ambivalent.'},
        {id:'ps-l8', title:'Social Influence & Cognition', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'Milgram (obedience), Asch (conformity). Cognitive dissonance, attribution errors, availability heuristic.'},
        {id:'ps-l9', title:'Health Psychology & Stress', url:'https://www.khanacademy.org/test-prep/mcat', dur:'16 min', note:'HPA axis: CRH → ACTH → cortisol. SAM: immediate fight/flight. Biopsychosocial model. Locus of control.'},
      ]},
    ]
  },
  researcher: { label:'Research & Academia', icon:'flask', accent:'#f59e0b', tagline:'Mastery of molecular biology, statistics & research design',
    units:[
      {id:'re-u1', title:'Molecular Biology & Genetics', desc:'Gene expression, mutations, CRISPR', cat:'Bio/Biochem', xp:200, lessons:[
        {id:'re-l1', title:'DNA Replication & Repair', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'Semiconservative. Pol III: synthesis + 3→5 proofreading. BER, NER, MMR repair types.'},
        {id:'re-l2', title:'Transcription & Translation', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'RNA Pol II (mRNA). mRNA processing: 5 cap + poly-A + splicing. AUG start; UAA/UAG/UGA stop.'},
        {id:'re-l3', title:'Gene Regulation & Epigenetics', url:'https://www.khanacademy.org/test-prep/mcat', dur:'22 min', note:'Methylation: silences genes. Acetylation: activates. CRISPR-Cas9: guide RNA + Cas9 = targeted DSB.'},
      ]},
      {id:'re-u2', title:'Epidemiology & Biostatistics', desc:'Study design, bias, statistics', cat:'Psych/Soc', xp:175, lessons:[
        {id:'re-l4', title:'Study Design Hierarchy', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'RCT > cohort > case-control > cross-sectional. RCT → RR. Case-control → OR.'},
        {id:'re-l5', title:'Diagnostic Test Statistics', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'Se = TP/(TP+FN). Sp = TN/(TN+FP). PPV increases with higher prevalence. SnNout; SpPin.'},
        {id:'re-l6', title:'Statistical Testing & Error', url:'https://www.khanacademy.org/test-prep/mcat', dur:'16 min', note:'p < 0.05: reject H0. Type I (α): false positive. Type II (β): false negative. Power = 1-β.'},
      ]},
      {id:'re-u3', title:'Physical Chemistry & Lab Methods', desc:'Spectroscopy, thermodynamics, NMR', cat:'Chem/Phys', xp:175, lessons:[
        {id:'re-l7', title:'Spectroscopy (IR, NMR, MS)', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'IR: ~1700 cm-1 = C=O; ~3300 = O-H/N-H. NMR: n+1 rule; δ ppm. MS: M+ = MW.'},
        {id:'re-l8', title:'Thermodynamics & Gibbs Energy', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'ΔG = ΔH - TΔS. Spontaneous: ΔG < 0. ΔG° = -RTlnKeq. Arrhenius: k = Ae^(-Ea/RT).'},
        {id:'re-l9', title:'Electrophoresis & Chromatography', url:'https://www.khanacademy.org/test-prep/mcat', dur:'16 min', note:'SDS-PAGE: size. Native PAGE: charge+size. Isoelectric focusing: pI. Ion exchange: charge.'},
      ]},
    ]
  },
  pediatrician: { label:'Pediatrics & Family Medicine', icon:'stethoscope', accent:'#10b981', tagline:'Child development, immunology & family-centered care',
    units:[
      {id:'pe-u1', title:'Child Development', desc:'Milestones, cognition, psychology', cat:'Psych/Soc', xp:175, lessons:[
        {id:'pe-l1', title:'Developmental Milestones', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'Gross motor first (roll, sit, walk), then fine motor, language, social.'},
        {id:'pe-l2', title:'Piaget & Cognitive Development', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'Sensorimotor (0-2): object permanence. Preoperational (2-7): symbolic. Concrete (7-11): conservation.'},
        {id:'pe-l3', title:'Attachment Theory', url:'https://www.khanacademy.org/test-prep/mcat', dur:'16 min', note:'Ainsworth: secure (60%), avoidant (20%), anxious-ambivalent (15%), disorganized (5%).'},
      ]},
      {id:'pe-u2', title:'Immunology & Infectious Disease', desc:'Immune system, vaccines, infections', cat:'Bio/Biochem', xp:175, lessons:[
        {id:'pe-l4', title:'Innate vs Adaptive Immunity', url:'https://www.khanacademy.org/test-prep/mcat', dur:'22 min', note:'Innate: non-specific (macrophages, NK cells, complement). MHC I → CD8+; MHC II → CD4+.'},
        {id:'pe-l5', title:'Antibody Structure & Classes', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'IgM: first response (pentamer). IgG: crosses placenta. IgA: secretory/mucosal. IgE: allergy/parasites.'},
        {id:'pe-l6', title:'Hypersensitivity Reactions', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'Type I: IgE + mast cells (anaphylaxis). II: IgG/M cytotoxic. III: immune complexes. IV: T-cell, delayed.'},
      ]},
      {id:'pe-u3', title:'Genetics & Chromosomal Disorders', desc:'Inheritance, genetic diseases', cat:'Bio/Biochem', xp:150, lessons:[
        {id:'pe-l7', title:'Mendelian Genetics', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'AD (Huntington, BRCA), AR (CF, sickle cell), X-linked (hemophilia). Punnett squares, pedigree.'},
        {id:'pe-l8', title:'Chromosomal Disorders', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'Down (trisomy 21): ↑maternal age, MR + cardiac. Turner (45,X): infertile, short. Klinefelter (47,XXY): infertile.'},
        {id:'pe-l9', title:'Hardy-Weinberg Equilibrium', url:'https://www.khanacademy.org/test-prep/mcat', dur:'16 min', note:'p² + 2pq + q² = 1. p + q = 1. Equilibrium requires: large population, random mating, no selection/mutation.'},
      ]},
    ]
  },
  emergency_doc: { label:'Emergency Medicine', icon:'bolt', accent:'#f97316', tagline:'Fast-paced clinical thinking & acute care sciences',
    units:[
      {id:'em-u1', title:'Cardiopulmonary Physiology', desc:'Heart, lungs, oxygenation', cat:'Bio/Biochem', xp:175, lessons:[
        {id:'em-l1', title:'Hemoglobin & O₂ Transport', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'Bohr: ↑CO₂/↓pH → right shift (↓affinity). CO: left shift (cannot unload O₂). HbF: higher affinity than HbA.'},
        {id:'em-l2', title:'ABG Interpretation', url:'https://www.khanacademy.org/test-prep/mcat', dur:'22 min', note:'pH, PaCO₂, HCO₃⁻. Resp acidosis: ↑PaCO₂. Met acidosis: ↓HCO₃⁻. Determine primary then compensation.'},
        {id:'em-l3', title:'Shock: Types & Pathophysiology', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'Hypovolemic: ↓preload, ↑HR, ↑SVR. Septic: ↓SVR, ↑CO initially. Cardiogenic: ↑PCWP, ↓CO.'},
      ]},
      {id:'em-u2', title:'Toxicology & Pharmacology', desc:'Drug mechanisms, overdose, antidotes', cat:'Bio/Biochem', xp:175, lessons:[
        {id:'em-l4', title:'Drug Overdose & Antidotes', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'Acetaminophen: NAC. Opioids: naloxone. Benzos: flumazenil. Organophosphates: atropine + pralidoxime.'},
        {id:'em-l5', title:'Antibiotic Mechanisms', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'Beta-lactams: PBP → cell wall. Aminoglycosides: 30S → protein synthesis. Fluoroquinolones: gyrase → DNA.'},
        {id:'em-l6', title:'Autonomic Pharmacology', url:'https://www.khanacademy.org/test-prep/mcat', dur:'16 min', note:'β1: ↑HR, ↑contractility (dobutamine, epi). β2: bronchodilation (albuterol). α1: vasoconstriction (phenylephrine).'},
      ]},
      {id:'em-u3', title:'Neurological Emergencies', desc:'Neuro anatomy, stroke, seizures', cat:'Bio/Biochem', xp:150, lessons:[
        {id:'em-l7', title:'Stroke & Cerebrovascular Anatomy', url:'https://www.khanacademy.org/test-prep/mcat', dur:'20 min', note:'MCA stroke: contralateral face+arm weakness, aphasia. ACA: contralateral leg. PCA: visual field defect.'},
        {id:'em-l8', title:'Intracranial Pressure', url:'https://www.khanacademy.org/test-prep/mcat', dur:'18 min', note:'Monroe-Kellie: brain + blood + CSF = constant. Cushing triad: ↑BP, ↓HR, irregular respirations.'},
        {id:'em-l9', title:'Seizures & Epilepsy', url:'https://www.khanacademy.org/test-prep/mcat', dur:'16 min', note:'Tonic-clonic (grand mal): LOC + convulsions. Absence (petit mal): blank stare, 3 Hz spike-wave. Benzos first-line.'},
      ]},
    ]
  },
};

/* ══════════════════════════════════════════════════════════════════
   MMI INTERVIEW QUESTIONS (20 stations)
══════════════════════════════════════════════════════════════════ */
const MMI_QS = [
  {q:'A 16-year-old patient is 12 weeks pregnant and wants an abortion. Her parents oppose this. What do you do?', type:'Ethics', points:['Adolescent autonomy','Mature minor doctrine','Confidentiality','Family dynamics']},
  {q:'You discover your supervising attending is prescribing opioids for a family member without seeing the patient. How do you handle this?', type:'Ethics', points:['Professional responsibility','Reporting obligations','Due process','Hierarchy in medicine']},
  {q:'A patient refuses a lifesaving blood transfusion due to religious beliefs. They are conscious and competent. Describe your approach.', type:'Ethics', points:['Informed refusal','Respect for autonomy','Capacity assessment','Documentation']},
  {q:'During surgery, you believe the attending is making a serious error. What do you do?', type:'Professionalism', points:['Speak up culture','Chain of command','Patient safety first','Professional courage']},
  {q:'A terminally ill patient asks you to help them die. How do you respond?', type:'Ethics', points:['Physician-assisted death laws','Palliative care alternatives','Moral distress','Patient autonomy vs. harm']},
  {q:'Tell me about a time you failed at something important. What did you learn?', type:'Personal', points:['Accountability','Growth mindset','Specific example','Application to medicine']},
  {q:'Describe your greatest non-academic achievement and how it prepared you for medicine.', type:'Personal', points:['Leadership or service','Transferable skills','Self-reflection','Connection to physician qualities']},
  {q:'What is your biggest weakness, and how are you working to address it?', type:'Personal', points:['Honest self-awareness','Concrete actions taken','Not a humble brag','Relevance to medicine']},
  {q:'Why do you want to be a physician and not a nurse, PA, or another healthcare role?', type:'Motivation', points:['Understand all roles','Specific to MD scope','Clinical experiences shaped this','Long-term goals']},
  {q:'How would you address healthcare disparities in a rural underserved community where you are the only physician?', type:'Policy', points:['Understanding of SDOH','Community needs assessment','Resource-limited solutions','Telemedicine and prevention']},
  {q:'Should healthcare be a universal right or a market-based commodity? Defend your answer.', type:'Policy', points:['Current US system','International comparisons','Equity arguments','Economic sustainability']},
  {q:'How should the medical profession address its history of racism and exploitation of minority communities?', type:'Policy', points:['Tuskegee and historical abuses','Trust rebuilding','Diversity in medicine','Structural vs. individual racism']},
  {q:'A patient from a different cultural background refuses medically necessary treatment, citing traditional healing practices. How do you respond?', type:'Cultural Competency', points:['Cultural humility','Understanding without dismissing','Collaborative compromise','Respect for autonomy']},
  {q:'You are working with a team member who is clearly burned out and making small errors. Describe how you handle this.', type:'Professionalism', points:['Physician wellness','Team safety','Direct vs. supervisor approach','Compassion and accountability']},
  {q:'Tell me about a time you had to deliver bad news to someone. What was your approach?', type:'Communication', points:['SPIKES protocol','Empathy vs. information overload','Follow-up and support','Non-verbal communication']},
  {q:'How do you handle situations where you disagree with a patient's lifestyle choices that affect their health?', type:'Communication', points:['Non-judgmental communication','Motivational interviewing','Respecting autonomy','Long-term therapeutic relationship']},
  {q:'You are in a crowded restaurant and see someone collapse. You are a medical student. What do you do?', type:'Situational', points:['Call 911 first','ABCs assessment','Good Samaritan laws','Scope of training vs. duty']},
  {q:'You overhear a colleague making racially insensitive comments about a patient in the break room. How do you respond?', type:'Professionalism', points:['Bystander intervention','Immediate vs. later confrontation','Reporting to supervisor','Creating inclusive culture']},
  {q:'Where do you see yourself in 15 years as a physician?', type:'Motivation', points:['Realistic about residency timeline','Specific specialty or population interest','Research or academic goals','Flexibility and adaptability']},
  {q:'Do you think physicians should be involved in advocacy and politics? Why or why not?', type:'Policy', points:['Physician as social advocate','Historical precedents','Professional neutrality concerns','Both sides represented']},
];

/* ══════════════════════════════════════════════════════════════════
   MEDICAL SCHOOL DATA (30 schools)
══════════════════════════════════════════════════════════════════ */
const SCHOOL_DATA = [
  {name:'Harvard Medical School',    gpa:3.93, mcat:522, rate:3,  resReq:true,  state:'MA', type:'Private', prestige:10},
  {name:'Johns Hopkins Medicine',    gpa:3.94, mcat:523, rate:6,  resReq:false, state:'MD', type:'Private', prestige:10},
  {name:'Stanford Medicine',         gpa:3.82, mcat:520, rate:2,  resReq:false, state:'CA', type:'Private', prestige:10},
  {name:'UCSF School of Medicine',   gpa:3.82, mcat:517, rate:3,  resReq:false, state:'CA', type:'Public',  prestige:9},
  {name:'Penn (Perelman)',            gpa:3.90, mcat:522, rate:4,  resReq:false, state:'PA', type:'Private', prestige:9},
  {name:'Columbia Vagelos (VP&S)',   gpa:3.86, mcat:522, rate:4,  resReq:false, state:'NY', type:'Private', prestige:9},
  {name:'Duke School of Medicine',   gpa:3.84, mcat:521, rate:4,  resReq:false, state:'NC', type:'Private', prestige:9},
  {name:'Washington University STL', gpa:3.91, mcat:521, rate:6,  resReq:true,  state:'MO', type:'Private', prestige:9},
  {name:'Mayo Clinic Alix School',   gpa:3.91, mcat:520, rate:2,  resReq:true,  state:'MN', type:'Private', prestige:9},
  {name:'Vanderbilt Medical',        gpa:3.86, mcat:521, rate:5,  resReq:false, state:'TN', type:'Private', prestige:8},
  {name:'Michigan Medicine',         gpa:3.86, mcat:517, rate:7,  resReq:false, state:'MI', type:'Public',  prestige:8},
  {name:'Northwestern Feinberg',     gpa:3.90, mcat:519, rate:7,  resReq:false, state:'IL', type:'Private', prestige:8},
  {name:'Cornell (Weill)',           gpa:3.87, mcat:522, rate:5,  resReq:false, state:'NY', type:'Private', prestige:8},
  {name:'Yale School of Medicine',   gpa:3.84, mcat:521, rate:6,  resReq:true,  state:'CT', type:'Private', prestige:8},
  {name:'Emory School of Medicine',  gpa:3.75, mcat:516, rate:8,  resReq:false, state:'GA', type:'Private', prestige:7},
  {name:'UCLA Geffen School',        gpa:3.80, mcat:517, rate:3,  resReq:true,  state:'CA', type:'Public',  prestige:8},
  {name:'UT Southwestern',           gpa:3.89, mcat:519, rate:7,  resReq:true,  state:'TX', type:'Public',  prestige:8},
  {name:'UNC School of Medicine',    gpa:3.72, mcat:514, rate:8,  resReq:true,  state:'NC', type:'Public',  prestige:7},
  {name:'Baylor College of Medicine',gpa:3.87, mcat:519, rate:5,  resReq:false, state:'TX', type:'Private', prestige:8},
  {name:'Pittsburgh School of Med',  gpa:3.73, mcat:518, rate:6,  resReq:false, state:'PA', type:'Private', prestige:7},
  {name:'Boston University Medicine',gpa:3.71, mcat:515, rate:4,  resReq:false, state:'MA', type:'Private', prestige:7},
  {name:'Georgetown Medicine',       gpa:3.63, mcat:511, rate:4,  resReq:false, state:'DC', type:'Private', prestige:6},
  {name:'Thomas Jefferson',          gpa:3.65, mcat:513, rate:6,  resReq:false, state:'PA', type:'Private', prestige:6},
  {name:'Temple Katz',               gpa:3.58, mcat:511, rate:7,  resReq:false, state:'PA', type:'Private', prestige:6},
  {name:'Tulane School of Medicine', gpa:3.65, mcat:512, rate:5,  resReq:false, state:'LA', type:'Private', prestige:6},
  {name:'Case Western Reserve',      gpa:3.73, mcat:516, rate:8,  resReq:false, state:'OH', type:'Private', prestige:7},
  {name:'U of Virginia (UVA)',       gpa:3.82, mcat:517, rate:8,  resReq:true,  state:'VA', type:'Public',  prestige:7},
  {name:'U of Colorado Anschutz',    gpa:3.78, mcat:512, rate:7,  resReq:true,  state:'CO', type:'Public',  prestige:7},
  {name:'Indiana University School', gpa:3.73, mcat:512, rate:7,  resReq:true,  state:'IN', type:'Public',  prestige:6},
  {name:'U of South Carolina',       gpa:3.56, mcat:508, rate:9,  resReq:true,  state:'SC', type:'Public',  prestige:5},
];

/* ─── Utility components ─────────────────────────────────────────── */
const Stars = ({ level, size = 16 }) => {
  const colors = ['#6b7280','#ef4444','#f59e0b','#3b82f6','#10b981'];
  return (
    <span style={{ display:'inline-flex', gap:2, alignItems:'center' }}>
      {[0,1,2,3].map(i => (
        <Icon key={i} name={i < level ? 'star' : 'starEmpty'} size={size}
          color={i < level ? colors[Math.min(level, 4)] : '#374151'} />
      ))}
    </span>
  );
};

const PieRing = ({ pct, size = 48, color = '#3b82f6' }) => {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.7s ease' }} />
    </svg>
  );
};

/* ─── QUIZ ENGINE ────────────────────────────────────────────────── */
const QuizEngine = memo(({ questions, onFinish, title }) => {
  const [qi, setQi] = useState(0);
  const [sel, setSel] = useState(null);
  const [confirmed, setConf] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const LETTERS = ['A','B','C','D'];
  const q = questions[qi];

  const handleConfirm = useCallback(() => {
    if (sel === null) return;
    setConf(true);
    if (sel === q.ans) setScore(s => s + 1);
    setResults(r => [...r, { qi, sel, correct: sel === q.ans }]);
  }, [sel, q]);

  const handleNext = useCallback(() => {
    if (qi + 1 >= questions.length) {
      onFinish(score + (sel === q.ans ? 1 : 0), questions.length);
    } else {
      setQi(i => i + 1); setSel(null); setConf(false);
    }
  }, [qi, score, sel, q, questions.length, onFinish]);

  if (showAll) {
    const final = score + (confirmed && sel === q.ans ? 1 : 0);
    const pct = Math.round((final / questions.length) * 100);
    return (
      <div style={{ maxWidth:680, margin:'0 auto' }}>
        <div style={{ textAlign:'center', padding:'28px 0 20px' }}>
          <div style={{ fontSize:44, fontWeight:900, color: pct>=80?'#10b981':pct>=60?'#3b82f6':'#f59e0b', marginBottom:6 }}>{pct}%</div>
          <div style={{ color:'rgba(255,255,255,0.45)', fontSize:14 }}>{final} / {questions.length} correct · {title}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
          {questions.map((question, i) => {
            const res = results.find(r => r.qi === i);
            const ok = res?.correct;
            return (
              <div key={i} style={{ background: ok?'rgba(16,185,129,0.06)':'rgba(239,68,68,0.06)', border:`1px solid ${ok?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.2)'}`, borderRadius:12, padding:'12px 14px' }}>
                <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
                  <Icon name={ok?'check':'x'} size={13} color={ok?'#10b981':'#ef4444'} />
                  <span style={{ fontSize:11, fontWeight:700, color:ok?'#10b981':'#ef4444' }}>Q{i+1} — {ok?'Correct':`Correct: ${LETTERS[question.ans]}`}</span>
                </div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.7)', marginBottom:6, lineHeight:1.5 }}>{question.q}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', lineHeight:1.5 }}><strong style={{ color:'rgba(255,255,255,0.5)' }}>Explanation: </strong>{question.exp}</div>
              </div>
            );
          })}
        </div>
        <button onClick={() => onFinish(final, questions.length)} style={{ width:'100%', padding:'12px', background:'rgba(59,130,246,0.8)', border:'none', borderRadius:12, color:'white', fontWeight:700, cursor:'pointer', fontSize:14 }}>Done</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:680, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:600 }}>{title ? `${title} · ` : ''}Q{qi+1}/{questions.length}</span>
        <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'rgba(59,130,246,0.12)', color:'#93c5fd' }}>{q.cat || ''}</span>
      </div>
      <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:2, marginBottom:18, overflow:'hidden' }}>
        <div style={{ height:'100%', background:'linear-gradient(90deg,#3b82f6,#6366f1)', width:`${(qi/questions.length)*100}%`, transition:'width 0.4s ease', borderRadius:2 }} />
      </div>
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'18px 20px', marginBottom:14 }}>
        <div style={{ fontSize:15, color:'#f1f5f9', lineHeight:1.65 }}>{q.q}</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:14 }}>
        {q.ch.map((choice, i) => {
          let bg = 'rgba(255,255,255,0.03)', border = 'rgba(255,255,255,0.07)', color = 'rgba(255,255,255,0.75)';
          if (!confirmed && sel === i) { bg='rgba(59,130,246,0.1)'; border='rgba(59,130,246,0.4)'; color='white'; }
          if (confirmed) {
            if (i === q.ans) { bg='rgba(16,185,129,0.08)'; border='rgba(16,185,129,0.35)'; color='#6ee7b7'; }
            else if (i === sel) { bg='rgba(239,68,68,0.08)'; border='rgba(239,68,68,0.35)'; color='rgba(255,255,255,0.4)'; }
            else { bg='transparent'; border='rgba(255,255,255,0.04)'; color='rgba(255,255,255,0.3)'; }
          }
          const letterBg = !confirmed && sel===i ? '#3b82f6' : confirmed && i===q.ans ? '#10b981' : confirmed && i===sel ? '#ef4444' : 'rgba(255,255,255,0.06)';
          return (
            <button key={i} disabled={confirmed} onClick={() => setSel(i)}
              style={{ display:'flex', alignItems:'flex-start', gap:11, padding:'11px 13px', borderRadius:12, border:`1px solid ${border}`, background:bg, color, textAlign:'left', cursor:confirmed?'default':'pointer', transition:'all 0.15s', fontSize:14, lineHeight:1.5, fontFamily:'inherit' }}>
              <span style={{ width:25, height:25, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0, background:letterBg, color:'white' }}>{LETTERS[i]}</span>
              <span style={{ paddingTop:2 }}>{choice}</span>
            </button>
          );
        })}
      </div>
      {confirmed && (
        <div style={{ background:sel===q.ans?'rgba(16,185,129,0.06)':'rgba(239,68,68,0.06)', border:`1px solid ${sel===q.ans?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.2)'}`, borderRadius:13, padding:'13px 15px', marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:700, color:sel===q.ans?'#10b981':'#f87171', marginBottom:5 }}>{sel===q.ans?'✓ Correct!':'✗ Incorrect'}</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', lineHeight:1.6 }}>{q.exp}</div>
        </div>
      )}
      <div style={{ display:'flex', gap:9 }}>
        {!confirmed
          ? <button onClick={handleConfirm} disabled={sel===null} style={{ flex:1, padding:'12px', borderRadius:11, border:'none', background:sel!==null?'white':'rgba(255,255,255,0.08)', color:sel!==null?'#030014':'rgba(255,255,255,0.3)', fontWeight:700, cursor:sel!==null?'pointer':'not-allowed', fontSize:14, transition:'all 0.2s', fontFamily:'inherit' }}>Confirm Answer</button>
          : <>
              <button onClick={() => setShowAll(true)} style={{ padding:'12px 18px', borderRadius:11, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.6)', fontWeight:600, cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>Review All</button>
              <button onClick={handleNext} style={{ flex:1, padding:'12px', borderRadius:11, border:'none', background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:'inherit' }}>{qi+1>=questions.length?'View Results →':'Next Question →'}</button>
            </>
        }
      </div>
    </div>
  );
});
              style={{ width: 26, height: 26, borderRadius: 8, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: (!confirmed && sel === i) ? '#3b82f6' : (confirmed && i === q.ans) ? '#10b981' : (confirmed && i === sel) ? '#ef4444' : 'rgba(255,255,255,0.06)', color: 'white' }}>
                {LETTERS[i]}
              </span>
              <span style={{ paddingTop: 2 }}>{choice}</span>
            </button>
          );
        })}
      </div>
      {/* Explanation */}
      {confirmed && (
        <div style={{ background: sel === q.ans ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${sel === q.ans ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: sel === q.ans ? '#10b981' : '#f87171', marginBottom: 6 }}>
            {sel === q.ans ? '✓ Correct!' : '✗ Incorrect'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{q.exp}</div>
        </div>
      )}
      {/* Actions */}
      <div style={{ display:'flex', gap: 10 }}>
        {!confirmed
          ? <button onClick={handleConfirm} disabled={sel === null}
              style={{ flex:1, padding:'12px', borderRadius: 12, border:'none', background: sel !== null ? 'white' : 'rgba(255,255,255,0.08)', color: sel !== null ? '#030014' : 'rgba(255,255,255,0.3)', fontWeight: 700, cursor: sel !== null ? 'pointer' : 'not-allowed', fontSize: 14, transition:'all 0.2s' }}>
              Confirm Answer
            </button>
          : <>
              <button onClick={() => setShowAll(true)}
                style={{ padding:'12px 20px', borderRadius: 12, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.6)', fontWeight: 600, cursor:'pointer', fontSize: 13 }}>
                Review All
              </button>
              <button onClick={handleNext}
                style={{ flex:1, padding:'12px', borderRadius: 12, border:'none', background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white', fontWeight: 700, cursor:'pointer', fontSize: 14 }}>
                {qi + 1 >= questions.length ? 'View Results →' : 'Next Question →'}
              </button>
            </>
        }
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════════════ */
export default function App() {
  // ── Core state ──
  const [tab, setTab]         = useState('home');
  const [user, setUser]       = useState(() => ls.get('msp_user2', { name:'', specialty:null, xp:0, streak:0, lastActive:null, portfolioItems:[] }));
  const [pathway, setPathway] = useState(() => ls.get('msp_pathway2', {}));

  // ── Pomodoro ──
  const [pomSecs, setPomSecs]   = useState(25 * 60);
  const [pomActive, setPomAct]  = useState(false);
  const [pomBreak, setPomBreak] = useState(false);
  const pomRef = useRef(null);

  // ── Diagnostic ──
  const [diagStep, setDiagStep]   = useState(0);
  const [diagAnswers, setDiagAns] = useState([]);
  const [diagDone, setDiagDone]   = useState(false);

  // ── AI Coach chat ──
  const [msgs, setMsgs]         = useState([{ role:'assistant', content:"Hey! I'm your MetaBrain AI coach 🩺 Ask me anything — enzyme kinetics, CARS strategy, MMI prep, study plans, or literally any MCAT topic. What are we tackling today?" }]);
  const [chatInput, setChatIn]  = useState('');
  const [chatLoad, setChatLoad] = useState(false);
  const chatEndRef = useRef(null);

  // ── Quiz library ──
  const [quizCat, setQuizCat]       = useState('All');
  const [quizSearch, setQuizSearch] = useState('');
  const [quizDiff, setQuizDiff]     = useState('All');
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizScores, setQuizScores] = useState(() => ls.get('msp_quiz_scores', {}));

  // ── Flashcards ──
  const [flashDeck, setFlashDeck]       = useState(null);
  const [flashIdx, setFlashIdx]         = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);
  const [customDecks, setCustomDecks]   = useState(() => ls.get('msp_custom_decks', {}));
  const [deckGenInput, setDeckGenInput] = useState('');
  const [deckGenLoad, setDeckGenLoad]   = useState(false);
  const [deckGenName, setDeckGenName]   = useState('');

  // ── Library ──
  const [libCat, setLibCat]       = useState('All');
  const [libSearch, setLibSearch] = useState('');

  // ── Portfolio ──
  const [portItems, setPortItems]   = useState(() => ls.get('msp_portfolio', []));
  const [compState, setCompState]   = useState('');
  const [compFilter, setCompFilter] = useState('All');
  const [newActivity, setNewAct]    = useState({ title:'', type:'Clinical', date:'' });

  // ── Interview ──
  const [mmiQ, setMmiQ]           = useState(null);
  const [mmiFilter, setMmiFilter] = useState('All');
  const [mmiAnswer, setMmiAns]    = useState('');
  const [mmiFeedback, setMmiFB]   = useState('');
  const [mmiLoad, setMmiLoad]     = useState(false);
  const [mmiTimer, setMmiTimer]   = useState(0);
  const mmiTimerRef = useRef(null);

  // ── Admissions ──
  const [gpa, setGpa]                   = useState('');
  const [mcat, setMcatScore]            = useState('');
  const [researchYrs, setResearchYrs]   = useState('');
  const [clinicalHrs, setClinicalHrs]   = useState('');
  const [volHrs, setVolHrs]             = useState('');
  const [stateFilter, setStateFilter]   = useState('');
  const [schoolType, setSchoolType]     = useState('All');
  const [calcResults, setCalcResults]   = useState(null);

  // ── Path view ──
  const [activeUnit, setActiveUnit] = useState(null);

  // ── Persistence ──
  useEffect(() => { ls.set('msp_user2', user); }, [user]);
  useEffect(() => { ls.set('msp_pathway2', pathway); }, [pathway]);
  useEffect(() => { ls.set('msp_quiz_scores', quizScores); }, [quizScores]);
  useEffect(() => { ls.set('msp_portfolio', portItems); }, [portItems]);
  useEffect(() => { ls.set('msp_custom_decks', customDecks); }, [customDecks]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs, chatLoad]);

  // ── Pomodoro timer ──
  useEffect(() => {
    if (pomActive) {
      pomRef.current = setInterval(() => {
        setPomSecs(t => {
          if (t <= 1) {
            clearInterval(pomRef.current);
            setPomAct(false);
            setPomBreak(b => !b);
            return pomBreak ? 25 * 60 : 5 * 60;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      clearInterval(pomRef.current);
    }
    return () => clearInterval(pomRef.current);
  }, [pomActive, pomBreak]);

  const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  // ── MMI interview timer ──
  useEffect(() => {
    if (mmiQ) {
      setMmiTimer(0);
      clearInterval(mmiTimerRef.current);
      mmiTimerRef.current = setInterval(() => setMmiTimer(t => t + 1), 1000);
    } else {
      clearInterval(mmiTimerRef.current);
    }
    return () => clearInterval(mmiTimerRef.current);
  }, [mmiQ]);

  // ── Diagnostic logic ──
  function handleDiagAnswer(idx, optIdx) {
    const newAnswers = [...diagAnswers, optIdx];
    setDiagAns(newAnswers);
    if (idx + 1 >= DIAG_QS.length) {
      // Score
      const scores = { biochem:0, biosys:0, chemphys:0, psychsoc:0, research:0 };
      DIAG_QS.slice(0,10).forEach((q, i) => {
        if (q.cat && q.cat !== 'interest' && q.cat !== 'goal') {
          if (newAnswers[i] === q.ans) scores[q.cat] = (scores[q.cat] || 0) + 1;
        }
      });
      const interest = newAnswers[10];
      let specialty = 'internist';
      if (interest === 0) specialty = 'surgeon';
      else if (interest === 1) specialty = 'researcher';
      else if (interest === 2) specialty = 'psychiatrist';
      else {
        // Use content scores
        const best = Object.entries(scores).sort((a,b) => b[1]-a[1])[0][0];
        const specialtyMap = { biochem:'researcher', biosys:'surgeon', chemphys:'emergency_doc', psychsoc:'psychiatrist', research:'researcher' };
        specialty = specialtyMap[best] || 'internist';
      }
      setUser(u => ({ ...u, specialty, xp: u.xp + 100 }));
      // Init pathway
      const path = PATHS[specialty];
      const init = {};
      path.units.forEach((u,i) => { init[u.id] = { unlocked: i === 0, lessonsComplete: [], masteryScore: null }; });
      setPathway(init);
      setDiagDone(true);
    } else {
      setDiagStep(idx + 1);
    }
  }

  // ── AI Chat ──
  const sendChat = useCallback(async (text) => {
    const msg = (text || chatInput).trim();
    if (!msg || chatLoad) return;
    setChatIn('');
    const newMsgs = [...msgs, { role:'user', content: msg }];
    setMsgs(newMsgs);
    setChatLoad(true);
    const ctx = user.specialty ? `The student is on the ${PATHS[user.specialty]?.label} pathway.` : '';
    const systemPrompt = `You are MetaBrain, an elite MCAT and pre-med AI coach. ${ctx} Be concise, high-yield, and encouraging. Use mnemonics and clinical correlates. End with one helpful follow-up question.`;
    try {
      const reply = await callAI(systemPrompt, null, 700, newMsgs.map(m => ({ role: m.role, content: m.content })));
      setMsgs([...newMsgs, { role:'assistant', content: reply || 'No response — please try again.' }]);
    } catch(e) {
      setMsgs([...newMsgs, { role:'assistant', content: `⚠️ ${e.message}. Ensure OPENAI_KEY is set in Vercel Environment Variables.` }]);
    }
    setChatLoad(false);
  }, [chatInput, chatLoad, msgs, user.specialty]);

  // ── Generate AI flashcard deck ──
  const generateDeck = useCallback(async () => {
    if (!deckGenInput.trim() || deckGenLoad) return;
    setDeckGenLoad(true);
    const name = deckGenName.trim() || `Custom Deck ${Object.keys(customDecks).length + 1}`;
    try {
      const raw = await callAI(
        'Generate MCAT-style flashcards from the notes provided. Return ONLY a valid JSON array of objects with "front" and "back" string keys. No markdown code fences, no preamble, no trailing text — pure JSON only. Generate 10-14 high-yield cards.',
        deckGenInput,
        1500
      );
      const cards = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (!Array.isArray(cards) || cards.length === 0) throw new Error('No cards returned');
      setCustomDecks(d => ({ ...d, [name]: cards }));
      setFlashDeck(name);
      setFlashIdx(0);
      setFlashFlipped(false);
      setDeckGenInput('');
      setDeckGenName('');
    } catch(e) {
      alert(`Could not generate flashcards: ${e.message}. Ensure OPENAI_KEY is set in Vercel Environment Variables.`);
    }
    setDeckGenLoad(false);
  }, [deckGenInput, deckGenLoad, deckGenName, customDecks]);

  // ── MMI AI Feedback ──
  const getMmiFeedback = useCallback(async () => {
    if (!mmiAnswer.trim() || mmiLoad || !mmiQ) return;
    setMmiLoad(true);
    try {
      const feedback = await callAI(
        'You are an expert MMI medical school interview coach. Evaluate the candidate answer on 5 dimensions, scoring each 1-10: Structure, Content & Knowledge, Empathy & Ethics, Communication, Overall. Then list exactly 2 Strengths and 2 Areas to Improve. Finally, provide a brief Model Answer Framework (3-4 bullet points). Be direct, specific, and constructive.',
        `MMI Question: "${mmiQ.q}"\n\nCandidate Answer: "${mmiAnswer}"\n\nTime used: ${fmtTime(mmiTimer)}`,
        700
      );
      setMmiFB(feedback || '⚠️ No feedback received. Try again.');
    } catch(e) {
      setMmiFB(`⚠️ ${e.message}. Ensure OPENAI_KEY is set in Vercel Environment Variables.`);
    }
    setMmiLoad(false);
  }, [mmiAnswer, mmiLoad, mmiQ, mmiTimer]);

  // ── Admissions calculator ──
  function calcAdmissions() {
    const g = parseFloat(gpa);
    const m = parseInt(mcat);
    if (!g || !m || g < 2.0 || g > 4.0 || m < 472 || m > 528) {
      alert('Enter a valid GPA (2.0–4.0) and MCAT score (472–528).');
      return;
    }
    const rYrs = parseFloat(researchYrs) || 0;
    const cHrs = parseInt(clinicalHrs) || 0;
    const vHrs = parseInt(volHrs) || 0;

    // Extra score adjustments based on ECs
    const ecBonus = Math.min(2, rYrs * 0.3 + (cHrs > 200 ? 0.5 : cHrs > 100 ? 0.3 : 0) + (vHrs > 150 ? 0.3 : vHrs > 50 ? 0.15 : 0));

    const results = SCHOOL_DATA
      .filter(s => {
        if (schoolType !== 'All' && s.type !== schoolType) return false;
        if (stateFilter.trim()) {
          const sf = stateFilter.trim().toUpperCase();
          if (s.resReq && s.state !== sf) return false;
        }
        return true;
      })
      .map(s => {
        const gpaGap  = g - s.gpa;
        const mcatGap = m - s.mcat;
        let score = gpaGap * 15 + mcatGap * 0.8 + ecBonus;
        let tier = score >= 0 ? (score >= 1.5 ? 'Likely' : 'Target') : (score >= -2 ? 'Reach' : 'Stretch');
        return { ...s, tier, score };
      })
      .sort((a,b) => b.score - a.score);
    setCalcResults(results);
  }

  // ── Path helpers ──
  const currentPath = user.specialty && PATHS[user.specialty] ? PATHS[user.specialty] : null;

  function completeLesson(unitId, lessonId) {
    setPathway(prev => ({
      ...prev,
      [unitId]: {
        ...prev[unitId],
        lessonsComplete: [...new Set([...(prev[unitId]?.lessonsComplete || []), lessonId])]
      }
    }));
    setUser(u => ({ ...u, xp: u.xp + 30 }));
  }

  // ── UI helpers ──
  const accent = currentPath?.accent || '#3b82f6';

  const NAV = [
    { id:'home',      icon:'home',      label:'Home' },
    { id:'diagnostic',icon:'dna',       label:'Pathway Diagnostic' },
    { id:'pathway',   icon:'path',      label:'Learning Path' },
    { id:'quiz',      icon:'quiz',      label:'Quiz Library' },
    { id:'coach',     icon:'chat',      label:'AI Coach' },
    { id:'flashcards',icon:'flashcard', label:'Flashcards' },
    { id:'elibrary',  icon:'library',   label:'E-Library' },
    { id:'portfolio', icon:'trophy',    label:'Portfolio Builder' },
    { id:'interview', icon:'mic',       label:'Interview Simulator' },
    { id:'admissions',icon:'grad',      label:'Admissions Calc' },
    { id:'analytics', icon:'chart',     label:'Analytics' },
  ];

  const xpLevel = Math.floor(user.xp / 500) + 1;
  const xpPct   = (user.xp % 500) / 500 * 100;

  // ── Filtered quiz list ──
  const filteredQuizzes = ALL_QUIZZES.filter(q => {
    if (quizCat !== 'All' && q.cat !== quizCat) return false;
    if (quizDiff !== 'All' && q.diff !== quizDiff) return false;
    if (quizSearch.trim() && !q.title.toLowerCase().includes(quizSearch.toLowerCase())) return false;
    return true;
  });

  // ── All flash decks combined ──
  const allDecks = { ...FLASH_DECKS, ...customDecks };
  const currentDeckCards = flashDeck ? allDecks[flashDeck] : null;

  // style helpers
  const card = (extra = {}) => ({
    background:'rgba(255,255,255,0.03)',
    border:'1px solid rgba(255,255,255,0.07)',
    borderRadius: 20,
    padding: 24,
    ...extra
  });

  const btn = (bg = accent, extra = {}) => ({
    padding:'10px 20px', borderRadius: 12, border:'none',
    background: bg, color:'white', fontWeight: 700,
    cursor:'pointer', fontSize: 13, transition:'opacity 0.2s',
    ...extra
  });

  const input = (extra = {}) => ({
    background:'rgba(0,0,0,0.3)',
    border:'1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding:'10px 14px',
    color:'white', fontSize: 13, outline:'none',
    width:'100%', fontFamily:'inherit',
    ...extra
  });

  /* ─────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────── */
  return (
    <div style={{ display:'flex', height:'100vh', width:'100vw', background:'#030014', color:'white', fontFamily:"'Inter',sans-serif", overflow:'hidden' }}>

      {/* ══ SIDEBAR ══ */}
      <aside style={{ width: 220, flexShrink:0, background:'rgba(0,0,0,0.4)', borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Brand */}
        <div style={{ padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:`linear-gradient(135deg,${accent},#6366f1)`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:16, color:'white', flexShrink:0 }}>M</div>
            <div>
              <div style={{ fontWeight:800, fontSize:13, letterSpacing:'-0.02em' }}>MedSchoolPrep</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>Level {xpLevel}</div>
            </div>
          </div>
          {/* XP bar */}
          <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${xpPct}%`, background:`linear-gradient(90deg,${accent},#6366f1)`, borderRadius:3, transition:'width 0.6s ease' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop: 4 }}>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)' }}>{user.xp % 500} / 500 XP</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)' }}>{user.xp} total</span>
          </div>
          {user.specialty && (
            <div style={{ marginTop:10, padding:'5px 10px', borderRadius:8, background:`${accent}18`, border:`1px solid ${accent}40`, fontSize:11, fontWeight:600, color:accent }}>
              <Icon name={PATHS[user.specialty].icon} size={12} color={accent} />&nbsp;{PATHS[user.specialty].label}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', padding:'8px 8px' }}>
          {NAV.map(n => {
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => { setTab(n.id); setActiveUnit(null); setActiveQuiz(null); setMmiQ(null); }}
                style={{ display:'flex', alignItems:'center', gap:9, width:'100%', padding:'8px 10px', borderRadius:10, border:'none', background: active ? 'rgba(255,255,255,0.08)' : 'transparent', color: active ? 'white' : 'rgba(255,255,255,0.45)', fontWeight: active ? 600 : 400, cursor:'pointer', fontSize:13, marginBottom:1, transition:'all 0.15s', textAlign:'left' }}>
                <Icon name={n.icon} size={15} color={active ? accent : 'rgba(255,255,255,0.4)'} />
                {n.label}
              </button>
            );
          })}
        </nav>

        {/* Pomodoro */}
        <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:12, padding:'10px 12px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.08em', display:'flex', alignItems:'center', gap:4 }}>
                <Icon name={pomBreak ? 'coffee' : 'timer'} size={11} color='rgba(255,255,255,0.35)' />
                {pomBreak ? 'Break' : 'Focus'}
              </span>
              <button onClick={() => {
                if (!pomActive && !pomBreak) setPomSecs(25 * 60);
                if (!pomActive && pomBreak) setPomSecs(5 * 60);
                setPomAct(a => !a);
              }} style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>
                {pomActive ? 'Pause' : 'Start'}
              </button>
            </div>
            <div style={{ fontSize:22, fontWeight:900, textAlign:'center', letterSpacing:'0.05em', color: accent }}>{fmtTime(pomSecs)}</div>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <main style={{ flex:1, overflowY:'auto', position:'relative' }}>
        {/* Ambient glow */}
        <div style={{ position:'fixed', top:0, right:0, width:500, height:500, borderRadius:'50%', background:`radial-gradient(circle,${accent}18 0%,transparent 70%)`, pointerEvents:'none', zIndex:0 }} />

        <div style={{ maxWidth:1050, margin:'0 auto', padding:'32px 28px', position:'relative', zIndex:1 }}>

          {/* ════ HOME ════ */}
          {tab === 'home' && (
            <div>
              <h1 style={{ fontSize:32, fontWeight:900, marginBottom:4, letterSpacing:'-0.03em' }}>
                {user.name ? `Good day, ${user.name} 👋` : 'Welcome to MedSchoolPrep'}
              </h1>
              <p style={{ color:'rgba(255,255,255,0.4)', marginBottom:28, fontSize:15 }}>
                {user.specialty ? `You're on the ${PATHS[user.specialty].label} path. Let's keep building.` : 'Start with the Pathway Diagnostic to personalize your journey.'}
              </p>

              {/* Stats */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
                {[
                  { label:'Total XP', val:user.xp.toLocaleString(), color:'#f59e0b', icon:'bolt' },
                  { label:'Level', val:xpLevel, color:'#3b82f6', icon:'star' },
                  { label:'Quizzes Taken', val:Object.keys(quizScores).length, color:'#10b981', icon:'quiz' },
                  { label:'Avg Score', val: Object.keys(quizScores).length > 0 ? Math.round(Object.values(quizScores).reduce((a,b)=>a+b,0)/Object.keys(quizScores).length) + '%' : '—', color:'#8b5cf6', icon:'chart' },
                ].map(s => (
                  <div key={s.label} style={{ ...card(), padding:18 }}>
                    <Icon name={s.icon} size={20} color={s.color} />
                    <div style={{ fontSize:28, fontWeight:900, color:s.color, margin:'6px 0 2px' }}>{s.val}</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                {[
                  { title: user.specialty ? 'Continue Learning Path' : 'Take Specialty Diagnostic', desc: user.specialty ? `${PATHS[user.specialty].tagline}` : 'Find your ideal medical specialty in 12 questions', tab: user.specialty ? 'pathway' : 'diagnostic', icon:'dna', color:'#3b82f6' },
                  { title:'Practice Quizzes', desc:`${ALL_QUIZZES.length} quizzes across Bio/Biochem, Chem/Phys, Psych/Soc`, tab:'quiz', icon:'quiz', color:'#8b5cf6' },
                  { title:'Ask AI Coach', desc:'Get instant MCAT explanations, mnemonics, and study strategies', tab:'coach', icon:'chat', color:'#10b981' },
                  { title:'MMI Interview Prep', desc:'Practice with 20 real MMI questions and get AI feedback', tab:'interview', icon:'mic', color:'#f59e0b' },
                ].map(a => (
                  <button key={a.tab} onClick={() => setTab(a.tab)}
                    style={{ ...card(), display:'flex', gap:14, alignItems:'flex-start', textAlign:'left', border:`1px solid rgba(255,255,255,0.07)`, cursor:'pointer', transition:'all 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.borderColor = a.color + '50'}
                    onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
                    <div style={{ width:40, height:40, borderRadius:12, background:`${a.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Icon name={a.icon} size={20} color={a.color} />
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, marginBottom:4, color:'white' }}>{a.title}</div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', lineHeight:1.5 }}>{a.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ════ DIAGNOSTIC ════ */}
          {tab === 'diagnostic' && (
            <div style={{ maxWidth:640, margin:'0 auto' }}>
              {!diagDone ? (
                <>
                  <h1 style={{ fontSize:26, fontWeight:900, marginBottom:4 }}>Specialty Diagnostic</h1>
                  <p style={{ color:'rgba(255,255,255,0.4)', marginBottom:24, fontSize:14 }}>
                    {diagStep < 10 ? 'Answer content questions to calibrate your path.' : 'Tell us about your interests.'}
                  </p>
                  <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:3, marginBottom:24, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:`linear-gradient(90deg,${accent},#6366f1)`, width:`${(diagStep/DIAG_QS.length)*100}%`, transition:'width 0.4s ease', borderRadius:3 }} />
                  </div>
                  <div style={{ ...card(), marginBottom:16 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.3)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>Q{diagStep+1} / {DIAG_QS.length}</div>
                    <div style={{ fontSize:16, fontWeight:600, color:'white', lineHeight:1.6, marginBottom:20 }}>{DIAG_QS[diagStep].q}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {DIAG_QS[diagStep].ch.map((opt, i) => (
                        <button key={i} onClick={() => handleDiagAnswer(diagStep, i)}
                          style={{ padding:'12px 16px', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.8)', textAlign:'left', cursor:'pointer', fontSize:13, fontWeight:500, transition:'all 0.15s' }}
                          onMouseOver={e => { e.currentTarget.style.background='rgba(59,130,246,0.12)'; e.currentTarget.style.borderColor='rgba(59,130,246,0.4)'; }}
                          onMouseOut={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; }}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Skip / manual choose */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {Object.entries(PATHS).map(([key, p]) => (
                      <button key={key} onClick={() => {
                        setUser(u => ({ ...u, specialty:key, xp: u.xp + 50 }));
                        const init = {};
                        p.units.forEach((u,i) => { init[u.id] = { unlocked: i===0, lessonsComplete:[], masteryScore:null }; });
                        setPathway(init);
                        setDiagDone(true);
                      }}
                        style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.5)', fontSize:11, cursor:'pointer' }}>
                        Jump → {p.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign:'center', paddingTop:40 }}>
                  <div style={{ fontSize:56, marginBottom:16 }}>
                    <Icon name={PATHS[user.specialty].icon} size={64} color={PATHS[user.specialty].accent} />
                  </div>
                  <h2 style={{ fontSize:24, fontWeight:900, marginBottom:8 }}>{PATHS[user.specialty].label}</h2>
                  <p style={{ color:'rgba(255,255,255,0.45)', marginBottom:6 }}>{PATHS[user.specialty].tagline}</p>
                  <p style={{ fontSize:12, color:'rgba(255,255,255,0.25)', marginBottom:28 }}>+100 XP earned for completing the diagnostic</p>
                  <button onClick={() => setTab('pathway')} style={{ ...btn(PATHS[user.specialty].accent), padding:'14px 36px', fontSize:15 }}>
                    Begin My Learning Path →
                  </button>
                  <div style={{ marginTop:16 }}>
                    <button onClick={() => { setDiagStep(0); setDiagAns([]); setDiagDone(false); }} style={{ fontSize:12, color:'rgba(255,255,255,0.3)', background:'none', border:'none', cursor:'pointer' }}>
                      Retake diagnostic
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ LEARNING PATHWAY ════ */}
          {tab === 'pathway' && (
            <div>
              {!user.specialty ? (
                <div style={{ textAlign:'center', paddingTop:60 }}>
                  <Icon name='dna' size={48} color='rgba(255,255,255,0.2)' />
                  <h2 style={{ fontSize:22, fontWeight:700, margin:'16px 0 8px' }}>No Pathway Yet</h2>
                  <p style={{ color:'rgba(255,255,255,0.4)', marginBottom:20, fontSize:14 }}>Take the diagnostic to get a personalized curriculum.</p>
                  <button onClick={() => setTab('diagnostic')} style={{ ...btn() }}>Take Diagnostic →</button>
                </div>
              ) : !activeUnit ? (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
                    <div>
                      <h1 style={{ fontSize:26, fontWeight:900, marginBottom:4 }}>{PATHS[user.specialty].label} Path</h1>
                      <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14 }}>{PATHS[user.specialty].tagline}</p>
                    </div>
                    <button onClick={() => setTab('diagnostic')} style={{ fontSize:11, color:'rgba(255,255,255,0.35)', background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'6px 12px', cursor:'pointer' }}>Change Path</button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {PATHS[user.specialty].units.map((unit, ui) => {
                      const st = pathway[unit.id] || { unlocked: ui === 0, lessonsComplete:[], masteryScore:null };
                      const done = st.lessonsComplete?.length || 0;
                      const pct  = Math.round((done / unit.lessons.length) * 100);
                      const mastered = st.masteryScore !== null && st.masteryScore >= Math.ceil(unit.lessons.length * 0.75);
                      return (
                        <div key={unit.id} style={{ ...card(), opacity: st.unlocked ? 1 : 0.45, border:`1px solid ${st.unlocked ? (mastered ? '#10b981' : accent) + '35' : 'rgba(255,255,255,0.06)'}` }}>
                          <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                            <div style={{ width:48, height:48, borderRadius:14, background: mastered ? 'rgba(16,185,129,0.15)' : st.unlocked ? `${accent}18` : 'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              {mastered ? <Icon name='check' size={22} color='#10b981' /> : st.unlocked ? <span style={{ fontSize:20, fontWeight:900, color:accent }}>{ui+1}</span> : <Icon name='lock' size={18} color='rgba(255,255,255,0.25)' />}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                                <span style={{ fontWeight:700, fontSize:15 }}>{unit.title}</span>
                                {mastered && <span style={{ fontSize:10, fontWeight:700, color:'#10b981', background:'rgba(16,185,129,0.12)', padding:'2px 8px', borderRadius:20 }}>MASTERED</span>}
                              </div>
                              <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:8 }}>{unit.desc} · {done}/{unit.lessons.length} lessons · +{unit.xp} XP</div>
                              <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
                                <div style={{ height:'100%', background: mastered ? '#10b981' : accent, width:`${pct}%`, transition:'width 0.6s ease', borderRadius:2 }} />
                              </div>
                            </div>
                            {st.unlocked && (
                              <button onClick={() => setActiveUnit(unit)} style={{ ...btn(accent, { padding:'8px 18px', fontSize:12, flexShrink:0 }) }}>
                                {done === unit.lessons.length ? 'Review' : 'Study →'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Lesson view */
                <div>
                  <button onClick={() => setActiveUnit(null)} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'rgba(255,255,255,0.45)', background:'none', border:'none', cursor:'pointer', marginBottom:20 }}>
                    <Icon name='back' size={15} color='rgba(255,255,255,0.45)' /> Back to Path
                  </button>
                  <h2 style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>{activeUnit.title}</h2>
                  <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13, marginBottom:20 }}>{activeUnit.desc}</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {activeUnit.lessons.map((lesson, li) => {
                      const unitState = pathway[activeUnit.id] || { lessonsComplete:[] };
                      const isDone = unitState.lessonsComplete?.includes(lesson.id);
                      return (
                        <div key={lesson.id} style={{ ...card(), padding:'16px 18px' }}>
                          <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                            <div style={{ width:28, height:28, borderRadius:8, background: isDone ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              {isDone ? <Icon name='check' size={14} color='#10b981' /> : <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.4)' }}>{li+1}</span>}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:600, fontSize:14, marginBottom:3 }}>{lesson.title}</div>
                              <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginBottom:6 }}>{lesson.dur}</div>
                              <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', lineHeight:1.5 }}>💡 {lesson.note}</div>
                            </div>
                            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                              <a href={lesson.url} target='_blank' rel='noreferrer' style={{ ...btn('rgba(255,255,255,0.08)', { padding:'7px 14px', fontSize:11, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }) }}>
                                <Icon name='video' size={12} color='white' /> Watch
                              </a>
                              {!isDone && (
                                <button onClick={() => completeLesson(activeUnit.id, lesson.id)} style={{ ...btn('#10b981', { padding:'7px 14px', fontSize:11 }) }}>
                                  Mark Done
                                </button>
                              )}
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

          {/* ════ QUIZ LIBRARY ════ */}
          {tab === 'quiz' && (
            <div>
              {activeQuiz ? (
                <div>
                  <button onClick={() => setActiveQuiz(null)} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'rgba(255,255,255,0.45)', background:'none', border:'none', cursor:'pointer', marginBottom:20 }}>
                    <Icon name='back' size={15} color='rgba(255,255,255,0.45)' /> Back to Library
                  </button>
                  <QuizEngine
                    questions={activeQuiz.qs}
                    title={activeQuiz.title}
                    onFinish={(score, total) => {
                      const pct = Math.round((score/total)*100);
                      setQuizScores(s => ({ ...s, [activeQuiz.id]: pct }));
                      setUser(u => ({ ...u, xp: u.xp + Math.round(pct * 0.5) }));
                      setActiveQuiz(null);
                    }}
                  />
                </div>
              ) : (
                <>
                  <h1 style={{ fontSize:26, fontWeight:900, marginBottom:4 }}>Quiz Library</h1>
                  <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, marginBottom:20 }}>{ALL_QUIZZES.length} expert-tier MCAT quizzes · 15 questions each</p>

                  {/* Filters */}
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:18 }}>
                    <input placeholder='Search quizzes…' value={quizSearch} onChange={e => setQuizSearch(e.target.value)}
                      style={{ ...input({ width:200, flex:'none' }), display:'flex', alignItems:'center' }} />
                    {['All','Bio/Biochem','Chem/Phys','Psych/Soc'].map(c => (
                      <button key={c} onClick={() => setQuizCat(c)}
                        style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${quizCat === c ? accent : 'rgba(255,255,255,0.1)'}`, background: quizCat === c ? `${accent}20` : 'transparent', color: quizCat === c ? accent : 'rgba(255,255,255,0.5)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                        {c}
                      </button>
                    ))}
                    {['All','Medium','Hard','Expert'].map(d => (
                      <button key={d} onClick={() => setQuizDiff(d)}
                        style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${quizDiff === d ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`, background: quizDiff === d ? 'rgba(139,92,246,0.15)' : 'transparent', color: quizDiff === d ? '#a78bfa' : 'rgba(255,255,255,0.5)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                        {d}
                      </button>
                    ))}
                  </div>

                  {/* Quiz grid */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
                    {filteredQuizzes.map(q => {
                      const score = quizScores[q.id];
                      const diffColor = { Medium:'#f59e0b', Hard:'#ef4444', Expert:'#8b5cf6' }[q.diff] || '#6b7280';
                      return (
                        <div key={q.id} style={{ ...card(), padding:18, cursor:'pointer', transition:'all 0.2s' }}
                          onMouseOver={e => e.currentTarget.style.borderColor = accent + '40'}
                          onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                            <span style={{ fontSize:10, fontWeight:700, color: diffColor, background:`${diffColor}18`, padding:'2px 8px', borderRadius:20 }}>{q.diff}</span>
                            {score !== undefined && <span style={{ fontSize:13, fontWeight:800, color: score >= 80 ? '#10b981' : score >= 60 ? '#3b82f6' : '#f59e0b' }}>{score}%</span>}
                          </div>
                          <div style={{ fontWeight:700, fontSize:14, marginBottom:4, lineHeight:1.4 }}>{q.title}</div>
                          <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginBottom:12 }}>{q.cat} · {q.qs.length} questions</div>
                          <button onClick={() => setActiveQuiz(q)} style={{ ...btn(accent, { width:'100%', padding:'8px', fontSize:12 }) }}>
                            {score !== undefined ? '↺ Retake' : '▶ Start Quiz'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {filteredQuizzes.length === 0 && (
                    <div style={{ textAlign:'center', padding:'40px 0', color:'rgba(255,255,255,0.25)' }}>No quizzes match your filters.</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ════ AI COACH ════ */}
          {tab === 'coach' && (
            <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 100px)' }}>
              <h1 style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>MetaBrain AI Coach</h1>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13, marginBottom:16 }}>Ask anything — MCAT concepts, study strategy, clinical correlates, AMCAS essays, interview prep.</p>

              {/* Messages */}
              <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:12, marginBottom:16 }}>
                {msgs.map((m, i) => (
                  <div key={i} style={{ display:'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {m.role === 'assistant' && (
                      <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg,${accent},#6366f1)`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:13, color:'white', marginRight:8, flexShrink:0, alignSelf:'flex-end' }}>M</div>
                    )}
                    <div style={{ maxWidth:'78%', padding:'12px 16px', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: m.role === 'user' ? accent : 'rgba(255,255,255,0.06)', border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)', fontSize:14, lineHeight:1.65, color: m.role === 'user' ? 'white' : 'rgba(255,255,255,0.85)', whiteSpace:'pre-wrap' }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoad && (
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg,${accent},#6366f1)`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:13, color:'white', flexShrink:0 }}>M</div>
                    <div style={{ padding:'12px 16px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'18px 18px 18px 4px', display:'flex', gap:5, alignItems:'center' }}>
                      {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'rgba(255,255,255,0.4)', animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick prompts */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                {['Explain the TCA cycle','CARS passage strategy','Michaelis-Menten kinetics','How does 2,3-BPG work?','MMI tips','Study schedule for 3 months'].map(p => (
                  <button key={p} onClick={() => sendChat(p)} style={{ padding:'5px 12px', borderRadius:20, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.5)', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{p}</button>
                ))}
              </div>

              {/* Input */}
              <div style={{ display:'flex', gap:10 }}>
                <textarea value={chatInput} onChange={e => setChatIn(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder='Ask anything about MCAT, pre-med, or med school applications… (Enter to send)'
                  rows={2} style={{ ...input({ resize:'none', lineHeight:1.5, flex:1 }) }} />
                <button onClick={() => sendChat()} disabled={chatLoad || !chatInput.trim()}
                  style={{ ...btn(accent, { padding:'0 20px', alignSelf:'stretch', opacity: chatLoad || !chatInput.trim() ? 0.4 : 1 }) }}>
                  <Icon name='arrow' size={18} color='white' />
                </button>
              </div>
              <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}`}</style>
            </div>
          )}

          {/* ════ FLASHCARDS ════ */}
          {tab === 'flashcards' && (
            <div>
              <h1 style={{ fontSize:26, fontWeight:900, marginBottom:4 }}>Flashcard Decks</h1>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, marginBottom:20 }}>Pre-built high-yield decks + AI-generated cards from your notes.</p>

              {!flashDeck ? (
                <>
                  {/* Deck grid */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:24 }}>
                    {Object.keys(allDecks).map(name => (
                      <button key={name} onClick={() => { setFlashDeck(name); setFlashIdx(0); setFlashFlipped(false); }}
                        style={{ ...card({ padding:18, cursor:'pointer', textAlign:'left', border:'1px solid rgba(255,255,255,0.07)' }) }}
                        onMouseOver={e => e.currentTarget.style.borderColor = accent + '40'}
                        onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
                        <Icon name='flashcard' size={24} color={accent} />
                        <div style={{ fontWeight:700, fontSize:13, margin:'10px 0 4px' }}>{name}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>{allDecks[name].length} cards</div>
                      </button>
                    ))}
                  </div>

                  {/* Generate from notes */}
                  <div style={{ ...card() }}>
                    <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>Generate Deck from Notes</div>
                    <input placeholder='Deck name (optional)' value={deckGenName} onChange={e => setDeckGenName(e.target.value)}
                      style={{ ...input({ marginBottom:10 }) }} />
                    <textarea placeholder='Paste your study notes here… The AI will extract 10-14 high-yield flashcards.' rows={5}
                      value={deckGenInput} onChange={e => setDeckGenInput(e.target.value)}
                      style={{ ...input({ resize:'none', lineHeight:1.5, marginBottom:12 }) }} />
                    <button onClick={generateDeck} disabled={deckGenLoad || !deckGenInput.trim()}
                      style={{ ...btn(accent, { opacity: deckGenLoad || !deckGenInput.trim() ? 0.4 : 1 }) }}>
                      {deckGenLoad ? 'Generating…' : '✦ Generate with AI'}
                    </button>
                  </div>
                </>
              ) : (
                /* Card view */
                <div style={{ maxWidth:560, margin:'0 auto' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                    <button onClick={() => setFlashDeck(null)} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'rgba(255,255,255,0.45)', background:'none', border:'none', cursor:'pointer' }}>
                      <Icon name='back' size={15} color='rgba(255,255,255,0.45)' /> All Decks
                    </button>
                    <span style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>{flashDeck} · {flashIdx+1} / {currentDeckCards?.length}</span>
                  </div>

                  {/* Flip card */}
                  <div onClick={() => setFlashFlipped(f => !f)} style={{ cursor:'pointer', perspective:1200, height:260, marginBottom:20 }}>
                    <div style={{ position:'relative', width:'100%', height:'100%', transformStyle:'preserve-3d', transform: flashFlipped ? 'rotateY(180deg)' : 'none', transition:'transform 0.5s ease' }}>
                      {/* Front */}
                      <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', background:'rgba(255,255,255,0.04)', border:`1px solid ${accent}35`, borderRadius:20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:28, textAlign:'center' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:accent, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.1em' }}>Front</div>
                        <div style={{ fontSize:17, fontWeight:600, color:'white', lineHeight:1.6 }}>{currentDeckCards?.[flashIdx]?.front}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.2)', marginTop:16 }}>Click to reveal</div>
                      </div>
                      {/* Back */}
                      <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', transform:'rotateY(180deg)', background:`${accent}10`, border:`1px solid ${accent}50`, borderRadius:20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:28, textAlign:'center' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:accent, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.1em' }}>Back</div>
                        <div style={{ fontSize:14, color:'rgba(255,255,255,0.85)', lineHeight:1.7 }}>{currentDeckCards?.[flashIdx]?.back}</div>
                      </div>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                    <button onClick={() => { setFlashIdx(i => Math.max(0,i-1)); setFlashFlipped(false); }} disabled={flashIdx === 0}
                      style={{ ...btn('rgba(255,255,255,0.08)', { padding:'10px 24px', opacity: flashIdx === 0 ? 0.3 : 1 }) }}>← Prev</button>
                    <button onClick={() => { setFlashIdx(i => Math.min((currentDeckCards?.length||1)-1, i+1)); setFlashFlipped(false); }} disabled={flashIdx === (currentDeckCards?.length||1)-1}
                      style={{ ...btn(accent, { padding:'10px 24px', opacity: flashIdx === (currentDeckCards?.length||1)-1 ? 0.3 : 1 }) }}>Next →</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ E-LIBRARY ════ */}
          {tab === 'elibrary' && (
            <div>
              <h1 style={{ fontSize:26, fontWeight:900, marginBottom:4 }}>E-Library</h1>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, marginBottom:20 }}>{ELIB.length} curated MCAT resources — free and paid, all in one place.</p>

              <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
                <input placeholder='Search resources…' value={libSearch} onChange={e => setLibSearch(e.target.value)} style={{ ...input({ width:220, flex:'none' }) }} />
                {['All','Bio/Biochem','Chem/Phys','Psych/Soc','Research Methods','MCAT Prep','Clinical & Career'].map(c => (
                  <button key={c} onClick={() => setLibCat(c)}
                    style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${libCat===c ? accent : 'rgba(255,255,255,0.1)'}`, background: libCat===c ? `${accent}20` : 'transparent', color: libCat===c ? accent : 'rgba(255,255,255,0.5)', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    {c}
                  </button>
                ))}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
                {ELIB
                  .filter(r => (libCat === 'All' || r.cat === libCat) && (!libSearch.trim() || r.title.toLowerCase().includes(libSearch.toLowerCase()) || r.desc.toLowerCase().includes(libSearch.toLowerCase())))
                  .map((r,i) => (
                    <a key={i} href={r.url} target='_blank' rel='noreferrer'
                      style={{ ...card({ padding:18, display:'block', textDecoration:'none', cursor:'pointer' }) }}
                      onMouseOver={e => e.currentTarget.style.borderColor = accent + '40'}
                      onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <span style={{ fontSize:10, fontWeight:700, color: accent, background:`${accent}18`, padding:'2px 8px', borderRadius:20 }}>{r.type}</span>
                        <span style={{ fontSize:10, fontWeight:700, color: r.free ? '#10b981' : 'rgba(255,255,255,0.3)' }}>{r.free ? 'FREE' : 'PAID'}</span>
                      </div>
                      <div style={{ fontWeight:700, fontSize:13, color:'white', marginBottom:4 }}>{r.title}</div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', lineHeight:1.5 }}>{r.desc}</div>
                    </a>
                  ))}
              </div>
            </div>
          )}

          {/* ════ PORTFOLIO BUILDER ════ */}
          {tab === 'portfolio' && (
            <div>
              <h1 style={{ fontSize:26, fontWeight:900, marginBottom:4 }}>Portfolio Builder</h1>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, marginBottom:20 }}>Track activities and discover competitions to strengthen your application.</p>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                {/* Left: My activities */}
                <div>
                  <h2 style={{ fontSize:16, fontWeight:700, marginBottom:12 }}>My Activities ({portItems.length})</h2>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                    {portItems.map((a,i) => (
                      <div key={i} style={{ ...card({ padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }) }}>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{a.title}</div>
                          <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>{a.type} · {a.date || 'Ongoing'}</div>
                        </div>
                        <button onClick={() => setPortItems(p => p.filter((_,j)=>j!==i))} style={{ fontSize:11, color:'rgba(239,68,68,0.5)', background:'none', border:'none', cursor:'pointer' }}>Remove</button>
                      </div>
                    ))}
                    {portItems.length === 0 && <div style={{ fontSize:13, color:'rgba(255,255,255,0.25)', textAlign:'center', padding:'20px 0' }}>No activities added yet.</div>}
                  </div>

                  {/* Add activity form */}
                  <div style={{ ...card() }}>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Add Activity</div>
                    <input placeholder='Activity name' value={newActivity.title} onChange={e => setNewAct(a => ({...a, title: e.target.value}))} style={{ ...input({ marginBottom:8 }) }} />
                    <select value={newActivity.type} onChange={e => setNewAct(a => ({...a, type: e.target.value}))} style={{ ...input({ marginBottom:8 }) }}>
                      {['Clinical','Research','Volunteering','Leadership','Competition','Shadowing','Other'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type='month' value={newActivity.date} onChange={e => setNewAct(a => ({...a, date: e.target.value}))} style={{ ...input({ marginBottom:10 }) }} />
                    <button onClick={() => { if (!newActivity.title.trim()) return; setPortItems(p => [...p, {...newActivity}]); setNewAct({ title:'', type:'Clinical', date:'' }); }} style={{ ...btn(accent, { width:'100%' }) }}>
                      + Add to Timeline
                    </button>
                  </div>
                </div>

                {/* Right: Competitions */}
                <div>
                  <h2 style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Opportunities & Competitions</h2>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                    <input placeholder='Your state (e.g. NC)…' value={compState} onChange={e => setCompState(e.target.value.toUpperCase())} style={{ ...input({ width:120, flex:'none' }) }} />
                    {['All','Competition','Research','Scholarship','Clinical','Volunteering'].map(f => (
                      <button key={f} onClick={() => setCompFilter(f)} style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${compFilter===f ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`, background: compFilter===f ? 'rgba(245,158,11,0.12)' : 'transparent', color: compFilter===f ? '#f59e0b' : 'rgba(255,255,255,0.45)', fontSize:11, cursor:'pointer' }}>{f}</button>
                    ))}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:520, overflowY:'auto' }}>
                    {COMPETITIONS
                      .filter(c => {
                        if (compFilter !== 'All' && c.type !== compFilter) return false;
                        if (compState.trim() && !c.national && c.states.length > 0 && !c.states.includes(compState.trim())) return false;
                        return true;
                      })
                      .map(c => (
                        <div key={c.id} style={{ ...card({ padding:'14px 16px' }) }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                            <span style={{ fontWeight:700, fontSize:13 }}>{c.name}</span>
                            <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background: c.effort==='Elite' ? 'rgba(239,68,68,0.12)' : c.effort==='Competitive' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', color: c.effort==='Elite' ? '#f87171' : c.effort==='Competitive' ? '#fbbf24' : '#34d399', flexShrink:0, marginLeft:6 }}>{c.effort}</span>
                          </div>
                          <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8, lineHeight:1.5 }}>{c.desc}</div>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>📅 {c.deadline}</span>
                            <div style={{ display:'flex', gap:8 }}>
                              <button onClick={() => setPortItems(p => [...p, { title: c.name, type: c.type, date: c.deadline }])} style={{ fontSize:11, color: accent, background:'none', border:`1px solid ${accent}40`, borderRadius:6, padding:'3px 10px', cursor:'pointer', fontFamily:'inherit' }}>+ Add</button>
                              {c.url !== '#' && <a href={c.url} target='_blank' rel='noreferrer' style={{ fontSize:11, color:'rgba(255,255,255,0.4)', textDecoration:'none' }}>Learn ↗</a>}
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
              <h1 style={{ fontSize:26, fontWeight:900, marginBottom:4 }}>MMI Interview Simulator</h1>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, marginBottom:20 }}>Practice with 20 real MMI stations. Get AI-scored feedback on structure, empathy, and content.</p>

              {!mmiQ ? (
                <>
                  {/* Filter */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
                    {['All','Ethics','Personal','Motivation','Policy','Professionalism','Cultural Competency','Communication','Situational'].map(f => (
                      <button key={f} onClick={() => setMmiFilter(f)} style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${mmiFilter===f ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`, background: mmiFilter===f ? 'rgba(139,92,246,0.15)' : 'transparent', color: mmiFilter===f ? '#a78bfa' : 'rgba(255,255,255,0.5)', fontSize:11, fontWeight:600, cursor:'pointer' }}>{f}</button>
                    ))}
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:12 }}>
                    {MMI_QS.filter(q => mmiFilter === 'All' || q.type === mmiFilter).map((q,i) => (
                      <button key={i} onClick={() => { setMmiQ(q); setMmiAns(''); setMmiFB(''); }}
                        style={{ ...card({ padding:18, textAlign:'left', cursor:'pointer', border:'1px solid rgba(255,255,255,0.07)' }) }}
                        onMouseOver={e => e.currentTarget.style.borderColor = '#8b5cf670'}
                        onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#a78bfa', background:'rgba(139,92,246,0.12)', padding:'2px 8px', borderRadius:20, display:'inline-block', marginBottom:10 }}>{q.type}</div>
                        <div style={{ fontSize:13, fontWeight:500, color:'rgba(255,255,255,0.8)', lineHeight:1.6 }}>{q.q}</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:10 }}>
                          {q.points.map((p,pi) => <span key={pi} style={{ fontSize:10, color:'rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.04)', padding:'2px 7px', borderRadius:10 }}>{p}</span>)}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ maxWidth:680 }}>
                  <button onClick={() => setMmiQ(null)} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'rgba(255,255,255,0.45)', background:'none', border:'none', cursor:'pointer', marginBottom:20 }}>
                    <Icon name='back' size={15} color='rgba(255,255,255,0.45)' /> All Questions
                  </button>

                  <div style={{ ...card(), marginBottom:16 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#a78bfa' }}>{mmiQ.type}</span>
                      <span style={{ fontSize:12, fontWeight:700, color: mmiTimer > 480 ? '#ef4444' : mmiTimer > 240 ? '#f59e0b' : '#10b981', background:'rgba(0,0,0,0.3)', padding:'3px 10px', borderRadius:20 }}>
                        <Icon name='timer' size={11} color='inherit' /> {fmtTime(mmiTimer)}
                      </span>
                    </div>
                    <div style={{ fontSize:16, fontWeight:600, color:'white', lineHeight:1.65, marginBottom:14 }}>{mmiQ.q}</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {mmiQ.points.map((p,i) => <span key={i} style={{ fontSize:11, color:'rgba(255,255,255,0.4)', background:'rgba(255,255,255,0.05)', padding:'3px 10px', borderRadius:20 }}>Consider: {p}</span>)}
                    </div>
                  </div>

                  <textarea placeholder='Type your response here… (Aim for 2-3 minutes of structured content. Use SBAR or story format.)' rows={8}
                    value={mmiAnswer} onChange={e => setMmiAns(e.target.value)}
                    style={{ ...input({ resize:'none', lineHeight:1.65, marginBottom:14 }) }} />

                  <button onClick={getMmiFeedback} disabled={mmiLoad || !mmiAnswer.trim()}
                    style={{ ...btn('#8b5cf6', { marginBottom:16, opacity: mmiLoad || !mmiAnswer.trim() ? 0.4 : 1 }) }}>
                    {mmiLoad ? 'Analyzing…' : '✦ Get AI Feedback (5 dimensions)'}
                  </button>

                  {mmiFeedback && (
                    <div style={{ ...card({ background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.2)', padding:20 }) }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'#a78bfa', marginBottom:10 }}>AI Coach Feedback</div>
                      <div style={{ fontSize:13, color:'rgba(255,255,255,0.7)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{mmiFeedback}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════ ADMISSIONS CALCULATOR ════ */}
          {tab === 'admissions' && (
            <div>
              <h1 style={{ fontSize:26, fontWeight:900, marginBottom:4 }}>Admissions Calculator</h1>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, marginBottom:20 }}>Get tiered school recommendations based on your full profile — not just GPA and MCAT.</p>

              <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20, alignItems:'start' }}>
                {/* Input panel */}
                <div style={{ ...card() }}>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Your Stats</div>
                  {[
                    { label:'Cumulative GPA', key:'gpa', set:setGpa, val:gpa, placeholder:'3.85', type:'number' },
                    { label:'MCAT Score (472–528)', key:'mcat', set:setMcatScore, val:mcat, placeholder:'514', type:'number' },
                    { label:'Research Experience (years)', key:'res', set:setResearchYrs, val:researchYrs, placeholder:'1.5', type:'number' },
                    { label:'Clinical Hours', key:'cli', set:setClinicalHrs, val:clinicalHrs, placeholder:'200', type:'number' },
                    { label:'Volunteer Hours', key:'vol', set:setVolHrs, val:volHrs, placeholder:'100', type:'number' },
                    { label:'Your State (for residency)', key:'state', set:setStateFilter, val:stateFilter, placeholder:'NC', type:'text' },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>{f.label}</div>
                      <input type={f.type} placeholder={f.placeholder} value={f.val} onChange={e => f.set(e.target.value)} style={{ ...input() }} />
                    </div>
                  ))}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>School Type</div>
                    <select value={schoolType} onChange={e => setSchoolType(e.target.value)} style={{ ...input() }}>
                      {['All','Public','Private'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <button onClick={calcAdmissions} style={{ ...btn('#f59e0b', { width:'100%', color:'#030014', fontWeight:800 }) }}>
                    Calculate My Chances →
                  </button>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.2)', marginTop:8, lineHeight:1.5 }}>⚠️ Estimates only. Outcomes depend on essays, interviews, activities, and many other factors.</div>
                </div>

                {/* Results */}
                {calcResults ? (
                  <div>
                    {/* Tier summary */}
                    {['Likely','Target','Reach','Stretch'].map(tier => {
                      const tierSchools = calcResults.filter(s => s.tier === tier);
                      if (!tierSchools.length) return null;
                      const tierColors = { Likely:'#10b981', Target:'#3b82f6', Reach:'#f59e0b', Stretch:'#ef4444' };
                      return (
                        <div key={tier} style={{ marginBottom:14 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                            <div style={{ width:8, height:8, borderRadius:'50%', background:tierColors[tier] }} />
                            <span style={{ fontWeight:700, fontSize:13, color:tierColors[tier] }}>{tier}</span>
                            <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>({tierSchools.length} schools)</span>
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                            {tierSchools.map(s => (
                              <div key={s.name} style={{ ...card({ padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }) }}>
                                <div>
                                  <div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>GPA {s.gpa} · MCAT {s.mcat} · {s.rate}% accept rate · {s.type}</div>
                                </div>
                                <span style={{ fontSize:11, fontWeight:800, padding:'4px 12px', borderRadius:20, background:`${tierColors[tier]}18`, color:tierColors[tier], flexShrink:0, marginLeft:10 }}>{tier}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, color:'rgba(255,255,255,0.2)', fontSize:14 }}>
                    Enter your stats and click Calculate
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ ANALYTICS ════ */}
          {tab === 'analytics' && (
            <div>
              <h1 style={{ fontSize:26, fontWeight:900, marginBottom:20 }}>Performance Analytics</h1>

              {/* Summary row */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
                {[
                  { label:'Total XP', val:user.xp, color:'#f59e0b' },
                  { label:'Quizzes Completed', val:Object.keys(quizScores).length, color:'#3b82f6' },
                  { label:'Average Score', val: Object.keys(quizScores).length > 0 ? Math.round(Object.values(quizScores).reduce((a,b)=>a+b,0)/Object.keys(quizScores).length) + '%' : '—', color:'#10b981' },
                ].map(s => (
                  <div key={s.label} style={{ ...card({ padding:20 }) }}>
                    <div style={{ fontSize:32, fontWeight:900, color:s.color }}>{s.val}</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Category breakdown */}
              <div style={{ ...card(), marginBottom:20 }}>
                <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>Category Performance</div>
                {['Bio/Biochem','Chem/Phys','Psych/Soc'].map(cat => {
                  const catQuizzes = ALL_QUIZZES.filter(q => q.cat === cat);
                  const catScores = catQuizzes.map(q => quizScores[q.id]).filter(s => s !== undefined);
                  const avg = catScores.length > 0 ? Math.round(catScores.reduce((a,b)=>a+b,0)/catScores.length) : null;
                  const catColor = cat === 'Bio/Biochem' ? '#3b82f6' : cat === 'Chem/Phys' ? '#8b5cf6' : '#10b981';
                  return (
                    <div key={cat} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                        <span style={{ fontSize:13, fontWeight:600 }}>{cat}</span>
                        <span style={{ fontSize:13, fontWeight:700, color: avg ? (avg >= 80 ? '#10b981' : avg >= 60 ? '#f59e0b' : '#ef4444') : 'rgba(255,255,255,0.3)' }}>
                          {avg !== null ? `${avg}% (${catScores.length}/${catQuizzes.length} taken)` : 'Not started'}
                        </span>
                      </div>
                      <div style={{ height:6, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', background:catColor, width:`${avg || 0}%`, borderRadius:3, transition:'width 0.8s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recent quiz scores */}
              {Object.keys(quizScores).length > 0 && (
                <div style={{ ...card() }}>
                  <div style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>Recent Quiz Scores</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {Object.entries(quizScores).slice(-10).reverse().map(([id, score]) => {
                      const q = ALL_QUIZZES.find(q => q.id === id);
                      if (!q) return null;
                      return (
                        <div key={id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:500 }}>{q.title}</div>
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>{q.cat} · {q.diff}</div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ width:80, height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
                              <div style={{ height:'100%', background: score>=80 ? '#10b981' : score>=60 ? '#3b82f6' : '#f59e0b', width:`${score}%`, borderRadius:2 }} />
                            </div>
                            <span style={{ fontSize:13, fontWeight:800, color: score>=80 ? '#10b981' : score>=60 ? '#3b82f6' : '#f59e0b', minWidth:36, textAlign:'right' }}>{score}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {Object.keys(quizScores).length === 0 && (
                <div style={{ textAlign:'center', padding:'40px 0', color:'rgba(255,255,255,0.25)', fontSize:14 }}>
                  Complete quizzes to see your analytics here.
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
