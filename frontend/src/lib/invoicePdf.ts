// Renders a DOM node (the printable invoice) to a PDF Blob, for attaching
// to a Web Share call so "Share" actually hands over a document instead of
// just a text summary. Dynamically imported from EstimateEditor so these
// two libraries (html2canvas + jsPDF) never load until Share is clicked.
export async function renderNodeToPdfBlob(node: HTMLElement, filename: string): Promise<File> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
  // JPEG at high quality - this is a mostly-white document with black text
  // and light gray table bands, which JPEG compresses far smaller than PNG
  // with no visible quality loss, keeping the attachment email/AirDrop-sized.
  const imgData = canvas.toDataURL("image/jpeg", 0.92);

  const pageWidth = 210; // A4, mm
  const pageHeight = 297;
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF("p", "mm", "a4");
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const blob = pdf.output("blob") as Blob;
  return new File([blob], filename, { type: "application/pdf" });
}
