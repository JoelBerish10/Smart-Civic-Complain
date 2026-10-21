"""
Script to compile all project source files into:
1. CampusLoop_Complete_Source_Code.docx (MS Word Document - accepted by submission form)
2. CampusLoop_Complete_Source_Code.html (Printable/Save-as-PDF webpage)
3. CampusLoop_Complete_Source_Code.pdf  (via Edge headless if available)
4. CampusLoop_Combined_Source_Code.txt (Single plain-text unified file)
"""

import os
import sys
import zipfile
import subprocess
from xml.sax.saxutils import escape

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

FILES = [
    ("database/schema.sql", "SQL Database Schema (SQLite Tables & Constraints)", "sql"),
    ("backend/requirements.txt", "Python Dependencies", "text"),
    ("backend/app.py", "Flask REST API Backend Server & Logic", "python"),
    ("frontend/styles.css", "Design System & CSS Stylesheet", "css"),
    ("frontend/script.js", "Authentication & Role Selection Script", "javascript"),
    ("frontend/index.html", "Landing Page & Public Portal", "html"),
    ("frontend/login.html", "Login & Registration Interface", "html"),
    ("frontend/dashboard.html", "Main Campus Civic Dashboard", "html"),
    ("frontend/dashboard.js", "Dashboard Logic, Geofencing, Maps & Admin Controls", "javascript"),
]

def read_all_files():
    data = []
    total_lines = 0
    total_bytes = 0
    for rel_path, desc, lang in FILES:
        abs_path = os.path.join(BASE_DIR, rel_path.replace("/", os.sep))
        if os.path.exists(abs_path):
            with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            lines = content.splitlines()
            total_lines += len(lines)
            total_bytes += len(content.encode("utf-8"))
            data.append({
                "rel_path": rel_path,
                "desc": desc,
                "lang": lang,
                "content": content,
                "lines": lines,
                "line_count": len(lines),
                "byte_count": len(content.encode("utf-8"))
            })
        else:
            print(f"[WARN] File not found: {rel_path}")
    return data, total_lines, total_bytes


def generate_docx(data, total_lines, total_bytes, output_path):
    print(f"Building DOCX: {output_path}...")
    
    # Minimal valid WordprocessingML document
    content_types_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''

    rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

    doc_rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''

    styles_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>'''

    doc_parts = []
    doc_parts.append('''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>''')

    # Title & Header
    doc_parts.append('''
<w:p>
  <w:pPr><w:jc w:val="center"/><w:spacing w:before="300" w:after="100"/></w:pPr>
  <w:r><w:rPr><w:b/><w:sz w:val="56"/><w:color w:val="047857"/></w:rPr><w:t>CampusLoop</w:t></w:r>
</w:p>
<w:p>
  <w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr>
  <w:r><w:rPr><w:b/><w:sz w:val="30"/><w:color w:val="1F2937"/></w:rPr><w:t>Smart Civic Complaint &amp; Campus Management System</w:t></w:r>
</w:p>
<w:p>
  <w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>
  <w:r><w:rPr><w:i/><w:sz w:val="24"/><w:color w:val="4B5563"/></w:rPr><w:t>SIES Graduate School of Technology (SIES GST) — Mini Project Sem 3</w:t></w:r>
</w:p>
<w:p>
  <w:pPr><w:jc w:val="center"/><w:spacing w:after="400"/></w:pPr>
  <w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="059669"/></w:rPr><w:t>Complete Project Source Code Compilation</w:t></w:r>
</w:p>
''')

    # Project Overview Box
    doc_parts.append(f'''
<w:p>
  <w:pPr><w:spacing w:before="120" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="047857"/></w:pBdr></w:pPr>
  <w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="047857"/></w:rPr><w:t>Project Summary &amp; File Index</w:t></w:r>
</w:p>
<w:p>
  <w:r><w:rPr><w:b/></w:rPr><w:t>Total Source Code Files: </w:t></w:r>
  <w:r><w:t>{len(data)} files</w:t></w:r>
</w:p>
<w:p>
  <w:r><w:rPr><w:b/></w:rPr><w:t>Total Lines of Code: </w:t></w:r>
  <w:r><w:t>{total_lines:,} lines</w:t></w:r>
</w:p>
<w:p>
  <w:r><w:rPr><w:b/></w:rPr><w:t>Tech Stack: </w:t></w:r>
  <w:r><w:t>Python (Flask REST API), SQLite Database, HTML5, CSS3, JavaScript (ES6+), Leaflet.js Geofencing</w:t></w:r>
</w:p>
<w:p><w:r><w:t></w:t></w:r></w:p>
''')

    for idx, item in enumerate(data, 1):
        doc_parts.append(f'''
<w:p>
  <w:pPr><w:spacing w:after="40"/></w:pPr>
  <w:r><w:rPr><w:b/><w:color w:val="047857"/></w:rPr><w:t>{idx}. {escape(item["rel_path"])}</w:t></w:r>
  <w:r><w:t> — {escape(item["desc"])} ({item["line_count"]} lines, {round(item["byte_count"]/1024, 1)} KB)</w:t></w:r>
</w:p>
''')

    # Now add each file with page break and syntax box
    for idx, item in enumerate(data, 1):
        doc_parts.append('''
<w:p><w:r><w:br w:type="page"/></w:r></w:p>
''')
        # Section Heading
        doc_parts.append(f'''
<w:p>
  <w:pPr><w:spacing w:before="200" w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="047857"/></w:pBdr></w:pPr>
  <w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="047857"/></w:rPr><w:t>File {idx}/{len(data)}: {escape(item["rel_path"])}</w:t></w:r>
</w:p>
<w:p>
  <w:pPr><w:spacing w:after="160"/></w:pPr>
  <w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="6B7280"/></w:rPr><w:t>Description: {escape(item["desc"])} | Language: {item["lang"].upper()} | Lines: {item["line_count"]}</w:t></w:r>
</w:p>
''')

        # Code lines formatted in Consolas 8pt with line numbering
        for line_num, line in enumerate(item["lines"], 1):
            esc_line = escape(line)
            # Use xml:space="preserve" to keep indentation
            doc_parts.append(f'''<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="220" w:lineRule="exact"/><w:shd w:fill="F8F9FA"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="15"/><w:color w:val="9CA3AF"/></w:rPr><w:t xml:space="preserve">{line_num:4d}  </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="15"/><w:color w:val="1E293B"/></w:rPr><w:t xml:space="preserve">{esc_line}</w:t></w:r></w:p>''')

    doc_parts.append('''
<w:sectPr>
  <w:pgSz w:w="12240" w:h="15840"/>
  <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/>
</w:sectPr>
</w:body>
</w:document>''')

    document_xml = "".join(doc_parts)

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types_xml)
        docx.writestr("_rels/.rels", rels_xml)
        docx.writestr("word/_rels/document.xml.rels", doc_rels_xml)
        docx.writestr("word/styles.xml", styles_xml)
        docx.writestr("word/document.xml", document_xml)

    file_size = os.path.getsize(output_path)
    print(f"[OK] DOCX generated: {output_path} ({round(file_size/1024, 1)} KB)")


def generate_html(data, total_lines, total_bytes, output_path):
    print(f"Building HTML: {output_path}...")
    
    html_parts = []
    html_parts.append('''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CampusLoop — Complete Source Code Submission</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@400;600;700;800&display=swap');
  
  :root {
    --brand-green: #047857;
    --brand-dark: #064E3B;
    --text-primary: #0F172A;
    --text-muted: #64748B;
    --bg-page: #F8FAFC;
    --code-bg: #FFFFFF;
    --border-color: #E2E8F0;
  }
  
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: var(--bg-page);
    color: var(--text-primary);
    margin: 0;
    padding: 24px;
    line-height: 1.5;
  }
  
  .container {
    max-width: 1100px;
    margin: 0 auto;
    background: #fff;
    padding: 48px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  }
  
  .header {
    text-align: center;
    border-bottom: 3px solid var(--brand-green);
    padding-bottom: 28px;
    margin-bottom: 32px;
  }
  .title {
    font-size: 34px;
    font-weight: 800;
    color: var(--brand-green);
    margin: 0 0 6px 0;
  }
  .subtitle {
    font-size: 18px;
    color: #334155;
    margin: 0 0 10px 0;
    font-weight: 600;
  }
  .college {
    font-size: 15px;
    color: var(--text-muted);
    margin-bottom: 16px;
  }
  .badge {
    display: inline-block;
    background: #ECFDF5;
    color: var(--brand-green);
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid #A7F3D0;
  }
  
  .summary-card {
    background: #F0FDF4;
    border: 1px solid #BBF7D0;
    border-radius: 10px;
    padding: 20px 24px;
    margin-bottom: 32px;
  }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }
  .summary-item .label {
    font-size: 12px;
    text-transform: uppercase;
    color: #166534;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .summary-item .val {
    font-size: 20px;
    font-weight: 800;
    color: #064E3B;
  }
  
  .toc {
    background: #F8FAFC;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 24px;
    margin-bottom: 40px;
  }
  .toc h3 {
    margin: 0 0 16px 0;
    color: #1E293B;
  }
  .toc ol {
    margin: 0;
    padding-left: 20px;
  }
  .toc li {
    margin-bottom: 8px;
  }
  .toc a {
    color: var(--brand-green);
    text-decoration: none;
    font-weight: 600;
  }
  .toc a:hover {
    text-decoration: underline;
  }
  
  .file-section {
    margin-bottom: 48px;
    page-break-before: always;
  }
  .file-header {
    background: #F1F5F9;
    border-left: 5px solid var(--brand-green);
    padding: 14px 20px;
    border-radius: 0 8px 8px 0;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  .file-name {
    font-size: 17px;
    font-weight: 700;
    color: #0F172A;
    font-family: 'Fira Code', monospace;
  }
  .file-meta {
    font-size: 13px;
    color: var(--text-muted);
  }
  
  pre.code-block {
    background: var(--code-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    overflow-x: auto;
    font-family: 'Fira Code', Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }
  
  .print-btn {
    position: fixed;
    bottom: 28px;
    right: 28px;
    background: var(--brand-green);
    color: #fff;
    border: none;
    padding: 14px 24px;
    border-radius: 50px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(4, 120, 87, 0.4);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: transform 0.2s, background 0.2s;
  }
  .print-btn:hover {
    background: var(--brand-dark);
    transform: translateY(-2px);
  }
  
  @media print {
    body {
      background: #fff;
      padding: 0;
    }
    .container {
      box-shadow: none;
      padding: 0;
      max-width: 100%;
    }
    .print-btn {
      display: none;
    }
    .file-section {
      page-break-before: always;
    }
    pre.code-block {
      border: 1px solid #ccc;
      font-size: 9.5px;
      line-height: 1.35;
    }
  }
</style>
</head>
<body>

<button class="print-btn" onclick="window.print()">
  🖨️ Click to Save as PDF / Print
</button>

<div class="container">
  <div class="header">
    <div class="title">CampusLoop</div>
    <div class="subtitle">Smart Civic Complaint &amp; Campus Management System</div>
    <div class="college">SIES Graduate School of Technology (SIES GST), Nerul — Department Mini Project</div>
    <span class="badge">Official Complete Source Code Submission</span>
  </div>

  <div class="summary-card">
    <div class="summary-grid">
      <div class="summary-item">
        <div class="label">Total Code Files</div>
        <div class="val">''' + str(len(data)) + ''' Files</div>
      </div>
      <div class="summary-item">
        <div class="label">Total Source Lines</div>
        <div class="val">''' + f"{total_lines:,}" + ''' Lines</div>
      </div>
      <div class="summary-item">
        <div class="label">Primary Stack</div>
        <div class="val">Python + Flask + SQLite</div>
      </div>
      <div class="summary-item">
        <div class="label">Frontend Stack</div>
        <div class="val">HTML5 + CSS3 + JS + Leaflet</div>
      </div>
    </div>
  </div>

  <div class="toc">
    <h3>Table of Contents — Included Source Files</h3>
    <ol>
''')

    for idx, item in enumerate(data, 1):
        anchor = f"file-{idx}"
        html_parts.append(f'''      <li><a href="#{anchor}">{escape(item["rel_path"])}</a> — <span style="color: #64748B;">{escape(item["desc"])} ({item["line_count"]} lines)</span></li>\n''')

    html_parts.append('''    </ol>
  </div>
''')

    for idx, item in enumerate(data, 1):
        anchor = f"file-{idx}"
        html_parts.append(f'''
  <div class="file-section" id="{anchor}">
    <div class="file-header">
      <div class="file-name">{idx}. {escape(item["rel_path"])}</div>
      <div class="file-meta">{escape(item["desc"])} | {item["line_count"]} lines | {round(item["byte_count"]/1024, 1)} KB</div>
    </div>
    <pre class="code-block"><code>''')
        # Add line numbers and code
        code_lines = []
        for lnum, line in enumerate(item["lines"], 1):
            code_lines.append(f'<span style="color:#94A3B8;user-select:none;">{lnum:4d} | </span>{escape(line)}')
        html_parts.append("\n".join(code_lines))
        html_parts.append('''</code></pre>
  </div>
''')

    html_parts.append('''
</div>
</body>
</html>''')

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("".join(html_parts))
    print(f"[OK] HTML generated: {output_path}")


def generate_txt(data, total_lines, total_bytes, output_path):
    print(f"Building TXT: {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("=" * 80 + "\n")
        f.write("CampusLoop — Smart Civic Complaint & Campus Management System\n")
        f.write("SIES Graduate School of Technology (SIES GST) — Mini Project Sem 3\n")
        f.write(f"COMPLETE SOURCE CODE COMPILATION ({len(data)} Files | {total_lines:,} Lines)\n")
        f.write("=" * 80 + "\n\n")

        f.write("TABLE OF CONTENTS:\n")
        for idx, item in enumerate(data, 1):
            f.write(f"{idx}. {item['rel_path']} ({item['line_count']} lines) - {item['desc']}\n")
        f.write("\n" + "=" * 80 + "\n\n")

        for idx, item in enumerate(data, 1):
            f.write("\n" + "#" * 80 + "\n")
            f.write(f"### FILE {idx}/{len(data)}: {item['rel_path']}\n")
            f.write(f"### DESCRIPTION: {item['desc']}\n")
            f.write(f"### LINES: {item['line_count']} | LANGUAGE: {item['lang'].upper()}\n")
            f.write("#" * 80 + "\n\n")
            f.write(item["content"])
            f.write("\n\n")
    print(f"[OK] TXT generated: {output_path}")


def convert_html_to_pdf_via_edge(html_path, pdf_path):
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    ]
    browser = None
    for bp in edge_paths:
        if os.path.exists(bp):
            browser = bp
            break
            
    if not browser:
        print("[INFO] Headless browser not detected for auto-conversion. Use Chrome/Edge -> Ctrl+P -> Save as PDF.")
        return False
        
    print(f"Converting HTML to PDF via {os.path.basename(browser)}: {pdf_path}...")
    cmd = [
        browser,
        "--headless",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        f"--print-to-pdf={pdf_path}",
        html_path
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 1000:
            print(f"[OK] PDF successfully generated: {pdf_path} ({round(os.path.getsize(pdf_path)/1024, 1)} KB)")
            return True
    except Exception as e:
        print(f"[WARN] Headless PDF conversion warning: {e}")
    return False


if __name__ == "__main__":
    data, total_lines, total_bytes = read_all_files()
    print(f"Loaded {len(data)} files, {total_lines:,} lines ({round(total_bytes/1024, 1)} KB).")

    docx_path = os.path.join(BASE_DIR, "CampusLoop_Complete_Source_Code.docx")
    html_path = os.path.join(BASE_DIR, "CampusLoop_Complete_Source_Code.html")
    txt_path = os.path.join(BASE_DIR, "CampusLoop_Complete_Source_Code.txt")
    pdf_path = os.path.join(BASE_DIR, "CampusLoop_Complete_Source_Code.pdf")

    generate_docx(data, total_lines, total_bytes, docx_path)
    generate_html(data, total_lines, total_bytes, html_path)
    generate_txt(data, total_lines, total_bytes, txt_path)
    convert_html_to_pdf_via_edge(html_path, pdf_path)
    print("\n[ALL DONE] All submission files generated successfully!")
