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


    # SEM Yol Modeli Diyagramı
    sem_result = report_data.get('sem_result', {})
    diagram_png = report_data.get('diagram_png', '')
    fit_indices = report_data.get('fit_indices', {})
    
    if diagram_png and diagram_png.startswith('data:image/png;base64,'):
        import base64
        from reportlab.platypus import Image as RLImage
        from io import BytesIO
        
        story.append(Paragraph("5. SEM Yol Diyagramı", s['H1']))
        img_data = base64.b64decode(diagram_png.split(',')[1])
        img_buf = BytesIO(img_data)
        
        # A4 genişliğine sığdır
        img = RLImage(img_buf, width=16*cm, height=10*cm)
        story.append(img)
        story.append(Spacer(1, 0.3*cm))
    
    if fit_indices or (sem_result and sem_result.get('fit')):
        fit = fit_indices or sem_result.get('fit', {})
        story.append(Paragraph("6. Model Uygunluk İndeksleri", s['H1']))
        
        def fit_status(key, val, good_thr, direction='above'):
            if val is None: return '-'
            try:
                v = float(val)
                thr = float(good_thr)
                ok = v >= thr if direction == 'above' else v <= thr
                return 'İyi ✓' if ok else 'Zayıf ✗'
            except: return '-'
        
        fit_rows = [
            ['CFI', str(fit.get('cfi', '-')), '≥ .90', fit_status('cfi', fit.get('cfi'), 0.90)],
            ['TLI', str(fit.get('tli', '-')), '≥ .90', fit_status('tli', fit.get('tli'), 0.90)],
            ['RMSEA', str(fit.get('rmsea', '-')), '≤ .08', fit_status('rmsea', fit.get('rmsea'), 0.08, 'below')],
            ['SRMR', str(fit.get('srmr', '-')), '≤ .10', fit_status('srmr', fit.get('srmr'), 0.10, 'below')],
            ['χ²/df', str(round(float(fit.get('chi2',0))/max(float(fit.get('df',1)),1), 3)) if fit.get('chi2') else '-', '≤ 3.00', '-'],
            ['AIC', str(fit.get('aic', '-')), 'Düşük = İyi', '-'],
        ]
        story.append(make_table(['İndeks', 'Değer', 'Eşik', 'Durum'], fit_rows, [4*cm, 4*cm, 4*cm, 4*cm]))
        story.append(Spacer(1, 0.3*cm))
        
        # Uygunluk yorumu
        cfi = fit.get('cfi')
        rmsea = fit.get('rmsea')
        if cfi and rmsea:
            try:
                cfi_v, rmsea_v = float(cfi), float(rmsea)
                if cfi_v >= 0.95 and rmsea_v <= 0.06:
                    verdict = "Model mükemmel uyum sergilemektedir (CFI ≥ .95, RMSEA ≤ .06)."
                elif cfi_v >= 0.90 and rmsea_v <= 0.08:
                    verdict = "Model kabul edilebilir uyum sergilemektedir (CFI ≥ .90, RMSEA ≤ .08)."
                else:
                    verdict = "Model uyumu yetersizdir. Model modifikasyonu veya yeniden yapılandırma önerilmektedir."
                story.append(Paragraph(f"Uygunluk Yorumu: {verdict}", s['Body']))
            except: pass
    
    # AI Yorum (CFA/SEM)
    ai_comment = report_data.get('ai_interpretation', '') or report_data.get('aiComment', '')
    if ai_comment:
        story.append(Paragraph("7. AI Akademik Yorum", s['H1']))
        story.append(Paragraph(ai_comment, s['Body']))
        story.append(Spacer(1, 0.3*cm))

    story.append(PageBreak())
    story.append(Paragraph("8. General Evaluation", s['H1']))
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
