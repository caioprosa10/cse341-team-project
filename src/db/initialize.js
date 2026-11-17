import trips from './seeds/trips.json' with { type: 'json' };
import schedules from './seeds/schedules.json' with { type: 'json' };
import stations from './seeds/stations.json' with { type: 'json' };
import ticketClasses from './seeds/ticket-classes.json' with { type: 'json' };
import trains from './seeds/trains.json' with { type: 'json' };
import roles from './seeds/roles.json' with { type: 'json' };

const starterCollections = [
  ['trips', trips],
  ['schedules', schedules],
  ['stations', stations],
  ['ticketClasses', ticketClasses],
  ['trains', trains]
];

const initializeDatabase = async (db) => {
  if (!db) {
    throw new Error('A database connection is required to initialize data.');
  }

  for (const [collectionName, documents] of starterCollections) {
    const collection = db.collection(collectionName);
    await collection.deleteMany({});
    await collection.insertMany(documents);
  }

  // Bookings are created by the application, so the collection starts empty.
  // It was named 'confirmations' before the Week 03 refactor.
  const bookings = db.collection('bookings');
  await bookings.deleteMany({});
  await bookings.createIndex({ id: 1 }, { unique: true });

  /*
   * Roles are upserted by name rather than replaced. Users reference a role
   * by its _id, so deleting and reinserting the roles would hand out new ids
   * and break the role of every account already in the database. Accounts
   * themselves are never touched here: registering must survive a re-import.
   */
  const rolesCollection = db.collection('roles');
  await rolesCollection.createIndex({ name: 1 }, { unique: true });

  for (const role of roles) {
    await rolesCollection.updateOne(
      { name: role.name },
      { $setOnInsert: role },
      { upsert: true }
    );
  }
};

export { initializeDatabase, starterCollections };
