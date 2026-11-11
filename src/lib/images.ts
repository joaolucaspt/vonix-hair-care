// Fotos de produto: o catálogo (products.json), o feed do Meta e as prévias de compartilhamento continuam em JPG;
// na tela do site usamos a versão WebP, que é cerca de 44% mais leve e abre mais rápido no celular.
export const webp = (src: string) => src.replace(/\.jpe?g$/i, ".webp");
