import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { RecordPaymentDto } from './dto/record-payment.dto.js';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  private toCents(value: any): number {
    return Math.round(Number(value) * 100);
  }

  private fromCents(value: number): number {
    return Number((value / 100).toFixed(2));
  }

  async createInvoice(dto: CreateInvoiceDto, user: any) {
    if (!user.hospitalId) {
      throw new ForbiddenException('User is not associated with a hospital');
    }

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: dto.appointmentId,
        hospitalId: user.hospitalId,
      },
      include: {
        doctor: true,
        medicalRecord: {
          include: {
            labOrders: {
              where: {
                status: 'COMPLETED',
              },
              include: {
                labTest: true,
              },
            },
            prescriptions: {
              include: {
                dispensations: {
                  include: {
                    items: {
                        include: {
                            medicine: true,
                        },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Invoice can only be generated for completed appointments',
      );
    }

    const existingInvoice = await this.prisma.invoice.findUnique({
      where: {
        appointmentId: dto.appointmentId,
      },
    });

    if (existingInvoice) {
      throw new ConflictException(
        'An invoice already exists for this appointment',
      );
    }

    const items: {
      description: string;
      itemType: string;
      referenceId?: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }[] = [];

    // 1. Doctor consultation fee
    const consultationFee = this.toCents(
      appointment.doctor.consultationFee,
    );

    if (consultationFee > 0) {
      items.push({
        description: 'Doctor consultation fee',
        itemType: 'CONSULTATION',
        referenceId: appointment.doctorId,
        quantity: 1,
        unitPrice: this.fromCents(consultationFee),
        amount: this.fromCents(consultationFee),
      });
    }

    // 2. Completed laboratory tests
    const labOrders = appointment.medicalRecord?.labOrders ?? [];

    for (const order of labOrders) {
      const price = this.toCents(order.labTest.price);

      if (price > 0) {
        items.push({
          description: order.labTest.name,
          itemType: 'LAB',
          referenceId: order.labTestId,
          quantity: 1,
          unitPrice: this.fromCents(price),
          amount: this.fromCents(price),
        });
      }
    }

    // 3. Dispensed pharmacy items
    const prescriptions =
      appointment.medicalRecord?.prescriptions ?? [];

    for (const prescription of prescriptions) {
      for (const dispense of prescription.dispensations) {
        for (const item of dispense.items) {
          const unitPrice = this.toCents(item.unitPrice);
          const amount = unitPrice * item.quantity;

          items.push({
            description: item.medicine.name,
            itemType: 'PHARMACY',
            referenceId: item.medicineId,
            quantity: item.quantity,
            unitPrice: this.fromCents(unitPrice),
            amount: this.fromCents(amount),
          });
        }
      }
    }

    if (items.length === 0) {
      throw new BadRequestException(
        'No billable items found for this appointment',
      );
    }

    const subtotalCents = items.reduce(
      (total, item) => total + this.toCents(item.amount),
      0,
    );

    const taxCents = this.toCents(dto.tax ?? 0);
    const discountCents = this.toCents(dto.discount ?? 0);

    if (discountCents > subtotalCents + taxCents) {
      throw new BadRequestException(
        'Discount cannot exceed subtotal plus tax',
      );
    }

    const totalCents = subtotalCents + taxCents - discountCents;

    const invoiceNumber =
      `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    try {
      return await this.prisma.$transaction(async (tx) => {
        return tx.invoice.create({
          data: {
            hospitalId: appointment.hospitalId,
            appointmentId: appointment.id,
            patientId: appointment.patientId,
            invoiceNumber,
            subtotal: this.fromCents(subtotalCents),
            tax: this.fromCents(taxCents),
            discount: this.fromCents(discountCents),
            total: this.fromCents(totalCents),
            status: 'DRAFT',
            items: {
              create: items,
            },
          },
          include: {
            items: true,
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
          },
        });
      });
    } catch (error: any) {
      // Handles a concurrent request creating an invoice for the same appointment.
      if (
        error?.code === 'P2002'
      ) {
        throw new ConflictException(
          'An invoice already exists for this appointment',
        );
      }

      throw error;
    }
  }

  async getInvoices(user: any) {
    if (!user.hospitalId) {
      throw new ForbiddenException('User is not associated with a hospital');
    }

    return this.prisma.invoice.findMany({
      where: {
        hospitalId: user.hospitalId,
      },
      include: {
        items: true,
        patient: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getInvoiceById(id: string, user: any) {
    if (!user.hospitalId) {
      throw new ForbiddenException('User is not associated with a hospital');
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        hospitalId: user.hospitalId,
      },
      include: {
        items: true,
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
        appointment: {
          include: {
            doctor: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async issueInvoice(invoiceId: string, user: any) {
    if (!user.hospitalId) {
        throw new ForbiddenException(
        'User is not associated with a hospital',
        );
    }

    const invoice = await this.prisma.invoice.findFirst({
        where: {
        id: invoiceId,
        hospitalId: user.hospitalId,
        },
    });

    if (!invoice) {
        throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
        throw new BadRequestException(
        `Only DRAFT invoices can be issued. Current status: ${invoice.status}`,
        );
    }

    // Conditional update prevents two requests from issuing
    // the same draft invoice simultaneously.
    const result = await this.prisma.invoice.updateMany({
        where: {
        id: invoiceId,
        hospitalId: user.hospitalId,
        status: 'DRAFT',
        },
        data: {
        status: 'ISSUED',
        issuedAt: new Date(),
        },
    });

    if (result.count === 0) {
        throw new ConflictException(
        'Invoice was already issued or its status has changed',
        );
    }

    return this.prisma.invoice.findFirst({
        where: {
        id: invoiceId,
        hospitalId: user.hospitalId,
        },
        include: {
        items: true,
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
        appointment: {
            include: {
            doctor: {
                include: {
                user: {
                    select: {
                    firstName: true,
                    lastName: true,
                    },
                },
                },
            },
            },
        },
        },
    });
    }

    async recordPayment(dto: RecordPaymentDto, user: any) {
    if (!user.hospitalId) {
        throw new ForbiddenException(
        'User is not associated with a hospital',
        );
    }

    // Validate the amount before opening the transaction.
    const paymentAmount = this.toCents(dto.amount);

    if (paymentAmount <= 0) {
        throw new BadRequestException('Payment amount must be greater than zero');
    }

    try {
        return await this.prisma.$transaction(
        async (tx) => {
            const invoice = await tx.invoice.findFirst({
            where: {
                id: dto.invoiceId,
                hospitalId: user.hospitalId,
            },
            });

            if (!invoice) {
            throw new NotFoundException('Invoice not found');
            }

            if (!['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status)) {
            throw new BadRequestException(
                'Payments can only be recorded against ISSUED or PARTIALLY_PAID invoices',
            );
            }

            // Idempotency: return the existing payment for a repeated key.
            if (dto.idempotencyKey) {
            const existingPayment = await tx.payment.findUnique({
                where: {
                idempotencyKey: dto.idempotencyKey,
                },
            });

            if (existingPayment) {
                if (existingPayment.invoiceId !== invoice.id) {
                throw new ConflictException(
                    'Idempotency key has already been used for another invoice',
                );
                }

                return existingPayment;
            }
            }

            const payments = await tx.payment.findMany({
            where: {
                invoiceId: invoice.id,
                status: {
                in: ['SUCCESS', 'PARTIALLY_REFUNDED'],
                },
            },
            select: {
                amount: true,
                refundAmount: true,
            },
            });

            const paidCents = payments.reduce((total, payment) => {
            return (
                total +
                this.toCents(payment.amount) -
                this.toCents(payment.refundAmount)
            );
            }, 0);

            const invoiceTotal = this.toCents(invoice.total);
            const balanceCents = invoiceTotal - paidCents;

            if (balanceCents <= 0) {
            throw new BadRequestException('Invoice is already fully paid');
            }

            if (paymentAmount > balanceCents) {
            throw new BadRequestException(
                `Payment exceeds the outstanding balance of ${this.fromCents(balanceCents)}`,
            );
            }

            const payment = await tx.payment.create({
            data: {
                invoiceId: invoice.id,
                recordedById: user.userId,
                amount: this.fromCents(paymentAmount),
                method: dto.method as any,
                provider: 'NONE',
                status: 'SUCCESS',
                referenceNumber: dto.referenceNumber,
                idempotencyKey: dto.idempotencyKey,
                notes: dto.notes,
                paidAt: new Date(),
            },
            });

            const newPaidCents = paidCents + paymentAmount;

            const newInvoiceStatus =
            newPaidCents >= invoiceTotal
                ? 'PAID'
                : 'PARTIALLY_PAID';

            await tx.invoice.update({
            where: {
                id: invoice.id,
            },
            data: {
                status: newInvoiceStatus,
            },
            });

            return {
            payment,
            invoice: {
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                total: this.fromCents(invoiceTotal),
                paidAmount: this.fromCents(newPaidCents),
                balanceAmount: this.fromCents(
                invoiceTotal - newPaidCents,
                ),
                status: newInvoiceStatus,
            },
            };
        },
        {
            isolationLevel: 'Serializable',
        },
        );
    } catch (error) {
        if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
        ) {
        throw error;
        }

        if ((error as any).code === 'P2002') {
        throw new ConflictException(
            'Payment reference or idempotency key already exists',
        );
        }

        if ((error as any).code === 'P2034') {
        throw new ConflictException(
            'Payment transaction conflict. Please retry the request.',
        );
        }

        throw error;
    }
    }

    async getInvoicePayments(invoiceId: string, user: any) {
    if (!user.hospitalId) {
        throw new ForbiddenException(
        'User is not associated with a hospital',
        );
    }

    const invoice = await this.prisma.invoice.findFirst({
        where: {
        id: invoiceId,
        hospitalId: user.hospitalId,
        },
        select: {
        id: true,
        invoiceNumber: true,
        total: true,
        status: true,
        payments: {
            orderBy: {
            createdAt: 'desc',
            },
            include: {
            recordedBy: {
                select: {
                firstName: true,
                lastName: true,
                email: true,
                },
            },
            },
        },
        },
    });

    if (!invoice) {
        throw new NotFoundException('Invoice not found');
    }

    return invoice;
    }

    async getInvoiceBalance(invoiceId: string, user: any) {
    if (!user.hospitalId) {
        throw new ForbiddenException(
        'User is not associated with a hospital',
        );
    }

    const invoice = await this.prisma.invoice.findFirst({
        where: {
        id: invoiceId,
        hospitalId: user.hospitalId,
        },
        include: {
        payments: {
            select: {
            amount: true,
            refundAmount: true,
            status: true,
            },
        },
        },
    });

    if (!invoice) {
        throw new NotFoundException('Invoice not found');
    }

    const totalCents = this.toCents(invoice.total);

    let paidCents = 0;
    let refundedCents = 0;

    for (const payment of invoice.payments) {
        if (
        payment.status === 'SUCCESS' ||
        payment.status === 'PARTIALLY_REFUNDED' ||
        payment.status === 'REFUNDED'
        ) {
        const amountCents = this.toCents(payment.amount);
        const refundCents = this.toCents(payment.refundAmount);

        paidCents += amountCents;
        refundedCents += refundCents;
        }
    }

    const netPaidCents = paidCents - refundedCents;
    const balanceCents = Math.max(0, totalCents - netPaidCents);

    return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceTotal: this.fromCents(totalCents),
        totalPaid: this.fromCents(paidCents),
        totalRefunded: this.fromCents(refundedCents),
        netPaid: this.fromCents(netPaidCents),
        balanceAmount: this.fromCents(balanceCents),
        status: invoice.status,
        paymentStatus:
        balanceCents === 0
            ? 'FULLY_PAID'
            : netPaidCents > 0
            ? 'PARTIALLY_PAID'
            : 'UNPAID',
    };
    }
}