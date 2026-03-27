import { useState, useEffect, useRef, useCallback } from 'react'

// ── CONFIG ── paste your key here ────────────────────────────────────────
const OPENAI_KEY   = 'sk-proj-REPLACE_WITH_YOUR_KEY'
const OPENAI_MODEL = 'gpt-4o-mini'

// ── localStorage helpers (works on Vercel, unlike window.storage) ────────
const ls = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
  del: (k)    => { try { localStorage.removeItem(k) } catch {} },
}

// ── simple password hash (djb2) ──────────────────────────────────────────
const hashPw = (s) => { let h = 5381; for (let i=0;i<s.length;i++) h = ((h<<5)+h)+s.charCodeAt(i)|0; return (h>>>0).toString(16) }

// ── QUIZ DATA (15 quizzes × 10 questions, varied answer keys) ─────────────
// Correct answer index: 0=A 1=B 2=C 3=D
const QUIZZES = [
  {
    id:'q01', cat:'Biochemistry', title:'Glycolysis & Regulation', diff:'Hard',
    qs:[
      {q:'Which enzyme catalyzes the rate-limiting, irreversible step of glycolysis?',ch:['Hexokinase','Phosphofructokinase-1','Pyruvate kinase','Phosphoglucose isomerase'],ans:1,exp:'PFK-1 is the primary regulatory enzyme of glycolysis. It is allosterically inhibited by ATP and citrate, and activated by AMP and fructose-2,6-bisphosphate.'},
      {q:'Arsenate poisoning uncouples substrate-level phosphorylation in glycolysis because it:',ch:['Inhibits PFK-1 directly','Chelates NAD⁺ in the cytoplasm','Substitutes for phosphate forming an unstable 1-arseno-3-PG','Blocks aldolase irreversibly'],ans:2,exp:'Arsenate replaces inorganic phosphate in the GAPDH reaction, forming 1-arseno-3-phosphoglycerate, which spontaneously hydrolyzes, bypassing ATP synthesis at this step.'},
      {q:'Net ATP yield from glycolysis of one glucose (cytoplasm only) is:',ch:['4 ATP','6 ATP','2 ATP','8 ATP'],ans:2,exp:'Glycolysis produces 4 ATP gross but invests 2 ATP in the preparatory phase, giving a net of 2 ATP per glucose.'},
      {q:'In the Cori cycle, lactate released by muscle is converted to glucose in which organ?',ch:['Kidney','Skeletal muscle','Brain','Liver'],ans:3,exp:'The liver takes up lactate from anaerobic muscle/RBC glycolysis and converts it to glucose via gluconeogenesis, recycling carbon at an ATP cost to the liver.'},
      {q:'Pyruvate kinase deficiency in RBCs most directly causes:',ch:['Polycythemia vera','Hemolytic anemia due to ATP depletion','Methemoglobinemia','Iron-deficiency anemia'],ans:1,exp:'RBCs rely entirely on glycolysis for ATP. PK deficiency → ATP depletion → rigid cells destroyed in the spleen → hemolytic anemia.'},
      {q:'Fructose-2,6-bisphosphate (F2,6BP) simultaneously:',ch:['Inhibits both PFK-1 and FBPase-1','Activates PFK-1 and inhibits FBPase-1','Activates gluconeogenesis only','Inhibits PFK-1 and activates FBPase-1'],ans:1,exp:'F2,6BP is the most potent activator of PFK-1 (glycolysis) and simultaneously inhibits FBPase-1 (gluconeogenesis), ensuring reciprocal regulation.'},
      {q:'Which step in glycolysis is the first ATP-consuming reaction?',ch:['Conversion of G6P to F6P','Phosphorylation of glucose by hexokinase','Phosphorylation of F6P by PFK-1','Conversion of 3-PG to 2-PG'],ans:1,exp:'Hexokinase phosphorylates glucose → G6P, consuming the first ATP. The second ATP is consumed by PFK-1 in the preparatory phase.'},
      {q:'The reducing agent produced in the glyceraldehyde-3-phosphate dehydrogenase step of glycolysis is:',ch:['FADH₂','NADPH','NADH','ATP'],ans:2,exp:'GAPDH catalyzes oxidation of G3P to 1,3-BPG, reducing NAD⁺ to NADH. Under anaerobic conditions, this NADH is reoxidized by lactate dehydrogenase.'},
      {q:'Phosphoenolpyruvate (PEP) directly donates its phosphate to ADP in a reaction catalyzed by:',ch:['Phosphoglycerate kinase','Enolase','Pyruvate carboxylase','Pyruvate kinase'],ans:3,exp:'Pyruvate kinase catalyzes PEP + ADP → pyruvate + ATP (substrate-level phosphorylation). This is the final and irreversible step of glycolysis.'},
      {q:'High citrate levels in the cell inhibit PFK-1 because:',ch:['Citrate is a competitive substrate for PFK-1','Elevated citrate signals sufficient energy and biosynthetic precursors, making further glycolysis unnecessary','Citrate directly degrades fructose-2,6-bisphosphate','Citrate activates glucokinase exclusively'],ans:1,exp:'When citrate accumulates (TCA cycle is saturated), it signals energy abundance and allosterically inhibits PFK-1, reducing glycolytic flux. Citrate also inhibits phosphofructokinase to redirect glucose toward biosynthesis.'},
    ]
  },
  {
    id:'q02', cat:'Biochemistry', title:'TCA Cycle & Oxidative Phosphorylation', diff:'Hard',
    qs:[
      {q:'Which TCA cycle enzyme is embedded in the inner mitochondrial membrane (not the matrix)?',ch:['Isocitrate dehydrogenase','Succinate dehydrogenase','Fumarase','α-Ketoglutarate dehydrogenase'],ans:1,exp:'Succinate dehydrogenase (Complex II) is the only TCA enzyme embedded in the IMM. It links the TCA cycle and ETC by oxidizing succinate and reducing FAD→FADH₂.'},
      {q:'Thiamine (vitamin B1) deficiency impairs the TCA cycle primarily by inhibiting:',ch:['Citrate synthase and fumarase','α-Ketoglutarate dehydrogenase and pyruvate dehydrogenase','Succinyl-CoA synthetase and isocitrate dehydrogenase','Malate dehydrogenase and aconitase'],ans:1,exp:'Both PDH and α-KGDH require thiamine pyrophosphate (TPP) as a cofactor. B1 deficiency blocks these steps → pyruvate and α-KG accumulation, causing Wernicke\'s encephalopathy.'},
      {q:'Cyanide poisoning kills by blocking:',ch:['Complex I (NADH dehydrogenase)','Complex II (succinate dehydrogenase)','Complex IV (cytochrome c oxidase)','ATP synthase (Complex V)'],ans:2,exp:'CN⁻ binds the Fe³⁺ in cytochrome a₃ of Complex IV, blocking O₂ reduction and halting the entire ETC. Cells cannot produce ATP aerobically → lactic acidosis and death.'},
      {q:'The modern P/O ratio for NADH oxidation via the complete ETC is approximately:',ch:['1.0','3.0','2.5','4.0'],ans:2,exp:'Modern measurements give P/O ≈ 2.5 for NADH (10 H⁺ pumped per NADH, ~4 H⁺ per ATP synthesized → 10/4 = 2.5 ATP). The older value of 3 is no longer accepted.'},
      {q:'Which intermediate is shared between the TCA cycle and the urea cycle?',ch:['Oxaloacetate','Citrate','Succinyl-CoA','Fumarate'],ans:3,exp:'Fumarate is produced in the cytoplasmic urea cycle (from argininosuccinate) and enters the TCA cycle in mitochondria, creating a metabolic link between nitrogen disposal and energy metabolism.'},
      {q:'GTP is produced by substrate-level phosphorylation in the TCA cycle at which step?',ch:['Citrate synthase','Isocitrate dehydrogenase','Succinyl-CoA synthetase','Malate dehydrogenase'],ans:2,exp:'Succinyl-CoA synthetase converts succinyl-CoA → succinate with coupled GDP phosphorylation (GDP + Pi → GTP). This is the only substrate-level phosphorylation step in the TCA cycle.'},
      {q:'2,4-Dinitrophenol (DNP) causes weight loss by:',ch:['Inhibiting ATP synthase directly','Dissipating the proton gradient as heat without making ATP','Blocking Complex I to increase metabolic rate','Activating lipase in adipocytes via cAMP'],ans:1,exp:'DNP is a lipophilic weak acid that shuttles H⁺ across the IMM, collapsing the proton gradient. The ETC runs at full speed but produces heat instead of ATP, forcing excess calorie burning.'},
      {q:'Which cofactors are required by the α-ketoglutarate dehydrogenase complex?',ch:['Biotin, lipoate, CoA, FAD, NAD⁺','TPP, lipoate, CoA, FAD, NAD⁺','PLP, biotin, CoA, FAD, NAD⁺','TPP, biotin, CoA, NADPH, FAD'],ans:1,exp:'α-KGDH (like PDH) requires TPP (B1), lipoic acid, CoA (B5), FAD (B2), and NAD⁺ (B3). Mnemonic: "Tender Loving Care For Nancy." Deficiency of any causes impaired TCA function.'},
      {q:'In the context of the ETC, the function of ubiquinone (coenzyme Q) is to:',ch:['Pump protons directly across the IMM','Transfer electrons from Complexes I and II to Complex III','Catalyze ATP synthesis from ADP + Pi','Reduce cytochrome c at Complex IV'],ans:1,exp:'Ubiquinone (CoQ) is a mobile, lipid-soluble electron carrier in the IMM. It accepts electrons from NADH (via Complex I) and FADH₂ (via Complex II) and passes them to Complex III (cytochrome bc1).'},
      {q:'NADH produced in the cytoplasm (e.g., from glycolysis) enters the ETC via:',ch:['Direct transport through the IMM via a NADH channel','Malate-aspartate or glycerol-3-phosphate shuttles to transfer reducing equivalents','The citrate shuttle identical to fatty acid synthesis','The carnitine shuttle used by fatty acids'],ans:1,exp:'The IMM is impermeable to NADH. The malate-aspartate shuttle (heart, liver) transfers cytoplasmic NADH as NADH into the matrix. The glycerol-3-phosphate shuttle (muscle, brain) transfers electrons as FADH₂, yielding less ATP.'},
    ]
  },
  {
    id:'q03', cat:'Biochemistry', title:'Amino Acid Metabolism', diff:'Hard',
    qs:[
      {q:'Phenylketonuria (PKU) results from deficiency of:',ch:['Tyrosinase','Homogentisate oxidase','Phenylalanine hydroxylase','Cystathionine β-synthase'],ans:2,exp:'PAH converts phenylalanine → tyrosine using BH₄ as cofactor. Deficiency causes phenylalanine accumulation, producing toxic metabolites (phenylpyruvate, phenylacetate) that impair CNS myelination.'},
      {q:'Which amino acid is both glucogenic AND ketogenic?',ch:['Leucine','Lysine','Phenylalanine','Glycine'],ans:2,exp:'Phenylalanine (and tyrosine, isoleucine, tryptophan, threonine) are both glucogenic and ketogenic — they produce both glucose precursors and ketone body precursors. Leucine and lysine are purely ketogenic.'},
      {q:'Maple syrup urine disease accumulates branched-chain amino acids because of deficiency of:',ch:['Branched-chain aminotransferase','Branched-chain α-keto acid dehydrogenase (requires TPP/B1)','Propionyl-CoA carboxylase','Methylmalonyl-CoA mutase'],ans:1,exp:'BCKD complex (requires TPP, similar to PDH) catabolizes leucine, isoleucine, and valine keto-acids. Its deficiency causes accumulation of these amino acids and their keto-acids → sweet maple syrup odor in urine.'},
      {q:'The transamination reactions of ALT and AST require which coenzyme?',ch:['NAD⁺','Thiamine pyrophosphate','Pyridoxal phosphate (PLP, B6)','Biotin'],ans:2,exp:'All aminotransferases require PLP (activated vitamin B6). PLP forms a Schiff base with the amino acid, accepting the amino group to become PMP, then donating it to α-KG to regenerate glutamate.'},
      {q:'Serotonin biosynthesis requires which amino acid and vitamin as a cofactor?',ch:['Tyrosine and B6','Tryptophan and BH₄ (tetrahydrobiopterin)','Phenylalanine and TPP','Histidine and PLP'],ans:1,exp:'Tryptophan → 5-hydroxytryptophan (via tryptophan hydroxylase requiring BH₄) → serotonin (via aromatic amino acid decarboxylase requiring PLP). Tryptophan also forms NAD⁺ via the kynurenine pathway (requires B6 and B3).'},
      {q:'A patient with homocystinuria from CBS deficiency has elevated homocysteine. High-dose B6 helps because:',ch:['B6 increases CBS gene transcription','PLP is a required cofactor for CBS; some mutations retain partial B6-responsive activity','B6 inhibits homocysteine remethylation to methionine','Pyridoxal increases renal clearance of homocysteine'],ans:1,exp:'Cystathionine β-synthase (CBS) requires PLP. Some missense mutations reduce but do not abolish PLP binding, so supraphysiologic PLP concentrations (high-dose B6) can partially restore enzyme activity.'},
      {q:'Which amino acid serves as the major carrier of nitrogen from peripheral tissues to the liver?',ch:['Glutamine only','Alanine and glutamine','Glutamate and aspartate','Arginine and citrulline'],ans:1,exp:'The glucose-alanine cycle: muscle transaminates pyruvate + glutamate → alanine + α-KG. Alanine is exported to liver, where it is converted back to pyruvate (for gluconeogenesis) and nitrogen enters the urea cycle via transamination to aspartate.'},
      {q:'Tyrosinase deficiency causes oculocutaneous albinism because tyrosinase is required to:',ch:['Convert tyrosine → thyroxine in thyroid follicles','Produce DOPA from tyrosine, initiating melanin synthesis','Catabolize phenylalanine in the liver','Generate catecholamines in the adrenal medulla'],ans:1,exp:'Tyrosinase (copper-containing enzyme in melanocytes) catalyzes tyrosine → DOPA → dopaquinone, the first committed steps of melanin synthesis. Its absence causes absence of melanin → albinism.'},
      {q:'The urea cycle occurs in which cellular compartments?',ch:['Entirely in the mitochondrial matrix','Entirely in the cytoplasm','Both mitochondrial matrix (steps 1-2) and cytoplasm (steps 3-5)','Both cytoplasm and ER membrane'],ans:2,exp:'First two steps: carbamoyl phosphate synthase I (mitochondria) forms carbamoyl phosphate, which reacts with ornithine → citrulline (mitochondria). Citrulline exits → cytoplasm for remaining reactions → arginine → urea (cytoplasm).'},
      {q:'N-acetylglutamate (NAG) is an obligate activator of which enzyme?',ch:['Argininosuccinate synthetase','Arginase','Carbamoyl phosphate synthetase I (CPS-I)','Ornithine transcarbamylase'],ans:2,exp:'CPS-I (the entry enzyme of the urea cycle, in mitochondria) requires NAG as an allosteric activator. NAG is synthesized by NAG synthase from acetyl-CoA + glutamate, activated by arginine. This links amino acid abundance to urea cycle capacity.'},
    ]
  },
  {
    id:'q04', cat:'Cell Biology', title:'Cell Signaling & Signal Transduction', diff:'Hard',
    qs:[
      {q:'Cholera toxin causes secretory diarrhea by permanently activating:',ch:['The Gi alpha subunit via ADP-ribosylation','The Gs alpha subunit via ADP-ribosylation (prevents GTPase activity)','Phospholipase C-β constitutively','Receptor tyrosine kinases in intestinal epithelium'],ans:1,exp:'Cholera toxin ADP-ribosylates Gsα, preventing its intrinsic GTPase activity. Permanent Gsα activation → continuous adenylyl cyclase activation → elevated cAMP → PKA → CFTR phosphorylation → massive Cl⁻/water secretion into intestinal lumen.'},
      {q:'The PI3K/Akt/mTOR pathway, activated downstream of RTKs, primarily promotes:',ch:['Apoptosis and autophagy','Cell survival, protein synthesis, and anabolic growth','AMPK activation and catabolic metabolism','p53 stabilization and cell cycle arrest'],ans:1,exp:'PI3K phosphorylates PIP₂ → PIP₃, recruiting Akt (PKB) to the membrane where PDK1 activates it. Akt phosphorylates mTORC1 (via TSC1/2) → S6K activation → ribosome biogenesis, protein synthesis, and cell survival signals.'},
      {q:'β-Arrestin promotes GPCR desensitization by:',ch:['Directly inactivating adenylyl cyclase','Competitively displacing the G-protein from the receptor','Sterically blocking G-protein coupling and targeting receptor for internalization via clathrin','Activating phosphodiesterase to degrade cAMP'],ans:2,exp:'GRK phosphorylates the activated GPCR. β-Arrestin binds phosphorylated GPCR → (1) sterically uncouples G-protein (desensitization); (2) recruits clathrin adaptor AP2 → clathrin-coated pit → endocytosis (internalization/receptor downregulation).'},
      {q:'Wnt signaling prevents β-catenin degradation by:',ch:['Directly phosphorylating GSK-3β to activate it','Inhibiting the Axin/APC/GSK-3β/CK1 destruction complex via Dishevelled','Promoting β-catenin nuclear export','Activating the proteasome to degrade β-catenin inhibitors'],ans:1,exp:'Without Wnt: destruction complex (Axin, APC, GSK-3β, CK1) phosphorylates β-catenin → ubiquitination → proteasomal degradation. With Wnt: Frizzled/LRP5/6 + Dishevelled inhibit the destruction complex → β-catenin accumulates → nuclear transcription.'},
      {q:'Epinephrine causes hepatic glycogenolysis through which signaling cascade?',ch:['β-AR → Gs → cAMP → PKA → phosphorylase kinase → glycogen phosphorylase','β-AR → Gi → decreased cAMP → PP1 → glycogen phosphorylase','α₁-AR → Gq → IP₃ → Ca²⁺ → glycogen phosphorylase only','β-AR → RTK → PI3K → Akt → glycogenolysis'],ans:0,exp:'Epinephrine binds β-adrenergic receptors (Gs-coupled) → adenylyl cyclase → cAMP ↑ → PKA → phosphorylates and activates phosphorylase kinase → activates glycogen phosphorylase b→a → glycogenolysis.'},
      {q:'The JAK-STAT pathway is primarily activated by:',ch:['Steroid hormones binding nuclear receptors','G-protein coupled receptors','Cytokines and growth hormone binding receptors without intrinsic kinase activity','Lipid-soluble second messengers in the cytoplasm'],ans:2,exp:'Cytokines (interferons, interleukins, EPO, GH) bind receptors lacking intrinsic kinase activity. Receptor-associated JAK tyrosine kinases trans-phosphorylate each other → phosphorylate receptor → recruit STATs → STAT dimerization → nuclear translocation → gene transcription.'},
      {q:'Diacylglycerol (DAG) produced by phospholipase C-β directly activates:',ch:['Adenylyl cyclase','Protein kinase A (PKA)','Protein kinase C (PKC)','Phospholipase A₂'],ans:2,exp:'PLC-β cleaves PIP₂ → IP₃ (releases Ca²⁺ from ER) + DAG. DAG remains in the plasma membrane and directly activates PKC (along with Ca²⁺ and phosphatidylserine). PKC phosphorylates diverse cellular targets.'},
      {q:'Tamoxifen acts as a SERM (selective estrogen receptor modulator) because:',ch:['It degrades ERα protein in all tissues','It competitively binds ER and produces tissue-specific agonist/antagonist effects depending on coregulator recruitment','It inhibits aromatase enzyme in all tissues equally','It blocks ER nuclear translocation exclusively in breast tissue'],ans:1,exp:'Tamoxifen-ER complex adopts a unique conformation: recruits corepressors in breast tissue (antagonist = blocks proliferation) but coactivators in bone/uterus (partial agonist). This tissue selectivity depends on which coregulators are present in that tissue.'},
      {q:'The Ras oncogene is constitutively activated by Gly12Val mutation because:',ch:['Val has inherently higher GTP-binding affinity than Gly','The Gly12 residue is critical for GAP-stimulated GTP hydrolysis; substitution prevents GTPase activity, locking Ras-GTP','Val activates SOS/GEF to continuously load GTP onto Ras','The mutation increases Ras expression via a transcriptional mechanism'],ans:1,exp:'GAP (GTPase-activating protein) stimulates GTP hydrolysis by Ras through an arginine finger that contacts Gly12 in the Ras active site. Gly12 substitution (Val, Asp, etc.) blocks the arginine finger → impaired GTPase → Ras stays locked in GTP-bound active state → constitutive MAPK activation.'},
      {q:'Which second messenger directly opens ryanodine receptors (RyR) on the SR in cardiac muscle?',ch:['IP₃ opening RyR2 directly','cAMP activating PKA which phosphorylates RyR2','Ca²⁺ influx through L-type voltage-gated Ca²⁺ channels triggering CICR (Ca²⁺-induced Ca²⁺ release)','DAG activating PKC to phosphorylate SR channels'],ans:2,exp:'Cardiac E-C coupling: membrane depolarization → L-type Ca²⁺ channels open → small Ca²⁺ influx → triggers RyR2 on SR → massive Ca²⁺ release (CICR, calcium-induced calcium release) → sarcomere contraction. This amplification step is unique to cardiac muscle.'},
    ]
  },
  {
    id:'q05', cat:'Physiology', title:'Cardiovascular Physiology', diff:'Hard',
    qs:[
      {q:'The Frank-Starling mechanism states that stroke volume increases when:',ch:['Heart rate increases due to sympathetic stimulation','Preload (end-diastolic volume) increases, optimizing sarcomere length for cross-bridge formation','Afterload decreases, reducing wall stress','Peripheral resistance falls due to vasodilation'],ans:1,exp:'Frank-Starling: increased venous return → greater EDV → sarcomere stretch to optimal length (~2.2 μm) → increased overlap of actin-myosin → increased force → increased stroke volume. This intrinsic mechanism allows the heart to match output to venous return without neural input.'},
      {q:'The QRS complex in a standard ECG represents:',ch:['Atrial depolarization spreading from SA node','Ventricular depolarization initiating ventricular contraction','Ventricular repolarization (relaxation)','AV nodal conduction delay'],ans:1,exp:'ECG sequence: P wave (atrial depolarization), PR interval (AV node delay), QRS (ventricular depolarization → ventricular contraction begins), ST segment (ventricular plateau), T wave (ventricular repolarization). Atrial repolarization is hidden within the QRS.'},
      {q:'Atrial natriuretic peptide (ANP) is released when atrial walls are stretched and causes:',ch:['Vasoconstriction and increased aldosterone to retain sodium','Vasodilation, increased GFR, inhibition of aldosterone, and natriuresis (sodium/water excretion)','Increased ADH release from the posterior pituitary','Decreased renin release with compensatory water retention'],ans:1,exp:'ANP: released by atrial cardiomyocytes when stretched (elevated blood volume/pressure). Causes afferent arteriole dilation + efferent constriction → increased GFR; natriuresis; inhibits RAAS and ADH; arterial vasodilation. Net: reduces preload and blood pressure.'},
      {q:'Which coronary artery is most commonly occluded in an anterior STEMI (ST elevation in V1-V4)?',ch:['Right coronary artery (RCA)','Left circumflex artery (LCx)','Left anterior descending artery (LAD)','Posterior descending artery (PDA)'],ans:2,exp:'The LAD ("widow maker") supplies the anterior wall, apex, and anterior 2/3 of the interventricular septum. LAD occlusion → anterior STEMI (V1-V4 ST elevation) → anterior wall infarction. RCA → inferior STEMI (II, III, aVF); LCx → lateral STEMI (I, aVL, V5-V6).'},
      {q:'In hypovolemic shock, the baroreceptor reflex immediately compensates by:',ch:['Decreasing heart rate and peripheral vasodilation to redistribute blood','Increasing heart rate and vasoconstriction to maintain mean arterial pressure','Activating RAAS for immediate volume restoration','Stimulating ANP to reduce vascular resistance'],ans:1,exp:'Decreased MAP → decreased baroreceptor stretch → increased sympathetic + decreased parasympathetic outflow → (1) tachycardia (HR ↑); (2) arteriolar vasoconstriction (SVR ↑); (3) increased contractility. Maintains MAP = CO × SVR on a seconds-to-minutes timescale.'},
      {q:'The cardiac refractory period is much longer than skeletal muscle because:',ch:['Cardiac cells have fewer voltage-gated Na⁺ channels','The L-type Ca²⁺ channel plateau (Phase 2) keeps the membrane depolarized ~200-300ms, preventing premature re-excitation','Cardiac muscle lacks T-tubules for rapid repolarization','The SA node suppresses premature ventricular contractions'],ans:1,exp:'Cardiac AP plateau (phase 2): L-type Ca²⁺ channels maintain depolarization for 200-300ms (vs. 1-2ms for skeletal). This long absolute refractory period prevents tetanus (lethal for cardiac function) and allows complete diastolic filling before the next beat.'},
      {q:'During exercise, the massive increase in skeletal muscle blood flow is primarily driven by:',ch:['Systemic ANP-mediated vasodilation','Local metabolic vasodilation (CO₂, H⁺, K⁺, adenosine) overriding sympathetic vasoconstriction','Cardiac output increase alone redistributing blood','Decreased blood viscosity from exercise-induced changes'],ans:1,exp:'Local metabolites (↑CO₂, ↑H⁺, ↑K⁺, ↑adenosine, ↓O₂, ↑heat, ↑osmolality) cause powerful arteriolar vasodilation in active muscle, overriding the general sympathetic vasoconstriction. This functional hyperemia increases muscle blood flow 15-25x during maximal exercise.'},
      {q:'Which change would increase pulse pressure (systolic - diastolic BP)?',ch:['Hypovolemic shock (reduces pulse pressure)','Aortic stenosis with reduced stroke volume (reduces pulse pressure)','Aortic regurgitation with large SV and rapid diastolic pressure drop (widens pulse pressure)','Cardiac tamponade (narrows pulse pressure, pulsus paradoxus)'],ans:2,exp:'Aortic regurgitation: regurgitant flow increases effective SV (high systolic) while blood runs back into LV during diastole (low diastolic) → wide pulse pressure (bounding/water-hammer pulse). Widened PP also occurs in aortic stiffness (elderly), high-output states, PDA, AV fistula.'},
      {q:'Pulsus paradoxus (exaggerated drop in systolic BP >10 mmHg during inspiration) is characteristic of:',ch:['Aortic regurgitation','Aortic stenosis with preserved EF','Cardiac tamponade and severe obstructive lung disease','Hypertrophic obstructive cardiomyopathy only'],ans:2,exp:'During inspiration: RV fills more (↑venous return) → septum shifts LEFT → reduces LV filling and SV → systolic BP drops. Normally <10 mmHg drop. In tamponade (constrained heart) or severe airway obstruction (large intrathoracic pressure swings), this exaggeration exceeds 10 mmHg.'},
      {q:'Afterload on the left ventricle is most directly represented by:',ch:['End-diastolic volume (EDV)','Systemic vascular resistance (SVR) and aortic pressure','Pulmonary capillary wedge pressure (PCWP)','Central venous pressure (CVP)'],ans:1,exp:'Afterload = force the ventricle must overcome during systole to eject blood. For the LV, this is primarily determined by systemic vascular resistance (SVR) and aortic impedance. By the law of Laplace: wall stress = (P × r)/(2h). High SVR (e.g., in hypertension) → increased afterload → increased O₂ demand → LV hypertrophy.'},
    ]
  },
  {
    id:'q06', cat:'Physiology', title:'Pulmonary Physiology', diff:'Hard',
    qs:[
      {q:'The O₂-Hb dissociation curve shifts RIGHT (decreased Hb affinity for O₂) when:',ch:['Temperature decreases, 2,3-DPG decreases, pH increases','Temperature increases, 2,3-DPG increases, PaCO₂ increases, pH decreases','PaCO₂ decreases and alkalosis is present (fetal conditions)','Carbon monoxide exposure increases Hb-O₂ affinity'],ans:1,exp:'Bohr effect (right shift = ↓affinity = ↑O₂ unloading to tissues): caused by ↑T°, ↑CO₂, ↓pH (acidosis), ↑2,3-DPG. All these conditions occur in exercising muscle, facilitating O₂ delivery where it is needed most. Left shift occurs with fetal Hb, CO, alkalosis, ↓T°, ↓2,3-DPG.'},
      {q:'Type II pneumocytes are primarily responsible for:',ch:['Gas exchange across the thin alveolar-capillary membrane','Producing surfactant (DPPC) and serving as progenitor cells that regenerate alveolar epithelium after injury','Phagocytosing inhaled particles and microorganisms','Lining the bronchioles to prevent infection'],ans:1,exp:'Type II pneumocytes (great alveolar cells): cuboidal, produce surfactant (primarily DPPC + SP-A, B, C, D), and are the stem cells of the alveolar epithelium. After injury, they proliferate and differentiate into type I cells (thin gas exchange surface covering 95% of alveolar area).'},
      {q:'Hypoventilation (reduced alveolar ventilation) primarily causes:',ch:['Decreased PaCO₂ and increased PaO₂','Increased PaCO₂ and decreased PaO₂ with normal A-a gradient','A-a gradient elevation above 15 mmHg','Metabolic alkalosis with normal PaO₂'],ans:1,exp:'Alveolar ventilation removes CO₂. Hypoventilation → PaCO₂ ↑ → respiratory acidosis. By the alveolar gas equation (PAO₂ = PiO₂ - PaCO₂/R), ↑PaCO₂ → ↓PAO₂ → ↓PaO₂ (hypoxemia). The A-a gradient remains NORMAL because the lungs themselves are working — just not ventilated enough.'},
      {q:'Hypoxic pulmonary vasoconstriction (HPV) serves to:',ch:['Increase blood flow to hypoxic alveoli to improve gas exchange','Divert blood away from poorly ventilated alveoli to better-ventilated regions, improving V/Q matching','Raise total pulmonary arterial pressure to recruit apex vessels','Stimulate surfactant production in response to decreased O₂'],ans:1,exp:'HPV: local alveolar hypoxia → vasoconstriction of adjacent arterioles → blood diverted to well-ventilated alveoli (opposite of systemic response). Optimizes V/Q matching. In global hypoxia (high altitude, COPD): generalized HPV → pulmonary hypertension → right heart strain (cor pulmonale).'},
      {q:'The primary mode of CO₂ transport in blood (approximately 70%) is:',ch:['Dissolved CO₂ in plasma','As carbaminohemoglobin bound to Hb','Bicarbonate (HCO₃⁻) formed in RBCs via carbonic anhydrase and exported via the chloride shift','As carbonic acid (H₂CO₃) in plasma'],ans:2,exp:'CO₂ transport: ~70% as HCO₃⁻ (CO₂ + H₂O → H₂CO₃ → H⁺ + HCO₃⁻ via CA in RBCs; HCO₃⁻ exits RBC via Cl⁻/HCO₃⁻ exchanger = chloride shift); ~20-25% as carbaminoHb; ~5-10% dissolved. At lungs, this reversal releases CO₂ for exhalation.'},
      {q:'A spirometry shows FEV₁/FVC = 58% (< 70%) and FEV₁ improves by 18% after bronchodilator. This pattern indicates:',ch:['Restrictive lung disease (low FVC, normal FEV₁/FVC)','Fixed obstructive disease (COPD) with minimal reversibility','Reversible obstructive disease (asthma) — significant bronchodilator response','Normal spirometry with artifact'],ans:2,exp:'Obstructive pattern: FEV₁/FVC < 70%. Significant reversibility: > 12% AND > 200 mL increase in FEV₁ after bronchodilator = reversible obstruction = asthma. COPD: minimal reversibility (< 12% or < 200 mL). Restrictive: low FVC, normal or elevated FEV₁/FVC ratio (> 70%).'},
      {q:'Surfactant deficiency (NRDS) in premature infants causes respiratory failure because by Laplace\'s Law (P = 2γ/r):',ch:['Larger alveoli collapse more easily without surfactant','Smaller alveoli have higher collapsing pressure; without surfactant to reduce γ, they empty into larger alveoli (Laplace), causing diffuse atelectasis','Surfactant is required directly for gas exchange across the membrane','DPPC deficiency impairs immune defense in the alveolus'],ans:1,exp:'P = 2γ/r: smaller alveoli have higher collapsing pressure. Normally, surfactant reduces surface tension (γ) proportionally as alveoli shrink (during exhalation), stabilizing them. Without surfactant, small alveoli progressively collapse (atelectasis) → shunt → severe hypoxemia → NRDS.'},
      {q:'Dead space ventilation (wasted ventilation) is INCREASED in which condition?',ch:['Lobar pneumonia (consolidation causing shunt, not dead space)','Pulmonary embolism (ventilated alveoli not perfused = dead space ↑)','Pulmonary edema (fluid in alveoli)','Obesity hypoventilation syndrome'],ans:1,exp:'Dead space = ventilated but not perfused alveoli. Types: anatomical (airways) + alveolar (ventilated, not perfused). Pulmonary embolism blocks perfusion to ventilated alveoli → alveolar dead space ↑ → wasted ventilation → increased minute ventilation needed to maintain PaCO₂ → tachypnea. Shunt is the opposite (perfused, not ventilated).'},
      {q:'In a patient with COPD and chronic hypercapnia (PaCO₂ = 60 mmHg), the primary ventilatory drive is:',ch:['Central chemoreceptors responding to elevated CO₂ (normal drive preserved)','Hypoxic drive via peripheral chemoreceptors (central receptors are desensitized by chronic CO₂ elevation)','Increased HCO₃⁻ levels stimulating medullary centers','Pulmonary stretch receptors activated by hyperinflation'],ans:1,exp:'Normally: central chemoreceptors (medulla) sense CO₂/H⁺ and drive ventilation. In chronic hypercapnia, the brain adapts (raises CSF HCO₃⁻ to normalize pH) → central receptors become desensitized. Drive shifts to peripheral chemoreceptors (carotid/aortic bodies) sensing hypoxia. High-flow O₂ removes this hypoxic drive → potential respiratory depression.'},
      {q:'Which lung volume CANNOT be measured by spirometry alone?',ch:['Tidal volume (TV)','Forced vital capacity (FVC)','Residual volume (RV) and total lung capacity (TLC)','Expiratory reserve volume (ERV)'],ans:2,exp:'Spirometry measures only the volumes you can exhale into a spirometer: TV, ERV, IRV, VC (= TV + ERV + IRV), FVC, FEV₁. It CANNOT measure residual volume (air remaining after maximal exhalation) because you cannot exhale it. RV and TLC require body plethysmography or helium dilution/nitrogen washout.'},
    ]
  },
  {
    id:'q07', cat:'Physiology', title:'Renal Physiology & Acid-Base', diff:'Hard',
    qs:[
      {q:'ADH (vasopressin) increases water reabsorption in the collecting duct by:',ch:['Activating Na-K-2Cl cotransporter in the thick ascending limb','Inserting aquaporin-2 (AQP2) water channels into the apical membrane via V2R-cAMP-PKA signaling','Stimulating aldosterone release from the adrenal cortex','Directly increasing Na⁺ reabsorption in the proximal tubule'],ans:1,exp:'ADH → V2 receptors (Gs-coupled) on principal cells → cAMP → PKA → phosphorylation of AQP2 vesicles → exocytosis into apical membrane → water reabsorption. AQP3/4 are constitutively present on the basolateral side. SIADH: excess ADH → dilutional hyponatremia.'},
      {q:'A normal-anion-gap metabolic acidosis is most consistent with:',ch:['Diabetic ketoacidosis (anion gap elevated)','Lactic acidosis from sepsis (anion gap elevated)','Diarrhea (GI bicarbonate loss) or renal tubular acidosis','Ethylene glycol ingestion (anion gap elevated)'],ans:2,exp:'Normal AG (8-12 mEq/L) metabolic acidosis = hyperchloremic metabolic acidosis (HCO₃⁻ lost or not regenerated, replaced by Cl⁻). Causes: diarrhea (GI HCO₃⁻ loss), RTA (impaired H⁺ secretion or HCO₃⁻ reabsorption), saline infusion (dilutional). DKA, lactic acidosis, toxins → unmeasured anions → elevated AG.'},
      {q:'Aldosterone acts on principal cells of the collecting duct to:',ch:['Insert AQP2 channels into the apical membrane','Increase apical ENaC and basolateral Na⁺/K⁺-ATPase, promoting Na⁺ reabsorption and K⁺ secretion','Stimulate α-intercalated cells to secrete H⁺','Inhibit Na⁺ reabsorption as a counter-regulatory hormone'],ans:1,exp:'Aldosterone (mineralocorticoid): binds nuclear MR receptor → SGK1 → increases ENaC expression and activity in apical membrane + Na⁺/K⁺-ATPase in basolateral membrane → Na⁺ reabsorption + K⁺ secretion. Hyperaldosteronism → hypertension, hypokalemia, metabolic alkalosis.'},
      {q:'The loop of Henle creates the medullary concentration gradient primarily via:',ch:['Active water reabsorption in the thin descending limb','Countercurrent multiplication: thick ascending limb (TALH) actively reabsorbs NaCl without water (impermeable), concentrating the medullary interstitium','Urea recycling from the collecting duct into the medullary interstitium','Passive NaCl reabsorption in the thin descending limb'],ans:1,exp:'TALH (site of furosemide action, Na-K-2Cl cotransporter): impermeable to water, actively reabsorbs NaCl → progressively concentrates the medullary interstitium. Thin descending limb: permeable to water, not NaCl → water exits osmotically → tubular fluid becomes hyperosmotic. Urea recycling (from collecting duct) further concentrates inner medulla.'},
      {q:'SIADH most directly causes:',ch:['Hypernatremia with dilute urine (urine osmolality < 100)','Hyponatremia with inappropriately concentrated urine (urine osmolality > 100) despite low serum osmolality','Hyperkalemia from reduced aldosterone secretion','Nephrogenic diabetes insipidus with polyuria'],ans:1,exp:'SIADH: excess ADH → maximum water retention from collecting duct → dilutional hyponatremia. Urine is inappropriately concentrated (>100 mOsm/kg, often >300) when it should be maximally dilute. Urine Na⁺ > 20-40 mEq/L. Treated by water restriction ± V2 receptor antagonists (vaptans).'},
      {q:'The Starling forces governing fluid movement across capillaries predict edema from all of the following EXCEPT:',ch:['Increased capillary hydrostatic pressure (heart failure, venous obstruction)','Decreased plasma oncotic pressure (nephrotic syndrome, liver failure, malnutrition)','Increased lymphatic drainage capacity','Increased capillary permeability (inflammation, ARDS, burns)'],ans:2,exp:'Edema = net filtration > lymphatic drainage. Causes per Starling: ↑Pcap (venous obstruction, heart failure); ↓πplasma (hypoalbuminemia); ↑permeability (inflammation); lymphatic obstruction (filariasis, lymph node dissection). INCREASED lymphatic drainage would PREVENT edema by clearing excess interstitial fluid.'},
      {q:'A patient has pH 7.32, PaCO₂ 55 mmHg, HCO₃⁻ 28 mEq/L. This blood gas shows:',ch:['Metabolic acidosis with respiratory compensation','Metabolic alkalosis with respiratory compensation','Respiratory acidosis with metabolic compensation','Respiratory alkalosis with metabolic compensation'],ans:2,exp:'Respiratory acidosis: primary problem is ↑PaCO₂ (55, elevated) → pH falls (7.32 < 7.40). HCO₃⁻ is elevated (28 > 24) = metabolic compensation by kidneys (retaining HCO₃⁻ to buffer the extra acid). Direction of PaCO₂ change determines respiratory vs. metabolic: ↑PaCO₂ = respiratory acidosis.'},
      {q:'GFR decreases when:',ch:['Afferent arteriole dilates (e.g., via prostaglandins)','Plasma oncotic pressure decreases (reduces opposing force to filtration)','Efferent arteriole constricts markedly, increasing oncotic pressure in the capillary','Systemic blood pressure increases moderately'],ans:2,exp:'GFR = Kf × (ΔP - Δπ). Efferent arteriole constriction initially raises glomerular hydrostatic pressure (↑GFR) but also concentrates plasma proteins (↑glomerular oncotic pressure, ↑Δπ). Marked efferent constriction (e.g., high-dose angiotensin II, NSAIDs + ACEi/ARB) → net ↑Δπ exceeds ↑P → GFR falls.'},
      {q:'Which segment of the nephron is responsible for reabsorbing approximately 85% of filtered bicarbonate?',ch:['Thin descending limb of loop of Henle','Proximal convoluted tubule (PCT) via Na⁺/H⁺ exchange and luminal carbonic anhydrase IV','Thick ascending limb of the loop of Henle','Cortical collecting duct α-intercalated cells exclusively'],ans:1,exp:'PCT: Na⁺/H⁺ exchanger (NHE3) secretes H⁺ into lumen → H⁺ + HCO₃⁻ → H₂CO₃ → CO₂ + H₂O (via luminal CA IV) → CO₂ diffuses into cell → H₂CO₃ → H⁺ + HCO₃⁻ (via cytoplasmic CA II) → HCO₃⁻ exits basolaterally. Acetazolamide (CA inhibitor) blocks this → HCO₃⁻ lost in urine → metabolic acidosis.'},
      {q:'Conn syndrome (primary hyperaldosteronism, usually from an adrenal adenoma) characteristically presents with:',ch:['Hyponatremia, hyperkalemia, metabolic acidosis, and hypotension','Hypertension, hypokalemia, metabolic alkalosis, and low plasma renin activity','Hypertension, hyperkalemia, metabolic acidosis, and high plasma renin activity','Hypotension, hyponatremia, hyperkalemia, and elevated plasma renin'],ans:1,exp:'Primary hyperaldosteronism: autonomous aldosterone secretion → ENaC activation → Na⁺ retention (hypertension) + K⁺ secretion (hypokalemia) + H⁺ secretion by α-intercalated cells (metabolic alkalosis). Renin is LOW (suppressed by high blood pressure). Contrast with secondary hyperaldosteronism (high renin from renal artery stenosis, etc.).'},
    ]
  },
  {
    id:'q08', cat:'Physiology', title:'Neurophysiology & Neuroscience', diff:'Hard',
    qs:[
      {q:'The resting membrane potential (~−70 mV) is primarily maintained by:',ch:['Direct electrogenic contribution of the Na⁺/K⁺-ATPase pump (−50 mV directly)','High K⁺ permeability at rest: K⁺ flows out down its concentration gradient, leaving impermeant anions inside','High Cl⁻ impermeability maintaining a negative interior','Na⁺ influx through constitutively open voltage-gated channels'],ans:1,exp:'At rest, most open channels are K⁺ leak channels. K⁺ exits down its concentration gradient (maintained by Na⁺/K⁺-ATPase), leaving large impermeant anions (proteins, organic phosphates) → negative interior. The Na⁺/K⁺-ATPase contributes only ~−3 mV directly (3 Na⁺ out, 2 K⁺ in).'},
      {q:'During the absolute refractory period, a second action potential cannot be triggered because:',ch:['K⁺ efflux has hyperpolarized the membrane below the threshold','Voltage-gated Na⁺ channels are in the inactivated (h-gate closed) state, unresponsive to any stimulus','The Na⁺/K⁺-ATPase is actively depleting cytoplasmic Na⁺','Cl⁻ influx prevents membrane depolarization'],ans:1,exp:'After Na⁺ channels open (m-gate), they rapidly inactivate (h-gate closes) within 1-2ms while the membrane is still depolarized. Inactivated channels cannot open regardless of stimulus magnitude — they must repolarize first to allow m-gate closing and h-gate reopening (recovery from inactivation = relative refractory period).'},
      {q:'LTP (long-term potentiation) at hippocampal synapses requires NMDA receptors because they:',ch:['Are solely responsible for all excitatory transmission at Schaffer collaterals','Require BOTH glutamate binding AND postsynaptic depolarization (to remove Mg²⁺ block), allowing Ca²⁺ influx that triggers synaptic strengthening','Directly activate CaMKII without Ca²⁺','Have 10× higher affinity for glutamate than AMPA receptors'],ans:1,exp:'NMDA receptors are coincidence detectors: require simultaneous presynaptic glutamate release AND postsynaptic depolarization (to relieve the Mg²⁺ block). Ca²⁺ influx → CaMKII activation → AMPA receptor phosphorylation + insertion → stronger synapse. Cellular basis of associative (Hebbian) learning.'},
      {q:'The E_K (equilibrium potential for K⁺) with [K⁺]in = 140 mM and [K⁺]out = 4 mM at 37°C is approximately:',ch:['−35 mV','+94 mV','−94 mV','−55 mV'],ans:2,exp:'E_K = (RT/zF) × ln([K]out/[K]in) = 26.7 mV × ln(4/140) = 26.7 × (−3.56) ≈ −95 mV. The resting Vm (−70 mV) sits between E_K (−94 mV) and E_Na (+60 mV), weighted by relative conductances. High resting K⁺ conductance pulls Vm toward E_K.'},
      {q:'Myelination dramatically increases axonal conduction velocity primarily by:',ch:['Increasing Na⁺ channel density along the axon','Increasing effective membrane thickness (d), reducing capacitance C = ε₀εA/d, enabling faster local current spread between nodes of Ranvier (saltatory conduction)','Increasing axoplasmic resistance to focus current flow','Adding K⁺ leak channels at nodes for faster repolarization'],ans:1,exp:'Myelin wraps increase effective membrane thickness → reduces capacitance → less charge needed to depolarize membrane → current from one node of Ranvier rapidly depolarizes the next node (saltatory conduction). Conduction velocity: unmyelinated ~1 m/s; myelinated Aα fibers ~70-120 m/s.'},
      {q:'A patient has weakness of the right arm and leg with right lower facial droop (forehead spared). The lesion most likely is:',ch:['Right motor cortex/corticospinal tract (ipsilateral lesion)','Left internal capsule or motor cortex above the facial nucleus (contralateral hemiplegia + UMN facial palsy)','Right facial nerve (CN VII) peripherally (LMN lesion)','Left cerebellar hemisphere (ipsilateral ataxia, no weakness)'],ans:1,exp:'UMN facial weakness spares the forehead (bilateral cortical representation). Corticospinal fibers cross in medullary pyramids → left hemisphere controls right body. Lesion ABOVE the left facial nucleus → right lower facial + right arm + right leg weakness. Classic location: left internal capsule (MCA territory).'},
      {q:'Broca\'s aphasia is characterized by:',ch:['Fluent paraphasic speech with poor comprehension and poor repetition (Wernicke\'s)','Non-fluent, telegraphic, effortful speech with relatively preserved comprehension and poor repetition','Normal speech with inability to repeat (conduction aphasia)','Complete loss of all language modalities (global aphasia)'],ans:1,exp:'Broca\'s area (left inferior frontal gyrus, Brodmann 44/45): speech production. Broca\'s aphasia: non-fluent (effortful, telegraphic, agrammatic), comprehension relatively preserved, poor repetition. Patients are aware of their deficit (frustrated). Often associated with right hemiparesis (MCA superior division).'},
      {q:'Horner\'s syndrome (ipsilateral ptosis, miosis, anhidrosis) results from disruption of the:',ch:['Parasympathetic pathway from CN III to the dilator pupillae','Sympathetic pathway: hypothalamus → C8-T2 lateral horn → superior cervical ganglion → dilator pupillae, superior tarsal muscle, facial sweat glands','Corticospinal tract causing loss of voluntary eyelid control','CN IV (trochlear) nucleus causing ptosis and miosis'],ans:1,exp:'3-neuron sympathetic chain: 1st neuron (hypothalamus → C8-T2 lateral horn); 2nd neuron (T1 exits, loops over lung apex → superior cervical ganglion); 3rd neuron (along internal carotid → dilator pupillae, superior tarsal, facial sweat glands). Causes: Pancoast tumor (2nd), carotid dissection (3rd), lateral medullary syndrome (1st).'},
      {q:'Dopamine\'s role in the nigrostriatal pathway and Parkinson\'s disease involves:',ch:['Dopamine inhibits the direct pathway and activates the indirect pathway to reduce movement','Loss of dopamine → underactivation of direct pathway + overactivation of indirect pathway → excessive GPi output → reduced thalamocortical drive → bradykinesia and rigidity','Dopamine acts exclusively on D1 receptors in the striatum','Dopamine deficiency causes hyperdopaminergic states in the limbic system'],ans:1,exp:'Normal: dopamine activates D1 (direct pathway: decreased GPi inhibition → more movement) and inhibits D2 (indirect pathway: decreased STN excitation of GPi → more movement). In PD: loss of dopamine from SNc → decreased direct pathway + increased indirect pathway → excess GPi inhibition of thalamus → bradykinesia, rigidity, tremor.'},
      {q:'The blood-brain barrier is primarily formed by:',ch:['Astrocyte end-feet surrounding capillaries','Tight junctions between brain capillary endothelial cells, supplemented by astrocyte end-feet and pericytes','The meningeal layers surrounding the brain','Microglial cells that phagocytose molecules trying to enter'],ans:1,exp:'BBB: brain capillary endothelial cells have extensive tight junctions (claudin-5, occludin, ZO-1) limiting paracellular passage. Astrocyte end-feet and pericytes regulate tight junction formation and maintain BBB integrity. Lipid-soluble molecules and specific transporters (GLUT1, LAT1) cross; most polar molecules and large proteins are excluded.'},
    ]
  },
  {
    id:'q09', cat:'General Chemistry', title:'Thermodynamics & Equilibrium', diff:'Hard',
    qs:[
      {q:'Gibbs free energy (ΔG = ΔH − TΔS) predicts spontaneity. A reaction with ΔH > 0 and ΔS > 0 is:',ch:['Always spontaneous at all temperatures','Never spontaneous at any temperature','Spontaneous at HIGH temperatures (when TΔS > ΔH)','Spontaneous at LOW temperatures (when ΔH dominates)'],ans:2,exp:'When ΔH > 0 (endothermic) and ΔS > 0 (entropy increases): ΔG = ΔH − TΔS. At low T, ΔH > TΔS → ΔG > 0 (non-spontaneous). At high T, TΔS > ΔH → ΔG < 0 (spontaneous). Example: dissolution of ammonium nitrate in water (entropy-driven, endothermic).'},
      {q:'The Henderson-Hasselbalch equation applied to blood: if pH = 7.40, pKa = 6.10 for H₂CO₃/HCO₃⁻, the [HCO₃⁻]/[H₂CO₃] ratio is:',ch:['10:1','20:1','5:1','100:1'],ans:1,exp:'pH = pKa + log([A⁻]/[HA]) → 7.40 = 6.10 + log(ratio) → log(ratio) = 1.30 → ratio = 10^1.30 = 20. The 20:1 ratio ([HCO₃⁻]:[H₂CO₃]) is maintained by lungs (CO₂ removal) and kidneys (HCO₃⁻ reabsorption). This gives normal blood pH = 7.40.'},
      {q:'Le Chatelier\'s principle predicts that for the reaction: N₂ + 3H₂ ⇌ 2NH₃ (exothermic), increasing temperature will:',ch:['Shift equilibrium toward products (more NH₃)','Shift equilibrium toward reactants (less NH₃) because it favors the endothermic reverse reaction','Have no effect on equilibrium constant Keq','Increase Keq, favoring NH₃ production'],ans:1,exp:'For an exothermic reaction, heat is a "product." Increasing temperature adds heat → Le Chatelier\'s principle → system shifts to consume heat → reverse (endothermic) reaction favored → equilibrium shifts LEFT (less NH₃, higher N₂ and H₂). Keq DECREASES with temperature for exothermic reactions.'},
      {q:'A positive ΔG° (standard Gibbs free energy change) means:',ch:['The reaction is spontaneous under standard conditions and Keq > 1','The reaction is non-spontaneous under standard conditions and Keq < 1','ΔG = ΔG° under all conditions regardless of concentrations','The reaction cannot proceed in either direction'],ans:1,exp:'ΔG° = −RT ln Keq. Positive ΔG° → negative ln Keq → Keq < 1 (equilibrium favors reactants under standard conditions). However, ΔG° ≠ ΔG: if Q << Keq, ΔG can be negative even if ΔG° > 0 (reaction driven by reactant excess). In cells, ATP hydrolysis ΔG ≈ −50 kJ/mol (vs. ΔG° = −30.5 kJ/mol).'},
      {q:'Hess\'s Law is useful in biochemistry because:',ch:['It predicts reaction rates from thermodynamic data','Enthalpy (H) is a state function; ΔH for a reaction is the same regardless of the pathway, allowing calculation of difficult reactions from known ones','It describes how equilibrium constants change with temperature (van\'t Hoff equation)','It relates ΔG to the maximum work extractable from a process'],ans:1,exp:'Hess\'s Law: ΔH is a state function (path-independent). ΔH_total = ΣΔH_steps. Allows calculation of ΔH for any reaction by algebraically combining reactions with known ΔH values (e.g., combustion enthalpies). Also applies to ΔG (ΔG_total = ΣΔG_steps) — used to calculate ΔG of biochemical reactions from standard tables.'},
      {q:'For an ideal gas, which of the following correctly describes the relationship between PV and temperature?',ch:['PV = nRT, so PV is proportional to T (in Kelvin) at constant n','PV = nRT only applies at constant pressure (isobaric processes)','PV decreases as T increases at constant n','PV is independent of temperature for real gases'],ans:0,exp:'Ideal Gas Law: PV = nRT. At constant n (moles), PV = nRT → PV ∝ T (in Kelvin). If T doubles (at constant n), PV doubles. If P is held constant and T increases, V increases proportionally (Charles\'s Law). If V is constant, P increases with T (Gay-Lussac\'s Law).'},
      {q:'The osmotic pressure (π) of a solution is given by π = iMRT. For a 0.15 M NaCl solution at 37°C, π ≈:',ch:['0.15 atm','3.7 atm','7.4 atm','15 atm'],ans:1,exp:'NaCl dissociates into Na⁺ + Cl⁻, so i ≈ 2. π = iMRT = 2 × 0.15 mol/L × 0.0821 L·atm/mol·K × 310 K ≈ 7.6 atm. However, using the approximation for physiological solutions: isotonic NaCl (0.9%) ≈ 0.154 M → π ≈ 7-8 atm. Normal plasma osmolality is ~285 mOsm/kg.'},
      {q:'Buffer capacity is greatest when:',ch:['pH >> pKa (mostly conjugate base)','pH << pKa (mostly weak acid)','pH = pKa (equal amounts of weak acid and conjugate base)','High concentration of strong acid is present'],ans:2,exp:'Buffer capacity is maximum at pH = pKa where [HA] = [A⁻]. At this point, the buffer can absorb both added acid (reacting with A⁻) and added base (reacting with HA) most effectively. Effective buffering range: pKa ± 1. Blood carbonate buffer (pKa = 6.1) works at pH 7.4 via the open CO₂ system.'},
      {q:'The van\'t Hoff factor (i) for CaCl₂ (if fully dissociated) is:',ch:['1','2','3','4'],ans:2,exp:'CaCl₂ → Ca²⁺ + 2Cl⁻ = 3 ions per formula unit → i = 3 (assuming complete dissociation). Important for colligative property calculations: ΔTb = ikbm, ΔTf = ikfm, π = iMRT. Ion pairing in concentrated solutions reduces actual i below theoretical maximum.'},
      {q:'The solubility product (Ksp) for CaF₂ is 3.9 × 10⁻¹¹. In pure water, [Ca²⁺] at equilibrium is approximately:',ch:['3.4 × 10⁻⁴ M','1.97 × 10⁻⁵ M','6.3 × 10⁻⁴ M','9.8 × 10⁻⁶ M'],ans:0,exp:'CaF₂ ⇌ Ca²⁺ + 2F⁻. Let [Ca²⁺] = x → [F⁻] = 2x. Ksp = (x)(2x)² = 4x³ = 3.9 × 10⁻¹¹ → x³ = 9.75 × 10⁻¹² → x = (9.75 × 10⁻¹²)^(1/3) ≈ 2.14 × 10⁻⁴ M ≈ 3.4 × 10⁻⁴ M (close, checking: 4 × (2.14)³ × 10⁻¹² ≈ 3.9 × 10⁻¹¹ ✓).'},
    ]
  },
  {
    id:'q10', cat:'Organic Chemistry', title:'Reaction Mechanisms & Stereochemistry', diff:'Hard',
    qs:[
      {q:'(R)-2-bromobutane undergoes SN2 with NaOH. The product is:',ch:['(R)-2-butanol (retention of configuration)','(S)-2-butanol (inversion of configuration, Walden inversion)','Racemic 2-butanol (50/50 mixture)','2-butene (elimination predominates)'],ans:1,exp:'SN2 mechanism: backside attack by OH⁻ on the electrophilic carbon → Walden inversion (configuration inverted 100%). (R) starting material → (S) product because the nucleophile replaces the leaving group from the opposite face. Bimolecular, concerted, no carbocation, complete stereochemical inversion.'},
      {q:'Which substrate undergoes SN1 fastest?',ch:['Methyl bromide (CH₃Br)','n-Propyl chloride (primary)','Isopropyl chloride (secondary)','tert-Butyl chloride (tertiary)'],ans:3,exp:'SN1 rate depends on carbocation stability (rate-determining step = ionization). Stability: 3° > 2° > 1° > methyl. tert-Butyl chloride forms the most stable tertiary carbocation → fastest SN1. Methyl and primary substrates essentially don\'t undergo SN1; they prefer SN2.'},
      {q:'The Diels-Alder [4+2] cycloaddition requires the diene to be in which conformation?',ch:['s-trans conformation (for orbital symmetry)','s-cis conformation (so terminal carbons can reach the dienophile simultaneously)','Chair conformation (for stereoelectronic effects)','Anti conformation (to maximize orbital overlap)'],ans:1,exp:'s-Cis conformation allows both terminal carbons of the diene to simultaneously approach the dienophile in the concerted [4+2] pericyclic reaction. s-Trans dienes cannot adopt the necessary geometry for reaction (terminal carbons are too far apart). This is why cyclic dienes (locked s-cis) are excellent Diels-Alder dienes.'},
      {q:'E2 elimination requires the H and leaving group to be:',ch:['Gauche to each other (60° dihedral)','Syn-periplanar (0° dihedral)','Anti-periplanar (180° dihedral) for proper orbital overlap in the transition state','Perpendicular (90°) for optimal p-orbital interaction'],ans:2,exp:'E2 is a concerted, bimolecular elimination requiring anti-periplanar geometry (180° H-C-C-LG dihedral). This allows proper overlap of the C-H σ* and C-LG σ* orbitals with the developing π bond. For cyclohexane substrates, both H and LG must be diaxial (anti-periplanar) for E2.'},
      {q:'Markovnikov addition of HBr to propene gives which major product?',ch:['1-bromopropane (anti-Markovnikov)','2-bromopropane (Markovnikov)','Allyl bromide (NBS-like radical)','Equal amounts of 1- and 2-bromopropane'],ans:1,exp:'Markovnikov\'s rule: proton adds to the less-substituted carbon (forming the more stable, more substituted carbocation as intermediate). For propene (CH₃-CH=CH₂): H⁺ adds to C3 → 2° carbocation at C2 → Br⁻ attacks C2 → 2-bromopropane (major product). Anti-Markovnikov (1-bromopropane) requires radical conditions (ROOR, hν).'},
      {q:'A compound with 3 stereocenters and no meso forms has how many maximum possible stereoisomers?',ch:['3','6','8','12'],ans:2,exp:'Maximum stereoisomers = 2ⁿ where n = number of stereocenters (in the absence of meso forms or restricted rotation). With 3 stereocenters: 2³ = 8 stereoisomers (4 pairs of enantiomers). Meso forms reduce this number. This formula gives the maximum; actual number may be less.'},
      {q:'Ozonolysis of 2-butene followed by reductive workup (Me₂S) gives:',ch:['Propanoic acid + formaldehyde','Acetaldehyde (CH₃CHO) × 2','Acetone + formaldehyde','2-butanone and CO₂'],ans:1,exp:'2-Butene (CH₃-CH=CH-CH₃): ozonolysis cleaves C=C double bond. Reductive workup (Me₂S, DMS): aldehydes from non-terminal C=C. Each carbon of the double bond → carbonyl. CH₃-CHO + CH₃-CHO (two equivalents of acetaldehyde). Oxidative workup (H₂O₂) would give carboxylic acids from internal alkenes.'},
      {q:'The Grignard reagent (RMgX) is a powerful nucleophile because:',ch:['Mg is more electronegative than C, making the Grignard acidic','The C-Mg bond is highly polarized (C is δ⁻), making carbon act as a carbanion equivalent','The halide ion (X⁻) is the actual nucleophile in reactions','Mg coordinates with the carbonyl oxygen, activating the substrate'],ans:1,exp:'In RMgX, Mg (less electronegative than C) pulls electron density away from C → C is δ⁻ (carbanion-like). Grignards react with electrophilic carbons (carbonyls, CO₂, epoxides, esters). Must be used in anhydrous conditions (react instantly with water/protic solvents).'},
      {q:'In an IR spectrum, a broad absorption centered around 2500–3300 cm⁻¹ strongly suggests:',ch:['A terminal alkyne (C≡C-H stretch at ~3300 cm⁻¹)','An O-H stretch of a carboxylic acid (hydrogen-bonded, broad due to H-bonding dimer formation)','An N-H stretch of a secondary amine','A C=O stretch of an ester'],ans:1,exp:'Carboxylic acids form hydrogen-bonded dimers in solution/solid, producing a characteristic very broad, strong absorption from ~2500–3300 cm⁻¹ (O-H stretch) along with the C=O stretch at ~1710 cm⁻¹. This broad O-H + the C=O is the diagnostic signature of RCOOH. Alcohols show narrower O-H at 3200–3550 cm⁻¹.'},
      {q:'In ¹H NMR, the chemical shift of a proton directly bonded to a carbon adjacent to a carbonyl (α-proton) is approximately:',ch:['0–1 ppm (alkyl-like)','2–3 ppm (slightly deshielded by C=O induction)','4.5–6 ppm (vinyl-like)','6–8 ppm (aromatic-like)'],ans:1,exp:'α-Protons (adjacent to C=O) resonate at δ 2–3 ppm due to inductive deshielding by the electronegative carbonyl oxygen. They are more downfield than pure alkyl H (δ 0.9–1.5 ppm) but upfield from vinyl/aromatic H. α-Protons are also relatively acidic (pKa ~20 for ketones) due to enolate stabilization.'},
    ]
  },
  {
    id:'q11', cat:'Physics', title:'Fluid Mechanics & Electricity', diff:'Hard',
    qs:[
      {q:'According to Poiseuille\'s Law, if the radius of a blood vessel decreases by 50%, flow rate decreases by a factor of:',ch:['2','4','8','16'],ans:3,exp:'Q = πr⁴ΔP/8ηL. Flow is proportional to r⁴. Halving the radius: Q ∝ (0.5)⁴ = 1/16. Flow decreases 16-fold. This is why small changes in arteriole radius (regulated by smooth muscle tone) have enormous effects on organ perfusion and peripheral resistance.'},
      {q:'The Reynolds number determines whether flow is laminar or turbulent. Blood flow becomes turbulent (Re > 2000) when:',ch:['Blood viscosity increases (polycythemia)','Vessel radius decreases alone (like capillaries)','Velocity increases and/or diameter increases (as in aortic stenosis post-stenosis)','Blood density decreases significantly'],ans:2,exp:'Re = ρvD/η. Turbulence occurs when Re > 2000–4000. In aortic stenosis: blood squirts through a narrow opening at high velocity → just beyond the stenosis, the jet expands into a wider space → high v, turbulence → murmur (Bernoulli + Re). Anemia (↓η) also increases Re and can cause flow murmurs.'},
      {q:'Bernoulli\'s equation (P + ½ρv² + ρgh = constant) explains why an aneurysm is dangerous because at the widened section:',ch:['Velocity increases and pressure increases (more dangerous)','Velocity decreases and lateral wall pressure increases — the wall faces greater distending force','Both velocity and pressure decrease (safer)','Only turbulence changes, without pressure alteration'],ans:1,exp:'Continuity (A₁v₁ = A₂v₂): wider vessel → slower velocity. Bernoulli: lower v → higher P. The increased lateral pressure (hydrostatic) at the aneurysm wall distends it further → further widening → more pressure increase → positive feedback → rupture risk. Slow flow in the aneurysm also promotes thrombus formation.'},
      {q:'Surface tension in alveoli is reduced by pulmonary surfactant. This is physiologically critical because by Laplace\'s Law (P = 2γ/r), without surfactant:',ch:['Larger alveoli would selectively collapse due to their higher transmural pressure','Smaller alveoli would have higher transmural pressure and would collapse into larger alveoli (alveolar instability)','All alveoli would remain stable since P and r cancel out','Surfactant only matters during inspiration, not expiration'],ans:1,exp:'Laplace: P = 2γ/r. Without surfactant, smaller alveoli (smaller r) have higher P than larger ones → gas flows from small to large → small alveoli collapse into large (progressive atelectasis). Surfactant reduces γ as alveoli shrink (during exhalation), maintaining P = 2γ/r relatively constant across alveolar sizes.'},
      {q:'Fick\'s First Law of Diffusion (J = −D × A × ΔC / Δx) predicts that O₂ diffusion across the alveolar-capillary membrane is impaired when:',ch:['Alveolar surface area increases (exercise)','Membrane thickness increases (fibrosis), or surface area decreases (emphysema), or ΔC decreases (high altitude)','Blood flow increases (exercise)','Respiratory rate increases'],ans:1,exp:'J ∝ A × ΔC / Δx. Diffusion impairment: ↑Δx (membrane thickening — pulmonary fibrosis, pulmonary edema); ↓A (surface area loss — emphysema, pneumonectomy); ↓ΔC (reduced PiO₂ at high altitude; low mixed venous PO₂ in severe anemia). Exercise worsens diffusion impairment (reduced transit time for RBCs in pulmonary capillaries).'},
      {q:'The resting membrane potential of a neuron (−70 mV) can be calculated using the Goldman equation. The E_Na (sodium equilibrium potential) is approximately:',ch:['−94 mV','+60 mV','−55 mV','−35 mV'],ans:1,exp:'E_Na = (RT/zF) × ln([Na]out/[Na]in) = 26.7 mV × ln(145/15) ≈ 26.7 × 2.27 ≈ +61 mV. E_Na is highly positive because Na⁺ is much more concentrated outside (145 mM) than inside (15 mM). Na⁺ influx is thermodynamically favored. During an action potential, the membrane briefly approaches +30 to +40 mV (near E_Na).'},
      {q:'Ohm\'s Law for an ionic current through a membrane channel is I = g(Vm − Eion). Current through a K⁺ channel is zero when:',ch:['The membrane potential equals the Nernst potential for Na⁺','Vm = E_K (electrochemical equilibrium for K⁺)','The channel is in the open probability = 0 state only','Vm = 0 mV (electroneutral condition)'],ans:1,exp:'I = g(Vm − E_K). Current = 0 when Vm = E_K (driving force is zero). At this voltage, the electrical force (moving K⁺ in) exactly balances the chemical force (moving K⁺ out down concentration gradient). This is the Nernst equilibrium potential — thermodynamic equilibrium, no net ion movement.'},
      {q:'An electrocardiogram (ECG) lead II primarily detects electrical activity in which direction?',ch:['Horizontal (left to right)','Superior to inferior (roughly from base to apex of the heart)','Anterior to posterior','Right atrium to left ventricle transversely'],ans:1,exp:'Lead II: from right arm (−) to left leg (+). The positive electrode is at the left leg (inferior). The normal cardiac electrical axis (left inferior direction, ~60°) is aligned toward lead II → tall positive P, QRS, and T waves in lead II. Best lead to visualize the P wave for rhythm analysis.'},
      {q:'The time constant (τ = RC) of a neuron determines:',ch:['The duration of the action potential plateau phase','How quickly membrane voltage changes in response to a current injection (temporal summation and EPSP duration)','The amplitude of the action potential','The velocity of saltatory conduction'],ans:1,exp:'τ = Rm × Cm (membrane resistance × capacitance). Larger τ → slower voltage response → longer EPSP duration → better temporal summation. Myelination decreases Cm → smaller τ → faster responses → sharper integration of inputs. High-input-resistance neurons (small cells) have large τ → better temporal summation.'},
      {q:'Which of the following correctly describes a capacitor in a biological membrane context?',ch:['The membrane capacitor stores charge proportionally to voltage (Q = CV), slowing voltage changes','The membrane capacitor acts as a short-circuit, instantly transferring all charge across it','Capacitance is maximized by decreasing membrane thickness','Capacitors in biological membranes are irrelevant to electrical signaling'],ans:0,exp:'Biological membranes act as capacitors: the lipid bilayer is a dielectric separating two conductive aqueous compartments. Q = CV means charge must accumulate to change voltage → capacitance slows voltage changes. C = ε₀εA/d; thinner membranes have higher capacitance (myelination increases d → reduces C → speeds electrical signaling).'},
    ]
  },
  {
    id:'q12', cat:'Genetics', title:'Inheritance Patterns & Molecular Genetics', diff:'Hard',
    qs:[
      {q:'A man with X-linked recessive color blindness has children with a female carrier. The probability that their daughter has color blindness is:',ch:['0% (X-linked diseases don\'t affect daughters)','25% of all children','50% of daughters','100% of daughters'],ans:2,exp:'Father: X^b Y (affected). Mother: X^B X^b (carrier). Daughters always receive X^b from father + either X^B or X^b from mother. So: 1/2 X^B X^b (carrier, unaffected) and 1/2 X^b X^b (color blind). Probability daughter is color blind = 50% of daughters.'},
      {q:'Hardy-Weinberg equilibrium is maintained ONLY when all five conditions are met. Which of the following violates HWE?',ch:['Random mating within the population','Large population size','Natural selection favoring one allele over another','No mutation in the gene of interest'],ans:2,exp:'HWE requires: (1) large population, (2) random mating, (3) no mutation, (4) no migration, (5) no natural selection. If natural selection favors one allele (directional or stabilizing), allele frequencies change across generations → HWE is violated. HWE is a null model; deviations indicate evolutionary forces are operating.'},
      {q:'Anticipation (increasing severity and decreasing age of onset in successive generations) in Huntington\'s disease is caused by:',ch:['Epigenetic methylation accumulating over generations','Mitochondrial DNA heteroplasmy increasing','CAG trinucleotide repeat expansion in the HTT gene during gametogenesis, especially paternal transmission','De novo mutations occurring at higher rates in subsequent generations'],ans:2,exp:'HD: CAG repeats in HTT exon 1 encode a polyglutamine (polyQ) tract. Normal: 10-35; pathogenic: ≥36 (≥40 = full penetrance). Repeats expand preferentially during male meiosis → paternal transmission shows greater anticipation. Expanded polyQ → protein misfolding → striatal neuron toxicity → chorea, psychiatric symptoms, dementia.'},
      {q:'Genomic imprinting means that gene expression depends on:',ch:['The number of gene copies (dosage effect)','The parent of origin — maternal vs. paternal allele is differentially silenced by epigenetic marks','The developmental stage at which the gene is first expressed','The tissue type in which the gene is expressed'],ans:1,exp:'Imprinting: certain genes are expressed monoallelically based on parent of origin. Classic example: chromosome 15q11-13. Paternal copy silenced → Angelman syndrome from maternal deletion. Maternal copy silenced → Prader-Willi syndrome from paternal deletion. Same chromosomal region, different clinical phenotype based on which parent contributed the deleted chromosome.'},
      {q:'A dominant negative mutation causes disease by:',ch:['Reducing the amount of functional protein by 50% (haploinsufficiency)','The mutant protein actively interfering with the function of the wild-type protein product from the normal allele','Completely preventing any protein from being synthesized','Activating a normally silent tumor suppressor gene'],ans:1,exp:'Dominant negative: mutant protein (from one allele) poisons or competes with wild-type protein (from the other allele), often by forming nonfunctional heterodimers, oligomers, or structural aggregates. Example: Type I OI — one abnormal collagen α-chain disrupts the entire triple helix. Contrast with haploinsufficiency (reduced dosage, no interference from mutant protein).'},
      {q:'Compound heterozygosity (two different pathogenic variants at the same locus) is most relevant in:',ch:['Autosomal dominant diseases with one mutant allele','X-linked dominant diseases in females','Autosomal recessive diseases where each parent contributes a different pathogenic variant','Mitochondrial diseases with heteroplasmy'],ans:2,exp:'Compound heterozygosity: individual carries two different pathogenic variants at the same gene locus (one from each parent). This is the most common genotype in autosomal recessive diseases in outbred populations. Example: most CF patients are compound heterozygotes (e.g., ΔF508 from one parent + another CFTR mutation from the other parent). Genotype-phenotype correlations may differ from homozygotes.'},
      {q:'CpG methylation in gene promoters typically results in:',ch:['Increased transcription factor binding and gene activation','Gene silencing via chromatin condensation and reduced transcription factor access','RNA splicing changes that alter protein isoforms','Enhanced RNA Pol II processivity during elongation'],ans:1,exp:'Methylated CpGs at promoters recruit methyl-CpG binding proteins (MeCP2) → recruit HDACs → deacetylate histones → chromatin compaction → transcriptional repression. Used in: X-chromosome inactivation (Barr body), genomic imprinting, tissue-specific gene silencing, and cancer (hypermethylation of tumor suppressor promoters → epigenetic silencing).'},
      {q:'The CRISPR-Cas9 system uses guide RNA to direct the nuclease because:',ch:['A protein domain (zinc finger-like) in the gRNA recognizes specific DNA sequences','The gRNA base-pairs with the complementary DNA strand at the target site (adjacent to a PAM sequence NGG), directing Cas9 to cleave both strands 3bp upstream of PAM','The gRNA directly activates the Cas9 nuclease without DNA binding','Small-molecule ligands in the gRNA bind the Cas9 catalytic domain'],ans:1,exp:'CRISPR-Cas9: the 20-nt spacer sequence in the gRNA (sgRNA = crRNA:tracrRNA fusion) base-pairs with the target DNA strand. The PAM sequence (5\'-NGG-3\' for SpCas9) on the non-target strand is essential for target recognition and Cas9 activation. Cas9 HNH domain cleaves the target strand; RuvC domain cleaves the non-target strand → blunt-ended DSB.'},
      {q:'Locus heterogeneity (same phenotype from mutations in different genes) is clinically important because:',ch:['All families with the same phenotype will have identical mutations','It means all cases of the disease have the same inheritance pattern','Genetic counseling, carrier testing, and recurrence risk require identification of the specific causative gene, not just the clinical diagnosis','It eliminates the need for molecular genetic testing in affected families'],ans:2,exp:'Locus heterogeneity: same disease phenotype from mutations in different genes. Examples: Retinitis pigmentosa (>80 genes, multiple inheritance patterns); Osteogenesis imperfecta (COL1A1, COL1A2, IFITM5, and others). The inheritance pattern, recurrence risk, prenatal testing options, and prognostic implications differ based on which gene is mutated — you cannot counsel properly from phenotype alone.'},
      {q:'A frameshift mutation caused by a single nucleotide deletion at codon 10 of a 300-codon protein is likely to result in:',ch:['Conservative amino acid change in codon 10 only, with normal protein function','Severe loss of function because all amino acids from codon 10 onward are translated incorrectly, usually creating a premature stop codon','Exon skipping to restore the reading frame','Gain of function due to the novel amino acid sequence'],ans:1,exp:'Frameshift mutations (insertions or deletions not divisible by 3) shift the reading frame at the point of mutation → every codon downstream is misread → fundamentally different (and usually non-functional) amino acid sequence. Most frameshifts encounter a premature stop codon within 1-2 codons → NMD (nonsense-mediated mRNA decay) → loss of function. Indels of 3n nucleotides don\'t frameshift.'},
    ]
  },
  {
    id:'q13', cat:'Immunology', title:'Immunology & Infectious Disease', diff:'Hard',
    qs:[
      {q:'MHC class I molecules present peptides to which T cell subset?',ch:['CD4+ helper T cells (Th1, Th2, Th17, Treg)','CD8+ cytotoxic T lymphocytes (CTLs)','B cells via the B cell receptor','NK cells via NKG2D receptors'],ans:1,exp:'Rule: CD8 sees MHC I; CD4 sees MHC II. MHC I (on all nucleated cells, encoded by HLA-A, B, C) presents endogenous peptides (viral, tumor) → CD8+ CTL recognition → target cell killing via perforin/granzyme or Fas-FasL. MHC II (DCs, macrophages, B cells) presents exogenous peptides → CD4+ Th cell activation.'},
      {q:'The classical complement pathway is activated by:',ch:['Mannose residues on microbial surfaces (lectin pathway)','Spontaneous C3 hydrolysis (alternative pathway, tick-over)','IgG or IgM bound to antigen (immune complexes activating C1q)','Properdin stabilizing the C3bBb convertase'],ans:2,exp:'Classical pathway: C1q binds Fc regions of IgM or IgG (immune complexes) → C1r/C1s activation → C4 and C2 cleavage → C3 convertase (C4b2a) → C3 cleavage → C5 convertase → MAC (C5b-9). Lectin: MBL + MASP1/2 cleaves C4/C2. Alternative: spontaneous C3 → C3b deposited on surfaces, amplified by factor B, D, and properdin.'},
      {q:'DiGeorge syndrome (22q11.2 deletion) primarily causes:',ch:['B cell deficiency from absent bone marrow stem cells','T cell deficiency due to thymic aplasia (absent 3rd/4th pharyngeal pouches)','NK cell deficiency with recurrent herpesvirus infections','Combined B and T cell deficiency (SCID-like)'],ans:1,exp:'22q11 deletion → failure of 3rd/4th pharyngeal pouch development → absent/hypoplastic thymus → insufficient T cell development and maturation. Also: absent parathyroid glands (hypocalcemia), cardiac defects (conotruncal abnormalities), abnormal facies. CATCH-22: Cardiac, Abnormal facies, Thymic aplasia, Cleft palate, Hypocalcemia, 22q11.'},
      {q:'The mechanism of HIV infection includes binding to which host cell receptor(s)?',ch:['CD8 and CXCR4 (cytotoxic T cells only)','CD4 as primary receptor plus CCR5 (M-tropic, early) or CXCR4 (T-tropic, late) as co-receptors','CD20 on B cells as the primary entry receptor','Complement receptor 3 (CR3) on macrophages exclusively'],ans:1,exp:'HIV gp120 binds CD4 (primary receptor) → conformational change → gp120 binds CCR5 (macrophage-tropic early in infection) or CXCR4 (T-tropic late in infection) → gp41-mediated membrane fusion → viral entry. CCR5 Δ32 homozygotes are highly resistant to HIV infection (no CCR5 co-receptor). Targets CD4+ T cells, macrophages, and DCs → progressive immunodeficiency.'},
      {q:'A patient develops urticaria and anaphylaxis within 30 minutes of a penicillin injection. This represents:',ch:['Type II hypersensitivity (cytotoxic, complement-mediated)','Type I hypersensitivity (IgE-mediated, immediate)','Type III hypersensitivity (immune complex deposition)','Type IV hypersensitivity (delayed-type, T-cell mediated)'],ans:1,exp:'Type I (immediate) hypersensitivity: prior sensitization → penicillin hapten conjugated to protein → IgE produced → IgE on mast cells/basophils. Re-exposure → IgE crosslinking → degranulation → histamine, tryptase, leukotrienes → urticaria, bronchoconstriction, angioedema (within minutes). Anaphylaxis treatment: epinephrine IM (α1 vasoconstriction, β1 ↑CO, β2 bronchodilation).'},
      {q:'Innate pattern recognition receptors (like TLR4) recognize pathogen-associated molecular patterns (PAMPs) such as:',ch:['Peptide-MHC complexes on infected cells','Foreign immunoglobulin isotypes on B cell surfaces','Lipopolysaccharide (LPS), flagellin, dsRNA — conserved microbial structures absent from host cells','Specific protein antigens with high-affinity binding (like adaptive TCRs)'],ans:2,exp:'Innate PRRs (TLRs, NLRs, CLRs, RLRs) recognize evolutionarily conserved PAMPs: LPS (TLR4, gram-negative bacteria), flagellin (TLR5), lipoteichoic acid (TLR2), dsRNA (TLR3, viral), ssRNA (TLR7/8), CpG DNA (TLR9). Broad, non-specific, germline-encoded — no memory (contrast with adaptive immunity: specific, clonal, memory-forming).'},
      {q:'Opsonization enhances phagocytosis by coating pathogens with:',ch:['Complement MAC (C5b-9) to lyse the bacteria before phagocytosis','IgG (via Fc-γ receptors) and C3b (via CR1/CR3) to facilitate recognition and uptake by phagocytes','Acute-phase proteins that inhibit complement only','Lactoferrin to sequester iron from bacteria'],ans:1,exp:'Opsonins: IgG (Fc recognized by FcγRI/II/III on neutrophils and macrophages) and C3b/iC3b (recognized by CR1/CR3). Coating of bacteria with opsonins → phagocyte binding → internalization into phagosome → phagolysosome fusion → killing by reactive oxygen species (respiratory burst), defensins, and lysosomal enzymes.'},
      {q:'Glucocorticoids (e.g., prednisone) suppress inflammation primarily by:',ch:['Blocking the IL-2 receptor on T cells only','Multiple mechanisms: inhibiting NF-κB, inducing annexin-1 (inhibits PLA₂ → ↓arachidonic acid → ↓prostaglandins/leukotrienes), reducing cytokine gene transcription, and inducing lymphocyte apoptosis','Directly depleting peripheral lymphocytes via complement activation','Inhibiting MHC II expression on all antigen-presenting cells'],ans:1,exp:'Glucocorticoids (broad anti-inflammatory/immunosuppressive): (1) cross nuclear membrane → GR → inhibit NF-κB (blocks TNF-α, IL-1, IL-6, IL-8 transcription); (2) induce annexin-1 (lipocortin) → inhibit PLA₂ → ↓AA → ↓prostaglandins and leukotrienes; (3) induce T cell apoptosis; (4) reduce neutrophil adhesion to endothelium; (5) impair macrophage phagocytosis and antigen presentation.'},
      {q:'A child has repeated sinopulmonary infections by encapsulated bacteria (Streptococcus pneumoniae, H. influenzae) after 6 months of age with absent B cells. The most likely diagnosis is:',ch:['Severe combined immunodeficiency (SCID) — T and B cell deficiency','X-linked agammaglobulinemia (XLA, Bruton\'s disease) — BTK mutation, absent B cells, no immunoglobulins','DiGeorge syndrome — absent T cells','Selective IgA deficiency — only IgA absent'],ans:1,exp:'XLA (Bruton\'s): BTK mutation → B cell development arrested at pre-B stage → no mature B cells → no immunoglobulins of any class. Protected first 6 months by maternal IgG. Susceptibility to extracellular encapsulated bacteria (requiring opsonizing antibodies for clearance). No lymph nodes or tonsils (no B cell follicles). Treatment: monthly IVIG.'},
      {q:'Which statement about natural killer (NK) cells is correct?',ch:['NK cells require MHC I presentation to become activated (like CD8+ T cells)','NK cells are cytotoxic lymphocytes of the innate immune system that kill cells lacking MHC I ("missing self") without prior sensitization','NK cells are the primary source of IgG antibodies in the innate response','NK cells require 7-14 days to become functional after antigen exposure'],ans:1,exp:'NK cells (innate lymphoid cells): (1) Kill tumor cells and virus-infected cells that downregulate MHC I (an immune evasion strategy — "missing self"). (2) Activating receptors (NKG2D, NKp44) detect stress ligands on abnormal cells. (3) Inhibitory receptors (KIR, NKG2A) recognize self-MHC I → prevents killing of normal cells. (4) No antigen-specific receptor, no prior sensitization needed, no MHC restriction.'},
    ]
  },
  {
    id:'q14', cat:'Psychology/Sociology', title:'Psychology & Behavioral Science', diff:'Medium',
    qs:[
      {q:'The fundamental attribution error refers to:',ch:['Overestimating situational factors and underestimating dispositional factors in explaining our OWN behavior','Underestimating the power of situations and overestimating personality/character when explaining OTHERS\' behavior','Attributing our own successes to ability and failures to bad luck','Assuming others share our beliefs and attitudes (false consensus effect)'],ans:1,exp:'FAE (correspondence bias): when explaining others\' behavior, we tend to attribute it to their character/disposition ("he\'s lazy, aggressive, dishonest") while underweighting the situational forces they face. We apply more situational explanations to our OWN behavior (actor-observer asymmetry). The FAE is reduced when we have more information about the target\'s situation.'},
      {q:'In Milgram\'s obedience experiments, which factor MOST reduced participant compliance?',ch:['The experimenter wearing a white lab coat (increases compliance)','The experiment conducted at Yale (prestigious authority, increases compliance)','The learner being in the same room, visible and touchable by the participant (proximity reduces compliance)','The participant working alone with no peer model (increases compliance)'],ans:2,exp:'Milgram: obedience decreased dramatically with proximity to the victim. Voice feedback condition (could hear cries through wall): 62% full compliance. Touch-proximity (same room, hand on shock plate): 30% compliance. Proximity makes the harm real and harder to deny. Obedience also decreased when the experimenter left the room or other confederates refused.'},
      {q:'Social facilitation (Zajonc) predicts that the presence of others:',ch:['Always improves performance regardless of task difficulty or expertise','Improves well-learned tasks and impairs novel/complex tasks (presence increases arousal, enhancing dominant responses)','Only affects performance when the others are actively competing with the performer','Impairs all performance due to distraction and evaluation apprehension'],ans:1,exp:'Zajonc\'s drive theory: others\' presence → arousal/drive → enhanced emission of dominant (well-learned, habitual) responses. For experts on familiar tasks → facilitation (better performance). For novices on complex tasks → impairment (errors are more likely). Explains why athletes perform better before crowds and students perform worse on difficult exams under observation.'},
      {q:'The hippocampus is most critical for:',ch:['Procedural memory (motor skills, habits) — independent of hippocampus','Implicit (priming) memory','Emotional conditioning via the amygdala exclusively','Encoding new declarative (explicit) long-term memories — both episodic and semantic'],ans:3,exp:'Patient H.M. (bilateral hippocampectomy for epilepsy): profound anterograde amnesia — could not form new long-term declarative memories. But retained: procedural memory (learned mirror drawing, maintained motor skills), priming (implicit memory), emotional responses. Hippocampus: critical for converting working memory → long-term declarative memory (consolidation).'},
      {q:'According to Erikson, the developmental conflict of adolescence (12–18 years) is:',ch:['Industry vs. Inferiority (middle childhood, 6–12 years)','Identity vs. Role Confusion (adolescence: developing coherent sense of self)','Intimacy vs. Isolation (young adulthood, 18–40 years)','Generativity vs. Stagnation (middle adulthood, 40–65 years)'],ans:1,exp:'Erikson\'s 8 stages: adolescence (12-18) = Identity vs. Role Confusion. Core task: developing a stable, coherent sense of self across relationships, vocation, and values. Successful resolution → strong identity. Failure → role confusion, identity diffusion. James Marcia operationalized 4 identity statuses: achievement, foreclosure, moratorium, diffusion.'},
      {q:'The diathesis-stress model of psychopathology proposes that:',ch:['Mental disorders are caused exclusively by biological genetic factors, unmodified by environment','Disorders result from environmental stressors alone, regardless of biological predisposition','Disorders develop when a genetic/biological vulnerability (diathesis) combines with sufficient environmental stressors (gene × environment interaction)','Childhood trauma alone is sufficient to cause any mental disorder without genetic predisposition'],ans:2,exp:'Diathesis-stress: neither predisposition alone nor stress alone is typically sufficient. Mental disorders emerge from gene-environment interaction. Example: a person with COMT Val158Met polymorphism (dopamine metabolism) + childhood adversity is at higher schizophrenia risk than either factor alone. Applies to depression, PTSD, schizophrenia, bipolar disorder.'},
      {q:'Operant conditioning: which scenario illustrates negative reinforcement?',ch:['A child receives a gold star for completing homework (positive reinforcement — adding a reward)','A student loses recess for misbehaving (punishment — removing a pleasant stimulus)','A driver fastens a seatbelt to stop the annoying alarm chiming (negative reinforcement — removing an aversive stimulus increases the behavior)','A dog avoids a certain area after receiving an electric shock there (punishment)'],ans:2,exp:'Negative reinforcement: REMOVING (or avoiding) an AVERSIVE stimulus INCREASES the probability of a behavior. Key: "negative" = removal; "reinforcement" = behavior increases. The seatbelt behavior is reinforced by removing the aversive alarm sound. Confused with punishment: punishment DECREASES behavior (adds aversive or removes pleasant). Both negative reinforcement and punishment involve aversive stimuli, but they have opposite effects on behavior.'},
      {q:'Which of the following correctly describes Piaget\'s concrete operational stage (ages 7–11)?',ch:['Children cannot yet understand that objects exist when out of sight (object permanence absent)','Children master conservation, decentration, and logical operations applied to concrete objects','Children develop hypothetical-deductive reasoning and abstract thought','Children use symbolic thinking but show egocentrism and magical thinking (preoperational)'],ans:1,exp:'Concrete operational (7-11 years): master conservation (understanding that quantity is conserved despite perceptual changes), decentration (consider multiple dimensions simultaneously), classification/seriation, reversibility. Apply logic to CONCRETE objects/situations but not yet abstract hypotheticals (formal operational, 12+ years). Key Piagetian experiments: liquid conservation, clay ball conservation.'},
      {q:'Cognitive dissonance (Festinger) predicts that when behavior contradicts attitudes:',ch:['People immediately change their behavior to match the original attitude (attitude-behavior consistency)','People experience psychological discomfort and tend to change their ATTITUDE to justify the behavior (especially under insufficient external justification)','Attitude change does not occur if the behavior was chosen freely','Behavior change always precedes attitude change in dissonance resolution'],ans:1,exp:'Festinger\'s cognitive dissonance: inconsistency between behavior and attitude → psychological tension → motivation to reduce dissonance. Most commonly through ATTITUDE change (easier than undoing past behavior). Less-leads-to-more effect: minimal external justification (small payment) → greatest attitude change (must justify behavior internally). $1 vs. $20 boring task experiment demonstrated this.'},
      {q:'The biopsychosocial model of health (Engel, 1977) proposes that illness is best understood as:',ch:['Exclusively biological (disease = organic dysfunction, uninfluenced by mind or society)','A linear causal chain: stress → psychological breakdown → biological disease','A complex interaction of biological (genetics, physiology), psychological (cognition, behavior, emotion), and social (SES, culture, relationships) factors','Primarily social in origin with secondary biological manifestations'],ans:2,exp:'Engel\'s biopsychosocial model: replaced the biomedical model (reductionist, only biological mechanisms matter). Health/illness arise from interactions among: biological (genes, neurotransmitters, immune function); psychological (perception, coping, personality, health behaviors); social (SES, social support, cultural norms, healthcare access). Foundation of modern medicine, psychiatry, health psychology, and clinical interviewing.'},
    ]
  },
  {
    id:'q15', cat:'MCAT Mixed', title:'MCAT Full-Length Integration', diff:'Hard',
    qs:[
      {q:'A drug increases cAMP in hepatocytes, causing glycogenolysis. It most likely activates which receptor?',ch:['Ligand-gated ion channel (ionotropic)','Nuclear receptor (steroid hormone-type)','Gs-protein coupled receptor (activating adenylyl cyclase)','Receptor tyrosine kinase (activating PI3K/Akt)'],ans:2,exp:'cAMP is the second messenger of Gs-coupled GPCRs (β-AR, glucagon receptor, TSH receptor, etc.). Gs → adenylyl cyclase → cAMP → PKA → phosphorylase kinase → glycogen phosphorylase → glycogenolysis. Glucagon and epinephrine use this pathway in the liver. RTKs → PI3K/Akt, not cAMP.'},
      {q:'A cross-sectional study finds hypertension prevalence is 40% in adults ≥65 vs. 15% in adults 30-45. The most valid conclusion is:',ch:['Aging directly causes hypertension (causal conclusion)','Hypertension prevalence is significantly associated with older age in this population at this time point','Adults ≥65 should all receive antihypertensives (clinical recommendation from observational data)','Hypertension is primarily genetic in older populations (etiologic conclusion)'],ans:1,exp:'Cross-sectional studies measure prevalence at ONE time point. Valid conclusion: association between age and hypertension prevalence. CANNOT conclude causation (no temporal relationship established, survivorship bias — unhealthy people may have died, confounders). Cross-sectional = hypothesis-generating. Longitudinal cohort studies or RCTs establish causation.'},
      {q:'A patient has pH 7.52, PaCO₂ 30 mmHg, HCO₃⁻ 24 mEq/L. This blood gas shows:',ch:['Metabolic alkalosis with respiratory compensation','Metabolic acidosis with respiratory compensation','Respiratory alkalosis (primary hyperventilation, acute) with no metabolic compensation yet','Respiratory acidosis with metabolic compensation'],ans:2,exp:'Primary problem: ↓PaCO₂ (30 < 40) → respiratory alkalosis → pH ↑ (7.52). HCO₃⁻ = 24 (normal, not compensated) → acute respiratory alkalosis (no time for renal compensation). If chronic, kidneys would decrease HCO₃⁻ to ~18-20 mEq/L. Causes: anxiety (hyperventilation), pulmonary embolism, early sepsis, pregnancy, high altitude, hepatic encephalopathy.'},
      {q:'Methotrexate treats rheumatoid arthritis by:',ch:['Blocking TNF-α binding to its receptor on synoviocytes','Inhibiting dihydrofolate reductase (DHFR), reducing THF and impairing rapidly dividing immune cells (↓dTMP, ↓purines)','Blocking IL-6 receptor signaling (like tocilizumab)','Depleting CD20+ B cells (like rituximab)'],ans:1,exp:'Methotrexate: competitive DHFR inhibitor (structural analog of folic acid). ↓THF → ↓dTMP (thymidylate synthase needs CH₂-THF) → ↓dTTP → ↓DNA synthesis → impaired proliferation of rapidly dividing synovial fibroblasts and lymphocytes. Also produces anti-inflammatory effects via adenosine release. Requires folate supplementation to reduce toxicity (mouth sores, bone marrow suppression).'},
      {q:'The number of DNA copies after 10 PCR cycles starting with 100 template molecules is:',ch:['10,000 copies','100,000 copies','102,400 copies','204,800 copies'],ans:2,exp:'PCR: exponential amplification by doubling each cycle. Copies = initial × 2^n = 100 × 2^10 = 100 × 1024 = 102,400. Note: first ~3 cycles produce variable-length products; specific target amplification (flanked by both primers) dominates by cycle 5-6. Each cycle: denaturation (~95°C) → annealing (55-65°C) → extension (~72°C, Taq polymerase).'},
      {q:'Sickle cell trait (HbAS) provides relative resistance to malaria because:',ch:['HbS RBCs have enhanced immune recognition of Plasmodium antigens','In low O₂ conditions (like infected RBCs), HbS polymerizes, causing infected RBCs to sickle, be phagocytosed, and removed before completing the parasite life cycle','HbS reduces iron availability in RBCs, limiting Plasmodium growth','Sickle trait RBCs have more aquaporins, diluting toxins released by Plasmodium'],ans:1,exp:'Plasmodium falciparum RBCs experience low O₂ in liver sinusoids and spleen. In HbAS cells, deoxygenation → some HbS polymerization → cell sickling → removal by splenic macrophages (phagocytosis) before Plasmodium completes its 48-hour life cycle → reduced parasitemia. This heterozygote advantage maintains the HbS allele at high frequency in malaria-endemic regions (balanced polymorphism).'},
      {q:'In gel electrophoresis, SDS-PAGE separates proteins by size because SDS:',ch:['Precipitates proteins by ionic interactions based on molecular weight','Denatures proteins and coats them uniformly with negative charge proportional to mass → all migrate toward anode (+) based only on size','Cross-links proteins to their native conformation for native PAGE','Acts as a reducing agent to separate subunits by disulfide bonds only'],ans:1,exp:'SDS (sodium dodecyl sulfate): anionic detergent that (1) denatures proteins (disrupts H-bonds, hydrophobic interactions); (2) binds uniformly at ~1.4 g SDS/g protein → all proteins get negative charge proportional to mass. In polyacrylamide gel: all migrate toward anode (+); smaller proteins move faster through gel pores → separation by molecular weight. β-Mercaptoethanol (BME) is added separately to reduce disulfide bonds.'},
      {q:'The Michaelis-Menten equation predicts that at [S] = Km, reaction velocity equals:',ch:['Vmax','¼ Vmax','½ Vmax','¾ Vmax'],ans:2,exp:'Michaelis-Menten: v = Vmax × [S] / (Km + [S]). When [S] = Km: v = Vmax × Km / (Km + Km) = Vmax × Km / (2Km) = Vmax/2. By definition, Km is the substrate concentration at which v = ½ Vmax. This directly defines Km as a measure of substrate concentration needed for half-maximal velocity.'},
      {q:'Hardy-Weinberg: in a population where the allele frequency of the autosomal recessive disease allele (q) = 0.02, the carrier frequency (2pq) is approximately:',ch:['0.02 (2%)','0.04 (4%)','0.0004 (0.04%)','0.2 (20%)'],ans:1,exp:'p = 1 - q = 1 - 0.02 = 0.98. Carrier frequency = 2pq = 2 × 0.98 × 0.02 = 0.0392 ≈ 4% (1/25). Disease frequency = q² = 0.0004 (1/2500). Key insight: for rare recessive alleles, carriers >> affected individuals. Carrier:affected ratio = 2pq/q² = 2p/q ≈ 2/0.02 = 100:1. This is why carrier testing matters for seemingly rare diseases.'},
      {q:'A patient with Wilson\'s disease (autosomal recessive, ATP7B mutation) has copper accumulation. The correct triad of findings is:',ch:['Hemolytic anemia, hepatomegaly, and hyperuricemia (Lesch-Nyhan syndrome)','Liver disease (cirrhosis), neuropsychiatric symptoms, and Kayser-Fleischer rings (copper in Descemet\'s membrane of cornea)','Hemochromatosis features (iron, not copper accumulation)','Cardiomyopathy, diabetes, and bronze skin (hemochromatosis)'],ans:1,exp:'Wilson\'s disease (ATP7B = copper-transporting ATPase): copper cannot be incorporated into ceruloplasmin for secretion or excreted in bile → copper accumulates in liver (hepatitis → cirrhosis), brain (basal ganglia → psychiatric/movement disorders), cornea (Kayser-Fleischer rings — green-brown rings), kidneys. Low serum ceruloplasmin, elevated 24-hr urine copper. Treatment: d-penicillamine or trientine (chelation), zinc (blocks intestinal absorption).'},
    ]
  },
]

// ── SYSTEM PROMPT ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are MEDSCHOOL PREP — the ultimate AI medical school preparation coach. You are warm, brilliant, and adapt to every student like a knowledgeable mentor friend.

MISSION: Help with EVERYTHING related to med school prep — MCAT (B/B, C/P, P/S, CARS), premed sciences, AMCAS essays, interviews (MMI/traditional), research tips, school list building, burnout support, and anything else they need.

RULES:
• Be warm, encouraging, never condescending
• End every response with a natural follow-up question to keep the conversation going
• For wrong answers: kind "here's why" + clear explanation
• For overwhelmed users: validate feelings first, then give ONE quick win
• Use light emojis naturally (not excessively)
• Adapt difficulty and tone to the student's level
• Proactively offer to make flashcards, quizzes, or study plans

The user profile (if provided) will be in the system message. Reference their name, goals, and weak areas naturally.`

// ── AUTH MODAL ──────────────────────────────────────────────────────────
function AuthModal({ onSuccess, onClose }) {
  const [view, setView] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [code, setCode] = useState('')
  const [newPw, setNewPw] = useState('')
  const [msg, setMsg] = useState({ text: '', ok: true })
  const [busy, setBusy] = useState(false)

  const e = (t) => setMsg({ text: t, ok: false })
  const o = (t) => setMsg({ text: t, ok: true })

  async function signup() {
    if (!name.trim()) return e('Please enter your name.')
    if (!email.includes('@')) return e('Enter a valid email address.')
    if (pw.length < 6) return e('Password must be at least 6 characters.')
    if (pw !== pw2) return e("Passwords don't match.")
    setBusy(true)
    const users = ls.get('msp_users') || {}
    const key = email.toLowerCase()
    if (users[key]) { setBusy(false); return e('An account with this email already exists.') }
    users[key] = { name: name.trim(), hash: hashPw(pw), created: Date.now() }
    ls.set('msp_users', users)
    const sess = { email: key, name: name.trim(), at: Date.now() }
    ls.set('msp_session', sess)
    o('Account created! Welcome 🎉')
    setTimeout(() => onSuccess(sess), 700)
    setBusy(false)
  }

  async function login() {
    if (!email.includes('@')) return e('Enter a valid email.')
    if (!pw) return e('Enter your password.')
    setBusy(true)
    const users = ls.get('msp_users') || {}
    const user = users[email.toLowerCase()]
    if (!user || user.hash !== hashPw(pw)) { setBusy(false); return e('Incorrect email or password.') }
    const sess = { email: email.toLowerCase(), name: user.name, at: Date.now() }
    ls.set('msp_session', sess)
    o(`Welcome back, ${user.name}! 👋`)
    setTimeout(() => onSuccess(sess), 500)
    setBusy(false)
  }

  async function sendReset() {
    if (!email.includes('@')) return e('Enter a valid email.')
    const users = ls.get('msp_users') || {}
    if (!users[email.toLowerCase()]) return e('No account found with this email.')
    const c = Math.floor(100000 + Math.random() * 900000).toString()
    ls.set('msp_reset_' + email.toLowerCase(), { code: c, exp: Date.now() + 15 * 60 * 1000 })
    o(`Reset code (demo — copy this): ${c}`)
    setView('verify')
  }

  async function verify() {
    const stored = ls.get('msp_reset_' + email.toLowerCase())
    if (!stored || stored.code !== code.trim()) return e('Invalid code.')
    if (Date.now() > stored.exp) return e('Code expired. Request a new one.')
    if (newPw.length < 6) return e('New password must be at least 6 characters.')
    const users = ls.get('msp_users') || {}
    users[email.toLowerCase()].hash = hashPw(newPw)
    ls.set('msp_users', users)
    ls.del('msp_reset_' + email.toLowerCase())
    o('Password updated! You can now sign in.')
    setTimeout(() => setView('login'), 1000)
  }

  const inp = { width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #CBD5E0', background: '#F7FAFC', color: '#1A202C', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
  const btn = (c = '#1D4ED8') => ({ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: c, color: '#fff', fontSize: 14, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4, opacity: busy ? 0.7 : 1 })
  const lnk = { background: 'none', border: 'none', color: '#1D4ED8', cursor: 'pointer', fontSize: 13, textDecoration: 'underline', fontFamily: 'inherit' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🩺</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1A202C', marginBottom: 3 }}>
            {view === 'login' ? 'Sign In' : view === 'signup' ? 'Create Account' : view === 'forgot' ? 'Reset Password' : 'Enter Reset Code'}
          </div>
          <div style={{ fontSize: 13, color: '#718096' }}>MedSchool Prep</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {view === 'signup' && <input style={inp} placeholder="Full name" value={name} onChange={ev => setName(ev.target.value)} />}
          {(view !== 'verify') && <input style={inp} type="email" placeholder="Email address" value={email} onChange={ev => setEmail(ev.target.value)} />}
          {(view === 'login' || view === 'signup') && <input style={inp} type="password" placeholder="Password" value={pw} onChange={ev => setPw(ev.target.value)} />}
          {view === 'signup' && <input style={inp} type="password" placeholder="Confirm password" value={pw2} onChange={ev => setPw2(ev.target.value)} />}
          {view === 'verify' && (<>
            <input style={inp} placeholder="6-digit reset code" value={code} onChange={ev => setCode(ev.target.value)} maxLength={6} />
            <input style={inp} type="password" placeholder="New password" value={newPw} onChange={ev => setNewPw(ev.target.value)} />
          </>)}
          {msg.text && <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, background: msg.ok ? '#F0FFF4' : '#FFF5F5', color: msg.ok ? '#276749' : '#C53030', fontWeight: 500 }}>{msg.text}</div>}
          <button style={btn()} disabled={busy} onClick={view === 'login' ? login : view === 'signup' ? signup : view === 'forgot' ? sendReset : verify}>
            {busy ? 'Please wait…' : view === 'login' ? 'Sign In' : view === 'signup' ? 'Create Account' : view === 'forgot' ? 'Send Reset Code' : 'Reset Password'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
            {view === 'login' && <><button style={lnk} onClick={() => { setView('signup'); setMsg({ text: '', ok: true }) }}>Create account</button><button style={lnk} onClick={() => { setView('forgot'); setMsg({ text: '', ok: true }) }}>Forgot password?</button></>}
            {view === 'signup' && <button style={lnk} onClick={() => { setView('login'); setMsg({ text: '', ok: true }) }}>Already have an account?</button>}
            {(view === 'forgot' || view === 'verify') && <button style={lnk} onClick={() => { setView('login'); setMsg({ text: '', ok: true }) }}>Back to sign in</button>}
          </div>
          {onClose && <button style={{ ...lnk, display: 'block', textAlign: 'center', marginTop: 4 }} onClick={onClose}>Continue as guest</button>}
        </div>
      </div>
    </div>
  )
}

// ── QUIZ ENGINE ─────────────────────────────────────────────────────────
function QuizEngine({ quiz, onFinish }) {
  const [qi, setQi] = useState(0)
  const [sel, setSel] = useState(null)
  const [confirmed, setConf] = useState(false)
  const [score, setScore] = useState(0)
  const [results, setResults] = useState([])
  const [timeLeft, setTime] = useState(quiz.time || 480)
  const [done, setDone] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTime(t => { if (t <= 1) { clearInterval(timerRef.current); setDone(true); return 0 } return t - 1 })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  function confirm() {
    if (sel === null) return
    setConf(true)
    const correct = sel === quiz.qs[qi].ans
    if (correct) setScore(s => s + 1)
    setResults(r => [...r, { qi, sel, correct }])
  }

  function next() {
    if (qi + 1 >= quiz.qs.length) { clearInterval(timerRef.current); setDone(true) }
    else { setQi(q => q + 1); setSel(null); setConf(false) }
  }

  const q = quiz.qs[qi]
  const LETTERS = ['A', 'B', 'C', 'D']
  const mm = Math.floor(timeLeft / 60)
  const ss = timeLeft % 60
  const pct = Math.round((score / quiz.qs.length) * 100)
  const timeColor = timeLeft < 60 ? '#E53E3E' : timeLeft < 120 ? '#DD6B20' : '#718096'

  if (done) {
    const fp = Math.round((score / quiz.qs.length) * 100)
    const grade = fp >= 80 ? ['🏆', 'Excellent work!', '#276749', '#F0FFF4'] : fp >= 60 ? ['✅', 'Good effort!', '#744210', '#FFFFF0'] : ['📚', 'Keep studying!', '#822727', '#FFF5F5']
    return (
      <div style={{ padding: 20, maxWidth: 620, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>{grade[0]}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1A202C', marginBottom: 4 }}>{grade[1]}</div>
          <div style={{ fontSize: 14, color: '#718096', marginBottom: 18 }}>{quiz.title}</div>
          <div style={{ display: 'inline-block', padding: '14px 32px', borderRadius: 16, background: grade[3] }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: grade[2] }}>{fp}%</div>
            <div style={{ fontSize: 13, color: '#718096' }}>{score} / {quiz.qs.length} correct</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {quiz.qs.map((question, i) => {
            const res = results.find(r => r.qi === i)
            const ok = res?.correct
            return (
              <div key={i} style={{ padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${ok ? '#48BB78' : '#FC8181'}`, background: ok ? '#F0FFF4' : '#FFF5F5' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: ok ? '#276749' : '#9B2C2C', marginBottom: 3 }}>Q{i + 1} {ok ? '✓ Correct' : `✗ Incorrect — Correct: ${LETTERS[question.ans]}`}</div>
                <div style={{ fontSize: 13, color: '#1A202C', marginBottom: 5 }}>{question.q}</div>
                <div style={{ fontSize: 12, color: '#4A5568', lineHeight: 1.5 }}><strong>Explanation:</strong> {question.exp}</div>
              </div>
            )
          })}
        </div>
        <button onClick={() => onFinish(score, quiz.qs.length)} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#1D9E75,#1D4ED8)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Back to Quiz Library
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: '#718096', fontWeight: 500 }}>Question {qi + 1} / {quiz.qs.length}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: timeColor }}>⏱ {mm}:{ss.toString().padStart(2, '0')}</div>
      </div>
      <div style={{ height: 5, background: '#E2E8F0', borderRadius: 4, marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#1D9E75,#1D4ED8)', width: `${(qi / quiz.qs.length) * 100}%`, transition: 'width 0.4s' }} />
      </div>
      <div style={{ padding: '18px 18px', borderRadius: 14, background: '#fff', border: '1px solid #E2E8F0', marginBottom: 14, fontSize: 15, lineHeight: 1.7, color: '#1A202C', fontWeight: 500 }}>{q.q}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>
        {q.ch.map((choice, i) => {
          let bg = '#fff', border = '1px solid #E2E8F0', color = '#1A202C'
          if (!confirmed && sel === i) { bg = '#EBF8FF'; border = '2px solid #3182CE'; color = '#1A365D' }
          if (confirmed) {
            if (i === q.ans) { bg = '#F0FFF4'; border = '2px solid #48BB78'; color = '#276749' }
            else if (i === sel) { bg = '#FFF5F5'; border = '2px solid #FC8181'; color = '#9B2C2C' }
          }
          return (
            <button key={i} disabled={confirmed} onClick={() => setSel(i)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', borderRadius: 11, border, background: bg, color, cursor: confirmed ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, transition: 'all 0.15s' }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0, background: confirmed && i === q.ans ? '#48BB78' : confirmed && i === sel ? '#FC8181' : sel === i ? '#3182CE' : '#EDF2F7', color: (confirmed && (i === q.ans || i === sel)) || sel === i ? '#fff' : '#718096' }}>{LETTERS[i]}</span>
              {choice}
            </button>
          )
        })}
      </div>
      {confirmed && (
        <div style={{ padding: '12px 14px', borderRadius: 11, background: sel === q.ans ? '#F0FFF4' : '#FFF5F5', border: `1.5px solid ${sel === q.ans ? '#48BB78' : '#FC8181'}`, marginBottom: 14, fontSize: 13, lineHeight: 1.6, color: sel === q.ans ? '#276749' : '#822727' }}>
          <strong>{sel === q.ans ? '✓ Correct! ' : '✗ Incorrect. '}</strong>{q.exp}
        </div>
      )}
      {!confirmed
        ? <button onClick={confirm} disabled={sel === null} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: sel === null ? '#E2E8F0' : 'linear-gradient(135deg,#1D9E75,#1D4ED8)', color: sel === null ? '#A0AEC0' : '#fff', fontSize: 14, fontWeight: 600, cursor: sel === null ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Confirm Answer</button>
        : <button onClick={next} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#1D9E75,#1D4ED8)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{qi + 1 >= quiz.qs.length ? 'View Results →' : 'Next Question →'}</button>
      }
    </div>
  )
}

// ── QUIZ BROWSER ────────────────────────────────────────────────────────
function QuizBrowser({ session, progress, onStart }) {
  const [cat, setCat] = useState('All')
  const [diff, setDiff] = useState('All')
  const cats = ['All', ...Array.from(new Set(QUIZZES.map(q => q.cat)))]
  const diffs = ['All', 'Easy', 'Medium', 'Hard']
  const filtered = QUIZZES.filter(q => (cat === 'All' || q.cat === cat) && (diff === 'All' || q.diff === diff))

  const chip = (active, onClick, label, color = '#1D4ED8') => (
    <button onClick={onClick} style={{ padding: '5px 12px', borderRadius: 20, border: 'none', background: active ? color : '#EDF2F7', color: active ? '#fff' : '#4A5568', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
  )

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1A202C', marginBottom: 3 }}>Quiz Library</div>
        <div style={{ fontSize: 13, color: '#718096' }}>{QUIZZES.length} exams · {QUIZZES.reduce((s, q) => s + q.qs.length, 0)} total questions</div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {cats.map(c => chip(cat === c, () => setCat(c), c, '#1D4ED8'))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {diffs.map(d => chip(diff === d, () => setDiff(d), d, d === 'Hard' ? '#E53E3E' : d === 'Medium' ? '#DD6B20' : d === 'Easy' ? '#276749' : '#1D4ED8'))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {filtered.map(quiz => {
          const prog = progress[quiz.id]
          const dc = quiz.diff === 'Hard' ? '#FFF5F5' : quiz.diff === 'Medium' ? '#FFFFF0' : '#F0FFF4'
          const dtc = quiz.diff === 'Hard' ? '#9B2C2C' : quiz.diff === 'Medium' ? '#744210' : '#276749'
          return (
            <div key={quiz.id} style={{ padding: '12px 14px', borderRadius: 12, background: '#fff', border: `1px solid ${prog ? '#48BB78' : '#E2E8F0'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1A202C', marginBottom: 3 }}>{quiz.title}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: dc, color: dtc }}>{quiz.diff}</span>
                  <span style={{ fontSize: 11, color: '#718096' }}>{quiz.cat} · {quiz.qs.length} Qs · {Math.floor((quiz.time || 480) / 60)} min</span>
                  {prog && <span style={{ fontSize: 11, color: '#276749', fontWeight: 700 }}>✓ {prog.score}%</span>}
                </div>
              </div>
              <button onClick={() => onStart(quiz)} style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#1D9E75,#1D4ED8)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                {prog ? 'Retake' : 'Start'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── MAIN APP ────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSess] = useState(null)
  const [messages, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoad] = useState(false)
  const [tab, setTab] = useState('chat')
  const [activeQuiz, setAQ] = useState(null)
  const [showAuth, setAuth] = useState(false)
  const [progress, setProg] = useState({})
  const [sidebar, setSide] = useState(true)
  const [ready, setReady] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const s = ls.get('msp_session')
    if (s) {
      setSess(s)
      const h = ls.get('msp_history_' + s.email)
      if (h) setMsgs(h)
      const p = ls.get('msp_progress_' + s.email)
      if (p) setProg(p)
    }
    setReady(true)
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  function authSuccess(s) {
    setSess(s)
    setAuth(false)
    const h = ls.get('msp_history_' + s.email)
    if (h) setMsgs(h)
    const p = ls.get('msp_progress_' + s.email)
    if (p) setProg(p)
  }

  function logout() {
    ls.del('msp_session')
    setSess(null)
    setMsgs([])
    setProg({})
  }

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || loading) return
    setInput('')
    const userMsg = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMsgs(next)
    setLoad(true)
    const profileCtx = session ? `\n\n[STUDENT: ${session.name}, Email: ${session.email}]` : '\n\n[STUDENT: Guest user]'
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          max_tokens: 900,
          messages: [{ role: 'system', content: SYSTEM_PROMPT + profileCtx }, ...next.map(m => ({ role: m.role, content: m.content }))],
        }),
      })
      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content || "Oops, something went wrong! Please try again. 😊"
      const final = [...next, { role: 'assistant', content: reply }]
      setMsgs(final)
      if (session) ls.set('msp_history_' + session.email, final.slice(-40))
    } catch {
      setMsgs([...next, { role: 'assistant', content: "Connection hiccup! Please try again. 🤗" }])
    }
    setLoad(false)
    inputRef.current?.focus()
  }, [messages, loading, session])

  function quizFinish(score, total) {
    if (activeQuiz && session) {
      const pct = Math.round((score / total) * 100)
      const updated = { ...progress, [activeQuiz.id]: { score: pct, at: Date.now() } }
      setProg(updated)
      ls.set('msp_progress_' + session.email, updated)
    }
    setAQ(null)
  }

  const quickPrompts = ['Quiz me on glycolysis 🧪', 'MCAT CARS strategy 📖', 'Make a study plan ⏱️', 'Explain the complement cascade 🔬', 'Mock MMI question 🎤', "I'm feeling burnt out 😔"]
  const completedCount = Object.keys(progress).length
  const avgScore = completedCount > 0 ? Math.round(Object.values(progress).reduce((s, p) => s + p.score, 0) / completedCount) : null

  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #EBF8FF', borderTopColor: '#3182CE', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ color: '#718096', fontSize: 14 }}>Loading…</p>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: 'min(700px,90vh)', background: '#F7FAFC', borderRadius: 16, overflow: 'hidden', border: '1px solid #E2E8F0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`
        .msp-ta{background:#fff;border:1px solid #E2E8F0;border-radius:11px;padding:9px 13px;font-size:14px;resize:none;width:100%;outline:none;font-family:inherit;color:#1A202C;line-height:1.5;box-sizing:border-box;}
        .msp-ta:focus{border-color:#3182CE;}
        .msp-btn{background:linear-gradient(135deg,#1D9E75,#1D4ED8);color:#fff;border:none;border-radius:9px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit;}
        .msp-btn:disabled{opacity:0.5;cursor:not-allowed;}
        .msp-chip{background:#EDF2F7;border:none;border-radius:18px;padding:5px 11px;font-size:11px;cursor:pointer;color:#4A5568;font-family:inherit;}
        .msp-chip:hover{background:#E2E8F0;}
        .msp-tab{background:none;border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:500;padding:7px 13px;border-radius:7px;color:#718096;}
        .msp-tab.on{background:#EDF2F7;color:#1A202C;}
        .msp-ib{background:none;border:none;cursor:pointer;color:#718096;font-size:12px;padding:4px 8px;border-radius:6px;font-family:inherit;text-align:left;}
        .msp-ib:hover{background:#EDF2F7;color:#1A202C;}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#CBD5E0;border-radius:2px}
      `}</style>
      {showAuth && <AuthModal onSuccess={authSuccess} onClose={() => setAuth(false)} />}

      {/* Sidebar */}
      {sidebar && (
        <div style={{ width: 210, flexShrink: 0, borderRight: '1px solid #E2E8F0', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '13px 13px 10px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#1D9E75,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 700 }}>M</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A202C' }}>MedSchool Prep</div>
                <div style={{ fontSize: 10, color: '#718096' }}>gpt-4o-mini</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 12px' }}>
            {session ? (<>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Student</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A202C' }}>{session.name}</div>
                <div style={{ fontSize: 11, color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.email}</div>
              </div>
              <div style={{ padding: '10px 11px', borderRadius: 10, background: '#F7FAFC', marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Quiz Progress</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 800, color: '#1D4ED8' }}>{completedCount}</div><div style={{ fontSize: 10, color: '#718096' }}>Done</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 800, color: '#1D9E75' }}>{avgScore ?? '—'}{avgScore ? '%' : ''}</div><div style={{ fontSize: 10, color: '#718096' }}>Avg</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 800, color: '#805AD5' }}>{QUIZZES.length}</div><div style={{ fontSize: 10, color: '#718096' }}>Total</div></div>
                </div>
                <div style={{ height: 4, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg,#1D9E75,#1D4ED8)', width: `${(completedCount / QUIZZES.length) * 100}%`, borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
              </div>
            </>) : (
              <div style={{ textAlign: 'center', paddingTop: 16 }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>👋</div>
                <div style={{ fontSize: 13, color: '#718096', lineHeight: 1.5, marginBottom: 14 }}>Sign in to track your progress and personalize your experience.</div>
                <button onClick={() => setAuth(true)} style={{ width: '100%', padding: '8px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#1D9E75,#1D4ED8)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Sign In / Sign Up</button>
              </div>
            )}
          </div>
          <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #E2E8F0' }}>
            {session ? (<>
              <button className="msp-ib" style={{ width: '100%', marginBottom: 2 }} onClick={() => setMsgs([])}>🗑 Clear chat</button>
              <button className="msp-ib" style={{ width: '100%' }} onClick={logout}>⎋ Log out</button>
            </>) : (
              <button className="msp-ib" style={{ width: '100%' }} onClick={() => setAuth(true)}>🔐 Sign In</button>
            )}
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '8px 13px', borderBottom: '1px solid #E2E8F0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="msp-ib" onClick={() => setSide(o => !o)} style={{ padding: '4px 6px', fontSize: 16 }}>☰</button>
            <button className={`msp-tab${tab === 'chat' ? ' on' : ''}`} onClick={() => setTab('chat')}>💬 Coach</button>
            <button className={`msp-tab${tab === 'quiz' ? ' on' : ''}`} onClick={() => { setTab('quiz'); setAQ(null) }}>📚 Quizzes</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!session && <button onClick={() => setAuth(true)} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1D9E75,#1D4ED8)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Sign Up Free</button>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#1D9E75' }} />
              <span style={{ fontSize: 12, color: '#718096' }}>AI online</span>
            </div>
          </div>
        </div>

        {/* Content */}
        {tab === 'quiz' ? (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {activeQuiz
              ? <QuizEngine quiz={activeQuiz} onFinish={quizFinish} />
              : <QuizBrowser session={session} progress={progress} onStart={q => setAQ(q)} />}
          </div>
        ) : (<>
          <div style={{ flex: 1, overflow: 'auto', padding: '14px 14px 6px' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 28, paddingBottom: 16 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🩺</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#1A202C', marginBottom: 6 }}>
                  {session ? `Welcome back, ${session.name}!` : 'Welcome to MedSchool Prep'}
                </div>
                <div style={{ fontSize: 13, color: '#718096', marginBottom: 22, maxWidth: 340, margin: '0 auto 22px' }}>
                  {session ? 'Ask anything — concepts, quizzes, essays, mock interviews.' : 'Your all-in-one AI med school coach. Sign in to save progress, or just say hi!'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {quickPrompts.map(q => <button key={q} className="msp-chip" onClick={() => sendMessage(q)}>{q}</button>)}
                </div>
              </div>
            )}
            {messages.map((m, i) => {
              const isUser = m.role === 'user'
              const html = m.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br/>')
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                  {!isUser && <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#1D9E75,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700, marginRight: 7, marginTop: 2 }}>M</div>}
                  <div style={{ maxWidth: '80%', background: isUser ? '#1D4ED8' : '#fff', color: isUser ? '#fff' : '#1A202C', border: isUser ? 'none' : '1px solid #E2E8F0', borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px', padding: '9px 13px', fontSize: 14, lineHeight: 1.65 }}>
                    <span dangerouslySetInnerHTML={{ __html: html }} />
                  </div>
                </div>
              )
            })}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#1D9E75,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700, marginRight: 7, marginTop: 2 }}>M</div>
                <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '4px 16px 16px 16px', padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#A0AEC0', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                  <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}`}</style>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {messages.length > 0 && (
            <div style={{ padding: '4px 14px', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
              {quickPrompts.slice(0, 4).map(q => <button key={q} className="msp-chip" onClick={() => sendMessage(q)} style={{ fontSize: 11 }}>{q}</button>)}
            </div>
          )}
          <div style={{ padding: '8px 14px 13px', borderTop: '1px solid #E2E8F0', background: '#fff', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end' }}>
              <textarea ref={inputRef} className="msp-ta" rows={1}
                placeholder={session ? 'Ask anything — concepts, quizzes, essays, interviews…' : 'Say hi to get started! (Sign in to save progress)'}
                value={input}
                onChange={ev => setInput(ev.target.value)}
                onKeyDown={ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); sendMessage(input) } }}
                onInput={ev => { ev.target.style.height = 'auto'; ev.target.style.height = Math.min(ev.target.scrollHeight, 100) + 'px' }}
                style={{ flex: 1 }}
              />
              <button className="msp-btn" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
                {loading ? '…' : 'Send ↗'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#A0AEC0', marginTop: 4, textAlign: 'center' }}>
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </>)}
      </div>
    </div>
  )
}
