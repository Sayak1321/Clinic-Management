import jsPDF from 'jspdf';

/**
 * Generates and auto-downloads a print-optimised prescription PDF.
 *
 * @param {{ token, patient, prescription, doctor, clinicName }} params
 */
export function generatePrescriptionPDF({ token, patient, prescription, doctor, clinicName = 'CLINIC MANAGEMENT' }) {
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

  // Doctor Details
  line(`Dr. ${doctor.name || 'Doctor'}`, 14, 11, 'bold');
  if (doctor.reg_number) {
    line(`Reg No: ${doctor.reg_number}`, 14, 9, 'normal');
  }
  hr();

  // Patient details
  line(`Patient: ${patient.name}`, 14, 10, 'bold');
  line(`Phone:   ${patient.phone}`);
  if (patient.dob) {
    line(`DOB:     ${new Date(patient.dob).toLocaleDateString('en-IN')}`);
  }
  line(`Token:   #${token.token_number}`);
  hr();

  // Prescription Header
  line('PRESCRIPTION (Rx)', 14, 11, 'bold');
  if (prescription.diagnosis) {
    line(`Diagnosis: ${prescription.diagnosis}`, 14, 10, 'bold');
    y += 2;
  }

  // Medicines Table Header
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Medicine Name', 14, y);
  doc.text('Dosage', W - 65, y);
  doc.text('Duration', W - 14, y, { align: 'right' });
  y += 6;

  doc.setDrawColor(220);
  doc.line(14, y - 4, W - 14, y - 4);

  // Medicines
  doc.setFont('helvetica', 'normal');
  const meds = typeof prescription.medicines === 'string'
    ? JSON.parse(prescription.medicines || '[]')
    : (prescription.medicines || []);

  meds.forEach(m => {
    // If the medicine name is too long, truncate it
    const displayName = m.name.length > 25 ? m.name.substring(0, 22) + '...' : m.name;
    doc.text(displayName, 14, y);
    doc.text(m.dosage, W - 65, y);
    doc.text(m.duration, W - 14, y, { align: 'right' });
    y += 6;
  });

  if (prescription.notes) {
    y += 4;
    line(`Notes: ${prescription.notes}`);
  }

  // Signature line
  y = doc.internal.pageSize.getHeight() - 25;
  doc.line(W - 60, y, W - 14, y);
  y += 4;
  doc.setFontSize(9);
  doc.text('Doctor Signature', W - 37, y, { align: 'center' });

  // Footer
  y = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('For internal or pharmacy use.', W / 2, y, { align: 'center' });

  doc.save(`rx-token-${token.token_number}-${patient.name.replace(/\s+/g, '_')}.pdf`);
}
