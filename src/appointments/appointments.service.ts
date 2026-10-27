import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';

const BLOCKING_STATUSES = [
  'PENDING',
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
] as const;

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAppointment(
    userId: string,
    dto: CreateAppointmentDto,
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            isActive: true,
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (!patient) {
      throw new ForbiddenException(
        'A registered patient profile is required to book an appointment',
      );
    }

    if (!patient.user.isActive || !patient.user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Your account must be active and email-verified',
      );
    }

    const requestedStart = new Date(dto.scheduledAt);

    if (Number.isNaN(requestedStart.getTime())) {
      throw new BadRequestException('Invalid appointment date');
    }

    if (requestedStart <= new Date()) {
      throw new BadRequestException(
        'Appointments must be booked for a future time',
      );
    }

    // This first implementation uses the Node.js server's local
    // timezone to interpret the weekly availability schedule.
    const dayOfWeek = requestedStart.getDay();
    const startMinute =
      requestedStart.getHours() * 60 +
      requestedStart.getMinutes();

    if (
      requestedStart.getSeconds() !== 0 ||
      requestedStart.getMilliseconds() !== 0
    ) {
      throw new BadRequestException(
        'Appointment times must start on a whole minute',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      /*
       * CRITICAL: lock the doctor row before checking appointments.
       *
       * Another booking transaction for this doctor must wait until
       * this transaction commits or rolls back.
       */
      const lockedDoctor = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id"
        FROM "Doctor"
        WHERE "id" = ${dto.doctorId}
        FOR UPDATE
      `;

      if (lockedDoctor.length === 0) {
        throw new NotFoundException('Doctor not found');
      }

      const doctor = await tx.doctor.findUnique({
        where: { id: dto.doctorId },
        include: {
          user: {
            select: {
              isActive: true,
              hospitalId: true,
            },
          },
          department: true,
        },
      });

      if (!doctor) {
        throw new NotFoundException('Doctor not found');
      }

      if (!doctor.user.isActive) {
        throw new BadRequestException(
          'This doctor is currently inactive',
        );
      }

      if (
        !doctor.department ||
        !doctor.department.isActive ||
        doctor.user.hospitalId !== patient.hospitalId ||
        doctor.department.hospitalId !== patient.hospitalId
      ) {
        throw new BadRequestException(
          'The doctor is not available for booking at your hospital',
        );
      }

      const availability = await tx.doctorAvailability.findMany({
        where: {
          doctorId: doctor.id,
          dayOfWeek,
          isActive: true,
        },
        orderBy: { startMinute: 'asc' },
      });

      /*
       * Find the availability interval containing the requested
       * start time. The appointment must fit a configured slot.
       */
      const matchingInterval = availability.find((interval) => {
        const duration =
          dto.durationMinutes ?? interval.slotDurationMinutes;

        return (
          startMinute >= interval.startMinute &&
          startMinute + duration <= interval.endMinute &&
          (startMinute - interval.startMinute) %
            interval.slotDurationMinutes ===
            0 &&
          duration === interval.slotDurationMinutes
        );
      });

      if (!matchingInterval) {
        throw new BadRequestException(
          'The requested time is outside the doctor’s available slots',
        );
      }

      const durationMinutes =
        dto.durationMinutes ??
        matchingInterval.slotDurationMinutes;

      const requestedEnd = new Date(
        requestedStart.getTime() + durationMinutes * 60_000,
      );

      /*
       * Find appointments starting on this local calendar day.
       * We calculate their actual end times below to detect
       * overlaps even when their start times differ.
       */
      const dayStart = new Date(requestedStart);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const existingAppointments = await tx.appointment.findMany({
        where: {
          doctorId: doctor.id,
          scheduledAt: {
            gte: dayStart,
            lt: dayEnd,
          },
          status: {
            in: [...BLOCKING_STATUSES],
          },
        },
        select: {
          id: true,
          scheduledAt: true,
          durationMinutes: true,
        },
      });

      const hasConflict = existingAppointments.some((appointment) => {
        const existingStart = appointment.scheduledAt;

        const existingEnd = new Date(
          existingStart.getTime() +
            appointment.durationMinutes * 60_000,
        );

        // Half-open intervals allow back-to-back appointments:
        // [10:00, 10:30) and [10:30, 11:00) do not overlap.
        return (
          requestedStart < existingEnd &&
          requestedEnd > existingStart
        );
      });

      if (hasConflict) {
        throw new ConflictException(
          'This appointment slot has already been booked',
        );
      }

      return tx.appointment.create({
        data: {
          hospitalId: patient.hospitalId,
          patientId: patient.id,
          doctorId: doctor.id,
          departmentId: doctor.department.id,
          scheduledAt: requestedStart,
          durationMinutes,
          status: 'PENDING',
          reason: dto.reason,
        },
      });
    });

    return result;
  }

  
  async changeAppointmentStatus(
    appointmentId: string,
    actorUserId: string,
    actorRole: string,
    action: 'confirm' | 'start' | 'complete' | 'cancel',
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          select: { userId: true },
        },
        patient: {
          select: { userId: true },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    let targetStatus:
      | 'CONFIRMED'
      | 'IN_PROGRESS'
      | 'COMPLETED'
      | 'CANCELLED';

    let allowedStatuses: string[];

    switch (action) {
      case 'confirm':
        if (
          actorRole !== 'HOSPITAL_ADMIN' &&
          actorRole !== 'RECEPTIONIST'
        ) {
          throw new ForbiddenException(
            'Only hospital administrators or receptionists can confirm appointments',
          );
        }

        targetStatus = 'CONFIRMED';
        allowedStatuses = ['PENDING', 'SCHEDULED'];
        break;

      case 'start':
        targetStatus = 'IN_PROGRESS';
        allowedStatuses = ['CONFIRMED', 'CHECKED_IN'];
        break;

      case 'complete':
        targetStatus = 'COMPLETED';
        allowedStatuses = ['IN_PROGRESS'];
        break;

      case 'cancel':
        targetStatus = 'CANCELLED';
        allowedStatuses = ['PENDING', 'SCHEDULED', 'CONFIRMED'];
        break;
    }

    // Patients can cancel only their own appointments.
    if (action === 'cancel' && actorRole === 'PATIENT') {
      if (appointment.patient.userId !== actorUserId) {
        throw new ForbiddenException(
          'You can cancel only your own appointments',
        );
      }
    } else if (
      action === 'start' ||
      action === 'complete'
    ) {
      if (actorRole === 'DOCTOR') {
        if (appointment.doctor.userId !== actorUserId) {
          throw new ForbiddenException(
            'You can manage only your own appointments',
          );
        }
      } else if (
        actorRole !== 'HOSPITAL_ADMIN' &&
        actorRole !== 'RECEPTIONIST'
      ) {
        throw new ForbiddenException(
          'You are not authorized to change this appointment status',
        );
      }
    } else if (
      action === 'cancel' &&
      actorRole !== 'PATIENT' &&
      actorRole !== 'HOSPITAL_ADMIN' &&
      actorRole !== 'RECEPTIONIST'
    ) {
      throw new ForbiddenException(
        'You are not authorized to cancel this appointment',
      );
    }

    // Staff must belong to the same hospital as the appointment.
    if (
      actorRole === 'HOSPITAL_ADMIN' ||
      actorRole === 'RECEPTIONIST'
    ) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorUserId },
        select: { hospitalId: true, isActive: true },
      });

      if (
        !actor ||
        !actor.isActive ||
        actor.hospitalId !== appointment.hospitalId
      ) {
        throw new ForbiddenException(
          'You cannot manage appointments for this hospital',
        );
      }
    }

    if (!allowedStatuses.includes(appointment.status)) {
      throw new ConflictException(
        `Cannot ${action} an appointment with status ${appointment.status}`,
      );
    }

    // Conditional update prevents overwriting a status changed
    // concurrently by another request.
    const updateResult = await this.prisma.appointment.updateMany({
      where: {
        id: appointmentId,
        status: appointment.status,
      },
      data: {
        status: targetStatus,
      },
    });

    if (updateResult.count === 0) {
      throw new ConflictException(
        'The appointment status changed. Refresh and try again.',
      );
    }

    return this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
  }

}