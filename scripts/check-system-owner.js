require('dotenv').config();
const { Company } = require('../src/models');

(async () => {
    const c = await Company.findByPk('fb187614-0412-4d82-ae96-283a0394ae84');
    if (!c) {
        console.log('❌ Company not found');
        process.exit(1);
    }
    console.log('Company:', c.name);
    console.log('isSystemOwner:', c.isSystemOwner);
    console.log('Type:', typeof c.isSystemOwner);
    process.exit(0);
})();