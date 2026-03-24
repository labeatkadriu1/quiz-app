import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingGuard } from '../billing/billing.guard';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
  imports: [AuthModule, EmailModule, PrismaModule],
  controllers: [ClassesController],
  providers: [ClassesService, BillingGuard]
})
export class ClassesModule {}
