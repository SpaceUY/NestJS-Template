import { Module } from '@nestjs/common';
import { S3AdapterService } from './s3-adapter.service';

@Module({
  imports: [],
  providers: [S3AdapterService],
  exports: [],
  controllers: [],
})
export class S3AdapterModule {}
