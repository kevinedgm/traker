# Activos de marca de Traker

## Marca canónica

`public/brand/koto-logo.svg` conserva el nombre interno del archivo original
para mantener la procedencia del vector exacto entregado por el propietario.
En Traker ese vector es el símbolo canónico: no es una segunda marca visible ni
una aproximación regenerada. Su título accesible identifica “Símbolo de
Traker”, y los wrappers, iconos, manifest, favicon y superficies de producto lo
presentan únicamente como Traker.

No se debe redibujar, trazar, convertir con IA ni sustituir por una variante
aproximada. Un futuro cambio de nombre físico debe ser una migración de assets
con comprobación de todas las rutas PWA y no una edición de la geometría.

## Inventario

- `koto-logo.svg`: vector fuente canónico, negro transparente.
- `traker-logo.svg`: wrapper cuadrado de color para superficies de marca.
- `traker-logo-mono.svg`: wrapper monocromático.
- `help-mascot.webp`: único activo ilustrado piloto; se mantiene sin familia
  adicional hasta aprobación visual humana.
- `icons/*.svg` y `icons/*.png`: derivados PWA con tamaños declarados.
- `favicon.svg`: wrapper legado conservado como fuente de compatibilidad; el
  runtime actual usa el PNG de 192 px para favicon y Apple touch icon.

Los PNG y el WebP actuales suman menos de 75 KiB. Cualquier nueva familia de
ilustraciones debe medirse contra LCP, bundle y precache antes de integrarse.

