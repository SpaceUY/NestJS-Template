import { Module } from '@nestjs/common';
import { UserSyncService } from './user-sync.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { Auth0Module } from '../auth0/auth0.module';

@Module({
  imports: [PrismaModule, Auth0Module],
  providers: [UserSyncService],
  exports: [UserSyncService],
})
export class UserSyncModule {}
