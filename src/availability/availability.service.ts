import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { WeeklyAvailabilityDto } from './dto/weekly-availability.dto.js';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async setWeeklySchedule(
    doctorId: string,
    dto: WeeklyAvailabilityDto,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const schedule = dto.schedule;

    for (const interval of schedule) {
      if (interval.startMinute >= interval.endMinute) {
        throw new BadRequestException(
          'Start time must be earlier than end time',
        );
      }

      const duration =
        interval.endMinute - interval.startMinute;

      if (duration % interval.slotDurationMinutes !== 0) {
        throw new BadRequestException(
          'Each working interval must divide evenly into appointment slots',
        );
      }
    }

    const grouped = new Map<
      number,
      typeof schedule
    >();

    for (const interval of schedule) {
      const intervals = grouped.get(interval.dayOfWeek) ?? [];
      intervals.push(interval);
      grouped.set(interval.dayOfWeek, intervals);
    }

    for (const intervals of grouped.values()) {
      intervals.sort((a, b) => a.startMinute - b.startMinute);

      for (let i = 1; i < intervals.length; i++) {
        if (
          intervals[i].startMinute <
          intervals[i - 1].endMinute
        ) {
          throw new BadRequestException(
            'Working intervals on the same day cannot overlap',
          );
        }
      }
    }

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

  async getWeeklySchedule(doctorId: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

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

  async getAvailableSlots(doctorId: string, date: string) {
    // 1. Validate the calendar date and build its local day boundaries.
    const requestedDate = new Date(`${date}T00:00:00`);

    if (
        Number.isNaN(requestedDate.getTime()) ||
        requestedDate.getFullYear() !== Number(date.slice(0, 4)) ||
        requestedDate.getMonth() + 1 !== Number(date.slice(5, 7)) ||
        requestedDate.getDate() !== Number(date.slice(8, 10))
    ) {
        throw new BadRequestException('Invalid calendar date');
    }

    const startOfDay = new Date(requestedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(requestedDate);
    endOfDay.setDate(endOfDay.getDate() + 1);
    endOfDay.setHours(0, 0, 0, 0);

    // 2. Do not offer appointments for a past date.
    const now = new Date();

    if (startOfDay < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        throw new BadRequestException('Cannot retrieve slots for a past date');
    }

    // 3. Find the doctor and their working intervals for this weekday.
    const doctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
        select: {
        id: true,
        user: {
            select: {
            isActive: true,
            },
        },
        },
    });

    if (!doctor) {
        throw new NotFoundException('Doctor not found');
    }

    if (!doctor.user.isActive) {
        throw new BadRequestException('Doctor is inactive');
    }

    const dayOfWeek = requestedDate.getDay();

    const intervals = await this.prisma.doctorAvailability.findMany({
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

    // 4. Load appointments scheduled during this calendar day.
    // These status strings must match your Prisma schema exactly.
    const appointments = await this.prisma.appointment.findMany({
        where: {
        doctorId,
        scheduledAt: {
            gte: startOfDay,
            lt: endOfDay,
        },
        status: {
            in: ['PENDING','SCHEDULED', 'CONFIRMED','CHECKED_IN', 'IN_PROGRESS'],
        },
        },
        select: {
        scheduledAt: true,
        durationMinutes: true,
        },
    });

    // 5. Generate each slot and check whether it overlaps an appointment.
    const slots: Array<{
        startTime: string;
        endTime: string;
        available: boolean;
    }> = [];

    for (const interval of intervals) {
        for (
        let minute = interval.startMinute;
        minute + interval.slotDurationMinutes <= interval.endMinute;
        minute += interval.slotDurationMinutes
        ) {
        const slotStart = new Date(requestedDate);
        slotStart.setHours(0, 0, 0, 0);
        slotStart.setMinutes(minute);

        const slotEnd = new Date(
            slotStart.getTime() + interval.slotDurationMinutes * 60_000,
        );

        // Ignore slots that have already started.
        if (slotStart <= now) {
            continue;
        }

        const isBooked = appointments.some((appointment) => {
            const appointmentStart = appointment.scheduledAt;
            const appointmentEnd = new Date(
            appointmentStart.getTime() +
                appointment.durationMinutes * 60_000,
            );

            // Two intervals overlap if each starts before the other ends.
            return (
            slotStart < appointmentEnd &&
            slotEnd > appointmentStart
            );
        });

        slots.push({
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
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