import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingGuard } from '../billing/billing.guard';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';

@Module({
  imports: [AuthModule, EmailModule, PrismaModule],
  controllers: [QuizzesController],
  providers: [QuizzesService, BillingGuard]
})
export class QuizzesModule {}
