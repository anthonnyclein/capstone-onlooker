import { pool } from '../server/db.js';

try {
  await pool.query('DELETE FROM group_task_submissions;');
  console.log('All group_task_submissions rows deleted.');
} catch (err) {
  console.error('Error deleting submissions:', err);
} finally {
  await pool.end();
  process.exit();
}
