/*
 * Promotes an existing account to the admin role.
 *
 *   npm run make-admin -- someone@example.com
 *
 * Public registration always creates a customer, on purpose, so the first
 * administrator has to be made deliberately from the command line rather
 * than by anything a visitor can reach.
 */
import { closeDb, connectToDb } from './connect.js';
import role from '../models/schemas/roles.js';
import user from '../models/schemas/users.js';

const email = String(process.argv[2] || '').toLowerCase().trim();

if (!email) {
  console.error('Usage: npm run make-admin -- someone@example.com');
  process.exit(1);
}

try {
  await connectToDb();

  const adminRole = await role.findOne({ name: 'admin' }).lean();

  if (!adminRole) {
    console.error('The admin role is missing. Run "npm run db:import" first.');
    process.exit(1);
  }

  const updated = await user
    .findOneAndUpdate({ email }, { role: adminRole._id }, { new: true })
    .populate('role')
    .lean();

  if (!updated) {
    console.error(`No account found for ${email}.`);
    process.exit(1);
  }

  console.log(`${updated.email} now has the ${updated.role.name} role.`);
} finally {
  await closeDb();
}
