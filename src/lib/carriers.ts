/** Transportadoras que a loja oferece no checkout. As demais cotações do Melhor Envio são descartadas. */
const ALLOWED = ["jet", "j&t", "jadlog", "correios"];

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export const isAllowedCarrier = (company: string) => {
  const name = normalize(company);
  return ALLOWED.some((a) => name === a || name.startsWith(`${a} `));
};
