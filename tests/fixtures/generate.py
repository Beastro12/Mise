"""Generate two-recipes.docx and two-recipes.pdf from two-recipes.md (stdlib only).

Run: python3 tests/fixtures/generate.py
"""
import pathlib
import zipfile
from xml.sax.saxutils import escape

HERE = pathlib.Path(__file__).parent
lines = (HERE / "two-recipes.md").read_text(encoding="utf-8").splitlines()


def make_docx(path: pathlib.Path) -> None:
    paras = "".join(
        f'<w:p><w:r><w:t xml:space="preserve">{escape(l)}</w:t></w:r></w:p>' for l in lines
    )
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{paras}</w:body></w:document>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document)


def pdf_str(s: str) -> str:
    out = []
    for ch in s:
        b = ch.encode("cp1252")[0]
        if ch in "()\\":
            out.append("\\" + ch)
        elif b < 32 or b > 126:
            out.append("\\%03o" % b)
        else:
            out.append(ch)
    return "(" + "".join(out) + ")"


def make_pdf(path: pathlib.Path) -> None:
    text_ops = ["BT", "/F1 11 Tf", "14 TL", "50 800 Td"]
    for l in lines:
        text_ops.append(f"{pdf_str(l)} Tj T*")
    text_ops.append("ET")
    stream = "\n".join(text_ops).encode("latin-1")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    path.write_bytes(bytes(out))


make_docx(HERE / "two-recipes.docx")
make_pdf(HERE / "two-recipes.pdf")
print("wrote two-recipes.docx and two-recipes.pdf")
