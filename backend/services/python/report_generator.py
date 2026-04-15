from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak
import io
from datetime import datetime

PRIMARY = colors.HexColor('#185FA5')
LIGHT_BG = colors.HexColor('#F0F7FD')
BORDER = colors.HexColor('#B5D4F4')

def build_styles():
    styles = getSampleStyleSheet()
    return {
        'Title': ParagraphStyle('Title', parent=styles['Normal'], fontSize=20, fontName='Helvetica-Bold', textColor=PRIMARY, spaceAfter=6),
        'H1': ParagraphStyle('H1', parent=styles['Normal'], fontSize=14, fontName='Helvetica-Bold', textColor=PRIMARY, spaceBefore=16, spaceAfter=6),
        'H2': ParagraphStyle('H2', parent=styles['Normal'], fontSize=12, fontName='Helvetica-Bold', textColor=colors.HexColor('#2C5282'), spaceBefore=12, spaceAfter=4),
        'Body': ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, fontName='Helvetica', leading=14, spaceBefore=2, spaceAfter=4),
        'Caption': ParagraphStyle('Caption', parent=styles['Normal'], fontSize=8, fontName='Helvetica', textColor=colors.gray, spaceBefore=2, spaceAfter=6),
        'Footer': ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, fontName='Helvetica', textColor=colors.gray),
    }

def make_table(headers, rows, col_widths=None):
    data = [headers] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ('GRID', (0,0), (-1,-1), 0.3, BORDER),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
    ]))
    return t

def generate_pdf_report(report_data: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm,
        title="ScaleMind AI Psychometric Analysis Report")
    s = build_styles()
    story = []
    date_str = datetime.now().strftime('%B %d, %Y %H:%M')

    story.append(Paragraph("ScaleMind AI", s['Title']))
    story.append(Paragraph("Psychometric Analysis Report", s['H1']))
    story.append(Paragraph(f"Generated: {date_str}", s['Caption']))
    if report_data.get('author'):
        story.append(Paragraph(f"Author: {report_data['author']}", s['Caption']))
    if report_data.get('institution'):
        story.append(Paragraph(f"Institution: {report_data['institution']}", s['Caption']))
    story.append(HRFlowable(width='100%', thickness=1, color=PRIMARY))
    story.append(Spacer(1, 0.3*cm))

    dataset = report_data.get('dataset', {})
    if dataset:
        story.append(Paragraph("1. Dataset Summary", s['H1']))
        rows = [['Participants', str(dataset.get('rows', '-'))],
                ['Variables', str(dataset.get('cols', '-'))],
                ['File', dataset.get('name', '-')]]
        t = Table([['Property', 'Value']] + rows, colWidths=[8*cm, 8*cm])
        t.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(-1,0), PRIMARY), ('TEXTCOLOR',(0,0),(-1,0), colors.white),
            ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'), ('FONTSIZE',(0,0),(-1,-1),9),
            ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white, LIGHT_BG]),
            ('GRID',(0,0),(-1,-1),0.3, BORDER), ('PADDING',(0,0),(-1,-1),5),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.3*cm))

    reliability = report_data.get('reliability', {})
    if reliability:
        story.append(Paragraph("2. Reliability Analysis", s['H1']))
        ca = reliability.get('cronbachAlpha', '-')
        sb = reliability.get('spearmanBrown', '-')
        story.append(Paragraph(
            f"Internal consistency was assessed using Cronbach's alpha (a = {ca}). "
            f"The Spearman-Brown corrected split-half reliability coefficient was {sb}.",
            s['Body']))
        rows = [["Cronbach's Alpha", str(ca), '-'],
                ["McDonald's Omega", str(reliability.get('mcdonaldOmegaTotal') or '-'), '-'],
                ['Split-Half', str(reliability.get('splitHalf', '-')), '-'],
                ['Spearman-Brown', str(sb), '-']]
        story.append(make_table(['Coefficient', 'Value', '95% CI'], rows, [7*cm, 4*cm, 5*cm]))
        story.append(Spacer(1, 0.3*cm))

    efa = report_data.get('efa', {})
    if efa:
        story.append(Paragraph("3. Exploratory Factor Analysis (EFA)", s['H1']))
        story.append(Paragraph(
            f"KMO = {efa.get('kmo', '-')} ({efa.get('kmoInterpretation', '')}), "
            f"Bartlett's test p {efa.get('bartlettP', '-')}. "
            f"Parallel analysis suggested {efa.get('suggestedFactors', '-')} factors. "
            f"Rotation: {efa.get('rotation', '-')}, Extraction: {efa.get('extractionMethod', '-')}.",
            s['Body']))
        var_exp = efa.get('varianceExplained', [])
        if var_exp:
            rows = [[str(v.get('factor','-')), str(v.get('eigenvalue','-')),
                     f"{v.get('variance','-')}%", f"{v.get('cumulative','-')}%"]
                    for v in var_exp if isinstance(v, dict)]
            story.append(make_table(['Factor', 'Eigenvalue', 'Variance', 'Cumulative'], rows,
                                    [4*cm, 4*cm, 4*cm, 4*cm]))
        story.append(Spacer(1, 0.3*cm))

    cfa = report_data.get('cfa', {})
    if cfa:
        story.append(Paragraph("4. Confirmatory Factor Analysis (CFA)", s['H1']))
        fit = cfa.get('fit', {})
        story.append(Paragraph(
            f"Model fit indices: CFI = {fit.get('cfi', '-')}, TLI = {fit.get('tli', '-')}, "
            f"RMSEA = {fit.get('rmsea', '-')}, SRMR = {fit.get('srmr', '-')}. "
            f"chi2({fit.get('df', '-')}) = {fit.get('chi2', '-')}, p = {fit.get('pValue', '-')}.",
            s['Body']))
        rows = [
            ['CFI', str(fit.get('cfi', '-')), '>= .90', 'Adequate' if (fit.get('cfi') or 0) >= 0.90 else 'Poor'],
            ['TLI', str(fit.get('tli', '-')), '>= .90', 'Adequate' if (fit.get('tli') or 0) >= 0.90 else 'Poor'],
            ['RMSEA', str(fit.get('rmsea', '-')), '<= .08', 'Adequate' if (fit.get('rmsea') or 1) <= 0.08 else 'Poor'],
            ['SRMR', str(fit.get('srmr', '-')), '<= .10', 'Adequate' if (fit.get('srmr') or 1) <= 0.10 else 'Poor'],
        ]
        story.append(make_table(['Index', 'Value', 'Threshold', 'Status'], rows, [4*cm, 4*cm, 4*cm, 4*cm]))
        story.append(Spacer(1, 0.3*cm))

    story.append(PageBreak())
    story.append(Paragraph("5. General Evaluation", s['H1']))
    story.append(Paragraph(
        "This report was automatically generated by ScaleMind AI psychometric analysis platform. "
        "Results should be reviewed by a qualified researcher before use in academic publications. "
        "All analyses should be interpreted within the relevant theoretical framework.",
        s['Body']))
    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width='100%', thickness=0.5, color=colors.gray))
    story.append(Paragraph(f"ScaleMind AI - Psychometric Analysis Platform | {date_str}", s['Footer']))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()
