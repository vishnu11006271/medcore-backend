
import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class InvoicePdfService {
  async generate(invoice: any): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true,
    });

    const chunks: Buffer[] = [];

    const bufferPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const pageWidth = 495;
    const left = 50;
    const right = left + pageWidth;

    const formatMoney = (value: any): string =>
      `INR ${Number(value ?? 0).toFixed(2)}`;

    const formatDate = (value: any): string =>
      value ? new Date(value).toLocaleDateString('en-IN') : 'N/A';

    // Hospital header
    doc.fontSize(20).font('Helvetica-Bold')
      .text(invoice.hospital?.name ?? 'Hospital', left, 45);

    doc.fontSize(9).font('Helvetica')
      .text(invoice.hospital?.address ?? '', left)
      .text(invoice.hospital?.email ?? '', left)
      .text(invoice.hospital?.phone ?? '', left);

    if (invoice.hospital?.registrationNumber) {
      doc.text(
        `Registration No: ${invoice.hospital.registrationNumber}`,
        left,
      );
    }

    doc.moveDown();

    doc.fontSize(22).font('Helvetica-Bold')
      .text('INVOICE', left, 45, {
        align: 'right',
        width: pageWidth,
      });

    doc.fontSize(10).font('Helvetica')
      .text(`Invoice No: ${invoice.invoiceNumber}`, {
        align: 'right',
      })
      .text(`Status: ${invoice.status}`, { align: 'right' })
      .text(
        `Date: ${formatDate(invoice.issuedAt ?? invoice.createdAt)}`,
        { align: 'right' },
      );

    doc.moveDown(3);

    // Patient details
    doc.fontSize(13).font('Helvetica-Bold')
      .text('BILL TO');

    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica')
      .text(
        `${invoice.patient?.user?.firstName ?? ''} ${invoice.patient?.user?.lastName ?? ''}`.trim(),
      )
      .text(`Patient No: ${invoice.patient?.patientNumber ?? 'N/A'}`)
      .text(`Email: ${invoice.patient?.user?.email ?? 'N/A'}`)
      .text(`Phone: ${invoice.patient?.user?.phone ?? 'N/A'}`)
      .text(`Address: ${invoice.patient?.address ?? 'N/A'}`);

    doc.moveDown();

    // Invoice items table
    doc.fontSize(13).font('Helvetica-Bold')
      .text('INVOICE ITEMS');

    doc.moveDown(0.5);

    const columns = {
      description: left,
      quantity: 330,
      unitPrice: 390,
      amount: 465,
    };

    const drawTableHeader = () => {
      const y = doc.y;

      doc.rect(left, y, pageWidth, 22).fill('#E8EEF5');

      doc.fillColor('#000000')
        .fontSize(9)
        .font('Helvetica-Bold');

      doc.text('Description', columns.description + 5, y + 6);
      doc.text('Qty', columns.quantity, y + 6, { width: 35 });
      doc.text('Unit Price', columns.unitPrice, y + 6, { width: 65 });
      doc.text('Amount', columns.amount, y + 6, {
        width: 75,
        align: 'right',
      });

      doc.y = y + 28;
    };

    drawTableHeader();

    const items = invoice.items ?? [];

    for (const item of items) {
      const description = item.description ?? 'Item';
      const rowHeight = Math.max(
        25,
        doc.heightOfString(description, { width: 260 }) + 12,
      );

      if (doc.y + rowHeight > 740) {
        doc.addPage();
        drawTableHeader();
      }

      const y = doc.y;

      doc.fontSize(9).font('Helvetica')
        .text(description, columns.description + 5, y, {
          width: 260,
        });

      doc.text(String(item.quantity), columns.quantity, y, {
        width: 35,
      });

      doc.text(formatMoney(item.unitPrice), columns.unitPrice, y, {
        width: 65,
      });

      doc.text(formatMoney(item.amount), columns.amount, y, {
        width: 75,
        align: 'right',
      });

      doc.moveTo(left, y + rowHeight - 5)
        .lineTo(right, y + rowHeight - 5)
        .strokeColor('#DDDDDD')
        .stroke();

      doc.y = y + rowHeight;
    }

    // Invoice totals
    if (doc.y + 125 > 740) {
      doc.addPage();
    }

    doc.moveDown();

    const drawTotal = (label: string, value: any, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(bold ? 12 : 10)
        .text(label, 330, doc.y, { width: 85 });

      doc.text(formatMoney(value), 415, doc.y - 12, {
        width: 80,
        align: 'right',
      });

      doc.moveDown(0.5);
    };

    drawTotal('Subtotal', invoice.subtotal);
    drawTotal('Tax', invoice.tax);
    drawTotal('Discount', invoice.discount);
    drawTotal('TOTAL', invoice.total, true);

    // Payment calculations
    const totalPaid = (invoice.payments ?? []).reduce(
      (sum: number, payment: any) => {
        const amount = Number(payment.amount ?? 0);
        const refund = Number(payment.refundAmount ?? 0);

        return sum + Math.max(amount - refund, 0);
      },
      0,
    );

    const outstanding = Math.max(
      Number(invoice.total) - totalPaid,
      0,
    );

    if (doc.y + 100 > 740) {
      doc.addPage();
    }

    doc.moveDown();

    doc.fontSize(13).font('Helvetica-Bold')
      .text('PAYMENT SUMMARY');

    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica')
      .text(`Total Paid: ${formatMoney(totalPaid)}`, {
        align: 'right',
      })
      .text(`Outstanding: ${formatMoney(outstanding)}`, {
        align: 'right',
      });

    // Payment history
    doc.moveDown();

    doc.fontSize(13).font('Helvetica-Bold')
      .text('PAYMENT HISTORY');

    doc.moveDown(0.5);

    if (!invoice.payments?.length) {
      doc.fontSize(10).font('Helvetica')
        .text('No payments recorded.');
    } else {
      for (const [index, payment] of invoice.payments.entries()) {
        const paymentText =
          `${index + 1}. ${formatDate(payment.paidAt)} | ` +
          `${payment.method} | ${formatMoney(payment.amount)} | ` +
          `Refund: ${formatMoney(payment.refundAmount)} | ` +
          `${payment.status}`;

        const paymentHeight = doc.heightOfString(paymentText, {
          width: pageWidth,
        });

        if (doc.y + paymentHeight + 35 > 740) {
          doc.addPage();
        }

        doc.fontSize(9).font('Helvetica')
          .text(paymentText, left, doc.y, {
            width: pageWidth,
          });

        if (payment.referenceNumber) {
          doc.text(`Reference: ${payment.referenceNumber}`);
        }

        if (payment.providerPaymentId) {
          doc.text(`Provider Payment ID: ${payment.providerPaymentId}`);
        }

        doc.moveDown(0.5);
      }
    }

    // Footer and page numbers
    const range = doc.bufferedPageRange();

    for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    doc.save();

    doc.fontSize(8)
        .font('Helvetica')
        .fillColor('#666666')
        .text(
        `Invoice: ${invoice.invoiceNumber} | Page ${i + 1} of ${range.count}`,
        left,
        770,
        {
            width: pageWidth,
            align: 'center',
            lineBreak: false,
            height: 12,
        },
        );

    doc.restore();
    }

    doc.end();

    return bufferPromise;
  }
}
