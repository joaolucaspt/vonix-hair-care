// Fotos de produto: o catálogo (products.json), o feed do Meta e as prévias de compartilhamento continuam em JPG;
// na tela do site usamos a versão WebP, que é cerca de 44% mais leve e abre mais rápido no celular.
export const webp = (src: string) => src.replace(/\.jpe?g$/i, ".webp");

/** Versão leve (480 px) usada nos cards; a foto cheia continua na página do produto. */
export const thumb = (src: string) => webp(src).replace(/\.webp$/i, "-480.webp");
