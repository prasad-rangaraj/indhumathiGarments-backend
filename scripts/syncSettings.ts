import { AppDataSource } from '../src/lib/db.js';
import { Settings } from '../src/entities/Settings.js';
import dotenv from 'dotenv';
dotenv.config();

async function sync() {
  try {
    await AppDataSource.initialize();
    const settingsRepo = AppDataSource.getRepository(Settings);

    const updates = [
      { key: 'email', value: 'indhumathi.img@gmail.com' },
      { key: 'phone', value: '+91 87546 09226' },
      { key: 'address', value: 'Teachers colony 2nd street, Pandian nagar, Tiruppur,Tamilnadu .' }
    ];

    for (const update of updates) {
      let setting = await settingsRepo.findOneBy({ key: update.key });
      if (setting) {
        setting.value = update.value;
        await settingsRepo.save(setting);
        console.log(`Updated ${update.key}`);
      } else {
        const newSetting = settingsRepo.create({
          key: update.key,
          value: update.value,
          isEncrypted: false
        });
        await settingsRepo.save(newSetting);
        console.log(`Created ${update.key}`);
      }
    }

    console.log('Sync complete');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

sync();
