import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const TemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    icon: { type: String, required: true },
    description: { type: String },
    fields: [mongoose.Schema.Types.Mixed],
    categories: [mongoose.Schema.Types.Mixed],
    settings: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const Template = mongoose.model('Template', TemplateSchema);

async function dumpTemplates() {
    try {
        console.log('Connecting to MONGO_URI...');
        await mongoose.connect(process.env.MONGO_URI!);
        console.log('Connected.');

        const templates = await Template.find({});
        console.log('Found templates:', templates.length);
        console.log(JSON.stringify(templates, null, 2));

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

dumpTemplates();
