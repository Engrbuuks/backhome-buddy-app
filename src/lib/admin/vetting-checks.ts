/** The checks that must ALL be ticked before a buddy can be approved.
 *  Shared by server actions (approval gate) and the admin UI (checklist). */
export const VETTING_CHECKS: ReadonlyArray<readonly [string, string]> = [
  ["nda_signed", "NDA signed by buddy (in-app)"],
  ["cv_received", "CV received"],
  ["id_verified", "ID document verified (matches name + photo)"],
  ["nin_checked", "NIN checked"],
  ["address_verified", "Address verified (utility bill / visit)"],
  ["guarantor1_verified", "Guarantor 1 contacted & confirmed"],
  ["guarantor2_verified", "Guarantor 2 contacted & confirmed"],
  ["pcc_received", "Police Character Certificate received"],
  ["interview_done", "Interview completed"],
  ["training_done", "Training completed"],
];
