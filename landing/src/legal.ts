/**
 * Operator details shown in the legal documents. The service is a prototype
 * built for the MAX hackathon, so the defaults describe a fictional demo
 * company; a real operator overrides them with VITE_LEGAL_OPERATOR_* at build time.
 */
const env = import.meta.env;

export const legalOperator = {
  name: env.VITE_LEGAL_OPERATOR_NAME || "ООО «ПрактикаПлюс Лаб» — вымышленная компания для хакатона MAX",
  inn: env.VITE_LEGAL_OPERATOR_INN || "0000000000 (демо)",
  ogrn: env.VITE_LEGAL_OPERATOR_OGRN || "0000000000000 (демо)",
  address: env.VITE_LEGAL_OPERATOR_ADDRESS || "355000, г. Ставрополь (демонстрационный адрес)",
  email: env.VITE_LEGAL_OPERATOR_EMAIL || "privacy@praktikaplus.example",
  date: env.VITE_LEGAL_EFFECTIVE_DATE || "29 сентября 2026 г.",
};

/** True while the built-in fictional hackathon details are in use. */
export const legalIsDemo = !env.VITE_LEGAL_OPERATOR_NAME;
