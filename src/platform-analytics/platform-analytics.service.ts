import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

interface TrendRow {
  date: Date;
  count: bigint | number;
}

@Injectable()
export class PlatformAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(startDate?: string, endDate?: string) {
    const { start, end, startLabel, endLabel } =
      this.getDateRange(startDate, endDate);

    const [
      totalHospitals,
      hospitalsByStatus,
      totalUsers,
      usersByRole,
      totalAppointments,
      appointmentsByStatus,
      totalDepartments,
      activeDepartments,
      inactiveDepartments,
      totalPatients,
      totalDoctors,
      topHospitals,
      hospitalTrends,
      userTrends,
      appointmentTrends,
    ] = await Promise.all([
      this.prisma.hospital.count(),

      this.prisma.hospital.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),

      this.prisma.user.count(),

      this.prisma.user.groupBy({
        by: ['role'],
        _count: { _all: true },
      }),

      this.prisma.appointment.count(),

      this.prisma.appointment.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),

      this.prisma.department.count(),

      this.prisma.department.count({
        where: { isActive: true },
      }),

      this.prisma.department.count({
        where: { isActive: false },
      }),

      this.prisma.patient.count(),

      this.prisma.doctor.count(),

      this.prisma.hospital.findMany({
        take: 5,
        orderBy: {
          appointments: {
            _count: 'desc',
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          _count: {
            select: {
              appointments: true,
              patients: true,
              users: true,
              departments: true,
            },
          },
        },
      }),

      this.getDailyTrends('Hospital', start, end),

      this.getDailyTrends('User', start, end),

      this.getDailyTrends('Appointment', start, end),
    ]);

    const hospitalStatusCounts = {
      PENDING: 0,
      VERIFIED: 0,
      SUSPENDED: 0,
      REJECTED: 0,
    };

    for (const item of hospitalsByStatus) {
      hospitalStatusCounts[item.status] = item._count._all;
    }

    const userRoleCounts = {
      SUPER_ADMIN: 0,
      HOSPITAL_ADMIN: 0,
      DOCTOR: 0,
      NURSE: 0,
      RECEPTIONIST: 0,
      LAB_TECHNICIAN: 0,
      PHARMACIST: 0,
      ACCOUNTANT: 0,
      PATIENT: 0,
    };

    for (const item of usersByRole) {
      userRoleCounts[item.role] = item._count._all;
    }

    const appointmentStatusCounts = {
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

    return {
      hospitals: {
        total: totalHospitals,
        byStatus: hospitalStatusCounts,
      },

      users: {
        total: totalUsers,
        byRole: userRoleCounts,
        patients: totalPatients,
        doctors: totalDoctors,
        hospitalAdmins: userRoleCounts.HOSPITAL_ADMIN,
      },

      appointments: {
        total: totalAppointments,
        byStatus: appointmentStatusCounts,
      },

      departments: {
        total: totalDepartments,
        active: activeDepartments,
        inactive: inactiveDepartments,
      },

      topHospitals: topHospitals.map((hospital) => ({
        id: hospital.id,
        name: hospital.name,
        slug: hospital.slug,
        status: hospital.status,
        totalAppointments: hospital._count.appointments,
        totalPatients: hospital._count.patients,
        totalUsers: hospital._count.users,
        totalDepartments: hospital._count.departments,
      })),

      trends: {
        startDate: startLabel,
        endDate: endLabel,
        hospitals: hospitalTrends,
        users: userTrends,
        appointments: appointmentTrends,
      },
    };
  }

  /**
   * Returns one count per calendar day, including days with zero records.
   */
  private async getDailyTrends(
    tableName: 'Hospital' | 'User' | 'Appointment',
    start: Date,
    end: Date,
  ) {
    // tableName is restricted to these three hard-coded identifiers.
    const query =
      tableName === 'Hospital'
        ? this.prisma.$queryRaw<TrendRow[]>`
            SELECT
              days.day AS date,
              COUNT(records."createdAt")::int AS count
            FROM generate_series(
              ${start}::date,
              ${end}::date,
              INTERVAL '1 day'
            ) AS days(day)
            LEFT JOIN "Hospital" records
              ON records."createdAt" >= days.day
             AND records."createdAt" < days.day + INTERVAL '1 day'
            GROUP BY days.day
            ORDER BY days.day
          `
        : tableName === 'User'
          ? this.prisma.$queryRaw<TrendRow[]>`
              SELECT
                days.day AS date,
                COUNT(records."createdAt")::int AS count
              FROM generate_series(
                ${start}::date,
                ${end}::date,
                INTERVAL '1 day'
              ) AS days(day)
              LEFT JOIN "User" records
                ON records."createdAt" >= days.day
               AND records."createdAt" < days.day + INTERVAL '1 day'
              GROUP BY days.day
              ORDER BY days.day
            `
          : this.prisma.$queryRaw<TrendRow[]>`
              SELECT
                days.day AS date,
                COUNT(records."createdAt")::int AS count
              FROM generate_series(
                ${start}::date,
                ${end}::date,
                INTERVAL '1 day'
              ) AS days(day)
              LEFT JOIN "Appointment" records
                ON records."createdAt" >= days.day
               AND records."createdAt" < days.day + INTERVAL '1 day'
              GROUP BY days.day
              ORDER BY days.day
            `;

    return query.then((rows) =>
      rows.map((row) => ({
        date: new Date(row.date).toISOString().slice(0, 10),
        count: Number(row.count),
      })),
    );
  }

  private getDateRange(startDate?: string, endDate?: string) {
    const today = new Date();
    const defaultEnd = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const defaultStart = new Date(defaultEnd);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);

    const startLabel = startDate ?? this.toDateString(defaultStart);
    const endLabel = endDate ?? this.toDateString(defaultEnd);

    const start = this.parseDate(startLabel);
    const end = this.parseDate(endLabel);

    if (start > end) {
      throw new BadRequestException(
        'startDate must be earlier than or equal to endDate',
      );
    }

    const days =
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;

    if (days > 366) {
      throw new BadRequestException(
        'Date range cannot exceed 366 days',
      );
    }

    return { start, end, startLabel, endLabel };
  }

  private parseDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Dates must use YYYY-MM-DD format');
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
      Number.isNaN(date.getTime()) ||
      this.toDateString(date) !== value
    ) {
      throw new BadRequestException(`Invalid date: ${value}`);
    }

    return date;
  }

  private toDateString(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}