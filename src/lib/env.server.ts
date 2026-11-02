/** Server-only secrets and settings. Never import this from client code. */
export const env = (name: string, fallback = "") => process.env[name] ?? fallback;

export const requireEnv = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
};
