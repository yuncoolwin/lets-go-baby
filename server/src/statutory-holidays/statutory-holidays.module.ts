import { Module } from '@nestjs/common'
import { StatutoryHolidaysController } from './statutory-holidays.controller'
import { StatutoryHolidaysService } from './statutory-holidays.service'

@Module({
  controllers: [StatutoryHolidaysController],
  providers: [StatutoryHolidaysService],
})
export class StatutoryHolidaysModule {}