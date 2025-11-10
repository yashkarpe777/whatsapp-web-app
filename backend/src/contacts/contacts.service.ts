import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { User } from '../auth/entities/user.entity';
import * as fs from 'fs';
import * as path from 'path';

const csv = require('csv-parser');

import * as XLSX from 'xlsx';

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

  private async processExcelFile(filePath: string, filename: string, user: User): Promise<{ total: number, unique: number }> {
    const results = [];
    const phoneNumbers = new Set();

    try {
      console.log(`Processing Excel file: ${filename}`);

      const workbook = XLSX.readFile(filePath, { type: 'file', cellText: true, cellDates: true });
      console.log(`Workbook sheets: ${workbook.SheetNames.join(', ')}`);

      // Process all sheets in the workbook
      for (const sheetName of workbook.SheetNames) {
        console.log(`Processing sheet: ${sheetName}`);

        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        console.log(`Sheet data (object format): ${jsonData.length} rows`);
        if (jsonData.length > 0) {
          console.log('Sample row (object):', jsonData[0]);
        }

        // Method 2: Use sheet_to_json with header:1 to get array format
        // Convert sheet to a 2D array safely
        const arrayData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: '' }) as string[][];

        console.log(`Sheet data (array format): ${arrayData.length} rows`);
        if (arrayData.length > 0) {
          console.log('Sample row (array):', arrayData[0]);
        }

        if (jsonData.length > 0) {
          console.log('Processing data in object format');
          for (const row of jsonData) {
            // Try to find phone number in any field
            const phoneKeys = Object.keys(row).filter(key =>
              ['phone', 'number', 'mobile', 'contact', 'tel', 'telephone', 'cell'].some(keyword =>
                String(key).toLowerCase().includes(keyword)
              )
            );

            let phone = null;

            // If we found phone keys, use the first one
            if (phoneKeys.length > 0) {
              phone = String(row[phoneKeys[0]]).trim();
              console.log(`Found phone in column '${phoneKeys[0]}': ${phone}`);
            } else {
              // Otherwise try the first column or a column named 'A'
              const firstKey = Object.keys(row)[0];
              if (firstKey) {
                phone = String(row[firstKey]).trim();
                console.log(`Using first column '${firstKey}': ${phone}`);
              }
            }

            // Add the phone if it's valid
            if (phone && !phoneNumbers.has(phone)) {
              phoneNumbers.add(phone);
              // Create a proper entity instance instead of a plain object
              const contact = this.contactRepo.create({
                phone: phone,
                source_file: filename,
                user: { id: user.id }
              });
              results.push(contact);
              console.log(`Added phone: ${phone}`);
            }
          }
        }
        else if (arrayData.length > 0) {
          console.log('Processing data in array format');

          const headers = arrayData[0].map(h => String(h || '').toLowerCase());

          let phoneColumnIndex = headers.findIndex(header =>
            ['phone', 'number', 'mobile', 'contact', 'tel', 'telephone', 'cell'].some(keyword =>
              String(header).toLowerCase().includes(keyword)
            )
          );

          // If no phone column found, use the first column
          if (phoneColumnIndex === -1) phoneColumnIndex = 0;
          console.log(`Using column index: ${phoneColumnIndex}`);

          // Process each row (skip header row)
          for (let i = 1; i < arrayData.length; i++) {
            const row = arrayData[i];
            if (row && row[phoneColumnIndex]) {
              const phone = String(row[phoneColumnIndex]).trim();

              if (phone && !phoneNumbers.has(phone)) {
                phoneNumbers.add(phone);
                // Create a proper entity instance instead of a plain object
                const contact = this.contactRepo.create({
                  phone: phone,
                  source_file: filename,
                  user: { id: user.id }
                });
                results.push(contact);
                console.log(`Added phone from row ${i}: ${phone}`);
              }
            }
          }
        }
      }

      // If still no results, try a direct cell-by-cell approach as a last resort
      if (results.length === 0 && workbook.SheetNames.length > 0) {
        console.log('Trying direct cell access method');

        // Get the first worksheet again
        const firstSheet = workbook.SheetNames[0];
        const firstWorksheet = workbook.Sheets[firstSheet];

        // Get the range of the sheet
        const range = XLSX.utils.decode_range(firstWorksheet['!ref'] || 'A1');

        // Loop through all cells in the first column
        for (let row = range.s.r; row <= range.e.r; row++) {
          // Try first column (A)
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
          const cell = firstWorksheet[cellAddress];

          if (cell && cell.v) {
            const phone = String(cell.v).trim();

            if (phone && !phoneNumbers.has(phone)) {
              phoneNumbers.add(phone);
              // Create a proper entity instance instead of a plain object
              const contact = this.contactRepo.create({
                phone: phone,
                source_file: filename,
                user: { id: user.id }
              });
              results.push(contact);
              console.log(`Added phone from cell ${cellAddress}: ${phone}`);
            }
          }
        }
      }

      // Save the results to the database
      if (results.length > 0) {
        console.log(`Saving ${results.length} contacts to database`);
        try {
          // Use insert instead of save for better performance with new entities
          const batchSize = 100;
          for (let i = 0; i < results.length; i += batchSize) {
            const batch = results.slice(i, i + batchSize);
            console.log(`Inserting batch ${i/batchSize + 1} of ${Math.ceil(results.length/batchSize)}`);
            await this.contactRepo.insert(batch);
          }
          console.log('All contacts saved successfully');
        } catch (error) {
          console.error('Error saving contacts:', error);
          throw new Error(`Database error: ${error.message}`);
        }
      } else {
        console.log('No contacts found to save');
      }

      console.log(`Excel processing complete: ${results.length} total, ${phoneNumbers.size} unique`);
      return {
        total: results.length,
        unique: phoneNumbers.size
      };
    } catch (error) {
      console.error('Error processing Excel file:', error);
      throw error;
    }
  }

  private async processCsvFile(filePath: string, filename: string, user: User): Promise<{ total: number, unique: number }> {
    const results = [];
    const phoneNumbers = new Set();

    return new Promise<{ total: number, unique: number }>((resolve, reject) => {
      try {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            // Try to find a column that contains phone numbers
            const phoneKey = Object.keys(data).find(key =>
              ['phone', 'phone_number', 'number', 'mobile', 'contact', 'tel', 'telephone', 'cell'].some(variant =>
                key.toLowerCase().includes(variant)
              )
            );

            // If we found a phone column, process the data
            if (phoneKey && data[phoneKey]) {
              const phone = data[phoneKey].toString().trim();
              if (phone && !phoneNumbers.has(phone)) {
                phoneNumbers.add(phone);
                // Create a proper entity instance instead of a plain object
                const contact = this.contactRepo.create({
                  phone: phone,
                  source_file: filename,
                  user: { id: user.id }
                });
                results.push(contact);
              }
            } else {
              // If no phone column found, try the first column
              const firstKey = Object.keys(data)[0];
              if (firstKey && data[firstKey]) {
                const phone = data[firstKey].toString().trim();
                if (phone && !phoneNumbers.has(phone) && /^[+\d\s()-]+$/.test(phone)) { // Basic phone format check
                  phoneNumbers.add(phone);
                  // Create a proper entity instance instead of a plain object
                  const contact = this.contactRepo.create({
                    phone: phone,
                    source_file: filename,
                    user: { id: user.id }
                  });
                  results.push(contact);
                }
              }
            }
          })
          .on('end', async () => {
            try {
              if (results.length > 0) {
                console.log(`Saving ${results.length} contacts to database`);
                // Use insert instead of save for better performance with new entities
                const batchSize = 100;
                for (let i = 0; i < results.length; i += batchSize) {
                  const batch = results.slice(i, i + batchSize);
                  console.log(`Inserting batch ${i/batchSize + 1} of ${Math.ceil(results.length/batchSize)}`);
                  await this.contactRepo.insert(batch);
                }
                console.log('All contacts saved successfully');
              }
              resolve({
                total: results.length,
                unique: phoneNumbers.size
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
}
