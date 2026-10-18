/*
 * Company identity printed on documents, from the company's own document
 * templates (AF7 sales tax invoice, gate pass, packing list). Phone, email,
 * tax registration and bank details are not on those templates, so they
 * stay empty until an administrator fills them in (Settings → Company
 * profile). Documents print only the fields that have a value.
 */

export const COMPANY = {
  name: "AF7",
  legalName: "Apparel Fastener (Pvt) Ltd",
  address: "Plot# 33 B Punjab Small Sundar Industrial Estate II, Raiwind Road, Lahore, Pakistan 54000",
  phone: "",
  email: "",
  taxRegistration: "",
  website: "www.af7.com.pk",
  bankName: "",
  accountName: "",
  accountNumber: "",
  iban: "",
  swiftCode: "",
  bankBranch: "",
  productionTime: "",
  paymentTerms: "",
  shipmentTerms: "",
  shipmentMode: "",
  portOfLoading: "",
  countryOfOrigin: "Pakistan",
};
