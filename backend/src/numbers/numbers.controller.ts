import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { NumbersService } from './numbers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateVirtualNumberDto } from './dto/create-virtual-number.dto';
import { UpdateVirtualNumberDto } from './dto/update-virtual-number.dto';
import { UpdateBusinessNumberDto } from './dto/update-business-number.dto';
import { ManualSwitchDto } from './dto/manual-switch.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('api/admin')
export class NumbersController {
  constructor(private readonly numbersService: NumbersService) {}

  @Get('business-number')
  getBusinessNumber() {
    return this.numbersService.getBusinessNumber();
  }

  @Put('business-number')
  updateBusinessNumber(@Body() dto: UpdateBusinessNumberDto) {
    return this.numbersService.upsertBusinessNumber(dto);
  }

  @Get('virtual-numbers')
  listVirtualNumbers() {
    return this.numbersService.listVirtualNumbers();
  }

  @Post('virtual-numbers')
  createVirtualNumber(@Body() dto: CreateVirtualNumberDto) {
    return this.numbersService.createVirtualNumber(dto);
  }

  @Put('virtual-numbers/:id')
  updateVirtualNumber(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVirtualNumberDto,
  ) {
    return this.numbersService.updateVirtualNumber(id, dto);
  }

  @Put('virtual-numbers/switch')
  manualSwitch(@Body() dto: ManualSwitchDto) {
    return this.numbersService.manualSwitch(dto.targetId);
  }
}
