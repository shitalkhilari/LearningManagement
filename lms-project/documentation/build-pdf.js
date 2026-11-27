const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const source = fs.readFileSync(path.join(__dirname, '..', 'DEVELOPER_GUIDELINES.md'), 'utf8');
const output = path.join(__dirname, 'NESTJS_LMS_LEARNING_GUIDE.pdf');
const doc = new PDFDocument({ size: 'A4', margin: 54, bufferPages: true });
doc.pipe(fs.createWriteStream(output));

doc.font('Times-Bold').fontSize(28).text('NestJS LMS Learning Guide', { align: 'center' });
doc.moveDown();
doc.font('Times-Roman').fontSize(14).text('eLearning Management System', { align: 'center' });
doc.moveDown();
doc.fontSize(12).text('A beginner-friendly guide to the NestJS, PostgreSQL, and React application in this assignment.', { align: 'center' });
doc.moveDown(2);
doc.text('This PDF is generated from DEVELOPER_GUIDELINES.md at the project root.', { align: 'center' });
doc.addPage();

doc.font('Times-Bold').fontSize(18).text('Contents');
doc.moveDown(0.5);
const chapters = source.split('\n').filter((line) => line.startsWith('## ')).map((line) => line.slice(3));
doc.font('Times-Roman').fontSize(12);
chapters.forEach((chapter, index) => doc.text(`${index + 1}. ${chapter}`));
doc.addPage();

const lines = source.replace(/\r\n/g, '\n').split('\n');
let inCode = false;
let code = [];
for (const line of lines) {
  if (line.startsWith('```')) {
    if (!inCode) {
      inCode = true;
      code = [];
    } else {
      drawCode(code.join('\n'));
      inCode = false;
    }
    continue;
  }
  if (inCode) {
    code.push(line);
    continue;
  }
  if (line.startsWith('|')) {
    if (/^\|\s*-+/.test(line)) continue;
    ensureSpace(18);
    doc.font('Times-Roman').fontSize(10).text(line.replace(/\|/g, '  ').trim());
    continue;
  }
  if (line.startsWith('# ')) {
    ensureSpace(40);
    doc.font('Times-Bold').fontSize(20).fillColor('#111827').text(line.slice(2));
    doc.moveDown(0.4);
  } else if (line.startsWith('## ')) {
    ensureSpace(36);
    doc.font('Times-Bold').fontSize(16).text(line.slice(3));
    doc.moveDown(0.3);
  } else if (line.startsWith('### ')) {
    ensureSpace(28);
    doc.font('Times-Bold').fontSize(13).text(line.slice(4));
    doc.moveDown(0.2);
  } else if (line.startsWith('- ')) {
    ensureSpace(18);
    doc.font('Times-Roman').fontSize(11).text(`• ${line.slice(2)}`, { indent: 12 });
  } else if (line.trim() !== '') {
    ensureSpace(18);
    doc.font('Times-Roman').fontSize(11).text(line, { align: 'left' });
    doc.moveDown(0.2);
  }
}

const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i += 1) {
  doc.switchToPage(i);
  doc.font('Times-Roman').fontSize(9).fillColor('#52606d');
  doc.text(`NestJS LMS Learning Guide    ${i + 1} / ${range.count}`, 54, doc.page.height - 36, {
    width: doc.page.width - 108,
    align: 'center',
    lineBreak: false,
  });
}
doc.end();

function drawCode(block) {
  ensureSpace(48);
  doc.font('Courier').fontSize(8.5).fillColor('#102a43');
  doc.text(block, { width: doc.page.width - 108 });
  doc.moveDown(0.4);
  doc.fillColor('#111827');
}

function ensureSpace(height) {
  if (doc.y + height > doc.page.height - 60) doc.addPage();
}
