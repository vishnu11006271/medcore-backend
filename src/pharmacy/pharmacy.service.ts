import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMedicineDto } from './dto/create-medicine.dto.js';
import { UpdateMedicineDto } from './dto/update-medicine.dto.js';
import { ReceiveStockDto } from './dto/receive-stock.dto.js';
import { DispensePrescriptionDto } from './dto/dispense-prescription.dto.js';

@Injectable()
export class PharmacyService {
  constructor(private readonly prisma: PrismaService) {}

  // Validate the hospital context of the logged-in user.
  private async validateHospitalUser(userId: string, hospitalId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        hospitalId,
        isActive: true,
      },
    });

    if (!user) {
      throw new ForbiddenException('Active hospital user not found');
    }

    return user;
  }

  // Create a medicine in the logged-in user's hospital.
  async createMedicine(
    userId: string,
    hospitalId: string,
    dto: CreateMedicineDto,
  ) {
    await this.validateHospitalUser(userId, hospitalId);

    const existing = await this.prisma.medicine.findFirst({
      where: {
        hospitalId,
        name: dto.name,
        strength: dto.strength ?? null,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Medicine with this name and strength already exists',
      );
    }

    const medicine = await this.prisma.medicine.create({
      data: {
        hospitalId,
        name: dto.name.trim(),
        genericName: dto.genericName,
        strength: dto.strength,
        manufacturer: dto.manufacturer,
        unitPrice: dto.unitPrice,
      },
    });

    return medicine;
  }

  // List medicines belonging to the logged-in user's hospital.
  async findAllMedicines(hospitalId: string) {
    return this.prisma.medicine.findMany({
      where: { hospitalId },
      orderBy: { name: 'asc' },
      include: {
        batches: {
          where: {
            quantityAvailable: { gt: 0 },
          },
          orderBy: { expiryDate: 'asc' },
        },
      },
    });
  }

  // Update medicine details. Stock is managed through batches.
  async updateMedicine(
    userId: string,
    hospitalId: string,
    medicineId: string,
    dto: UpdateMedicineDto,
  ) {
    await this.validateHospitalUser(userId, hospitalId);

    const medicine = await this.prisma.medicine.findFirst({
      where: {
        id: medicineId,
        hospitalId,
      },
    });

    if (!medicine) {
      throw new NotFoundException('Medicine not found');
    }

    return this.prisma.medicine.update({
      where: { id: medicineId },
      data: dto,
    });
  }

  // Receive a new batch of stock.
  async receiveStock(
    userId: string,
    hospitalId: string,
    dto: ReceiveStockDto,
  ) {
    await this.validateHospitalUser(userId, hospitalId);

    const medicine = await this.prisma.medicine.findFirst({
      where: {
        id: dto.medicineId,
        hospitalId,
        isActive: true,
      },
    });

    if (!medicine) {
      throw new NotFoundException('Active medicine not found');
    }

    const expiryDate = new Date(dto.expiryDate);

    if (expiryDate <= new Date()) {
      throw new BadRequestException(
        'Cannot receive a batch that has already expired',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.medicineBatch.create({
        data: {
          medicineId: medicine.id,
          batchNumber: dto.batchNumber.trim(),
          expiryDate,
          quantityReceived: dto.quantityReceived,
          quantityAvailable: dto.quantityReceived,
          purchasePrice: dto.purchasePrice ?? 0,
        },
      });

      const totalStock = await tx.medicineBatch.aggregate({
        where: {
          medicineId: medicine.id,
          expiryDate: { gt: new Date() },
        },
        _sum: {
          quantityAvailable: true,
        },
      });

      await tx.medicine.update({
        where: { id: medicine.id },
        data: {
          stockQuantity: totalStock._sum.quantityAvailable ?? 0,
        },
      });

      return batch;
    });
  }

  // View stock batches for one medicine.
  async getMedicineBatches(hospitalId: string, medicineId: string) {
    const medicine = await this.prisma.medicine.findFirst({
      where: {
        id: medicineId,
        hospitalId,
      },
    });

    if (!medicine) {
      throw new NotFoundException('Medicine not found');
    }

    return this.prisma.medicineBatch.findMany({
      where: { medicineId },
      orderBy: { expiryDate: 'asc' },
    });
  }

  // Dispense prescription items using FEFO batch allocation.
  async dispensePrescription(
    userId: string,
    hospitalId: string,
    dto: DispensePrescriptionDto,
  ) {
    await this.validateHospitalUser(userId, hospitalId);

    // Reject duplicate prescription item IDs in one request.
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'At least one prescription item is required',
      );
    }
    const itemIds = dto.items.map((item) => item.prescriptionItemId);

    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException(
        'Duplicate prescription items are not allowed',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const prescription = await tx.prescription.findUnique({
          where: { id: dto.prescriptionId },
          include: {
            medicalRecord: true,
            items: {
              include: {
                medicine: true,
              },
            },
          },
        });

        if (!prescription) {
          throw new NotFoundException('Prescription not found');
        }

        if (prescription.medicalRecord.hospitalId !== hospitalId) {
          throw new ForbiddenException(
            'Prescription does not belong to your hospital',
          );
        }

        if (prescription.status !== 'ACTIVE') {
          throw new BadRequestException(
            'Only active prescriptions can be dispensed',
          );
        }

        const prescriptionItems = new Map(
          prescription.items.map((item) => [item.id, item]),
        );

        const dispense = await tx.pharmacyDispense.create({
          data: {
            prescriptionId: prescription.id,
            dispensedByUserId: userId,
            notes: dto.notes,
          },
        });

        const dispensedItems: any[] = [];

        for (const requestedItem of dto.items) {
          const prescriptionItem = prescriptionItems.get(
            requestedItem.prescriptionItemId,
          );

          if (!prescriptionItem) {
            throw new BadRequestException(
              'Prescription item does not belong to this prescription',
            );
          }

          if (!prescriptionItem.medicine.isActive) {
            throw new BadRequestException(
              `Medicine ${prescriptionItem.medicine.name} is inactive`,
            );
          }

          if (prescriptionItem.medicine.hospitalId !== hospitalId) {
            throw new ForbiddenException(
              'Prescription contains a medicine from another hospital',
            );
          }

          const alreadyDispensed = await tx.pharmacyDispenseItem.aggregate({
            where: {
              prescriptionItemId: prescriptionItem.id,
            },
            _sum: {
              quantity: true,
            },
          });

          const remainingQuantity =
            prescriptionItem.quantity -
            (alreadyDispensed._sum.quantity ?? 0);

          if (requestedItem.quantity > remainingQuantity) {
            throw new BadRequestException(
              `Requested quantity exceeds the remaining prescribed quantity for ${prescriptionItem.medicine.name}. Remaining: ${remainingQuantity}`,
            );
          }

          // FEFO: earliest expiry date first.
          const batches = await tx.medicineBatch.findMany({
            where: {
              medicineId: prescriptionItem.medicineId,
              quantityAvailable: { gt: 0 },
              expiryDate: { gt: new Date() },
            },
            orderBy: [
              { expiryDate: 'asc' },
              { receivedAt: 'asc' },
            ],
          });

          const availableQuantity = batches.reduce(
            (total, batch) => total + batch.quantityAvailable,
            0,
          );

          if (availableQuantity < requestedItem.quantity) {
            throw new BadRequestException(
              `Insufficient unexpired stock for ${prescriptionItem.medicine.name}. Available: ${availableQuantity}`,
            );
          }

          const dispenseItem = await tx.pharmacyDispenseItem.create({
            data: {
              dispenseId: dispense.id,
              prescriptionItemId: prescriptionItem.id,
              medicineId: prescriptionItem.medicineId,
              quantity: requestedItem.quantity,
              unitPrice: prescriptionItem.medicine.unitPrice,
            },
          });

          let quantityToAllocate = requestedItem.quantity;

          for (const batch of batches) {
            if (quantityToAllocate <= 0) {
              break;
            }

            const allocatedQuantity = Math.min(
              batch.quantityAvailable,
              quantityToAllocate,
            );

            // Conditional update prevents taking stock that another
            // transaction has already consumed.
            const updateResult = await tx.medicineBatch.updateMany({
              where: {
                id: batch.id,
                quantityAvailable: { gte: allocatedQuantity },
                expiryDate: { gt: new Date() },
              },
              data: {
                quantityAvailable: {
                  decrement: allocatedQuantity,
                },
              },
            });

            if (updateResult.count !== 1) {
              throw new BadRequestException(
                'Stock changed during dispensing. Please retry.',
              );
            }

            await tx.pharmacyBatchAllocation.create({
              data: {
                dispenseItemId: dispenseItem.id,
                batchId: batch.id,
                quantity: allocatedQuantity,
              },
            });

            quantityToAllocate -= allocatedQuantity;
          }

          if (quantityToAllocate > 0) {
            throw new BadRequestException(
              'Unable to allocate the complete requested quantity',
            );
          }


          const totalStock = await tx.medicineBatch.aggregate({
            where: {
              medicineId: prescriptionItem.medicineId,
              expiryDate: { gt: new Date() },
            },
            _sum: {
              quantityAvailable: true,
            },
          });

          await tx.medicine.update({
            where: {
              id: prescriptionItem.medicineId,
            },
            data: {
              stockQuantity: totalStock._sum.quantityAvailable ?? 0,
            },
          });

          dispensedItems.push(dispenseItem);
        }

        return tx.pharmacyDispense.findUnique({
          where: { id: dispense.id },
          include: {
            items: {
              include: {
                medicine: true,
                batchAllocations: {
                  include: {
                    batch: true,
                  },
                },
              },
            },
          },
        });
      },
      {
        isolationLevel: 'Serializable',
      },
    );
  }

  // View dispensing history for a prescription.
  async getPrescriptionDispensingHistory(
    hospitalId: string,
    prescriptionId: string,
  ) {
    const prescription = await this.prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        medicalRecord: {
          hospitalId,
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    return this.prisma.pharmacyDispense.findMany({
      where: { prescriptionId },
      orderBy: { dispensedAt: 'desc' },
      include: {
        items: {
          include: {
            medicine: true,
            batchAllocations: {
              include: {
                batch: true,
              },
            },
          },
        },
      },
    });
  }


  async findActivePrescriptions(hospitalId: string) {
    const prescriptions = await this.prisma.prescription.findMany({
      where: {
        status: 'ACTIVE',
        medicalRecord: {
          hospitalId,
        },
      },
      include: {
        medicalRecord: {
          include: {
            patient: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            doctor: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        items: {
          include: {
            medicine: true,
            dispenseItems: {
              select: {
                quantity: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return prescriptions
      .map((prescription) => {
        const items = prescription.items
          .map((item) => {
            const dispensedQuantity = item.dispenseItems.reduce(
              (total, dispenseItem) => total + dispenseItem.quantity,
              0,
            );

            const remainingQuantity = Math.max(
              0,
              item.quantity - dispensedQuantity,
            );

            return {
              id: item.id,
              medicineId: item.medicineId,
              medicineName: item.medicine.name,
              genericName: item.medicine.genericName,
              strength: item.medicine.strength,
              dosage: item.dosage,
              frequency: item.frequency,
              durationDays: item.durationDays,
              prescribedQuantity: item.quantity,
              dispensedQuantity,
              remainingQuantity,
              instructions: item.instructions,
              isActive: item.medicine.isActive,
            };
          })
          .filter((item) => item.remainingQuantity > 0);

        return {
          id: prescription.id,
          status: prescription.status,
          createdAt: prescription.createdAt,
          notes: prescription.notes,
          patient: {
            id: prescription.medicalRecord.patient.id,
            patientNumber: prescription.medicalRecord.patient.patientNumber,
            firstName: prescription.medicalRecord.patient.user.firstName,
            lastName: prescription.medicalRecord.patient.user.lastName,
          },
          doctor: {
            id: prescription.medicalRecord.doctor.id,
            firstName: prescription.medicalRecord.doctor.user.firstName,
            lastName: prescription.medicalRecord.doctor.user.lastName,
            specialization:
              prescription.medicalRecord.doctor.specialization,
          },
          items,
        };
      })
      .filter((prescription) => prescription.items.length > 0);
  }

}