
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { WeeklyAvailabilityDto } from './dto/weekly-availability.dto.js';

export interface AvailabilityActor {
  role: 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'PATIENT';
  hospitalId: string | null;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verify that the doctor exists and the current user
   * has permission to access the doctor's availability.
   */
  // private async assertDoctorAccess(
  //   doctorId: string,
  //   actor: AvailabilityActor,
  // ) {
  //   const doctor = await this.prisma.doctor.findUnique({
  //     where: { id: doctorId },
  //     select: {
  //       id: true,
  //       user: {
  //         select: {
  //           hospitalId: true,
  //           isActive: true,
  //         },
  //       },
  //     },
  //   });

  //   if (!doctor) {
  //     throw new NotFoundException({
  //       code: 'DOCTOR_NOT_FOUND',
  //       message: 'Doctor not found',
  //     });
  //   }

  //   const doctorHospitalId = doctor.user.hospitalId;

  //   if (!doctorHospitalId) {
  //     throw new ForbiddenException({
  //       code: 'DOCTOR_HOSPITAL_UNASSIGNED',
  //       message: 'Doctor is not assigned to a hospital',
  //     });
  //   }

  //   if (
  //     actor.role === 'HOSPITAL_ADMIN' &&
  //     actor.hospitalId !== doctorHospitalId
  //   ) {
  //     throw new ForbiddenException({
  //       code: 'HOSPITAL_ACCESS_DENIED',
  //       message:
  //         'You cannot manage availability for doctors from another hospital.',
  //     });
  //   }

  //   return doctor;
  // }

  private async assertDoctorAccess(
  doctorId: string,
  actor: AvailabilityActor,
  ) {
  const doctor = await this.prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      user: {
        select: {
          hospitalId: true,
          isActive: true,
        },
      },
    },
  });

  if (!doctor) {
    throw new NotFoundException({
      code: 'DOCTOR_NOT_FOUND',
      message: 'Doctor not found',
    });
  }

  const doctorHospitalId = doctor.user.hospitalId;

  if (!doctorHospitalId) {
    throw new ForbiddenException({
      code: 'DOCTOR_HOSPITAL_UNASSIGNED',
      message: 'Doctor is not assigned to a hospital',
    });
  }

  if (
    actor.role === 'HOSPITAL_ADMIN' &&
    actor.hospitalId !== doctorHospitalId
  ) {
    throw new ForbiddenException({
      code: 'HOSPITAL_ACCESS_DENIED',
      message:
        'You cannot manage availability for doctors from another hospital.',
    });
  }

  // Patients can only view availability at verified hospitals.
  if (actor.role === 'PATIENT') {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: doctorHospitalId },
      select: { status: true },
    });

    if (!hospital || hospital.status !== 'VERIFIED') {
      throw new ForbiddenException({
        code: 'HOSPITAL_NOT_AVAILABLE',
        message: 'This hospital is not available for appointment booking.',
      });
    }
  }

  return doctor;
  }

  /**
   * Create or replace a doctor's complete weekly schedule.
   */
  async setWeeklySchedule(
    doctorId: string,
    dto: WeeklyAvailabilityDto,
    actor: AvailabilityActor,
  ) {
    await this.assertDoctorAccess(doctorId, actor);

    const schedule = dto.schedule;

    // Validate individual working intervals.
    for (const interval of schedule) {
      if (interval.startMinute >= interval.endMinute) {
        throw new BadRequestException({
          code: 'INVALID_TIME_RANGE',
          message: 'Start time must be earlier than end time',
        });
      }

      if (
        interval.slotDurationMinutes <= 0 ||
        interval.slotDurationMinutes > 240
      ) {
        throw new BadRequestException({
          code: 'INVALID_SLOT_DURATION',
          message: 'Slot duration must be between 5 and 240 minutes',
        });
      }

      const duration =
        interval.endMinute - interval.startMinute;

      if (duration % interval.slotDurationMinutes !== 0) {
        throw new BadRequestException({
          code: 'INVALID_SLOT_INTERVAL',
          message:
            'Each working interval must divide evenly into appointment slots',
        });
      }
    }

    // Group intervals by weekday.
    const grouped = new Map<
      number,
      typeof schedule
    >();

    for (const interval of schedule) {
      const intervals =
        grouped.get(interval.dayOfWeek) ?? [];

      intervals.push(interval);
      grouped.set(interval.dayOfWeek, intervals);
    }

    // Prevent overlapping intervals on the same day.
    for (const intervals of grouped.values()) {
      intervals.sort(
        (a, b) => a.startMinute - b.startMinute,
      );

      for (let i = 1; i < intervals.length; i++) {
        if (
          intervals[i].startMinute <
          intervals[i - 1].endMinute
        ) {
          throw new BadRequestException({
            code: 'OVERLAPPING_AVAILABILITY',
            message:
              'Working intervals on the same day cannot overlap',
          });
        }
      }
    }

    // Replace the existing weekly schedule atomically.
    return this.prisma.$transaction(async (tx) => {
      await tx.doctorAvailability.deleteMany({
        where: { doctorId },
      });

      if (schedule.length > 0) {
        await tx.doctorAvailability.createMany({
          data: schedule.map((interval) => ({
            doctorId,
            dayOfWeek: interval.dayOfWeek,
            startMinute: interval.startMinute,
            endMinute: interval.endMinute,
            slotDurationMinutes:
              interval.slotDurationMinutes,
          })),
        });
      }

      return tx.doctorAvailability.findMany({
        where: { doctorId },
        orderBy: [
          { dayOfWeek: 'asc' },
          { startMinute: 'asc' },
        ],
      });
    });
  }

  /**
   * Retrieve the doctor's active weekly schedule.
   */
  async getWeeklySchedule(
    doctorId: string,
    actor: AvailabilityActor,
  ) {
    await this.assertDoctorAccess(doctorId, actor);

    return this.prisma.doctorAvailability.findMany({
      where: {
        doctorId,
        isActive: true,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startMinute: 'asc' },
      ],
    });
  }

  /**
   * Generate appointment slots for a particular calendar date.
   */
  async getAvailableSlots(
    doctorId: string,
    date: string,
    actor: AvailabilityActor,
  ) {
    // 1. Verify doctor access.
    const doctor = await this.assertDoctorAccess(
      doctorId,
      actor,
    );

    if (!doctor.user.isActive) {
      throw new BadRequestException({
        code: 'DOCTOR_INACTIVE',
        message: 'Doctor is inactive',
      });
    }

    // 2. Validate the date format and actual calendar date.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: 'Date must be in YYYY-MM-DD format',
      });
    }

    const [year, month, day] = date
      .split('-')
      .map(Number);

    const requestedDate = new Date(
      year,
      month - 1,
      day,
    );

    if (
      Number.isNaN(requestedDate.getTime()) ||
      requestedDate.getFullYear() !== year ||
      requestedDate.getMonth() !== month - 1 ||
      requestedDate.getDate() !== day
    ) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: 'Invalid calendar date',
      });
    }

    // 3. Build local calendar-day boundaries.
    const startOfDay = new Date(requestedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(requestedDate);
    endOfDay.setDate(endOfDay.getDate() + 1);
    endOfDay.setHours(0, 0, 0, 0);

    // 4. Prevent searching for a past date.
    const now = new Date();

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    if (startOfDay < today) {
      throw new BadRequestException({
        code: 'PAST_DATE_NOT_ALLOWED',
        message: 'Cannot retrieve slots for a past date',
      });
    }

    // 5. Find active working intervals for the weekday.
    const dayOfWeek = requestedDate.getDay();

    const intervals =
      await this.prisma.doctorAvailability.findMany({
        where: {
          doctorId,
          dayOfWeek,
          isActive: true,
        },
        orderBy: {
          startMinute: 'asc',
        },
      });

    if (intervals.length === 0) {
      return {
        doctorId,
        date,
        slots: [],
      };
    }

    // 6. Retrieve appointments already scheduled for this day.
    const appointments =
      await this.prisma.appointment.findMany({
        where: {
          doctorId,
          scheduledAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
          status: {
            in: [
              'PENDING',
              'SCHEDULED',
              'CONFIRMED',
              'CHECKED_IN',
              'IN_PROGRESS',
            ],
          },
        },
        select: {
          scheduledAt: true,
          durationMinutes: true,
        },
      });

    // 7. Generate slots and check appointment conflicts.
    const slots: Array<{
      startTime: string;
      endTime: string;
      available: boolean;
    }> = [];

    for (const interval of intervals) {
      for (
        let minute = interval.startMinute;
        minute + interval.slotDurationMinutes <=
        interval.endMinute;
        minute += interval.slotDurationMinutes
      ) {
        const slotStart = new Date(requestedDate);
        slotStart.setHours(0, 0, 0, 0);
        slotStart.setMinutes(minute);

        const slotEnd = new Date(
          slotStart.getTime() +
            interval.slotDurationMinutes * 60_000,
        );

        // Do not return slots that have already started.
        if (slotStart <= now) {
          continue;
        }

        // Check whether an existing appointment overlaps this slot.
        const isBooked = appointments.some(
          (appointment) => {
            const appointmentStart =
              appointment.scheduledAt;

            const appointmentEnd = new Date(
              appointmentStart.getTime() +
                appointment.durationMinutes * 60_000,
            );

            return (
              slotStart < appointmentEnd &&
              slotEnd > appointmentStart
            );
          },
        );

        const formatTime = (date: Date): string => {
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');

          return `${hours}:${minutes}`;
        };

        slots.push({
          startTime: formatTime(slotStart),
          endTime: formatTime(slotEnd),
          available: !isBooked,
        });
      }
    }

    return {
      doctorId,
      date,
      slots,
    };
  }
}
