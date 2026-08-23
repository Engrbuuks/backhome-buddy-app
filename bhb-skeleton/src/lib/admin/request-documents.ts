/** Documents/items an admin can request a buddy to provide IN THEIR PORTAL.
 *  Kept aligned with the buddy Verification page so every requested item has a
 *  real place to be uploaded/entered (ID, proof of address, PCC uploads;
 *  guarantors, next of kin, bank details forms). */
export const REQUESTABLE_ITEMS: ReadonlyArray<readonly [string, string]> = [
  ["passport_photo", "Passport photograph: a recent, clear passport-style photo (becomes your profile photo)"],
  ["id_doc", "Government-issued ID: upload a clear photo/scan (NIN slip, driver's licence, or international passport)"],
  ["nin_slip", "NIN slip: upload a clear photo of your NIN slip, and enter your NIN number"],
  ["utility_bill", "Proof of address: a recent utility bill (not older than 3 months)"],
  ["pcc", "Police Character Certificate: upload the certificate (or note the reference if in progress)"],
  ["cv", "CV / résumé: upload as a PDF or a clear photo"],
  ["guarantors", "Two guarantors: full name, phone, address, occupation and relationship for each"],
  ["next_of_kin", "Next of kin: full name, phone and relationship"],
  ["bank_details", "Payout bank details: bank name, account number and account name (under the Payout Details tab)"],
];
