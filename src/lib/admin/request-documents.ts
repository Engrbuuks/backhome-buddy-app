/** Documents/items an admin can request a buddy to send by replying to the email.
 *  Separate from VETTING_CHECKS (which are admin actions like interviews). */
export const REQUESTABLE_ITEMS: ReadonlyArray<readonly [string, string]> = [
  ["id_doc", "A clear photo/scan of your government-issued ID (NIN slip, driver's licence, or international passport)"],
  ["nin", "Your National Identification Number (NIN)"],
  ["utility_bill", "A recent utility bill or proof of address (not older than 3 months)"],
  ["passport_photo", "A recent passport-style photograph"],
  ["pcc", "Your Police Character Certificate (or the reference number if in progress)"],
  ["guarantor1", "Guarantor 1's details: full name, phone, address, occupation and relationship to you"],
  ["guarantor2", "Guarantor 2's details: full name, phone, address, occupation and relationship to you"],
  ["next_of_kin", "Next of kin details: full name, phone, address and relationship"],
  ["bank_details", "Your bank details for payouts: bank name, account number and account name"],
  ["cv", "Your CV / résumé"],
];
