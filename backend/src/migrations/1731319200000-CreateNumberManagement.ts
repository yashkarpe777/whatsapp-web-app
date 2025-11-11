import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNumberManagement1731319200000 implements MigrationInterface {
  name = 'CreateNumberManagement1731319200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Business Numbers table
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'business_numbers'
        ) THEN
          CREATE TABLE business_numbers (
            id SERIAL PRIMARY KEY,
            business_name VARCHAR(128),
            waba_id VARCHAR(64) NOT NULL,
            phone_number_id VARCHAR(64) NOT NULL UNIQUE,
            display_phone_number VARCHAR(32),
            access_token TEXT NOT NULL,
            auto_switch_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );
        END IF;
      END $$;
    `);

    // Virtual number enums
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'virtual_number_status_enum') THEN
          CREATE TYPE virtual_number_status_enum AS ENUM ('active', 'restricted', 'throttled', 'banned', 'disconnected');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'virtual_number_quality_enum') THEN
          CREATE TYPE virtual_number_quality_enum AS ENUM ('high', 'medium', 'low', 'unknown');
        END IF;
      END $$;
    `);

    // Virtual Numbers table
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'virtual_numbers'
        ) THEN
          CREATE TABLE virtual_numbers (
            id SERIAL PRIMARY KEY,
            business_number_id INTEGER REFERENCES business_numbers(id) ON DELETE SET NULL,
            waba_id VARCHAR(64) NOT NULL,
            phone_number_id VARCHAR(64) NOT NULL UNIQUE,
            access_token TEXT NOT NULL,
            status virtual_number_status_enum NOT NULL DEFAULT 'active',
            quality_rating virtual_number_quality_enum NOT NULL DEFAULT 'unknown',
            is_primary BOOLEAN NOT NULL DEFAULT FALSE,
            message_count_24h INTEGER NOT NULL DEFAULT 0,
            last_used_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_virtual_numbers_is_primary ON virtual_numbers (is_primary);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS virtual_numbers`);
    await queryRunner.query(`DROP TABLE IF EXISTS business_numbers`);
    await queryRunner.query(`DROP TYPE IF EXISTS virtual_number_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS virtual_number_quality_enum`);
  }
}
