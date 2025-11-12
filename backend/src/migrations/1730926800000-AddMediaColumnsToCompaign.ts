import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaColumnsToCompaign1730926800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add media_type column if it doesn't exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'campaigns' AND column_name = 'media_type'
        ) THEN
          ALTER TABLE campaigns ADD COLUMN media_type VARCHAR(50);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'campaigns' AND column_name = 'media_name'
        ) THEN
          ALTER TABLE campaigns ADD COLUMN media_name VARCHAR(255);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the columns if they exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'campaigns' AND column_name = 'media_type'
        ) THEN
          ALTER TABLE campaigns DROP COLUMN media_type;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'campaigns' AND column_name = 'media_name'
        ) THEN
          ALTER TABLE campaigns DROP COLUMN media_name;
        END IF;
      END $$;
    `);
  }
}
