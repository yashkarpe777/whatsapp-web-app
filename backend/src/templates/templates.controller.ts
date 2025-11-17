import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TemplatePayloadValidationInput, TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateStatusDto } from './dto/update-template-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TemplateSyncService } from './template-sync.service';

@Controller('api/templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    private readonly templateSyncService: TemplateSyncService,
  ) {}

  @Post('create')
  @UseGuards(RolesGuard)
  @Roles('admin')
  createTemplate(@Body() dto: CreateTemplateDto, @Req() req) {
    return this.templatesService.createTemplate(dto, req.user);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  listTemplates() {
    return this.templatesService.listAll();
  }

  @Get('approved')
  listApprovedTemplates() {
    return this.templatesService.listApproved();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.templatesService.getById(id);
  }

  @Put('status/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTemplateStatusDto,
  ) {
    return this.templatesService.updateStatus(id, dto);
  }

  @Post('sync')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async syncTemplates() {
    return this.templateSyncService.syncTemplates('api');
  }

  @Post(':id/validate')
  @UseGuards(RolesGuard)
  @Roles('admin')
  validateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: TemplatePayloadValidationInput,
  ) {
    return this.templatesService.validateTemplatePayload(id, payload ?? {});
  }
}
