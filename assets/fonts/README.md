# Icon fonts

`fa-solid-subset.woff2` and `fa-brands-subset.woff2` are subsets of
Font Awesome Free 6.5.2, cut down to only the code points this site renders
(14 glyphs). Together they are ~2.8 KB, against ~274 KB for the two full
faces the CDN serves.

Font Awesome Free is by Fonticons, Inc. — https://fontawesome.com
- Icons: CC BY 4.0
- Fonts: SIL OFL 1.1
- Code: MIT

To regenerate after adding an icon: add its code point to the relevant list
(see `assets/css/icons.css` for the glyph map), then

    curl -O https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/webfonts/fa-solid-900.woff2
    curl -O https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/webfonts/fa-brands-400.woff2
    uv run --with fonttools --with brotli pyftsubset fa-solid-900.woff2 \
      --output-file=fa-solid-subset.woff2 --flavor=woff2 --layout-features= \
      --no-hinting --desubroutinize --unicodes=U+F0E0,U+F15C,...
