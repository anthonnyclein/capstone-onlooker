import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeState } from './csvStore';
import { dbRepository } from './dbRepository';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function migrateFromCsvIfNeeded(): Promise<void> {
  const userCount = await dbRepository.getUserCount();
  const offices = await dbRepository.getAllOffices();

  if (userCount === 0 && offices.length === 0) {
    const csvPath = path.join(root, 'data', 'capstone.csv');
    try {
      const exists = await fs.access(csvPath).then(() => true).catch(() => false);
      if (!exists) {
        console.log('[PostgreSQL Migration] No capstone.csv file found to seed.');
        return;
      }

      console.log('[PostgreSQL Migration] PostgreSQL tables are empty. Seeding initial data from capstone.csv...');
      const text = await fs.readFile(csvPath, 'utf8');
      const state = decodeState(text);

      const dataset = {
        offices: state.values['cpms_offices_v1'] || [],
        groups: state.values['cpms_groups_v1'] || [],
        deliverables: state.values['cpms_deliverables_v1'] || [],
        tasks: state.values['cpms_tasks_v1'] || [],
        submissions: state.values['cpms_submissions_v1'] || [],
        accounts: state.values['cpms_accounts_v1'] || [],
        defenseAttempts: state.values['cpms_defense_attempts_v2'] || [],
      };

      await dbRepository.saveFullDataset(dataset, 0);

      if (state.files && typeof state.files === 'object') {
        for (const [key, file] of Object.entries(state.files)) {
          if (file && typeof file === 'object' && (file as any).dataUrl && (file as any).fileName) {
            await dbRepository.saveStoredFile(key, (file as any).dataUrl, (file as any).fileName);
          }
        }
      }

      console.log('[PostgreSQL Migration] Successfully migrated initial data into PostgreSQL in 3NF normalized tables.');
    } catch (err) {
      console.error('[PostgreSQL Migration] Failed to seed initial data from CSV:', err);
    }
  } else {
    console.log(`[PostgreSQL] Database already populated (${userCount} users, ${offices.length} offices).`);
  }
}

