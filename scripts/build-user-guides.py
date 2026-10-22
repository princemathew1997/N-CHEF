"""Build the four role-specific PDFs from their Markdown wiki sources.

Requires reportlab, Pillow and pypdf. Optional --render uses Poppler pdftoppm.
Run from any directory: python scripts/build-user-guides.py [--render]
"""
from pathlib import Path
import argparse
import html
import re
import shutil
import subprocess

from PIL import Image as PillowImage
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
import reportlab
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, PageBreak, PageTemplate, Paragraph, Spacer,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs' / 'user-guides'
OUT = ROOT / 'output' / 'pdf'
GOLD = colors.HexColor('#b07b00')
INK = colors.HexColor('#202733')
# Embed ReportLab's bundled fonts so shared PDFs render consistently on other devices.
FONT_DIR = Path(reportlab.__file__).parent / 'fonts'
pdfmetrics.registerFont(TTFont('GuideSans', str(FONT_DIR / 'Vera.ttf')))
pdfmetrics.registerFont(TTFont('GuideSans-Bold', str(FONT_DIR / 'VeraBd.ttf')))
pdfmetrics.registerFontFamily('GuideSans', normal='GuideSans', bold='GuideSans-Bold', italic='GuideSans', boldItalic='GuideSans-Bold')
STYLES = getSampleStyleSheet()
STYLES.add(ParagraphStyle(name='GuideTitle', fontName='GuideSans-Bold', fontSize=30, leading=36, textColor=INK, spaceAfter=20))
STYLES.add(ParagraphStyle(name='Section', fontName='GuideSans-Bold', fontSize=19, leading=24, textColor=INK, spaceAfter=14, keepWithNext=True))
STYLES.add(ParagraphStyle(name='Subsection', fontName='GuideSans-Bold', fontSize=11, leading=15, textColor=GOLD, spaceBefore=10, spaceAfter=5, keepWithNext=True))
STYLES.add(ParagraphStyle(name='GuideBody', fontName='GuideSans', fontSize=10, leading=14.5, textColor=INK, spaceAfter=8))
STYLES.add(ParagraphStyle(name='GuideList', parent=STYLES['GuideBody'], leftIndent=16, firstLineIndent=-14, spaceAfter=6))
STYLES.add(ParagraphStyle(name='GuideNote', parent=STYLES['GuideBody'], backColor=colors.HexColor('#fff5d8'), borderPadding=9, spaceBefore=7, spaceAfter=15))
STYLES.add(ParagraphStyle(name='Caption', fontName='GuideSans', fontSize=8, leading=11, textColor=colors.HexColor('#4f5864'), spaceBefore=6, spaceAfter=10))


def inline(text):
    text = html.escape(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    # Wiki relative links remain readable in a standalone PDF; contents are linked separately.
    return re.sub(r'\[([^]]+)\]\(([^)]+)\)', r'\1', text)


class GuideDoc(BaseDocTemplate):
    def __init__(self, target, role):
        super().__init__(str(target), pagesize=A4, leftMargin=19*mm, rightMargin=19*mm,
                         topMargin=21*mm, bottomMargin=19*mm,
                         title=f'N-CHEF {role} guide', author='N-CHEF', pageCompression=1)
        self.role = role
        self.addPageTemplates(PageTemplate(id='guide', frames=[Frame(self.leftMargin, self.bottomMargin, self.width, self.height, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=self.decorate))

    def decorate(self, canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(1)
        canvas.line(self.leftMargin, A4[1]-15*mm, A4[0]-self.rightMargin, A4[1]-15*mm)
        canvas.setFont('GuideSans-Bold', 9)
        canvas.setFillColor(INK)
        canvas.drawString(self.leftMargin, A4[1]-12*mm, 'n.chef  /  USER GUIDES')
        canvas.setFont('GuideSans', 8)
        canvas.drawRightString(A4[0]-self.rightMargin, A4[1]-12*mm, self.role.upper())
        canvas.setFillColor(colors.HexColor('#68717d'))
        canvas.drawString(self.leftMargin, 11*mm, 'Revision 22 October 2026  |  N-CHEF 2.3.0')
        canvas.drawRightString(A4[0]-self.rightMargin, 11*mm, str(doc.page))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == 'Section':
            text = flowable.getPlainText()
            key = 'section-' + re.sub(r'\W+', '-', text)
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, 0)
            self.notify('TOCEntry', (0, text, self.page, key))


def build(role):
    source = SOURCE / f'{role}.md'
    text = source.read_text(encoding='utf-8')
    lines = text.splitlines()
    story = [Spacer(1, 28*mm), Paragraph(inline(lines[0][2:]), STYLES['GuideTitle'])]
    intro_end = next(i for i, line in enumerate(lines) if line.startswith('## '))
    for line in lines[1:intro_end]:
        if line.strip():
            story.append(Paragraph(inline(line), STYLES['GuideBody']))
    story.extend([Spacer(1, 12*mm), Paragraph('Contents', STYLES['Subsection'])])
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle(name='GuideContents', fontName='GuideSans', fontSize=10, leading=19, leftIndent=0, rightIndent=22, textColor=INK)]
    story.append(toc)
    blocks = re.split(r'\n\s*\n', '\n'.join(lines[intro_end:]))
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        if block.startswith('## '):
            story.extend([PageBreak(), Paragraph(inline(block[3:]), STYLES['Section'])])
        elif block.startswith('### '):
            story.append(Paragraph(inline(block[4:]), STYLES['Subsection']))
        elif match := re.fullmatch(r'!\[([^]]*)\]\(([^)]+)\)', block):
            path = (SOURCE / match[2]).resolve()
            if not path.is_file():
                raise FileNotFoundError(path)
            with PillowImage.open(path) as image:
                w, h = image.size
            scale = min((A4[0]-38*mm)/w, 290/h)
            story.append(Image(str(path), width=w*scale, height=h*scale, hAlign='LEFT'))
        elif block.startswith('> '):
            story.append(Paragraph(inline(block[2:]), STYLES['GuideNote']))
        elif block.startswith('- ') or re.match(r'^\d+\. ', block):
            for line in block.splitlines():
                if line.startswith('- '):
                    value = '- ' + inline(line[2:])
                else:
                    value = inline(line)
                story.append(Paragraph(value, STYLES['GuideList']))
        else:
            style = 'Caption' if block.startswith('Sample data') else 'GuideBody'
            story.append(Paragraph(inline(block.replace('\n', ' ')), STYLES[style]))
    target = OUT / f'nchef-{role}-guide.pdf'
    GuideDoc(target, {'admin':'Admin','supervisor':'Executive Chef','purchaser':'Purchaser (Supervisor)','chef':'Cuisine Head'}[role]).multiBuild(story)
    reader = PdfReader(target)
    extracted = '\n'.join(page.extract_text() for page in reader.pages)
    normalize = lambda s: re.sub(r'\s+', ' ', s).strip()
    # Require all source prose, list items, titles and captions to survive the export.
    for line in lines:
        if not line.strip() or line.startswith('!['):
            continue
        plain = re.sub(r'^#{1,3} |^> ', '', line).replace('**', '')
        assert normalize(plain) in normalize(extracted), f'Missing PDF text: {role}: {plain}'
    assert all(page.mediabox.width == A4[0] or abs(float(page.mediabox.width)-A4[0]) < .01 for page in reader.pages)
    print(f'{target.name}: {len(reader.pages)} A4 pages; source text verified')
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render', action='store_true')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    for role in ('admin', 'supervisor', 'purchaser', 'chef'):
        target = build(role)
        if args.render:
            renderer = shutil.which('pdftoppm')
            if not renderer:
                raise SystemExit('Install Poppler and put pdftoppm on PATH to render for visual review.')
            preview = ROOT / 'tmp' / 'pdfs'
            preview.mkdir(parents=True, exist_ok=True)
            subprocess.run([renderer, '-scale-to', '1100', '-png', str(target), str(preview / role)], check=True)
