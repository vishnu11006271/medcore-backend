
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import { CreateLabTestDto } from './dto/create-lab-test.dto.js';
import { UpdateLabTestDto } from './dto/update-lab-test.dto.js';
import { CreateLabOrderDto } from './dto/create-lab-order.dto.js';
import { UploadLabResultDto } from './dto/upload-lab-result.dto.js';
import { ApproveLabResultDto } from './dto/approve-lab-result.dto.js';

@Injectable()
export class LaboratoryService {
  constructor(private readonly prisma: PrismaService) {}

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  private async getDoctor(userId: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
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
      throw new ForbiddenException('Active verified doctor profile required');
    }

    return doctor;
  }

  private async getHospitalUser(userId: string, role: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        hospitalId: true,
      },
    });

    if (!user || user.role !== role || !user.hospitalId) {
      throw new ForbiddenException('Valid hospital staff account required');
    }

    return user;
  }

  private async getOrder(orderId: string) {
    const order = await this.prisma.labOrder.findUnique({
      where: { id: orderId },
      include: {
        labTest: true,
        medicalRecord: {
          include: {
            patient: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
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
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Laboratory order not found');
    }

    return order;
  }

  private async verifyHospitalOrder(orderId: string, hospitalId: string) {
    const order = await this.getOrder(orderId);

    if (
      order.labTest.hospitalId !== hospitalId ||
      order.medicalRecord.hospitalId !== hospitalId
    ) {
      throw new ForbiddenException('Access to this laboratory order is denied');
    }

    return order;
  }

  // --------------------------------------------------
  // LAB TEST MANAGEMENT
  // --------------------------------------------------

  async createLabTest(userId: string, dto: CreateLabTestDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { hospitalId: true },
    });

    if (!user?.hospitalId) {
      throw new ForbiddenException('Hospital association required');
    }

    const existing = await this.prisma.labTest.findUnique({
      where: {
        hospitalId_code: {
          hospitalId: user.hospitalId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Lab test code already exists');
    }

    return this.prisma.labTest.create({
      data: {
        hospitalId: user.hospitalId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        price: dto.price,
      },
    });
  }

  async findLabTests(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { hospitalId: true },
    });

    if (!user?.hospitalId) {
      throw new ForbiddenException('Hospital association required');
    }

    return this.prisma.labTest.findMany({
      where: {
        hospitalId: user.hospitalId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async updateLabTest(
    userId: string,
    labTestId: string,
    dto: UpdateLabTestDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { hospitalId: true },
    });

    if (!user?.hospitalId) {
      throw new ForbiddenException('Hospital association required');
    }

    const labTest = await this.prisma.labTest.findFirst({
      where: {
        id: labTestId,
        hospitalId: user.hospitalId,
      },
    });

    if (!labTest) {
      throw new NotFoundException('Laboratory test not found');
    }

    return this.prisma.labTest.update({
      where: { id: labTestId },
      data: dto,
    });
  }

  // --------------------------------------------------
  // DOCTOR: CREATE LAB ORDER
  // --------------------------------------------------

  async createLabOrder(userId: string, dto: CreateLabOrderDto) {
    const doctor = await this.getDoctor(userId);

    const medicalRecord = await this.prisma.medicalRecord.findFirst({
      where: {
        id: dto.medicalRecordId,
        doctorId: doctor.id,
        hospitalId: doctor.user.hospitalId!,
      },
    });

    if (!medicalRecord) {
      throw new NotFoundException(
        'Medical record not found or not assigned to this doctor',
      );
    }

    if (medicalRecord.status !== 'FINALIZED') {
      throw new BadRequestException(
        'Laboratory orders can only be created for finalized medical records',
      );
    }

    const labTest = await this.prisma.labTest.findFirst({
      where: {
        id: dto.labTestId,
        hospitalId: doctor.user.hospitalId!,
        isActive: true,
      },
    });

    if (!labTest) {
      throw new NotFoundException('Active laboratory test not found');
    }

    return this.prisma.labOrder.create({
      data: {
        medicalRecordId: medicalRecord.id,
        labTestId: labTest.id,
        orderedById: doctor.id,
        status: 'ORDERED',
        notes: dto.notes,
      },
      include: {
        labTest: true,
      },
    });
  }

  // --------------------------------------------------
  // LIST AND VIEW ORDERS
  // --------------------------------------------------

  async findOrders(userId: string, role: string) {
    let where: any = {};

    if (role === 'DOCTOR') {
      const doctor = await this.getDoctor(userId);
      where = {
        orderedById: doctor.id,
        medicalRecord: {
          hospitalId: doctor.user.hospitalId,
        },
      };
    } else if (role === 'LAB_TECHNICIAN') {
      const user = await this.getHospitalUser(userId, role);
      where = {
        labTest: {
          hospitalId: user.hospitalId!,
        },
      };
    } else {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.labOrder.findMany({
      where,
      include: {
        labTest: true,
        medicalRecord: {
          include: {
            patient: {
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
      orderBy: { orderedAt: 'desc' },
    });
  }

  async findOrder(userId: string, role: string, orderId: string) {
    const order = await this.getOrder(orderId);

    if (role === 'DOCTOR') {
      const doctor = await this.getDoctor(userId);

      if (
        order.orderedById !== doctor.id ||
        order.medicalRecord.hospitalId !== doctor.user.hospitalId
      ) {
        throw new ForbiddenException('Access denied');
      }

      return order;
    }

    if (role === 'LAB_TECHNICIAN') {
      const user = await this.getHospitalUser(userId, role);
      return this.verifyHospitalOrder(orderId, user.hospitalId!);
    }

    throw new ForbiddenException('Access denied');
  }

  // --------------------------------------------------
  // LAB TECHNICIAN: SAMPLE COLLECTION
  // --------------------------------------------------

  async collectSample(userId: string, orderId: string) {
    const user = await this.getHospitalUser(userId, 'LAB_TECHNICIAN');
    const order = await this.verifyHospitalOrder(
      orderId,
      user.hospitalId!,
    );

    if (order.status !== 'ORDERED') {
      throw new BadRequestException(
        'Only ordered tests can have samples collected',
      );
    }

    return this.prisma.labOrder.update({
      where: { id: orderId },
      data: { status: 'SAMPLE_COLLECTED' },
    });
  }

  // --------------------------------------------------
  // LAB TECHNICIAN: START PROCESSING
  // --------------------------------------------------

  async startProcessing(userId: string, orderId: string) {
    const user = await this.getHospitalUser(userId, 'LAB_TECHNICIAN');
    const order = await this.verifyHospitalOrder(
      orderId,
      user.hospitalId!,
    );

    if (order.status !== 'SAMPLE_COLLECTED') {
      throw new BadRequestException(
        'Sample must be collected before processing',
      );
    }

    return this.prisma.labOrder.update({
      where: { id: orderId },
      data: { status: 'PROCESSING' },
    });
  }

  // --------------------------------------------------
  // LAB TECHNICIAN: UPLOAD RESULT
  // --------------------------------------------------

  async uploadResult(
    userId: string,
    orderId: string,
    dto: UploadLabResultDto,
  ) {
    const user = await this.getHospitalUser(userId, 'LAB_TECHNICIAN');
    const order = await this.verifyHospitalOrder(
      orderId,
      user.hospitalId!,
    );

    if (order.status !== 'PROCESSING') {
      throw new BadRequestException(
        'Only processing orders can receive results',
      );
    }

    return this.prisma.labOrder.update({
      where: { id: orderId },
      data: {
        resultText: dto.resultText,
        resultFileUrl: dto.resultFileUrl,
        resultUploadedByUserId: userId,
        status: 'RESULT_UPLOADED',
      },
    });
  }

  // --------------------------------------------------
  // DOCTOR: APPROVE RESULT
  // --------------------------------------------------

  async approveResult(
    userId: string,
    orderId: string,
    dto: ApproveLabResultDto,
  ) {
    const doctor = await this.getDoctor(userId);
    const order = await this.verifyHospitalOrder(
      orderId,
      doctor.user.hospitalId!,
    );

    if (order.orderedById !== doctor.id) {
      throw new ForbiddenException(
        'Only the ordering doctor can approve this result',
      );
    }

    if (order.status !== 'RESULT_UPLOADED') {
      throw new BadRequestException(
        'Only uploaded results can be approved',
      );
    }

    return this.prisma.labOrder.update({
      where: { id: orderId },
      data: {
        status: 'APPROVED',
        approvedByUserId: userId,
        approvedAt: new Date(),
        completedAt: new Date(),
        approvalNotes: dto.approvalNotes,
      },
    });
  }

  // --------------------------------------------------
  // PATIENT: VIEW APPROVED RESULTS
  // --------------------------------------------------

  async findPatientResults(userId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
      select: {
        id: true,
        hospitalId: true,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    return this.prisma.labOrder.findMany({
      where: {
        status: 'APPROVED',
        medicalRecord: {
          patientId: patient.id,
          hospitalId: patient.hospitalId,
        },
      },
      include: {
        labTest: true,
        medicalRecord: {
          select: {
            recordedAt: true,
            diagnosis: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });
  }
}
