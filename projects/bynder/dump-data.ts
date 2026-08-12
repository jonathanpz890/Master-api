import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function dumpData() {
    try {
        await mongoose.connect(process.env.MONGO_URI!);

        const Template = mongoose.model('Template', new mongoose.Schema({}, { strict: false }));
        const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }));

        const templates = await Template.find({});
        const categories = await Category.find({});

        console.log('--- TEMPLATES ---');
        console.log(JSON.stringify(templates, null, 2));
        console.log('--- CATEGORIES ---');
        console.log(JSON.stringify(categories, null, 2));

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

dumpData();
