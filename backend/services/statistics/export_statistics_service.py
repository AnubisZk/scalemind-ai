
import io
from datetime import datetime
from schemas.statistics_schema import AnalysisResponse

class ExportStatisticsService:
    def export_word(self, result: AnalysisResponse, language="tr") -> bytes:
        try: from docx import Document
        except: raise ImportError("pip install python-docx")
        doc = Document()
        doc.add_heading("ScaleMind-AI İstatistiksel Analiz Raporu", 0)
        doc.add_paragraph(f"Analiz: {result.analysis_name} | Test: {result.test_used}")
        doc.add_paragraph(f"Tarih: {datetime.now().strftime('%d.%m.%Y %H:%M')}")
        doc.add_heading("Ana Sonuçlar", 1)
        for k,v in result.main_results.items():
            if not isinstance(v,(dict,list)): doc.add_paragraph(f"{k}: {v}")
        if result.effect_size:
            doc.add_heading("Etki Büyüklüğü", 1)
            for es in result.effect_size: doc.add_paragraph(f"{es.name} = {es.value} ({es.interpretation})")
        if result.posthoc_results:
            doc.add_heading("Post-hoc", 1)
            t = doc.add_table(rows=1, cols=4); t.style="Table Grid"
            for h,c in zip(["Grup 1","Grup 2","p","Anlamlı?"], t.rows[0].cells): c.text=h
            for ph in result.posthoc_results:
                r = t.add_row().cells
                r[0].text=ph.group1; r[1].text=ph.group2
                r[2].text=f"{ph.p_adjusted or ph.p_value:.4f}"; r[3].text="Evet" if ph.significant else "Hayır"
        doc.add_heading("APA 7 Raporu", 1)
        if language in ("tr","both") and result.apa7_tr:
            doc.add_heading("Türkçe", 2); doc.add_paragraph(result.apa7_tr)
        if language in ("en","both") and result.apa7_en:
            doc.add_heading("English", 2); doc.add_paragraph(result.apa7_en)
        if result.warnings:
            doc.add_heading("Uyarılar", 1)
            for w in result.warnings: doc.add_paragraph(f"⚠ {w}")
        buf = io.BytesIO(); doc.save(buf); buf.seek(0); return buf.read()

    def export_excel(self, result: AnalysisResponse) -> bytes:
        try: import openpyxl; from openpyxl.styles import Font, PatternFill, Alignment
        except: raise ImportError("pip install openpyxl")
        wb = openpyxl.Workbook(); wb.remove(wb.active)
        hf = Font(bold=True,color="FFFFFF"); hfill = PatternFill("solid",fgColor="1E3A5F")
        def hdr(ws, cols):
            ws.append(cols)
            for c in ws[1]: c.font=hf; c.fill=hfill; c.alignment=Alignment(horizontal="center")
        if result.descriptive_statistics:
            ws = wb.create_sheet("Tanımlayıcı")
            hdr(ws,["Değişken","Grup","n","Ort.","SS","Min","Max","Ortanca"])
            for s in result.descriptive_statistics:
                ws.append([s.variable,s.group or "—",s.n,s.mean,s.std,s.min,s.max,s.median])
        ws2 = wb.create_sheet("Ana Sonuçlar"); hdr(ws2,["Parametre","Değer"])
        for k,v in result.main_results.items():
            if not isinstance(v,(dict,list)): ws2.append([k,str(v)])
        if result.effect_size:
            ws3 = wb.create_sheet("Etki Büyüklüğü"); hdr(ws3,["Ölçü","Değer","Yorum"])
            for es in result.effect_size: ws3.append([es.name,es.value,es.interpretation])
        ws4 = wb.create_sheet("APA 7"); hdr(ws4,["Dil","Rapor"])
        if result.apa7_tr: ws4.append(["TR",result.apa7_tr])
        if result.apa7_en: ws4.append(["EN",result.apa7_en])
        buf = io.BytesIO(); wb.save(buf); buf.seek(0); return buf.read()

    def export_pdf(self, result: AnalysisResponse, language="tr") -> bytes:
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.lib.units import cm
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        except: raise ImportError("pip install reportlab")
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf,pagesize=A4,rightMargin=2*cm,leftMargin=2*cm,topMargin=2*cm,bottomMargin=2*cm)
        styles = getSampleStyleSheet(); story = []
        story.append(Paragraph("ScaleMind-AI İstatistiksel Analiz Raporu", styles["Title"]))
        story.append(Paragraph(f"{result.analysis_name} | {datetime.now().strftime('%d.%m.%Y')}", styles["Normal"]))
        story.append(Spacer(1,0.5*cm))
        story.append(Paragraph("Ana Sonuçlar", styles["Heading1"]))
        for k,v in result.main_results.items():
            if not isinstance(v,(dict,list)): story.append(Paragraph(f"<b>{k}:</b> {v}", styles["Normal"]))
        story.append(Spacer(1,0.3*cm))
        story.append(Paragraph("APA 7", styles["Heading1"]))
        if language in ("tr","both") and result.apa7_tr:
            story.append(Paragraph(result.apa7_tr, styles["Normal"]))
        if language in ("en","both") and result.apa7_en:
            story.append(Paragraph(result.apa7_en, styles["Normal"]))
        doc.build(story); buf.seek(0); return buf.read()

export_statistics_service = ExportStatisticsService()
