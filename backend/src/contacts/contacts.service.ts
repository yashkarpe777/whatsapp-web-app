import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { User } from '../auth/entities/user.entity';
import * as fs from 'fs';
import * as path from 'path';

const csv = require('csv-parser');

import * as XLSX from 'xlsx';

const PHONE_HEADER_KEYWORDS = [
  'phone',
  'number',
  'mobile',
  'contact',
  'tel',
  'telephone',
  'cell',
  'whatsapp',
];

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private contactRepo: Repository<Contact>,
  ) { }

  async create(dto: CreateContactDto, user: User) {
    const contact = this.contactRepo.create({ ...dto, user });
    return this.contactRepo.save(contact);
  }

  async findAll(userId: number) {
    if (!userId) {
      throw new Error('User ID is required to get contacts');
    }
    
    return this.contactRepo.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' }
    });
  }
  

  async findOne(id: number) {
    const contact = await this.contactRepo.findOne({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(id: number, dto: UpdateContactDto) {
    await this.contactRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    const contact = await this.findOne(id);
    await this.contactRepo.remove(contact);
    return { id };
  }

  async getContactsByFile(userId: number, filename: string) {
    if (!userId) {
      throw new Error('User ID is required to get contacts by file');
    }
    
    return this.contactRepo.find({
      where: {
        user: { id: userId },
        source_file: filename
      },
      order: {
        created_at: 'DESC'
      }
    });
  }

  async removeContactsByFile(userId: number, filename: string) {
    try {
      if (!userId) {
        throw new Error('User ID is required to delete contacts by file');
      }
      
      // First, count how many contacts will be deleted
      const count = await this.contactRepo.count({
        where: {
          user: { id: userId },
          source_file: filename
        }
      });
      
      // Use a more efficient delete query instead of loading all entities
      const result = await this.contactRepo.delete({
        user: { id: userId },
        source_file: filename
      });
      
      return { 
        success: true, 
        count: count,
        message: `Successfully deleted ${count} contacts from ${filename}`
      };
    } catch (error) {
      console.error(`Error deleting contacts from file ${filename}:`, error);
      throw new Error(`Failed to delete contacts from file ${filename}: ${error.message}`);
    }
  }

  async getUniqueFiles(userId: number) {
    try {
      if (!userId) {
        throw new Error('User ID is required to get files');
      }
      
      // Get files with counts using direct SQL
      const query = `
        SELECT source_file as filename, COUNT(*) as count
        FROM contacts
        WHERE user_id = $1 AND source_file IS NOT NULL
        GROUP BY source_file
      `;
      
      const result = await this.contactRepo.query(query, [userId]);
      
      // Format the result
      return result.map(f => ({
        filename: f.filename,
        count: parseInt(f.count, 10) || 0
      }));
    } catch (error) {
      console.error('Error getting unique files:', error);
      throw new Error(`Failed to get contact files: ${error.message}`);
    }
  }


  async getContactCountByFile(userId: number, filename: string) {
    return this.contactRepo.count({
      where: {
        user: { id: userId },
        source_file: filename
      }
    });
  }

  async processContactsFile(filePath: string, filename: string, user: User) {
    const results = [];
    const phoneNumbers = new Set();
    const fileExt = filename.split('.').pop()?.toLowerCase();

    // Handle missing user
    if (!user || !user.id) {
      console.warn('Warning: User is undefined or missing ID in processContactsFile.');
      throw new Error('User ID is required to process contacts file');
    }

    if (!fileExt || !['csv', 'txt', 'xls', 'xlsx'].includes(fileExt)) {
      throw new Error(`Unsupported file type: ${fileExt || 'unknown'}. Please upload CSV, TXT, XLS, or XLSX files.`);
    }

    if (['xls', 'xlsx'].includes(fileExt)) {
      return this.processExcelFile(filePath, filename, user);
    } else {
      return this.processCsvFile(filePath, filename, user);
    }
  }

  private async processExcelFile(filePath: string, filename: string, user: User): Promise<{ total: number; unique: number }> {
    const uniquePhones = new Set<string>();

    try {
      console.log(`Processing Excel file: ${filename}`);

      const workbook = XLSX.readFile(filePath, { type: 'file', cellText: true, cellDates: true });
      console.log(`Workbook sheets: ${workbook.SheetNames.join(', ')}`);

      for (const sheetName of workbook.SheetNames) {
        console.log(`Processing sheet: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
        console.log(`Sheet data (object format): ${jsonData.length} rows`);

        if (jsonData.length > 0) {
          console.log('Processing data in object format');
          for (const row of jsonData) {
            const phone = this.extractPhoneFromObjectRow(row);
            if (phone) {
              uniquePhones.add(phone);
            }
          }
          continue;
        }

        const arrayData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' }) as any[][];
        console.log(`Sheet data (array format): ${arrayData.length} rows`);

        if (arrayData.length > 1) {
          console.log('Processing data in array format');
          for (let i = 1; i < arrayData.length; i++) {
            const row = arrayData[i];
            const phone = this.extractPhoneFromArrayRow(row);
            if (phone) {
              uniquePhones.add(phone);
            }
          }
        }
      }

      if (uniquePhones.size === 0 && workbook.SheetNames.length > 0) {
        console.log('Trying direct cell access method');
        const firstSheet = workbook.SheetNames[0];
        const firstWorksheet = workbook.Sheets[firstSheet];
        const range = XLSX.utils.decode_range(firstWorksheet['!ref'] || 'A1');

        for (let row = range.s.r; row <= range.e.r; row++) {
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = firstWorksheet[cellAddress];
            if (cell && cell.v) {
              const phone = this.normalizePhone(cell.v);
              if (phone) {
                uniquePhones.add(phone);
              }
            }
          }
        }
      }

      const phonesFound = Array.from(uniquePhones);
      const newPhones = await this.excludeExistingPhones(phonesFound, user.id);

      if (newPhones.length > 0) {
        console.log(`Saving ${newPhones.length} contacts to database`);
        const entities = newPhones.map((phone) =>
          this.contactRepo.create({
            phone,
            source_file: filename,
            user: { id: user.id },
          }),
        );

        try {
          const batchSize = 100;
          for (let i = 0; i < entities.length; i += batchSize) {
            const batch = entities.slice(i, i + batchSize);
            console.log(`Inserting batch ${i / batchSize + 1} of ${Math.ceil(entities.length / batchSize)}`);
            await this.contactRepo.insert(batch);
          }
          console.log('All contacts saved successfully');
        } catch (error) {
          console.error('Error saving contacts:', error);
          throw new Error(`Database error: ${error.message}`);
        }
      } else {
        console.log('No new contacts found to save after deduplication');
      }

      console.log(`Excel processing complete: ${phonesFound.length} total unique in file, ${newPhones.length} newly stored`);
      return {
        total: phonesFound.length,
        unique: newPhones.length,
      };
    } catch (error) {
      console.error('Error processing Excel file:', error);
      throw error;
    }
  }

  private async processCsvFile(filePath: string, filename: string, user: User): Promise<{ total: number; unique: number }> {
    const uniquePhones = new Set<string>();

    return new Promise<{ total: number; unique: number }>((resolve, reject) => {
      try {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            const phone = this.extractPhoneFromObjectRow(data);
            if (phone) {
              uniquePhones.add(phone);
            }
          })
          .on('end', async () => {
            try {
              const phonesFound = Array.from(uniquePhones);
              const newPhones = await this.excludeExistingPhones(phonesFound, user.id);

              if (newPhones.length > 0) {
                console.log(`Saving ${newPhones.length} contacts to database`);
                const entities = newPhones.map((phone) =>
                  this.contactRepo.create({
                    phone,
                    source_file: filename,
                    user: { id: user.id },
                  }),
                );

                const batchSize = 100;
                for (let i = 0; i < entities.length; i += batchSize) {
                  const batch = entities.slice(i, i + batchSize);
                  console.log(`Inserting batch ${i / batchSize + 1} of ${Math.ceil(entities.length / batchSize)}`);
                  await this.contactRepo.insert(batch);
                }
                console.log('All contacts saved successfully');
              } else {
                console.log('No new contacts found to save after deduplication');
              }

              resolve({
                total: phonesFound.length,
                unique: newPhones.length,
              });
            } catch (error) {
              reject(error);
            }
          })
          .on('error', (error) => {
            reject(error);
          });
      } catch (error) {
        reject(error);
      }
    });
  }

  private extractPhoneFromObjectRow(row: Record<string, any>): string | null {
    if (!row || typeof row !== 'object') {
      return null;
    }

    const keys = Object.keys(row);
    const prioritized = keys.filter((key) => this.isPhoneHeader(key));
    const orderedKeys = [...new Set([...prioritized, ...keys])];

    for (const key of orderedKeys) {
      const phone = this.normalizePhone(row[key]);
      if (phone) {
        return phone;
      }
    }

    for (const value of Object.values(row)) {
      const phone = this.normalizePhone(value);
      if (phone) {
        return phone;
      }
    }

    return null;
  }

  private extractPhoneFromArrayRow(row: any[]): string | null {
    if (!Array.isArray(row)) {
      return null;
    }

    for (const cell of row) {
      const phone = this.normalizePhone(cell);
      if (phone) {
        return phone;
      }
    }

    return null;
  }

  private isPhoneHeader(header: string): boolean {
    const normalized = String(header || '').toLowerCase();
    return PHONE_HEADER_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }

  private normalizePhone(value: any): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const raw = String(value).trim();
    if (!raw) {
      return null;
    }

    const cleaned = raw.replace(/[^+\d]/g, '');
    if (!cleaned) {
      return null;
    }

    if (!/^\+?\d{6,15}$/.test(cleaned)) {
      return null;
    }

    if (cleaned.startsWith('00')) {
      return `+${cleaned.slice(2)}`;
    }

    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    return cleaned;
  }

  private async excludeExistingPhones(phones: string[], userId: number): Promise<string[]> {
    if (!phones.length) {
      return [];
    }

    const chunkSize = 500;
    const existing = new Set<string>();

    for (let i = 0; i < phones.length; i += chunkSize) {
      const chunk = phones.slice(i, i + chunkSize);
      const found = await this.contactRepo.find({
        select: ['phone'],
        where: {
          user: { id: userId },
          phone: In(chunk),
        },
      });

      found.forEach((contact) => existing.add(contact.phone));
    }

    return phones.filter((phone) => !existing.has(phone));
  }
}
