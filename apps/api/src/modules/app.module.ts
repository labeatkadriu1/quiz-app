import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { RbacModule } from './rbac/rbac.module';
import { PrismaModule } from './prisma/prisma.module';
import { ClassesModule } from './classes/classes.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { AttemptsModule } from './attempts/attempts.module';
import { InvitationsModule } from './invitations/invitations.module';
import { EmailModule } from './email/email.module';
import { SuperadminModule } from './superadmin/superadmin.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    RbacModule,
    ClassesModule,
    QuizzesModule,
    AttemptsModule,
    InvitationsModule,
    EmailModule,
    SuperadminModule
  ]
})
export class AppModule {}
