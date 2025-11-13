import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { Request } from 'express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

function ensureDirectoryExists(targetPath: string) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

@Controller('api/media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'media');

  constructor(private readonly mediaService: MediaService) {
    ensureDirectoryExists(this.uploadsDir);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dest = path.join(process.cwd(), 'uploads', 'media');
          ensureDirectoryExists(dest);
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const sanitizedOriginal = file.originalname.replace(/\s+/g, '_');
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}-${sanitizedOriginal}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for now
      },
    }),
  )
  async uploadMedia(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      this.mediaService.validateMimeType(file.mimetype);

      const origin = `${req.protocol}://${req.get('host')}`;
      const publicUrl = this.mediaService.buildPublicUrl(file.filename, origin);

      return this.mediaService.buildResponse({
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: publicUrl,
      });
    } catch (error) {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }
}
