import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  UseGuards, 
  Req,
  Put,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactFileDto } from './dto/contact-file.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@Controller('api/contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  create(@Body() createContactDto: CreateContactDto, @Req() req) {
    return this.contactsService.create(createContactDto, req.user);
  }

  @Get()
  findAll(@Req() req) {
    return this.contactsService.findAll(req.user.id);
  }
  

  @Get('files')
  async getFiles(@Req() req) {
    try {
      const files = await this.contactsService.getUniqueFiles(req.user.id);
      return files;
    } catch (error) {
      console.error('Error in getFiles controller:', error);
      throw error;
    }
  }

  @Get('file/:filename')
  getContactsByFile(@Param('filename') filename: string, @Req() req) {
    return this.contactsService.getContactsByFile(req.user.id, filename);
  }

  @Delete('file/:filename')
  removeContactsByFile(@Param('filename') filename: string, @Req() req) {
    return this.contactsService.removeContactsByFile(req.user.id, filename);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contactsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateContactDto: UpdateContactDto,
  ) {
    return this.contactsService.update(id, updateContactDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.contactsService.remove(id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + '-' + file.originalname);
      },
    }),
    fileFilter: (req, file, cb) => {
      // Accept all file types
      console.log(`Received file: ${file.originalname}, type: ${file.mimetype}`);
      cb(null, true);
    },
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    }
  }))
  async uploadFile(@UploadedFile() file: any, @Req() req) {
    try {
      if (!file) {
        console.log('No file received in upload');
        throw new BadRequestException('No file uploaded or file is invalid');
      }
      
      console.log(`File uploaded: ${file.originalname}, size: ${file.size} bytes, saved as: ${file.filename}`);
      console.log(`File path: ${file.path}`);
      
      // Check if user is available in the request
      if (!req.user) {
        console.warn('Warning: User not found in request during file upload. Authentication may not be working properly.');
        throw new BadRequestException('User authentication required for file upload');
      }
      
      const result = await this.contactsService.processContactsFile(
        file.path,
        file.filename,
        req.user,
      );
      
      console.log(`File processing complete: ${result.total} total, ${result.unique} unique contacts`);
      
      return {
        filename: file.filename,
        originalname: file.originalname,
        ...result
      };
    } catch (error) {
      console.error('Error in upload:', error);
      console.error('Error stack:', error.stack);
      
      // Clean up the file if there was an error
      if (file && file.path) {
        try {
          fs.unlinkSync(file.path);
          console.log(`Cleaned up file: ${file.path}`);
        } catch (e) {
          console.error('Error cleaning up file:', e.message);
        }
      }
      
      // Return a more informative error response
      if (error.name === 'TypeORMError' || error.message?.includes('database') || error.message?.includes('update query') || error.message?.includes('qb.set')) {
        throw new BadRequestException(`Database error: ${error.message}. Please check your data format.`);
      } else if (error.message?.includes('XLSX') || error.message?.includes('Excel')) {
        throw new BadRequestException('File format error: Could not process the Excel file. Please check the file format.');
      } else {
        throw new BadRequestException(`Error processing file: ${error.message || 'Unknown error'}`);
      }
    }
  }
}
