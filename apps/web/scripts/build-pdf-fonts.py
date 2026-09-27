# Regenerates public/fonts/Cairo-{Regular,Bold}.ttf, the fonts the PDFs use
# (lib/pdf-fonts.ts).
#
# Usage (needs Python 3 and fontTools: `pip install fonttools`):
#   curl -LO "https://github.com/google/fonts/raw/main/ofl/cairo/Cairo%5Bslnt,wght%5D.ttf"
#   python3 scripts/build-pdf-fonts.py "Cairo[slnt,wght].ttf" public/fonts
#
# Afterwards, download the PDFs in Arabic and check that the space survives
# in words such as "التطعيمات في".
"""Build static Cairo TTFs for @react-pdf/renderer from Google's variable font.

react-pdf 4.x drops GPOS x-placement offsets when drawing (xOffset is passed to
the PDF writer unscaled), so Cairo's RTL kerning pairs (XPlacement == XAdvance
on the first glyph) push glyphs into the following space. Its text engine always
shapes in LTR logical order and then reverses runs, so an equivalent kern is an
XAdvance on the pair's *second* glyph, which the renderer handles correctly.
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.otlLib.builder import buildValue

src, outdir = sys.argv[1], sys.argv[2]
for name, wght in (("Regular", 400), ("Bold", 700)):
    vf = TTFont(src)
    font = instancer.instantiateVariableFont(vf, {"wght": wght, "slnt": 0}, updateFontNames=True)
    gpos = font["GPOS"].table
    moved = 0
    for lookup in gpos.LookupList.Lookup:
        if lookup.LookupType != 2:
            continue
        for st in lookup.SubTable:
            if st.ValueFormat1 & 0x0001 == 0 or st.ValueFormat2 != 0:
                continue
            assert st.Format == 2, "only class-based pair kerning expected"
            for c1 in st.Class1Record:
                for c2 in c1.Class2Record:
                    v = c2.Value1
                    p = (getattr(v, "XPlacement", 0) or 0) if v else 0
                    a = (getattr(v, "XAdvance", 0) or 0) if v else 0
                    assert p == a, (p, a)
                    c2.Value1 = None
                    c2.Value2 = buildValue({"XAdvance": p}) if p else buildValue({"XAdvance": 0})
                    moved += bool(p)
            st.ValueFormat1 = 0
            st.ValueFormat2 = 0x0004
    font.save(f"{outdir}/Cairo-{name}.ttf")
    print(name, "moved RTL kern pairs:", moved)
