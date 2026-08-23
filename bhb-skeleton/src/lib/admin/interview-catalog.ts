/** The Backhome Buddy interview, as structured data so it can be rendered and
 *  scored inside the app. Mirrors the interviewer guide. Edit here to change the
 *  questions; the in-app interview runner reads from this. */

export type InterviewQuestion = {
  key: string;            // stable id, used as the answer map key
  q: string;              // the question text
  why?: string;          // why we ask (shown to interviewer)
  followup?: string;      // optional follow-up prompt
  goods: string[];        // good answers show…
  reds: string[];         // red flags
  honesty?: boolean;      // honesty question — a red flag here can disqualify
};

export type InterviewSection = {
  key: string;
  title: string;
  minutes: number;
  intro?: string;
  questions: InterviewQuestion[];
};

export const INTERVIEW: ReadonlyArray<InterviewSection> = [
  {
    key: "opening", title: "Opening", minutes: 4,
    intro: "Put them at ease and get them talking.",
    questions: [
      { key: "intro_self", q: "Tell me a little about yourself and where you're based.",
        why: "Warms them up, and confirms real location/coverage against their application.",
        followup: "Which specific areas can you easily reach — and how do you get around?",
        goods: ["Clear, confident, easy to follow", "Location matches application", "Personable and calm"],
        reds: ["Evasive about where they live", "Location doesn't match", "Very poor communication"] },
      { key: "motivation", q: "What made you want to become a Backhome Buddy?",
        why: "Reveals whether they understand the role and whether their motivation is sound.",
        followup: "What do you think the hardest part of this work would be?",
        goods: ["Understands it's about trust and helping", "Realistic about the work", "Grounded motivation"],
        reds: ["Thinks it's easy money", "No idea what the role involves", "Motivation feels off"] },
    ],
  },
  {
    key: "honesty", title: "Honesty & Integrity", minutes: 10,
    intro: "The core of the interview. Tests how they behave when honesty is costly.",
    questions: [
      { key: "property_truth", honesty: true,
        q: "You're sent to verify a property a client is about to buy. It's in poor condition — cracked walls, not what they expect. The client is excited and hoping for good news. What do you do?",
        why: "The single most important question. Tests whether they tell a hard truth or soften it. Property fraud is where clients lose the most money.",
        goods: ["Reports exactly what they see", "Understands client pays for truth, not comfort", "Would document defects with photos", "Comfortable delivering bad news kindly"],
        reds: ["Would soften or hide problems", "Prioritises 'keeping client happy' over accuracy", "Hesitates about reporting defects", "Any hint they'd shade the truth"] },
      { key: "leftover_money", honesty: true,
        q: "You're buying items for a client with their money and get everything for less than they gave you. There's money left over. What happens to it?",
        why: "A clean, direct honesty test.",
        followup: "How would you show the client exactly what was spent?",
        goods: ["Immediately: return it / account for it", "Talks about receipts and transparency", "Treats it as the client's money"],
        reds: ["Hesitates or jokes about keeping it", "Suggests it's a fair 'bonus'", "Vague about accounting"] },
      { key: "hard_news", honesty: true,
        q: "Tell me about a time you had to give someone news you knew they didn't want to hear. What happened?",
        why: "Past behaviour predicts future behaviour — tests demonstrated honesty, not hypothetical.",
        goods: ["Genuine, specific example", "Chose honesty though uncomfortable", "Handled with tact"],
        reds: ["Can't think of any example", "Story shows they avoided the truth", "Blames others"] },
      { key: "bribe", honesty: true,
        q: "At a government office, staff say your client's document will be 'stuck' unless you pay a small something extra. What do you do?",
        why: "Tests response to bribery and mild pressure. Backhome Buddy does not pay bribes.",
        goods: ["Would not pay the bribe", "Would report it and seek guidance", "Understands paying creates risk"],
        reds: ["Would just pay to 'get it done'", "Sees bribery as normal", "Would pay and add to expenses"] },
    ],
  },
  {
    key: "judgment", title: "Judgment & Safety", minutes: 8,
    intro: "Tests how they think when things go wrong — because they will.",
    questions: [
      { key: "welfare_unwell",
        q: "You arrive for a welfare visit to a client's elderly mother. She seems unwell and confused, and isn't expecting you. How do you handle it?",
        why: "Tests empathy, respect for elders, judgment in a sensitive situation.",
        goods: ["Warm, patient, respectful of the elder", "Would reassure and explain gently", "Would report her condition honestly", "Puts her dignity first"],
        reds: ["Impatient or dismissive", "Would force the task regardless", "Would hide concerns", "No empathy"] },
      { key: "unsafe",
        q: "You're on a task and it starts to feel unsafe — the area, the people, something's off. What do you do?",
        why: "Tests whether they take dangerous risks. Right instinct: safety first, leave, report.",
        followup: "Would you feel able to tell us a task couldn't be done because it wasn't safe?",
        goods: ["Would leave and prioritise safety", "Understands no task is worth harm", "Would report and reschedule"],
        reds: ["Would push on despite feeling unsafe", "Bravado about handling anything", "Doesn't take safety seriously"] },
      { key: "unexpected",
        q: "You're halfway through a task and something unexpected happens you're not sure how to handle. What do you do?",
        why: "Tests honest escalation vs risky improvisation.",
        goods: ["Would contact the team for guidance", "Comfortable saying 'let me check'", "Documents honestly"],
        reds: ["Would guess and hope", "Reluctant to admit uncertainty", "Would abandon without reporting"] },
    ],
  },
  {
    key: "reliability", title: "Reliability & Fit", minutes: 6,
    intro: "Confirms the practical basics and dependability.",
    questions: [
      { key: "reliability_ex",
        q: "This work depends completely on people doing what they said, when they said. Honestly — how reliable are you, with an example?",
        why: "Reliability is make-or-break.",
        goods: ["Honest, grounded self-assessment", "Backs it with a real example", "Understands why it matters"],
        reds: ["Over-claims perfection, no example", "Vague or defensive", "History of letting people down"] },
      { key: "preparation",
        q: "Walk me through what you'd carry and how you'd prepare before heading out for a task.",
        why: "Confirms practical readiness and that they have the tools.",
        followup: "How comfortable are you taking clear photos and short videos on your phone?",
        goods: ["Charged smartphone, ID, transport", "Thinks about preparation and route", "Working phone for photos/video"],
        reds: ["No reliable smartphone", "No thought about preparation", "Can't get around their area"] },
      { key: "confidentiality",
        q: "Everything you see on a task — the family, the home, the situation — is private. How do you feel about that, and how would you handle it?",
        why: "Confirms they take confidentiality seriously before signing the NDA.",
        goods: ["Takes confidentiality seriously", "Wouldn't discuss or post about tasks", "Understands why privacy matters"],
        reds: ["Casual about sharing", "Doesn't see the issue", "Likely to gossip"] },
    ],
  },
  {
    key: "closing", title: "Closing", minutes: 2,
    questions: [
      { key: "their_questions",
        q: "Do you have any questions for us? And is there anything about this role you're unsure about?",
        why: "Good candidates ask thoughtful questions. Last chance for dealbreakers to surface.",
        goods: ["Thoughtful, relevant questions", "Honest about concerns", "Genuine interest"],
        reds: ["No engagement", "Only asks about money", "Reveals a dealbreaker"] },
    ],
  },
];

export const ALL_QUESTIONS = INTERVIEW.flatMap((s) => s.questions);
export function isHonesty(key: string) { return ALL_QUESTIONS.find((q) => q.key === key)?.honesty ?? false; }
