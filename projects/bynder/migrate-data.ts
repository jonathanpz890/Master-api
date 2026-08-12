import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const baseUri = process.env.MONGO_URI!.split('?')[0].replace(/\/$/, "");
const options = process.env.MONGO_URI!.includes('?') ? '?' + process.env.MONGO_URI!.split('?')[1] : "";

const testUri = `${baseUri}/test${options}`;
const productionUri = `${baseUri}/production${options}`;

async function migrate() {
    try {
        console.log('--- MIGRATION START ---');

        // 1. Get data from TEST
        console.log('Connecting to TEST database...');
        const testConn = await mongoose.createConnection(testUri).asPromise();
        console.log('Connected to TEST.');

        const Template = testConn.model('Template', new mongoose.Schema({}, { strict: false }));
        const Category = testConn.model('Category', new mongoose.Schema({}, { strict: false }));

        const templates = await Template.find({});
        const categories = await Category.find({});

        console.log(`Found ${templates.length} templates and ${categories.length} categories in TEST.`);
        await testConn.close();

        if (templates.length === 0 && categories.length === 0) {
            console.log('No data to migrate.');
            return;
        }

        // 2. Put data into PRODUCTION
        console.log('Connecting to PRODUCTION database...');
        const prodConn = await mongoose.createConnection(productionUri).asPromise();
        console.log('Connected to PRODUCTION.');

        const ProdTemplate = prodConn.model('Template', new mongoose.Schema({}, { strict: false }));
        const ProdCategory = prodConn.model('Category', new mongoose.Schema({}, { strict: false }));

        console.log('Clearing existing templates and categories in PRODUCTION...');
        await ProdTemplate.deleteMany({});
        await ProdCategory.deleteMany({});

        console.log('Inserting templates...');
        if (templates.length > 0) {
            await ProdTemplate.insertMany(templates.map(t => {
                const obj = t.toObject();
                delete obj.__v;
                return obj;
            }));
        }

        console.log('Inserting categories...');
        if (categories.length > 0) {
            await ProdCategory.insertMany(categories.map(c => {
                const obj = c.toObject();
                delete obj.__v;
                return obj;
            }));
        }

        console.log('Migration successful!');
        await prodConn.close();

    } catch (error) {
        console.error('Migration failed:', error);
    }
}

migrate();
