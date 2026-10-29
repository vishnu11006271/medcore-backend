import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePrescriptionDto } from './dto/create-prescription.dto.js';
import PDFDocument from 'pdfkit';

@Injectable()
export class PrescriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreatePrescriptionDto) {
    // 1. Find the doctor associated with the logged-in user.
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            hospitalId: true,
            isActive: true,
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (
        !doctor ||
        !doctor.user.isActive ||
        !doctor.user.emailVerifiedAt ||
        !doctor.user.hospitalId
        ) {
        throw new ForbiddenException(
            'An active, email-verified doctor account with a hospital is required',
        );
    }

    // 2. Find the medical record.
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: dto.medicalRecordId },
      select: {
        id: true,
        hospitalId: true,
        doctorId: true,
        status: true,
      },
    });

    if (!record) {
      throw new NotFoundException('Medical record not found');
    }

    // 3. Verify doctor ownership and hospital access.
    if (
      record.doctorId !== doctor.id ||
      record.hospitalId !== doctor.user.hospitalId
    ) {
      throw new ForbiddenException(
        'You cannot prescribe for this medical record',
      );
    }

    // 4. Only finalized records can receive prescriptions.
    if (record.status !== 'FINALIZED') {
      throw new BadRequestException(
        'The medical record must be finalized before prescribing',
      );
    }

    // 5. Check every medicine against the hospital inventory.
    const medicineIds = [
      ...new Set(dto.items.map((item) => item.medicineId)),
    ];

    const medicines = await this.prisma.medicine.findMany({
      where: {
        id: { in: medicineIds },
        hospitalId: record.hospitalId,
        isActive: true,
      },
      select: { id: true },
    });

    if (medicines.length !== medicineIds.length) {
      throw new BadRequestException(
        'One or more medicines are invalid, inactive, or belong to another hospital',
      );
    }

    // 6. Create the prescription and all its items together.
    return this.prisma.prescription.create({
      data: {
        medicalRecordId: record.id,
        prescribedById: doctor.id,
        notes: dto.notes,
        items: {
          create: dto.items.map((item) => ({
            medicineId: item.medicineId,
            dosage: item.dosage,
            frequency: item.frequency,
            durationDays: item.durationDays,
            quantity: item.quantity,
            instructions: item.instructions,
          })),
        },
      },
      include: {
        items: {
          include: {
            medicine: {
              select: {
                id: true,
                name: true,
                genericName: true,
                strength: true,
              },
            },
          },
        },
      },
    });
  }

  
    async searchMedicines(userId: string, search: string) {
    const doctor = await this.prisma.doctor.findUnique({
        where: { userId },
        include: {
        user: {
            select: {
            hospitalId: true,
            isActive: true,
            emailVerifiedAt: true,
            },
        },
        },
    });

    if (
        !doctor ||
        !doctor.user.isActive ||
        !doctor.user.emailVerifiedAt ||
        !doctor.user.hospitalId
    ) {
        throw new ForbiddenException(
        'An active, email-verified doctor account with a hospital is required',
        );
    }

    const query = search.trim();

    if (query.length < 2) {
        throw new BadRequestException(
        'Search must contain at least 2 characters',
        );
    }

    return this.prisma.medicine.findMany({
        where: {
        hospitalId: doctor.user.hospitalId,
        isActive: true,
        OR: [
            {
            name: {
                contains: query,
                mode: 'insensitive',
            },
            },
            {
            genericName: {
                contains: query,
                mode: 'insensitive',
            },
            },
            {
            strength: {
                contains: query,
                mode: 'insensitive',
            },
            },
        ],
        },
        select: {
        id: true,
        name: true,
        genericName: true,
        strength: true,
        manufacturer: true,
        stockQuantity: true,
        unitPrice: true,
        },
        orderBy: {
        name: 'asc',
        },
        take: 20,
    });
    }


  async findMyPrescriptions(userId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
      select: {
        id: true,
        hospitalId: true,
      },
    });

    if (!patient) {
      throw new ForbiddenException(
        'A registered patient profile is required',
      );
    }

    return this.prisma.prescription.findMany({
      where: {
        medicalRecord: {
          patientId: patient.id,
          hospitalId: patient.hospitalId,
          status: 'FINALIZED',
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            medicine: {
              select: {
                id: true,
                name: true,
                genericName: true,
                strength: true,
              },
            },
          },
        },
      },
    });
  }

  
    async exportPdf(
    userId: string,
    role: string,
    prescriptionId: string,
    ): Promise<Buffer> {
    const prescription =
        await this.prisma.prescription.findUnique({
        where: { id: prescriptionId },
        include: {
            medicalRecord: {
            include: {
                patient: {
                include: {
                    user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                    },
                    },
                },
                },
                doctor: {
                include: {
                    user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        hospitalId: true,
                        isActive: true,
                        emailVerifiedAt: true,
                    },
                    },
                },
                },
            },
            },
            prescribedBy: {
            include: {
                user: {
                select: {
                    firstName: true,
                    lastName: true,
                    isActive: true,
                    emailVerifiedAt: true,
                    hospitalId: true,
                    email: true,
                },
                },
            },
            },
            items: {
            include: {
                medicine: {
                select: {
                    name: true,
                    genericName: true,
                    strength: true,
                },
                },
            },
            },
        },
        });

    if (!prescription) {
        throw new NotFoundException('Prescription not found');
    }

    const record = prescription.medicalRecord;

    if (record.status !== 'FINALIZED') {
        throw new ForbiddenException(
        'Only finalized medical records can be exported',
        );
    }

    // Authorize the doctor who issued the prescription.
    if (role === 'DOCTOR') {
        const doctor = await this.prisma.doctor.findUnique({
        where: { userId },
        include: {
            user: {
            select: {
                hospitalId: true,
                isActive: true,
                emailVerifiedAt: true,
            },
            },
        },
        });

        if (
        !doctor ||
        !doctor.user.isActive ||
        !doctor.user.emailVerifiedAt ||
        !doctor.user.hospitalId
        ) {
        throw new ForbiddenException(
            'An active, email-verified doctor account is required',
        );
        }

        if (
        doctor.id !== prescription.prescribedById ||
        doctor.id !== record.doctorId ||
        doctor.user.hospitalId !== record.hospitalId
        ) {
        throw new ForbiddenException(
            'You cannot export this prescription',
        );
        }
    } else if (role === 'PATIENT') {
        const patient = await this.prisma.patient.findUnique({
        where: { userId },
        select: {
            id: true,
            hospitalId: true,
        },
        });

        if (!patient) {
        throw new ForbiddenException(
            'A registered patient profile is required',
        );
        }

        if (
        patient.id !== record.patientId ||
        patient.hospitalId !== record.hospitalId
        ) {
        throw new ForbiddenException(
            'You cannot export this prescription',
        );
        }
    } else {
        throw new ForbiddenException(
        'Only doctors and patients can export prescriptions',
        );
    }

    // Generate the PDF in memory.
    const pdf = new PDFDocument({
        size: 'A4',
        margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50,
        },
    });

    const chunks: Buffer[] = [];

    const pdfBuffer = new Promise<Buffer>((resolve, reject) => {
        pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdf.on('end', () => resolve(Buffer.concat(chunks)));
        pdf.on('error', reject);
    });

    const patientName =
        `${record.patient.user.firstName} ${record.patient.user.lastName}`;

    const doctorName =
        `${prescription.prescribedBy.user.firstName} ` +
        `${prescription.prescribedBy.user.lastName}`;

    pdf.fontSize(20).text('MEDCORE HMS', { align: 'center' });
    pdf.moveDown(0.3);
    pdf.fontSize(15).text('PRESCRIPTION', { align: 'center' });
    pdf.moveDown();

    pdf.fontSize(11);
    pdf.text(`Prescription ID: ${prescription.id}`);
    pdf.text(`Date: ${prescription.createdAt.toLocaleDateString()}`);
    pdf.moveDown();

    pdf.fontSize(13).text('Patient Details', { underline: true });
    pdf.moveDown(0.4);
    pdf.fontSize(11);
    pdf.text(`Name: ${patientName}`);
    pdf.text(`Email: ${record.patient.user.email}`);
    if (record.patient.user.phone) {
        pdf.text(`Phone: ${record.patient.user.phone}`);
    }

    pdf.moveDown();
    pdf.fontSize(13).text('Prescribing Doctor', { underline: true });
    pdf.moveDown(0.4);
    pdf.fontSize(11);
    pdf.text(`Name: Dr. ${doctorName}`);
    pdf.text(`Email: ${prescription.prescribedBy.user.email ?? 'N/A'}`);

    pdf.moveDown();
    pdf.fontSize(13).text('Prescribed Medicines', { underline: true });
    pdf.moveDown(0.5);

    prescription.items.forEach((item, index) => {
        pdf.fontSize(11).text(
        `${index + 1}. ${item.medicine.name}` +
        (item.medicine.strength ? ` (${item.medicine.strength})` : ''),
        );

        if (item.medicine.genericName) {
        pdf.text(`   Generic name: ${item.medicine.genericName}`);
        }

        pdf.text(`   Dosage: ${item.dosage}`);
        pdf.text(`   Frequency: ${item.frequency}`);
        pdf.text(
        `   Duration: ${
            item.durationDays != null
            ? `${item.durationDays} days`
            : 'As directed'
        }`,
        );
        pdf.text(`   Quantity: ${item.quantity}`);

        if (item.instructions) {
        pdf.text(`   Instructions: ${item.instructions}`);
        }

        pdf.moveDown(0.6);
    });

    if (prescription.notes) {
        pdf.moveDown();
        pdf.fontSize(13).text('Additional Notes', { underline: true });
        pdf.moveDown(0.4);
        pdf.fontSize(11).text(prescription.notes);
    }

    pdf.moveDown(2);
    pdf.fontSize(10).text(
        `Prescribed by Dr. ${doctorName}`,
        { align: 'right' },
    );
    pdf.text('Medcore HMS', { align: 'right' });

    pdf.end();

    return pdfBuffer;
    }

}