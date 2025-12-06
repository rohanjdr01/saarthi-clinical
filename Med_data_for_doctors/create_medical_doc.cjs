const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel,
        AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign } = require('docx');
const fs = require('fs');

const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };

function createHeaderRow(cells) {
  return new TableRow({
    tableHeader: true,
    children: cells.map(text => new TableCell({
      borders: cellBorders,
      width: { size: 2340, type: WidthType.DXA },
      shading: { fill: "4472C4", type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: text, bold: true, size: 22, color: "FFFFFF" })]
      })]
    }))
  });
}

function createDataRow(cells) {
  return new TableRow({
    children: cells.map(text => new TableCell({
      borders: cellBorders,
      width: { size: 2340, type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text: text, size: 20 })] })]
    }))
  });
}

function createSection(title, data) {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun(title)]
    }),
    new Table({
      columnWidths: [2340, 2340, 2340, 2340],
      margins: { top: 100, bottom: 100, left: 150, right: 150 },
      rows: [
        createHeaderRow(["Data Field", "Type", "Example", "Notes"]),
        ...data.map(row => createDataRow(row))
      ]
    }),
    new Paragraph({ text: "" })
  ];
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal",
        run: { size: 32, bold: true, color: "2F5496", font: "Arial" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal",
        run: { size: 28, bold: true, color: "2F5496", font: "Arial" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } }
    ]
  },
  sections: [{
    properties: {
      page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
    },
    children: [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: "Saarthi Clinical Platform", bold: true, size: 48 })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: "Medical Data Overview - For Clinical Review", size: 28 })]
      }),
      new Paragraph({
        spacing: { after: 400 },
        children: [new TextRun({
          text: "This document outlines all medical data that the Saarthi Clinical Platform captures and stores. Please review each section to verify data completeness and accuracy.",
          size: 22
        })]
      }),

      ...createSection("1. PATIENT INFORMATION - Demographics", [
        ["Patient ID", "Text", "pt_abc123", "System-generated unique identifier"],
        ["Patient Name", "Text", "John Doe", "Full name"],
        ["Age", "Number", "65", "Age in years"],
        ["Gender", "Text", "male, female, other", "Patient gender"],
        ["Status", "Text", "active, inactive", "Current patient status"]
      ]),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
        children: [new TextRun("Caregiver Information")]
      }),
      new Table({
        columnWidths: [2340, 2340, 2340, 2340],
        margins: { top: 100, bottom: 100, left: 150, right: 150 },
        rows: [
          createHeaderRow(["Data Field", "Type", "Example", "Notes"]),
          createDataRow(["Caregiver Name", "Text", "Jane Doe", "Primary caregiver name"]),
          createDataRow(["Relationship", "Text", "daughter, spouse", "Relationship to patient"]),
          createDataRow(["Contact Number", "Phone", "+91-9999999999", "Emergency contact"])
        ]
      }),
      new Paragraph({ text: "" }),

      ...createSection("2. DIAGNOSIS INFORMATION", [
        ["Primary Cancer Type", "Text", "Breast Cancer", "Main cancer diagnosis"],
        ["Cancer Subtype", "Text", "Invasive Ductal Carcinoma", "Specific subtype"],
        ["Diagnosis Date", "Date", "2024-01-15", "Date of confirmed diagnosis"],
        ["Tumor Location", "Text", "Upper outer quadrant, left breast", "Anatomical location"],
        ["Laterality", "Text", "left, right, bilateral", "Which side affected"],
        ["Tumor Size", "Number", "2.5 cm", "Size in centimeters"],
        ["Tumor Grade", "Text", "G1, G2, G3, G4", "Histological grade"],
        ["Histology", "Text", "Ductal carcinoma", "Tissue type"],
        ["ER Status", "Text", "positive, negative", "Estrogen Receptor"],
        ["PR Status", "Text", "positive, negative", "Progesterone Receptor"],
        ["HER2 Status", "Text", "positive, negative", "HER2/neu status"]
      ]),

      ...createSection("3. STAGING INFORMATION (TNM)", [
        ["Clinical T", "Text", "cT2", "Tumor size/extent"],
        ["Clinical N", "Text", "cN1", "Lymph node involvement"],
        ["Clinical M", "Text", "cM0", "Metastasis status"],
        ["Clinical Stage", "Text", "IIA, IIB, IIIA", "Overall clinical stage"],
        ["Pathological T", "Text", "pT2", "Post-surgery tumor"],
        ["Pathological N", "Text", "pN1", "Post-surgery nodes"],
        ["Pathological M", "Text", "pM0", "Post-surgery metastasis"],
        ["Pathological Stage", "Text", "IIA, IIB", "Overall pathological stage"],
        ["Staging System", "Text", "AJCC 8th", "Which system used"],
        ["Staging Date", "Date", "2024-01-20", "When determined"]
      ]),

      ...createSection("4. TREATMENT PLAN", [
        ["Regimen Name", "Text", "AC-T", "Treatment protocol name"],
        ["Treatment Intent", "Text", "adjuvant, neoadjuvant", "Purpose of treatment"],
        ["Treatment Line", "Text", "first-line, second-line", "Which line of therapy"],
        ["Protocol Name", "Text", "AC-T Protocol", "Full protocol name"],
        ["Drug Names", "List", "Doxorubicin, Cyclophosphamide", "All drugs in regimen"],
        ["Start Date", "Date", "2024-02-01", "Treatment start date"],
        ["Planned Cycles", "Number", "8", "Total cycles planned"],
        ["Treatment Status", "Text", "active, completed", "Current status"]
      ]),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
        children: [new TextRun("Treatment Cycle Details")]
      }),
      new Table({
        columnWidths: [2340, 2340, 2340, 2340],
        margins: { top: 100, bottom: 100, left: 150, right: 150 },
        rows: [
          createHeaderRow(["Data Field", "Type", "Example", "Notes"]),
          createDataRow(["Cycle Number", "Number", "1, 2, 3", "Which cycle"]),
          createDataRow(["Planned Date", "Date", "2024-02-01", "When scheduled"]),
          createDataRow(["Actual Date", "Date", "2024-02-01", "When administered"]),
          createDataRow(["Cycle Status", "Text", "completed, delayed", "Status of cycle"]),
          createDataRow(["Dose Percentage", "Number", "100%, 75%", "% of full dose given"]),
          createDataRow(["Drug Name", "Text", "Doxorubicin", "Specific drug"]),
          createDataRow(["Dose", "Number", "60", "Dose amount"]),
          createDataRow(["Unit", "Text", "mg/m2, mg", "Dose unit"]),
          createDataRow(["Route", "Text", "IV, PO, SC", "How administered"]),
          createDataRow(["Adverse Event", "Text", "Nausea, Neutropenia", "Side effect"]),
          createDataRow(["CTCAE Grade", "Number", "1, 2, 3, 4, 5", "Severity (1=mild, 5=death)"])
        ]
      }),
      new Paragraph({ text: "" }),

      ...createSection("5. LABORATORY RESULTS", [
        ["Test Name", "Text", "Hemoglobin, WBC", "Name of lab test"],
        ["Result Value", "Number", "10.5, 7500", "Numeric result"],
        ["Unit", "Text", "g/dL, cells/mcL", "Unit of measurement"],
        ["Test Date", "Date", "2025-01-01", "When test performed"],
        ["Is Abnormal", "Yes/No", "Yes, No", "Out of normal range"]
      ]),

      ...createSection("6. CURRENT MEDICATIONS", [
        ["Medication Name", "Text", "Cisplatin, Lisinopril", "Drug name"],
        ["Dose", "Number", "50", "Dose amount"],
        ["Dose Unit", "Text", "mg, mcg", "Dose measurement"],
        ["Frequency", "Text", "q3w, daily, BID", "How often given"],
        ["Route", "Text", "IV, PO, SC", "Administration route"],
        ["Status", "Text", "active, discontinued", "Current status"],
        ["Discontinuation Reason", "Text", "Completed regimen", "Why stopped"]
      ]),

      ...createSection("7. MEDICAL HISTORY", [
        ["Past Medical Condition", "Text", "Hypertension, Diabetes", "Previous condition"],
        ["Diagnosis Date", "Date", "2010-01-01", "When diagnosed"],
        ["Surgical Procedure", "Text", "Appendectomy", "Surgery performed"],
        ["Surgery Date", "Date", "2015-05-05", "When performed"],
        ["Family Relationship", "Text", "mother, father", "Family member"],
        ["Family Condition", "Text", "Breast cancer", "Condition in family"],
        ["Tobacco Use", "Text", "never, former, current", "Smoking status"],
        ["Alcohol Use", "Text", "never, occasional", "Drinking status"]
      ]),

      ...createSection("8. CLINICAL ALERTS", [
        ["Alert Type", "Text", "clinical, administrative", "Category of alert"],
        ["Severity", "Text", "high, medium, low", "How urgent"],
        ["Title", "Text", "Neutropenia risk", "Brief description"],
        ["Description", "Text", "ANC trending down", "Detailed information"],
        ["Status", "Text", "active, acknowledged", "Current status"],
        ["Acknowledged By", "Text", "Dr. Smith", "Who reviewed alert"]
      ]),

      ...createSection("9. CLINICAL DECISIONS", [
        ["Decision Type", "Text", "treatment_plan", "Type of decision"],
        ["Clinical Question", "Text", "Next line therapy?", "Question addressed"],
        ["Decision Made", "Text", "Start AC-T regimen", "Decision reached"],
        ["Implementation Status", "Text", "planned, in_progress", "Current status"]
      ]),

      ...createSection("10. PATIENT DOCUMENTS", [
        ["Document ID", "Text", "doc_123", "System identifier"],
        ["Filename", "Text", "pathology_report.pdf", "Original file name"],
        ["Document Type", "Text", "pathology, imaging, lab", "Category"],
        ["Processing Status", "Text", "pending, completed", "Upload status"],
        ["Medical Highlight", "Text", "Biopsy confirms IDC", "Key finding"],
        ["Upload Date", "Date/Time", "2024-01-15 10:30 AM", "When uploaded"]
      ]),

      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [new TextRun("VERIFICATION CHECKLIST")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "Please verify the following:", bold: true })]
      }),
      new Paragraph({
        children: [new TextRun("☐ All essential medical data fields are included")]
      }),
      new Paragraph({
        children: [new TextRun("☐ Field names are clear and unambiguous")]
      }),
      new Paragraph({
        children: [new TextRun("☐ Example values represent realistic clinical scenarios")]
      }),
      new Paragraph({
        children: [new TextRun("☐ No critical clinical information is missing")]
      }),
      new Paragraph({
        children: [new TextRun("☐ Data types make sense for each field")]
      }),
      new Paragraph({
        children: [new TextRun("☐ Biomarker options cover all necessary values")]
      }),
      new Paragraph({
        children: [new TextRun("☐ Staging follows current standards (AJCC 8th)")]
      }),
      new Paragraph({
        children: [new TextRun("☐ Treatment tracking captures necessary details")]
      }),
      new Paragraph({
        children: [new TextRun("☐ Side effect grading follows CTCAE standards")]
      }),
      new Paragraph({
        children: [new TextRun("☐ Lab result tracking is sufficient")]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("☐ Medical history sections are comprehensive")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [new TextRun("FEEDBACK SECTION")]
      }),
      new Paragraph({
        children: [new TextRun({ text: "Please note any:", bold: true })]
      }),
      new Paragraph({ text: "" }),
      new Paragraph({ children: [new TextRun("Missing data fields:")] }),
      new Paragraph({ text: "________________________________________________________________" }),
      new Paragraph({ text: "" }),
      new Paragraph({ children: [new TextRun("Unclear terminology:")] }),
      new Paragraph({ text: "________________________________________________________________" }),
      new Paragraph({ text: "" }),
      new Paragraph({ children: [new TextRun("Additional information needed:")] }),
      new Paragraph({ text: "________________________________________________________________" }),
      new Paragraph({ text: "" }),
      new Paragraph({ children: [new TextRun("Corrections to medical terminology:")] }),
      new Paragraph({ text: "________________________________________________________________" }),
      new Paragraph({ text: "" }),
      new Paragraph({
        spacing: { before: 400 },
        children: [new TextRun({
          text: "Document Purpose: This outlines all medical data captured by the Saarthi Clinical Platform for clinical review.",
          italics: true, size: 20
        })]
      }),
      new Paragraph({
        children: [new TextRun({ text: "Last Updated: December 2024", italics: true, size: 20 })]
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/Users/rohanjdr/newPG/fastai/experiments/saarthi-monorepo/saarthi-clinical/Medical_Data_Overview.docx", buffer);
  console.log("Document created successfully: Medical_Data_Overview.docx");
});
