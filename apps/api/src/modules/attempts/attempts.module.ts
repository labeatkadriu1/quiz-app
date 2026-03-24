import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingGuard } from '../billing/billing.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AttemptsController],
  providers: [AttemptsService, BillingGuard]
})
export class AttemptsModule {}
