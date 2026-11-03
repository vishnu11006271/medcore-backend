
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { LaboratoryController } from './laboratory.controller.js';
import { LaboratoryService } from './laboratory.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [LaboratoryController],
  providers: [LaboratoryService],
  exports: [LaboratoryService],
})
export class LaboratoryModule {}
