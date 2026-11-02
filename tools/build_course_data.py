#!/usr/bin/env python3
"""
Rebuild js/course-data.js and images/lessons/ from the Word source of the Photoshop 2022 book.

Usage:
    python tools/build_course_data.py "Basic_Adobe_Photoshop_2022_Khmer_Final.docx"
"""
import io
import json
import os
import re
import shutil
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')

try:
    from PIL import Image, features
    if not features.check('webp'):
        raise ImportError('Pillow was built without WebP support')
except ImportError as e:
    sys.exit(f'Pillow with WebP support is required ({e}). Install it with: python -m pip install Pillow')

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
V = '{urn:schemas-microsoft-com:vml}'

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, 'js', 'course-data.js')
IMG_DIR = os.path.join(ROOT, 'images', 'lessons')
MAX_IMG_WIDTH = 1600
WEBP_QUALITY = 85

KH2AR = str.maketrans('០១២៣៤៥៦៧៨៩', '0123456789')
AR2KH = str.maketrans('0123456789', '០១២៣៤៥៦៧៨៩')
ZW = re.compile(r'[​‌‍﻿]')


# Official Answer Keys from Appendix 4
LESSON_ANSWERS = {
    2: {'1': {'ans': 'B', 'note': 'Tab'}, '2': {'ans': 'C', 'note': 'Options Bar'}, '3': {'ans': 'B', 'note': 'Fit on Screen'}, '4': {'ans': 'B', 'note': 'History Panel'}, '5': {'ans': 'B', 'note': 'Ctrl + R'}},
    3: {'1': {'ans': 'B', 'note': 'Ctrl + D'}, '2': {'ans': 'C', 'note': 'Shift'}, '3': {'ans': 'B', 'note': 'Ctrl + Shift + I'}, '4': {'ans': 'C', 'note': 'Object Selection'}, '5': {'ans': 'B', 'note': 'Ctrl + J'}},
    4: {'1': {'ans': 'B', 'note': 'Ctrl + T'}, '2': {'ans': 'B', 'note': 'Straighten'}, '3': {'ans': 'B', 'note': 'Image Size vs Canvas'}, '4': {'ans': 'B', 'note': 'Enter'}, '5': {'ans': 'B', 'note': 'Flip Horizontal'}},
    5: {'1': {'ans': 'A', 'note': 'Ctrl + G'}, '2': {'ans': 'B', 'note': 'Opacity vs Fill'}, '3': {'ans': 'C', 'note': 'Screen'}, '4': {'ans': 'B', 'note': 'Ctrl + J'}, '5': {'ans': 'C', 'note': 'Lock Transparent'}},
    6: {'1': {'ans': 'B', 'note': '] គ្នាបិទ'}, '2': {'ans': 'B', 'note': 'គែមព្រិលទន់'}, '3': {'ans': 'B', 'note': 'គ្រាប់ចុច D'}, '4': {'ans': 'B', 'note': 'Eyedropper'}, '5': {'ans': 'B', 'note': 'Define Brush Preset'}},
    7: {'1': {'ans': 'B', 'note': 'Paragraph Type'}, '2': {'ans': 'B', 'note': 'Line Spacing'}, '3': {'ans': 'B', 'note': 'Vector Graphics'}, '4': {'ans': 'B', 'note': 'Shift'}, '5': {'ans': 'B', 'note': 'World-Ready Layout'}},
    8: {'1': {'ans': 'B', 'note': 'Spot Healing Brush'}, '2': {'ans': 'C', 'note': 'គ្រាប់ចុច Alt'}, '3': {'ans': 'B', 'note': 'បង្កើនពន្លឺ Highlight'}, '4': {'ans': 'A', 'note': 'Content-Aware Fill'}, '5': {'ans': 'B', 'note': 'Current & Below'}},
    9: {'1': {'ans': 'B', 'note': 'Non-destructive'}, '2': {'ans': 'A', 'note': 'Ctrl + L'}, '3': {'ans': 'B', 'note': 'S-Curve Contrast'}, '4': {'ans': 'B', 'note': 'Vibrance'}, '5': {'ans': 'C', 'note': 'Ctrl + U'}},
    10: {'1': {'ans': 'B', 'note': 'លាក់បាំងរូបភាព'}, '2': {'ans': 'B', 'note': 'White Reveals, Black Conceals'}, '3': {'ans': 'C', 'note': 'Ctrl + Alt + G'}, '4': {'ans': 'B', 'note': 'គ្រាប់ចុច X'}, '5': {'ans': 'B', 'note': 'Alt + Click លើ Mask'}},
    11: {'1': {'ans': 'B', 'note': 'Smart Object'}, '2': {'ans': 'B', 'note': 'Ctrl + Shift + A'}, '3': {'ans': 'A', 'note': 'Face-Aware Liquify'}, '4': {'ans': 'C', 'note': 'Drop Shadow'}, '5': {'ans': 'B', 'note': 'Motion Blur'}},
    12: {'1': {'ans': 'B', 'note': 'CMYK Color'}, '2': {'ans': 'C', 'note': '300 DPI'}, '3': {'ans': 'B', 'note': 'Pixels Per Inch'}, '4': {'ans': 'B', 'note': '1080 x 1080 px'}, '5': {'ans': 'B', 'note': 'ការពារកាំបិតកាត់'}},
    13: {'1': {'ans': 'B', 'note': 'Smart Object'}, '2': {'ans': 'C', 'note': 'Puppet Warp'}, '3': {'ans': 'B', 'note': 'Content-Aware Scale'}, '4': {'ans': 'B', 'note': 'បើក Caps Lock'}, '5': {'ans': 'B', 'note': 'Actions Panel'}},
}

FINAL_EXAM_ANSWERS = {
    '1': {'ans': 'B', 'note': 'Raster/Pixel'}, '2': {'ans': 'B', 'note': 'Ctrl + N'}, '3': {'ans': 'C', 'note': 'Options Bar'}, '4': {'ans': 'B', 'note': 'Hand Tool'}, '5': {'ans': 'C', 'note': 'Object Selection'},
    '6': {'ans': 'C', 'note': 'Shift'}, '7': {'ans': 'B', 'note': 'Ctrl + D'}, '8': {'ans': 'B', 'note': 'Canvas Size'}, '9': {'ans': 'B', 'note': 'Ctrl + T'}, '10': {'ans': 'B', 'note': 'Ctrl + J'},
    '11': {'ans': 'B', 'note': 'Opacity vs Fill'}, '12': {'ans': 'B', 'note': 'Screen'}, '13': {'ans': 'B', 'note': '] គ្នាបិទ'}, '14': {'ans': 'B', 'note': 'គ្រាប់ចុច D'}, '15': {'ans': 'B', 'note': 'Spot Healing'},
    '16': {'ans': 'B', 'note': 'Alt'}, '17': {'ans': 'C', 'note': 'Dodge Tool'}, '18': {'ans': 'B', 'note': 'លាក់បាំង'}, '19': {'ans': 'C', 'note': 'Ctrl+Alt+G'}, '20': {'ans': 'B', 'note': 'Smart Object'},
    '21': {'ans': 'B', 'note': 'Ctrl+Shift+A'}, '22': {'ans': 'B', 'note': 'CMYK'}, '23': {'ans': 'C', 'note': '300 DPI'}, '24': {'ans': 'C', 'note': 'PSD'}, '25': {'ans': 'B', 'note': 'PNG'}
}


def plain(t):
    """Text without zero-width spaces (for matching / search)."""
    return ZW.sub('', t or '').strip()


def clean(t):
    """Display text: keep Khmer zero-width word breaks, tidy everything else."""
    t = (t or '').replace(' ', ' ').replace('\t', ' ')
    t = re.sub(r'<([A-Za-z][A-Za-z0-9 ]{0,15})>', r'\1', t)
    t = re.sub(r'[ ​]*\n[ ​]*', '\n', t)
    t = re.sub(r' {2,}', ' ', t)
    t = re.sub(r'​*( )​*', r'\1', t)
    return t.strip(' ​\n')


def to_webp(data, max_width=MAX_IMG_WIDTH):
    """Encode image bytes as WebP. Keeps transparency, Lanczos resizes if too wide."""
    img = Image.open(io.BytesIO(data))
    img.load()
    has_alpha = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
    img = img.convert('RGBA' if has_alpha else 'RGB')
    if img.width > max_width:
        img = img.resize((max_width, round(img.height * max_width / img.width)), Image.LANCZOS)
    lossy = io.BytesIO()
    img.save(lossy, 'WEBP', quality=WEBP_QUALITY, method=6, alpha_quality=90)
    candidates = [lossy.getvalue()]
    if img.width * img.height <= 400_000:
        lossless = io.BytesIO()
        img.save(lossless, 'WEBP', lossless=True, quality=80, method=4)
        candidates.append(lossless.getvalue())
    return min(candidates, key=len)


class ImageWriter:
    def __init__(self, docx):
        self.docx = docx
        self.done = {}
        self.counters = {}
        self.bytes_in = self.bytes_out = 0

    def write(self, target, lesson_id):
        if target in self.done:
            return self.done[target]
        data = self.docx.media(target)
        self.bytes_in += len(data)
        self.counters[lesson_id] = self.counters.get(lesson_id, 0) + 1
        rel = f'images/lessons/{lesson_id}/fig-{self.counters[lesson_id]:02d}.webp'
        full_path = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        webp = to_webp(data)
        with open(full_path, 'wb') as f:
            f.write(webp)
        self.bytes_out += len(webp)
        self.done[target] = rel
        return rel


class Docx:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.doc = ET.fromstring(self.z.read('word/document.xml'))
        rels = ET.fromstring(self.z.read('word/_rels/document.xml.rels'))
        self.rels = {r.get('Id'): r.get('Target') for r in rels}
        self.styles = {}
        st = ET.fromstring(self.z.read('word/styles.xml'))
        for s in st.iter(W + 'style'):
            n = s.find(W + 'name')
            self.styles[s.get(W + 'styleId')] = n.get(W + 'val') if n is not None else s.get(W + 'styleId')
        self._load_numbering()

    def _load_numbering(self):
        self.num_fmt = {}
        try:
            num = ET.fromstring(self.z.read('word/numbering.xml'))
        except KeyError:
            return
        abstract = {}
        for a in num.findall(W + 'abstractNum'):
            lv = {}
            for l in a.findall(W + 'lvl'):
                f = l.find(W + 'numFmt'); s = l.find(W + 'start')
                lv[l.get(W + 'ilvl')] = (f.get(W + 'val') if f is not None else 'decimal',
                                         int(s.get(W + 'val')) if s is not None else 1)
            abstract[a.get(W + 'abstractNumId')] = lv
        for n in num.findall(W + 'num'):
            lv = dict(abstract.get(n.find(W + 'abstractNumId').get(W + 'val'), {}))
            for o in n.findall(W + 'lvlOverride'):
                so = o.find(W + 'startOverride')
                il = o.get(W + 'ilvl')
                if so is not None and il in lv:
                    lv[il] = (lv[il][0], int(so.get(W + 'val')))
            self.num_fmt[n.get(W + 'numId')] = lv

    def media(self, target):
        return self.z.read('word/' + target if not target.startswith('word/') else target)

    def para(self, p):
        texts, images, bold_chars, all_chars = [], [], 0, 0
        for r in p.iter(W + 'r'):
            rpr = r.find(W + 'rPr')
            is_bold = rpr is not None and rpr.find(W + 'b') is not None and \
                rpr.find(W + 'b').get(W + 'val') not in ('0', 'false')
            for node in r.iter():
                if node.tag == W + 't':
                    texts.append(node.text or '')
                    n = len((node.text or '').strip())
                    all_chars += n
                    bold_chars += n if is_bold else 0
                elif node.tag == W + 'tab':
                    texts.append('\t')
                elif node.tag in (W + 'br', W + 'cr'):
                    texts.append('\n')
                elif node.tag == A + 'blip':
                    rid = node.get(R + 'embed')
                    if rid in self.rels:
                        images.append(self.rels[rid])
                elif node.tag == V + 'imagedata':
                    rid = node.get(R + 'id')
                    if rid in self.rels:
                        images.append(self.rels[rid])
        ppr = p.find(W + 'pPr')
        style, num = None, None
        if ppr is not None:
            ps = ppr.find(W + 'pStyle')
            if ps is not None:
                style = self.styles.get(ps.get(W + 'val'), ps.get(W + 'val'))
            npr = ppr.find(W + 'numPr')
            if npr is not None and npr.find(W + 'numId') is not None:
                nid = npr.find(W + 'numId').get(W + 'val')
                il = npr.find(W + 'ilvl')
                if nid != '0':
                    num = (nid, il.get(W + 'val') if il is not None else '0')
        return {'k': 'p', 'text': ''.join(texts), 'style': style or '', 'num': num, 'images': images,
                'bold': all_chars > 0 and bold_chars == all_chars}

    def table(self, tbl):
        rows = []
        for tr in tbl.findall(W + 'tr'):
            cells = []
            for tc in tr.findall(W + 'tc'):
                ps = [self.para(p) for p in tc.iter(W + 'p')]
                span = tc.find(W + 'tcPr/' + W + 'gridSpan')
                cells.append({
                    'text': '\n'.join(p['text'] for p in ps if plain(p['text'])),
                    'paras': ps,
                    'span': int(span.get(W + 'val')) if span is not None else 1,
                    'images': [i for p in ps for i in p['images']],
                    'bold': all(p['bold'] for p in ps if plain(p['text'])) and any(plain(p['text']) for p in ps)
                })
            rows.append(cells)
        return {'k': 'tbl', 'rows': rows}

    def blocks(self):
        body = self.doc.find(W + 'body')
        for child in body:
            if child.tag == W + 'p':
                yield self.para(child)
            elif child.tag == W + 'tbl':
                yield self.table(child)
            elif child.tag == W + 'sdt':
                content = child.find(W + 'sdtContent')
                if content is not None:
                    for sc in content:
                        if sc.tag == W + 'p':
                            yield self.para(sc)
                        elif sc.tag == W + 'tbl':
                            yield self.table(sc)


class LessonBuilder:
    def __init__(self, docx, images, lesson_id, lesson_num):
        self.docx = docx
        self.images = images
        self.lesson_id = lesson_id
        self.lesson_num = lesson_num
        self.objectives = []
        self.sections = []
        self.cur = None
        self.list_block = None

    def section(self, title):
        self.cur = {'title': clean(title), 'items': []}
        self.sections.append(self.cur)
        self.list_block = None

    def add(self, item):
        if self.cur is None:
            self.section('ខ្លឹមសារមេរៀន')
        self.cur['items'].append(item)
        if item['type'] not in ('steps', 'bullets'):
            self.list_block = None

    def list_item(self, kind, key, text):
        if (self.list_block and self.list_block[0] == (kind, key) and 
            self.cur['items'] and self.cur['items'][-1] is self.list_block[1]):
            blk = self.list_block[1]
        else:
            blk = {'type': kind, ('steps' if kind == 'steps' else 'items'): []}
            self.add(blk)
            self.list_block = ((kind, key), blk)
        blk['steps' if kind == 'steps' else 'items'].append(text)


def parse_quiz_block(blocks, lesson_num, is_exam=False):
    """Parse review questions into a structured quiz and short-questions block."""
    mcqs = []
    short_qs = []
    mode = 'mcq' if is_exam else None
    cur_q = None

    answers_map = FINAL_EXAM_ANSWERS if is_exam else LESSON_ANSWERS.get(lesson_num, {})

    for b in blocks:
        if b['k'] != 'p':
            continue
        raw = b['text']
        p = plain(raw)
        txt = clean(raw)

        if 'ក. សំណួរពហុជ្រើសរើស' in p:
            mode = 'mcq'
            continue
        elif 'ខ. សំណួរត្រិះរិះ' in p:
            mode = 'short'
            if cur_q:
                mcqs.append(cur_q)
                cur_q = None
            continue

        if mode == 'mcq':
            m_q = re.match(r'^([០-៩0-9]+)\.\s*(.*)', p)
            m_opt = re.match(r'^([A-Da-d])[\.\)]\s*(.*)', p)
            if m_q and not m_opt:
                if cur_q:
                    mcqs.append(cur_q)
                q_ar = m_q.group(1).translate(KH2AR)
                ans_info = answers_map.get(str(q_ar), {})
                cur_q = {
                    'number': int(q_ar),
                    'numberKh': str(q_ar).translate(AR2KH),
                    'question': clean(m_q.group(2)),
                    'options': [],
                    'answer': ans_info.get('ans', ''),
                    'answerNote': ans_info.get('note', '')
                }
            elif m_opt and cur_q:
                cur_q['options'].append({
                    'key': m_opt.group(1).upper(),
                    'text': clean(m_opt.group(2))
                })
        elif mode == 'short':
            m_q = re.match(r'^([០-៩0-9]+)\.\s*(.*)', p)
            if m_q:
                q_ar = m_q.group(1).translate(KH2AR)
                short_qs.append({
                    'number': int(q_ar),
                    'numberKh': str(q_ar).translate(AR2KH),
                    'question': clean(m_q.group(2))
                })

    if cur_q:
        mcqs.append(cur_q)

    items = []
    if mcqs:
        title = 'សំណួរវិញ្ញាសាប្រឡងទ្រឹស្ដីបញ្ចប់វគ្គ (២៥ សំណួរ)' if is_exam else 'ក. សំណួរពហុជ្រើសរើស (Multiple Choice Questions)'
        items.append({
            'type': 'quiz',
            'title': title,
            'isExam': is_exam,
            'questions': mcqs
        })
    if short_qs:
        items.append({
            'type': 'short-questions',
            'title': 'ខ. សំណួរត្រិះរិះ និងឆ្លើយខ្លី (Short Answer Questions)',
            'questions': short_qs
        })
    return items


def build_lesson(docx, images, lesson_id, lesson_num, lesson_blocks):
    lb = LessonBuilder(docx, images, lesson_id, lesson_num)
    i = 0
    n_blocks = len(lesson_blocks)

    while i < n_blocks:
        b = lesson_blocks[i]
        if b['k'] == 'p':
            raw = b['text']
            p = plain(raw)
            txt = clean(raw)
            style = b.get('style', '')

            # Check if this is an objectives paragraph
            if 'គោលបំណងនៃ' in p or p.startswith('🎯'):
                lines = [clean(l) for l in raw.split('\n') if clean(l)]
                for l in lines:
                    if l.startswith('✔') or l.startswith('•') or l.startswith('-'):
                        lb.objectives.append(re.sub(r'^[✔•\-\s]+', '', l).strip())
                i += 1
                continue

            # Review Questions Section
            if p.startswith('សំណួរត្រួតពិនិត្យ'):
                sec_title = 'សំណួរត្រួតពិនិត្យការយល់ដឹង (Chapter Review Questions)'
                lb.section(sec_title)

                # Gather all blocks belonging to this review section
                review_blocks = []
                i += 1
                while i < n_blocks:
                    nb = lesson_blocks[i]
                    if nb['k'] == 'p':
                        np_txt = plain(nb['text'])
                        n_style = nb.get('style', '')
                        if (n_style in ('មេរៀនទី', 'a2', 'ចំណុច', 'a0') or 
                            np_txt.startswith('មេរៀនទី') or np_txt.startswith('ឧបសម្ព័ន្ធទី') or
                            re.match(r'^[០-៩0-9]+\.[០-៩0-9]+', np_txt)):
                            break
                    review_blocks.append(nb)
                    i += 1

                parsed_items = parse_quiz_block(review_blocks, lesson_num, is_exam=False)
                for item in parsed_items:
                    lb.add(item)
                continue

            # Appendix 3: Answer Key Section
            if lesson_id == 'lesson-17' and ('កម្រងចម្លើយ' in p or 'Answer Key' in p):
                sec_title = 'កម្រងចម្លើយផ្លូវការ (Official Answer Key)'
                lb.section(sec_title)
                lb.add({'type': 'callout', 'kind': 'tip', 'text': txt})
                i += 1
                continue

            # Check if this paragraph is a section heading
            is_sec = False
            if style in ('ចំណុច', 'a0'):
                is_sec = True
            elif re.match(r'^[០-៩0-9]+\.[០-៩0-9]+', p):
                is_sec = True
            elif lesson_id == 'lesson-15' and ('តារាងផ្លូវកាត់' in p or 'Keyboard Shortcuts' in p):
                is_sec = True
            elif lesson_id == 'lesson-16' and ('កម្រងវាក្យសព្ទ' in p or 'Technical Glossary' in p):
                is_sec = True
            elif lesson_id == 'lesson-17' and ('កម្រងចម្លើយ' in p or 'Answer Key' in p):
                is_sec = True

            if is_sec:
                lb.section(txt)
                i += 1
                continue

            # Check if paragraph has images
            if b['images']:
                caption = ''
                if i + 1 < n_blocks and lesson_blocks[i + 1]['k'] == 'p':
                    next_raw = lesson_blocks[i + 1]['text']
                    next_p = plain(next_raw)
                    if next_p.startswith('រូបភាពទី') or next_p.startswith('រូបទី'):
                        caption = clean(next_raw)
                        i += 1  # consume caption
                elif p.startswith('រូបភាពទី') or p.startswith('រូបទី'):
                    caption = txt

                if not caption:
                    caption = lb.cur['title'] if lb.cur else ''

                for img in b['images']:
                    rel = images.write(img, lesson_id)
                    lb.add({'type': 'image', 'src': rel, 'caption': caption})
                i += 1
                continue

            if p.startswith('រូបភាពទី') or p.startswith('រូបទី'):
                i += 1
                continue

            # Callouts
            if p.startswith('គន្លឹះ') or 'Keyboard Shortcut' in p:
                lb.add({'type': 'callout', 'kind': 'tip', 'text': txt})
            elif p.startswith('ចំណាំ') or p.startswith('សម្គាល់') or "Instructor's Note" in p or p.startswith('សារដាស់តឿន'):
                lb.add({'type': 'callout', 'kind': 'note', 'text': txt})
            elif p.startswith('លំហាត់អនុវត្តន៍') or 'Hands-on Practice' in p:
                lb.add({'type': 'callout', 'kind': 'tip', 'text': txt})
            elif style == 'List Paragraph' or b['num']:
                nid, ilvl = b['num'] if b['num'] else ('list', '0')
                if re.match(r'^\s*[✔•▪\-]\s*', raw):
                    lb.list_item('bullets', nid + ':' + ilvl, re.sub(r'^\s*[✔•▪\-]\s*', '', txt))
                elif re.match(r'^\s*(?:[0-9]+|[a-zA-Z]|[០-៩]+)[\.\)]\s*', raw):
                    lb.list_item('steps', nid + ':' + ilvl, txt)
                else:
                    lb.list_item('bullets', nid + ':' + ilvl, txt)
            elif re.match(r'^\s*(?:[0-9]+|[a-zA-Z]|[០-៩]+)[\.\)]\s*', raw):
                lb.list_item('steps', 'manual-steps', txt)
            elif re.match(r'^\s*[✔•▪\-]\s*', raw):
                lb.list_item('bullets', 'manual-bullets', re.sub(r'^\s*[✔•▪\-]\s*', '', txt))
            elif txt:
                lb.add({'type': 'paragraph', 'text': txt})

            i += 1

        elif b['k'] == 'tbl':
            rows = b['rows']
            if len(rows) == 1 and len(rows[0]) == 1:
                txt = rows[0][0]['text']
                p = plain(txt)
                if '🎯' in txt or 'គោលបំណងនៃ' in txt:
                    lines = [clean(l) for l in txt.split('\n') if clean(l)]
                    for l in lines:
                        if l.startswith('✔') or l.startswith('•') or l.startswith('-'):
                            lb.objectives.append(re.sub(r'^[✔•\-\s]+', '', l).strip())
                elif 'គន្លឹះ' in txt or 'Keyboard Shortcut' in txt:
                    lb.add({'type': 'callout', 'kind': 'tip', 'text': clean(txt)})
                elif 'លំហាត់អនុវត្តន៍' in txt or 'Hands-on Practice' in txt:
                    lb.add({'type': 'callout', 'kind': 'tip', 'text': clean(txt)})
                elif 'ចំណាំ' in txt or 'សម្គាល់' in txt or "Instructor's Note" in txt or 'សារដាស់តឿន' in txt:
                    lb.add({'type': 'callout', 'kind': 'note', 'text': clean(txt)})
                elif txt:
                    lb.add({'type': 'callout', 'kind': 'note', 'text': clean(txt)})

                for img in rows[0][0]['images']:
                    rel = images.write(img, lesson_id)
                    lb.add({'type': 'image', 'src': rel, 'caption': lb.cur['title'] if lb.cur else ''})
            else:
                def cell_val(c):
                    t = clean(c['text'])
                    return {'text': t, 'colspan': c['span']} if c.get('span', 1) > 1 else t

                headers = [cell_val(c) for c in rows[0]]
                body_rows = [[cell_val(c) for c in r] for r in rows[1:]]

                # Merge consecutive split tables
                items = lb.cur['items'] if lb.cur else []
                prev = items[-1] if items else None
                if prev and prev['type'] == 'table' and len(headers) == len(prev['headers']) and headers[0] == '1':
                    prev['rows'].append(headers)
                    prev['rows'].extend(body_rows)
                else:
                    lb.add({'type': 'table', 'headers': headers, 'rows': body_rows})

                for r in rows:
                    for c in r:
                        for img in c['images']:
                            rel = images.write(img, lesson_id)
                            lb.add({'type': 'image', 'src': rel, 'caption': lb.cur['title'] if lb.cur else ''})
            i += 1

    return lb


def main(docx_path):
    print(f'Loading {docx_path}...')
    docx = Docx(docx_path)
    blocks = list(docx.blocks())

    # TOC Page numbers and TOC entries
    toc_pages = {}
    for b in blocks:
        if b['k'] == 'p' and (b['style'] in ('toc 1', 'TOC1')):
            text = b['text']
            m_page = re.search(r'([0-9]+)\s*$', text)
            page = int(m_page.group(1)) if m_page else None
            m_les = re.search(r'មេរៀនទី\s*([០-៩0-9]+)', text)
            m_app = re.search(r'ឧបសម្ព័ន្ធទី\s*([០-៩0-9]+)', text)
            if m_les:
                num = int(m_les.group(1).translate(KH2AR))
                toc_pages[num] = page
            elif m_app:
                num = 14 + int(m_app.group(1).translate(KH2AR))
                toc_pages[num] = page

    # Lesson boundaries
    lesson_starts = []
    for i, b in enumerate(blocks):
        if b['k'] == 'p':
            style = b.get('style', '')
            t = plain(b.get('text', ''))
            if (style in ('មេរៀនទី', 'a2') or 
                ((t.startswith('មេរៀនទី') or t.startswith('ឧបសម្ព័ន្ធទី')) and 
                 not style.startswith('toc') and not style.startswith('TOC'))):
                lesson_starts.append((i, t))

    # Reset images directory
    if os.path.isdir(IMG_DIR):
        shutil.rmtree(IMG_DIR)
    os.makedirs(IMG_DIR, exist_ok=True)
    images = ImageWriter(docx)

    lessons = []
    for idx, (pos, raw_title) in enumerate(lesson_starts):
        num = idx + 1
        lesson_id = f'lesson-{num:02d}'
        end_pos = lesson_starts[idx + 1][0] if idx + 1 < len(lesson_starts) else len(blocks)
        l_blocks = blocks[pos + 1 : end_pos]

        lb = build_lesson(docx, images, lesson_id, num, l_blocks)

        clean_title = clean(raw_title)
        is_appendix = num > 14
        app_num = num - 14 if is_appendix else None

        if not is_appendix:
            # Strip "មេរៀនទី X ៖ " prefix from title for cleaner display
            clean_title = re.sub(r'^មេរៀនទី\s*[០-៩0-9]+\s*[៖:]?\s*', '', clean_title)
            label = f"មេរៀនទី {str(num).translate(AR2KH)}"
            full_title = f"{label} ៖ {clean_title}"
        else:
            clean_title = re.sub(r'^ឧបសម្ព័ន្ធទី\s*[០-៩0-9]+\s*[៖:]?\s*', '', clean_title)
            label = f"ឧបសម្ព័ន្ធទី {str(app_num).translate(AR2KH)}"
            full_title = f"{label} ៖ {clean_title}"

        page_start = toc_pages.get(num, 1)
        next_page = toc_pages.get(num + 1)
        page_end = (next_page - 1) if next_page else (page_start + 2)

        lessons.append({
            'id': lesson_id,
            'number': num,
            'isAppendix': is_appendix,
            'appendixNum': app_num,
            'label': label,
            'title': clean_title,
            'fullTitle': full_title,
            'pageStart': page_start,
            'pageEnd': page_end,
            'objectives': lb.objectives,
            'sections': lb.sections
        })

    # Meta
    meta = {
        "titleKh": "ការរចនាក្រាហ្វិក និងកាត់តរូបភាព (Adobe Photoshop 2022)",
        "titleEn": "Graphic Design & Photo Editing (Basic Adobe Photoshop 2022)",
        "author": "រៀបចំដោយ ហេង ឧត្តម",
        "institutionKh": "វិទ្យាស្ថានពហុបច្ចេកទេសភូមិភាគតេជោសែនសៀមរាប",
        "institutionEn": "Regional Polytechnic Institute Techo Sen Siem Reap (RPITSSR)",
        "year": "២០២៦",
        "coverImage": "images/cover.webp",
        "logoImage": "images/logo.webp",
        "totalLessons": 14,
        "totalAppendices": 3,
        "totalPages": 140
    }

    # Preface
    preface = {
        "title": "អារម្ភកថា",
        "content": (
            "ក្នុងយុគសម័យបច្ចេកវិទ្យាឌីជីថល និងបដិវត្តឧស្សាហកម្ម ៤.០ វិស័យរចនាក្រាហ្វិក និងសារគមនាគមន៍រូបភាព (Visual Communication) "
            "បានដើរតួនាទីយ៉ាងសំខាន់មិនអាចខ្វះបានក្នុងគ្រប់វិស័យ រាប់ចាប់តាំងពីការផ្សព្វផ្សាយពាណិជ្ជកម្ម ការរចនាមាតិកាលើបណ្ដាញសង្គម "
            "ការបោះពុម្ព រហូតដល់ការរចនាគេហទំព័រ និងកម្មវិធីទូរស័ព្ទ។\n\n"
            "ដើម្បីឆ្លើយតបទៅនឹងតម្រូវការទីផ្សារការងារ និងការបណ្ដុះបណ្ដាលធនធានមនុស្សប្រកបដោយគុណវុឌ្ឍិ វិទ្យាស្ថានពហុបច្ចេកទេសភូមិភាគតេជោសែនសៀមរាប "
            "បានរៀបចំឯកសារមេរៀន «ការរចនាក្រាហ្វិក និងកាត់តរូបភាព (Basic Adobe Photoshop 2022)» សម្រាប់ជាជំនួយដល់ការបង្រៀនរបស់សាស្ត្រាចារ្យ "
            "និងការសិក្សាស្រាវជ្រាវរបស់និស្សិតដេប៉ាតឺម៉ង់ព័ត៌មានវិទ្យា កម្រិតសញ្ញាបត្រជាន់ខ្ពស់បច្ចេកទេស។\n\n"
            "ឯកសារនេះត្រូវបានរៀបចំឡើងយ៉ាងផ្ចិតផ្ចង់ ដោយប្រមូលផ្ដុំនូវខ្លឹមសារទ្រឹស្ដីគ្រឹះ គោលការណ៍រចនា និងជំហានអនុវត្តជាក់ស្ដែង "
            "អមដោយរូបភាពអេក្រង់ពណ៌ច្បាស់ៗ ដើម្បីឱ្យនិស្សិតងាយស្រួលយល់ និងអាចអនុវត្តតាមបានដោយខ្លួនឯង។ ខ្លឹមសារត្រូវបានរៀបចំយ៉ាងក្បោះក្បាយ "
            "គ្របដណ្ដប់លើមេរៀនចំនួន ១៤ និងឧបសម្ព័ន្ធសំខាន់ៗចំនួន ៣ រួមមាន ៖\n"
            "- មេរៀនទី ១ ដល់ ទី ៤ ៖ ការចាប់ផ្ដើម ស្វែងយល់ផ្ទាំងការងារ ឧបករណ៍ជ្រើសរើស និងការបម្លែងទំហំរូបភាព\n"
            "- មេរៀនទី ៥ ដល់ ទី ៧ ៖ ការគ្រប់គ្រង Layers, ឧបករណ៍ជក់គូរ Brush, ឧបករណ៍សរសេរអក្សរ Type និង Shape Tools\n"
            "- មេរៀនទី ៨ ដល់ ទី ១០ ៖ បច្ចេកទេសកែសម្ផស្សរូបថត Retouching, ការកែពន្លឺពណ៌ Adjustments និង Layer & Clipping Masks\n"
            "- មេរៀនទី ១១ ដល់ ទី ១៤ ៖ តម្រងបែបផែន Filters, ប្រព័ន្ធពណ៌ Color Modes, លំហូរការងារកម្រិតខ្ពស់ និងគម្រោងរចនាជាក់ស្ដែង\n"
            "- ឧបសម្ព័ន្ធទី ១ ដល់ ទី ៣ ៖ តារាងផ្លូវកាត់ក្តារចុច វចនានុក្រមបច្ចេកទេសក្រាហ្វិក និងកម្រងចម្លើយផ្លូវការ\n\n"
            "ទោះបីជាអ្នករៀបចំបានខិតខំប្រឹងប្រែងយ៉ាងណាក្តី ក៏ឯកសារនេះប្រហែលជានៅមានការខ្វះខាតដោយអចេតនា។ "
            "អ្នករៀបចំរីករាយទទួលយកនូវរាល់មតិរិះគន់ប្រកបដោយស្ថាបនាពីសំណាក់សាស្ត្រាចារ្យ និងនិស្សិតទាំងអស់ ដើម្បីបន្តកែលម្អឯកសារនេះឱ្យកាន់តែល្អប្រសើរឡើងបន្ថែមទៀត។"
        ),
        "signOff": {
            "location": "សៀមរាប",
            "date": "ឆ្នាំ២០២៦",
            "role": "រៀបចំ និងចងក្រងដោយ",
            "author": "ហេង ឧត្តម"
        }
    }

    # Course Intro
    course_intro = {
        "title": "សេចក្តីផ្តើមនៃមុខវិជ្ជា",
        "content": (
            "## ១. ការពិពណ៌នាអំពីមុខវិជ្ជា (Course Description)\n\n"
            "មុខវិជ្ជា **ការរចនាក្រាហ្វិក និងកាត់តរូបភាពជាមួយ Adobe Photoshop 2022 (Basic Adobe Photoshop 2022)** "
            "ត្រូវបានរៀបចំឡើងជាពិសេសសម្រាប់និស្សិតដេប៉ាតឺម៉ង់ព័ត៌មានវិទ្យា កម្រិតសញ្ញាបត្រជាន់ខ្ពស់បច្ចេកទេស (Higher Technical Diploma) "
            "នៃវិទ្យាស្ថានពហុបច្ចេកទេសភូមិភាគតេជោសែនសៀមរាប (RPITSSR)។ មុខវិជ្ជានេះផ្ដល់នូវមូលដ្ឋានគ្រឹះដ៏រឹងមាំ និងជំនាញអនុវត្តជាក់ស្ដែង "
            "លើការកែច្នៃ ការកាត់ត និងការរចនារូបភាពឌីជីថលបែបអាជីព ប្រកបដោយប្រសិទ្ធភាពខ្ពស់ និងស្របតាមស្ដង់ដារបច្ចេកវិទ្យាទំនើប។\n\n"
            "## ២. គោលដៅនៃមុខវិជ្ជា (Course Learning Outcomes)\n\n"
            "ក្រោយពេលបញ្ចប់ការសិក្សាមុខវិជ្ជានេះចប់ជាស្ថាពរ សិស្ស-និស្សិតនឹងមានសមត្ថភាព ៖\n"
            "- យល់ដឹងច្បាស់ពីចំណុចប្រទាក់ការងារ Workspace, Tools Panel, Options Bar, Panels និងការប្រើប្រាស់ Shortcuts ជំនាញ\n"
            "- បង្កើត និងរៀបចំផ្ទាំងការងារ (Canvas) ត្រឹមត្រូវតាមខ្នាត និង Resolution ទាំងសម្រាប់ឌីជីថល (72 DPI) និងបោះពុម្ព (300 DPI)\n"
            "- ស្ទាត់ជំនាញលើការប្រើប្រាស់ឧបករណ៍ជ្រើសរើស (Marquee, Lasso, AI Object Selection, Select Subject) និង Select and Mask\n"
            "- យល់ដឹងស៊ីជម្រៅពីការគ្រប់គ្រង Layers (Groups, Blending Modes, Opacity/Fill) និងឧបករណ៍គូរជក់ Brush/Painting Tools\n"
            "- រៀបចំអត្ថបទខ្មែរ-អង់គ្លេសប្រកបដោយសោភ័ណភាព (Character/Paragraph Panels) និងការគូររូបរាងធរណីមាត្រ Vector Shapes\n"
            "- អនុវត្តបច្ចេកទេសកាត់តកែសម្ផស្សរូបថត (Retouching) ដោយ Spot Healing Brush, Clone Stamp និង Content-Aware Fill\n"
            "- កែសម្រួលពន្លឺ-ពណ៌ (Adjustment Layers) និងការច្របាច់បញ្ចូលរូបភាពច្នៃប្រឌិតដោយ Layer Mask & Clipping Mask\n"
            "- អនុវត្តតម្រងបែបផែន (Filters, Layer Styles), ប្រព័ន្ធពណ៌ RGB/CMYK និងគម្រោងរចនាក្រាហ្វិកពាណិជ្ជកម្មជាក់ស្ដែង\n\n"
            "## ៣. គោលការណ៍វាយតម្លៃលទ្ធផលសិក្សា (Assessment Criteria)\n\n"
            "- **ក. ការងារជាក្រុម (Teamwork) ៖** ១០%\n"
            "- **ខ. វត្តមាន និងការចូលរួម (Attendance & Participation) ៖** ១៥%\n"
            "- **គ. កិច្ចការស្រាវជ្រាវ (Assignments) ៖** ១៥%\n"
            "- **ឃ. ប្រឡងពាក់កណ្ដាលឆមាស (Midterm Exam) ៖** ២០%\n"
            "- **ង. ប្រឡងបញ្ចប់ឆមាស (Final Exam) ៖** ៤០%"
        )
    }

    # References
    references = [
        {
            "author": "Adobe Systems Inc.",
            "year": "2022",
            "title": "Adobe Photoshop User Guide & New Features Reference (Release 23.x)",
            "publisher": "Adobe Press, San Jose, California"
        },
        {
            "author": "Andrew Faulkner & Conrad Chavez",
            "year": "2022",
            "title": "Adobe Photoshop Classroom in a Book (2022 Release)",
            "publisher": "Pearson Education / Adobe Press"
        },
        {
            "author": "Steve Caplin",
            "year": "2021",
            "title": "How to Cheat in Photoshop: The art of creating realistic photomontages",
            "publisher": "Routledge / Focal Press"
        },
        {
            "author": "ដេប៉ាតឺម៉ង់ព័ត៌មានវិទ្យា RPITSSR",
            "year": "២០២៦",
            "title": "គ្រោងប្លង់មេរៀន (Course Outline) មុខវិជ្ជា ការរចនាក្រាហ្វិក និងកាត់តរូបភាព",
            "publisher": "វិទ្យាស្ថានពហុបច្ចេកទេសភូមិភាគតេជោសែនសៀមរាប"
        }
    ]

    data = {
        'meta': meta,
        'preface': preface,
        'courseIntro': course_intro,
        'lessons': lessons,
        'references': references
    }

    header = ('/* Course content generated from Basic_Adobe_Photoshop_2022_Khmer_Final.docx\n'
              '   by tools/build_course_data.py. */\n')
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        f.write(header + 'window.COURSE_DATA = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')

    print(f'Successfully built {len(lessons)} entries (14 lessons + 4 appendices)!')
    print(f'Total images written as WebP: {len(images.done)} ({images.bytes_in / 1e6:.1f} MB -> {images.bytes_out / 1e6:.1f} MB)')


if __name__ == '__main__':
    default_docx = os.path.join(os.path.dirname(ROOT), 'Basic_Adobe_Photoshop_2022_Khmer_Final.docx')
    docx_file = sys.argv[1] if len(sys.argv) > 1 else default_docx
    main(docx_file)
