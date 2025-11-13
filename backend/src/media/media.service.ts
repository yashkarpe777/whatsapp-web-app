import { Injectable, BadRequestException } from '@nestjs/common';
import * as path from 'path';

export interface StoredMedia {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  checksum?: string;
}

@Injectable()
export class MediaService {
  private readonly allowedMimePrefixes = ['image/', 'video/', 'audio/', 'application/', 'text/'];

  validateMimeType(mimeType: string) {
    if (!mimeType) {
      throw new BadRequestException('Unable to determine file type');
    }

    const isAllowed = this.allowedMimePrefixes.some((prefix) => mimeType.startsWith(prefix));
    if (!isAllowed) {
      throw new BadRequestException(`File type ${mimeType} is not supported`);
    }
  }

  buildPublicUrl(filename: string, requestOrigin: string) {
    const normalized = filename.replace(/\\/g, '/');
    return new URL(path.posix.join('media', normalized), requestOrigin).toString();
  }

  buildResponse({
    filename,
    originalname,
    mimetype,
    size,
    url,
  }: {
    filename: string;
    originalname: string;
    mimetype: string;
    size: number;
    url: string;
  }): StoredMedia {
    return {
      filename,
      originalName: originalname,
      mimeType: mimetype,
      size,
      url,
    };
  }
}
