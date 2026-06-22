import jsPDF from 'jspdf';

/**
 * Generates and auto-downloads a bill PDF.
 *
 * @param {{ token, patient, billItems, total, prescription, clinicName }} params
 */
export function generateBillPDF({ token, patient, billItems, total, prescription, clinicName = 'CLINIC MANAGEMENT' }) {
  const doc  = new jsPDF({ unit: 'mm', format: 'a5' });
  const W    = doc.internal.pageSize.getWidth();
  let y      = 16;

  const line = (txt, x = 14, size = 10, style = 'normal') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.text(txt, x, y);
    y += size * 0.5 + 2;
  };

  const hr = () => {
    doc.setDrawColor(200);
    doc.line(14, y, W - 14, y);
    y += 4;
  };

  // Header
  line(clinicName.toUpperCase(), 14, 14, 'bold');
  line(`Date: ${new Date().toLocaleDateString('en-IN')}`, W - 50, 9);
  y -= 6;
  hr();

  // Patient details
  line(`Patient: ${patient.name}`, 14, 10, 'bold');
  line(`Phone:   ${patient.phone}`);
  line(`Token:   #${token.token_number}`);
  hr();

  // Bill items
  line('BILL', 14, 11, 'bold');
  billItems.forEach(item => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(item.description, 14, y);
    doc.text(`INR ${item.amount.toFixed(2)}`, W - 14, y, { align: 'right' });
    y += 6;
  });
  hr();

  // Total
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Total', 14, y);
  doc.text(`INR ${total.toFixed(2)}`, W - 14, y, { align: 'right' });
  y += 8;

  // Prescription (if available)
  if (prescription) {
    hr();
    line('PRESCRIPTION DETAILS', 14, 11, 'bold');
    if (prescription.diagnosis) line(`Diagnosis: ${prescription.diagnosis}`);
    const meds = typeof prescription.medicines === 'string' 
      ? JSON.parse(prescription.medicines || '[]')
      : (prescription.medicines || []);
    meds.forEach((m, i) => {
      line(`${i + 1}. ${m.name}  |  ${m.dosage}  |  ${m.duration}`);
    });
    if (prescription.notes) line(`Notes: ${prescription.notes}`);
  }

  // Footer
  y = doc.internal.pageSize.getHeight() - 12;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text('Thank you for visiting. Please retain this receipt.', W / 2, y, { align: 'center' });

  doc.save(`bill-token-${token.token_number}-${patient.name.replace(/\s+/g, '_')}.pdf`);
}
