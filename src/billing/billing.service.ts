import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { RecordPaymentDto } from './dto/record-payment.dto.js';
import Razorpay from 'razorpay';

import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto.js';
import { createHmac, timingSafeEqual } from 'crypto';

import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto.js';


@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  private toCents(value: any): number {
    return Math.round(Number(value) * 100);
  }

  private fromCents(value: number): number {
    return Number((value / 100).toFixed(2));
  }
  private razorpay: Razorpay | null = null;

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
            // await tx.$queryRaw`
            //   SELECT pg_advisory_xact_lock(
            //     hashtextextended(${dto.invoiceId}, 0)
            //   )
            // `;
            await tx.$queryRaw<{ locked: number }[]>`
              WITH lock_result AS MATERIALIZED (
                SELECT pg_advisory_xact_lock(
                  hashtextextended(${dto.invoiceId}, 0)
                )
              )
              SELECT 1::int AS locked
              FROM lock_result
            `;
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

            // const payments = await tx.payment.findMany({
            // where: {
            //     invoiceId: invoice.id,
            //     status: {
            //     in: ['SUCCESS', 'PARTIALLY_REFUNDED'],
            //     },
            // },
            // select: {
            //     amount: true,
            //     refundAmount: true,
            // },
            // });

            
            const payments = await tx.payment.findMany({
              where: {
                invoiceId: invoice.id,
                status: {
                  in: ['SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED'],
                },
              },
              select: {
                amount: true,
                refundAmount: true,
                status: true,
              },
            });

            const { netPaidCents: paidCents } =
              this.calculatePaymentTotals(payments);

            // const paidCents = payments.reduce((total, payment) => {
            // return (
            //     total +
            //     this.toCents(payment.amount) -
            //     this.toCents(payment.refundAmount)
            // );
            // }, 0);

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
    } catch (error: any) {
        console.error('RECORD PAYMENT ERROR:', error);
        console.error('ERROR CODE:', error?.code);
        console.error('ERROR META:', error?.meta);
        console.error('ERROR STACK:', error?.stack);

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

    const {
      totalPaidCents,
      totalRefundedCents,
      netPaidCents,
    } = this.calculatePaymentTotals(invoice.payments);

    const balanceCents = Math.max(0, totalCents - netPaidCents);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceTotal: this.fromCents(totalCents),
      totalPaid: this.fromCents(totalPaidCents),
      totalRefunded: this.fromCents(totalRefundedCents),
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

    
    async createRazorpayOrder(
      dto: CreateRazorpayOrderDto,
      user: any,
    ) {
      if (!user.hospitalId) {
        throw new ForbiddenException(
          'User is not associated with a hospital',
        );
      }

      const razorpay = this.getRazorpayClient();

      return this.prisma.$transaction(
        async (tx) => {
          // Serialize Razorpay order creation for this invoice.
          // The lock is automatically released when the transaction ends.
          // await tx.$queryRaw`
          //   SELECT pg_advisory_xact_lock(
          //     hashtextextended(${dto.invoiceId}, 0)
          //   )
          // `;

          await tx.$queryRaw<{ locked: number }[]>`
            WITH lock_result AS MATERIALIZED (
              SELECT pg_advisory_xact_lock(
                hashtextextended(${dto.invoiceId}, 0)
              )
            )
            SELECT 1::int AS locked
            FROM lock_result
          `;

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
              'Only issued or partially paid invoices can be paid online',
            );
          }

          // Include fully refunded payments when calculating net paid.
          const payments = await tx.payment.findMany({
            where: {
              invoiceId: invoice.id,
              status: {
                in: ['SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED'],
              },
            },
            select: {
              amount: true,
              refundAmount: true,
              status: true,
            },
          });

          const { netPaidCents } =
            this.calculatePaymentTotals(payments);

          const invoiceTotalCents = this.toCents(invoice.total);
          const balanceCents = invoiceTotalCents - netPaidCents;

          if (balanceCents <= 0) {
            throw new BadRequestException(
              'Invoice is already fully paid',
            );
          }

          // Check for an existing pending Razorpay order after acquiring
          // the lock, so simultaneous requests cannot both pass this check.
          const pendingPayment = await tx.payment.findFirst({
            where: {
              invoiceId: invoice.id,
              provider: 'RAZORPAY',
              status: 'PENDING',
            },
          });

          if (pendingPayment) {
            throw new ConflictException(
              'A Razorpay payment order is already pending for this invoice',
            );
          }

          let razorpayOrder: any;

          try {
            razorpayOrder = await razorpay.orders.create({
              amount: balanceCents,
              currency: 'INR',
              receipt: `inv_${invoice.id.slice(0, 8)}_${Date.now()}`,
              notes: {
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                hospitalId: invoice.hospitalId,
              },
            });
          } catch {
            throw new InternalServerErrorException(
              'Unable to create Razorpay order',
            );
          }

          const payment = await tx.payment.create({
            data: {
              invoiceId: invoice.id,
              recordedById: user.userId,
              amount: this.fromCents(balanceCents),
              currency: 'INR',
              method: 'OTHER',
              provider: 'RAZORPAY',
              status: 'PENDING',
              providerOrderId: razorpayOrder.id,
              idempotencyKey: `razorpay_${razorpayOrder.id}`,
              notes: 'Online payment initiated through Razorpay',
            },
          });

          return {
            paymentId: payment.id,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            razorpay: {
              keyId: process.env.RAZORPAY_KEY_ID,
              orderId: razorpayOrder.id,
              amount: razorpayOrder.amount,
              currency: razorpayOrder.currency,
            },
            amount: this.fromCents(balanceCents),
            status: payment.status,
          };
        },
        {
          isolationLevel: 'Serializable',
          maxWait: 5000,
          timeout: 20000,
        },
      );
    }


    private getRazorpayClient(): Razorpay {
        if (this.razorpay) {
            return this.razorpay;
        }

        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keyId || !keySecret) {
            throw new InternalServerErrorException(
            'Razorpay credentials are not configured',
            );
        }

        this.razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
        });

        return this.razorpay;
    }

  async verifyRazorpayPayment(
    dto: VerifyRazorpayPaymentDto,
    user: any,
  ) {
    if (!user.hospitalId) {
      throw new ForbiddenException(
        'User is not associated with a hospital',
      );
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        providerOrderId: dto.razorpay_order_id,
        provider: 'RAZORPAY',
        invoice: {
          hospitalId: user.hospitalId,
        },
      },
      include: {
        invoice: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(
        'Razorpay payment order not found',
      );
    }

    if (payment.status === 'SUCCESS') {
      if (payment.providerPaymentId === dto.razorpay_payment_id) {
        return {
          paymentId: payment.id,
          status: payment.status,
          message: 'Payment was already verified',
        };
      }

      throw new ConflictException(
        'This order has already been completed with another payment',
      );
    }

    if (payment.status !== 'PENDING') {
      throw new BadRequestException(
        'This payment is not pending verification',
      );
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      throw new InternalServerErrorException(
        'Razorpay credentials are not configured',
      );
    }

    // Always use the order ID stored in our database.
    const generatedSignature = createHmac('sha256', keySecret)
      .update(
        `${payment.providerOrderId}|${dto.razorpay_payment_id}`,
      )
      .digest('hex');

    if (
      !/^[a-fA-F0-9]{64}$/.test(dto.razorpay_signature)
    ) {
      throw new BadRequestException(
        'Invalid Razorpay payment signature format',
      );
    }
    const expected = Buffer.from(generatedSignature, 'hex');
    const received = Buffer.from(
      dto.razorpay_signature,
      'hex',
    );

    const signatureValid =
      expected.length === received.length &&
      timingSafeEqual(expected, received);

    if (!signatureValid) {
      throw new BadRequestException(
        'Invalid Razorpay payment signature',
      );
    }

    // Signature verification establishes authenticity.
    // Fetch the payment separately to confirm its actual status,
    // amount and currency before marking it successful.
    const razorpay = this.getRazorpayClient();

    let gatewayPayment: any;

    try {
      gatewayPayment = await razorpay.payments.fetch(
        dto.razorpay_payment_id,
      );
    } catch {
      throw new BadRequestException(
        'Unable to verify payment status with Razorpay',
      );
    }

    if (gatewayPayment.order_id !== payment.providerOrderId) {
      throw new BadRequestException(
        'Payment does not belong to the stored Razorpay order',
      );
    }

    if (
      gatewayPayment.amount !== this.toCents(payment.amount) ||
      gatewayPayment.currency !== payment.currency
    ) {
      throw new BadRequestException(
        'Payment amount or currency does not match the invoice',
      );
    }

    if (gatewayPayment.status !== 'captured') {
      throw new BadRequestException(
        `Payment is not captured. Current gateway status: ${gatewayPayment.status}`,
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const updateResult = await tx.payment.updateMany({
          where: {
            id: payment.id,
            status: 'PENDING',
            providerOrderId: payment.providerOrderId,
          },
          data: {
            status: 'SUCCESS',
            providerPaymentId: dto.razorpay_payment_id,
            method: 'OTHER',
            paidAt: new Date(),
            failureReason: null,
          },
        });

        if (updateResult.count === 0) {
          const latest = await tx.payment.findUnique({
            where: { id: payment.id },
          });

          if (
            latest?.status === 'SUCCESS' &&
            latest.providerPaymentId === dto.razorpay_payment_id
          ) {
            return {
              paymentId: latest.id,
              status: latest.status,
              message: 'Payment was already verified',
            };
          }

          throw new ConflictException(
            'Payment status has changed. Please check payment history.',
          );
        }

        const successfulPayments = await tx.payment.findMany({
          where: {
            invoiceId: payment.invoiceId,
            status: {
              in: ['SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED'],
            },
          },
          select: {
            amount: true,
            refundAmount: true,
            status: true,
          },
        });

        const { netPaidCents: paidCents } =
          this.calculatePaymentTotals(successfulPayments);

        const totalCents = this.toCents(payment.invoice.total);

        const invoiceStatus =
          paidCents >= totalCents
            ? 'PAID'
            : 'PARTIALLY_PAID';

        await tx.invoice.update({
          where: {
            id: payment.invoiceId,
          },
          data: {
            status: invoiceStatus,
          },
        });

        return {
          paymentId: payment.id,
          razorpayPaymentId: dto.razorpay_payment_id,
          invoiceId: payment.invoiceId,
          invoiceTotal: this.fromCents(totalCents),
          paidAmount: this.fromCents(paidCents),
          balanceAmount: this.fromCents(
            Math.max(0, totalCents - paidCents),
          ),
          paymentStatus: 'SUCCESS',
          invoiceStatus,
        };
      },
      {
        isolationLevel: 'Serializable',
      },
    );
  }

  
  private calculatePaymentTotals(
    payments: {
      amount: any;
      refundAmount: any;
      status: string;
    }[],
  ) {
    let totalPaidCents = 0;
    let totalRefundedCents = 0;

    for (const payment of payments) {
      if (
        !['SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(
          payment.status,
        )
      ) {
        continue;
      }

      totalPaidCents += this.toCents(payment.amount);
      totalRefundedCents += this.toCents(payment.refundAmount);
    }

    return {
      totalPaidCents,
      totalRefundedCents,
      netPaidCents: totalPaidCents - totalRefundedCents,
    };
  }

  async markRazorpayPaymentDismissed(
    orderId: string,
    user: any,
  ) {
    if (!user.hospitalId) {
      throw new ForbiddenException(
        'User is not associated with a hospital',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Use the same lock key as createRazorpayOrder()
        // and recordPayment().
        await tx.$queryRaw<{ locked: number }[]>`
          WITH lock_result AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(
              hashtextextended(${orderId}, 0)
            )
          )
          SELECT 1::int AS locked
          FROM lock_result
        `;

        const payment = await tx.payment.findFirst({
          where: {
            providerOrderId: orderId,
            provider: 'RAZORPAY',
            invoice: {
              hospitalId: user.hospitalId,
            },
          },
        });

        if (!payment) {
          throw new NotFoundException(
            'Razorpay payment order not found',
          );
        }

        if (payment.status === 'SUCCESS') {
          return {
            paymentId: payment.id,
            status: 'SUCCESS',
            message: 'Payment was already completed',
          };
        }

        if (payment.status !== 'PENDING') {
          return {
            paymentId: payment.id,
            status: payment.status,
            message: 'Payment is already processed',
          };
        }

        const razorpay = this.getRazorpayClient();

        const order = await razorpay.orders.fetch(orderId);
        const gatewayPayments =
          await razorpay.orders.fetchPayments(orderId);

        // Do not mark the payment failed if a payment is
        // captured or authorized at Razorpay.
        const paymentInProgress = gatewayPayments.items.some(
          (item: any) =>
            item.status === 'captured' ||
            item.status === 'authorized',
        );

        if (paymentInProgress || order.status === 'paid') {
          return {
            paymentId: payment.id,
            status: 'PENDING',
            message:
              'A payment attempt exists. Payment requires verification.',
          };
        }

        // Only mark failed when there are no active or successful
        // payment attempts for this order.
        const updateResult = await tx.payment.updateMany({
          where: {
            id: payment.id,
            status: 'PENDING',
          },
          data: {
            status: 'FAILED',
            failureReason: 'Razorpay checkout was dismissed',
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictException(
            'Payment status changed. Please refresh payment history.',
          );
        }

        return {
          paymentId: payment.id,
          status: 'FAILED',
          message: 'Razorpay checkout was dismissed',
        };
      },
      {
        isolationLevel: 'Serializable',
      },
    );
  }


// async inspectRazorpayOrder(orderId: string, user: any) {
//   if (!user.hospitalId) {
//     throw new ForbiddenException(
//       'User is not associated with a hospital',
//     );
//   }

//   const payment = await this.prisma.payment.findFirst({
//     where: {
//       providerOrderId: orderId,
//       provider: 'RAZORPAY',
//       invoice: {
//         hospitalId: user.hospitalId,
//       },
//     },
//   });

//   if (!payment) {
//     throw new NotFoundException('Payment order not found');
//   }

//   const razorpay = this.getRazorpayClient();

//   const order = await razorpay.orders.fetch(orderId);
//   const payments = await razorpay.orders.fetchPayments(orderId);

//   return {
//     localPayment: {
//       id: payment.id,
//       amount: payment.amount,
//       status: payment.status,
//       providerOrderId: payment.providerOrderId,
//     },
//     razorpayOrder: {
//       id: order.id,
//       amount: order.amount,
//       status: order.status,
//     },
//     razorpayPayments: payments.items.map(item => ({
//       id: item.id,
//       amount: item.amount,
//       status: item.status,
//       captured: item.captured,
//       currency: item.currency,
//     })),
//   };
// }

// async cancelAbandonedRazorpayOrder(
//   orderId: string,
//   user: any,
// ) {
//   if (!user.hospitalId) {
//     throw new ForbiddenException(
//       'User is not associated with a hospital',
//     );
//   }

//   const payment = await this.prisma.payment.findFirst({
//     where: {
//       providerOrderId: orderId,
//       provider: 'RAZORPAY',
//       status: 'PENDING',
//       invoice: {
//         hospitalId: user.hospitalId,
//       },
//     },
//   });

//   if (!payment) {
//     throw new NotFoundException(
//       'Pending Razorpay payment not found',
//     );
//   }

//   const razorpay = this.getRazorpayClient();

//   const order = await razorpay.orders.fetch(orderId);
//   const gatewayPayments =
//     await razorpay.orders.fetchPayments(orderId);

//   if (order.status !== 'created') {
//     throw new ConflictException(
//       'Razorpay order is not in created state',
//     );
//   }

//   if (gatewayPayments.items.length > 0) {
//     throw new ConflictException(
//       'Payment attempts exist. Manual reconciliation is required.',
//     );
//   }

//   const updated = await this.prisma.payment.updateMany({
//     where: {
//       id: payment.id,
//       status: 'PENDING',
//     },
//     data: {
//       status: 'FAILED',
//       failureReason: 'Abandoned Razorpay order cancelled',
//     },
//   });

//   if (updated.count === 0) {
//     throw new ConflictException(
//       'Payment status changed. Please retry.',
//     );
//   }

//   return {
//     paymentId: payment.id,
//     orderId,
//     status: 'FAILED',
//     message: 'Abandoned payment order reconciled',
//   };
// }


}