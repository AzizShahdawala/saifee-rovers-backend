import PDFDocument from "pdfkit";

const purple = "#622599";
const darkPurple = "#2B113F";
const muted = "#6B6072";

const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
const date = (value) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
const mode = (value) => value === "online_transfer" ? "Online transfer" : "Cash";

function row(doc, label, value, y) {
  doc.font("Helvetica-Bold").fontSize(10).fillColor(muted).text(label.toUpperCase(), 64, y, { width: 170 });
  doc.font("Helvetica").fontSize(12).fillColor(darkPurple).text(String(value || "-"), 230, y - 1, { width: 300 });
  doc.moveTo(64, y + 24).lineTo(531, y + 24).strokeColor("#E9DFF0").lineWidth(1).stroke();
}

export function generateReceiptPdf(receipt) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `Saifee Rovers Receipt ${receipt.receiptNumber}`, Author: "Saifee Rovers" } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.rect(0, 0, 595.28, 175).fill(purple);
    doc.circle(72, 64, 28).fill("#FFFFFF");
    doc.font("Helvetica-Bold").fontSize(22).fillColor(purple).text("SR", 53, 55, { width: 38, align: "center" });
    doc.font("Helvetica-Bold").fontSize(25).fillColor("#FFFFFF").text("SAIFEE ROVERS", 115, 42);
    doc.font("Helvetica").fontSize(10).fillColor("#EBDDF5").text("20th East Bombay  |  Service & Sacrifice  |  Be Prepared", 115, 76);
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#FFFFFF").text("PAYMENT RECEIPT", 64, 128);
    doc.font("Helvetica").fontSize(11).text(receipt.receiptNumber, 370, 130, { width: 160, align: "right" });

    doc.roundedRect(46, 202, 503, 90, 12).fill("#F4ECF8");
    doc.font("Helvetica").fontSize(10).fillColor(muted).text("AMOUNT RECEIVED", 68, 224);
    doc.font("Helvetica-Bold").fontSize(29).fillColor(purple).text(money(receipt.amount), 68, 245);
    doc.font("Helvetica").fontSize(10).fillColor(muted).text("ISSUED ON", 390, 224, { width: 130, align: "right" });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(darkPurple).text(date(receipt.createdAt || new Date()), 340, 249, { width: 180, align: "right" });

    const member = receipt.member || {};
    row(doc, "Received from", member.name, 330);
    row(doc, "Member ID", member.itsId, 382);
    row(doc, "Towards", receipt.title, 434);
    row(doc, "Payment date", date(receipt.paidOn), 486);
    row(doc, "Payment mode", mode(receipt.paymentMode), 538);
    row(doc, "Transaction reference", receipt.paymentReference || "Not applicable", 590);
    if (receipt.notes) row(doc, "Notes", receipt.notes, 642);

    if (receipt.status === "void") {
      doc.save().rotate(-22, { origin: [300, 460] }).font("Helvetica-Bold").fontSize(70).fillColor("#D7BFE5").opacity(.55).text("VOID", 170, 420).restore().opacity(1);
    }
    doc.font("Helvetica").fontSize(9).fillColor(muted).text("This computer-generated receipt is valid without a signature.", 64, 748, { width: 467, align: "center" });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(purple).text("Thank you.", 64, 770, { width: 467, align: "center" });
    doc.end();
  });
}
