/** The Non-Disclosure & Confidentiality Agreement every buddy signs during
 *  onboarding. Update NDA_VERSION whenever the text materially changes so
 *  existing signatures remain traceable to the version signed. */

export const NDA_VERSION = "1.0";

export const NDA_TITLE = "Backhome Buddy — Non-Disclosure & Confidentiality Agreement";

/** Plain-text clauses. Rendered on the sign page and in the record. */
export const NDA_CLAUSES: ReadonlyArray<{ heading: string; body: string }> = [
  {
    heading: "1. Purpose",
    body: "As a Backhome Buddy, you will be trusted with private information about clients, their families, their homes, their property, and their affairs. This Agreement sets out your duty to keep that information confidential.",
  },
  {
    heading: "2. Confidential Information",
    body: "Confidential Information includes, without limitation: client identities and contact details; details of any task, property, document, or family matter; photographs, videos, and reports you capture; addresses and locations; payment and financial information; and any information about Backhome Buddy's operations, systems, or other buddies. It applies whether the information is spoken, written, digital, or observed.",
  },
  {
    heading: "3. Your Obligations",
    body: "You agree to: (a) keep all Confidential Information strictly private; (b) use it only to carry out the specific task assigned to you; (c) never share, sell, publish, or discuss it with any third party, including on social media; (d) never contact a client, their family, or a recipient for any purpose beyond the assigned task; and (e) protect any documents, photos, or videos in your possession and delete or return them when the task is complete or when asked.",
  },
  {
    heading: "4. Integrity of Proof",
    body: "You agree that all photos, videos, and reports you submit will be genuine, captured by you in person at the actual location, and never staged, edited to mislead, reused from another task, or fabricated in any way, including with artificial intelligence tools. Falsifying proof is grounds for immediate removal and may be reported to the authorities.",
  },
  {
    heading: "5. No Direct Dealing",
    body: "You agree not to solicit, accept, or carry out work directly from a Backhome Buddy client outside the platform, either during your engagement or for twelve (12) months after it ends.",
  },
  {
    heading: "6. Consequences of Breach",
    body: "Breaching this Agreement may result in immediate termination of your engagement, forfeiture of pending payments, and legal action. You may be held liable for any loss or damage caused by your breach.",
  },
  {
    heading: "7. Duration",
    body: "Your confidentiality obligations continue during your time as a Backhome Buddy and remain in force indefinitely after it ends.",
  },
  {
    heading: "8. Governing Law",
    body: "This Agreement is governed by the laws of the Federal Republic of Nigeria.",
  },
  {
    heading: "9. Acknowledgement",
    body: "By typing your full legal name and confirming below, you acknowledge that you have read, understood, and agree to be bound by this Agreement. You agree that this electronic signature is valid and binding.",
  },
];
