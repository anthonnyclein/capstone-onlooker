/**
 * Generates a valid standard PDF (PDF-1.4) data URL without external libraries.
 * Used as a reliable fallback whenever an uploaded PDF file data URL is missing.
 */
export function generateManuscriptPdfDataUrl(
  projectTitle: string,
  taskName: string,
  fileName: string,
  studentName: string,
  submittedAt?: string
): string {
  const safeTitle = (projectTitle || 'Capstone Project Proposal').replace(/[\(\)\\\r\n]/g, ' ');
  const safeTask = (taskName || 'Proposal Chapter').replace(/[\(\)\\\r\n]/g, ' ');
  const safeStudent = (studentName || 'Student Proponent').replace(/[\(\)\\\r\n]/g, ' ');
  const safeFile = (fileName || 'Manuscript.pdf').replace(/[\(\)\\\r\n]/g, ' ');
  const safeDate = (submittedAt ? new Date(submittedAt).toLocaleDateString() : new Date().toLocaleDateString()).replace(/[\(\)\\\r\n]/g, ' ');

  const objects: string[] = [];
  function addObject(content: string): number {
    objects.push(content);
    return objects.length;
  }

  const fontObj = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldObj = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  // Page 1: Cover Page
  let p1Text = 'BT\n';
  p1Text += '/F2 16 Tf\n50 720 Td\n(MINDANAO STATE UNIVERSITY AT NAAWAN) Tj\n';
  p1Text += '/F1 12 Tf\n0 -22 Td\n(College of Business and Information Technology) Tj\n';
  p1Text += '/F1 11 Tf\n0 -18 Td\n(Department of Information Technology) Tj\n';
  p1Text += '/F2 15 Tf\n0 -45 Td\n(' + safeTitle + ') Tj\n';
  p1Text += '/F1 11 Tf\n0 -26 Td\n(Deliverable: ' + safeTask + ') Tj\n';
  p1Text += '/F1 11 Tf\n0 -20 Td\n(Submitted by: ' + safeStudent + ') Tj\n';
  p1Text += '/F1 10 Tf\n0 -18 Td\n(Attached File: ' + safeFile + ' | Date: ' + safeDate + ') Tj\n';
  p1Text += '0 -40 Td\n';
  const p1Lines = [
    'CHAPTER 1: INTRODUCTION',
    '1.1 Project Overview',
    'This capstone project introduces an automated proposal management and defense evaluation system.',
    'It supports manuscript submission, iterative revision tracking, rubric-based scoring, and defense reporting.',
    '1.2 Significance of the Study',
    'Streamlines coordination among IT capstone proponents, faculty coordinators, and panel evaluation committees.'
  ];
  for (const l of p1Lines) {
    p1Text += '/F1 10 Tf\n(' + l.replace(/[\(\)\\\r\n]/g, ' ') + ') Tj\n0 -18 Td\n';
  }
  p1Text += 'ET';

  const s1Bytes = new TextEncoder().encode(p1Text);
  const c1Obj = addObject('<< /Length ' + s1Bytes.length + ' >>\nstream\n' + p1Text + '\nendstream');
  const page1 = addObject('<< /Type /Page /Parent %PAGES% /MediaBox [0 0 612 792] /Contents ' + c1Obj + ' 0 R /Resources << /Font << /F1 ' + fontObj + ' 0 R /F2 ' + fontBoldObj + ' 0 R >> >> >>');

  // Page 2: Objectives & Architecture
  let p2Text = 'BT\n';
  p2Text += '/F2 14 Tf\n50 720 Td\n(1.3 OBJECTIVES AND METHODOLOGY) Tj\n';
  p2Text += '0 -30 Td\n';
  const p2Lines = [
    'General Objective:',
    'To design and deploy an integrated Capstone Project Proposal Management System for MSU Naawan.',
    'Specific Objectives:',
    '1. Provide a central portal for students to submit chapter deliverables and track milestones.',
    '2. Equip faculty with pin-point document annotation tools and customizable scoring rubrics.',
    '3. Automate defense scheduling, panel scoring aggregation, and official proposal defense reports.',
    '4. Secure persistent file archival and database synchronization using PostgreSQL relational tables.',
    'System Architecture Summary:',
    '- Client: React 19 Single Page Application with Tailwind CSS and responsive modal views.',
    '- Backend: Node.js Express full-stack API with PostgreSQL relational schema and JWT authentication.'
  ];
  for (const l of p2Lines) {
    p2Text += '/F1 10 Tf\n(' + l.replace(/[\(\)\\\r\n]/g, ' ') + ') Tj\n0 -18 Td\n';
  }
  p2Text += 'ET';

  const s2Bytes = new TextEncoder().encode(p2Text);
  const c2Obj = addObject('<< /Length ' + s2Bytes.length + ' >>\nstream\n' + p2Text + '\nendstream');
  const page2 = addObject('<< /Type /Page /Parent %PAGES% /MediaBox [0 0 612 792] /Contents ' + c2Obj + ' 0 R /Resources << /Font << /F1 ' + fontObj + ' 0 R /F2 ' + fontBoldObj + ' 0 R >> >> >>');

  const pagesObj = addObject('<< /Type /Pages /Kids [' + page1 + ' 0 R ' + page2 + ' 0 R] /Count 2 >>');
  for (let i = 0; i < objects.length; i++) {
    objects[i] = objects[i].replace('%PAGES%', pagesObj + ' 0 R');
  }

  const catalogObj = addObject('<< /Type /Catalog /Pages ' + pagesObj + ' 0 R >>');

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(new TextEncoder().encode(out).length);
    out += (i + 1) + ' 0 obj\n' + objects[i] + '\nendobj\n';
  }

  const startXref = new TextEncoder().encode(out).length;
  out += 'xref\n0 ' + (objects.length + 1) + '\n';
  out += '0000000000 65535 f \n';
  for (const off of offsets) {
    out += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  out += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + catalogObj + ' 0 R >>\n';
  out += 'startxref\n' + startXref + '\n%%EOF\n';

  const binary = new TextEncoder().encode(out);
  let base64 = '';
  const len = binary.byteLength;
  for (let i = 0; i < len; i++) {
    base64 += String.fromCharCode(binary[i]);
  }
  return 'data:application/pdf;base64,' + btoa(base64);
}

