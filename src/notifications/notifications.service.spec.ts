import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const prisma = {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('returns only the current user notifications and unread count', async () => {
    const notifications = [{ id: 'notification-1', title: 'Appointment confirmed' }];
    prisma.notification.findMany.mockResolvedValue(notifications);
    prisma.notification.count.mockResolvedValue(2);

    const result = await service.findForUser('user-1', {
      limit: 20,
      unreadOnly: false,
    });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        take: 20,
      }),
    );
    expect(result).toEqual({ notifications, unreadCount: 2 });
  });

  it('does not allow a user to mark another user notification as read', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(
      service.markAsRead('user-1', 'notification-owned-by-someone-else'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('marks all unread notifications for the current user only', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.markAllAsRead('user-1');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', readAt: null },
      }),
    );
    expect(result).toEqual({ updatedCount: 3 });
  });
});
