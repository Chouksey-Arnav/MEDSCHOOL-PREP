import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import katex from 'katex';

const LANDING_URL = 'https://medschoolprep-landing.vercel.app';

/* ═══════════════════════════════════════════════════════════════
   KATEX
═══════════════════════════════════════════════════════════════ */
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
MixedText.displayName = 'MixedText';

/* ═══════════════════════════════════════════════════════════════
   LOCALSTORAGE HELPER
═══════════════════════════════════════════════════════════════ */
const storage = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/* ═══════════════════════════════════════════════════════════════
   MASTERY SYSTEM — 5 LEVELS  (authentic Khan Academy mechanics)

   Not Started (0) ○  → No practice attempted
   Attempted   (1) ◔  → Scored <70% on first try
   Familiar    (2) ◐  → Scored 70-99%, or correct on quiz from Attempted
   Proficient  (3) ●  → Scored 100% from Familiar state
   Mastered    (4) ★  → 100% on Unit Test / Course Challenge / Mastery Challenge from Proficient

   Special promotion:
     100% on FIRST attempt from Not Started or Attempted → jump 2 levels to Proficient

   Demotion rules (authentic KA September 2018):
     Mastered  + 70–99% on practice  → Proficient
     Mastered  + <70%   on practice  → Familiar
     Proficient + any wrong on practice → Familiar
     (No demotion below Familiar via regular practice)

   Mastery Points per skill (100 total):
     Not Started = 0 pts  |  Attempted = 10 pts  |  Familiar = 50 pts
     Proficient  = 80 pts |  Mastered  = 100 pts
═══════════════════════════════════════════════════════════════ */
const MASTERY = {
  0: { label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.28)', dot: '○', points: 0  },
  1: { label: 'Attempted',   color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.32)',  dot: '◔', points: 10 },
  2: { label: 'Familiar',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.32)',  dot: '◐', points: 50 },
  3: { label: 'Proficient',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.32)',  dot: '●', points: 80 },
  4: { label: 'Mastered',    color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.32)',  dot: '★', points: 100},
};

/**
 * Compute new mastery level after answering a set of questions.
 * @param {number} cur      Current level 0-4
 * @param {number} score    Correct count
 * @param {number} total    Total questions
 * @param {boolean} isTest  true = Unit Test / Course Challenge / Mastery Challenge (can reach Mastered)
 * @returns {number}        New level 0-4
 */
function computeNewLevel(cur, score, total, isTest = false) {
  const pct = total === 0 ? 0 : (score / total) * 100;

  if (cur === 4) { // Mastered — can be demoted
    if (pct < 70)  return 2; // two-level demotion to Familiar
    if (pct < 100) return 3; // one-level demotion to Proficient
    return 4;
  }
  if (cur === 3) { // Proficient
    if (isTest && pct === 100) return 4; // Unit Test perfect → Mastered
    if (!isTest && pct < 100)  return 2; // any mistake in practice → demoted to Familiar
    return 3;
  }
  if (cur === 2) { // Familiar — no demotion via practice
    if (pct === 100) return 3; // advance to Proficient
    return 2;
  }
  if (cur === 1) { // Attempted
    if (pct === 100) return 3; // perfect → jump 2 levels to Proficient
    if (pct >= 70)   return 2; // advance to Familiar
    return 1;
  }
  // Not Started (0)
  if (pct === 100) return 3; // perfect first attempt → skip 2 levels
  if (pct >= 70)   return 2; // Familiar
  return 1;                  // Attempted
}

/* ═══════════════════════════════════════════════════════════════
   MASTERY CHALLENGE — Spaced Repetition Engine
   KA rules: 6 questions reviewing 3 skills (2 per skill)
     Both correct → level up one step
     Both wrong   → level down one step
     Split (1-1)  → unchanged
   Unlocked when: 3+ skills at Familiar AND 1+ at Proficient, once per day
   Skill selection: prioritises stale (not recently practiced) skills
═══════════════════════════════════════════════════════════════ */
function selectMCSkills(pathway, path, limit = 3) {
  if (!path) return [];
  const now = Date.now();
  const candidates = [];
  path.units.forEach(unit => {
    if (!pathway[unit.id]?.unlocked) return;
    unit.lessons.forEach(lesson => {
      const ls = getLessonStateRaw(pathway, unit.id, lesson.id);
      const level = ls.masteryLevel || 0;
      if (level < 2) return; // must be Familiar+
      const daysSince = ls.lastPracticed ? (now - ls.lastPracticed) / 86400000 : 999;
      // Staleness score: stale Familiar lessons first, then Proficient, then Mastered
      const levelWeight = level === 2 ? 3 : level === 3 ? 2 : 1;
      candidates.push({ unit, lesson, level, priority: daysSince * levelWeight });
    });
  });
  return candidates.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

function isMCAvailable(pathway, path, user) {
  if (!path) return false;
  const today = new Date().toDateString();
  if (user.lastMCDate === today) return false;
  let familiar = 0, proficient = 0;
  path.units.forEach(unit => {
    if (!pathway[unit.id]?.unlocked) return;
    unit.lessons.forEach(lesson => {
      const lvl = getLessonStateRaw(pathway, unit.id, lesson.id).masteryLevel || 0;
      if (lvl === 2) familiar++;
      if (lvl >= 3)  proficient++;
    });
  });
  return familiar >= 3 && proficient >= 1;
}

/* ═══════════════════════════════════════════════════════════════
   BADGE SYSTEM — 5 Tiers, 28 Badges
═══════════════════════════════════════════════════════════════ */
const BADGE_TIERS = {
  bronze:   { color: '#cd7f32', glow: 'rgba(205,127,50,0.35)',  shadow: '0 0 16px rgba(205,127,50,0.5)',  label: 'Bronze'   },
  silver:   { color: '#c0c0c0', glow: 'rgba(192,192,192,0.35)', shadow: '0 0 16px rgba(192,192,192,0.5)', label: 'Silver'   },
  gold:     { color: '#ffd700', glow: 'rgba(255,215,0,0.35)',   shadow: '0 0 16px rgba(255,215,0,0.5)',   label: 'Gold'     },
  platinum: { color: '#b8d4ff', glow: 'rgba(184,212,255,0.4)',  shadow: '0 0 20px rgba(184,212,255,0.6)', label: 'Platinum' },
  diamond:  { color: '#a8ffef', glow: 'rgba(168,255,239,0.45)', shadow: '0 0 24px rgba(168,255,239,0.7)', label: 'Diamond'  },
};

const BADGES = [
  // ── XP MILESTONES ──
  { id:'xp_500',    name:'First Steps',       desc:'Earn 500 XP',              icon:'🌱', tier:'bronze',   group:'XP',        check:(u)=>u.xp>=500 },
  { id:'xp_2000',   name:'MCAT Climber',      desc:'Earn 2,000 XP',            icon:'📈', tier:'silver',   group:'XP',        check:(u)=>u.xp>=2000 },
  { id:'xp_5000',   name:'Scholar',           desc:'Earn 5,000 XP',            icon:'🎓', tier:'gold',     group:'XP',        check:(u)=>u.xp>=5000 },
  { id:'xp_10000',  name:'Academic Elite',    desc:'Earn 10,000 XP',           icon:'⭐', tier:'platinum', group:'XP',        check:(u)=>u.xp>=10000 },
  { id:'xp_25000',  name:'MetaBrain',         desc:'Earn 25,000 XP',           icon:'🧠', tier:'diamond',  group:'XP',        check:(u)=>u.xp>=25000 },
  // ── MASTERY MILESTONES ──
  { id:'master_1',  name:'First Master',      desc:'Master 1 lesson',          icon:'🌟', tier:'bronze',   group:'Mastery',   check:(u,p,path)=>_cntLevel(p,path,4)>=1 },
  { id:'master_5',  name:'Skill Builder',     desc:'Master 5 lessons',         icon:'🏗️', tier:'silver',   group:'Mastery',   check:(u,p,path)=>_cntLevel(p,path,4)>=5 },
  { id:'master_10', name:'Knowledge Architect',desc:'Master 10 lessons',       icon:'🏛️', tier:'gold',     group:'Mastery',   check:(u,p,path)=>_cntLevel(p,path,4)>=10 },
  { id:'master_all',name:'Grand Master',      desc:'Master all 15 lessons',    icon:'👑', tier:'diamond',  group:'Mastery',   check:(u,p,path)=>path&&_cntLevel(p,path,4)>=15 },
  // ── PROFICIENCY ──
  { id:'prof_5',    name:'Deep Diver',        desc:'Reach Proficient on 5 lessons',   icon:'🤿', tier:'silver', group:'Mastery', check:(u,p,path)=>_cntLevel(p,path,3)>=5 },
  { id:'prof_10',   name:'Course Expert',     desc:'Reach Proficient on 10 lessons',  icon:'📚', tier:'gold',   group:'Mastery', check:(u,p,path)=>_cntLevel(p,path,3)>=10 },
  // ── UNITS ──
  { id:'unit_1',    name:'Unit Champion',     desc:'Pass your first unit mastery check',   icon:'🎯', tier:'bronze',   group:'Units', check:(u,p,path)=>_cntUnits(p,path)>=1 },
  { id:'unit_3',    name:'Multi-Unit Pro',    desc:'Pass 3 unit mastery checks',           icon:'🏆', tier:'gold',     group:'Units', check:(u,p,path)=>_cntUnits(p,path)>=3 },
  { id:'unit_all',  name:'Pathway Complete',  desc:'Complete all 5 units in your path',    icon:'🌠', tier:'platinum', group:'Units', check:(u,p,path)=>path&&_cntUnits(p,path)>=5 },
  // ── STREAKS ──
  { id:'streak_3',  name:'Consistent',        desc:'3-day learning streak',    icon:'🔥', tier:'bronze',   group:'Streaks', check:(u)=>(u.streak||0)>=3 },
  { id:'streak_7',  name:'Committed',         desc:'7-day learning streak',    icon:'🔥', tier:'silver',   group:'Streaks', check:(u)=>(u.streak||0)>=7 },
  { id:'streak_14', name:'Dedicated',         desc:'14-day learning streak',   icon:'🔥', tier:'gold',     group:'Streaks', check:(u)=>(u.streak||0)>=14 },
  { id:'streak_30', name:'Unstoppable',       desc:'30-day learning streak',   icon:'💫', tier:'platinum', group:'Streaks', check:(u)=>(u.streak||0)>=30 },
  // ── PERFECT SCORES ──
  { id:'perfect_1', name:'Perfectionist',     desc:'Score 100% on a session',  icon:'💯', tier:'bronze',   group:'Scores',  check:(u)=>(u.perfectSessions||0)>=1 },
  { id:'perfect_5', name:'Sharp Mind',        desc:'5 perfect sessions',       icon:'🎯', tier:'silver',   group:'Scores',  check:(u)=>(u.perfectSessions||0)>=5 },
  { id:'perfect_10',name:'Elite Student',     desc:'10 perfect sessions',      icon:'🌟', tier:'gold',     group:'Scores',  check:(u)=>(u.perfectSessions||0)>=10 },
  // ── MASTERY CHALLENGE ──
  { id:'mc_1',      name:'Challenger',        desc:'Complete 1 Mastery Challenge',  icon:'⚡', tier:'bronze', group:'MC', check:(u)=>(u.masteryChallengeDone||0)>=1 },
  { id:'mc_5',      name:'Challenge Champ',   desc:'Complete 5 Mastery Challenges', icon:'⚡', tier:'silver', group:'MC', check:(u)=>(u.masteryChallengeDone||0)>=5 },
  { id:'mc_20',     name:'Spaced Rep Master', desc:'Complete 20 Mastery Challenges',icon:'🧠', tier:'gold',   group:'MC', check:(u)=>(u.masteryChallengeDone||0)>=20 },
  // ── COURSE CHALLENGE ──
  { id:'course_1',  name:'Course Champion',   desc:'Complete the Course Challenge', icon:'🏅', tier:'gold',   group:'CC', check:(u)=>(u.courseChallengesDone||0)>=1 },
  // ── SPECIAL ──
  { id:'diagnostic',name:'Self-Aware',        desc:'Complete the pathway diagnostic',   icon:'🔍', tier:'bronze',  group:'Special', check:(u)=>!!u.specialty },
  { id:'fast_learner',name:'Fast Learner',    desc:'Score 100% on your very first practice',icon:'⚡',tier:'silver',group:'Special', check:(u)=>u.firstAttemptPerfect||false },
  { id:'ai_10',     name:'AI Pupil',          desc:'Send 10 messages to MetaBrain',     icon:'🤖', tier:'bronze',  group:'Special', check:(u)=>(u.chatMessages||0)>=10 },
  { id:'flash_5',   name:'Flash Master',      desc:'Generate 5 flashcard decks',        icon:'🃏', tier:'silver',  group:'Special', check:(u,p,path,e)=>e&&(e.flashDeckCount||0)>=5 },
];

function _cntLevel(pathway, path, minLevel) {
  if (!path) return 0;
  let n = 0;
  path.units.forEach(u => u.lessons.forEach(l => {
    if ((getLessonStateRaw(pathway, u.id, l.id).masteryLevel || 0) >= minLevel) n++;
  }));
  return n;
}
function _cntUnits(pathway, path) {
  if (!path) return 0;
  return path.units.filter(u => (pathway[u.id]?.masteryScore || 0) >= u.req).length;
}
function checkNewBadges(user, pathway, path, extras = {}) {
  const earned = user.earnedBadges || [];
  return BADGES.filter(b => !earned.includes(b.id) && b.check(user, pathway, path, extras)).map(b => b.id);
}


/* ═══════════════════════════════════════════════════════════════
   PATHWAY STATE HELPERS
═══════════════════════════════════════════════════════════════ */
function getLessonStateRaw(pathway, unitId, lessonId) {
  const unit = pathway[unitId] || {};
  if (unit.lessons && unit.lessons[lessonId]) return unit.lessons[lessonId];
  if (Array.isArray(unit.lessonsComplete) && unit.lessonsComplete.includes(lessonId))
    return { videoWatched: true, articleRead: true, masteryLevel: 2, sessions: 1, lastPracticed: null };
  return { videoWatched: false, articleRead: false, masteryLevel: 0, sessions: 0, lastPracticed: null };
}

function getLessonState(pathway, unitId, lessonId) {
  const s = getLessonStateRaw(pathway, unitId, lessonId);
  // Legacy migration: old system had levels 0-3 where 3=Mastered.
  // New system has 0-4 where 4=Mastered. If schemaV2 is not set, migrate.
  if (!s.schemaV2) {
    const oldLevel = s.masteryLevel || 0;
    // old 3→new 4, old 2→new 3, old 1→new 2, old 0→new 0
    const migrated = oldLevel === 3 ? 4 : oldLevel === 2 ? 3 : oldLevel === 1 ? 2 : 0;
    return { ...s, masteryLevel: migrated };
  }
  return s;
}

function setLessonState(pathway, unitId, lessonId, updater) {
  const unit = pathway[unitId] || { unlocked: false, masteryScore: null, lessons: {} };
  const cur  = getLessonState(pathway, unitId, lessonId);
  return {
    ...pathway,
    [unitId]: { ...unit, lessons: { ...(unit.lessons || {}), [lessonId]: { ...updater(cur), schemaV2: true } } }
  };
}

/* Unit mastery % = sum of mastery points / (num_lessons × 100) */
function calcUnitMastery(pathway, unit) {
  if (!unit.lessons.length) return 0;
  const totalPossible = unit.lessons.length * 100;
  const earned = unit.lessons.reduce((s, l) => {
    const level = getLessonState(pathway, unit.id, l.id).masteryLevel || 0;
    return s + (MASTERY[level]?.points || 0);
  }, 0);
  return Math.round((earned / totalPossible) * 100);
}

function calcCourseMastery(pathway, path) {
  if (!path) return 0;
  const pcts = path.units.map(u => calcUnitMastery(pathway, u));
  return pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
}

function calcTotalMasteryPoints(pathway, path) {
  if (!path) return { earned: 0, max: 0 };
  let earned = 0, max = 0;
  path.units.forEach(unit => {
    unit.lessons.forEach(l => {
      max += 100;
      const level = getLessonState(pathway, unit.id, l.id).masteryLevel || 0;
      earned += MASTERY[level]?.points || 0;
    });
  });
  return { earned, max };
}

/* Smart Continue routing */
function findNextItem(pathway, path) {
  if (!path) return null;
  for (const unit of path.units) {
    const us = pathway[unit.id] || {};
    if (!us.unlocked) continue;
    for (const lesson of unit.lessons) {
      const ls = getLessonState(pathway, unit.id, lesson.id);
      if (!ls.videoWatched)    return { unit, lesson, step: 'video' };
      if (!ls.articleRead)     return { unit, lesson, step: 'article' };
      if ((ls.masteryLevel||0) < 4) return { unit, lesson, step: 'practice' };
    }
    if (!us.masteryScore || us.masteryScore < unit.req) {
      const allFamiliar = unit.lessons.every(l => (getLessonState(pathway,unit.id,l.id).masteryLevel||0) >= 2);
      if (allFamiliar) return { unit, lesson: null, step: 'mastery' };
    }
  }
  return { step: 'complete' };
}

/* Find weakest (lowest mastery) unlocked lessons for personalized practice */
function findWeakestLessons(pathway, path, limit = 6) {
  if (!path) return [];
  const all = [];
  path.units.forEach(unit => {
    if (!pathway[unit.id]?.unlocked) return;
    unit.lessons.forEach(lesson => {
      const ls = getLessonState(pathway, unit.id, lesson.id);
      const level = ls.masteryLevel || 0;
      if (level < 4) all.push({ unit, lesson, level, lastPracticed: ls.lastPracticed || 0 });
    });
  });
  return all.sort((a, b) => a.level - b.level || a.lastPracticed - b.lastPracticed).slice(0, limit);
}

/* Stale lessons: practiced but not reviewed in 7+ days */
function findStaleSkills(pathway, path) {
  if (!path) return [];
  const now = Date.now();
  const stale = [];
  path.units.forEach(unit => {
    if (!pathway[unit.id]?.unlocked) return;
    unit.lessons.forEach(lesson => {
      const ls = getLessonState(pathway, unit.id, lesson.id);
      const level = ls.masteryLevel || 0;
      if (level < 2) return; // not yet Familiar, nothing to decay
      const daysSince = ls.lastPracticed ? (now - ls.lastPracticed) / 86400000 : 999;
      if (daysSince >= 7) stale.push({ unit, lesson, level, daysSince: Math.floor(daysSince) });
    });
  });
  return stale.sort((a, b) => b.daysSince - a.daysSince).slice(0, 4);
}

/* ═══════════════════════════════════════════════════════════════
   DIAGNOSTIC QUESTIONS
═══════════════════════════════════════════════════════════════ */
const DIAGNOSTIC_QS = [
  { q: 'Which clinical scenario excites you most?', opts: ['Performing a complex surgical procedure', 'Solving a diagnostic mystery over weeks', 'Comforting a child and their family through illness', 'Exploring the human mind and behavior', 'Running a groundbreaking clinical trial'], w: { surgery: [5,1,1,1,1], internal: [1,5,1,1,2], pediatrics: [1,1,5,1,1], psychiatry: [1,1,2,5,1], research: [1,2,1,1,5] } },
  { q: 'Your ideal work environment is:', opts: ['Fast-paced OR with clear, immediate outcomes', 'Hospital ward with long-term patient relationships', 'Outpatient clinic focused on families', 'Private therapy or inpatient psychiatry unit', 'Lab, conference room, or academic setting'], w: { surgery: [5,1,1,1,1], internal: [1,5,1,1,2], pediatrics: [1,1,5,1,1], psychiatry: [1,1,1,5,1], research: [1,1,1,1,5] } },
  { q: 'Which subject energizes you most?', opts: ['Anatomy and biomechanics', 'Physiology and pharmacology', 'Pediatric development & growth', 'Psychology and social behavior', 'Biochemistry and molecular biology'], w: { surgery: [5,2,1,1,2], internal: [2,5,1,1,2], pediatrics: [1,2,5,1,1], psychiatry: [1,1,1,5,2], research: [2,2,1,2,5] } },
  { q: 'Your personality under pressure:', opts: ['Decisive, action-oriented, hands-on', 'Methodical, analytical, systematic', 'Empathetic, nurturing, patient-centered', 'Reflective, insightful, deep listener', 'Data-driven, evidence-based, rigorous'], w: { surgery: [5,2,1,1,1], internal: [2,5,1,1,2], pediatrics: [1,1,5,2,1], psychiatry: [1,2,2,5,1], research: [1,2,1,1,5] } },
  { q: 'Your strongest MCAT section:', opts: ['Chem/Phys', 'Bio/Biochem', 'CARS', 'Psych/Soc', 'All equal'], w: { surgery: [4,3,1,1,2], internal: [2,5,2,2,2], pediatrics: [2,3,3,3,2], psychiatry: [1,2,3,5,2], research: [3,5,2,2,2] } },
  { q: 'How do you prefer patient interaction?', opts: ['Brief, high-stakes procedural', 'Long-term relationship management', 'Family-centered, pediatric-focused', 'Deep psychological, therapeutic', 'Minimal contact — I prefer research'], w: { surgery: [5,1,1,1,1], internal: [1,5,1,1,1], pediatrics: [1,2,5,1,1], psychiatry: [1,1,1,5,1], research: [1,1,1,1,5] } },
  { q: 'Which best describes you?', opts: ['I love working with my hands', 'I love piecing together complex clinical puzzles', 'I love watching patients grow and heal over time', 'I love exploring what makes people think and feel', 'I love discovering knowledge that did not exist before'], w: { surgery: [5,2,1,1,1], internal: [1,5,1,1,2], pediatrics: [1,1,5,1,1], psychiatry: [1,1,2,5,1], research: [1,1,1,1,5] } },
  { q: 'Your dream research project:', opts: ['Surgical technique or device innovation', 'Disease pathophysiology and new drug targets', 'Pediatric vaccine or child health intervention', 'Mental health treatment outcomes', 'Genomics, proteomics, or molecular medicine'], w: { surgery: [5,2,1,1,1], internal: [1,5,1,1,2], pediatrics: [1,1,5,1,1], psychiatry: [1,1,1,5,1], research: [1,2,1,2,5] } },
  { q: 'Work-life integration for you means:', opts: ['Intense bursts with tangible payoffs', 'Intellectually demanding but predictable hours', 'Family-friendly hours that matter deeply', 'Flexible scheduling for therapy sessions', 'Academic schedule with protected research time'], w: { surgery: [5,2,1,1,1], internal: [1,5,1,1,1], pediatrics: [1,1,5,1,1], psychiatry: [1,1,2,5,1], research: [1,1,1,1,5] } },
  { q: 'Which physician inspires you most?', opts: ['Atul Gawande (Surgery & Safety)', 'Paul Kalanithi (Neurology & Literature)', 'Benjamin Spock (Pediatrics & Family)', 'Victor Frankl (Psychiatry & Meaning)', 'Francis Collins (Genomics & Leadership)'], w: { surgery: [5,2,1,1,1], internal: [2,5,1,1,2], pediatrics: [1,1,5,1,1], psychiatry: [1,1,1,5,1], research: [1,2,1,1,5] } },
];


/* ═══════════════════════════════════════════════════════════════
   SPECIALTY PATHS — 5 paths × 5 units × 3 lessons
═══════════════════════════════════════════════════════════════ */
const PATHS = {
  surgery: {
    label: 'General Surgery', icon: '🔬', accent: '#ef4444', border: 'border-red-500/40',
    tagline: 'Master anatomy, physiology & surgical science',
    units: [
      { id: 'su1', title: 'Biochemistry Foundations', desc: 'Amino acids, enzymes, metabolism', cat: 'Bio/Biochem', req: 3, masteryTotal: 8, xp: 150,
        lessons: [
          { id: 'su1-l1', title: 'Amino Acid Structure & Properties', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=Eq1xMEGTnVE', dur: '18 min', note: 'Know pKa: Asp/Glu (acidic), Lys/Arg/His (basic).' },
          { id: 'su1-l2', title: 'Enzyme Kinetics & Inhibition', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=4SjNWBJkASU', dur: '22 min', note: 'Lineweaver-Burk: competitive raises Km, non-competitive lowers Vmax.' },
          { id: 'su1-l3', title: 'Glycolysis & the TCA Cycle', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=2f7YwCtHcgk', dur: '25 min', note: 'Net: 2 ATP from glycolysis; ~30 ATP from full oxidative phosphorylation.' },
        ]
      },
      { id: 'su2', title: 'Cardiovascular & Respiratory', desc: 'Heart, lungs, hemodynamics', cat: 'Chem/Phys', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 'su2-l1', title: 'Cardiac Cycle & Hemodynamics', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=AXTzYYCl3bk', dur: '20 min', note: 'Frank-Starling: increased preload → increased stroke volume.' },
          { id: 'su2-l2', title: 'Respiratory Mechanics & Gas Exchange', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=HPHByM4ANLI', dur: '18 min', note: 'V/Q = 0 (shunt). V/Q = infinity (dead space).' },
          { id: 'su2-l3', title: 'Acid-Base Disorders', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=0YbBMPah3y0', dur: '15 min', note: 'ROME mnemonic. Normal ABG: pH 7.35-7.45, PCO2 35-45, HCO3 22-26.' },
        ]
      },
      { id: 'su3', title: 'Musculoskeletal System', desc: 'Bones, muscles, connective tissue', cat: 'Bio/Biochem', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 'su3-l1', title: 'Sliding Filament & Muscle Contraction', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=GrHsiHazpsw', dur: '20 min', note: 'Ca2+ binds troponin-C → tropomyosin shifts → myosin power stroke.' },
          { id: 'su3-l2', title: 'Bone Remodeling & Mineral Homeostasis', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=wJ_GGMx-GCk', dur: '17 min', note: 'PTH raises serum Ca2+: activates osteoclasts, renal reabsorption, calcitriol.' },
          { id: 'su3-l3', title: 'Collagen & Connective Tissue', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=Ck7RqJiHcNk', dur: '15 min', note: 'Type I: bone/tendon. Type II: cartilage. Type IV: basement membrane. Vit C needed.' },
        ]
      },
      { id: 'su4', title: 'Molecular Biology & Genetics', desc: 'DNA, RNA, gene regulation', cat: 'Bio/Biochem', req: 3, masteryTotal: 8, xp: 200,
        lessons: [
          { id: 'su4-l1', title: 'DNA Replication & Repair', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=TNKWgcFPHqw', dur: '20 min', note: 'Leading strand: continuous 5→3. Lagging: Okazaki fragments joined by ligase.' },
          { id: 'su4-l2', title: 'Transcription, Translation & PTMs', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=WkI_Vbwn14g', dur: '18 min', note: 'RNA Pol II makes mRNA; 5-prime cap + poly-A tail; introns removed by spliceosome.' },
          { id: 'su4-l3', title: 'Mendelian Genetics & Pedigree Analysis', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=kMKho3d1_0w', dur: '22 min', note: 'Hardy-Weinberg: p2+2pq+q2=1. Five assumptions: no mutation/migration/selection/drift/random mating.' },
        ]
      },
      { id: 'su5', title: 'Physics & Fluid Dynamics', desc: 'Mechanics, fluids, thermodynamics', cat: 'Chem/Phys', req: 3, masteryTotal: 8, xp: 200,
        lessons: [
          { id: 'su5-l1', title: "Poiseuille's Law & Fluid Mechanics", url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=4TqDhZ9LDSQ', dur: '18 min', note: 'Q ∝ r4: halving radius reduces flow 16-fold. Radius is the dominant variable.' },
          { id: 'su5-l2', title: 'Circuits & Electricity', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=ZrMw7P6P2Cs', dur: '20 min', note: 'Series: R total = sum. Parallel: 1/R total = sum of reciprocals.' },
          { id: 'su5-l3', title: 'Thermodynamics & Free Energy', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=CFmzT1lAdcA', dur: '22 min', note: 'deltaG = deltaH - T*deltaS. Spontaneous when deltaG < 0. Enzymes lower Ea only.' },
        ]
      },
    ]
  },
  internal: {
    label: 'Internal Medicine', icon: '🩺', accent: '#3b82f6', border: 'border-blue-500/40',
    tagline: 'Master diagnostic reasoning & pharmacology',
    units: [
      { id: 'im1', title: 'Pathophysiology Foundations', desc: 'Disease at the cellular level', cat: 'Bio/Biochem', req: 3, masteryTotal: 8, xp: 150,
        lessons: [
          { id: 'im1-l1', title: 'Inflammation & Immune Response', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=kz9LFvRBLXA', dur: '20 min', note: 'COX-2 produces prostaglandins. NSAIDs block COX non-selectively.' },
          { id: 'im1-l2', title: 'Necrosis vs Apoptosis', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=9KIH42V6A3M', dur: '18 min', note: 'Apoptosis: caspase cascade, no inflammation. Necrosis: cell swells, triggers inflammation.' },
          { id: 'im1-l3', title: 'Neoplasia & Cancer Biology', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=RZhL7LDPk8w', dur: '22 min', note: 'Proto-oncogenes = gas pedal. Tumor suppressors = brakes (2-hit hypothesis).' },
        ]
      },
      { id: 'im2', title: 'Pharmacology Principles', desc: 'PK/PD, CYP450, drug interactions', cat: 'Bio/Biochem', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 'im2-l1', title: 'Drug Absorption & Bioavailability', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=CUXJqHB_6Os', dur: '18 min', note: 'First-pass hepatic metabolism reduces oral bioavailability. IV = 100%.' },
          { id: 'im2-l2', title: 'Receptor Pharmacology', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=9miR3Xv_1mI', dur: '20 min', note: 'ED50 = dose for 50% maximal effect. Therapeutic index = LD50/ED50.' },
          { id: 'im2-l3', title: 'Drug Metabolism & CYP450', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=6-w4x1wz9oQ', dur: '15 min', note: 'CYP3A4 metabolizes ~50% of drugs. Inducers increase clearance; inhibitors increase levels.' },
        ]
      },
      { id: 'im3', title: 'Endocrinology', desc: 'Hormones, axes, diabetes', cat: 'Bio/Biochem', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 'im3-l1', title: 'Hypothalamic-Pituitary Axis', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=dJ79hHgOLxE', dur: '22 min', note: 'Negative feedback: cortisol suppresses CRH and ACTH. Disrupted in Cushing.' },
          { id: 'im3-l2', title: 'Thyroid & Adrenal Physiology', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=L5ESTrH7V7s', dur: '20 min', note: 'T3 is active. Adrenal cortex layers GFR: Glomerulosa (salt), Fasciculata (sugar), Reticularis (sex).' },
          { id: 'im3-l3', title: 'Diabetes Mellitus & Insulin Signaling', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=X9ivR4-eFmA', dur: '18 min', note: 'Type 1: autoimmune beta-cell destruction. Type 2: insulin resistance → eventual beta-cell failure.' },
        ]
      },
      { id: 'im4', title: 'Electrochemistry & Solutions', desc: 'Galvanic cells, buffers, osmolarity', cat: 'Chem/Phys', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 'im4-l1', title: 'Galvanic Cells & Nernst Equation', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=lQ6FBA1HM3s', dur: '20 min', note: 'Nernst: E = E0 - (RT/nF)lnQ. Cathode = reduction; anode = oxidation. OILRIG.' },
          { id: 'im4-l2', title: 'Acid-Base Equilibria & Buffers', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=VZqCH7SVRGQ', dur: '18 min', note: 'Henderson-Hasselbalch: pH = pKa + log([A-]/[HA]). Best buffer when pH = pKa ± 1.' },
          { id: 'im4-l3', title: 'Osmolarity & Colligative Properties', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=hVMzGK8mfRk', dur: '15 min', note: 'Osmotic pressure pi = iMRT. Hypertonic: cell crenates. Hypotonic: cell lyses.' },
        ]
      },
      { id: 'im5', title: 'Behavioral Science & Sociology', desc: 'Biopsychosocial model, learning, attribution', cat: 'Psych/Soc', req: 3, masteryTotal: 8, xp: 200,
        lessons: [
          { id: 'im5-l1', title: 'Learning, Memory & Conditioning', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=mB-6dn9cTJA', dur: '18 min', note: 'Variable-ratio schedule: fastest and most extinction-resistant.' },
          { id: 'im5-l2', title: 'Social Cognition & Attribution', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=8MHMDqSbPDI', dur: '20 min', note: 'FAE: overestimate dispositional, underestimate situational factors in others.' },
          { id: 'im5-l3', title: 'Health Disparities & Social Determinants', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=Hs1aFSH0cxo', dur: '15 min', note: 'Social determinants: income, education, housing, food security. SES inversely correlated with morbidity.' },
        ]
      },
    ]
  },
  pediatrics: {
    label: 'Pediatrics', icon: '👶', accent: '#10b981', border: 'border-emerald-500/40',
    tagline: 'Specialize in child development & family medicine',
    units: [
      { id: 'pe1', title: 'Developmental Biology', desc: 'Embryology & milestones', cat: 'Bio/Biochem', req: 3, masteryTotal: 8, xp: 150,
        lessons: [
          { id: 'pe1-l1', title: 'Embryonic Development & Organogenesis', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=dAOWQDOX35k', dur: '22 min', note: 'Weeks 3-8 = organogenesis = highest teratogen risk.' },
          { id: 'pe1-l2', title: 'Developmental Milestones by Age', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=VDNgKtC_GRc', dur: '18 min', note: 'Social smile 2 mo, pincer grasp 9 mo, walks 12 mo, 2-word phrases 24 mo.' },
          { id: 'pe1-l3', title: 'Chromosomal & Genetic Disorders', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=IpBEae19Qlo', dur: '20 min', note: 'Down (T21): AV canal. Turner (45,X): coarctation. Klinefelter (47,XXY): infertility.' },
        ]
      },
      { id: 'pe2', title: 'Immunology & Infectious Disease', desc: 'Immunity, vaccines, infections', cat: 'Bio/Biochem', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 'pe2-l1', title: 'Innate vs Adaptive Immunity', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=LmpuerlbJu0', dur: '22 min', note: 'MHC I (all nucleated) → CD8+. MHC II (APCs) → CD4+.' },
          { id: 'pe2-l2', title: 'Vaccine Immunology', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=rb7TVW77ZCs', dur: '18 min', note: 'Live-attenuated (MMR): strongest, contraindicated in immunocompromised.' },
          { id: 'pe2-l3', title: 'Pediatric Infections Overview', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=VXRLgqBjr9E', dur: '15 min', note: 'Kawasaki: fever 5+ days + CRASH. RSV = most common infant bronchiolitis. Croup: steeple sign.' },
        ]
      },
      { id: 'pe3', title: 'Child Psychology', desc: 'Piaget, Erikson, attachment theory', cat: 'Psych/Soc', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 'pe3-l1', title: "Piaget's Cognitive Development", url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=TRF27F2bn-A', dur: '20 min', note: 'Sensorimotor (0-2), Preoperational (2-7: egocentric), Concrete (7-11: conservation), Formal (12+).' },
          { id: 'pe3-l2', title: 'Attachment Theory', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=yrB5kSXE_uQ', dur: '18 min', note: 'Secure (60-65%): safe base. Anxious-ambivalent: hard to soothe. Avoidant: ignores caregiver.' },
          { id: 'pe3-l3', title: "Erikson's Psychosocial Stages", url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=OhBME54N0hI', dur: '15 min', note: 'Key MCAT: Identity vs Role Confusion (adolescence). Eight stages birth to late adulthood.' },
        ]
      },
      { id: 'pe4', title: 'Nutrition & Metabolism', desc: 'Vitamins, lipoproteins, nitrogen metabolism', cat: 'Bio/Biochem', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 'pe4-l1', title: 'Vitamins & Cofactors', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=K0-BFzqBsJ8', dur: '20 min', note: 'Fat-soluble ADEK: stored, toxic. B1 (TPP/PDH), B3 (NAD+), B12 (intrinsic factor).' },
          { id: 'pe4-l2', title: 'Lipid Metabolism & Lipoproteins', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=n5QoSHmOubc', dur: '18 min', note: 'Chylomicrons: dietary fat. LDL: delivers to tissues. HDL: reverse cholesterol transport.' },
          { id: 'pe4-l3', title: 'Urea Cycle & Nitrogen Metabolism', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=i-5cSNWrK6E', dur: '15 min', note: 'OTC deficiency (X-linked): high NH3 + orotic acid. Liver converts NH3 to urea.' },
        ]
      },
      { id: 'pe5', title: 'Research Methods & Statistics', desc: 'Study design, biostats, ethics', cat: 'Psych/Soc', req: 3, masteryTotal: 8, xp: 200,
        lessons: [
          { id: 'pe5-l1', title: 'Epidemiology & Study Design', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=OqEbX6FSEQA', dur: '18 min', note: 'RCT = gold standard. Cohort → RR. Case-control → OR. Randomization controls confounders.' },
          { id: 'pe5-l2', title: 'Biostatistics for the MCAT', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=U3M5-meSBKA', dur: '20 min', note: 'SnNout rules out; SpPin rules in. PPV increases with prevalence. NNT = 1/ARR.' },
          { id: 'pe5-l3', title: 'Ethical Principles in Research', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=X88jFfPvn00', dur: '15 min', note: 'Belmont: Respect for persons, Beneficence, Justice. Tuskegee → National Research Act 1974.' },
        ]
      },
    ]
  },
  psychiatry: {
    label: 'Psychiatry', icon: '🧠', accent: '#8b5cf6', border: 'border-violet-500/40',
    tagline: 'Master psychology, neuroscience & behavioral medicine',
    units: [
      { id: 'ps1', title: 'Neuroscience Foundations', desc: 'Neurons, synapses, brain regions', cat: 'Bio/Biochem', req: 3, masteryTotal: 8, xp: 150,
        lessons: [
          { id: 'ps1-l1', title: 'Neuron Structure & Action Potential', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=HYLyhXRp298', dur: '22 min', note: 'Resting: -70mV. Depolarization: Na+ in. Repolarization: K+ out. Refractory period prevents back-prop.' },
          { id: 'ps1-l2', title: 'Synaptic Transmission & Neurotransmitters', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=WhowH0kb7n0', dur: '20 min', note: 'GABA: inhibitory Cl- channel. Glutamate: AMPA/NMDA excitatory. Dopamine: reward.' },
          { id: 'ps1-l3', title: 'Brain Regions & Their Functions', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=SRInEgxs2Pk', dur: '18 min', note: 'Amygdala: fear. Hippocampus: memory. PFC: executive function. Basal ganglia: movement.' },
        ]
      },
      { id: 'ps2', title: 'Psychology & Behavior', desc: 'Learning, cognition, disorders', cat: 'Psych/Soc', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 'ps2-l1', title: 'Sensation, Perception & Consciousness', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=unWnZvXJH2o', dur: '20 min', note: "Weber's Law: JND/stimulus intensity = k (constant)." },
          { id: 'ps2-l2', title: 'Motivation, Emotion & Stress', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=bZEiJz3k5DY', dur: '18 min', note: 'James-Lange: arousal precedes emotion. Schachter-Singer: arousal + label = emotion.' },
          { id: 'ps2-l3', title: 'Psychological Disorders & DSM-5', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=FHrfGiAb1ig', dur: '22 min', note: 'Schizophrenia: positive (hallucinations, delusions) + negative (flat affect, alogia, avolition) symptoms.' },
        ]
      },
      { id: 'ps3', title: 'Social Science & Sociology', desc: 'Stratification, culture, group dynamics', cat: 'Psych/Soc', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 'ps3-l1', title: 'Social Stratification & Health Inequity', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=7hTB1-4qM70', dur: '18 min', note: 'SES gradient: poverty → higher chronic disease, mental illness, infant mortality.' },
          { id: 'ps3-l2', title: 'Culture, Identity & Health Behavior', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=FSJZ3mcC_p8', dur: '16 min', note: 'Acculturation: assimilation, integration, separation, marginalization. Race is a social construct.' },
          { id: 'ps3-l3', title: 'Social Networks & Group Dynamics', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=UGxGDdQnC1Y', dur: '15 min', note: 'Asch: 76% conformed. Milgram: 65% gave max shock. Bystander: diffusion of responsibility.' },
        ]
      },
      { id: 'ps4', title: 'Neuropharmacology', desc: 'Psychiatric drugs & mechanisms', cat: 'Bio/Biochem', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 'ps4-l1', title: 'Antidepressants & Antipsychotics', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=YgnTKZnBXOM', dur: '22 min', note: 'SSRIs block SERT (first-line). Atypicals: D2 + 5-HT2A block, fewer EPS than typicals.' },
          { id: 'ps4-l2', title: 'Anxiolytics & Mood Stabilizers', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=3Qp4DHWGZCA', dur: '18 min', note: 'Benzos: increase GABA-A Cl- channel frequency. Lithium: gold standard for bipolar.' },
          { id: 'ps4-l3', title: 'Neuroplasticity & Memory', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=OyK9T4nBD9g', dur: '20 min', note: 'LTP: NMDA receptor Ca2+ influx → AMPA insertion → lasting synapse strengthening.' },
        ]
      },
      { id: 'ps5', title: 'Behavioral Research Methods', desc: 'Research design, stats, ethics', cat: 'Psych/Soc', req: 3, masteryTotal: 8, xp: 200,
        lessons: [
          { id: 'ps5-l1', title: 'Psychological Research Methodology', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=9GCM1TerXck', dur: '18 min', note: 'Internal validity: measures what it claims. External validity: results generalize.' },
          { id: 'ps5-l2', title: 'Statistics for Psych/Soc', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=MXaJ7sa7q-8', dur: '22 min', note: 'Normal distribution: mean=median=mode. Positive skew: mean pulled toward tail.' },
          { id: 'ps5-l3', title: 'Ethics in Behavioral Research', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=cRGMv_MVKGQ', dur: '15 min', note: 'Tuskegee → Belmont Report. Milgram and Zimbardo set APA ethics standards.' },
        ]
      },
    ]
  },
  research: {
    label: 'Research & Academia', icon: '🔭', accent: '#f59e0b', border: 'border-amber-500/40',
    tagline: 'Excel in biomedical research & academic medicine',
    units: [
      { id: 're1', title: 'Molecular Biology', desc: 'Gene expression, epigenetics, CRISPR', cat: 'Bio/Biochem', req: 3, masteryTotal: 8, xp: 150,
        lessons: [
          { id: 're1-l1', title: 'Gene Expression & Epigenetic Regulation', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=TfYf_rPWUdY', dur: '22 min', note: 'Methylation silences. Acetylation opens chromatin. miRNA → RISC → silences target mRNA.' },
          { id: 're1-l2', title: 'Protein Folding, Chaperones & Proteomics', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=gFcp2Xpd29I', dur: '18 min', note: 'Hsp70 prevents misfolding. Prion: misfolded PrPsc recruits normal PrPc (CJD, kuru).' },
          { id: 're1-l3', title: 'CRISPR-Cas9 & Gene Editing', url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules', yt: 'https://www.youtube.com/watch?v=2pp17E4E-O8', dur: '20 min', note: 'gRNA directs Cas9 to PAM (NGG). NHEJ = knockout; HDR = precise editing.' },
        ]
      },
      { id: 're2', title: 'Epidemiology & Biostatistics', desc: 'Study design, bias, meta-analysis', cat: 'Psych/Soc', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 're2-l1', title: 'Epidemiology: Incidence, Prevalence, Risk', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=OqEbX6FSEQA', dur: '20 min', note: 'RR from cohort. OR from case-control. AR = exposed rate - unexposed rate.' },
          { id: 're2-l2', title: 'Statistical Power, Error, Significance', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=7nh3X_8c2cY', dur: '18 min', note: 'Type I (alpha) = false positive. Type II (beta) = false negative. Power = 1-beta.' },
          { id: 're2-l3', title: 'Systematic Reviews & Meta-Analysis', url: 'https://www.khanacademy.org/test-prep/mcat/behavior', yt: 'https://www.youtube.com/watch?v=SAE-mJXwnPE', dur: '15 min', note: 'Forest plot: diamond = pooled estimate. CI crossing 1.0 = not significant. Funnel asymmetry = publication bias.' },
        ]
      },
      { id: 're3', title: 'Physical Chemistry & Spectroscopy', desc: 'Lab techniques and physical chemistry', cat: 'Chem/Phys', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 're3-l1', title: 'Spectroscopy: NMR, IR & Mass Spec', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=SBir5wUS3Bo', dur: '20 min', note: 'IR: 1700 cm-1 = carbonyl. NMR: n+1 rule. MS: M+ = molecular weight.' },
          { id: 're3-l2', title: 'Chromatography & Electrophoresis', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=1bFzMPJNHmw', dur: '18 min', note: 'SDS-PAGE: separates by size. Native PAGE: charge+size. TLC: less polar = higher Rf.' },
          { id: 're3-l3', title: 'Thermodynamics & Reaction Kinetics', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=CFmzT1lAdcA', dur: '22 min', note: 'Arrhenius: k = Ae^(-Ea/RT). Catalysts lower Ea, do NOT change equilibrium.' },
        ]
      },
      { id: 're4', title: 'Immunology & Virology', desc: 'Host-pathogen interactions in depth', cat: 'Bio/Biochem', req: 3, masteryTotal: 8, xp: 175,
        lessons: [
          { id: 're4-l1', title: 'Adaptive Immunity & V(D)J Recombination', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=mwnVcFWoxps', dur: '22 min', note: 'V(D)J creates antibody diversity. Somatic hypermutation in germinal centers = affinity maturation.' },
          { id: 're4-l2', title: 'Microbial Pathogenesis & Virulence', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=VXRLgqBjr9E', dur: '20 min', note: 'A-B toxins: A=active, B=binding. LPS (gram-negative) triggers septic shock via TLR4.' },
          { id: 're4-l3', title: 'Viral Replication & Antiviral Targets', url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems', yt: 'https://www.youtube.com/watch?v=0h5Jd7sgQWY', dur: '18 min', note: 'HIV: RNA → cDNA via reverse transcriptase → integrates. NRTIs/NNRTIs target RT.' },
        ]
      },
      { id: 're5', title: 'Organic Chemistry', desc: 'Reactions, mechanisms, stereochemistry', cat: 'Chem/Phys', req: 3, masteryTotal: 8, xp: 200,
        lessons: [
          { id: 're5-l1', title: 'Nucleophilic Substitution (SN1 & SN2)', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=MqnVGNr3mso', dur: '22 min', note: 'SN2: backside attack = inversion. SN1: carbocation = racemization. Polar aprotic solvents favor SN2.' },
          { id: 're5-l2', title: 'Carbonyl Chemistry & Reactions', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=j9MikXByeys', dur: '20 min', note: 'Carbonyl C is electrophilic. Aldehydes > ketones in reactivity. Aldol = beta-hydroxy carbonyl.' },
          { id: 're5-l3', title: 'Stereochemistry & Chirality', url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes', yt: 'https://www.youtube.com/watch?v=H8Z-VWq7DkI', dur: '18 min', note: 'R/S via CIP: rank by atomic number, clockwise = R. Enantiomers rotate light equally but opposite.' },
        ]
      },
    ]
  },
};


/* ═══════════════════════════════════════════════════════════════
   LESSON ARTICLE KEY POINTS (4 high-yield bullets per lesson)
═══════════════════════════════════════════════════════════════ */
const LESSON_POINTS = {
  'su1-l1': ['All amino acids have a central alpha-carbon with NH2, COOH, H, and a unique R-group. At pH 7.4 they exist as zwitterions.','Essential AAs (PVT TIM HaLL): Phe, Val, Thr, Trp, Ile, Met, His, Arg, Leu, Lys.','Asp and Glu are acidic (negative at pH 7.4). Lys, Arg, His are basic (positive at pH 7.4).','Isoelectric point (pI): pH where net charge = 0. Protein precipitates at pI.'],
  'su1-l2': ['Km = substrate concentration at half-Vmax. LOW Km = HIGH affinity.','Competitive inhibitor: increases apparent Km, Vmax unchanged. Can be overcome by excess substrate.','Non-competitive inhibitor: decreases Vmax, Km unchanged. Binds allosteric site.','Lineweaver-Burk: y-intercept = 1/Vmax, x-intercept = -1/Km. Competitive: lines meet on y-axis.'],
  'su1-l3': ['Glycolysis (cytoplasm): 1 glucose → 2 pyruvate + 2 ATP net + 2 NADH. Rate-limiting enzyme: PFK-1.','PDH: pyruvate → acetyl-CoA. Requires TPP, lipoate, CoA, FAD, NAD+. Inhibited by NADH, acetyl-CoA.','TCA cycle: 2 turns/glucose → 6 NADH + 2 FADH2 + 2 GTP. Rate-limiting: isocitrate dehydrogenase.','Total aerobic ATP from 1 glucose: ~30-32 ATP via NADH and FADH2 through oxidative phosphorylation.'],
  'su2-l1': ['Cardiac output = HR × SV. Normal CO = ~5 L/min rest, up to ~25 L/min exercise.','Frank-Starling: increased EDV (preload) → increased sarcomere stretch → increased SV.','MAP = CO × TPR. Normal MAP = ~93 mmHg.','S1 (AV valves close) and S2 (semilunar valves close). Murmurs occur between these sounds.'],
  'su2-l2': ['V/Q = 0: shunt (perfused, not ventilated). V/Q = infinity: dead space (ventilated, not perfused).','O2 carried 97% bound to Hgb. CO2: 70% as bicarbonate via carbonic anhydrase in RBCs.','Oxygen-hemoglobin curve shifts RIGHT (unloads O2 more) with increased CO2, H+, temperature, 2,3-DPG.','FEV1/FVC < 0.7 in obstructive disease; normal ratio in restrictive.'],
  'su2-l3': ['Normal ABG: pH 7.35-7.45, PCO2 35-45 mmHg, HCO3 22-26 mEq/L.','Metabolic acidosis: low pH + low HCO3. MUDPILES causes (Methanol, Uremia, DKA, Propylene glycol, INH, Lactic acidosis, Ethylene glycol, Salicylates).','Respiratory acidosis: low pH + high PCO2. COPD, opioids. Renal compensation: retain HCO3 (days).','Anion gap = Na - (Cl + HCO3). Normal = 8-12. Elevated AG = MUDPILES causes.'],
  'su3-l1': ['Sarcomere = Z-line to Z-line. Contraction: A-band constant, I-band and H-zone narrow.','Excitation-contraction: AP → T-tubule → DHP receptor → ryanodine receptor → Ca2+ → troponin-C.','Power stroke: myosin head (cocked by ATP hydrolysis) pulls actin. No ATP = rigor mortis.','Type I (slow-twitch): oxidative, fatigue-resistant. Type II (fast-twitch): glycolytic, power.'],
  'su3-l2': ['PTH raises Ca2+: activates osteoclasts, renal Ca2+ reabsorption, promotes calcitriol.','Vitamin D pathway: skin (UV) → D3 → liver (25-OH) → kidney (1,25-OH = calcitriol).','Osteoblasts build bone (ALP elevated). Osteoclasts resorb bone (acid phosphatase elevated).','Scurvy: Vit C deficiency → impaired collagen hydroxylation → bleeding, poor wound healing.'],
  'su3-l3': ['Collagen types: I (bone, tendon), II (hyaline cartilage), III (vessels), IV (basement membrane).','Collagen synthesis: proline/lysine hydroxylation in ER requires Vitamin C.','Ehlers-Danlos: defective collagen → hyperextensible joints. Osteogenesis imperfecta: Type I mutation.','Elastin: stretchy, in ligaments and large vessels. Cross-linked by lysyl oxidase (needs Cu2+).'],
  'su4-l1': ['Replication is semi-conservative (Meselson-Stahl). Helicase unwinds; SSBPs stabilize; primase primes.','DNA Pol extends 5→3 only. Cannot start without RNA primer.','Lagging strand: Okazaki fragments; primers removed by Pol I; ligase seals nicks.','DNA repair: mismatch (replication errors), NER (bulky lesions/UV), BER (small base alterations).'],
  'su4-l2': ['RNA Pol II transcribes pre-mRNA. Requires TATA box at -25bp and transcription factors.','Pre-mRNA processing: 5-prime 7-methyl-G cap, poly-A tail, spliceosome removes introns.','Translation: AUG start (Met), 80S ribosome. A site → P site → E site. Stop: UAA, UAG, UGA.','Signal peptides (hydrophobic N-terminus) direct cotranslational translocation to ER.'],
  'su4-l3': ['Hardy-Weinberg: p + q = 1; p2 + 2pq + q2 = 1. Five assumptions required.','Use H-W when given disease prevalence (q2) to find carrier frequency (2pq).','AR: skips generations. X-linked recessive: males affected, female carriers, no father-to-son.','Missense (wrong AA), nonsense (stop codon), frameshift (insertion/deletion = most severe).'],
  'su5-l1': ['Poiseuille: Q = pi*r4*deltaP/(8*eta*L). Q ∝ r4: doubling radius = 16x more flow.','Re > 2000 = turbulent flow (creates murmurs, aneurysm risk, dissection risk).','Bernoulli: faster flow = lower pressure. Explains venturi, aortic stenosis, Coanda effect.','Blood is non-Newtonian: viscosity increases with hematocrit; decreases at high shear rates.'],
  'su5-l2': ['Ohm: V = IR. Series: R_total = sum, same current. Parallel: 1/R = sum of reciprocals, same voltage.','Capacitors store charge: Q = CV. Block DC at steady state; pass AC.','RC time constant: tau = RC. Capacitor charges to 63% after 1 tau; full after ~5 tau.','Power: P = IV = I2R = V2/R. Resistors dissipate power as heat.'],
  'su5-l3': ['deltaG = deltaH - T*deltaS. Spontaneous: deltaG < 0. At equilibrium: deltaG = 0.','Enzymes lower activation energy (Ea) but NEVER change deltaG, deltaH, deltaS, or K_eq.','Le Chatelier: system shifts to oppose disturbance. Adding product shifts left.','K_eq = products/reactants at equilibrium. deltaG-naught = -RT*lnK.'],
  'im1-l1': ['Acute inflammation: vasodilation + increased permeability → leukocyte extravasation. Neutrophils first (6h).','COX-1: constitutive (GI protection, platelets). COX-2: inducible (inflammation).','Systemic: TNF-alpha, IL-1, IL-6 → fever, acute-phase proteins (CRP, fibrinogen), leukocytosis.','Granuloma = chronic: epithelioid macrophages, giant cells. TB: caseating. Sarcoid: non-caseating.'],
  'im1-l2': ['Apoptosis: caspase cascade (intrinsic: Bcl-2/cytochrome c; extrinsic: Fas/TNF). No inflammation.','Necrosis: coagulative (MI), liquefactive (brain), caseous (TB), fat (pancreatitis).','p53: detects DNA damage → p21 arrest → repair or Bax → apoptosis. Most mutated gene in cancer.','BCl-2 overexpression (t(14;18) in follicular lymphoma): anti-apoptotic, cells survive too long.'],
  'im1-l3': ['Oncogenes (gain-of-function): RAS (GTPase mutation), MYC (transcription factor), HER2 (RTK overexpression).','Tumor suppressors (loss): Rb (cell cycle brake), p53 (guardian), BRCA1/2 (DNA repair).','Angiogenesis: VEGF → new blood vessels needed when tumor > 1-2mm (beyond O2 diffusion).','Metastasis: invasion → intravasation → anoikis resistance → extravasation → colonization.'],
  'im2-l1': ['Bioavailability (F): IV = 100%. Oral reduced by intestinal and hepatic first-pass.','Volume of distribution (Vd): lipophilic = large Vd. Hydrophilic = small Vd (stay in plasma).','Half-life: t1/2 = 0.693*Vd/CL. Steady state after ~4-5 half-lives.','Renal clearance = filtration + secretion - reabsorption. Creatinine clearance estimates GFR.'],
  'im2-l2': ['Potency (ED50): dose for 50% maximal effect. More potent = LOWER ED50.','Full agonist: 100% Emax. Partial agonist: < 100% Emax (antagonist in presence of full agonist).','Competitive antagonist: shifts curve RIGHT (↑EC50), does NOT change Emax.','Therapeutic index TI = LD50/ED50. Narrow TI: warfarin, lithium, digoxin, aminoglycosides.'],
  'im2-l3': ['Phase I (CYP450): oxidation (most common), reduction, hydrolysis. Products may be active (prodrugs).','CYP inducers (↑ metabolism, ↓ drug effect): rifampin, phenytoin, carbamazepine, St. Johns Wort.','CYP inhibitors (↓ metabolism, ↑ drug levels): ketoconazole, erythromycin, grapefruit, cimetidine.','Phase II: conjugation (glucuronidation, sulfation, acetylation). Products more water-soluble.'],
  'im3-l1': ['Hypothalamic hormones stimulate anterior pituitary except somatostatin and dopamine (inhibit).','Anterior pituitary (FLAT PiG): FSH, LH, ACTH, TSH, Prolactin, GH.','Negative feedback: most hormones. Exception: estrogen at LH surge = POSITIVE feedback.','Prolactinoma (most common pituitary adenoma): galactorrhea, amenorrhea, bitemporal hemianopsia.'],
  'im3-l2': ['T4 is prohormone; converted to active T3 by 5-deiodinase in peripheral tissues.','Thyroid hormone effects: increased BMR, thermogenesis, GI motility, cardiac output.','Adrenal cortex GFR: Glomerulosa (aldosterone/angiotensin II), Fasciculata (cortisol/ACTH), Reticularis (DHEA).','Addison: autoimmune adrenal destruction → low cortisol + low aldosterone → hyperpigmentation.'],
  'im3-l3': ['Insulin: GLUT4 translocation, glycogen synthesis, lipogenesis, protein synthesis, K+ uptake.','Type 1: absolute insulin deficiency → prone to DKA (ketoacidosis from ketogenesis).','Type 2: insulin resistance + beta-cell exhaustion. Metformin first-line (↓ hepatic gluconeogenesis).','Hyperglycemia complications: AGEs → microangiopathy (retinopathy, nephropathy, neuropathy).'],
  'im4-l1': ['Galvanic = spontaneous (deltaG < 0, E > 0). Electrolytic = nonspontaneous, needs external voltage.','Standard reduction potentials: more positive = better oxidizing agent (cathode).','Nernst: E = E° - (0.0592/n)*log(Q) at 25°C. At equilibrium: E = 0, Q = K.','deltaG° = -nFE°. F = 96,485 C/mol. n = moles of electrons transferred.'],
  'im4-l2': ['Weak acids: partial dissociation. Ka = [H+][A-]/[HA]. Strong acids: fully dissociate.','Henderson-Hasselbalch: pH = pKa + log([A-]/[HA]). Best buffer: pH = pKa ± 1.','Bicarbonate buffer: H+ + HCO3- → H2CO3 → CO2 + H2O. Lungs control CO2 (fast); kidneys control HCO3 (slow).','Phosphate buffer (pKa 6.8): most effective intracellularly. Bicarbonate (pKa 6.1): most physiologically important.'],
  'im4-l3': ['Serum osmolarity = 2[Na+] + [glucose]/18 + [BUN]/2.8.','Van Hoff factor (i): NaCl → i=2. Osmotic pressure pi = iMRT.','Tonicity: isotonic (no change). Hypertonic → cell crenates. Hypotonic → cell lyses.','Colligative properties proportional to number of solute particles regardless of their identity.'],
  'im5-l1': ['Classical: CS+US → CR. Operant: positive reinforcement increases behavior; punishment decreases.','Variable-ratio: fastest response rate AND most resistant to extinction (slot machines).','Memory: sensory (seconds), STM (7±2 items), LTM (explicit: episodic/semantic; implicit: procedural).','Cognitive dissonance: discomfort when beliefs/actions conflict → change attitude or behavior.'],
  'im5-l2': ['FAE: overestimate personality, underestimate situation when explaining others behavior.','Actor-observer bias: own behavior = situational; others behavior = dispositional.','Self-serving bias: success = internal; failure = external. Protects self-esteem.','In-group bias: more positive attributions to in-group. Out-group homogeneity bias.'],
  'im5-l3': ['Social determinants (WHO): income, employment, education, housing, food security, social support.','SES gradient: nearly universal across cultures. Not just poverty vs non-poverty.','Health inequities: systematic, avoidable, unjust differences (socially determined).','Cultural humility: ongoing self-reflection vs cultural competency (implies static mastery).'],
  'pe1-l1': ['Three germ layers: ectoderm (skin/CNS), mesoderm (muscle/bone/CV/kidney), endoderm (GI/respiratory).','Neural tube closes by week 4. Failure: anencephaly (anterior) or spina bifida (posterior).','Critical period weeks 3-8: highest teratogen risk. After: growth/function affected, not major structures.','HbF (alpha2-gamma2): higher O2 affinity than HbA (alpha2-beta2); less 2,3-DPG binding.'],
  'pe1-l2': ['Motor: head control 4 mo, sits 6 mo, stands 9 mo, walks 12 mo, runs 18 mo.','Language: coos 2 mo, babbles 6 mo, mama/dada 9 mo, first words 12 mo, 2-word phrases 24 mo.','Social: social smile 2 mo, stranger anxiety 6-9 mo, parallel play 2-3 yr, cooperative 3-4 yr.','Red flags: no babbling 12 mo, no single words 16 mo, no 2-word phrases 24 mo, any regression.'],
  'pe1-l3': ['Down (T21): simian crease, AV canal, Hirschsprung, hypothyroid, Alzheimer risk after 35.','Turner (45,X): short stature, webbed neck, coarctation of aorta, primary amenorrhea, normal IQ.','Klinefelter (47,XXY): tall, small testes, infertile (azoospermia), gynecomastia, high FSH/LH.','Non-disjunction: maternal age strongly increases trisomy risk.'],
  'pe2-l1': ['Innate: immediate, nonspecific, no memory. Neutrophils, macrophages, NK cells, complement.','MHC I (HLA-A,B,C): all nucleated cells → presents endogenous peptides to CD8+ T cells.','MHC II (HLA-DR,DP,DQ): APCs → presents exogenous peptides to CD4+ helper T cells.','B cell activation: 2 signals needed: BCR crosslinking + CD40L (T helper) binding CD40.'],
  'pe2-l2': ['Live-attenuated: MMR, varicella. Strongest immunity. Contraindicated: pregnant, immunocompromised.','Inactivated: influenza (injection), hep A, IPV. Safer, may need boosters.','Conjugate vaccines: polysaccharide + protein carrier → T-cell response. Hib, pneumococcal.','Herd immunity threshold = 1 - 1/R0. Measles R0 ~12-18, needs ~95% immunity.'],
  'pe2-l3': ['RSV: leading cause of infant hospitalization < 2 yr. Bronchiolitis. Treatment: supportive.','Kawasaki: fever ≥5 days + CRASH (Conjunctivitis, Rash, Adenopathy, Strawberry tongue, Hand/foot changes).','Croup: parainfluenza, barking cough, steeple sign on X-ray. Treat: racemic epi, dexamethasone.','Bacterial meningitis empiric: neonates = ampicillin+gentamicin. Children = ceftriaxone ± vancomycin.'],
  'pe3-l1': ['Sensorimotor (0-2): object permanence 8-12 months. Preoperational (2-7): egocentric, no conservation.','Concrete operational (7-11): conservation, reversibility, classification. Logic only for concrete.','Formal operational (12+): abstract reasoning, hypothetical-deductive thinking.','Key MCAT: conservation = distinguishing mark of concrete operational stage.'],
  'pe3-l2': ['Bowlby-Ainsworth Strange Situation: infant with caregiver, stranger enters, caregiver leaves, returns.','Secure (60-65%): distressed at separation, quickly soothed. Best developmental outcomes.','Anxious-ambivalent (10-15%): very distressed, difficult to soothe. Inconsistent parental availability.','Avoidant (20-25%): minimal distress, ignores caregiver at reunion. Emotionally unavailable parenting.'],
  'pe3-l3': ['Stage 1: Trust vs Mistrust (0-18 mo): consistent care → hope. Stage 2: Autonomy vs Shame.','Stage 3: Initiative vs Guilt (3-6 yr): exploration → purpose. Overly restricted → guilt.','Stage 5: Identity vs Role Confusion (12-18 yr): fidelity. Most tested on MCAT.','Stage 8: Integrity vs Despair (65+): reflection → wisdom. Regret → despair.'],
  'pe4-l1': ['Fat-soluble ADEK: stored, can accumulate to toxic levels (hypervitaminosis A: pseudotumor cerebri).','Vitamin A: retinal in rhodopsin, epithelial integrity. Deficiency: night blindness, xerophthalmia.','B1 (thiamine/TPP): PDH, alpha-KG dehydrogenase, transketolase. Deficiency: Wernicke-Korsakoff.','B12: requires intrinsic factor for ileal absorption. Deficiency: megaloblastic anemia + subacute combined degeneration.'],
  'pe4-l2': ['Exogenous pathway: dietary fat → chylomicrons → lymphatics → lipoprotein lipase → cells.','Endogenous: liver makes VLDL → LDL → peripheral tissues via LDLR. PCSK9 degrades LDLR.','HDL: reverse cholesterol transport. LDL: delivers cholesterol. High LDL = cardiovascular risk.','Abetalipoproteinemia: cannot make chylomicrons → fat-soluble vitamin deficiency, acanthocytes, ataxia.'],
  'pe4-l3': ['Urea cycle: starts/ends in mitochondria; middle steps in cytosol. NH3 + CO2 + 3 ATP → urea.','OTC deficiency (X-linked): most common urea cycle disorder. High NH3 + orotic acid, low citrulline.','Hyperammonemia: vomiting, lethargy, cerebral edema. Treat: protein restriction, lactulose, benzoate.','Glucogenic AAs (most) → glucose. Ketogenic AAs (Leu, Lys exclusively) → ketone bodies.'],
  'pe5-l1': ['Case-control: retrospective, cases vs controls, look back for exposures. Good for rare diseases → OR.','Cohort: prospective, exposed vs unexposed, follow for outcomes. Calculates RR and incidence.','RCT: gold standard for causation. Randomization controls known and unknown confounders.','Confounding variable: associated with both exposure and outcome but not on causal pathway.'],
  'pe5-l2': ['Sensitivity = TP/(TP+FN). Specificity = TN/(TN+FP). SnNout: high Sn rules out. SpPin: high Sp rules in.','PPV = TP/(TP+FP). Increases with prevalence. NPV = TN/(TN+FN). Increases with lower prevalence.','NNT = 1/ARR. Smaller NNT = more effective. LR+ = Sn/(1-Sp). LR- = (1-Sn)/Sp.','Normal distribution: 68-95-99.7 rule for 1-2-3 SD from mean.'],
  'pe5-l3': ['Belmont Report (1979): Respect for persons (autonomy), Beneficence (minimize harm), Justice (fair distribution).','Informed consent: disclosure, comprehension, voluntariness, decision-making capacity.','IRB: must review and approve all research involving human subjects before it begins.','Vulnerable populations (extra protections): children, prisoners, pregnant women, cognitively impaired.'],
  'ps1-l1': ['Resting membrane potential (-70 mV): maintained by Na+/K+ ATPase (3 Na+ out, 2 K+ in) + K+ leak channels.','AP: depolarization (-70 to +30 mV: Na+ in). Repolarization: K+ out. Hyperpolarization: brief dip below -70.','Saltatory conduction: AP jumps between nodes of Ranvier in myelinated axons. Much faster.','Absolute refractory: no AP possible. Relative refractory: possible with suprathreshold stimulus.'],
  'ps1-l2': ['Dopamine pathways: mesolimbic (reward), mesocortical (cognitive), nigrostriatal (movement), tuberoinfundibular (prolactin).','GABA-A: Cl- channel (benzos ↑ frequency; barbiturates ↑ duration). GABA-B: metabotropic.','Glutamate: AMPA (fast, Na+). NMDA: Ca2+ entry, requires depolarization (removes Mg2+) + glycine.','Second messengers: Gs → cAMP → PKA. Gq → PLC → IP3 (Ca2+) + DAG (PKC).'],
  'ps1-l3': ['Frontal lobe: motor cortex, Broca area (speech production), prefrontal (executive, working memory).','Temporal lobe: auditory cortex, Wernicke area (comprehension), hippocampus (memory), amygdala (fear).','Parietal lobe: somatosensory cortex, spatial processing. Gerstmann: acalculia, agraphia, finger agnosia.','Cerebellum: ipsilateral coordination. PAST: dysdiadochokinesia, ataxia, scanning speech, tremor (intention).'],
  'ps2-l1': ["Weber's Law: JND/stimulus = k (constant). Fechner: sensation = k * log(stimulus).","Signal detection theory: d-prime (sensitivity) independent of criterion (response bias).","Sleep stages: N1-N4 NREM + REM. Cycle ~90 min. REM increases; N3 decreases through night.","Absolute threshold: minimum stimulus for 50% detection. JND: smallest detectable change."],
  'ps2-l2': ['James-Lange: physiological arousal PRECEDES emotion. Cannon-Bard: arousal and emotion simultaneous.','Schachter-Singer: arousal + cognitive label = specific emotion. Misattribution possible.','Maslow: Physiological → Safety → Love → Esteem → Self-actualization. Deficiency vs growth needs.','HPA axis: CRH → ACTH → cortisol. Chronic stress: immunosuppression, hippocampal damage.'],
  'ps2-l3': ['DSM-5: must cause significant distress OR functional impairment. Removed multiaxial system.','MDD: SIG E CAPS for 2+ weeks. Bipolar I: one manic episode. Bipolar II: hypomania + depression.','Personality disorders: Cluster A (odd), B (dramatic: antisocial, borderline, histrionic, narcissistic), C (anxious).','Schizophrenia: positive (hallucinations, delusions) + negative (flat affect, alogia, avolition, anhedonia).'],
  'ps3-l1': ['Health gradient: even small SES differences correspond to measurable health outcome differences.','Social capital (Putnam): bonding (within group) and bridging (between groups) networks.','Relative deprivation: perceiving oneself as worse off than peers → psychological stress → real health effects.','SES affects health through multiple pathways: stress, behavior, access to resources, environmental exposures.'],
  'ps3-l2': ['Culture: learned, shared, symbolic, integrated, dynamic. Enculturation = learning own culture.','Acculturation strategies: assimilation, integration, separation, marginalization.','Race = social construct. Genetic variation within groups often exceeds variation between groups.','Structural racism: systemic policies creating racial inequity (redlining, unequal education). Affects health.'],
  'ps3-l3': ['Asch conformity: 75% of subjects conformed at least once when confederates gave wrong answers.','Milgram obedience: 65% gave maximum 450V shock when instructed by authority figure.','Bystander effect: more bystanders → less individual helping (diffusion of responsibility + pluralistic ignorance).','Social loafing: less individual effort in groups. Reduced when individual contributions are identifiable.'],
  'ps4-l1': ['SSRIs block SERT → more serotonin. First-line for depression and anxiety. 2-4 weeks for effect.','MAOIs: block MAO → ↑ 5-HT, NE, DA. Risk: tyramine crisis (aged cheese, cured meats → hypertensive emergency).','Typical antipsychotics: D2 blockade. EPS: acute dystonia (hours), akathisia (days), Parkinsonism (weeks), TD (months-years).','Clozapine: broadest spectrum (positive + negative + cognitive). Risk: agranulocytosis. Weekly CBC required.'],
  'ps4-l2': ['Benzodiazepines: GABA-A, increase FREQUENCY of Cl- channel opening. Short-acting (lorazepam) vs long-acting.','Barbiturates: increase DURATION of Cl- channel opening. Greater overdose risk (no ceiling).','Lithium: bipolar maintenance. Narrow TI (0.6-1.2 mEq/L). Toxicity: tremor, DI, hypothyroidism, teratogen.','Valproate: Na+ channel blocker + ↑ GABA. Used for bipolar, epilepsy. Monitor LFTs, CBC. Teratogen.'],
  'ps4-l3': ['LTP: NMDA activation (coincidence detector) → Ca2+ influx → CaMKII activation → AMPA insertion.','BDNF: promotes neuronal survival and synaptic plasticity. Reduced in depression. ↑ by exercise and antidepressants.','Adult neurogenesis: dentate gyrus and olfactory bulb. Stimulated by exercise; inhibited by stress, alcohol.','Memory consolidation: hippocampus → cortical storage. Sleep critical for consolidation.'],
  'ps5-l1': ['Operational definition: defines abstract concept in concrete, measurable terms. Essential for replication.','Validity: construct (measures what claims), internal (causal inferences), external (generalizable).','Reliability: test-retest (stable over time), inter-rater, internal consistency (Cronbach alpha).','Demand characteristics: participants change behavior based on guesses about study purpose.'],
  'ps5-l2': ['Mean (affected by outliers), median (resistant), mode (most frequent). SEM = SD/sqrt(n).','Variance = average squared deviation. SD = sqrt(variance). 95% CI = estimate ± 1.96*SEM.','Correlation (r): -1 to +1. r2 = proportion of variance explained. Correlation ≠ causation.','ANOVA: compares 3+ group means simultaneously. Post-hoc tests needed for pairwise comparisons.'],
  'ps5-l3': ['Tuskegee (1932-72): 399 Black men; penicillin withheld even after it became standard of care.','National Research Act (1974) → IRBs. Belmont Report (1979) → 3 principles.','Declaration of Helsinki: international research standards. Requires ethics committee, consent, risk-benefit.','Common Rule (45 CFR 46): US federal regulations for human subjects research.'],
  're1-l1': ['CpG island methylation silences genes (X-inactivation, imprinting). Acetylation opens chromatin.','H3K4me3 = active promoter. H3K27me3 = polycomb repression. H3K9me3 = constitutive heterochromatin.','miRNA: ~22 nt. Pri-miRNA → pre-miRNA (Drosha) → mature miRNA (Dicer) → RISC → silences mRNA.','Enhancers can be up to 1 Mbp away; interact with promoters via chromatin looping (CTCF, cohesin).'],
  're1-l2': ['Alpha-helix: H-bonds within single chain (i to i+4). Beta-sheet: H-bonds between adjacent strands.','Chaperonins (GroEL/GroES, CCT): barrel-like cavity for isolated protein folding, prevents aggregation.','Ubiquitin-proteasome: E1-E2-E3 ligase cascade → ubiquitin tags → 26S proteasome degradation.','Prion diseases: misfolded PrPsc recruits PrPc → CJD, vCJD, kuru, fatal familial insomnia.'],
  're1-l3': ['CRISPR-Cas9: Doudna and Charpentier, 2020 Nobel Prize. PAM sequence = NGG for SpCas9.','DSB repaired by NHEJ (error-prone, knockout) or HDR (precise, needs template).','Off-target effects: addressed by high-fidelity Cas9 variants, paired nickases, or base editors.','Base editors: CBE (C→T) and ABE (A→G) without DSB. Higher precision, fewer off-targets.'],
  're2-l1': ['Incidence rate: new cases/person-time. Prevalence = incidence × duration. Cross-sectional measures prevalence.','OR from 2x2: (a×d)/(b×c). RR from cohort: [a/(a+b)] / [c/(c+d)].','Attributable risk = incidence(exposed) - incidence(unexposed). AR% = AR/incidence(exposed) × 100.','Prevalence changes with incidence, duration, cure rate, and out-migration of cases.'],
  're2-l2': ['H0: no effect. Reject H0 if p < 0.05. Never "accept" null; only "fail to reject."','95% CI: range where true parameter lies 95% of the time. CI not crossing null = significant.','Statistical vs clinical significance: large n can detect trivially small, clinically unimportant differences.','Type I (alpha, false positive): rejecting true null. Type II (beta, false negative): failing to reject false null.'],
  're2-l3': ['I2 statistic: measures heterogeneity. I2 > 50% = substantial heterogeneity between studies.','Forest plot: squares = individual studies, diamond = pooled estimate, line = 95% CI.','Publication bias: positive results more likely published → funnel plot asymmetry.','Network meta-analysis: compares treatments never directly compared, through common comparators.'],
  're3-l1': ['NMR: ppm = deshielding. Deshielded = near electronegative atoms. TMS = reference (0 ppm).','Key IR: O-H (3200-3600, broad), C=O (1700-1750 ketone, 1735-1750 ester), N-H (3300-3500).','MS fragmentation: M+2 pattern: Cl (3:1), Br (1:1). Lose 15 (CH3), 43 (methyl ketone: CH3CO).','Beer-Lambert: A = epsilon*l*c. Absorbance proportional to concentration and path length.'],
  're3-l2': ['SDS-PAGE: separates by size (smaller migrates farther). Native PAGE: charge + size.','Western blot: SDS-PAGE → PVDF membrane → 1° antibody → 2° antibody (HRP) → chemiluminescence.','ELISA: sandwich uses capture + detection antibody + enzyme substrate. Highly sensitive and quantitative.','Flow cytometry: antibodies + fluorophores; FSC (size), SSC (granularity), fluorescence per cell.'],
  're3-l3': ['Zero-order: rate = k (independent of [A]). [A] decreases linearly. Alcohol metabolism, aspirin OD.','First-order: rate = k[A]. Constant half-life (t1/2 = 0.693/k). Most drug clearance.','Collision theory: molecules need sufficient energy (>Ea) AND proper orientation to react.','Hammond postulate: transition state resembles energy-adjacent species. Endothermic TS ≈ products.'],
  're4-l1': ['B cells need 2 signals: BCR crosslinking + CD40L (T helper) binding CD40. T-independent Ag: polysaccharides.','Germinal center: somatic hypermutation by AID → selection by FDC → plasma cells or memory B cells.','Class switching: DNA recombination replaces C-region (Fc changes, specificity stays). Requires AID.','Primary response: IgM (5-10 days, low). Secondary/memory: IgG, higher titer, faster (2-3 days).'],
  're4-l2': ['Gram-positive: thick peptidoglycan, teichoic acid, no outer membrane. Gram-negative: thin PG + LPS.','Cholera toxin: ADP-ribosylates Gs → constitutively active → cAMP → Cl- secretion → watery diarrhea.','Biofilm: extracellular matrix → highly resistant to antibiotics and immune defenses.','Antigenic variation: Borrelia (VlsE cassette), Trypanosoma (sequential VSG expression, >1000 variants).'],
  're4-l3': ['HIV: ssRNA × 2, reverse transcriptase, integrase, protease, gp41 (fusion) + gp120 (binding).','HIV: gp120 + CD4 + CCR5/CXCR4 → fusion → RT → integration → transcription → maturation.','Antivirals: NRTIs (chain terminators), NNRTIs (allosteric RT), PIs (prevent polyprotein cleavage), integrase inhibitors.','Lambda phage: cI repressor (lysogeny) vs Cro (lysis). UV → RecA → cI cleavage → switch to lytic.'],
  're5-l1': ['SN2: bimolecular, concerted, backside attack → Walden inversion. Methyl > primary > secondary. No tertiary.','SN2 disfavored by beta-branching. Polar aprotic (DMSO, DMF, acetone) solvents favor SN2.','SN1: two steps, carbocation intermediate, rate = k[substrate]. Tertiary > secondary > primary.','Polar protic (water, alcohols) favor SN1 by stabilizing carbocation intermediate.'],
  're5-l2': ['Nucleophilic acyl substitution reactivity: acid chlorides > anhydrides > esters > carboxylic acids > amides.','Grignard (RMgBr): strong nucleophile. Aldehyde → 2° alcohol. Ketone → 3° alcohol. CO2 → carboxylic acid.','Michael addition: nucleophile (donor) + alpha,beta-unsaturated carbonyl (acceptor) → 1,4-addition.','Acetals: hemiacetal + ROH + acid → acetal. Stable to base. Used as protecting groups.'],
  're5-l3': ['Fischer projection: horizontal = out of page (toward you); vertical = into page (away from you).','R/S: rank by atomic number. Clockwise = R. 2^n maximum stereoisomers (n = stereocenters).','Meso compound: stereocenters present but internal mirror plane makes it achiral (optically inactive).','Enantiomers: identical physical properties in achiral environment. Need chiral column to separate.'],
};

/* ═══════════════════════════════════════════════════════════════
   QUESTION BANK — 12 template questions × 800 instances
   Each has cat, text, choices, ans (index), exp
═══════════════════════════════════════════════════════════════ */
const Q_TEMPLATES = [
  { cat: 'Chem/Phys',  hint: 'Q is proportional to r to the 4th power times delta P.',
    text: 'A fluid flows through a tube. The pressure gradient is tripled and the radius is halved. The new flow rate compared to original is:',
    choices: ['3/16 of the original', '3/8 of the original', '3/4 of the original', '6 times the original'], ans: 0,
    exp: "Poiseuille: Q = pi*r4*deltaP/(8*eta*L). New Q = Q0 × 3 × (1/2)^4 = 3/16 Q0." },
  { cat: 'Bio/Biochem', hint: 'Competitive inhibitors compete with substrate for the active site.',
    text: 'A competitive inhibitor is added to an enzyme-substrate reaction. What happens to Km and Vmax?',
    choices: ['Km increases; Vmax unchanged', 'Vmax decreases; Km unchanged', 'Both Km and Vmax increase', 'Neither changes'], ans: 0,
    exp: 'Competitive inhibitors raise apparent Km (excess substrate overcomes inhibition) but leave Vmax unchanged.' },
  { cat: 'Bio/Biochem', hint: 'The myosin head is cocked by ATP hydrolysis before the power stroke.',
    text: "Which molecule is DIRECTLY consumed during myosin's power stroke?",
    choices: ['ATP', 'NADH', 'Creatine phosphate', 'GTP'], ans: 0,
    exp: 'Myosin ATPase hydrolyzes ATP directly to power the conformational change. Creatine phosphate regenerates ATP but is not directly used.' },
  { cat: 'Chem/Phys',  hint: "Snell's law: n1*sin(theta1) = n2*sin(theta2).",
    text: 'Light travels from water (n=1.33) into denser glass (n=1.50) at 45 degrees. The refracted ray:',
    choices: ['Bends toward the normal (angle < 45°)', 'Bends away from the normal (angle > 45°)', 'Passes straight through', 'Undergoes total internal reflection'], ans: 0,
    exp: "Snell's law: n2 > n1 → sin(theta2) < sin(theta1) → angle decreases → bends toward normal." },
  { cat: 'Psych/Soc',  hint: 'More bystanders means each individual feels less personally responsible.',
    text: 'Bystanders at an emergency see others not responding and also refrain from helping. Best explanation:',
    choices: ['Diffusion of responsibility', 'Fundamental attribution error', 'In-group bias', 'Cognitive dissonance'], ans: 0,
    exp: 'Bystander effect (Darley & Latané, 1968): each person feels less responsible when others are present.' },
  { cat: 'Bio/Biochem', hint: 'No allolactose present means the lac repressor can bind the operator.',
    text: 'In the presence of glucose and absence of lactose, the E. coli lac operon is:',
    choices: ['Repressed — lac repressor bound to operator', 'Active — CAP-cAMP activates transcription', 'Partially active due to allolactose', 'Fully transcribed due to high cAMP'], ans: 0,
    exp: 'No allolactose → lac repressor is not displaced → binds operator → operon is repressed.' },
  { cat: 'Chem/Phys',  hint: 'Nernst: E = Eo - (RT/nF)lnQ. Increasing the cathode species decreases Q.',
    text: "A galvanic cell's cathode ion concentration is increased tenfold. Cell potential will:",
    choices: ['Increase — Q decreases, E rises', 'Decrease — Q increases, E falls', 'Stay the same', 'Drop to zero'], ans: 0,
    exp: 'Nernst: E = Eo - (RT/nF)lnQ. More cathode oxidant → lower Q → higher E_cell.' },
  { cat: 'Psych/Soc',  hint: 'A third variable (season) drives both observations independently.',
    text: 'Ice cream sales and drowning deaths both peak in summer. This best describes:',
    choices: ['Spurious correlation due to confound (season/heat)', 'Direct causation', 'Reverse causation', 'Sampling bias'], ans: 0,
    exp: 'Confounding variable (summer heat) independently drives both. Classic example of correlation ≠ causation.' },
  { cat: 'Bio/Biochem', hint: 'PDH requires TPP, lipoate, CoA, FAD, and NAD+. Biotin is for carboxylation.',
    text: 'Pyruvate is converted to acetyl-CoA by PDH. Which cofactor is NOT required by PDH?',
    choices: ['Biotin', 'TPP (thiamine pyrophosphate)', 'CoA', 'NAD+'], ans: 0,
    exp: 'Biotin is the cofactor for carboxylation reactions (pyruvate carboxylase), not PDH. PDH requires TPP, lipoate, CoA, FAD, NAD+.' },
  { cat: 'Chem/Phys',  hint: 'deltaG = deltaH - T*deltaS. Calculate and check the sign.',
    text: 'A reaction: deltaH = +50 kJ and deltaS = +200 J/K. At 400 K, the reaction is:',
    choices: ['Spontaneous (deltaG < 0)', 'Non-spontaneous (deltaG > 0)', 'At equilibrium', 'Cannot be determined'], ans: 0,
    exp: 'deltaG = 50,000 - 400*200 = -30,000 J. deltaG < 0 → spontaneous at 400 K.' },
  { cat: 'Bio/Biochem', hint: 'Competitive inhibition: same Vmax (y-intercept) but different Km (x-intercept).',
    text: 'Which Lineweaver-Burk finding correctly indicates competitive inhibition?',
    choices: ['Lines intersect on y-axis (same Vmax, higher Km)', 'Lines intersect on x-axis (same Km, lower Vmax)', 'Parallel lines', 'Lines intersect at origin'], ans: 0,
    exp: 'Competitive: Vmax unchanged (same y-intercept = 1/Vmax), Km increases (x-intercept shifts left). Lines cross on y-axis.' },
  { cat: 'Psych/Soc',  hint: 'Conservation involves understanding that quantity stays the same despite shape change.',
    text: "Which cognitive ability first appears in Piaget's concrete operational stage?",
    choices: ['Conservation of volume and number', 'Object permanence', 'Hypothetical-deductive reasoning', 'Symbolic play'], ans: 0,
    exp: 'Conservation (understanding quantity unchanged despite appearance) develops in concrete operational (7-11 yr).' },
];

const Q_BANK = [];
for (let i = 0; i < 800; i++) Q_BANK.push({ ...Q_TEMPLATES[i % Q_TEMPLATES.length], uid: `q${i}` });

function buildCategoryQuiz(cat, n = 8) {
  const pool = cat === 'All' ? Q_BANK : Q_BANK.filter(q => q.cat === cat);
  return [...pool].sort(() => Math.random() - 0.5).slice(0, n);
}

/* ═══════════════════════════════════════════════════════════════
   SUPPORT DATA
═══════════════════════════════════════════════════════════════ */
const OPPORTUNITIES = [
  { id: 'usabo',       name: 'USABO – USA Biology Olympiad',      type: 'Competition', deadline: 'January',  diff: 'Elite',       desc: 'National biology competition for high school students.',          url: 'https://www.usabo-trc.org/' },
  { id: 'nih_sip',    name: 'NIH Summer Internship Program',      type: 'Research',    deadline: 'February', diff: 'Competitive', desc: '8-week paid research at NIH Bethesda campus.',                  url: 'https://www.training.nih.gov/programs/sip' },
  { id: 'simons',     name: 'Simons Summer Research Program',     type: 'Research',    deadline: 'January',  diff: 'Competitive', desc: '7-week research at Stony Brook with $3,000 stipend.',           url: 'https://www.simonsfoundation.org/' },
  { id: 'hosa',       name: 'HOSA Future Health Professionals',   type: 'Competition', deadline: 'Varies',   diff: 'Open',        desc: 'Compete in 60+ healthcare categories.',                        url: 'https://hosa.org/' },
  { id: 'amsa',       name: 'AMSA Premed Scholarship',            type: 'Scholarship', deadline: 'May',      diff: 'Competitive', desc: 'American Medical Student Association annual awards.',           url: 'https://www.amsa.org/' },
  { id: 'rsna',       name: 'RSNA Medical Student Symposium',     type: 'Conference',  deadline: 'October',  diff: 'Open',        desc: 'Annual radiology conference, free student registration.',       url: 'https://www.rsna.org/' },
  { id: 'shadowing',  name: 'Clinical Shadowing (100+ hrs)',       type: 'Clinical',    deadline: 'Ongoing',  diff: 'Open',        desc: 'Shadow physicians in your target specialty.',                  url: '#' },
  { id: 'volunteer',  name: 'Hospital / Free Clinic Volunteering', type: 'Volunteering',deadline: 'Ongoing',  diff: 'Open',        desc: 'Direct patient contact. Shows service orientation.',           url: '#' },
];

const ELIB = [
  { cat: 'Bio/Biochem', title: 'Khan Academy – Biomolecules',            url: 'https://www.khanacademy.org/test-prep/mcat/biomolecules',         type: 'Video Series',   free: true, desc: 'Complete coverage of proteins, enzymes, metabolism, cell biology.' },
  { cat: 'Bio/Biochem', title: 'Khan Academy – Organ Systems',            url: 'https://www.khanacademy.org/test-prep/mcat/organ-systems',        type: 'Video Series',   free: true, desc: 'Cardiovascular, respiratory, renal, immune, endocrine systems.' },
  { cat: 'Bio/Biochem', title: 'Crash Course Biology',                    url: 'https://www.youtube.com/playlist?list=PL3EED4C1D684D3ADF',       type: 'YouTube',        free: true, desc: 'Fast-paced visual biology covering all MCAT Bio content.' },
  { cat: 'Chem/Phys',   title: 'Khan Academy – Physical Processes',       url: 'https://www.khanacademy.org/test-prep/mcat/physical-processes',   type: 'Video Series',   free: true, desc: 'Physics and general chemistry for the MCAT.' },
  { cat: 'Chem/Phys',   title: 'Professor Dave – Organic Chemistry',      url: 'https://www.youtube.com/@ProfessorDaveExplains',                  type: 'YouTube',        free: true, desc: 'Clear, detailed organic chemistry mechanism walkthroughs.' },
  { cat: 'Chem/Phys',   title: 'The Organic Chemistry Tutor',             url: 'https://www.youtube.com/@TheOrganicChemistryTutor',               type: 'YouTube',        free: true, desc: 'Massive library of worked chemistry problems for the MCAT.' },
  { cat: 'Psych/Soc',   title: 'Khan Academy – Psychological Sciences',   url: 'https://www.khanacademy.org/test-prep/mcat/social-sciences',      type: 'Video Series',   free: true, desc: 'All MCAT Psych/Soc topics covered systematically.' },
  { cat: 'Psych/Soc',   title: 'Crash Course Psychology',                 url: 'https://www.youtube.com/playlist?list=PL8dPuuaLjXtOPRKzVLY0jT3gy-7NFgCnz', type: 'YouTube', free: true, desc: 'Comprehensive psychology series from Hank Green.' },
  { cat: 'All',         title: 'Anki MCAT Decks (Top-Rated)',              url: 'https://www.ankiweb.net/',                                        type: 'Flashcards',     free: true, desc: 'Community MCAT decks for spaced-repetition review.' },
  { cat: 'All',         title: 'AAMC Official Full-Length Practice Exams', url: 'https://www.aamc.org/students/applying/mcat/preparing/',          type: 'Practice Exams', free: false,desc: 'The gold standard — most predictive of actual MCAT score.' },
];

const MMI_QS = [
  { q: "A patient refuses a life-saving blood transfusion on religious grounds. They are conscious and competent. What do you do?", type: 'Ethics' },
  { q: 'Tell me about a significant failure or setback. What did you learn?', type: 'Personal' },
  { q: 'How would you address healthcare disparities in underserved communities?', type: 'Policy' },
  { q: 'A colleague appears impaired during a hospital shift. How do you handle this?', type: 'Professionalism' },
  { q: 'Why do you want to be a physician rather than a nurse practitioner or PA?', type: 'Motivation' },
  { q: 'Describe a time you advocated for someone. What was the outcome?', type: 'Leadership' },
  { q: 'How would you care for a patient who distrusts Western medicine?', type: 'Cultural Competency' },
  { q: 'What does it mean to be a good doctor in 2025?', type: 'Reflection' },
  { q: "A 17-year-old asks you not to share her diagnosis with her parents. What do you do?", type: 'Ethics' },
  { q: 'Describe your greatest non-academic achievement and its impact on others.', type: 'Personal' },
  { q: 'Healthcare costs in the US are highest in the world but outcomes lag. What is the root cause?', type: 'Healthcare Systems' },
  { q: 'A patient with terminal cancer asks what you would do in their situation. How do you respond?', type: 'End-of-Life' },
];

const SCHOOL_DATA = [
  { name: 'Johns Hopkins',           avgGPA: 3.94, avgMCAT: 523, acceptRate: 6 },
  { name: 'Harvard Medical',         avgGPA: 3.93, avgMCAT: 522, acceptRate: 3 },
  { name: 'Stanford Medicine',       avgGPA: 3.82, avgMCAT: 520, acceptRate: 2 },
  { name: 'Mayo Clinic School',      avgGPA: 3.91, avgMCAT: 520, acceptRate: 2 },
  { name: 'Penn (Perelman)',          avgGPA: 3.90, avgMCAT: 522, acceptRate: 4 },
  { name: 'Columbia (VP&S)',          avgGPA: 3.86, avgMCAT: 522, acceptRate: 4 },
  { name: 'Duke School of Medicine', avgGPA: 3.84, avgMCAT: 521, acceptRate: 4 },
  { name: 'Vanderbilt Medical',      avgGPA: 3.86, avgMCAT: 521, acceptRate: 5 },
  { name: 'UCSF Medicine',           avgGPA: 3.82, avgMCAT: 517, acceptRate: 3 },
  { name: 'UT Southwestern',         avgGPA: 3.89, avgMCAT: 519, acceptRate: 7 },
  { name: 'Michigan Medicine',       avgGPA: 3.86, avgMCAT: 517, acceptRate: 7 },
  { name: 'Emory School of Medicine',avgGPA: 3.75, avgMCAT: 516, acceptRate: 8 },
  { name: 'Boston University Medicine',avgGPA: 3.71, avgMCAT: 515, acceptRate: 4 },
  { name: 'Georgetown Medicine',     avgGPA: 3.63, avgMCAT: 511, acceptRate: 4 },
  { name: 'Temple (Katz)',           avgGPA: 3.58, avgMCAT: 511, acceptRate: 7 },
];


/* ═══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
═══════════════════════════════════════════════════════════════ */

/* MasteryDot — 5-level ○ ◔ ◐ ● ★ */
const MasteryDot = memo(({ level = 0, size = 22, animate = false, pulse = false }) => {
  const m = MASTERY[Math.min(Math.max(level, 0), 4)];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold flex-shrink-0 transition-all duration-300 ${animate ? 'level-up' : ''} ${pulse ? 'mastery-pulse' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.52, background: m.bg, border: `1.5px solid ${m.border}`, color: m.color }}
      title={`${m.label} (${m.points}/100 pts)`}
    >
      {m.dot}
    </span>
  );
});
MasteryDot.displayName = 'MasteryDot';

/* CircularProgress — SVG ring */
const CircularProgress = memo(({ pct = 0, accent = '#3b82f6', size = 72, showLabel = true }) => {
  const stroke   = size < 50 ? 4.5 : size < 65 ? 5.5 : 7;
  const r        = (size - stroke * 2) / 2;
  const circ     = 2 * Math.PI * r;
  const clamped  = Math.min(Math.max(pct, 0), 100);
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={clamped >= 100 ? '#10b981' : accent}
          strokeWidth={stroke} strokeDasharray={`${(clamped/100)*circ} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.75s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-black leading-none" style={{ color: clamped >= 100 ? '#10b981' : 'rgba(255,255,255,0.85)', fontSize: size * 0.22 }}>
            {clamped}%
          </span>
        </div>
      )}
    </div>
  );
});
CircularProgress.displayName = 'CircularProgress';

/* MasteryProgress — 5-level bar */
const MasteryProgress = memo(({ level, pts }) => {
  const m      = MASTERY[Math.min(Math.max(level, 0), 4)];
  const next   = MASTERY[Math.min(level + 1, 4)];
  const thresholds = [0, 10, 50, 80, 100];
  const lo     = thresholds[Math.min(level, 4)];
  const hi     = thresholds[Math.min(level + 1, 4)];
  const barPct = level >= 4 ? 100 : Math.min(100, Math.round(((pts - lo) / (hi - lo)) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <MasteryDot level={level} size={15} />
          <span style={{ color: m.color }} className="font-bold">{m.label}</span>
          <span className="text-gray-600">· {pts}/100 pts</span>
        </div>
        {level < 4 && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-600">→</span>
            <MasteryDot level={level + 1} size={15} />
            <span style={{ color: next.color }} className="font-bold">{next.label}</span>
          </div>
        )}
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full prog-fill" style={{ width: `${barPct}%`, background: m.color }} />
      </div>
      {level < 4 && (
        <p className="text-[10px] text-gray-600">
          {level === 2 ? '100% score needed to reach Proficient.' :
           level === 3 ? '100% on a Unit Test / Course Challenge / Mastery Challenge to reach Mastered.' :
           `Score ≥70% to reach ${next.label}.`}
        </p>
      )}
    </div>
  );
});
MasteryProgress.displayName = 'MasteryProgress';

/* Badge — single badge card */
const BadgeCard = memo(({ badge, earned = false, small = false }) => {
  const tier = BADGE_TIERS[badge.tier];
  return (
    <div className={`relative flex ${small ? 'flex-row items-center gap-2 p-2' : 'flex-col items-center gap-2 p-4'} rounded-2xl border transition-all ${earned ? 'border-white/20' : 'border-white/5 opacity-40 grayscale'}`}
      style={earned ? { background: `${tier.glow}`, boxShadow: tier.shadow } : { background: 'rgba(255,255,255,0.03)' }}>
      <div className={`${small ? 'text-2xl' : 'text-3xl'} leading-none`}>{badge.icon}</div>
      <div className={small ? 'min-w-0' : 'text-center'}>
        {earned && <div className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: tier.color }}>{tier.label}</div>}
        <p className={`font-bold leading-tight ${small ? 'text-xs' : 'text-sm'}`}>{badge.name}</p>
        {!small && <p className="text-[10px] text-gray-500 mt-0.5">{badge.desc}</p>}
      </div>
    </div>
  );
});
BadgeCard.displayName = 'BadgeCard';

/* Badge notification toast */
const BadgeToast = memo(({ badge, onDismiss }) => {
  const tier = BADGE_TIERS[badge.tier];
  useEffect(() => { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce-in">
      <div className="flex items-center gap-3 p-4 rounded-2xl border" style={{ background: '#090d1a', borderColor: tier.color + '60', boxShadow: tier.shadow, minWidth: 240 }}>
        <div className="text-3xl">{badge.icon}</div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: tier.color }}>Badge Unlocked · {tier.label}</p>
          <p className="font-bold text-sm text-white">{badge.name}</p>
          <p className="text-[11px] text-gray-400">{badge.desc}</p>
        </div>
        <button onClick={onDismiss} className="ml-2 text-gray-600 hover:text-white text-xs">✕</button>
      </div>
    </div>
  );
});
BadgeToast.displayName = 'BadgeToast';

/* Post-session skill change summary card */
const SessionSummaryCard = memo(({ changes, xpEarned, newBadges, onContinue, sessionScore, sessionTotal }) => {
  const pct = sessionTotal > 0 ? Math.round((sessionScore / sessionTotal) * 100) : 0;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-[#090d1a] border border-white/10 rounded-[28px] p-7 max-w-md w-full shadow-2xl slide-in">
        <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Session Complete</p>
        <div className="flex items-center gap-3 mb-5">
          <p className="text-5xl font-black" style={{ color: pct === 100 ? '#10b981' : pct >= 70 ? '#3b82f6' : '#f59e0b' }}>
            {sessionScore}/{sessionTotal}
          </p>
          <div>
            <p className="text-sm text-gray-400">{pct}% correct</p>
            <p className="text-sm font-bold text-emerald-400">+{xpEarned} XP</p>
          </div>
        </div>

        {/* Skill level changes — KA-style */}
        {changes.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Skill Changes</p>
            <div className="space-y-2">
              {changes.map((c, i) => {
                const from = MASTERY[c.from];
                const to   = MASTERY[c.to];
                const direction = c.to > c.from ? 'up' : c.to < c.from ? 'down' : 'same';
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <MasteryDot level={c.from} size={18} />
                      <span className="text-[10px] text-gray-500 flex-shrink-0">→</span>
                      <MasteryDot level={c.to} size={18} animate={direction === 'up'} />
                      <span className="text-xs text-gray-300 ml-1 truncate">{c.lessonTitle}</span>
                    </div>
                    <span className={`text-[10px] font-black flex-shrink-0 ${direction === 'up' ? 'text-emerald-400' : direction === 'down' ? 'text-red-400' : 'text-gray-500'}`}>
                      {direction === 'up' ? '↑ Level Up!' : direction === 'down' ? '↓ Demoted' : '— Unchanged'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* New badges */}
        {newBadges.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Badges Earned</p>
            <div className="flex flex-wrap gap-2">
              {newBadges.map(b => <BadgeCard key={b.id} badge={b} earned small />)}
            </div>
          </div>
        )}

        <button onClick={onContinue} className="w-full py-3.5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 transition">
          Continue →
        </button>
      </div>
    </div>
  );
});
SessionSummaryCard.displayName = 'SessionSummaryCard';

/* PortfolioAdder */
function PortfolioAdder({ onAdd }) {
  const [title, setTitle] = useState('');
  const [type,  setType]  = useState('Research');
  const [date,  setDate]  = useState('');
  const types = ['Research', 'Clinical', 'Volunteering', 'Competition', 'Scholarship', 'Conference', 'Leadership', 'Other'];
  const submit = () => { if (!title.trim()) return; onAdd({ title, type, date: date || 'Ongoing' }); setTitle(''); setDate(''); };
  return (
    <div className="bg-white/5 border border-dashed border-white/20 rounded-2xl p-4">
      <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-widest">Add Activity</p>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Activity name..."
        className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500/40 text-gray-200 placeholder:text-gray-700 mb-2" />
      <div className="flex gap-2 mb-3">
        <select value={type} onChange={e => setType(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-400 outline-none">
          {types.map(t => <option key={t}>{t}</option>)}
        </select>
        <input type="month" value={date} onChange={e => setDate(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-400 outline-none" />
      </div>
      <button onClick={submit} className="w-full py-2 bg-white/10 rounded-xl text-xs font-bold hover:bg-white/20 transition">+ Add to Timeline</button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   QUIZ ENGINE — shared for unit tests, quiz library, course challenge
   Shows skill-level demotion/promotion on completion.
═══════════════════════════════════════════════════════════════ */
const QuizEngine = memo(({ questions, onFinish, title, onBack, accentColor = '#3b82f6' }) => {
  const [qi,        setQi]   = useState(0);
  const [sel,       setSel]  = useState(null);
  const [confirmed, setConf] = useState(false);
  const [score,     setScore] = useState(0);
  const [showHint,  setShowHint] = useState(false);
  const LETTERS = ['A','B','C','D'];
  const q = questions[qi];
  if (!q) return null;

  const handleConfirm = useCallback(() => {
    if (sel === null) return;
    setConf(true);
    if (sel === q.ans) setScore(s => s + 1);
  }, [sel, q]);

  const handleNext = useCallback(() => {
    const newScore = score; // score already updated by handleConfirm
    if (qi + 1 >= questions.length) { onFinish(newScore, questions.length); }
    else { setQi(i => i + 1); setSel(null); setConf(false); setShowHint(false); }
  }, [qi, score, sel, q, questions.length, onFinish]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        {onBack && <button onClick={onBack} className="text-gray-500 hover:text-white text-sm transition flex-shrink-0">← Back</button>}
        {title  && <p className="text-xs font-bold uppercase tracking-widest flex-1 text-center" style={{ color: accentColor }}>{title}</p>}
        <span className="text-xs text-gray-500 flex-shrink-0">{qi + 1} / {questions.length}</span>
      </div>

      <div className="w-full bg-white/5 rounded-full h-1.5 mb-6">
        <div className="h-1.5 rounded-full prog-fill" style={{ width: `${(qi / questions.length) * 100}%`, background: accentColor }} />
      </div>

      <div className="bg-white/5 border border-white/10 rounded-[24px] p-8">
        <div className="flex justify-between items-center mb-5">
          <span className="text-xs text-gray-500">Question {qi + 1} of {questions.length}</span>
          <span className="text-xs font-bold px-3 py-1 rounded-full border" style={{ color: accentColor, background: `${accentColor}15`, borderColor: `${accentColor}30` }}>{q.cat}</span>
        </div>

        <h2 className="text-xl font-bold text-white mb-6 leading-snug"><MixedText t={q.text} /></h2>

        {/* Hint panel */}
        {!confirmed && q.hint && (
          <div className="mb-4">
            {showHint ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
                <span className="text-sm flex-shrink-0">💡</span>
                <p className="text-xs text-amber-200/80">{q.hint}</p>
              </div>
            ) : (
              <button onClick={() => setShowHint(true)} className="text-xs text-amber-500/60 hover:text-amber-400 transition">💡 Show Hint (reduces XP earned)</button>
            )}
          </div>
        )}

        <div className="grid gap-3 mb-8">
          {q.choices.map((c, i) => {
            let cls = 'flex items-start gap-4 p-4 rounded-2xl border text-left transition-all duration-150 w-full ';
            if (confirmed) {
              cls += i === q.ans ? 'bg-emerald-500/10 border-emerald-400/50 text-emerald-200 cursor-default' :
                     i === sel   ? 'bg-red-500/10 border-red-400/50 text-red-300 cursor-default' :
                                   'bg-transparent border-white/5 text-gray-600 cursor-default';
            } else {
              cls += sel === i ? 'bg-blue-600/20 border-blue-500 text-white cursor-pointer' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/25 cursor-pointer';
            }
            const lBg = confirmed && i === q.ans ? 'bg-emerald-500 text-white' :
                        confirmed && i === sel   ? 'bg-red-500 text-white' :
                        sel === i && !confirmed  ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400';
            return (
              <button key={i} disabled={confirmed} onClick={() => setSel(i)} className={cls}>
                <span className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black mt-0.5 transition-colors ${lBg}`}>
                  {confirmed && i === q.ans ? '✓' : confirmed && i === sel ? '✗' : LETTERS[i]}
                </span>
                <span className="text-sm leading-relaxed"><MixedText t={c} /></span>
              </button>
            );
          })}
        </div>

        {confirmed && (
          <div className="slide-in p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl mb-6">
            <p className="text-xs font-bold text-emerald-400 mb-2">Explanation</p>
            <p className="text-sm text-gray-300 leading-relaxed"><MixedText t={q.exp} /></p>
          </div>
        )}

        {!confirmed
          ? <button onClick={handleConfirm} disabled={sel === null}
              className="w-full py-4 bg-white text-black font-black rounded-xl hover:bg-blue-50 transition disabled:opacity-30 disabled:cursor-not-allowed">
              Confirm Answer
            </button>
          : <button onClick={handleNext}
              className="w-full py-4 text-white font-black rounded-xl hover:opacity-80 transition"
              style={{ background: accentColor }}>
              {qi + 1 >= questions.length ? 'See Results →' : 'Next Question →'}
            </button>
        }
      </div>
    </div>
  );
});
QuizEngine.displayName = 'QuizEngine';

/* ═══════════════════════════════════════════════════════════════
   LESSON PRACTICE COMPONENT
   Full KA mechanics:
   - 5 questions per session
   - computeNewLevel() for authentic promotion/demotion
   - hint system (costs 5 XP)
   - Shows detailed level change on finish
   - lastPracticed timestamp for spaced-rep
═══════════════════════════════════════════════════════════════ */
const LessonPractice = memo(({
  lesson, unit, currentLevel, currentPts,
  onFinish, onBack, accentColor = '#8b5cf6'
}) => {
  const [qi,         setQi]        = useState(0);
  const [sel,        setSel]       = useState(null);
  const [confirmed,  setConf]      = useState(false);
  const [correct,    setCorr]      = useState(0);
  const [showHint,   setShowHint]  = useState(false);
  const [hintUsed,   setHintUsed]  = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const LETTERS = ['A','B','C','D'];

  // Build 5 questions filtered by this unit's category
  const questions = useRef((() => {
    const pool = Q_BANK.filter(q => q.cat === unit.cat);
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
  })()).current;

  const q = questions[qi];
  if (!q) return null;

  const handleConfirm = useCallback(() => {
    if (sel === null) return;
    setConf(true);
    if (sel === q.ans) setCorr(c => c + 1);
  }, [sel, q]);

  const handleNext = useCallback(() => {
    const newCorrect = correct; // correct already updated by handleConfirm
    if (qi + 1 >= questions.length) {
      setSessionCorrect(newCorrect);
      setShowResult(true);
    } else {
      setQi(i => i + 1);
      setSel(null);
      setConf(false);
      setShowHint(false);
      // Note: anyHintUsed (renamed from hintUsed) stays true once set
    }
  }, [qi, correct, sel, q, questions.length]);

  if (showResult) {
    const total      = questions.length;
    const score      = sessionCorrect;
    const pct        = total > 0 ? (score / total) * 100 : 0;
    // Compute new level using authentic KA rules (not a Unit Test)
    const newLevel   = computeNewLevel(currentLevel, score, total, false);
    const newPts     = MASTERY[newLevel].points;
    const leveledUp  = newLevel > currentLevel;
    const demoted    = newLevel < currentLevel;
    const xpEarned   = hintUsed ? score * 15 : score * 20;
    const m          = MASTERY[newLevel];
    const perfPct    = Math.round(pct);

    return (
      <div className="max-w-2xl mx-auto slide-in">
        <div className="bg-white/5 border border-white/10 rounded-[24px] p-8 text-center">
          {/* Score */}
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Practice Complete</p>
          <p className="text-6xl font-black mb-1" style={{ color: perfPct === 100 ? '#10b981' : perfPct >= 70 ? '#3b82f6' : '#f59e0b' }}>
            {score}/{total}
          </p>
          <p className="text-gray-500 text-sm mb-6">{perfPct}% correct this session</p>

          {/* Level change — prominent */}
          <div className="mb-6 p-5 rounded-2xl border" style={{ background: m.bg, borderColor: m.border }}>
            {leveledUp ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <MasteryDot level={currentLevel} size={28} />
                    <p className="text-[9px] text-gray-500 mt-1">{MASTERY[currentLevel].label}</p>
                  </div>
                  <span className="text-2xl text-gray-500">→</span>
                  <div className="text-center">
                    <MasteryDot level={newLevel} size={32} animate />
                    <p className="text-[9px] font-bold mt-1" style={{ color: m.color }}>{m.label}</p>
                  </div>
                </div>
                <p className="text-lg font-black" style={{ color: m.color }}>
                  Level Up! You reached {m.label} {m.dot}
                </p>
              </div>
            ) : demoted ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-3">
                  <MasteryDot level={currentLevel} size={28} />
                  <span className="text-xl text-red-400">→</span>
                  <MasteryDot level={newLevel} size={28} />
                </div>
                <p className="text-sm font-bold text-red-400">Skill demoted — review this lesson and try again.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <MasteryDot level={newLevel} size={32} />
                <p className="font-bold text-sm" style={{ color: m.color }}>{m.label} — keep practicing!</p>
                {newLevel < 3 && <p className="text-xs text-gray-500">Need 100% to advance. Keep going!</p>}
                {newLevel === 3 && <p className="text-xs text-blue-400">100% on a Unit Test to reach Mastered.</p>}
              </div>
            )}
          </div>

          {/* Mastery points bar */}
          <div className="mb-6 text-left">
            <MasteryProgress level={newLevel} pts={newPts} />
          </div>

          {/* KA-style rule reminder */}
          {newLevel === 3 && !leveledUp && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 text-left">
              <strong>To reach Mastered:</strong> Score 100% on a Unit Test, Course Challenge, or Mastery Challenge.
            </div>
          )}
          {newLevel === 4 && !leveledUp && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 text-left">
              <strong>Mastered skills can be demoted</strong> if you score below 70% in practice sessions. Keep reviewing!
            </div>
          )}

          {/* XP earned */}
          <p className="text-sm text-emerald-400 font-bold mb-6">
            +{xpEarned} XP earned{hintUsed ? ' (hint penalty applied)' : ''}
          </p>

          <div className="flex gap-3">
            <button onClick={onBack} className="flex-1 py-3 bg-white/10 border border-white/10 rounded-xl font-bold hover:bg-white/20 transition text-sm">
              Back to Lesson
            </button>
            <button onClick={() => onFinish(score, total, newLevel, newPts, xpEarned, hintUsed)}
              className="flex-1 py-3 text-white font-black rounded-xl hover:opacity-80 transition"
              style={{ background: accentColor }}>
              Continue →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={onBack} className="text-gray-500 hover:text-white text-sm transition flex-shrink-0">← Back</button>
        <p className="text-xs font-bold uppercase tracking-widest flex-1 text-center" style={{ color: accentColor }}>
          Practice — {lesson.title}
        </p>
        <span className="text-xs text-gray-500 flex-shrink-0">{qi + 1} / {questions.length}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-white/5 rounded-full h-1.5 mb-4">
        <div className="h-1.5 rounded-full prog-fill" style={{ width: `${(qi / questions.length) * 100}%`, background: accentColor }} />
      </div>

      {/* Mini score tracker */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <MasteryDot level={currentLevel} size={18} />
          <span className="text-xs text-gray-500">Current: {MASTERY[currentLevel].label}</span>
        </div>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <span key={i} className={`w-2 h-2 rounded-full transition-colors ${i < qi ? 'bg-gray-500' : i === qi ? 'rounded-sm' : 'bg-white/10'}`}
              style={i === qi ? { background: accentColor, width: 8, height: 8 } : {}} />
          ))}
        </div>
        <p className="text-xs text-gray-500">{correct}/{qi} correct</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-[24px] p-8">
        <div className="flex justify-between items-center mb-5">
          <span className="text-xs text-gray-500">Question {qi + 1} of {questions.length}</span>
          <span className="text-xs font-bold px-3 py-1 rounded-full border" style={{ color: accentColor, background: `${accentColor}15`, borderColor: `${accentColor}30` }}>{q.cat}</span>
        </div>

        <h2 className="text-xl font-bold text-white mb-6 leading-snug">{q.text}</h2>

        {/* Hint toggle */}
        {!confirmed && q.hint && (
          <div className="mb-4">
            {showHint ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
                <span className="text-sm flex-shrink-0">💡</span>
                <p className="text-xs text-amber-200/70">{q.hint}</p>
              </div>
            ) : (
              <button onClick={() => { setShowHint(true); setHintUsed(true); }}
                className="text-xs text-amber-600/60 hover:text-amber-400 transition">
                💡 Show hint <span className="text-gray-600">(reduces XP earned)</span>
              </button>
            )}
          </div>
        )}

        <div className="grid gap-3 mb-8">
          {q.choices.map((c, i) => {
            let cls = 'flex items-start gap-4 p-4 rounded-2xl border text-left transition-all duration-150 w-full ';
            if (confirmed) {
              cls += i === q.ans ? 'bg-emerald-500/10 border-emerald-400/50 text-emerald-200 cursor-default' :
                     i === sel   ? 'bg-red-500/10 border-red-400/50 text-red-300 cursor-default' :
                                   'bg-transparent border-white/5 text-gray-600 cursor-default';
            } else {
              cls += sel === i ? 'cursor-pointer' : 'cursor-pointer bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/25';
              if (sel === i) cls += ' border-2 text-white';
            }
            const lBg = confirmed && i === q.ans ? 'bg-emerald-500 text-white' :
                        confirmed && i === sel   ? 'bg-red-500 text-white' :
                        sel === i && !confirmed  ? ' text-white' : 'bg-white/10 text-gray-400';
            return (
              <button key={i} disabled={confirmed} onClick={() => setSel(i)} className={cls}
                style={sel === i && !confirmed ? { background: `${accentColor}20`, borderColor: accentColor } : {}}>
                <span className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black mt-0.5 transition-colors ${lBg}`}
                  style={sel === i && !confirmed ? { background: accentColor } : {}}>
                  {confirmed && i === q.ans ? '✓' : confirmed && i === sel ? '✗' : LETTERS[i]}
                </span>
                <span className="text-sm leading-relaxed">{c}</span>
              </button>
            );
          })}
        </div>

        {confirmed && (
          <div className="slide-in p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl mb-6">
            <p className="text-xs font-bold text-emerald-400 mb-2">Explanation</p>
            <p className="text-sm text-gray-300 leading-relaxed">{q.exp}</p>
          </div>
        )}

        {!confirmed
          ? <button onClick={handleConfirm} disabled={sel === null}
              className="w-full py-4 bg-white text-black font-black rounded-xl hover:bg-blue-50 transition disabled:opacity-30 disabled:cursor-not-allowed">
              Confirm Answer
            </button>
          : <button onClick={handleNext}
              className="w-full py-4 text-white font-black rounded-xl hover:opacity-80 transition"
              style={{ background: accentColor }}>
              {qi + 1 >= questions.length ? 'Finish Practice →' : 'Next Question →'}
            </button>
        }
      </div>
    </div>
  );
});
LessonPractice.displayName = 'LessonPractice';

/* ═══════════════════════════════════════════════════════════════
   MASTERY CHALLENGE COMPONENT
   KA mechanics: 6 questions, 3 skills × 2 each
   Both correct → level up | Both wrong → level down | 1-1 → unchanged
   This is a "test" context → can push Proficient → Mastered
═══════════════════════════════════════════════════════════════ */
const MasteryChallenge = memo(({ skills, pathway, onFinish, onBack }) => {
  // Build 6 questions: 2 per skill (interleaved/randomised order)
  const questions = useRef((() => {
    const qs = [];
    skills.forEach(({ lesson, unit }) => {
      const pool = Q_BANK.filter(q => q.cat === unit.cat);
      const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, 2);
      picked.forEach(q => qs.push({ ...q, _lessonId: lesson.id, _lessonTitle: lesson.title, _unitId: unit.id, _unit: unit }));
    });
    return qs.sort(() => Math.random() - 0.5);
  })()).current;

  const [qi,        setQi]   = useState(0);
  const [sel,       setSel]  = useState(null);
  const [confirmed, setConf] = useState(false);
  const [answers,   setAnswers] = useState({}); // { lessonId: { correct: 0, total: 0 } }
  const LETTERS = ['A','B','C','D'];
  const q = questions[qi];
  if (!q) return <div className="text-center py-20 text-gray-500">No questions available for this skill. Go back and try again.</div>;

  const handleConfirm = useCallback(() => {
    if (sel === null) return;
    setConf(true);
    const isRight = sel === q.ans;
    setAnswers(prev => {
      const cur = prev[q._lessonId] || { correct: 0, total: 0 };
      return { ...prev, [q._lessonId]: { ...cur, correct: cur.correct + (isRight ? 1 : 0), total: cur.total + 1, unit: q._unit, lessonTitle: q._lessonTitle, unitId: q._unitId } };
    });
  }, [sel, q]);

  const handleNext = useCallback(() => {
    if (qi + 1 >= questions.length) {
      // Compute level changes per skill
      const changes = {};
      Object.entries(answers).forEach(([lid, data]) => {
        const curLevel = getLessonState(pathway, data.unitId, lid).masteryLevel || 0;
        // MC is a test context → can reach Mastered from Proficient
        const newLevel = computeNewLevel(curLevel, data.correct, data.total, true);
        changes[lid] = { from: curLevel, to: newLevel, lessonTitle: data.lessonTitle, unitId: data.unitId, unit: data.unit };
      });
      onFinish(changes);
    } else {
      setQi(i => i + 1);
      setSel(null);
      setConf(false);
    }
  }, [qi, questions.length, answers, pathway, onFinish]);

  const progress = Math.round((qi / questions.length) * 100);
  const skillTracker = skills.map(({ lesson }) => {
    const a = answers[lesson.id] || { correct: 0, total: 0 };
    return { lessonTitle: lesson.title, correct: a.correct, total: a.total };
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={onBack} className="text-gray-500 hover:text-white text-sm transition flex-shrink-0">← Back</button>
        <p className="text-xs font-black text-violet-400 uppercase tracking-widest flex-1 text-center">⚡ Mastery Challenge</p>
        <span className="text-xs text-gray-500 flex-shrink-0">{qi + 1} / {questions.length}</span>
      </div>

      {/* KA-style skill tracker */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {skillTracker.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full">
            <span className="text-[10px] font-bold text-violet-400 truncate max-w-[100px]">{s.lessonTitle}</span>
            <span className="text-[10px] text-gray-500">{s.correct}/{s.total}</span>
          </div>
        ))}
      </div>

      <div className="w-full bg-white/5 rounded-full h-1.5 mb-6">
        <div className="h-1.5 rounded-full bg-violet-500 prog-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="bg-white/5 border border-white/10 rounded-[24px] p-8">
        <div className="flex justify-between items-center mb-5">
          <div className="text-xs text-gray-500">Skill: <span className="text-violet-400 font-bold">{q._lessonTitle}</span></div>
          <span className="text-xs font-bold text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20">{q.cat}</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-8 leading-snug">{q.text}</h2>
        <div className="grid gap-3 mb-8">
          {q.choices.map((c, i) => {
            let cls = 'flex items-start gap-4 p-4 rounded-2xl border text-left transition-all duration-150 w-full cursor-pointer ';
            if (confirmed) {
              cls += i === q.ans ? 'bg-emerald-500/10 border-emerald-400/50 text-emerald-200 cursor-default' :
                     i === sel   ? 'bg-red-500/10 border-red-400/50 text-red-300 cursor-default' :
                                   'bg-transparent border-white/5 text-gray-600 cursor-default';
            } else {
              cls += sel === i ? 'bg-violet-600/20 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/25';
            }
            const lBg = confirmed && i === q.ans ? 'bg-emerald-500 text-white' :
                        confirmed && i === sel   ? 'bg-red-500 text-white' :
                        sel === i && !confirmed  ? 'bg-violet-500 text-white' : 'bg-white/10 text-gray-400';
            return (
              <button key={i} disabled={confirmed} onClick={() => setSel(i)} className={cls}>
                <span className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black mt-0.5 ${lBg}`}>
                  {confirmed && i === q.ans ? '✓' : confirmed && i === sel ? '✗' : LETTERS[i]}
                </span>
                <span className="text-sm leading-relaxed">{c}</span>
              </button>
            );
          })}
        </div>
        {confirmed && (
          <div className="slide-in p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl mb-6">
            <p className="text-xs font-bold text-emerald-400 mb-1">Explanation</p>
            <p className="text-sm text-gray-300 leading-relaxed">{q.exp}</p>
          </div>
        )}
        {!confirmed
          ? <button onClick={handleConfirm} disabled={sel === null}
              className="w-full py-4 bg-white text-black font-black rounded-xl hover:bg-violet-50 transition disabled:opacity-30 disabled:cursor-not-allowed">
              Confirm Answer
            </button>
          : <button onClick={handleNext}
              className="w-full py-4 bg-violet-600 text-white font-black rounded-xl hover:bg-violet-500 transition">
              {qi + 1 >= questions.length ? 'See Results →' : 'Next Question →'}
            </button>
        }
      </div>
    </div>
  );
});
MasteryChallenge.displayName = 'MasteryChallenge';

/* ═══════════════════════════════════════════════════════════════
   MAIN APP COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function App() {

  /* ─── Global State ─── */
  const [tab, setTab] = useState('home');
  const [user, setUser] = useState(() => {
    const stored = storage.get('msp_user', {
      name:'', specialty:null, xp:0, streak:0, lastActive:null,
      earnedBadges:[], perfectSessions:0, chatMessages:0,
      masteryChallengeDone:0, courseChallengesDone:0, firstAttemptPerfect:false,
      lastMCDate:null,
    });
    if (!stored.name) {
      try { const s = JSON.parse(localStorage.getItem('msp_session')||'null'); if (s?.name) stored.name = s.name; } catch {}
    }
    // Ensure all new fields exist
    return {
      earnedBadges:[], perfectSessions:0, chatMessages:0,
      masteryChallengeDone:0, courseChallengesDone:0, firstAttemptPerfect:false, lastMCDate:null,
      ...stored
    };
  });
  const [pathway,    setPathway]    = useState(() => storage.get('msp_pathway', {}));
  const [flashDecks, setFlashDecks] = useState(() => storage.get('msp_flash', {}));
  const [portfolio,  setPortfolio]  = useState(() => storage.get('msp_port', []));
  const [catPerf,    setCatPerf]    = useState(() => storage.get('msp_catperf', {}));

  /* ─── Badge toast queue ─── */
  const [badgeQueue, setBadgeQueue] = useState([]);

  /* ─── Pathway Navigation ─── */
  const [activeLessonView,     setActiveLessonView]     = useState(null);
  const [lessonPracticeMode,   setLessonPracticeMode]   = useState(false);
  const [activeUnit,           setActiveUnit]           = useState(null);
  const [activeMasteryQs,      setActiveMasteryQs]      = useState(null);
  const [activeMCSkills,       setActiveMCSkills]       = useState(null); // for Mastery Challenge
  const [showMasteryChallenge, setShowMasteryChallenge] = useState(false);
  const [quizResults,          setQuizResults]          = useState(null);
  const [sessionSummary,       setSessionSummary]       = useState(null); // post-session modal
  const [courseChallengeMode,  setCourseChallengeMode]  = useState(false);

  /* ─── Diagnostic ─── */
  const [diagStep,    setDiagStep]    = useState(0);
  const [diagAnswers, setDiagAnswers] = useState({});
  const [diagDone,    setDiagDone]    = useState(false);

  /* ─── AI Coach ─── */
  const [msgs,        setMsgs]       = useState([{ role:'assistant', content:"Hello! I'm MetaBrain, your dedicated MCAT coach. Ask me anything — from enzyme kinetics to MMI prep. What shall we tackle today?" }]);
  const [chatInput,   setChatInput]  = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const msgsEndRef = useRef(null);

  /* ─── Flashcards ─── */
  const [flashInput,   setFlashInput]   = useState('');
  const [flashLoading, setFlashLoading] = useState(false);
  const [activeDeck,   setActiveDeck]   = useState(null);
  const [cardIdx,      setCardIdx]      = useState(0);
  const [cardFlipped,  setCardFlipped]  = useState(false);

  /* ─── Library / Quiz / Interview / Admissions ─── */
  const [libSearch,       setLibSearch]       = useState('');
  const [libCat,          setLibCat]          = useState('All');
  const [quizLibCat,      setQuizLibCat]      = useState('All');
  const [activeLibQuiz,   setActiveLibQuiz]   = useState(null);
  const [interviewQ,      setInterviewQ]      = useState(null);
  const [interviewAnswer, setInterviewAnswer] = useState('');
  const [interviewFeedback,setInterviewFeedback] = useState('');
  const [interviewLoading,setInterviewLoading] = useState(false);
  const [interviewType,   setInterviewType]   = useState('All');
  const [gpa,             setGpa]             = useState('');
  const [mcat,            setMcat]            = useState('');
  const [clinicalHrs,     setClinicalHrs]     = useState('');
  const [volunteerHrs,    setVolunteerHrs]    = useState('');
  const [hasResearch,     setHasResearch]     = useState(false);
  const [calcResults,     setCalcResults]     = useState(null);

  /* ─── Settings ─── */
  const [settingsName,  setSettingsName]  = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);

  /* ─── Badges tab ─── */
  const [badgesGroupFilter, setBadgesGroupFilter] = useState('All');

  /* ─── Pomodoro ─── */
  const [pomodoroActive,   setPomodoroActive]   = useState(false);
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25*60);
  const [onBreak,          setOnBreak]          = useState(false);
  const pomodoroRef = useRef(null);

  /* ─── Persistence ─── */
  useEffect(() => { storage.set('msp_user',    user);       }, [user]);
  useEffect(() => { storage.set('msp_pathway', pathway);    }, [pathway]);
  useEffect(() => { storage.set('msp_flash',   flashDecks); }, [flashDecks]);
  useEffect(() => { storage.set('msp_port',    portfolio);  }, [portfolio]);
  useEffect(() => { storage.set('msp_catperf', catPerf);    }, [catPerf]);
  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs]);

  /* ─── Daily Streak ─── */
  useEffect(() => {
    const today     = new Date().toDateString();
    if (user.lastActive === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    setUser(u => ({ ...u, streak: u.lastActive === yesterday ? (u.streak||0)+1 : 1, lastActive: today }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Pomodoro Timer ─── */
  useEffect(() => {
    if (pomodoroActive) {
      pomodoroRef.current = setInterval(() => {
        setPomodoroTimeLeft(t => {
          if (t <= 1) {
            clearInterval(pomodoroRef.current);
            setPomodoroActive(false);
            setOnBreak(b => !b);
            return onBreak ? 25*60 : 5*60;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(pomodoroRef.current);
  }, [pomodoroActive, onBreak]);

  const fmtTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  /* ─── Badge checker — call after any state change ─── */
  const awardBadges = useCallback((updatedUser, updatedPathway, extras = {}) => {
    const currentPath = updatedUser.specialty ? PATHS[updatedUser.specialty] : null;
    const newIds = checkNewBadges(updatedUser, updatedPathway, currentPath, extras);
    if (!newIds.length) return;
    const newBadgeObjs = BADGES.filter(b => newIds.includes(b.id));
    setUser(u => ({ ...u, earnedBadges: [...(u.earnedBadges||[]), ...newIds] }));
    setBadgeQueue(q => [...q, ...newBadgeObjs]);
  }, []);

  /* ─── Navigation ─── */
  const navTo = useCallback((id) => {
    setTab(id);
    setActiveLessonView(null);
    setLessonPracticeMode(false);
    setActiveUnit(null);
    setActiveMasteryQs(null);
    setActiveMCSkills(null);
    setShowMasteryChallenge(false);
    setQuizResults(null);
    setSessionSummary(null);
    setCourseChallengeMode(false);
  }, []);

  /* ─── Sign Out ─── */
  const signOut = useCallback(() => {
    ['msp_session','msp_user','msp_pathway','msp_flash','msp_port','msp_catperf'].forEach(k => localStorage.removeItem(k));
    window.location.replace(LANDING_URL);
  }, []);

  /* ─── Derived Values ─── */
  const currentPath    = user.specialty ? PATHS[user.specialty] : null;
  const accent         = currentPath?.accent || '#3b82f6';
  const xpLevel        = Math.floor(user.xp / 500) + 1;
  const xpProgress     = (user.xp % 500) / 500 * 100;
  const courseMastery  = calcCourseMastery(pathway, currentPath);
  const { earned: mpEarned, max: mpMax } = calcTotalMasteryPoints(pathway, currentPath);
  const unitsMastered  = currentPath ? currentPath.units.filter(u => (pathway[u.id]?.masteryScore||0) >= u.req).length : 0;
  const nextItem       = findNextItem(pathway, currentPath);
  const weakestLessons = findWeakestLessons(pathway, currentPath);
  const staleSkills    = findStaleSkills(pathway, currentPath);
  const mcAvailable    = isMCAvailable(pathway, currentPath, user);
  const mcSkills       = mcAvailable ? selectMCSkills(pathway, currentPath) : [];
  const filteredLib    = ELIB.filter(r => (libCat === 'All' || r.cat === libCat) && (r.title.toLowerCase().includes(libSearch.toLowerCase()) || r.desc.toLowerCase().includes(libSearch.toLowerCase())));
  const filteredMMI    = interviewType === 'All' ? MMI_QS : MMI_QS.filter(q => q.type === interviewType);

  /* ═══════════════════════════════════════════════════
     DIAGNOSTIC LOGIC
  ═══════════════════════════════════════════════════ */
  const handleDiagAnswer = (qIdx, optIdx) => {
    const newAnswers = { ...diagAnswers, [qIdx]: optIdx };
    setDiagAnswers(newAnswers);
    if (qIdx + 1 >= DIAGNOSTIC_QS.length) {
      const scores = { surgery:0, internal:0, pediatrics:0, psychiatry:0, research:0 };
      Object.entries(newAnswers).forEach(([qi, oi]) => {
        const wq = DIAGNOSTIC_QS[parseInt(qi)];
        Object.keys(scores).forEach(sp => { scores[sp] += wq.w[sp][oi] || 0; });
      });
      const specialty = Object.entries(scores).sort(([,a],[,b]) => b - a)[0][0];
      const newUser = { ...user, specialty, xp: user.xp + 100 };
      setUser(newUser);
      const initPathway = {};
      PATHS[specialty].units.forEach((u, i) => {
        initPathway[u.id] = { unlocked: i === 0, masteryScore: null, lessons: {} };
      });
      setPathway(initPathway);
      setDiagDone(true);
      awardBadges(newUser, initPathway);
    } else {
      setDiagStep(qIdx + 1);
    }
  };

  /* ═══════════════════════════════════════════════════
     MARK VIDEO / ARTICLE
  ═══════════════════════════════════════════════════ */
  const markVideoWatched = useCallback((unitId, lessonId) => {
    setPathway(prev => setLessonState(prev, unitId, lessonId, s => ({ ...s, videoWatched: true })));
    setUser(u => { const nu = { ...u, xp: u.xp + 10 }; return nu; });
  }, []);

  const markArticleRead = useCallback((unitId, lessonId) => {
    setPathway(prev => setLessonState(prev, unitId, lessonId, s => ({ ...s, articleRead: true })));
    setUser(u => ({ ...u, xp: u.xp + 15 }));
  }, []);

  /* ═══════════════════════════════════════════════════
     COMPLETE LESSON PRACTICE
     Uses computeNewLevel() for authentic KA mastery
  ═══════════════════════════════════════════════════ */
  const completeLessonPractice = useCallback((unitId, lessonId, score, total, newLevel, newPts, xpEarned, hintUsed) => {
    const prevLevel = getLessonState(pathway, unitId, lessonId).masteryLevel || 0;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const isPerfect = score === total;

    // Update pathway
    const newPathway = setLessonState(pathway, unitId, lessonId, s => ({
      ...s,
      masteryLevel: newLevel,
      sessions: (s.sessions || 0) + 1,
      lastPracticed: Date.now(),
    }));
    setPathway(newPathway);

    // Update user stats
    const newUser = {
      ...user,
      xp: user.xp + xpEarned,
      perfectSessions: isPerfect ? (user.perfectSessions || 0) + 1 : (user.perfectSessions || 0),
      firstAttemptPerfect: (user.firstAttemptPerfect || false) || (isPerfect && (getLessonState(pathway, unitId, lessonId).sessions || 0) === 0),
    };
    setUser(newUser);

    // Update category performance
    if (currentPath) {
      const unit = currentPath.units.find(u => u.lessons.some(l => l.id === lessonId));
      if (unit) {
        setCatPerf(prev => {
          const c = prev[unit.cat] || { total: 0, count: 0 };
          return { ...prev, [unit.cat]: { total: c.total + pct, count: c.count + 1, last: pct } };
        });
      }
    }

    // Build session summary
    const changes = [{
      from: prevLevel, to: newLevel,
      lessonTitle: activeLessonView?.lesson?.title || 'Lesson',
    }];
    const newBadgeIds = checkNewBadges(newUser, newPathway, currentPath, { flashDeckCount: Object.keys(flashDecks).length });
    const newBadgeObjs = BADGES.filter(b => newBadgeIds.includes(b.id));
    if (newBadgeIds.length) {
      setUser(u => ({ ...u, earnedBadges: [...(u.earnedBadges||[]), ...newBadgeIds] }));
      setBadgeQueue(q => [...q, ...newBadgeObjs]);
    }

    setSessionSummary({ changes, xpEarned, newBadges: newBadgeObjs, score, total });
    setLessonPracticeMode(false);
  }, [pathway, user, currentPath, activeLessonView, flashDecks]);

  /* ═══════════════════════════════════════════════════
     UNIT MASTERY CHECK
  ═══════════════════════════════════════════════════ */
  const startMasteryCheck = useCallback((unit) => {
    const qs = buildCategoryQuiz(unit.cat, 8);
    setActiveMasteryQs(qs);
    setActiveUnit({ unit, mode: 'mastery' });
    setActiveLessonView(null);
    setLessonPracticeMode(false);
    setSessionSummary(null);
  }, []);

  const finishMasteryCheck = useCallback((score, total, unit) => {
    const passed = score >= unit.req;
    const pct    = Math.round((score / total) * 100);
    setQuizResults({ score, total, passed, unit });

    setPathway(prev => {
      // Update masteryScore and unlock next unit
      let up = { ...prev, [unit.id]: { ...(prev[unit.id]||{}), masteryScore: score } };
      if (passed && currentPath) {
        const idx = currentPath.units.findIndex(u => u.id === unit.id);
        if (idx + 1 < currentPath.units.length) {
          const nextUnitId = currentPath.units[idx+1].id;
          up[nextUnitId] = { ...(up[nextUnitId]||{}), unlocked: true, lessons: up[nextUnitId]?.lessons || {} };
        }
        // Unit test: promote Proficient → Mastered (100% on test required per KA rules)
        unit.lessons.forEach(l => {
          const ls = getLessonState(up, unit.id, l.id);
          if ((ls.masteryLevel || 0) === 3) {
            up = setLessonState(up, unit.id, l.id, s => ({
              ...s, masteryLevel: 4, lastPracticed: Date.now()
            }));
          }
        });
      }
      return up;
    });

    const xpAdd = passed ? unit.xp : Math.floor(unit.xp * 0.3);
    const newUser = { ...user, xp: user.xp + xpAdd };
    setUser(newUser);

    if (currentPath) {
      setCatPerf(prev => {
        const c = prev[unit.cat] || { total:0, count:0 };
        return { ...prev, [unit.cat]: { total: c.total + pct, count: c.count + 1, last: pct } };
      });
    }
    setActiveUnit(null);
    setActiveMasteryQs(null);
    awardBadges(newUser, pathway);
  }, [currentPath, user, pathway, awardBadges]);

  /* ═══════════════════════════════════════════════════
     MASTERY CHALLENGE FINISH
  ═══════════════════════════════════════════════════ */
  const finishMasteryChallenge = useCallback((changes) => {
    let newPathway = { ...pathway };
    const changesList = [];

    Object.entries(changes).forEach(([lessonId, c]) => {
      newPathway = setLessonState(newPathway, c.unitId, lessonId, s => ({
        ...s, masteryLevel: c.to, lastPracticed: Date.now()
      }));
      changesList.push(c);
    });

    setPathway(newPathway);
    const xpGained = changesList.filter(c => c.to > c.from).length * 50;
    const newUser  = {
      ...user, xp: user.xp + xpGained,
      masteryChallengeDone: (user.masteryChallengeDone || 0) + 1,
      lastMCDate: new Date().toDateString(),
    };
    setUser(newUser);
    awardBadges(newUser, newPathway);
    setSessionSummary({ changes: changesList, xpEarned: xpGained, newBadges: [], score: changesList.filter(c=>c.to > c.from).length, total: changesList.length });
    setShowMasteryChallenge(false);
    setActiveMCSkills(null);
  }, [pathway, user, awardBadges]);

  /* ═══════════════════════════════════════════════════
     COURSE CHALLENGE FINISH
     Can mass-promote Proficient → Mastered
  ═══════════════════════════════════════════════════ */
  const finishCourseChallenge = useCallback((score, total) => {
    if (!currentPath) return;
    const pct = total > 0 ? (score / total) * 100 : 0;
    let newPathway = { ...pathway };

    // Upgrade all Proficient skills if score ≥ 70%
    if (pct >= 70) {
      currentPath.units.forEach(unit => {
        if (!newPathway[unit.id]?.unlocked) return;
        unit.lessons.forEach(lesson => {
          const ls = getLessonState(newPathway, unit.id, lesson.id);
          if ((ls.masteryLevel || 0) === 3 && pct === 100) {
            newPathway = setLessonState(newPathway, unit.id, lesson.id, s => ({ ...s, masteryLevel: 4, lastPracticed: Date.now() }));
          }
        });
      });
    }
    setPathway(newPathway);
    const xpAdd = Math.round(pct * 5);
    const newUser = { ...user, xp: user.xp + xpAdd, courseChallengesDone: (user.courseChallengesDone||0)+1 };
    setUser(newUser);
    awardBadges(newUser, newPathway);
    setQuizResults({ score, total, passed: pct >= 70, isCourseChallenge: true, pct: Math.round(pct), xpAdd });
    setCourseChallengeMode(false);
  }, [currentPath, pathway, user, awardBadges]);

  /* ═══════════════════════════════════════════════════
     AI HELPERS
  ═══════════════════════════════════════════════════ */
  const callAI = async (sys, msg) => {
    const res = await fetch('/api/ai', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ system: sys, message: msg })
    });
    if (!res.ok) throw new Error('API error');
    return (await res.json()).content || 'No response.';
  };

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const newMsgs = [...msgs, { role:'user', content: chatInput }];
    setMsgs(newMsgs); setChatInput(''); setChatLoading(true);
    const ctx = currentPath ? `Student is on the ${currentPath.label} pathway with ${user.xp} XP and ${user.streak} day streak.` : '';
    try {
      const reply = await callAI(`You are MetaBrain, an elite MCAT coach. Be concise, high-yield, use mnemonics. ${ctx}`, chatInput);
      setMsgs([...newMsgs, { role:'assistant', content: reply }]);
      const newUser = { ...user, chatMessages: (user.chatMessages||0)+1 };
      setUser(newUser);
      awardBadges(newUser, pathway);
    } catch {
      setMsgs([...newMsgs, { role:'assistant', content:'⚠️ Could not reach the AI. Check that ANTHROPIC_API_KEY is set in your Vercel dashboard.' }]);
    }
    setChatLoading(false);
  }, [chatInput, chatLoading, msgs, user, currentPath, pathway, awardBadges]);

  const generateFlashcards = async () => {
    if (!flashInput.trim() || flashLoading) return;
    setFlashLoading(true);
    try {
      const reply = await callAI('Return ONLY a JSON array of objects with "front" and "back" keys. No preamble, no markdown, no code fences. Generate 8-12 high-yield flashcards from the given notes.', flashInput);
      const cards = JSON.parse(reply.replace(/```json|```/g,'').trim());
      const name  = `Deck ${Object.keys(flashDecks).length + 1}`;
      const newDecks = { ...flashDecks, [name]: cards };
      setFlashDecks(newDecks);
      setActiveDeck(name); setCardIdx(0); setCardFlipped(false); setFlashInput('');
      const newUser = { ...user };
      awardBadges(newUser, pathway, { flashDeckCount: Object.keys(newDecks).length });
    } catch { alert('Could not generate flashcards. Check your /api/ai endpoint.'); }
    setFlashLoading(false);
  };

  const getInterviewFeedback = async () => {
    if (!interviewAnswer.trim() || interviewLoading) return;
    setInterviewLoading(true);
    try {
      const fb = await callAI('You are an expert MMI interview coach. Give structured feedback with three sections: STRENGTHS, AREAS TO IMPROVE, and a SCORE /10. Be honest but encouraging.', `Question: "${interviewQ.q}"\n\nCandidate answer: "${interviewAnswer}"`);
      setInterviewFeedback(fb);
    } catch { setInterviewFeedback('⚠️ Could not get AI feedback. Check your ANTHROPIC_API_KEY.'); }
    setInterviewLoading(false);
  };

  const calcAdmissions = () => {
    const g = parseFloat(gpa), m = parseInt(mcat);
    if (!g || !m || g < 2 || g > 4.0 || m < 472 || m > 528) return alert('Enter a valid GPA (2.0–4.0) and MCAT score (472–528).');
    const clin = parseInt(clinicalHrs)||0, vol = parseInt(volunteerHrs)||0;
    const results = SCHOOL_DATA.map(school => {
      const gGap = school.avgGPA - g, mGap = school.avgMCAT - m;
      let score = 0;
      if (gGap <= -0.2 && mGap <= -4) score = 3;
      else if (gGap <= -0.1 && mGap <= -2) score = 2;
      else if (gGap <= 0.1  && mGap <= 2)  score = 1;
      if (clin >= 1000)   score += 0.5;
      if (vol  >= 200)    score += 0.3;
      if (hasResearch)    score += 0.3;
      return { ...school, chance: score >= 2.5 ? 'Safety' : score >= 1.5 ? 'Target' : 'Reach', score };
    });
    setCalcResults(results.sort((a,b) => b.score - a.score));
  };

  /* ─── NAV items ─── */
  const NAV = [
    { id:'home',        label:'Home' },
    { id:'diagnostic',  label:'Pathway Diagnostic' },
    { id:'pathway',     label:'Learning Pathway' },
    { id:'quiz',        label:'Quiz Library' },
    { id:'coach',       label:'MetaBrain AI' },
    { id:'flashcards',  label:'AI Flashcards' },
    { id:'elibrary',    label:'E-Library' },
    { id:'portfolio',   label:'Portfolio Builder' },
    { id:'interview',   label:'Interview Simulator' },
    { id:'admissions',  label:'Admissions Calc' },
    { id:'analytics',   label:'Analytics' },
    { id:'badges',      label:'Badges' },
    { id:'settings',    label:'Settings' },
  ];

  /* ═══════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-screen w-screen bg-[#030014] text-white overflow-hidden font-sans">

      {/* ── Badge Toast Queue ── */}
      {badgeQueue.length > 0 && (
        <BadgeToast badge={badgeQueue[0]} onDismiss={() => setBadgeQueue(q => q.slice(1))} />
      )}

      {/* ── Session Summary Modal ── */}
      {sessionSummary && (
        <SessionSummaryCard
          changes={sessionSummary.changes}
          xpEarned={sessionSummary.xpEarned}
          newBadges={sessionSummary.newBadges || []}
          sessionScore={sessionSummary.score}
          sessionTotal={sessionSummary.total}
          onContinue={() => setSessionSummary(null)}
        />
      )}

      {/* ══════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════ */}
      <aside className="w-60 shrink-0 flex flex-col bg-black/50 border-r border-white/5 overflow-y-auto">

        {/* Brand */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-white flex-shrink-0" style={{ background: accent }}>M</div>
              <div>
                <p className="font-black text-sm tracking-tight leading-none">MedSchoolPrep</p>
                <p className="text-[10px] text-gray-500 mt-0.5">MCAT Prep Platform</p>
              </div>
            </div>
            <button onClick={signOut} title="Sign out"
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 flex items-center justify-center transition group">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-gray-500 group-hover:text-red-400 transition">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>

          {user.name && <p className="text-[11px] text-gray-500 mb-3 truncate">Hey, <span className="text-gray-300 font-semibold">{user.name.split(' ')[0]}</span> 👋</p>}

          {/* Level + XP bar */}
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>Level {xpLevel}</span>
            <span>{user.xp % 500}/500 XP</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
            <div className="h-full rounded-full prog-fill" style={{ width: `${xpProgress}%`, background: accent }} />
          </div>

          {/* Mastery Points */}
          {currentPath && (
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>Mastery Points</span>
              <span>{mpEarned}/{mpMax}</span>
            </div>
          )}
          {currentPath && (
            <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-3">
              <div className="h-full rounded-full prog-fill" style={{ width: `${mpMax > 0 ? Math.round((mpEarned/mpMax)*100) : 0}%`, background: '#10b981' }} />
            </div>
          )}

          {/* Course mastery ring */}
          {currentPath && (
            <div className="flex items-center gap-3 mt-1 p-2.5 bg-white/5 rounded-xl border border-white/5">
              <CircularProgress pct={courseMastery} accent={accent} size={46} />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-white truncate">{currentPath.label}</p>
                <p className="text-[10px] text-gray-500">Course mastery</p>
              </div>
            </div>
          )}
        </div>

        {/* Specialty badge */}
        {user.specialty && (
          <div className="mx-3 mt-2.5 px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2" style={{ borderColor: `${accent}40`, color: accent, background: `${accent}10` }}>
            <span>{PATHS[user.specialty].icon}</span>
            <span className="truncate">{PATHS[user.specialty].label}</span>
          </div>
        )}

        {/* Mastery Challenge callout */}
        {mcAvailable && (
          <button onClick={() => { setActiveMCSkills(mcSkills); setShowMasteryChallenge(true); navTo('pathway'); }}
            className="mx-3 mt-2 px-3 py-2 rounded-xl border border-violet-500/40 bg-violet-500/10 text-left hover:bg-violet-500/20 transition">
            <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">⚡ Mastery Challenge</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Spaced rep review available</p>
          </button>
        )}

        {/* Stale skills warning */}
        {staleSkills.length > 0 && (
          <div className="mx-3 mt-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10">
            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">🕐 Skills Getting Stale</p>
            {staleSkills.slice(0, 2).map(s => (
              <p key={s.lesson.id} className="text-[10px] text-gray-500 truncate">{s.lesson.title} <span className="text-amber-600">{s.daysSince}d ago</span></p>
            ))}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 mt-2">
          {NAV.map(item => (
            <button key={item.id} onClick={() => navTo(item.id)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm transition-all text-left ${tab === item.id ? 'bg-white/10 text-white font-semibold border border-white/10' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`}>
              {item.label}
              {item.id === 'badges' && (user.earnedBadges||[]).length > 0 && (
                <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400">{(user.earnedBadges||[]).length}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Pomodoro */}
        <div className="p-3 border-t border-white/5">
          <div className="bg-white/5 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{onBreak ? 'Break' : 'Focus'}</span>
              <button onClick={() => { setPomodoroActive(a => !a); if (!pomodoroActive) setPomodoroTimeLeft(onBreak ? 5*60 : 25*60); }}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20">
                {pomodoroActive ? 'Pause' : 'Start'}
              </button>
            </div>
            <p className="text-xl font-black text-center tracking-widest" style={{ color: accent }}>{fmtTime(pomodoroTimeLeft)}</p>
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="pointer-events-none fixed top-0 right-0 w-[500px] h-[500px] rounded-full blur-[130px] opacity-10 transition-all duration-700" style={{ background: accent }} />

        <div className="max-w-5xl mx-auto p-8">

          {/* ═══════════════════════════════════════
              HOME TAB
          ═══════════════════════════════════════ */}
          {tab === 'home' && (
            <div>
              <div className="mb-6">
                <h1 className="text-4xl font-black mb-1">Hello, {user.name ? user.name.split(' ')[0] : 'Future Doctor'}</h1>
                <p className="text-gray-500">{currentPath ? `${currentPath.label} pathway · Level ${xpLevel}` : 'Take the Pathway Diagnostic to begin.'}</p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-4 mb-5">
                {[
                  { label:'Total XP',          val: user.xp.toLocaleString(), color:'#f59e0b' },
                  { label:'Level',              val: xpLevel,                  color:'#3b82f6' },
                  { label:`Day Streak 🔥`,      val: user.streak || 1,         color:'#ef4444' },
                  { label:'Units Mastered',     val: unitsMastered,            color:'#10b981' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.val}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Mastery Points summary */}
              {currentPath && (
                <div className="mb-5 p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold">Mastery Points</p>
                    <p className="text-sm font-black text-emerald-400">{mpEarned} / {mpMax} pts</p>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full prog-fill bg-emerald-500" style={{ width: `${mpMax > 0 ? Math.round((mpEarned/mpMax)*100) : 0}%` }} />
                  </div>
                  <div className="flex gap-4 mt-3">
                    {[0,1,2,3,4].map(level => {
                      const m = MASTERY[level];
                      const count = currentPath ? currentPath.units.reduce((sum, u) =>
                        sum + u.lessons.filter(l => (getLessonState(pathway, u.id, l.id).masteryLevel||0) === level).length, 0) : 0;
                      return (
                        <div key={level} className="flex items-center gap-1.5">
                          <MasteryDot level={level} size={14} />
                          <span className="text-[10px] text-gray-500">{count}</span>
                        </div>
                      );
                    })}
                    <span className="text-[10px] text-gray-600 ml-auto">skills by level</span>
                  </div>
                </div>
              )}

              {/* Smart Continue */}
              {currentPath && nextItem && nextItem.step !== 'complete' && (
                <div className="mb-5 p-5 rounded-2xl border cursor-pointer hover:opacity-90 transition"
                  style={{ background:`${accent}12`, borderColor:`${accent}40` }}
                  onClick={() => {
                    if (nextItem.step === 'mastery') { startMasteryCheck(nextItem.unit); setTab('pathway'); }
                    else { setActiveLessonView({ unit: nextItem.unit, lesson: nextItem.lesson, step: nextItem.step }); setTab('pathway'); }
                  }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: accent }}>▶ Continue Where You Left Off</p>
                  <p className="font-bold text-white text-lg">
                    {nextItem.step === 'mastery'  ? `Mastery Check: ${nextItem.unit.title}` :
                     nextItem.step === 'video'    ? `Watch: ${nextItem.lesson.title}` :
                     nextItem.step === 'article'  ? `Read: ${nextItem.lesson.title}` :
                                                    `Practice: ${nextItem.lesson.title}`}
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5">{nextItem.unit?.title} — {
                    nextItem.step === 'mastery'  ? 'Unit Mastery Check' :
                    nextItem.step === 'video'    ? 'Video Lesson · +10 XP' :
                    nextItem.step === 'article'  ? 'Key Concepts Article · +15 XP' :
                                                   'Practice Questions · up to +100 XP'
                  }</p>
                </div>
              )}
              {nextItem?.step === 'complete' && (
                <div className="mb-5 p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10">
                  <p className="font-bold text-emerald-400 text-lg">🎉 Pathway Complete!</p>
                  <p className="text-sm text-gray-400 mt-1">You've completed all lessons. Take the Course Challenge to lock in Mastered status on Proficient skills.</p>
                  <button onClick={() => { setCourseChallengeMode(true); setTab('pathway'); }}
                    className="mt-3 px-5 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-sm font-bold text-emerald-400 hover:bg-emerald-500/30 transition">
                    Take Course Challenge →
                  </button>
                </div>
              )}

              {/* Mastery Challenge callout */}
              {mcAvailable && (
                <div className="mb-5 p-5 rounded-2xl border border-violet-500/40 bg-violet-500/10 cursor-pointer hover:bg-violet-500/15 transition"
                  onClick={() => { setActiveMCSkills(mcSkills); setShowMasteryChallenge(true); setTab('pathway'); }}>
                  <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-1">⚡ Mastery Challenge Available</p>
                  <p className="font-bold text-white">Spaced repetition review of {mcSkills.length} skills</p>
                  <p className="text-sm text-gray-400 mt-1">6 questions · 2 per skill · Can earn Mastered status</p>
                </div>
              )}

              {/* Stale skills */}
              {staleSkills.length > 0 && (
                <div className="mb-5">
                  <h2 className="text-sm font-bold text-amber-400 mb-3">🕐 Skills Getting Stale — Review Them</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {staleSkills.map(({ unit, lesson, level, daysSince }) => (
                      <button key={lesson.id}
                        onClick={() => { setActiveLessonView({ unit, lesson, step:'practice' }); setTab('pathway'); }}
                        className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left hover:border-amber-500/40 transition">
                        <div className="flex items-center gap-2 mb-1.5">
                          <MasteryDot level={level} size={16} />
                          <span className="text-amber-500 text-[10px] font-bold">{daysSince}d since review</span>
                        </div>
                        <p className="text-xs font-bold text-white">{lesson.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Personalized Practice */}
              {weakestLessons.length > 0 && (
                <div className="mb-5">
                  <h2 className="text-sm font-bold text-gray-400 mb-3">Personalized Practice — Weakest Skills</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {weakestLessons.map(({ unit, lesson, level }) => {
                      const m = MASTERY[level];
                      return (
                        <button key={lesson.id}
                          onClick={() => { setActiveLessonView({ unit, lesson, step:'practice' }); setTab('pathway'); }}
                          className="p-4 bg-white/5 border border-white/10 rounded-xl text-left hover:border-white/20 hover:bg-white/10 transition">
                          <div className="flex items-center gap-2 mb-1.5">
                            <MasteryDot level={level} size={16} />
                            <span className="text-[10px] font-bold" style={{ color: m.color }}>{m.label}</span>
                          </div>
                          <p className="text-xs font-bold text-white leading-snug">{lesson.title}</p>
                          <p className="text-[10px] text-gray-600 mt-1">{unit.title}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => navTo(user.specialty ? 'pathway' : 'diagnostic')} className="p-5 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-blue-500/40 hover:bg-blue-500/5 transition">
                  <h3 className="font-bold mb-1">{user.specialty ? 'Learning Pathway' : 'Take Pathway Diagnostic'}</h3>
                  <p className="text-sm text-gray-500">{user.specialty ? `${currentPath.label} — view all units` : 'Discover your specialty in 10 questions'}</p>
                </button>
                <button onClick={() => navTo('coach')} className="p-5 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-violet-500/40 hover:bg-violet-500/5 transition">
                  <h3 className="font-bold mb-1">MetaBrain AI Coach</h3>
                  <p className="text-sm text-gray-500">Ask anything about MCAT concepts</p>
                </button>
                <button onClick={() => navTo('quiz')} className="p-5 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-emerald-500/40 hover:bg-emerald-500/5 transition">
                  <h3 className="font-bold mb-1">Quiz Library</h3>
                  <p className="text-sm text-gray-500">Practice questions across all MCAT sections</p>
                </button>
                <button onClick={() => navTo('badges')} className="p-5 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-amber-500/40 hover:bg-amber-500/5 transition">
                  <h3 className="font-bold mb-1">Badges</h3>
                  <p className="text-sm text-gray-500">{(user.earnedBadges||[]).length} / {BADGES.length} earned</p>
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════
              DIAGNOSTIC TAB
          ═══════════════════════════════════════ */}
          {tab === 'diagnostic' && !diagDone && (
            <div>
              <h1 className="text-3xl font-black mb-2">Pathway Diagnostic</h1>
              <p className="text-gray-500 mb-8">Answer {DIAGNOSTIC_QS.length} questions to discover your ideal specialty path.</p>
              <div className="w-full bg-white/5 rounded-full h-2 mb-8 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 prog-fill" style={{ width:`${(diagStep/DIAGNOSTIC_QS.length)*100}%` }} />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-[24px] p-8">
                <p className="text-xs text-gray-500 mb-4">Question {diagStep + 1} of {DIAGNOSTIC_QS.length}</p>
                <h2 className="text-2xl font-bold mb-8">{DIAGNOSTIC_QS[diagStep].q}</h2>
                <div className="grid gap-3">
                  {DIAGNOSTIC_QS[diagStep].opts.map((opt, i) => (
                    <button key={i} onClick={() => handleDiagAnswer(diagStep, i)}
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
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl" style={{ background:`${accent}20`, border:`1px solid ${accent}40` }}>
                {PATHS[user.specialty].icon}
              </div>
              <h1 className="text-3xl font-black mb-3">Your Path: {PATHS[user.specialty].label}</h1>
              <p className="text-gray-400 mb-2">{PATHS[user.specialty].tagline}</p>
              <p className="text-sm text-gray-600 mb-8">+100 XP earned for completing the diagnostic!</p>
              <button onClick={() => navTo('pathway')} className="px-8 py-4 rounded-2xl font-black text-white text-lg transition hover:opacity-80" style={{ background: accent }}>
                Begin My Learning Path →
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════
              PATHWAY TAB — all sub-views
          ═══════════════════════════════════════ */}
          {tab === 'pathway' && (() => {

            /* ── Course Challenge ── */
            if (courseChallengeMode) {
              const qs = buildCategoryQuiz('All', 20);
              return (
                <QuizEngine
                  questions={qs}
                  title="Course Challenge — Full Pathway Assessment"
                  accentColor="#10b981"
                  onBack={() => setCourseChallengeMode(false)}
                  onFinish={(score, total) => finishCourseChallenge(score, total)}
                />
              );
            }

            /* ── Mastery Challenge ── */
            if (showMasteryChallenge && activeMCSkills) {
              return (
                <MasteryChallenge
                  skills={activeMCSkills}
                  pathway={pathway}
                  onBack={() => { setShowMasteryChallenge(false); setActiveMCSkills(null); }}
                  onFinish={finishMasteryChallenge}
                />
              );
            }

            /* ── Lesson Practice ── */
            if (lessonPracticeMode && activeLessonView) {
              const { unit, lesson } = activeLessonView;
              const ls = getLessonState(pathway, unit.id, lesson.id);
              return (
                <LessonPractice
                  lesson={lesson}
                  unit={unit}
                  currentLevel={ls.masteryLevel || 0}
                  currentPts={MASTERY[ls.masteryLevel || 0].points}
                  accentColor={accent}
                  onBack={() => setLessonPracticeMode(false)}
                  onFinish={(score, total, newLevel, newPts, xpEarned, hintUsed) =>
                    completeLessonPractice(unit.id, lesson.id, score, total, newLevel, newPts, xpEarned, hintUsed)
                  }
                />
              );
            }

            /* ── Unit Mastery Check ── */
            if (activeUnit?.mode === 'mastery' && activeMasteryQs && !activeLessonView) {
              return (
                <QuizEngine
                  questions={activeMasteryQs}
                  title={`Unit Test — ${activeUnit.unit.title}`}
                  accentColor={accent}
                  onBack={() => { setActiveUnit(null); setActiveMasteryQs(null); }}
                  onFinish={(score, total) => finishMasteryCheck(score, total, activeUnit.unit)}
                />
              );
            }

            /* ── Quiz Results ── */
            if (quizResults && !activeUnit && !activeLessonView) {
              const { score, total, passed, unit, isCourseChallenge, pct, xpAdd } = quizResults;
              return (
                <div className="text-center max-w-md mx-auto pt-12 slide-in">
                  <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 text-5xl ${passed ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-blue-500/10 border border-blue-500/20'}`}>
                    {passed ? '🎉' : '📚'}
                  </div>
                  {isCourseChallenge ? (
                    <>
                      <h1 className="text-3xl font-black mb-3">Course Challenge Complete</h1>
                      <p className="text-5xl font-black mb-2">{score}/{total}</p>
                      <p className="text-gray-500 mb-2">{pct}% correct</p>
                      <p className="text-sm font-bold mb-2 text-emerald-400">+{xpAdd} XP earned</p>
                      {pct === 100 && <p className="text-sm text-emerald-400 mb-8">All Proficient skills promoted to Mastered!</p>}
                      {pct >= 70 && pct < 100 && <p className="text-sm text-blue-400 mb-8">Score 100% to promote Proficient → Mastered.</p>}
                    </>
                  ) : (
                    <>
                      <h1 className="text-3xl font-black mb-3">{passed ? 'Unit Mastered!' : 'Keep Practicing!'}</h1>
                      <p className="text-5xl font-black mb-2">{score}/{total}</p>
                      <p className="text-gray-500 mb-2">Needed {unit?.req}/{unit?.masteryTotal} to pass</p>
                      <p className={`text-sm font-bold mb-2 ${passed ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {passed ? `+${unit?.xp} XP — Next unit unlocked!` : `+${Math.floor((unit?.xp||0) * 0.3)} XP — Review and try again.`}
                      </p>
                      {passed && (
                        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 text-left">
                          <strong>Proficient skills promoted to Mastered</strong> in this unit. Keep reviewing to avoid skill decay.
                        </div>
                      )}
                    </>
                  )}
                  <button onClick={() => setQuizResults(null)} className="px-8 py-4 bg-white/10 border border-white/10 rounded-2xl font-bold hover:bg-white/20 transition">
                    Return to Pathway
                  </button>
                </div>
              );
            }

            /* ── Lesson Detail View ── */
            if (activeLessonView && !lessonPracticeMode && !activeUnit && !quizResults) {
              const { unit, lesson, step } = activeLessonView;
              const ls = getLessonState(pathway, unit.id, lesson.id);
              const level = ls.masteryLevel || 0;
              const m     = MASTERY[level];
              const steps = [
                { id:'video',    label:'Watch Video',       done: ls.videoWatched },
                { id:'article',  label:'Read Key Concepts', done: ls.articleRead  },
                { id:'practice', label:'Practice',          done: level >= 4       },
              ];

              return (
                <div className="max-w-3xl mx-auto slide-in">
                  <button onClick={() => setActiveLessonView(null)} className="flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition">
                    ← Back to {unit.title}
                  </button>

                  {/* Lesson header */}
                  <div className="flex items-start gap-4 mb-4">
                    <MasteryDot level={level} size={36} />
                    <div className="flex-1">
                      <h1 className="text-2xl font-black mb-1">{lesson.title}</h1>
                      <p className="text-sm text-gray-500">{unit.cat} · {lesson.dur}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color: m.color }}>{m.label}</p>
                      <p className="text-xs text-gray-600">{m.points}/100 mastery pts</p>
                      {ls.sessions > 0 && <p className="text-xs text-gray-600">{ls.sessions} sessions</p>}
                    </div>
                  </div>

                  {/* Mastery progress */}
                  <div className="mb-5">
                    <MasteryProgress level={level} pts={m.points} />
                  </div>

                  {/* KA demotion warning */}
                  {level >= 3 && (
                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                      {level === 4
                        ? '⚠️ Mastered skills can be demoted if you score below 70% in practice.'
                        : '💡 Score 100% on a Unit Test or Mastery Challenge to reach Mastered.'}
                    </div>
                  )}

                  {/* Step tabs */}
                  <div className="flex mb-8 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    {steps.map((s, si) => (
                      <button key={s.id} onClick={() => setActiveLessonView(v => ({ ...v, step: s.id }))}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-3 text-sm font-bold border-r border-white/10 last:border-r-0 transition ${step === s.id ? 'bg-white/10 text-white' : s.done ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${s.done ? 'bg-emerald-500 text-white' : step === s.id ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-500'}`}>
                          {s.done ? '✓' : si + 1}
                        </span>
                        <span className="text-xs">{s.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* VIDEO */}
                  {step === 'video' && (
                    <div className="slide-in">
                      <div className="bg-black/50 rounded-2xl p-10 flex flex-col items-center text-center mb-5">
                        <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-5">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="#ef4444"><polygon points="5 3 19 12 5 21"/></svg>
                        </div>
                        <h3 className="font-bold text-white mb-1">{lesson.title}</h3>
                        <p className="text-sm text-gray-500 mb-6">{lesson.dur}</p>
                        <div className="flex gap-3">
                          <a href={lesson.yt} target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-red-500/20 border border-red-500/35 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/30 transition">YouTube ↗</a>
                          <a href={lesson.url} target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm font-bold hover:bg-white/20 transition">Khan Academy ↗</a>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
                        <span className="text-lg flex-shrink-0">💡</span>
                        <p className="text-sm text-amber-200/80 leading-relaxed">{lesson.note}</p>
                      </div>
                      {ls.videoWatched ? (
                        <div className="flex gap-3">
                          <div className="flex-1 py-3.5 text-center text-sm font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">✓ Video Watched</div>
                          <button onClick={() => setActiveLessonView(v => ({ ...v, step:'article' }))} className="flex-1 py-3.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-500 transition">Read Key Concepts →</button>
                        </div>
                      ) : (
                        <button onClick={() => { markVideoWatched(unit.id, lesson.id); setActiveLessonView(v => ({ ...v, step:'article' })); }} className="w-full py-4 font-black text-white rounded-xl hover:opacity-80 transition" style={{ background: accent }}>
                          Mark as Watched · +10 XP →
                        </button>
                      )}
                    </div>
                  )}

                  {/* ARTICLE */}
                  {step === 'article' && (
                    <div className="slide-in">
                      <h2 className="text-xl font-black mb-5">Key Concepts</h2>
                      <div className="space-y-3 mb-8">
                        {(LESSON_POINTS[lesson.id] || ['Complete the video above to review key concepts.', 'Focus on the high-yield note in the Video tab.', 'Khan Academy provides detailed articles alongside each video.', 'After reading, attempt practice questions to build mastery.']).map((pt, i) => (
                          <div key={i} className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 text-[11px] font-black text-blue-400 flex items-center justify-center mt-0.5">{i+1}</span>
                            <p className="text-sm text-gray-300 leading-relaxed">{pt}</p>
                          </div>
                        ))}
                      </div>
                      {ls.articleRead ? (
                        <div className="flex gap-3">
                          <div className="flex-1 py-3.5 text-center text-sm font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">✓ Article Read</div>
                          <button onClick={() => setActiveLessonView(v => ({ ...v, step:'practice' }))} className="flex-1 py-3.5 font-black text-white rounded-xl hover:opacity-80 transition" style={{ background: accent }}>Practice Questions →</button>
                        </div>
                      ) : (
                        <button onClick={() => { markArticleRead(unit.id, lesson.id); setActiveLessonView(v => ({ ...v, step:'practice' })); }} className="w-full py-4 font-black text-white rounded-xl hover:opacity-80 transition" style={{ background: accent }}>
                          Mark as Read · +15 XP →
                        </button>
                      )}
                    </div>
                  )}

                  {/* PRACTICE */}
                  {step === 'practice' && (
                    <div className="slide-in">
                      {/* KA 5-level grid */}
                      <div className="grid grid-cols-5 gap-2 mb-5">
                        {[0,1,2,3,4].map(l => {
                          const ml = MASTERY[l];
                          const isActive = l === level;
                          return (
                            <div key={l} className="p-3 rounded-xl border text-center transition-all"
                              style={{ background: isActive ? ml.bg : 'rgba(255,255,255,0.03)', borderColor: isActive ? ml.border : 'rgba(255,255,255,0.07)' }}>
                              <MasteryDot level={l} size={22} pulse={isActive} />
                              <p className="text-[9px] font-bold mt-1.5" style={{ color: isActive ? ml.color : '#4b5563' }}>{ml.label}</p>
                              <p className="text-[8px] text-gray-700 mt-0.5">{ml.points}pts</p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mb-5 p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <MasteryProgress level={level} pts={m.points} />
                        <div className="mt-3 text-xs text-gray-600">
                          {level < 2 && 'Score ≥70% to reach Familiar.'}
                          {level === 2 && 'Score 100% in practice to reach Proficient.'}
                          {level === 3 && '100% on a Unit Test / Mastery Challenge → Mastered.'}
                          {level === 4 && 'Mastered! Keep practicing to maintain. <70% will demote you.'}
                        </div>
                      </div>

                      <button onClick={() => setLessonPracticeMode(true)} className="w-full py-4 font-black text-white rounded-xl hover:opacity-80 transition" style={{ background: level >= 4 ? '#10b981' : accent }}>
                        {level >= 4 ? 'Practice Again (Maintain Mastery)' : `Start Practice · ${5} Questions →`}
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            /* ── Pathway Overview (unit list) ── */
            if (!user.specialty) return (
              <div className="text-center py-20">
                <h2 className="text-2xl font-bold mb-3">No Pathway Assigned</h2>
                <p className="text-gray-500 mb-6">Complete the diagnostic to get your personalized learning path.</p>
                <button onClick={() => navTo('diagnostic')} className="px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition">Take the Diagnostic →</button>
              </div>
            );

            return (
              <div>
                {/* Path header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h1 className="text-3xl font-black mb-1">{currentPath.label}</h1>
                    <p className="text-gray-500">{currentPath.tagline}</p>
                    <p className="text-sm text-gray-600 mt-1">{mpEarned}/{mpMax} mastery points · {unitsMastered}/{currentPath.units.length} units mastered</p>
                  </div>
                  <CircularProgress pct={courseMastery} accent={accent} size={80} />
                </div>

                {/* Course Challenge button */}
                <button onClick={() => setCourseChallengeMode(true)}
                  className="w-full mb-5 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-left hover:bg-emerald-500/15 transition flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-0.5">Course Challenge</p>
                    <p className="font-bold text-white">Full pathway assessment · Promotes Proficient → Mastered</p>
                  </div>
                  <span className="text-emerald-400 text-lg flex-shrink-0">→</span>
                </button>

                {/* Unit cards */}
                <div className="space-y-5">
                  {currentPath.units.map((unit, idx) => {
                    const us         = pathway[unit.id] || { unlocked: idx === 0, masteryScore: null, lessons:{} };
                    const unitPct    = calcUnitMastery(pathway, unit);
                    const unitPassed = (us.masteryScore||0) >= unit.req;
                    const allFam     = unit.lessons.every(l => (getLessonState(pathway,unit.id,l.id).masteryLevel||0) >= 2);
                    const started    = unit.lessons.filter(l => (getLessonState(pathway,unit.id,l.id).masteryLevel||0) > 0).length;

                    return (
                      <div key={unit.id} className={`border rounded-[22px] overflow-hidden transition-all ${us.unlocked ? currentPath.border : 'border-white/5'} ${!us.unlocked ? 'opacity-40' : ''}`}
                        style={{ background:'rgba(5,5,16,0.75)' }}>

                        {/* Unit header */}
                        <div className="p-5 flex items-center gap-4">
                          <CircularProgress pct={unitPct} accent={unitPassed ? '#10b981' : accent} size={64} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <h3 className="font-black text-base">{unit.title}</h3>
                              {unitPassed && <span className="text-[9px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full shrink-0">MASTERED</span>}
                              {!us.unlocked && <span className="text-[9px] text-gray-600 shrink-0">🔒 Locked</span>}
                            </div>
                            <p className="text-sm text-gray-500">{unit.desc}</p>
                            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                              {unit.lessons.map(l => {
                                const ls = getLessonState(pathway, unit.id, l.id);
                                return <MasteryDot key={l.id} level={ls.masteryLevel||0} size={20} />;
                              })}
                              <span className="text-[10px] text-gray-600 ml-1">{started}/{unit.lessons.length} started · {unitPct}% mastery</span>
                            </div>
                          </div>

                          {us.unlocked && (
                            <div className="flex flex-col gap-2 flex-shrink-0">
                              <button onClick={() => {
                                const first = unit.lessons.find(l => {
                                  const ls = getLessonState(pathway, unit.id, l.id);
                                  return !ls.videoWatched || !ls.articleRead || (ls.masteryLevel||0) < 4;
                                }) || unit.lessons[0];
                                const ls   = getLessonState(pathway, unit.id, first.id);
                                const step = !ls.videoWatched ? 'video' : !ls.articleRead ? 'article' : 'practice';
                                setActiveLessonView({ unit, lesson: first, step });
                              }} className="px-4 py-2 rounded-xl text-sm font-black text-white hover:opacity-80 transition" style={{ background: accent }}>
                                {started === unit.lessons.length ? 'Review' : 'Study →'}
                              </button>
                              {allFam && (
                                <button onClick={() => startMasteryCheck(unit)}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${unitPassed ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}>
                                  {unitPassed ? '★ Retake Test' : 'Unit Test'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Lesson rows */}
                        {us.unlocked && (
                          <div className="border-t border-white/5 divide-y divide-white/5">
                            {unit.lessons.map(lesson => {
                              const ls    = getLessonState(pathway, unit.id, lesson.id);
                              const level = ls.masteryLevel || 0;
                              const step  = !ls.videoWatched ? 'video' : !ls.articleRead ? 'article' : 'practice';
                              const daysSince = ls.lastPracticed ? Math.floor((Date.now() - ls.lastPracticed) / 86400000) : null;
                              return (
                                <button key={lesson.id} onClick={() => setActiveLessonView({ unit, lesson, step })}
                                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/5 transition text-left group">
                                  <MasteryDot level={level} size={22} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold group-hover:text-white transition truncate">{lesson.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <p className="text-xs text-gray-600">{lesson.dur}</p>
                                      {daysSince !== null && daysSince >= 7 && <span className="text-[10px] text-amber-600">{daysSince}d since review</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span title="Video"    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${ls.videoWatched ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-600'}`}>▶</span>
                                    <span title="Article"  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${ls.articleRead ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-600'}`}>A</span>
                                    <span title="Practice" className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${level >= 4 ? 'bg-emerald-500 text-white' : level >= 2 ? 'bg-amber-500 text-white' : 'bg-white/10 text-gray-600'}`}>P</span>
                                    <span className="text-xs font-bold ml-1" style={{ color: MASTERY[level].color }}>{MASTERY[level].dot}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ═══════════════════════════════════════
              QUIZ LIBRARY
          ═══════════════════════════════════════ */}
          {tab === 'quiz' && (
            <div>
              {activeLibQuiz ? (
                <QuizEngine questions={activeLibQuiz} title="Quiz Library" accentColor="#6366f1" onBack={() => setActiveLibQuiz(null)} onFinish={() => setActiveLibQuiz(null)} />
              ) : (
                <div>
                  <h1 className="text-3xl font-black mb-2">Quiz Library</h1>
                  <p className="text-gray-500 mb-6">Practice MCAT questions across all tested categories.</p>
                  <div className="flex gap-2 mb-5 flex-wrap">
                    {['All','Bio/Biochem','Chem/Phys','Psych/Soc'].map(c => (
                      <button key={c} onClick={() => setQuizLibCat(c)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${quizLibCat === c ? 'bg-white text-black border-white' : 'border-white/20 text-gray-400 hover:border-white/40'}`}>{c}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { name:'Biochemistry Essentials',       cat:'Bio/Biochem',  n:5 },
                      { name:'Cardiovascular Physics',         cat:'Chem/Phys',   n:5 },
                      { name:'Genetics & Molecular Biology',   cat:'Bio/Biochem',  n:5 },
                      { name:'Psychosocial & Behavior',        cat:'Psych/Soc',   n:5 },
                      { name:'Organic Chemistry Mechanisms',   cat:'Chem/Phys',   n:5 },
                      { name:'Mixed MCAT Practice',            cat:'All',         n:8 },
                    ].filter(s => quizLibCat === 'All' || s.cat === quizLibCat || s.cat === 'All').map((set, si) => {
                      const qs = buildCategoryQuiz(set.cat === 'All' ? 'All' : set.cat, set.n);
                      return (
                        <div key={si} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-indigo-500/30 transition">
                          <div className="text-xs font-bold text-indigo-400 mb-1">{set.cat === 'All' ? 'Mixed' : set.cat}</div>
                          <h3 className="font-bold mb-4">{set.name}</h3>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">{set.n} questions</span>
                            <button onClick={() => setActiveLibQuiz(qs)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition">Start →</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════
              METABRAIN AI
          ═══════════════════════════════════════ */}
          {tab === 'coach' && (
            <div className="flex flex-col h-[calc(100vh-8rem)]">
              <h1 className="text-3xl font-black mb-6">MetaBrain AI Coach</h1>
              <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                {msgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm'}`}>{m.content}</div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm p-4">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-blue-400 rounded-full bdot1" /><div className="w-2 h-2 bg-blue-400 rounded-full bdot2" /><div className="w-2 h-2 bg-blue-400 rounded-full bdot3" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={msgsEndRef} />
              </div>
              <div className="mt-4">
                <div className="flex gap-2 mb-3 flex-wrap">
                  {['Explain the Nernst equation','How does the lac operon work?','MMI tips for ethics stations','Glycolysis high-yield facts','What causes KA mastery demotion?'].map(p => (
                    <button key={p} onClick={() => setChatInput(p)} className="text-[10px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition">{p}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="Ask about any MCAT concept or study strategy..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 outline-none focus:border-blue-500/50 text-sm placeholder:text-gray-600" />
                  <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="px-6 py-3.5 bg-blue-600 rounded-2xl font-bold text-sm hover:bg-blue-500 disabled:opacity-40 transition">Send</button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════
              AI FLASHCARDS
          ═══════════════════════════════════════ */}
          {tab === 'flashcards' && (
            <div>
              <h1 className="text-3xl font-black mb-2">AI Flashcards</h1>
              <p className="text-gray-500 mb-8">Paste your notes — MetaBrain generates high-yield flashcard decks instantly.</p>
              {activeDeck && flashDecks[activeDeck] ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <button onClick={() => setActiveDeck(null)} className="text-gray-500 hover:text-white text-sm transition">← All Decks</button>
                    <span className="text-xs text-gray-500">{cardIdx + 1} / {flashDecks[activeDeck].length}</span>
                  </div>
                  <div className="flex justify-center mb-6 cursor-pointer" onClick={() => setCardFlipped(f => !f)}>
                    <div className="w-full max-w-lg h-60" style={{ perspective:'1000px' }}>
                      <div className="relative w-full h-full transition-transform duration-500" style={{ transformStyle:'preserve-3d', transform: cardFlipped ? 'rotateY(180deg)' : 'none' }}>
                        <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-[28px] flex flex-col items-center justify-center p-8 text-center backface-hidden">
                          <p className="text-xs text-gray-500 mb-4 uppercase tracking-widest">Front</p>
                          <p className="text-xl font-bold">{flashDecks[activeDeck][cardIdx]?.front}</p>
                        </div>
                        <div className="absolute inset-0 bg-blue-600/20 border border-blue-500/40 rounded-[28px] flex flex-col items-center justify-center p-8 text-center" style={{ backfaceVisibility:'hidden', transform:'rotateY(180deg)' }}>
                          <p className="text-xs text-blue-400 mb-4 uppercase tracking-widest">Back</p>
                          <p className="text-lg text-gray-200">{flashDecks[activeDeck][cardIdx]?.back}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-xs text-gray-600 mb-6">Click card to flip</p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => { setCardIdx(i => Math.max(0, i-1)); setCardFlipped(false); }} disabled={cardIdx === 0} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl font-bold text-sm disabled:opacity-30 hover:bg-white/10 transition">← Prev</button>
                    <button onClick={() => { setCardIdx(i => Math.min(flashDecks[activeDeck].length-1, i+1)); setCardFlipped(false); }} disabled={cardIdx >= flashDecks[activeDeck].length-1} className="px-5 py-2.5 bg-blue-600 rounded-xl font-bold text-sm disabled:opacity-30 hover:bg-blue-500 transition">Next →</button>
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
                      placeholder="Paste your study notes here. MetaBrain will extract 8-12 high-yield flashcards."
                      rows={6} className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-blue-500/50 text-gray-300 placeholder:text-gray-700 resize-none mb-4" />
                    <button onClick={generateFlashcards} disabled={flashLoading || !flashInput.trim()} className="px-6 py-3 bg-blue-600 rounded-xl font-bold text-sm hover:bg-blue-500 disabled:opacity-40 transition">
                      {flashLoading ? 'Generating...' : 'Generate with AI'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════
              E-LIBRARY
          ═══════════════════════════════════════ */}
          {tab === 'elibrary' && (
            <div>
              <h1 className="text-3xl font-black mb-2">E-Library</h1>
              <p className="text-gray-500 mb-6">Curated, high-quality MCAT resources.</p>
              <div className="flex gap-2 mb-4 flex-wrap">
                {['All','Bio/Biochem','Chem/Phys','Psych/Soc'].map(c => (
                  <button key={c} onClick={() => setLibCat(c)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${libCat === c ? 'bg-white text-black border-white' : 'border-white/20 text-gray-400 hover:border-white/40'}`}>{c}</button>
                ))}
              </div>
              <input value={libSearch} onChange={e => setLibSearch(e.target.value)} placeholder="Search resources..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500/50 placeholder:text-gray-600 mb-5" />
              <div className="grid grid-cols-2 gap-4">
                {filteredLib.map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noreferrer" className="p-5 bg-white/5 border border-white/10 rounded-2xl hover:border-blue-500/40 hover:bg-blue-500/5 transition group block">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">{r.type}</span>
                      {r.free ? <span className="text-[10px] font-bold text-emerald-400">FREE</span> : <span className="text-[10px] text-gray-600">Paid</span>}
                    </div>
                    <h3 className="font-bold text-sm mb-2 group-hover:text-white transition">{r.title}</h3>
                    <p className="text-xs text-gray-500">{r.desc}</p>
                  </a>
                ))}
                {filteredLib.length === 0 && <p className="col-span-2 text-center text-gray-600 py-12">No resources match your search.</p>}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════
              PORTFOLIO
          ═══════════════════════════════════════ */}
          {tab === 'portfolio' && (
            <div>
              <h1 className="text-3xl font-black mb-2">Portfolio Builder</h1>
              <p className="text-gray-500 mb-8">Track activities and discover opportunities to strengthen your application.</p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-bold mb-4">My Activities</h2>
                  <div className="space-y-3 mb-4">
                    {portfolio.length === 0 ? (
                      <div className="border border-dashed border-white/10 rounded-2xl p-6 text-center"><p className="text-gray-600 text-sm">Add activities to build your timeline</p></div>
                    ) : portfolio.map((a, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                        <div><p className="font-bold text-sm">{a.title}</p><p className="text-xs text-gray-500">{a.type} · {a.date}</p></div>
                        <button onClick={() => setPortfolio(p => p.filter((_,j) => j!==i))} className="text-red-400/60 hover:text-red-400 text-xs">Remove</button>
                      </div>
                    ))}
                  </div>
                  <PortfolioAdder onAdd={a => setPortfolio(p => [...p, a])} />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-4">Opportunities</h2>
                  <div className="space-y-3">
                    {OPPORTUNITIES.map(op => (
                      <div key={op.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold text-sm">{op.name}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${op.diff==='Elite'?'bg-red-500/20 text-red-400':op.diff==='Competitive'?'bg-yellow-500/20 text-yellow-400':'bg-emerald-500/20 text-emerald-400'}`}>{op.diff}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{op.desc}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-600">Deadline: {op.deadline}</span>
                          <div className="flex gap-2">
                            <button onClick={() => setPortfolio(p => [...p, { title:op.name, type:op.type, date:op.deadline }])} className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-lg hover:bg-white/20 transition">+ Add</button>
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

          {/* ═══════════════════════════════════════
              INTERVIEW SIMULATOR
          ═══════════════════════════════════════ */}
          {tab === 'interview' && (
            <div>
              <h1 className="text-3xl font-black mb-2">MMI Interview Simulator</h1>
              <p className="text-gray-500 mb-6">Practice Multiple Mini Interview questions with AI feedback.</p>
              {!interviewQ ? (
                <div>
                  <div className="flex gap-2 mb-5 flex-wrap">
                    {['All','Ethics','Personal','Policy','Professionalism','Motivation','Leadership','Cultural Competency','Reflection','Healthcare Systems','End-of-Life'].map(t => (
                      <button key={t} onClick={() => setInterviewType(t)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${interviewType===t?'bg-white text-black border-white':'border-white/20 text-gray-400 hover:border-white/40'}`}>{t}</button>
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
                  <button onClick={getInterviewFeedback} disabled={interviewLoading || !interviewAnswer.trim()} className="px-6 py-3 bg-violet-600 rounded-xl font-bold text-sm hover:bg-violet-500 disabled:opacity-40 transition mb-6">
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

          {/* ═══════════════════════════════════════
              ADMISSIONS CALCULATOR
          ═══════════════════════════════════════ */}
          {tab === 'admissions' && (
            <div>
              <h1 className="text-3xl font-black mb-2">Admissions Calculator</h1>
              <p className="text-gray-500 mb-8">Compare your profile against top medical schools.</p>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                  <h3 className="font-bold">Your Profile</h3>
                  {[
                    { l:'Cumulative GPA', v:gpa,         fn:setGpa,         ph:'3.85', type:'number', step:'0.01', min:'2', max:'4' },
                    { l:'MCAT (472–528)', v:mcat,         fn:setMcat,        ph:'514',  type:'number' },
                    { l:'Clinical Hours', v:clinicalHrs,  fn:setClinicalHrs, ph:'1000', type:'number' },
                    { l:'Volunteer Hrs',  v:volunteerHrs, fn:setVolunteerHrs,ph:'200',  type:'number' },
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
                            <p className="text-xs text-gray-500">Avg GPA {s.avgGPA} · MCAT {s.avgMCAT} · {s.acceptRate}% accept</p>
                          </div>
                          <span className={`text-xs font-black px-3 py-1 rounded-full ${s.chance==='Safety'?'bg-emerald-500/20 text-emerald-400':s.chance==='Target'?'bg-blue-500/20 text-blue-400':'bg-red-500/20 text-red-400'}`}>{s.chance}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full border border-dashed border-white/10 rounded-2xl flex items-center justify-center">
                      <p className="text-gray-600 text-sm">Enter your profile and click Calculate</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-700">⚠️ Estimates based on published averages. Essays, research, and clinical experience significantly impact outcomes.</p>
            </div>
          )}

          {/* ═══════════════════════════════════════
              ANALYTICS
          ═══════════════════════════════════════ */}
          {tab === 'analytics' && (
            <div>
              <h1 className="text-3xl font-black mb-8">Analytics</h1>
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { label:'Total XP',        val:user.xp.toLocaleString(), sub:`Level ${xpLevel}`,               color:'#f59e0b' },
                  { label:'Mastery Points',   val:`${mpEarned}/${mpMax}`,   sub:`${courseMastery}% course mastery`, color:'#10b981' },
                  { label:'Perfect Sessions', val:user.perfectSessions||0, sub:'100% score sessions',              color:'#3b82f6' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <p className="text-3xl font-black mb-1" style={{ color:s.color }}>{s.val}</p>
                    <p className="font-bold text-sm">{s.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Mastery breakdown */}
              {currentPath && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                  <h3 className="font-bold mb-4">Skill Distribution by Mastery Level</h3>
                  <div className="flex gap-3 mb-4 flex-wrap">
                    {[0,1,2,3,4].map(level => {
                      const count = currentPath.units.reduce((sum, u) =>
                        sum + u.lessons.filter(l => (getLessonState(pathway, u.id, l.id).masteryLevel||0) === level).length, 0);
                      const m = MASTERY[level];
                      return (
                        <div key={level} className="flex-1 p-3 rounded-xl border text-center" style={{ borderColor: m.border, background: m.bg, minWidth: 80 }}>
                          <MasteryDot level={level} size={24} />
                          <p className="text-lg font-black mt-1" style={{ color: m.color }}>{count}</p>
                          <p className="text-[10px] text-gray-500">{m.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category performance */}
              {Object.keys(catPerf).length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                  <h3 className="font-bold mb-6">Category Performance</h3>
                  <div className="space-y-5">
                    {Object.entries(catPerf).map(([cat, data]) => {
                      const avg   = Math.round(data.total / data.count);
                      const color = avg >= 75 ? '#10b981' : avg >= 50 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="font-medium">{cat}</span>
                            <span style={{ color }}>{avg}% avg · Last: {data.last}%</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-2 rounded-full prog-fill" style={{ width:`${avg}%`, background:color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Unit progress */}
              {currentPath && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="font-bold mb-6">Unit Mastery — {currentPath.label}</h3>
                  <div className="space-y-5">
                    {currentPath.units.map(unit => {
                      const pct = calcUnitMastery(pathway, unit);
                      return (
                        <div key={unit.id} className="flex items-center gap-4">
                          <CircularProgress pct={pct} accent={accent} size={52} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-sm truncate">{unit.title}</span>
                              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{pct}%</span>
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                              {unit.lessons.map(l => <MasteryDot key={l.id} level={getLessonState(pathway,unit.id,l.id).masteryLevel||0} size={20} />)}
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

          {/* ═══════════════════════════════════════
              BADGES TAB
          ═══════════════════════════════════════ */}
          {tab === 'badges' && (
            <div>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-black mb-1">Badges</h1>
                  <p className="text-gray-500">{(user.earnedBadges||[]).length} / {BADGES.length} earned</p>
                </div>
                <div className="text-right">
                  {[4,3,2,1,0].map(tier => {
                    const tierName = Object.keys(BADGE_TIERS)[4-tier];
                    const t = BADGE_TIERS[tierName];
                    const count = BADGES.filter(b => b.tier === tierName && (user.earnedBadges||[]).includes(b.id)).length;
                    if (!count) return null;
                    return <p key={tier} className="text-xs font-bold" style={{ color: t.color }}>{count}× {t.label}</p>;
                  })}
                </div>
              </div>

              {/* Filter */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {['All','XP','Mastery','Units','Streaks','Scores','MC','CC','Special'].map(g => (
                  <button key={g} onClick={() => setBadgesGroupFilter(g)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${badgesGroupFilter===g?'bg-white text-black border-white':'border-white/20 text-gray-400 hover:border-white/40'}`}>{g}</button>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-3">
                {BADGES
                  .filter(b => badgesGroupFilter === 'All' || b.group === badgesGroupFilter)
                  .map(badge => {
                    const earned = (user.earnedBadges||[]).includes(badge.id);
                    return <BadgeCard key={badge.id} badge={badge} earned={earned} />;
                  })
                }
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════
              SETTINGS
          ═══════════════════════════════════════ */}
          {tab === 'settings' && (
            <div>
              <h1 className="text-3xl font-black mb-2">Settings</h1>
              <p className="text-gray-500 mb-8">Customize your MedSchoolPrep experience.</p>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-lg">
                <h3 className="font-bold mb-5">Your Profile</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Display Name</label>
                    <input value={settingsName || user.name} onChange={e => setSettingsName(e.target.value)} placeholder="Your name"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Specialty Path</label>
                    <select value={user.specialty || ''} onChange={e => {
                      const sp = e.target.value;
                      setUser(u => ({ ...u, specialty: sp || null }));
                      if (sp) {
                        const init = {};
                        PATHS[sp].units.forEach((u, i) => { init[u.id] = { unlocked: i === 0, masteryScore: null, lessons:{} }; });
                        setPathway(prev => ({ ...init, ...prev }));
                      }
                    }} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 text-sm">
                      <option value="">No pathway selected</option>
                      {Object.entries(PATHS).map(([id, p]) => <option key={id} value={id}>{p.icon} {p.label}</option>)}
                    </select>
                  </div>

                  {/* Stats summary */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {[
                      { label:'Total XP',            val: user.xp.toLocaleString() },
                      { label:'Badges Earned',        val: `${(user.earnedBadges||[]).length} / ${BADGES.length}` },
                      { label:'Perfect Sessions',     val: user.perfectSessions || 0 },
                      { label:'Mastery Challenges',   val: user.masteryChallengeDone || 0 },
                    ].map(s => (
                      <div key={s.label} className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-gray-500">{s.label}</p>
                        <p className="font-bold">{s.val}</p>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => {
                    if (settingsName.trim()) setUser(u => ({ ...u, name: settingsName.trim() }));
                    setSettingsSaved(true);
                    setTimeout(() => setSettingsSaved(false), 2000);
                  }} className="w-full py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-500 transition">
                    {settingsSaved ? 'Saved! ✓' : 'Save Changes'}
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <h3 className="font-bold mb-3 text-red-400">Danger Zone</h3>
                  <button onClick={() => {
                    if (window.confirm('Reset all progress? This cannot be undone.')) {
                      ['msp_user','msp_pathway','msp_flash','msp_port','msp_catperf'].forEach(k => localStorage.removeItem(k));
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
