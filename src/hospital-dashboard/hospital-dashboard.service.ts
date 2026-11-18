import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HospitalDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string) {
    // 1. Find the logged-in hospital admin and their hospital.
    const admin = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isActive: true,
        hospitalId: true,
        hospital: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            status: true,
          },
        },
      },
    });

    if (!admin || !admin.isActive) {
      throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Active hospital admin account not found',
      });
    }

    if (admin.role !== 'HOSPITAL_ADMIN') {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: 'Only hospital admins can access this dashboard',
      });
    }

    if (!admin.hospitalId || !admin.hospital) {
      throw new NotFoundException({
        code: 'HOSPITAL_NOT_FOUND',
        message: 'No hospital is assigned to this admin',
      });
    }

    const hospitalId = admin.hospitalId;

    // 2. Fetch hospital statistics in parallel.
    const [
      totalPatients,
      totalDoctors,
      totalDepartments,
      totalAppointments,
      appointmentsByStatus,
      todayAppointments,
    ] = await Promise.all([
      this.prisma.patient.count({
        where: { hospitalId },
      }),

      this.prisma.doctor.count({
        where: {
          user: {
            hospitalId,
            isActive: true,
          },
        },
      }),

      this.prisma.department.count({
        where: {
          hospitalId,
          isActive: true,
        },
      }),

      this.prisma.appointment.count({
        where: { hospitalId },
      }),

      this.prisma.appointment.groupBy({
        by: ['status'],
        where: { hospitalId },
        _count: {
          _all: true,
        },
      }),

      this.prisma.appointment.count({
        where: {
          hospitalId,
          scheduledAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(
              new Date().setHours(0, 0, 0, 0) + 24 * 60 * 60 * 1000,
            ),
          },
        },
      }),
    ]);

    // 3. Convert grouped appointment counts into a simple object.
    const appointmentStatusCounts: Record<string, number> = {
    PENDING: 0,
    SCHEDULED: 0,
    CONFIRMED: 0,
    CHECKED_IN: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0,
    };

    for (const item of appointmentsByStatus) {
      appointmentStatusCounts[item.status] = item._count._all;
    }

    // 4. Return dashboard data.
    return {
      hospital: admin.hospital,

      statistics: {
        totalPatients,
        totalDoctors,
        totalDepartments,
        totalAppointments,
        todayAppointments,
      },

      appointments: {
        byStatus: appointmentStatusCounts,
      },
    };
  }

  async getAppointments(
    userId: string,
    query: {
        page?: string;
        limit?: string;
        status?: string;
        fromDate?: string;
        toDate?: string;
        search?: string;
    },
    ) {
    // 1. Verify the logged-in hospital admin.
    const admin = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
        role: true,
        isActive: true,
        hospitalId: true,
        },
    });

    if (!admin || !admin.isActive) {
        throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Active hospital admin account not found',
        });
    }

    if (admin.role !== 'HOSPITAL_ADMIN') {
        throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: 'Only hospital admins can access these appointments',
        });
    }

    if (!admin.hospitalId) {
        throw new NotFoundException({
        code: 'HOSPITAL_NOT_FOUND',
        message: 'No hospital is assigned to this admin',
        });
    }

    const hospitalId = admin.hospitalId;

    // 2. Validate pagination.
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);

    if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        throw new BadRequestException({
        code: 'INVALID_PAGINATION',
        message: 'Page must be positive and limit must be between 1 and 100',
        });
    }

    // 3. Validate appointment status.
    const validStatuses = [
        'PENDING',
        'SCHEDULED',
        'CONFIRMED',
        'CHECKED_IN',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW',
    ] as const;

    if (
        query.status &&
        !validStatuses.includes(query.status as (typeof validStatuses)[number])
    ) {
        throw new BadRequestException({
        code: 'INVALID_APPOINTMENT_STATUS',
        message: 'Invalid appointment status',
        });
    }

    // 4. Validate date filters.
    const fromDate = query.fromDate
        ? new Date(query.fromDate)
        : undefined;

    const toDate = query.toDate
        ? new Date(query.toDate)
        : undefined;

    if (
        (fromDate && Number.isNaN(fromDate.getTime())) ||
        (toDate && Number.isNaN(toDate.getTime()))
    ) {
        throw new BadRequestException({
        code: 'INVALID_DATE',
        message: 'Please provide valid fromDate and toDate values',
        });
    }

    if (fromDate && toDate && fromDate > toDate) {
        throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'fromDate cannot be later than toDate',
        });
    }

    // Include the entire toDate calendar day.
    if (toDate && query.toDate && /^\d{4}-\d{2}-\d{2}$/.test(query.toDate)) {
        toDate.setDate(toDate.getDate() + 1);
    }

    // 5. Build hospital-scoped filters.
    const where = {
        hospitalId,

        ...(query.status && {
        status: query.status as (typeof validStatuses)[number],
        }),

        ...(fromDate || toDate
        ? {
            scheduledAt: {
                ...(fromDate && { gte: fromDate }),
                ...(toDate && { lt: toDate }),
            },
            }
        : {}),

        ...(query.search?.trim()
        ? {
            OR: [
                {
                patient: {
                    user: {
                    firstName: {
                        contains: query.search.trim(),
                        mode: 'insensitive' as const,
                    },
                    },
                },
                },
                {
                patient: {
                    user: {
                    lastName: {
                        contains: query.search.trim(),
                        mode: 'insensitive' as const,
                    },
                    },
                },
                },
                {
                patient: {
                    user: {
                    email: {
                        contains: query.search.trim(),
                        mode: 'insensitive' as const,
                    },
                    },
                },
                },
                {
                doctor: {
                    user: {
                    firstName: {
                        contains: query.search.trim(),
                        mode: 'insensitive' as const,
                    },
                    },
                },
                },
                {
                doctor: {
                    user: {
                    lastName: {
                        contains: query.search.trim(),
                        mode: 'insensitive' as const,
                    },
                    },
                },
                },
            ],
            }
        : {}),
    };

    // 6. Fetch appointments and total count concurrently.
    const [appointments, total] = await Promise.all([
        this.prisma.appointment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
            scheduledAt: 'desc',
        },
        select: {
            id: true,
            scheduledAt: true,
            durationMinutes: true,
            status: true,
            reason: true,
            notes: true,
            createdAt: true,

            patient: {
            select: {
                id: true,
                patientNumber: true,
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
            select: {
                id: true,
                specialization: true,
                user: {
                select: {
                    firstName: true,
                    lastName: true,
                },
                },
            },
            },

            department: {
            select: {
                id: true,
                name: true,
            },
            },
        },
        }),

        this.prisma.appointment.count({ where }),
    ]);

    // 7. Return paginated results.
    return {
        appointments,
        pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
        },
    };
    }

    async getPatients(
    userId: string,
    query: {
        page?: string;
        limit?: string;
        search?: string;
    },
    ) {
    // 1. Find the logged-in hospital admin
    const admin = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
        role: true,
        isActive: true,
        hospitalId: true,
        },
    });

    if (!admin || !admin.isActive) {
        throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Active hospital admin account not found',
        });
    }

    if (admin.role !== 'HOSPITAL_ADMIN') {
        throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: 'Only hospital admins can access patients',
        });
    }

    if (!admin.hospitalId) {
        throw new NotFoundException({
        code: 'HOSPITAL_NOT_FOUND',
        message: 'No hospital is assigned to this admin',
        });
    }

    const hospitalId = admin.hospitalId;

    // 2. Validate pagination
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);

    if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        throw new BadRequestException({
        code: 'INVALID_PAGINATION',
        message: 'Page must be positive and limit must be between 1 and 100',
        });
    }

    // 3. Prepare search
    const search = query.search?.trim();

    // 4. Build hospital-scoped query
    const where = {
        hospitalId,
        ...(search
        ? {
            OR: [
                {
                patientNumber: {
                    contains: search,
                    mode: 'insensitive' as const,
                },
                },
                {
                user: {
                    firstName: {
                    contains: search,
                    mode: 'insensitive' as const,
                    },
                },
                },
                {
                user: {
                    lastName: {
                    contains: search,
                    mode: 'insensitive' as const,
                    },
                },
                },
                {
                user: {
                    email: {
                    contains: search,
                    mode: 'insensitive' as const,
                    },
                },
                },
            ],
            }
        : {}),
    };

    // 5. Fetch patients and total count
    const [patients, total] = await Promise.all([
        this.prisma.patient.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
            createdAt: 'desc',
        },
        select: {
            id: true,
            patientNumber: true,
            dateOfBirth: true,
            gender: true,
            bloodGroup: true,
            address: true,
            emergencyContact: true,
            createdAt: true,

            user: {
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                isActive: true,
            },
            },
        },
        }),

        this.prisma.patient.count({
        where,
        }),
    ]);

    // 6. Return paginated response
    return {
        patients,
        pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
        },
    };
    }

    async getPatientById(userId: string, patientId: string) {
    // 1. Verify hospital admin
    const admin = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
        role: true,
        isActive: true,
        hospitalId: true,
        },
    });

    if (!admin || !admin.isActive) {
        throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Active hospital admin account not found',
        });
    }

    if (admin.role !== 'HOSPITAL_ADMIN') {
        throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: 'Only hospital admins can access patient details',
        });
    }

    if (!admin.hospitalId) {
        throw new NotFoundException({
        code: 'HOSPITAL_NOT_FOUND',
        message: 'No hospital is assigned to this admin',
        });
    }

    // 2. Fetch patient within this hospital only
    const patient = await this.prisma.patient.findFirst({
        where: {
        id: patientId,
        hospitalId: admin.hospitalId,
        },
        select: {
        id: true,
        patientNumber: true,
        dateOfBirth: true,
        gender: true,
        bloodGroup: true,
        address: true,
        emergencyContact: true,
        createdAt: true,
        updatedAt: true,

        user: {
            select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true,
            createdAt: true,
            },
        },
        },
    });

    if (!patient) {
        throw new NotFoundException({
        code: 'PATIENT_NOT_FOUND',
        message: 'Patient not found in this hospital',
        });
    }

    return patient;
    }

    async getPatientAppointments(
    userId: string,
    patientId: string,
    query: {
        page?: string;
        limit?: string;
        status?: string;
    },
    ) {
    // 1. Verify hospital admin
    const admin = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
        role: true,
        isActive: true,
        hospitalId: true,
        },
    });

    if (!admin || !admin.isActive) {
        throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Active hospital admin account not found',
        });
    }

    if (admin.role !== 'HOSPITAL_ADMIN') {
        throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: 'Only hospital admins can access patient appointments',
        });
    }

    if (!admin.hospitalId) {
        throw new NotFoundException({
        code: 'HOSPITAL_NOT_FOUND',
        message: 'No hospital is assigned to this admin',
        });
    }

    const hospitalId = admin.hospitalId;

    // 2. Validate pagination
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);

    if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        throw new BadRequestException({
        code: 'INVALID_PAGINATION',
        message: 'Page must be positive and limit must be between 1 and 100',
        });
    }

    // 3. Validate appointment status
    const validStatuses = [
        'PENDING',
        'SCHEDULED',
        'CONFIRMED',
        'CHECKED_IN',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW',
    ] as const;

    if (
        query.status &&
        !validStatuses.includes(
        query.status as (typeof validStatuses)[number],
        )
    ) {
        throw new BadRequestException({
        code: 'INVALID_APPOINTMENT_STATUS',
        message: 'Invalid appointment status',
        });
    }

    // 4. Verify patient belongs to this hospital
    const patient = await this.prisma.patient.findFirst({
        where: {
        id: patientId,
        hospitalId,
        },
        select: {
        id: true,
        patientNumber: true,
        user: {
            select: {
            firstName: true,
            lastName: true,
            },
        },
        },
    });

    if (!patient) {
        throw new NotFoundException({
        code: 'PATIENT_NOT_FOUND',
        message: 'Patient not found in this hospital',
        });
    }

    // 5. Build appointment query
    const where = {
        hospitalId,
        patientId,
        ...(query.status && {
        status: query.status as (typeof validStatuses)[number],
        }),
    };

    // 6. Fetch appointments and total count
    const [appointments, total] = await Promise.all([
        this.prisma.appointment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
            scheduledAt: 'desc',
        },
        select: {
            id: true,
            scheduledAt: true,
            durationMinutes: true,
            status: true,
            reason: true,
            notes: true,
            createdAt: true,

            doctor: {
            select: {
                id: true,
                specialization: true,
                user: {
                select: {
                    firstName: true,
                    lastName: true,
                },
                },
            },
            },

            department: {
            select: {
                id: true,
                name: true,
            },
            },
        },
        }),

        this.prisma.appointment.count({
        where,
        }),
    ]);

    // 7. Return response
    return {
        patient,
        appointments,
        pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
        },
    };
    }

    async getPatientMedicalRecords(
    userId: string,
    patientId: string,
    query: {
        page?: string;
        limit?: string;
    },
    ) {
    // 1. Verify the hospital admin
    const admin = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
        role: true,
        isActive: true,
        hospitalId: true,
        },
    });

    if (!admin || !admin.isActive) {
        throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Active hospital admin account not found',
        });
    }

    if (admin.role !== 'HOSPITAL_ADMIN') {
        throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: 'Only hospital admins can access medical records',
        });
    }

    if (!admin.hospitalId) {
        throw new NotFoundException({
        code: 'HOSPITAL_NOT_FOUND',
        message: 'No hospital is assigned to this admin',
        });
    }

    const hospitalId = admin.hospitalId;

    // 2. Validate pagination
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);

    if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        throw new BadRequestException({
        code: 'INVALID_PAGINATION',
        message: 'Page must be positive and limit must be between 1 and 100',
        });
    }

    // 3. Verify that the patient belongs to this hospital
    const patient = await this.prisma.patient.findFirst({
        where: {
        id: patientId,
        hospitalId,
        },
        select: {
        id: true,
        patientNumber: true,
        user: {
            select: {
            firstName: true,
            lastName: true,
            },
        },
        },
    });

    if (!patient) {
        throw new NotFoundException({
        code: 'PATIENT_NOT_FOUND',
        message: 'Patient not found in this hospital',
        });
    }

    // 4. Build hospital-scoped medical record query
    const where = {
        hospitalId,
        patientId,
    };

    // 5. Fetch medical records and total count
    const [records, total] = await Promise.all([
        this.prisma.medicalRecord.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
            recordedAt: 'desc',
        },
        select: {
            id: true,
            appointmentId: true,
            patientId: true,
            doctorId: true,
            diagnosis: true,
            symptoms: true,
            clinicalNotes: true,
            treatmentPlan: true,
            status: true,
            recordedAt: true,
            updatedAt: true,

            doctor: {
            select: {
                id: true,
                specialization: true,
                user: {
                select: {
                    firstName: true,
                    lastName: true,
                },
                },
            },
            },

            appointment: {
            select: {
                id: true,
                scheduledAt: true,
                status: true,
                reason: true,
            },
            },
        },
        }),

        this.prisma.medicalRecord.count({
        where,
        }),
    ]);

    // 6. Return records and pagination
    return {
        patient,
        records,
        pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
        },
    };
    }

    async getAppointmentById(userId: string, appointmentId: string) {
    // 1. Verify the logged-in hospital admin.
    const admin = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
        role: true,
        isActive: true,
        hospitalId: true,
        },
    });

    if (!admin || !admin.isActive) {
        throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Active hospital admin account not found',
        });
    }

    if (admin.role !== 'HOSPITAL_ADMIN') {
        throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: 'Only hospital admins can access appointment details',
        });
    }

    if (!admin.hospitalId) {
        throw new NotFoundException({
        code: 'HOSPITAL_NOT_FOUND',
        message: 'No hospital is assigned to this admin',
        });
    }

    // 2. Find the appointment within the admin's hospital.
    const appointment = await this.prisma.appointment.findFirst({
        where: {
        id: appointmentId,
        hospitalId: admin.hospitalId,
        },
        select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        status: true,
        reason: true,
        notes: true,
        createdAt: true,
        updatedAt: true,

        patient: {
            select: {
            id: true,
            patientNumber: true,
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
            select: {
            id: true,
            specialization: true,
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

        department: {
            select: {
            id: true,
            name: true,
            },
        },
        },
    });

    if (!appointment) {
        throw new NotFoundException({
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found in this hospital',
        });
    }

    return appointment;
    }
}