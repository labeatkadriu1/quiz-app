import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SuperadminController } from './superadmin.controller';
import { SuperadminService } from './superadmin.service';

@Module({
  imports: [AuthModule],
  controllers: [SuperadminController],
  providers: [SuperadminService]
})
export class SuperadminModule {}
