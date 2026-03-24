import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingGuard } from '../billing/billing.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, BillingGuard]
})
export class InvitationsModule {}
